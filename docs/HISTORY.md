# Project history log

Written for an AI assistant (or a new developer) joining this project. It records what was built, in what order, why each decision was made, and what is still open. For how the code is organized today, read [NAVIGATION.md](NAVIGATION.md). For how the chatbot engine works, read [JALGORITHM.md](JALGORITHM.md).

Dates are as recorded in git. The project is a student thesis: an appointment chatbot for a freelance hair and makeup stylist in Olongapo City, Philippines. The salon is "Vicky's Parlor", and the chatbot is called **JAL**. The engine is called **JAlgorithm**.

---

## 1. Summary

1. **Nov 4–7, 2026: LLM proof of concept.** The chatbot sent every message to a local LLM (Qwen3 running in LM Studio) on the developer's PC. The PC was exposed to the internet through a Cloudflare tunnel, and the tunnel URL was published through a Supabase table. Most of the commits in this period were fixes to make the LLM behave: stop it from echoing its prompt, stop it writing markdown or `[Your name]` placeholders, and make its intent classifier work.
2. **Nov 12, 2026: JAlgorithm replaces the LLM.** The LLM, the tunnel, and the Python bridge were removed. A deterministic, in-browser NLP engine was built instead. It handles English, Filipino and Taglish, and it books appointments through Supabase database functions.
3. **Nov 12–14, 2026: Owner's panel.** Business information (name, services, prices, hours, booking rules) moved out of code and into Supabase. The owner edits it at `/owner`. The chatbot, navbar and landing page all read the same data.
4. **Nov 14, 2026: Cleanup and docs.** LLM leftovers removed, the tech stack file rewritten, and a navigation guide added.

Current state: code is complete and tested (171 automated tests pass, the build succeeds). **The database migrations have not yet been applied to the live Supabase project**, so booking and the owner panel don't work there yet. See §7.

---

## 2. Phase 1: LLM proof of concept (Nov 4–7, 2026)

**Commits:** `77f552d` (initial project) through `17c17c8` (system prompt simplified).

### What it was
- React + Vite + Tailwind frontend (`src/`), Supabase for data (`appointments`, `chat_logs`, `tunnel_config`).
- Chat page (`src/pages/ChatPage.jsx`) called `src/lib/lmstudio.js`, which:
  - classified each message as `book`, `reschedule`, `cancel`, `faq` or `other` with one LLM call;
  - answered with a second LLM call, using `public/knowledgebase.md` as the system prompt;
  - stripped markdown from the reply;
  - kept only the last 10 messages to fit an 8192-token context.
- `tunnel_bridge.py` (Python) ran `cloudflared` to expose LM Studio on port 1234, then wrote the public URL into the `tunnel_config` table. The site read that URL to know where to send chat requests. When the tunnel stopped, the site showed "Offline".
- `start.bat` and `start_tunnel.bat` started the dev server and the tunnel together.

### Problems that led to the rewrite
- The chatbot only worked while the developer's PC was on, with LM Studio running and the tunnel open.
- Replies were not reliable: the model echoed its instructions, produced markdown, and invented `[Your name]` placeholders.
- Off-topic and intent errors needed keyword fallbacks layered on top of the model.
- The chatbot never wrote appointments. The anon key couldn't insert into `appointments`, and no service path existed.
- Nothing measured how accurate the chatbot was, which the thesis requires.

---

## 3. Phase 2: JAlgorithm (Nov 12, 2026)

**Commit:** `8084f4f` (originally `457248b`, rewritten to remove a co-author line; see §6).

### Decisions made with the developer
These were asked as questions and answered before any code was written.

| Question | Decision | Why |
|---|---|---|
| Intent classifier | Hybrid: rules + Multinomial Naive Bayes (+ TF-IDF cosine) | The thesis describes it as a "rule-based and machine learning hybrid model". Naive Bayes is the only ML part, and it trains in ~40 ms with no model file. |
| How bookings are written | Supabase `SECURITY DEFINER` functions called by RPC | The anon role can't write `appointments` directly. The functions enforce all business rules on the server. |
| How a client identifies their booking | Reference code (`JAL-XXXXX`) **plus** mobile number | Stops a stranger from cancelling someone else's booking if they only know one of the two. |

### What was built
- **Engine** in `src/jalgorithm/` (framework-free JavaScript, testable in Node):
  - *Pipeline:* preprocess → tokenize → normalize (shortcuts, Filipino prefixes, guarded typo correction) → entities (date, time, service, phone, reference, name, venue) → concept tags → language detection → intent classification.
  - *Dialogue manager:* a state machine for slot filling, corrections, confirmations, reset, interruptions and clarifications. It only reports success when the booking call returns `ok: true`.
  - *Responder:* picks reply templates from `config/responses.js` in English (`en`) and Taglish (`fil`).
