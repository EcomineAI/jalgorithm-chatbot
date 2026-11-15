# JAL (JALgorithm) - Rule-Based & ML Appointment System

**A RULE-BASED AND MACHINE LEARNING-BASED ALGORITHM FOR AUTOMATED APPOINTMENT BOOKING AND REMINDERS**

By
**June Vic M. Abello**
**Lorraine R. Azucenas**
**Alan Jr. P. Ecalnir**

Bachelor of Science in Computer Science
Olongapo City, Philippines

---

An automated appointment booking and reminder system for small hair and makeup salons.
The conversational engine, **JAL**, runs in the browser and does not generate text. It understands English, Filipino, and Taglish chat, including shortcuts ("pwde b bukas?"), misspellings, and follow-up messages. It uses a rule-based + machine-learning (Naive Bayes + TF-IDF) hybrid intent classifier and a deterministic dialogue state machine. No external LLM, no cloud inference API, no model download, and no GPU are required.

## Stack

- **Frontend:** React + Vite + Tailwind CSS v4
- **Chatbot engine:** JAlgorithm (plain JavaScript, `src/jalgorithm/`), runs locally in the browser
- **Backend/DB:** Supabase (PostgreSQL + Auth + RPC functions)
- **Hosting:** Vercel (static build)
- **Tests:** Vitest

## What runs where

