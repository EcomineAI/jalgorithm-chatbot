# JALgorithm - ML-Based Appointment Chatbot

**A MACHINE LEARNING-BASED CHATBOT FOR AUTOMATED APPOINTMENT BOOKING AND REMINDERS**

By
**June Vic M. Abello**
**Lorraine R. Azucenas**
**Alan Jr. P. Ecalnir**

Bachelor of Science in Computer Science
Olongapo City, Philippines

---

A chatbot for automated appointment booking and reminders for small hair and makeup salons.
The chatbot, **JAL**, is powered by **JAlgorithm**: a lightweight engine that runs in the browser and does not generate text. It understands English, Filipino, and Taglish chat, including shortcuts ("pwde b bukas?"), misspellings, and follow-up messages. It uses a rule-based + machine-learning (Naive Bayes) hybrid intent classifier and a rule-based dialogue manager. No LLM, no external AI API, no model download, and no GPU are required.

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

In the Supabase SQL editor, run in order:

1. `supabase/schema.sql` (base tables: appointments, chat_logs)
2. `supabase/migrations/20261112_jalgorithm.sql`, which adds:
   - the services catalogue and booking settings (hours, 3-day advance rule, 24-hour cutoff)
   - reference codes
   - the chatbot booking functions (`jal_available_slots`, `jal_book`, `jal_find`, `jal_reschedule`, `jal_cancel`)
   - removal of the old LM Studio `tunnel_config` table
3. `supabase/migrations/20261113_owner_panel.sql`, which adds the salon profile, service keywords, and the owner allow-list

Both migrations are safe to re-run.

### 4. Create the owner account

1. In Supabase, go to **Authentication → Users → Add user** and create the owner's email and password.
2. Copy that user's **UID**, then run this in the SQL editor:
   ```sql
   insert into app_owners (user_id) values ('PASTE-UID-HERE') on conflict do nothing;
   ```
3. The owner signs in at `/owner/login`. Only accounts listed in `app_owners` can see appointments and chat logs or edit business info.

### 5. Fill in the business info

In the Owner's panel, open **Business Info**:

- **Salon details**: name, artist, location, contact, portfolio link, payment methods, consultation fee, travel areas, reservation fee
- **Services & prices**: name, price, duration, the keywords clients use (e.g. "kasal" for Bridal), whether it shows on the website, and whether it's still offered
- **Hours & booking rules**: opening/closing time, how many days ahead clients must book, cancel/reschedule notice, time between slots

The chatbot, navbar and landing page all show this data. Changes reach the chatbot the next time someone opens the chat. Service durations start as guesses (e.g. bridal = 3 hours), so check them first.

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
| `/` | Landing page (public) |
| `/chat` | Client chatbot interface |
| `/owner/login` | Owner login |
| `/owner` | Owner's panel (appointments, chat logs, reminders, business info) |
| `/admin` | Reserved for the developer debug panel (redirects to `/owner` for now) |

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
