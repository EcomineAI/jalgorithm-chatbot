-- Booking completion report (thesis objective 3.2). Read-only: safe to run any time.
--
-- Definitions
--   Started booking : a chat session with at least one turn classified BOOK_APPOINTMENT,
--                     or a turn logged while a BOOK_APPOINTMENT flow was active.
--   Completed       : the session has a successful bookAppointment action
--                     (logs from before 2026-11-15 lack the action field; for those,
--                      a bot reply containing a JAL-XXXXX code during a booking flow counts).
--   Funnel step     : entities.flow_step, the slot the bot asked for next (logged from 2026-11-16).
--
-- Run in Supabase -> SQL Editor. Each section returns one result set.

-- 1. Headline: completion rate ---------------------------------------------
with sessions as (
  select
    session_id,
    bool_or(intent_classified = 'BOOK_APPOINTMENT'
            or entities->>'flow_intent' = 'BOOK_APPOINTMENT')                      as started,
    -- coalesce: older rows have no action field, and NULL would hide them from the counts below.
    coalesce(bool_or(entities->'action'->>'name' = 'bookAppointment'
            and (entities->'action'->>'ok')::boolean), false)                      as booked_logged,
    coalesce(bool_or(intent_classified = 'BOOK_APPOINTMENT'
            and bot_reply ~ 'JAL-[A-Z0-9]{5}'), false)                             as booked_legacy,
    count(*)                                                                         as turns,
    extract(epoch from max(created_at) - min(created_at)) / 60.0                     as minutes
  from chat_logs
  group by session_id
)
select
  count(*) filter (where started)                                              as sessions_started,
  count(*) filter (where started and (booked_logged or booked_legacy))         as sessions_completed,
  round(100.0 * count(*) filter (where started and (booked_logged or booked_legacy))
        / nullif(count(*) filter (where started), 0), 1)                       as completion_rate_pct,
  count(*) filter (where started and booked_logged)                            as completed_by_action_log,
  count(*) filter (where started and booked_legacy and not booked_logged)      as completed_by_legacy_rule,
  percentile_cont(0.5) within group (order by turns)
    filter (where started and (booked_logged or booked_legacy))                as median_turns_to_book,
  round(percentile_cont(0.5) within group (order by minutes)
    filter (where started and (booked_logged or booked_legacy))::numeric, 1)   as median_minutes_to_book
from sessions;

-- 2. Funnel: furthest step reached per booking session (new logs only) ---------
with steps(step, ord) as (
  values ('service', 1), ('date', 2), ('time', 3), ('name', 4),
         ('contact', 5), ('location', 6), ('confirm', 7), ('booked', 8)
),
per_session as (
  select l.session_id,
         max(case
               when l.entities->'action'->>'name' = 'bookAppointment'
                    and (l.entities->'action'->>'ok')::boolean then 8
               else s.ord
             end) as furthest
  from chat_logs l
  left join steps s on s.step = l.entities->>'flow_step'
  where l.entities->>'flow_intent' = 'BOOK_APPOINTMENT'
     or (l.entities->'action'->>'name' = 'bookAppointment')
  group by l.session_id
)
select s.ord, s.step,
       count(p.session_id) filter (where p.furthest >= s.ord) as sessions_reached
from steps s
cross join per_session p
group by s.ord, s.step
order by s.ord;

-- 3. Why bookings failed -----------------------------------------------------
select coalesce(entities->'action'->>'reason', 'unknown') as reason,
       count(*)                                           as failed_attempts
from chat_logs
where entities->'action'->>'name' = 'bookAppointment'
  and not (entities->'action'->>'ok')::boolean
group by 1
order by 2 desc;
