-- JALgorithm Complete Supabase Setup (idempotent single-paste script)
-- Combines:
--   1. supabase/schema.sql
--   2. supabase/migrations/20261112_jalgorithm.sql
--   3. supabase/migrations/20261113_owner_panel.sql
--   4. supabase/migrations/20261114_beneficiary_interview_features.sql
--
-- Safe to run on either an empty Supabase project or an existing initial_schema database.
-- After running, register an owner account from Authentication -> Users:
--   insert into public.app_owners (user_id) values ('PASTE-UID-HERE') on conflict do nothing;

-- ============================================================================
-- 1. Base tables (appointments, chat_logs)
-- ============================================================================
create table if not exists appointments (
  id uuid default gen_random_uuid() primary key,
  client_name text not null,
  client_contact text,
  service_type text not null,
  appointment_date timestamptz not null,
  event_location text,
  status text default 'confirmed' check (status in ('confirmed', 'rescheduled', 'cancelled', 'no_show')),
  booking_method text default 'chatbot',
  reminder_sent boolean default false,
  reminder_sent_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table if not exists chat_logs (
  id uuid default gen_random_uuid() primary key,
  session_id text,
  user_message text not null,
  bot_reply text,
  intent_classified text,
  created_at timestamptz default now()
);

alter table appointments enable row level security;
alter table chat_logs enable row level security;

drop policy if exists "Allow public insert on chat_logs" on chat_logs;
create policy "Allow public insert on chat_logs"
  on chat_logs for insert
  to anon
  with check (true);

-- ============================================================================
-- 2. JAlgorithm core (services, booking_settings, reference codes, RPCs)
-- ============================================================================
begin;

do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tunnel_config') then
    alter publication supabase_realtime drop table tunnel_config;
  end if;
end $$;
drop table if exists tunnel_config;

create table if not exists services (
  key text primary key,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true
);

insert into services (key, name, price, duration_minutes) values
  ('bridal',          'Bridal Makeup (full)',               3500, 180),
  ('event_makeup',    'Event / Debut Makeup',               2000, 120),
  ('personal_makeup', 'Personal Makeup',                     800,  90),
  ('hair_styling',    'Hair Styling',                        500,  60),
  ('hair_makeup',     'Hair + Makeup Package',              2500, 150),
  ('wedding_package', 'Wedding Package (bride + entourage)', 8000, 300)
on conflict (key) do nothing;

alter table services enable row level security;
drop policy if exists "Public read services" on services;
create policy "Public read services" on services for select to anon, authenticated using (true);

create table if not exists booking_settings (
  id integer primary key default 1 check (id = 1),
  timezone text not null default 'Asia/Manila',
  open_time time not null default '08:00',
  close_time time not null default '19:00',
  min_advance_days integer not null default 3,
  cutoff_hours integer not null default 24,
  slot_interval_minutes integer not null default 60,
  default_duration_minutes integer not null default 60
);
insert into booking_settings (id) values (1) on conflict (id) do nothing;
alter table booking_settings enable row level security;

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
  perform pg_advisory_xact_lock(hashtext('jal_booking'));
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

-- ============================================================================
-- 3. Owner panel (app_owners, is_owner, business_profile, owner RLS policies)
-- ============================================================================
begin;

create table if not exists app_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table app_owners enable row level security;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_owners where user_id = auth.uid())
$$;
revoke all on function is_owner() from public;
grant execute on function is_owner() to anon, authenticated;

