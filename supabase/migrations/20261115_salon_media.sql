-- Salon media & portfolio photos migration (Hero, Artist, Service photos, Portfolio Gallery)
-- Safe to re-run (idempotent). Grants owner-only uploads to the `salon-media` Storage bucket.

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
