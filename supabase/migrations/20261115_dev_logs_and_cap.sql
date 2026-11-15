-- Dev-only raw chat logs table + 1,000-row rolling database cap on chat_logs and dev_chat_logs
-- Run AFTER 20261115_salon_media.sql. Safe to re-run (idempotent).

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

-- Enforce a strict 1,000-row newest-records cap to keep database usage bounded.
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

-- Trim any pre-existing chat_logs over 1,000 rows immediately.
delete from public.chat_logs
 where id in (
   select id from public.chat_logs
   order by created_at desc, id desc
   offset 1000
 );

commit;