- **Booking functions** in `supabase/migrations/20261112_jalgorithm.sql`: `jal_available_slots`, `jal_book`, `jal_find`, `jal_reschedule`, `jal_cancel`. They enforce working hours, the 3-day advance rule, no overlaps (with an advisory lock against double booking), the 24-hour cutoff, and reference-plus-mobile ownership. Also drops the `tunnel_config` table.
- **App layer:** `src/services/appointments.js` maps each Supabase result to `{ ok, reason, data }`. Network failures become `unreachable`, so the bot can say "booking system unavailable" instead of failing silently.
- **Chat page** runs the engine in the browser, saves the conversation in `sessionStorage`, has a reset button and an offline indicator, and logs every turn to `chat_logs` with the confidence, normalized text, corrections and action result.
- **Tests:** Vitest, 162 at the time, covering normalization, entities, classifiers, multi-turn dialogues, and the service layer.
- **Evaluation** (`scripts/evaluate.js`, output in `reports/`). Three disjoint sets: training (291), validation (72, used for tuning), test (222, held out). Result on the test set: **88.3% accuracy, 88.7% macro-F1**, against 50% for a keyword baseline.

### Important honesty notes (keep these)
- **All evaluation messages were written by the developer**, not collected from real clients. The numbers are a development benchmark. Thesis accuracy must come from real, consented client messages.
- During development, some words were added that mirrored test items. They were removed before the final run, so the 88.3% is the clean figure. The validation set is the one to tune on. The test set must not be used for tuning.
- 13 test messages are the examples from the project brief and were seen during development. The report also gives results excluding them (87.6%).
- Out-of-scope rejection is the weakest area (57%).

---

## 4. Phase 3: Owner's panel and business data in Supabase (Nov 12–13, 2026)

**Commit:** same as Phase 2 (`8084f4f`).

### Why
The salon's facts were hardcoded in three places (`config/business.js`, `Navbar.jsx`, `LandingPage.jsx`), and they already disagreed: the navbar said "Event Package PHP 2,500", the bot used Event/Debut PHP 2,000. The owner had to ask a developer to change a price.

### What was built
- **Route rename:** `/admin` → `/owner`, `/admin/login` → `/owner/login`. The old URLs redirect. `/admin` is reserved for a future developer debug panel.
- **Migration `supabase/migrations/20261113_owner_panel.sql`:**
  - `business_profile` (single row: name, artist, location, contact, portfolio, payment methods, consultation fee, travel areas, reservation fee and which services need it);
  - `services` gains `aliases` (keywords clients type), `description`, `sort_order`, `show_on_landing`;
  - `booking_settings` gains validation rules;
  - `app_owners` allow-list with `is_owner()`. Only listed accounts can edit business data, or read appointments and chat logs. **Before this, any signed-in account could read appointments.**
- **Business Info tab** (`src/pages/owner/BusinessInfoTab.jsx`): three sections, salon details, services and prices, hours and rules. Each has its own save button and error messages.
- **Data flow:** `src/services/businessInfo.js` loads the data into a *catalog* object. The catalog is passed to `createJAlgorithm({ catalog })`. Navbar and landing page use the same catalog through `src/lib/useBusinessInfo.js`.
- **Offline behaviour:** the last successful load is cached in `localStorage` (`jal_catalog_v1`). If that's missing too, the built-in defaults in `config/business.js` are used.
- **Refactor:** the engine no longer imports `business.js` directly. Behaviour didn't change: the evaluation numbers and all tests are the same.

### Known limits
- Business-info changes reach the chatbot the next time someone opens `/chat`. An open chat keeps the old data.
- Landing-page photos are still in code, keyed by service key.

---

## 5. Phase 4: Cleanup and documentation (Nov 13–14, 2026)

**Commit:** same as Phase 2 for code; docs were committed with the same push.

- Removed the LLM comparison from the evaluation script and docs, since the developer asked for no LLM references at all.
- Removed Python lines from `.gitignore` and the `SUPABASE_SERVICE_KEY` line from `.env.local`. The app only needs the URL and the anon key.
- Removed the unused `tsconfig.json` and the stale `dist/` folder.
- Rewrote `tech stack.txt` (project root, not in git) to match the real stack.
- Added `docs/NAVIGATION.md`: where each part lives, an "I want to…" table, recipes, and debugging steps.
- Added this file.

---

## 6. Git history and repository rules

