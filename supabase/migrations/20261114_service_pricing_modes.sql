-- Service pricing modes migration (fixed, starting rate, price range, price may vary)
-- Run AFTER 20261114_beneficiary_interview_features.sql. Safe to re-run (idempotent).

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