create or replace function jal_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table if not exists business_profile (
  id integer primary key default 1 check (id = 1),
  name text not null check (length(btrim(name)) between 1 and 100),
  artist text not null check (length(btrim(artist)) between 1 and 100),
  location text not null check (length(btrim(location)) between 1 and 200),
  contact text,
  portfolio_url text,
  payment_methods text,
  consultation_fee numeric(10, 2) check (consultation_fee is null or consultation_fee >= 0),
  travel_areas text[] not null default '{}',
  reservation_fee numeric(10, 2) not null default 0 check (reservation_fee >= 0),
  reservation_fee_services text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into business_profile (id, name, artist, location, travel_areas, reservation_fee, reservation_fee_services)
values (1, 'Vicky''s Parlor', 'Vicky', 'Olongapo City, Zambales', '{Subic,Castillejos,San Antonio}', 1000, '{bridal,wedding_package}')
on conflict (id) do nothing;

drop trigger if exists business_profile_touch on business_profile;
create trigger business_profile_touch before update on business_profile
  for each row execute function jal_touch_updated_at();

alter table business_profile enable row level security;
drop policy if exists "Public read business_profile" on business_profile;
create policy "Public read business_profile" on business_profile for select to anon, authenticated using (true);
drop policy if exists "Owner update business_profile" on business_profile;
create policy "Owner update business_profile" on business_profile for update to authenticated using (is_owner()) with check (is_owner());

alter table services
  add column if not exists aliases text[] not null default '{}',
  add column if not exists description text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists show_on_landing boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'services_key_format') then
    alter table services add constraint services_key_format check (key ~ '^[a-z0-9_]{2,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_name_not_blank') then
    alter table services add constraint services_name_not_blank check (length(btrim(name)) between 1 and 100);
  end if;
end $$;

update services s set
  aliases = v.aliases,
  description = coalesce(s.description, v.description),
  sort_order = v.sort_order,
  show_on_landing = v.show_on_landing
from (values
  ('bridal',          '{bridal makeup,bridal,bride,ikakasal,kasal makeup,wedding makeup}'::text[], 'Full glam for your wedding day', 1, true),
  ('event_makeup',    '{event makeup,debut makeup,event,debut,debutante,party,prom,js prom,graduation,pageant,birthday,18th birthday}'::text[], 'Debuts, parties, and special events', 2, false),
  ('personal_makeup', '{personal makeup,personal,simple makeup,everyday makeup,regular makeup}'::text[], 'Debuts, parties, and shoots', 3, true),
  ('hair_styling',    '{hair styling,hairstyle,hair style,hairdo,hair do,updo,kulot,curls,ayos ng buhok,buhok,hair}'::text[], 'Updos and event-ready styles', 4, true),
  ('hair_makeup',     '{hair and makeup,hair at makeup,hair makeup,makeup and hair,hmu,hair makeup package}'::text[], 'Hair + makeup for entourages', 5, true),
  ('wedding_package', '{wedding package,entourage,bride and entourage,wedding}'::text[], 'Bride and entourage', 6, false)
) as v(key, aliases, description, sort_order, show_on_landing)
where s.key = v.key and cardinality(s.aliases) = 0;

drop trigger if exists services_touch on services;
create trigger services_touch before update on services
  for each row execute function jal_touch_updated_at();

drop policy if exists "Owner insert services" on services;
create policy "Owner insert services" on services for insert to authenticated with check (is_owner());
drop policy if exists "Owner update services" on services;
create policy "Owner update services" on services for update to authenticated using (is_owner()) with check (is_owner());

alter table booking_settings add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'booking_settings_sane') then
    alter table booking_settings add constraint booking_settings_sane check (
      open_time < close_time and min_advance_days between 0 and 60 and cutoff_hours between 0 and 168
      and slot_interval_minutes between 15 and 240 and default_duration_minutes between 15 and 600
    );
  end if;
end $$;
drop trigger if exists booking_settings_touch on booking_settings;
create trigger booking_settings_touch before update on booking_settings
  for each row execute function jal_touch_updated_at();

drop policy if exists "Authenticated manage booking_settings" on booking_settings;
drop policy if exists "Public read booking_settings" on booking_settings;
create policy "Public read booking_settings" on booking_settings for select to anon, authenticated using (true);
drop policy if exists "Owner update booking_settings" on booking_settings;
create policy "Owner update booking_settings" on booking_settings for update to authenticated using (is_owner()) with check (is_owner());

drop policy if exists "Allow authenticated read on appointments" on appointments;
drop policy if exists "Owner manage appointments" on appointments;
create policy "Owner manage appointments" on appointments for all to authenticated using (is_owner()) with check (is_owner());