| Part | Where it runs | Needs internet? |
|---|---|---|
| Message understanding (normalization, intent, entities), dialogue, replies | Browser (JAlgorithm) | No |
| Answers about prices, services, location, hours, booking rules | Browser, using the owner's info (cached copy when offline; built-in defaults if never loaded) | No |
| Checking available slots, booking, viewing, rescheduling, cancelling | Supabase functions | **Yes** |
| Salon info, services, prices, hours (edited in the Owner's panel) | Supabase | To load or change: **yes** |
| Chat logs, Owner's panel, login | Supabase | **Yes** |

When Supabase can't be reached, JAL still answers questions. For booking actions it says the booking system is unavailable; it never pretends an action succeeded.

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set up Supabase

In the Supabase SQL editor, either paste `supabase/setup_all.sql` (combined idempotent script) or run these in order:

1. `supabase/schema.sql` (base tables: appointments, chat_logs)
2. `supabase/migrations/20261112_jalgorithm.sql`, which adds:
   - the services catalogue and booking settings (hours, 3-day advance rule, 24-hour cutoff)
   - reference codes
   - the chatbot booking functions (`jal_available_slots`, `jal_book`, `jal_find`, `jal_reschedule`, `jal_cancel`)
   - removal of the old LM Studio `tunnel_config` table
3. `supabase/migrations/20261113_owner_panel.sql`, which adds the salon profile, service keywords, and the owner allow-list
4. `supabase/migrations/20261114_beneficiary_interview_features.sql`, which adds service inclusions, artist bio/branding fields, travel fee notes, additional head rates, and tiered booking rules
5. `supabase/migrations/20261114_service_pricing_modes.sql`, which adds service pricing modes (`fixed`, `starting`, `range`, `varies`), max price, and price note
6. `supabase/migrations/20261115_salon_media.sql`, which adds hero/artist/service/gallery media columns and `salon-media` Storage bucket policies
7. `supabase/migrations/20261115_dev_logs_and_cap.sql`, which adds `dev_chat_logs` and a 1,000-row rolling cap trigger on `chat_logs` and `dev_chat_logs`
8. `supabase/migrations/20261116_dev_cleanup_and_retention.sql`, which adds owner delete policies, session cleanup RPCs, and configurable auto-retention (`dev_auto_prune_days`, default 3 days)
9. `supabase/migrations/20261117_auto_reminders.sql`, which adds the `reminder_queue` table, the daily 3-day reminder queue, and the pg_cron jobs. Enable `pg_cron` and `pg_net` first, and add the `reminder_function_url` and `reminder_cron_secret` secrets in Vault. Then deploy the `supabase/functions/send-reminders` Edge Function with its `CRON_SECRET`, `SMS_GATEWAY_URL` and `SMS_GATEWAY_KEY` secrets.

10. `supabase/migrations/20261118_session_messages_and_push.sql`, which adds session reminders (`client_messages`, `jal_send_session_reminder`, `jal_session_messages`), Web Push subscriptions, and the triggers that notify the owner and clients. Add the Vault secret `notify_function_url` (`https://<project-ref>.supabase.co/functions/v1/notify`), then deploy `supabase/functions/notify` with `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` set. Generate the keys once with `npx web-push generate-vapid-keys`. Put the public key in `.env.local` as `VITE_VAPID_PUBLIC_KEY` and the private key only in Supabase secrets. Redeploy `send-reminders` too, since it now posts into client sessions.

Both the individual migrations and `supabase/setup_all.sql` are safe to re-run. Steps 9 and 10 are not in `setup_all.sql`, so run them separately.

Push notifications need HTTPS (Vercel and localhost both qualify). iPhone only delivers web push to a site added to the Home Screen (iOS 16.4 or later).

### 4. Create the owner account

1. In Supabase, go to **Authentication → Users → Add user** and create the owner's email and password.
2. Copy that user's **UID**, then run this in the SQL editor:
   ```sql
   insert into app_owners (user_id) values ('PASTE-UID-HERE') on conflict do nothing;
   ```
3. The owner signs in at `/owner/login`. Only accounts listed in `app_owners` can see appointments and chat logs or edit business info.

### 5. Fill in the business info

In the Owner Studio (`/owner`), open **Business Info** (4 workspaces):

- **Salon Profile & Photos**: name, artist, bio, experience years, location, contact, Messenger/Page link, specialty tags, hero banner photo, artist portrait
- **Services & Portfolio**: service name, price mode (`fixed`, `starting`, `range`, `varies`), duration, inclusions, keywords clients use (e.g. "kasal" for Bridal), card images, and portfolio gallery photos (up to 12)
- **Hours & Booking Rules**: opening/closing time, minimum advance booking days, cancel/reschedule cutoff notice, buffer between slots
- **Travel, Extra Heads & Policies**: inclusive vs. out-of-town travel areas, additional head starting rate, payment methods, tiered deposit & rush rules, consultation fee

The chatbot, navbar (including the mobile navigation drawer), landing page, and Studio Lookbook all read this data dynamically. Service durations start as defaults (e.g. bridal = 3 hours), so review them with the artist first.

### 6. Run

```bash
npm run dev        # development server
npm run build      # production build (dist/)
npm run preview    # serve the production build locally
```

On Windows you can also double-click `start.bat`.

## Testing and evaluation

```bash
npm test           # unit + conversation tests (Vitest)
npm run evaluate   # intent-recognition evaluation → reports/evaluation.md / .json
node scripts/evaluate.js --set validation   # the set used for tuning
```

See [docs/NAVIGATION.md](docs/NAVIGATION.md) to find where to change things and how to debug them, and [docs/JALGORITHM.md](docs/JALGORITHM.md) for the engine design, methodology, and results.

## Pages

| Route | Description |
|---|---|
| `/` | Landing page (public: hero with white frosted-glass JAL preview, services filter, lookbook lightbox, dynamic FAQ) |
| `/chat` | Client chatbot interface (`localStorage` multi-session sidebar, step progress bar, reply quoting, saved drafts) |
| `/owner/login` | Owner login |
| `/owner` | Owner Studio (Dashboard Home, Appointments + Manual Booking, Chat Logs, Reminders & 1-Day Prep, Business Info) |
| `/dev` | Localhost desktop-only (`>= 1024px`) Dev Studio (DevBot sandbox, Raw Dev Logs, Cleanup & Auto-Retention, Batch Tester, System Map & Paper IPO, Animated NLU Flow) |
| `/admin` | Redirects to `/owner` |

## Editing the chatbot

All language data and replies are configuration, not code:

| To change… | Edit |
|---|---|
| Shortcuts / spelling variants (`pwde` → `pwede`) | `src/jalgorithm/config/shortcuts.js` |
| Synonyms and phrases per concept | `src/jalgorithm/config/lexicon.js` |
| Intent rule weights, thresholds | `src/jalgorithm/config/intents.js` |
| Bot replies (English and Taglish) | `src/jalgorithm/config/responses.js` |
| Salon info, services, prices, hours, service keywords | **Owner's panel → Business Info** (`src/jalgorithm/config/business.js` only holds the offline defaults) |
| Training examples for the ML classifier | `src/jalgorithm/data/training.js` |

After changing any of these, run `npm test` and `npm run evaluate`.

## Evaluation Targets

| Metric | Target |
|---|---|
| Intent-recognition accuracy | >= 85% |
| Booking completion rate | >= 90% |
| Reminder delivery rate | >= 95% |
| Response time | <= 3 seconds |
