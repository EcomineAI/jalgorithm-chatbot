-- Beneficiary interview features migration (Makeup and Hair by Trev Luna)
-- Run AFTER 20261113_owner_panel.sql. Safe to re-run (idempotent).
--
-- Adds optional columns to business_profile and services so the Owner Panel can
-- customize branding, artist bio, Facebook/Messenger page URL, service inclusions,
-- inclusive vs. out-of-town travel fees, additional head rates, and tiered booking policies.

begin;

-- ── business_profile extensions ──────────────────────────────────────────────
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

-- ── services: package inclusions ─────────────────────────────────────────────
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