drop policy if exists "Allow authenticated read on chat_logs" on chat_logs;
drop policy if exists "Owner read chat_logs" on chat_logs;
create policy "Owner read chat_logs" on chat_logs for select to authenticated using (is_owner());
drop policy if exists "Authenticated insert chat_logs" on chat_logs;
create policy "Authenticated insert chat_logs" on chat_logs for insert to authenticated with check (true);

commit;

-- ============================================================================
-- 4. Beneficiary interview extensions (branding, inclusions, travel & policies)
-- ============================================================================
begin;

alter table business_profile
  add column if not exists experience_years text,
  add column if not exists about_bio text,
  add column if not exists specialty_tags text[] not null default '{}',
  add column if not exists messenger_url text,
  add column if not exists free_travel_areas text[] not null default '{}',
  add column if not exists travel_fee_note text,
  add column if not exists additional_head_price numeric(10, 2),
  add column if not exists additional_head_note text,
  add column if not exists wedding_downpayment_percent integer,
  add column if not exists wedding_cancel_cutoff_days integer,
  add column if not exists event_downpayment_percent text,
  add column if not exists event_cancel_cutoff_days integer,
  add column if not exists same_day_rush_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'business_profile_additional_head_price_check') then
    alter table business_profile
      add constraint business_profile_additional_head_price_check
      check (additional_head_price is null or additional_head_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_profile_wedding_dp_check') then
    alter table business_profile
      add constraint business_profile_wedding_dp_check
      check (wedding_downpayment_percent is null or wedding_downpayment_percent between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_profile_wedding_cutoff_check') then
    alter table business_profile
      add constraint business_profile_wedding_cutoff_check
      check (wedding_cancel_cutoff_days is null or wedding_cancel_cutoff_days between 0 and 365);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_profile_event_cutoff_check') then
    alter table business_profile
      add constraint business_profile_event_cutoff_check
      check (event_cancel_cutoff_days is null or event_cancel_cutoff_days between 0 and 365);
  end if;
end $$;

alter table services
  add column if not exists inclusions text;

update services s set
  inclusions = coalesce(s.inclusions, v.inclusions)
from (values
  ('bridal',          'Full skin prep, long-wear HD bridal makeup, false lashes/contact lens application prep, bridal hairstyling, and touch-up notes'),
  ('event_makeup',    'Full glam event or debut makeup, skin prep, false lashes, and styled hair'),
  ('personal_makeup', 'Clean everyday glam makeup, natural skin prep, and light finishing'),
  ('hair_styling',    'Event-ready blowdry, curls, or traditional updo with pins and finishing spray'),
  ('hair_makeup',     'Complete hair styling and long-wear event makeup combo'),
  ('wedding_package', 'Full bridal makeup & hair plus entourage hair and makeup preparation')
) as v(key, inclusions)
where s.key = v.key and s.inclusions is null;

commit;

-- ============================================================================
-- 5. Service pricing modes (fixed, starting, range, varies)
-- ============================================================================
begin;

alter table services
  add column if not exists price_mode text not null default 'fixed',
  add column if not exists price_max numeric(10, 2),
  add column if not exists price_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'services_price_mode_check') then
    alter table services
      add constraint services_price_mode_check
      check (price_mode in ('fixed', 'starting', 'range', 'varies'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_price_max_check') then
    alter table services
      add constraint services_price_max_check
      check (price_max is null or price_max >= price);
  end if;
end $$;

commit;

-- ============================================================================
-- 6. Salon media & portfolio photos (Hero, Artist, Service photos, Gallery)
-- ============================================================================
begin;

alter table business_profile
  add column if not exists hero_photo_url text,
  add column if not exists artist_photo_url text,
  add column if not exists gallery_urls text[] not null default '{}';

alter table services
  add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('salon-media', 'salon-media', true)
on conflict (id) do nothing;

drop policy if exists "Public read salon-media" on storage.objects;
create policy "Public read salon-media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'salon-media');

drop policy if exists "Owner insert salon-media" on storage.objects;
create policy "Owner insert salon-media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'salon-media' and public.is_owner());

drop policy if exists "Owner update salon-media" on storage.objects;
create policy "Owner update salon-media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'salon-media' and public.is_owner())
  with check (bucket_id = 'salon-media' and public.is_owner());

drop policy if exists "Owner delete salon-media" on storage.objects;
create policy "Owner delete salon-media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'salon-media' and public.is_owner());

commit;

-- ============================================================================
-- 7. Dev raw chat logs & 1,000-row rolling database cap
-- ============================================================================
begin;

create table if not exists dev_chat_logs (
  id uuid default gen_random_uuid() primary key,
  session_id text,
  user_message text not null,
  bot_reply text,
  intent_classified text,
  confidence numeric,
  normalized_message text,
  language text,
  entities jsonb,
  is_trash boolean not null default false,
  owner_logged boolean not null default false,
  source text not null default 'public',
  created_at timestamptz default now()
);

alter table dev_chat_logs enable row level security;

drop policy if exists "Allow public insert on dev_chat_logs" on dev_chat_logs;
create policy "Allow public insert on dev_chat_logs"
  on dev_chat_logs for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Owner read dev_chat_logs" on dev_chat_logs;
create policy "Owner read dev_chat_logs"
  on dev_chat_logs for select
  to authenticated
  using (is_owner());

create or replace function enforce_chat_logs_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'chat_logs' then
    delete from public.chat_logs
     where id in (
       select id from public.chat_logs
       order by created_at desc, id desc
       offset 1000
     );
  elsif tg_table_name = 'dev_chat_logs' then
    delete from public.dev_chat_logs
     where id in (
       select id from public.dev_chat_logs
       order by created_at desc, id desc
       offset 1000
     );
  end if;
  return null;
end $$;

drop trigger if exists trg_chat_logs_cap on chat_logs;
create trigger trg_chat_logs_cap
  after insert on chat_logs
  for each statement
  execute function enforce_chat_logs_cap();

drop trigger if exists trg_dev_chat_logs_cap on dev_chat_logs;
create trigger trg_dev_chat_logs_cap
  after insert on dev_chat_logs
  for each statement
  execute function enforce_chat_logs_cap();

-- ============================================================================
-- 8. Dev Studio Cleanup, Trash Deletion Policies & Auto-Retention (3 Days Default)
-- ============================================================================
alter table booking_settings
  add column if not exists dev_auto_prune_days integer not null default 3;

alter table booking_settings drop constraint if exists booking_settings_dev_auto_prune_days_check;
alter table booking_settings
  add constraint booking_settings_dev_auto_prune_days_check
  check (dev_auto_prune_days >= 0 and dev_auto_prune_days <= 90);

create index if not exists chat_logs_created_at_idx on chat_logs (created_at desc);
create index if not exists dev_chat_logs_created_at_idx on dev_chat_logs (created_at desc);
create index if not exists dev_chat_logs_session_idx on dev_chat_logs (session_id) where session_id is not null;

drop policy if exists "Owner delete chat_logs" on chat_logs;
create policy "Owner delete chat_logs"
  on chat_logs for delete
  to authenticated
  using (is_owner());

drop policy if exists "Owner delete dev_chat_logs" on dev_chat_logs;
create policy "Owner delete dev_chat_logs"
  on dev_chat_logs for delete
  to authenticated
  using (is_owner());

create or replace function enforce_chat_logs_cap() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_days integer;
begin
  if tg_table_name = 'chat_logs' then
    delete from public.chat_logs
     where id in (
       select id from public.chat_logs
       order by created_at desc, id desc
       offset 1000
     );
  elsif tg_table_name = 'dev_chat_logs' then
    select coalesce(dev_auto_prune_days, 3) into v_days
      from public.booking_settings
     where id = 1;

    if coalesce(v_days, 0) > 0 then
      delete from public.dev_chat_logs
       where created_at < now() - make_interval(days => v_days);
    end if;

    delete from public.dev_chat_logs
     where id in (
       select id from public.dev_chat_logs
       order by created_at desc, id desc
       offset 1000
     );
  end if;
  return null;
end $$;

create or replace function jal_get_dev_log_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_chat_count integer;
  v_dev_count integer;
  v_days integer;
begin
  if not is_owner() then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select count(*)::integer into v_chat_count from public.chat_logs;
  select count(*)::integer into v_dev_count from public.dev_chat_logs;
  select coalesce(dev_auto_prune_days, 3) into v_days from public.booking_settings where id = 1;

  return jsonb_build_object(
    'ok', true,
    'chatLogsCount', coalesce(v_chat_count, 0),
    'devLogsCount', coalesce(v_dev_count, 0),
    'maxRows', 1000,
    'autoPruneDays', coalesce(v_days, 3)
  );
end $$;

create or replace function jal_set_dev_prune_days(p_days integer) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_days integer;
begin
  if not is_owner() then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  v_days := greatest(0, least(90, coalesce(p_days, 3)));
  update public.booking_settings
     set dev_auto_prune_days = v_days
   where id = 1;

  return jsonb_build_object('ok', true, 'autoPruneDays', v_days);
end $$;

create or replace function jal_delete_log_session(
  p_session_id text default null,
  p_dev_ids uuid[] default '{}',
  p_owner_trash_ids uuid[] default '{}'
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_del_dev integer := 0;
  v_del_owner integer := 0;
begin
  if not is_owner() then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  delete from public.dev_chat_logs
   where (p_session_id is not null and session_id = p_session_id)
      or id = any(coalesce(p_dev_ids, '{}'));
  get diagnostics v_del_dev = row_count;

  if coalesce(array_length(p_owner_trash_ids, 1), 0) > 0 then
    delete from public.chat_logs
     where id = any(p_owner_trash_ids);
    get diagnostics v_del_owner = row_count;
  end if;

  return jsonb_build_object(
    'ok', true,
    'deletedDev', v_del_dev,
    'deletedOwnerTrash', v_del_owner
  );
end $$;

create or replace function jal_prune_dev_and_trash_logs(p_days integer default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_days integer;
  v_cutoff timestamptz;
  v_del_dev integer := 0;
  v_del_owner integer := 0;
begin
  if not is_owner() then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  if p_days is not null then
    v_days := greatest(0, least(90, p_days));
  else
    select coalesce(dev_auto_prune_days, 3) into v_days from public.booking_settings where id = 1;
  end if;

  if coalesce(v_days, 0) <= 0 then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'autoPruneDays', 0,
      'deletedDev', 0,
      'deletedOwnerTrash', 0
    );
  end if;

  v_cutoff := now() - make_interval(days => v_days);

  delete from public.dev_chat_logs
   where created_at < v_cutoff;
  get diagnostics v_del_dev = row_count;

  delete from public.chat_logs
   where created_at < v_cutoff
     and (
       intent_classified in ('UNKNOWN_INTENT', 'OUT_OF_SCOPE', 'GREETING', 'THANKS', 'RESET')
       or coalesce(length(btrim(user_message)), 0) <= 3
     )
     and coalesce(entities->>'action', '') = ''
     and not coalesce(
       user_message ~* '(book|bridal|debut|glam|hair|makeup|price|magkano|how much|reserve|urgent|jal-|09\d{9})',
       false
     );
  get diagnostics v_del_owner = row_count;

  return jsonb_build_object(
    'ok', true,
    'skipped', false,
    'autoPruneDays', v_days,
    'cutoff', v_cutoff,
    'deletedDev', v_del_dev,
    'deletedOwnerTrash', v_del_owner
  );
end $$;

revoke all on function jal_get_dev_log_stats() from public;
grant execute on function jal_get_dev_log_stats() to authenticated;

revoke all on function jal_set_dev_prune_days(integer) from public;
grant execute on function jal_set_dev_prune_days(integer) to authenticated;

revoke all on function jal_delete_log_session(text, uuid[], uuid[]) from public;
grant execute on function jal_delete_log_session(text, uuid[], uuid[]) to authenticated;

revoke all on function jal_prune_dev_and_trash_logs(integer) from public;
grant execute on function jal_prune_dev_and_trash_logs(integer) to authenticated;

commit;

-- ============================================================================
-- 9. Grant owner access (uncomment and paste your Authentication -> Users UID)
-- ============================================================================
-- insert into public.app_owners (user_id)
-- values ('PASTE-UID-HERE')
-- on conflict do nothing;
