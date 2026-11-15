-- Session reminders and push notifications.
--
--  * client_messages: messages the owner (or the auto-reminder job) posts to a client's chat.
--    The client's browser fetches undelivered messages with jal_session_messages(ref, mobile),
--    which requires the same reference + mobile check as jal_find, then shows them in the session.
--  * push_subscriptions: Web Push endpoints for owners and for clients (per booking reference).
--  * Triggers call the notify Edge Function through pg_net:
--      - a new client message  -> push to that booking's client devices
--      - new / cancelled / rescheduled booking -> push to owner devices
--
-- Needs 20261117_auto_reminders.sql (pg_net, the vault secrets, jal_post_notify helper).
-- Extra Vault secret: notify_function_url, e.g. https://<project-ref>.supabase.co/functions/v1/notify
-- Idempotent: safe to re-run.

-- ── Client messages (shown in the client's chat session) ───────────────────
create table if not exists client_messages (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments (id) on delete cascade,
  reference_code text not null,
  kind           text not null default 'reminder' check (kind in ('reminder')),
  body           text not null check (length(body) between 1 and 2000),
  created_at     timestamptz not null default now(),
  delivered_at   timestamptz
);

create index if not exists client_messages_undelivered_idx
  on client_messages (reference_code) where delivered_at is null;

alter table client_messages enable row level security;

drop policy if exists "owners read client_messages" on client_messages;
create policy "owners read client_messages" on client_messages
  for select to authenticated using (is_owner());
-- No direct insert/update policies: writes go through the functions below.

-- ── Push subscriptions ──────────────────────────────────────────────────────
create table if not exists push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  endpoint       text not null check (endpoint like 'https://%'),
  p256dh         text not null,
  auth           text not null,
  audience       text not null check (audience in ('owner', 'client')),
  reference_code text,                          -- set for client devices only
  created_at     timestamptz not null default now(),
  last_error     text,
  check ((audience = 'client') = (reference_code is not null))
);

create index if not exists push_subscriptions_ref_idx on push_subscriptions (reference_code);
create index if not exists push_subscriptions_owner_idx on push_subscriptions (audience);

alter table push_subscriptions enable row level security;
-- No policies: only security-definer functions and the service role touch this table.

-- ── Client: fetch undelivered messages for one booking ─────────────────────
create or replace function jal_session_messages(p_ref text, p_contact text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_appt uuid;
  v_out  jsonb;
begin
  -- Reject anything that is not a booking code, before touching any data.
  if upper(btrim(coalesce(p_ref, ''))) !~ '^JAL-[A-Z0-9]{5}$' then
    return '[]'::jsonb;
  end if;

  select a.id into v_appt
  from appointments a
  where a.reference_code = upper(btrim(coalesce(p_ref, '')))
    and jal_norm_contact(a.client_contact) = jal_norm_contact(p_contact)
  limit 1;

  if v_appt is null then
    return '[]'::jsonb;
  end if;

  with due as (
    update client_messages m
       set delivered_at = now()
     where m.appointment_id = v_appt
       and m.delivered_at is null
    returning m.id, m.body, m.created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'body', body, 'createdAt', created_at)
                            order by created_at), '[]'::jsonb)
    into v_out
  from due;

  return v_out;
end $$;

revoke all on function jal_session_messages(text, text) from public;
grant execute on function jal_session_messages(text, text) to anon, authenticated;

-- ── Owner: post a reminder into the client's session ──────────────────────
create or replace function jal_send_session_reminder(p_appointment_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ref text;
  v_id  uuid;
begin
  if not is_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'reminder text is empty';
  end if;

  select a.reference_code into v_ref from appointments a where a.id = p_appointment_id;
  if v_ref is null then
    raise exception 'this booking has no reference code, so it cannot be shown in a client session';
  end if;

  insert into client_messages (appointment_id, reference_code, body)
  values (p_appointment_id, v_ref, btrim(p_body))
  returning id into v_id;

  update appointments
     set reminder_sent = true, reminder_sent_at = now()
   where id = p_appointment_id;

  return v_id;
end $$;

revoke all on function jal_send_session_reminder(uuid, text) from public, anon;
grant execute on function jal_send_session_reminder(uuid, text) to authenticated;

-- ── Push registration ──────────────────────────────────────────────────────
create or replace function jal_register_client_push(
  p_endpoint text, p_p256dh text, p_auth text, p_ref text, p_contact text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_ref text := upper(btrim(coalesce(p_ref, '')));
begin
  if v_ref !~ '^JAL-[A-Z0-9]{5}$' or p_endpoint !~ '^https://' then
    return false;
  end if;

  if not exists (
    select 1 from appointments a
    where a.reference_code = v_ref
      and jal_norm_contact(a.client_contact) = jal_norm_contact(p_contact)
  ) then
    return false;
  end if;

  delete from push_subscriptions
   where endpoint = p_endpoint and audience = 'client' and reference_code = v_ref;

  insert into push_subscriptions (endpoint, p256dh, auth, audience, reference_code)
  values (p_endpoint, p_p256dh, p_auth, 'client', v_ref);

  return true;
end $$;

create or replace function jal_register_owner_push(p_endpoint text, p_p256dh text, p_auth text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  delete from push_subscriptions where endpoint = p_endpoint and audience = 'owner';
  insert into push_subscriptions (endpoint, p256dh, auth, audience)
  values (p_endpoint, p_p256dh, p_auth, 'owner');

  return true;
end $$;

revoke all on function jal_register_client_push(text, text, text, text, text) from public;
revoke all on function jal_register_owner_push(text, text, text) from public, anon;
grant execute on function jal_register_client_push(text, text, text, text, text) to anon, authenticated;
grant execute on function jal_register_owner_push(text, text, text) to authenticated;

-- ── Notification triggers ──────────────────────────────────────────────────
-- Notifications must never block a booking or a message, so every error is swallowed.
create or replace function jal_post_notify(p_body jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_function_url'),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')),
    body    := p_body
  );
exception when others then
  null;
end $$;

revoke all on function jal_post_notify(jsonb) from public, anon, authenticated;

create or replace function jal_notify_client_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform jal_post_notify(jsonb_build_object('type', 'client_message', 'message_id', new.id));
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists jal_client_message_notify on client_messages;
create trigger jal_client_message_notify
  after insert on client_messages
  for each row execute function jal_notify_client_message();

create or replace function jal_notify_appointment_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform jal_post_notify(jsonb_build_object('type', 'owner_event', 'event', 'booked', 'appointment_id', new.id));
  elsif new.status is distinct from old.status and new.status in ('cancelled', 'rescheduled') then
    perform jal_post_notify(jsonb_build_object('type', 'owner_event', 'event', new.status, 'appointment_id', new.id));
  end if;
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists jal_appointment_event_notify on appointments;
create trigger jal_appointment_event_notify
  after insert or update of status on appointments
  for each row execute function jal_notify_appointment_event();

-- Trigger functions are not API endpoints.
revoke all on function jal_notify_client_message() from public, anon, authenticated;
revoke all on function jal_notify_appointment_event() from public, anon, authenticated;
