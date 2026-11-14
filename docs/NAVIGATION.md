# Navigation guide: where things are and how to change them

Read this first. It answers "where do I change X?" and "where do I look when Y goes wrong?".

For the reasoning behind the chatbot (why it's built this way, how it was evaluated), read [JALGORITHM.md](JALGORITHM.md). For setup, read the [README](../README.md). For project history and decisions, read [HISTORY.md](HISTORY.md).

---

## 1. The big picture

There are three separate things in this repo. Most questions are about one of them.

| Part | Lives in | Runs where | Edited by |
|---|---|---|---|
| **Website + chat page** | `src/pages/`, `src/components/` | Browser (Vite build, hosted on Vercel) | Developer |
| **Chatbot brain (JAlgorithm)** | `src/jalgorithm/` | Browser, no internet needed | Developer (language data in `config/`) |
| **Business data and bookings** | Supabase (`supabase/`) | Supabase cloud | **Owner** via `/owner` → Business Info; bookings via chatbot |

**Golden rule:** prices, services, hours, contact details and booking rules are **data**, not code. The owner changes them in `/owner`. You only edit code for behaviour (new questions, new intents, layout).

### How a chat message travels

```
ChatPage.jsx  (user types, presses send)
   │
   ▼
jalgorithm/index.js  processMessage(text, state)
   │
   ▼
dialogue/manager.js        decides what to do next (ask a question, answer, book…)
   │   ├─ analyzer.js      understands the message:
   │   │    pipeline/preprocess → tokenizer → normalizer (shortcuts, typos)
   │   │    → entities/ (date, time, service, phone, ref code)
   │   │    → classifier/ (rules + Naive Bayes + TF-IDF → intent)
   │   ├─ responder.js     picks a reply from config/responses.js
   │   └─ actions          booking calls → services/appointments.js → Supabase RPC
   ▼
reply shown in chat, turn logged to chat_logs (Supabase)
```

Business facts (prices, hours, location) come in through a **catalog** object. In the app it's loaded from Supabase by `services/businessInfo.js` (cached, with built-in defaults in `config/business.js` as the offline fallback).

---

## 2. "I want to…" quick table

| I want to… | Edit this | Also |
|---|---|---|
| Change a price, service name, keyword, duration | **Owner's panel** (`/owner` → Business Info) | No code change |
| Change hours, booking rules, reservation fee | **Owner's panel** | No code change |
| Change salon location, contact, payment methods | **Owner's panel** | No code change |
| Teach JAL a new shorthand (`pwde` → `pwede`) | `src/jalgorithm/config/shortcuts.js` → `SIMPLE_SHORTCUTS` | run `npm test` |
| Teach JAL a new synonym or phrase (`ibang araw` = reschedule) | `src/jalgorithm/config/lexicon.js` → `CONCEPTS` | run `npm run evaluate` |
| Make JAL understand a new kind of sentence | `src/jalgorithm/data/training.js` (add an example line) | run `npm run evaluate` |
| Change how strongly a concept pushes an intent | `src/jalgorithm/config/intents.js` → `rules` | run `npm run evaluate` |
| Change what JAL says | `src/jalgorithm/config/responses.js` (**both** `en` and `fil`) | run `npm test` |
| Add a new date or time format | `src/jalgorithm/entities/date.js` or `time.js` | tests in `tests/entities.test.js` |
| Add a new kind of question JAL answers | see §4 "Add a new intent" | |
| Change the chat page look or layout | `src/pages/ChatPage.jsx` | |
| Change the landing page | `src/pages/LandingPage.jsx` (photos are in code, text is from the owner) | |
| Change the navbar | `src/components/Navbar.jsx` | |
| Change the owner's dashboard tabs | `src/pages/OwnerDashboard.jsx` (`TABS` list at the top) | |
| Change the Business Info form | `src/pages/owner/BusinessInfoTab.jsx` | |
| Change how bookings are checked (hours, 3-day rule, overlaps) | SQL: `supabase/migrations/20261112_jalgorithm.sql` (`jal_slot_problem`, `jal_book`, …) | **not** in JS; run a migration |
| Change what the owner is allowed to edit | SQL: policies in `supabase/migrations/20261113_owner_panel.sql` | |
| Add an owner account | Supabase Auth user, then `insert into app_owners …` (README step 4) | |
| Add a new database table or column | new file in `supabase/migrations/` (never edit an old one) | |

---

## 3. Map of the folders

### Website and pages (`src/`)

| File | What it does |
|---|---|
| `main.jsx` | App entry point; mounts `App` |
| `App.jsx` | **All routes.** Add a new page here |
| `pages/LandingPage.jsx` | `/` public landing page |
| `pages/ChatPage.jsx` | `/chat`: the chat UI. Builds the bot, sends messages, logs turns, saves the conversation in `sessionStorage` |
| `pages/OwnerLogin.jsx` | `/owner/login` |
| `pages/OwnerDashboard.jsx` | `/owner`: sidebar tabs (Appointments, Chat Logs, Reminders, Business Info) |
| `pages/owner/BusinessInfoTab.jsx` | The Business Info forms (salon details, services, hours) |
| `components/Navbar.jsx`, `Footer.jsx` | Shared layout |
| `components/ProtectedRoute.jsx` | Blocks non-owners from `/owner` |
| `lib/supabase.js` | Creates the one Supabase client (reads `.env.local`) |
| `lib/useBusinessInfo.js` | React hook: loads the business catalog once per page |
| `index.css` | Global styles and animation classes |

### Services (`src/services/`): the only code that talks to Supabase for business logic

| File | What it does |
|---|---|
| `appointments.js` | Booking actions: available slots, book, find, reschedule, cancel. Maps results to `{ ok, reason, data }` |
| `businessInfo.js` | Loads the owner's business catalog (with cache and offline fallback); owner save functions |

### The chatbot engine (`src/jalgorithm/`)

| Folder / file | Look here when… |
|---|---|
| `index.js` | You need the public API: `createJAlgorithm`, `processMessage`, `initialState` |
| `analyzer.js` | You want to see the full analysis of a message (intent, entities, corrections, scores) |
| `dialogue/manager.js` | The bot asks the wrong question, forgets a detail, or the booking flow misbehaves. **Most conversation bugs are here.** |
| `dialogue/state.js` | The shape of the saved conversation state |
| `responder.js` | Fills `{placeholders}` in replies; builds the service list text |
| `config/shortcuts.js` | Shorthand words and context rules (`d`, `b`, `hm`, `san`…); Filipino prefixes |
| `config/lexicon.js` | Synonym groups (concepts), known words, yes/no words, reset phrases, off-topic words |
| `config/intents.js` | Intent weights, required slots, classifier thresholds, confusable pairs |
| `config/responses.js` | Every reply text, in English (`en`) and Taglish (`fil`) |
| `config/business.js` | Built-in defaults for the salon info (used only if Supabase is unreachable and nothing is cached) |
| `data/training.js` | Example sentences the ML part learns from |
| `pipeline/preprocess.js` | Cleans text (case, emoji, repeated letters) |
| `pipeline/tokenizer.js` | Splits text into words, times, phone numbers, ref codes |
| `pipeline/normalizer.js` | Applies shortcuts, Filipino prefixes, typo correction |
| `pipeline/fuzzy.js` | Typo distance maths (no need to edit) |
| `pipeline/features.js` | Turns words into concept tags such as `#MOVE` or `#NEG_ATTEND` |
| `pipeline/language.js` | Detects English / Filipino / Taglish to pick the reply language |
| `entities/date.js`, `time.js` | Date and time extraction (incl. "bukas", "alas tres", "next friday") |
| `entities/calendar.js` | Date arithmetic in Manila time; date/time formatting |
| `entities/index.js` | Services, phone numbers, ref codes, names, venues |
| `classifier/ensemble.js` | Combines the three classifiers; decides UNKNOWN / ambiguous |
| `classifier/rules.js` | Scores intents from concept tags |
| `classifier/naiveBayes.js`, `tfidf.js`, `features.js` | The statistical classifiers (no need to edit) |

### Database (`supabase/`)

| File | Contents |
|---|---|
| `schema.sql` | Base tables: `appointments`, `chat_logs`. Run first on a fresh project |
| `migrations/20261112_jalgorithm.sql` | `services`, `booking_settings`, reference codes, the `jal_*` booking functions |
| `migrations/20261113_owner_panel.sql` | `business_profile`, service keywords, `app_owners`, `is_owner()`, owner-only policies |

**Migrations are append-only.** To change the database, add a new file with a later date. Don't edit one that's already been run.

### Tests, evaluation and docs

| Path | Purpose |
|---|---|
| `tests/*.test.js` | Automated tests (`npm test`). `dialogue.test.js` has the full conversation examples |
| `tests/data/intent_test_set.json` | **Held-out test set.** Don't tune the bot on it |
| `tests/data/intent_validation_set.json` | Set for tuning |
| `tests/data/normalization_cases.json` | Shorthand/typo cases |
| `scripts/evaluate.js` | Accuracy report → `reports/evaluation.md` (`npm run evaluate`) |
| `scripts/baseline.js` | Simple keyword classifier, used for comparison in the evaluation |
| `reports/` | Generated evaluation output (don't edit by hand) |
| `docs/JALGORITHM.md` | Engine design, methods, results, limitations |
| `docs/NAVIGATION.md` | This guide |
| `UPDATES.md` | Dated change log. Add an entry for each change |

---

## 4. Recipes

### Add a new shorthand
1. Open `src/jalgorithm/config/shortcuts.js`.
2. Add it to `SIMPLE_SHORTCUTS`: `txt: 'text'`. Only whole words are replaced.
3. If it's risky (short letters like `d`, `b`), use `CONTEXT_SHORTCUTS` with a `when(ctx)` guard instead.
4. Add a case to `tests/data/normalization_cases.json` and run `npm test`.

### Add a new synonym for an existing concept
1. Open `src/jalgorithm/config/lexicon.js` and find the concept (e.g. `MOVE`, `CANCEL`, `PRICE`).
2. Add the word, or an array for a phrase: `['ibang', 'oras']`.
3. Run `npm run evaluate` and check the numbers did not drop.

### Add a new example sentence (for the ML part)
1. Open `src/jalgorithm/data/training.js` and add a line under the right intent.
2. Don't copy sentences from `tests/data/` into it. The hygiene test will fail.

### Add a new intent (e.g. "ASK_DIRECTIONS")
1. `config/intents.js`: add the intent with `rules` (and `flow` if it needs multi-turn slots).
2. `data/training.js`: add 15+ example sentences under it.
3. `config/responses.js`: add reply keys in **both** `en` and `fil`. The test `every English template has a Filipino counterpart` checks this.
4. `dialogue/manager.js`: in `answerInfo()` add a `case`, or in `startIntent()` route it to a flow.
5. Add tests in `tests/dialogue.test.js`, then `npm test` and `npm run evaluate`.

### Change a reply
1. `config/responses.js`. Change the text in **both** languages.
2. Placeholders like `{date}` must stay the same name; see `responder.js` for what's available.

### Debug "the bot misunderstood me"
1. Open the browser console on `/chat`. Turns are logged there when something fails.
2. In Supabase → Table Editor → `chat_logs`, the `entities` column stores the raw intent, candidates, corrections and action result for each turn.
3. To reproduce locally, add the message to a test in `tests/dialogue.test.js` or call:
   ```js
   import { createJAlgorithm } from './src/jalgorithm/index.js'
   const bot = createJAlgorithm()
   console.log(bot.analyze('your message'))  // shows normalized text, changes, tags, intent, scores
   ```
4. `analyze()` output tells you which step failed: `normalized` (typo/shorthand), `tags` (synonyms), `intent` + `ranked` (classifier), `entities` (date/time).

### Debug "booking said something wrong"
1. Booking errors come from Supabase, so check the reason code: `too_soon`, `slot_taken`, `outside_hours`, `not_found`, `too_late`, `unreachable`, `error`.
2. Reason → reply text is in `config/responses.js` (`reason_*` keys).
3. The rule itself is SQL: `jal_slot_problem` in `supabase/migrations/20261112_jalgorithm.sql`.
4. `unreachable` usually means the migration hasn't been run, or the browser is offline.

### Debug "the prices / hours are wrong on the website or chat"
1. Check the owner's value in `/owner` → Business Info.
2. Chat loads the catalog when the page opens. Reload `/chat`.
3. If still wrong, check the browser's localStorage key `jal_catalog_v1`. It's the cached copy. Deleting it forces a fresh load.

### Add a new page
1. Create the file in `src/pages/`.
2. Add a `<Route>` in `src/App.jsx`. Wrap it in `<ProtectedRoute>` if it's owner-only.
3. Add a link in `Navbar.jsx` if it's public.

### Add a new owner-editable field
1. Database: a new migration adds the column (e.g. `alter table business_profile add column …`).
2. `services/businessInfo.js`: map it in `toCatalog()` and in the save functions.
3. `pages/owner/BusinessInfoTab.jsx`: add the input to the right section.
4. If the chatbot should use it: add a template in `config/responses.js` and a `case` in `dialogue/manager.js`.

### Add a new database table
1. New file `supabase/migrations/YYYYMMDD_name.sql` (use today's date).
2. Enable RLS on the table and write policies. Owner-only data uses `is_owner()`.
3. Call it from `services/` (never directly from a page or the chatbot).

### Add the admin (debug) panel (not built yet)
Planned: `/admin` for developers, using a separate `app_admins` table. Put it in `src/pages/AdminDashboard.jsx` and register it in `App.jsx`. Read `chat_logs` to show per-message analysis.

---

## 5. Where things are stored

| Data | Stored in | Who can read | Who can change |
|---|---|---|---|
| Appointments | Supabase `appointments` | Owners | Chatbot (via `jal_*` functions); owners |
| Chat turns (for research) | Supabase `chat_logs` | Owners | Anyone can insert (the chat page) |
| Salon info, services, hours | Supabase `business_profile`, `services`, `booking_settings` | Everyone (public read) | Owners |
| Owner list | Supabase `app_owners` | Nobody directly (via `is_owner()`) | Developer, in SQL |
| Last loaded salon info | Browser `localStorage` (`jal_catalog_v1`) | This browser | Automatic |
| Current chat conversation | Browser `sessionStorage` (`jal_conversation`) | This tab | Automatic |
| Secrets | `app/.env.local` (never committed) | — | Developer |

---

## 6. Commands

| Command | When |
|---|---|
| `npm run dev` | Develop locally on `http://localhost:5173` |
| `npm test` | After any change in `src/jalgorithm/` or `services/` |
| `npm run evaluate` | After changing the lexicon, shortcuts, training data or weights |
| `node scripts/evaluate.js --set validation` | When tuning (the test set is held out) |
| `npm run build` | Before pushing; the build must pass |

---

## 7. Rules of thumb

- **Don't hardcode salon facts in code.** If it's a price, hour, name or rule, it belongs in the owner's data.
- **Both languages.** Every reply key must exist in `en` and `fil`.
- **The bot never claims success on its own.** Success text is only shown when the booking call returns `ok: true`.
- **Never tune on the test set.** Use the validation set.
- **Migrations only move forward.** Add a new file rather than editing an old one.
- **Log every change** in `UPDATES.md`.
