-- JAlgorithm migration
-- Run in the Supabase SQL editor AFTER supabase/schema.sql. Safe to re-run (idempotent).
--
--  1. Removes the temporary LM Studio tunnel table.
--  2. Adds the services catalogue and booking settings.
--  3. Adds reference codes to appointments and NLU fields to chat_logs.
--  4. Adds SECURITY DEFINER functions the public chatbot calls via supabase.rpc().
--     They enforce working hours, advance notice, overlaps, cutoffs and ownership
--     (reference code + mobile number) on the server, and never return other clients' data.

begin;

-- ── 1. remove the LLM tunnel ────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tunnel_config') then
    alter publication supabase_realtime drop table tunnel_config;
  end if;
end $$;
drop table if exists tunnel_config;

-- ── 2. services and settings ────────────────────────────────────────────────
create table if not exists services (
  key text primary key,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true
);

-- Durations are working assumptions; adjust them to the artist's real times.
insert into services (key, name, price, duration_minutes) values
  ('bridal',          'Bridal Makeup (full)',               3500, 180),
  ('event_makeup',    'Event / Debut Makeup',               2000, 120),
  ('personal_makeup', 'Personal Makeup',                     800,  90),
  ('hair_styling',    'Hair Styling',                        500,  60),
  ('hair_makeup',     'Hair + Makeup Package',              2500, 150),
  ('wedding_package', 'Wedding Package (bride + entourage)', 8000, 300)
on conflict (key) do update set name = excluded.name, price = excluded.price, duration_minutes = excluded.duration_minutes;

alter table services enable row level security;
drop policy if exists "Public read services" on services;
create policy "Public read services" on services for select to anon, authenticated using (true);

create table if not exists booking_settings (
  id integer primary key default 1 check (id = 1),
  timezone text not null default 'Asia/Manila',
  open_time time not null default '08:00',
  close_time time not null default '19:00',      -- services must END by closing time
  min_advance_days integer not null default 3,
  cutoff_hours integer not null default 24,       -- cancel / reschedule notice
  slot_interval_minutes integer not null default 60,
  default_duration_minutes integer not null default 60
);
insert into booking_settings (id) values (1) on conflict (id) do nothing;
alter table booking_settings enable row level security;
drop policy if exists "Authenticated manage booking_settings" on booking_settings;
create policy "Authenticated manage booking_settings" on booking_settings for all to authenticated using (true) with check (true);

-- ── 3. table changes ────────────────────────────────────────────────────────
alter table appointments
  add column if not exists reference_code text,
  add column if not exists service_key text references services (key),
  add column if not exists duration_minutes integer;
create unique index if not exists appointments_reference_code_key on appointments (reference_code);
create index if not exists appointments_active_date_idx on appointments (appointment_date) where status in ('confirmed', 'rescheduled');

alter table chat_logs drop constraint if exists chat_logs_intent_classified_check;
alter table chat_logs
  add column if not exists confidence numeric,
  add column if not exists normalized_message text,
  add column if not exists language text,
  add column if not exists entities jsonb;

-- ── 4. helpers (not callable by the public) ────────────────────────────────
create or replace function jal_norm_contact(p text) returns text
language sql immutable as $$
  select case
    when d ~ '^639\d{9}$' then '0' || substr(d, 3)
    when d ~ '^09\d{9}$' then d
    else null
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create or replace function jal_random_code(n integer) returns text
language sql volatile as $$
  select string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, n)
$$;

-- Returns null when [p_start, p_start + p_minutes) is bookable, else a reason code.
create or replace function jal_slot_problem(p_start timestamptz, p_minutes integer, p_exclude uuid default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  s booking_settings;
  v_local timestamp;
  v_end timestamp;
  v_today date;
begin
  select * into s from booking_settings where id = 1;
  v_local := p_start at time zone s.timezone;
  v_end := v_local + make_interval(mins => p_minutes);
  v_today := (now() at time zone s.timezone)::date;

  if p_start < now() then return 'past_date'; end if;
  if v_local::date < v_today + s.min_advance_days then return 'too_soon'; end if;
  if v_local::time < s.open_time or v_end::date <> v_local::date or v_end::time > s.close_time then return 'outside_hours'; end if;
  if exists (
    select 1
    from appointments a
    left join services sv on sv.key = a.service_key
    where a.status in ('confirmed', 'rescheduled')
      and (p_exclude is null or a.id <> p_exclude)
      and a.appointment_date < p_start + make_interval(mins => p_minutes)
      and a.appointment_date + make_interval(mins => coalesce(a.duration_minutes, sv.duration_minutes, s.default_duration_minutes)) > p_start
  ) then
    return 'slot_taken';
  end if;
  return null;
end $$;

create or replace function jal_min_date() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone timezone)::date + min_advance_days from booking_settings where id = 1
$$;

