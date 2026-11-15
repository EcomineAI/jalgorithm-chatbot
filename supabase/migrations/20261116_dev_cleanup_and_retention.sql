-- Dev Studio Cleanup, Trash Deletion Policies & Configurable Auto-Retention (Default: 3 Days)
-- Run AFTER 20261115_dev_logs_and_cap.sql. Safe to re-run (idempotent).

begin;

alter table booking_settings
  add column if not exists dev_auto_prune_days integer not null default 3;

alter table booking_settings drop constraint if exists booking_settings_dev_auto_prune_days_check;
alter table booking_settings
  add constraint booking_settings_dev_auto_prune_days_check
  check (dev_auto_prune_days >= 0 and dev_auto_prune_days <= 90);

create index if not exists chat_logs_created_at_idx on chat_logs (created_at desc);
create index if not exists dev_chat_logs_created_at_idx on dev_chat_logs (created_at desc);
create index if not exists dev_chat_logs_session_idx on dev_chat_logs (session_id) where session_id is not null;

-- Owner-only DELETE permissions so Dev Studio can prune trash & expired sessions.
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

-- Keep 1,000-row rolling cap AND auto-prune dev_chat_logs older than dev_auto_prune_days.
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

-- Owner RPC: exact capacity counts & retention configuration.
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

-- Owner RPC: update auto-prune interval (0 = Off, 1..90 days).
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

-- Owner RPC: delete a specific session from dev_chat_logs + explicit trash rows from chat_logs.
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

-- Owner RPC: auto-prune expired dev logs + low-value trash rows in chat_logs past N days.
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
