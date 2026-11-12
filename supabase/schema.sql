-- JALgorithm Supabase Schema (base tables)
-- Fresh install: run this file, then supabase/migrations/20261112_jalgorithm.sql
-- (services, booking settings, reference codes and the chatbot booking functions).

-- Appointments table
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

-- Chat logs table (for research evaluation)
create table if not exists chat_logs (
  id uuid default gen_random_uuid() primary key,
  session_id text,
  user_message text not null,
  bot_reply text,
  intent_classified text, -- JAlgorithm intent id, e.g. BOOK_APPOINTMENT, UNKNOWN_INTENT
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table appointments enable row level security;
alter table chat_logs enable row level security;

-- Policy: anyone can insert chat logs (clients chatting)
create policy "Allow public insert on chat_logs"
  on chat_logs for insert
  to anon
  with check (true);

-- Policy: only authenticated (stylist) can read everything
create policy "Allow authenticated read on appointments"
  on appointments for all
  to authenticated
  using (true);

create policy "Allow authenticated read on chat_logs"
  on chat_logs for select
  to authenticated
  using (true);

-- The public chatbot never writes appointments directly: it calls the SECURITY DEFINER
-- functions jal_book / jal_reschedule / jal_cancel defined in the migration.
