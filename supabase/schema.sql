-- JALgorithm Supabase Schema
-- Run this in the Supabase SQL editor to set up the database.

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
  intent_classified text check (intent_classified in ('book', 'reschedule', 'cancel', 'faq', 'other')),
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

-- Policy: allow chatbot (anon) to insert appointments via service role
-- (use Supabase Edge Functions with service role key for this)

-- Tunnel config table (stores the current LM Studio tunnel URL)
create table if not exists tunnel_config (
  id integer primary key default 1,
  lm_studio_url text,
  updated_at timestamptz default now()
);

-- Seed one row so tunnel_bridge.py can always PATCH it
insert into tunnel_config (id, lm_studio_url)
values (1, null)
on conflict (id) do nothing;

-- Enable realtime on tunnel_config so frontend gets instant updates
alter publication supabase_realtime add table tunnel_config;

-- Enable RLS
alter table tunnel_config enable row level security;

-- Anyone can read the tunnel URL (needed by the public chat page)
create policy "Allow public read on tunnel_config"
  on tunnel_config for select
  to anon
  using (true);

-- Only service role can write (tunnel_bridge.py uses service key)
create policy "Allow service role write on tunnel_config"
  on tunnel_config for all
  to service_role
  using (true)
  with check (true);
