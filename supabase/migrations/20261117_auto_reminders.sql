-- Automatic client reminders, sent 3 days before each appointment.
--
-- Flow (all times Asia/Manila):
--   09:00  jal_queue_3day_reminders() puts every confirmed/rescheduled booking that is
--          1 to 3 days away into reminder_queue (once per appointment date).
--   09:05  pg_net calls the send-reminders Edge Function, which sends each pending row
--          through the SMS gateway, then sets appointments.reminder_sent = true.
--
-- Prerequisites (Supabase dashboard -> Database -> Extensions): pg_cron and pg_net enabled.
-- Secrets (Supabase dashboard -> Project Settings -> Vault), created before the jobs run:
--   reminder_function_url  e.g. https://<project-ref>.supabase.co/functions/v1/send-reminders
--   reminder_cron_secret   any long random string; the Edge Function checks it (CRON_SECRET)
-- Idempotent: safe to re-run.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ── Queue table ─────────────────────────────────────────────────────────────
create table if not exists reminder_queue (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  kind           text not null default '3_day' check (kind in ('3_day')),
  scheduled_for  timestamptz not null,           -- appointment_date when queued; a reschedule queues again
  recipient      text,                           -- normalized 09XXXXXXXXX, null if the contact is unusable
  message        text not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts       integer not null default 0,
  last_error     text,
  queued_at      timestamptz not null default now(),
  sent_at        timestamptz,
  unique (appointment_id, kind, scheduled_for)
);

create index if not exists reminder_queue_pending_idx
  on reminder_queue (queued_at) where status = 'pending';

alter table reminder_queue enable row level security;

drop policy if exists "owners read reminder_queue" on reminder_queue;
create policy "owners read reminder_queue" on reminder_queue
  for select to authenticated using (is_owner());
-- No insert/update policies: only the security-definer function and the Edge Function
-- (service role, which bypasses RLS) write to this table.

-- ── Queue function ──────────────────────────────────────────────────────────
create or replace function jal_queue_3day_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  insert into reminder_queue (appointment_id, kind, scheduled_for, recipient, message, status)
  select
    a.id,
    '3_day',
    a.appointment_date,
    jal_norm_contact(a.client_contact),
    -- Same wording as buildClientReminderText() in src/lib/calendarLinks.js
    'Hello ' || coalesce(nullif(btrim(a.client_name), ''), 'there')
      || '! This is a reminder from ' || coalesce(bp.name, 'our studio')
      || ' for your ' || coalesce(nullif(a.service_type, ''), 'hair & makeup')
      || ' appointment on '
      || (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])
           [extract(month from a.appointment_date at time zone 'Asia/Manila')::int]
      || ' ' || extract(day from a.appointment_date at time zone 'Asia/Manila')::int
      || ', ' || extract(year from a.appointment_date at time zone 'Asia/Manila')::int
      || ' at ' || to_char(a.appointment_date at time zone 'Asia/Manila', 'FMHH12:MI AM')
      || case when nullif(btrim(coalesce(a.event_location, '')), '') is null then ''
              else ' at ' || btrim(a.event_location) end
      || case when a.reference_code is null then ''
              else ' (Ref: ' || a.reference_code || ')' end
      || '. Kindly reply to confirm your appointment. Thank you!',
    case when jal_norm_contact(a.client_contact) is null then 'skipped' else 'pending' end
  from appointments a
  left join business_profile bp on bp.id = 1
  where a.status in ('confirmed', 'rescheduled')
    and not coalesce(a.reminder_sent, false)
    and (a.appointment_date at time zone 'Asia/Manila')::date
        - (now() at time zone 'Asia/Manila')::date between 1 and 3
  on conflict (appointment_id, kind, scheduled_for) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function jal_queue_3day_reminders() from public, anon, authenticated;

-- ── Scheduled jobs ──────────────────────────────────────────────────────────
-- pg_cron uses UTC: 01:00 UTC = 09:00 Manila, 01:05 UTC = 09:05 Manila.
select cron.schedule(
  'jal-queue-3day-reminders',
  '0 1 * * *',
  $$ select jal_queue_3day_reminders(); $$
);

select cron.schedule(
  'jal-send-reminders',
  '5 1 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_function_url'),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')),
    body    := '{}'::jsonb
  );
  $$
);