-- ── 5. public chatbot API ───────────────────────────────────────────────────
create or replace function jal_available_slots(p_date date, p_service_key text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s booking_settings;
  v_dur integer;
  v_today date;
  m integer;
  v_close integer;
  v_slots text[] := '{}';
begin
  select * into s from booking_settings where id = 1;
  if p_date is null then return jsonb_build_object('ok', false, 'reason', 'invalid_date'); end if;
  v_today := (now() at time zone s.timezone)::date;
  if p_date < v_today then return jsonb_build_object('ok', false, 'reason', 'past_date'); end if;
  if p_date < v_today + s.min_advance_days then
    return jsonb_build_object('ok', false, 'reason', 'too_soon', 'min_date', v_today + s.min_advance_days);
  end if;

  if p_service_key is null then
    v_dur := s.default_duration_minutes;
  else
    select duration_minutes into v_dur from services where key = p_service_key and active;
    if v_dur is null then return jsonb_build_object('ok', false, 'reason', 'invalid_service'); end if;
  end if;

  m := (extract(epoch from s.open_time) / 60)::int;
  v_close := (extract(epoch from s.close_time) / 60)::int;
  while m + v_dur <= v_close loop
    if jal_slot_problem((p_date + make_time(m / 60, m % 60, 0)) at time zone s.timezone, v_dur) is null then
      v_slots := v_slots || to_char(make_time(m / 60, m % 60, 0), 'HH24:MI');
    end if;
    m := m + s.slot_interval_minutes;
  end loop;
  return jsonb_build_object('ok', true, 'date', p_date, 'slots', to_jsonb(v_slots));
end $$;

create or replace function jal_book(
  p_service_key text, p_date date, p_time time, p_name text, p_contact text, p_location text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s booking_settings;
  v_service services;
  v_name text := btrim(coalesce(p_name, ''));
  v_contact text := jal_norm_contact(p_contact);
  v_start timestamptz;
  v_problem text;
  v_ref text;
begin
  perform pg_advisory_xact_lock(hashtext('jal_booking'));  -- serialize bookings: no double booking
  select * into s from booking_settings where id = 1;
  select * into v_service from services where key = p_service_key and active;
  if v_service.key is null then return jsonb_build_object('ok', false, 'reason', 'invalid_service'); end if;
  if length(v_name) < 2 or length(v_name) > 80 then return jsonb_build_object('ok', false, 'reason', 'invalid_name'); end if;
  if v_contact is null then return jsonb_build_object('ok', false, 'reason', 'invalid_contact'); end if;
  if p_date is null or p_time is null then return jsonb_build_object('ok', false, 'reason', 'invalid_date'); end if;

  v_start := (p_date + p_time) at time zone s.timezone;
  v_problem := jal_slot_problem(v_start, v_service.duration_minutes);
  if v_problem is not null then
    return jsonb_build_object('ok', false, 'reason', v_problem, 'min_date', jal_min_date());
  end if;

  loop
    v_ref := 'JAL-' || jal_random_code(5);
    exit when not exists (select 1 from appointments where reference_code = v_ref);
  end loop;

  insert into appointments (client_name, client_contact, service_type, service_key, duration_minutes,
                            appointment_date, event_location, status, booking_method, reference_code)
  values (v_name, v_contact, v_service.name, v_service.key, v_service.duration_minutes,
          v_start, nullif(btrim(coalesce(p_location, '')), ''), 'confirmed', 'chatbot', v_ref);

  return jsonb_build_object('ok', true, 'reference_code', v_ref, 'date', p_date, 'time', to_char(p_time, 'HH24:MI'));
end $$;

create or replace function jal_lookup(p_reference text, p_contact text) returns appointments
language sql stable security definer set search_path = public as $$
  select a.* from appointments a
  where upper(a.reference_code) = upper(btrim(coalesce(p_reference, '')))
    and jal_norm_contact(a.client_contact) = jal_norm_contact(p_contact)
  limit 1
$$;

create or replace function jal_find(p_reference text, p_contact text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s booking_settings;
  a appointments;
begin
  select * into s from booking_settings where id = 1;
  a := jal_lookup(p_reference, p_contact);
  if a.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object(
    'ok', true,
    'reference_code', a.reference_code,
    'service_key', a.service_key,
    'service_name', coalesce((select name from services where key = a.service_key), a.service_type),
    'date', to_char(a.appointment_date at time zone s.timezone, 'YYYY-MM-DD'),
    'time', to_char(a.appointment_date at time zone s.timezone, 'HH24:MI'),
    'status', a.status
  );
end $$;

create or replace function jal_reschedule(p_reference text, p_contact text, p_date date, p_time time) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s booking_settings;
  a appointments;
  v_dur integer;
  v_start timestamptz;
  v_problem text;
begin
  perform pg_advisory_xact_lock(hashtext('jal_booking'));
  select * into s from booking_settings where id = 1;
  a := jal_lookup(p_reference, p_contact);
  if a.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.status = 'cancelled' then return jsonb_build_object('ok', false, 'reason', 'already_cancelled'); end if;
  if a.status = 'no_show' or now() > a.appointment_date - make_interval(hours => s.cutoff_hours) then
    return jsonb_build_object('ok', false, 'reason', 'too_late');
  end if;
  if p_date is null or p_time is null then return jsonb_build_object('ok', false, 'reason', 'invalid_date'); end if;

  v_dur := coalesce(a.duration_minutes, (select duration_minutes from services where key = a.service_key), s.default_duration_minutes);
  v_start := (p_date + p_time) at time zone s.timezone;
  v_problem := jal_slot_problem(v_start, v_dur, a.id);
  if v_problem is not null then
    return jsonb_build_object('ok', false, 'reason', v_problem, 'min_date', jal_min_date());
  end if;

  update appointments
     set appointment_date = v_start, status = 'rescheduled', reminder_sent = false, reminder_sent_at = null
   where id = a.id;
  return jsonb_build_object('ok', true, 'reference_code', a.reference_code, 'date', p_date, 'time', to_char(p_time, 'HH24:MI'));
end $$;

create or replace function jal_cancel(p_reference text, p_contact text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s booking_settings;
  a appointments;
begin
  select * into s from booking_settings where id = 1;
  a := jal_lookup(p_reference, p_contact);
  if a.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.status = 'cancelled' then return jsonb_build_object('ok', false, 'reason', 'already_cancelled'); end if;
  if a.status = 'no_show' or now() > a.appointment_date - make_interval(hours => s.cutoff_hours) then
    return jsonb_build_object('ok', false, 'reason', 'too_late');
  end if;
  update appointments set status = 'cancelled' where id = a.id;
  return jsonb_build_object('ok', true, 'reference_code', a.reference_code);
end $$;

-- ── 6. permissions ──────────────────────────────────────────────────────────
-- Supabase grants EXECUTE on new public functions to anon by default; lock helpers down.
revoke all on function jal_norm_contact(text) from public, anon, authenticated;
revoke all on function jal_random_code(integer) from public, anon, authenticated;
revoke all on function jal_slot_problem(timestamptz, integer, uuid) from public, anon, authenticated;
revoke all on function jal_min_date() from public, anon, authenticated;
revoke all on function jal_lookup(text, text) from public, anon, authenticated;

revoke all on function jal_available_slots(date, text) from public;
revoke all on function jal_book(text, date, time, text, text, text) from public;
revoke all on function jal_find(text, text) from public;
revoke all on function jal_reschedule(text, text, date, time) from public;
revoke all on function jal_cancel(text, text) from public;
grant execute on function jal_available_slots(date, text) to anon, authenticated;
grant execute on function jal_book(text, date, time, text, text, text) to anon, authenticated;
grant execute on function jal_find(text, text) to anon, authenticated;
grant execute on function jal_reschedule(text, text, date, time) to anon, authenticated;
grant execute on function jal_cancel(text, text) to anon, authenticated;

commit;
