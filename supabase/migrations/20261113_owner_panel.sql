-- Owner's panel migration
-- Run AFTER 20261112_jalgorithm.sql. Safe to re-run (idempotent).
--
--  1. business_profile: salon details the owner edits in the Owner's panel.
--  2. services: adds keywords (aliases), description, ordering and landing-page visibility.
--  3. Owner allow-list (app_owners + is_owner()): only listed accounts may edit business data
--     or read appointments / chat logs. Previously ANY signed-in account could.
--
-- After running, add the owner's account (Supabase → Authentication → Users → copy the user id):
--   insert into app_owners (user_id) values ('<owner-user-uuid>') on conflict do nothing;

begin;

-- ── owner allow-list ────────────────────────────────────────────────────────
create table if not exists app_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table app_owners enable row level security; -- no policies: only reachable through is_owner()

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_owners where user_id = auth.uid())
$$;
revoke all on function is_owner() from public;
grant execute on function is_owner() to anon, authenticated;

-- ── shared updated_at trigger ───────────────────────────────────────────────
create or replace function jal_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── business profile (single row) ───────────────────────────────────────────
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

-- ── services: owner-editable details ────────────────────────────────────────
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

-- Seed keywords/descriptions only where still empty, so owner edits are never overwritten.
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
-- No delete policy: services are deactivated (active = false) so past appointments keep their service.

-- ── booking settings: public read, owner write ──────────────────────────────
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

-- ── appointments / chat logs: owner only (was: any signed-in account) ───────
drop policy if exists "Allow authenticated read on appointments" on appointments;
drop policy if exists "Owner manage appointments" on appointments;
create policy "Owner manage appointments" on appointments for all to authenticated using (is_owner()) with check (is_owner());

drop policy if exists "Allow authenticated read on chat_logs" on chat_logs;
drop policy if exists "Owner read chat_logs" on chat_logs;
create policy "Owner read chat_logs" on chat_logs for select to authenticated using (is_owner());
-- The chat page also logs turns when the owner tests it while signed in.
drop policy if exists "Authenticated insert chat_logs" on chat_logs;
create policy "Authenticated insert chat_logs" on chat_logs for insert to authenticated with check (true);

commit;