- **Repo:** the project's GitHub repository (`jalgorithm-chatbot`), branch `main`. Hosting is Vercel.
- **Author:** all commits use the neutral identity `jalgorithm <jalgorithm@thesis.local>`.
- **No AI attribution in commits or PRs.** The developer doesn't want Claude (or any AI) listed as a contributor. Nine old commits had a `Co-Authored-By: Claude` line, and the history was rewritten on Nov 13 to remove it. Don't add it again. Commit message bodies can describe the change, but don't add a co-author trailer.
- **No personal information in files or commits.** Don't use the developer's real name, email, or the GitHub owner's personal details in code, docs or commit messages. The thesis team names appear only in the README's title block, which is already there.
- **Secrets:** `.env.local` is gitignored and must never be committed. It holds only the Supabase URL and the anon key. A service-role key was once there and was removed; the developer was advised to roll it in the Supabase dashboard.
- **Force-push happened once** (Nov 13), to rewrite the nine commits. Old commit `457248b` and branch `feat/jalgorithm-owner-panel` were deleted. Anyone with an older clone must reset to `origin/main`.
- **`UPDATES.md` is gitignored** (local dev log, by the original project's choice). This file is meant to be committed; `UPDATES.md` is the detailed dated log and stays local.

### Full commit list (main)

| Date | Commit | Summary |
|---|---|---|
| 2026-11-04 | `77f552d` | Initial project: ML-based appointment chatbot (LLM-based) |
| 2026-11-04 | `07e696f` | knowledgebase.md injected as LLM system prompt |
| 2026-11-04 | `3e32995` | Trim history and cap tokens for 8192 context |
| 2026-11-04 | `1362aae` | Refuse off-topic messages, strict system prompt |
| 2026-11-04 | `25f76d0` | Intent classifier examples for FAQ misclassification |
| 2026-11-05 | `8ac7dd2` | Landing page redesign: dark hero, service cards, mobile nav |
| 2026-11-05 | `e1836b4` | Renamed to Vicky's Parlor; footer and knowledgebase updated |
| 2026-11-07 | `2cc5953` | Landing redesign, navbar dropdowns, global animations |
| 2026-11-07 | `b1daa2c` | Intent classifier fix for Qwen3 reasoning model |
| 2026-11-07 | `3b9ebc1` | LLM echoing system prompt (Qwen3) fix |
| 2026-11-07 | `9c93845` | LLM `[Your name]` placeholder fix |
| 2026-11-07 | `868e398` | Quick reply buttons removed; LLM markdown fix |
| 2026-11-07 | `ba3c5e2` | Quick reply buttons restored (4 common questions) |
| 2026-11-07 | `f829e3d` | Strip markdown from LLM replies |
| 2026-11-07 | `17c17c8` | System prompt simplified to behaviour-only |
| 2026-11-12 | `8084f4f` | **JAlgorithm engine, Supabase booking, Owner's panel, cleanup of LLM code** |

The commit IDs above are the ones after the Nov 13 rewrite. Commit `8084f4f` contains all of the Nov 12–14 work (the owner panel, the cleanup and the docs). The earlier IDs (`559ab1c` etc.) were the pre-rewrite versions; the code is identical.

---

## 7. Current state and open items

### Working in code (not yet verified in a browser)
- Chatbot engine, all intents listed in `config/intents.js`
- Owner's panel and Business Info tab
- Landing page and navbar reading the owner's data
- 171 tests pass; production build passes

### Not yet done
1. **Apply the migrations to the live Supabase project**, in order: `schema.sql` (if the project is fresh), `20261112_jalgorithm.sql`, `20261113_owner_panel.sql`. Until then, `services`, `business_profile` and the `jal_*` functions don't exist, and the site falls back to the built-in defaults.
2. **Create the owner account** and add it to `app_owners` (README step 4). Without this, nobody can see appointments or chat logs.
3. **Check service durations** with the stylist. They are the developer's guesses (bridal 3 h, wedding package 5 h, and so on).
4. **Push the latest cleanup and docs** (the code is committed on `main` up to `8084f4f`; the cleanup and these docs are uncommitted at the time of writing).
5. **Admin / debug panel** at `/admin`, for developers. Planned to use an `app_admins` table and show per-message analysis from `chat_logs`. Not built.
6. **Reminders** (3 days and 1 day before an appointment) are promised to clients on the landing page and in the bot's FAQ, but nothing sends them. The Reminders tab is a placeholder.
7. **Thesis:** the classifier wording in the thesis draft (`Notes for Drafting (1).md`, not in git) should say "rule-based and Naive Bayes hybrid", not "fine-tuned transformer". Real-client evaluation is still required.
8. **Known limits:** out-of-scope rejection (57%), English paraphrases with unseen words (75%), multi-request messages (only one intent is recognized).

---

## 8. Where to look for what

| Question | File |
|---|---|
| Where is X in the code? | `docs/NAVIGATION.md` |
| How does the engine decide? | `docs/JALGORITHM.md` |
| How do I set it up? | `README.md` |
| What exactly changed, dated? | `UPDATES.md` (local only, gitignored) |
| What was the old LLM setup? | `docs/JALGORITHM.md` §7 and §2 of this file |
| What does the database look like? | `supabase/schema.sql` and `supabase/migrations/` (migrations are append-only) |
| How good is the classifier? | `reports/evaluation.md` |
