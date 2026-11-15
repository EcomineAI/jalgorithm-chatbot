# SQL: Clear Appointments and Chat Logs

Commands for clearing the **appointments** and **chat_logs** tables in the Supabase SQL Editor. Run them yourself, one block at a time, and read each result before you go on.

These commands delete data permanently. Nothing here runs automatically. The app doesn't use any of them.

---

## What is and isn't touched

| Table | Cleared by this file | Notes |
|---|---|---|
| `appointments` | Yes | All bookings, including the 14 rows loaded from the thesis doc |
| `chat_logs` | Yes | Only the owner-visible logs. The app's `dev_chat_logs` table is separate and isn't touched. |
| `services` | No | Salon price list |
| `booking_settings` | No | Opening hours and booking rules |
| `business_profile` | No | Salon details |
| `app_owners` | No | Owner accounts |
| `dev_chat_logs` | No | Developer Studio logs |

---

## Step 1: Check what is there

Run this first and write down the numbers.

```sql
select 'appointments' as table_name, count(*) as row_count from appointments
union all
select 'chat_logs', count(*) from chat_logs
union all
select 'dev_chat_logs', count(*) from dev_chat_logs;
```

---

## Step 2: Back up (recommended)

Copies each table into a backup table with a date in its name. The original table is not changed.

```sql
create table if not exists appointments_backup_20261115 as
select * from appointments;

create table if not exists chat_logs_backup_20261115 as
select * from chat_logs;
```

Check the backup has the same count as the original:

```sql
select
  (select count(*) from appointments)        as appointments_now,
  (select count(*) from appointments_backup_20261115) as appointments_backup,
  (select count(*) from chat_logs)           as chat_logs_now,
  (select count(*) from chat_logs_backup_20261115)    as chat_logs_backup;
```

If the two numbers don't match for a table, stop and don't clear that table.

If you don't want backups, skip this step. The clear can't be undone without them.

---

## Step 3: Clear appointments only

```sql
truncate table appointments;
```

Clears every appointment row. Leave the chat logs as they are if you only want to reset bookings.

---

## Step 4: Clear chat logs only

```sql
truncate table chat_logs;
```

Clears every row in the owner's chat logs. The Developer Studio logs (`dev_chat_logs`) are not affected.

---

## Step 5: Clear both (same as Steps 3 and 4)

```sql
truncate table appointments, chat_logs;
```

Use this when you want a clean start for both. Run Step 2 first if you want a backup.

---

## Step 6: Confirm the tables are empty

```sql
select
  (select count(*) from appointments) as appointments_rows,
  (select count(*) from chat_logs)    as chat_logs_rows;
```

Both should show `0`. The other tables should still have their rows, so check `services` and `business_profile` too if you're unsure:

```sql
select
  (select count(*) from services)         as services_rows,
  (select count(*) from booking_settings) as booking_settings_rows,
  (select count(*) from business_profile) as business_profile_rows,
  (select count(*) from app_owners)       as app_owners_rows;
```

---

## Restore from backup (if you need to undo)

Only works if you ran Step 2 and the table is still empty.

```sql
insert into appointments select * from appointments_backup_20261115;
insert into chat_logs select * from chat_logs_backup_20261115;
```

Run only the line for the table you want to restore. If the table already has rows, this will fail on duplicate IDs. Don't force it. Ask first.

---

## Remove the backup tables when you're done

Only after you've checked the new data and no longer need the backups:

```sql
drop table if exists appointments_backup_20261115;
drop table if exists chat_logs_backup_20261115;
```

This can't be undone either.

---

## Things to know before you run these

- **`truncate` is permanent.** It doesn't ask for confirmation, and it skips row-by-row triggers.
- **It removes the rows the owner dashboard shows.** The dashboard reads from these tables, so the Appointments and Chat Logs tabs will be empty afterwards.
- **Chat logs are capped at 1,000 rows.** A database trigger keeps only the newest 1,000. Clearing removes all of them, not just the extra ones.
- **Imported rows come back the same way.** If you clear and then re-import from the CSV files, check the counts afterwards.
- **Reference codes free up.** After clearing, the code `JAL-XXXXX` can be generated again, which is fine because the old bookings are gone.


truncate table appointments;
truncate table chat_logs;