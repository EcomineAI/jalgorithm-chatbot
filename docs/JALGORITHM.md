# JAlgorithm: design, methodology and results

JAlgorithm is the chatbot engine behind JAL, the appointment assistant of Vicky's Parlor. It replaced a temporary proof of concept that sent every message to a local LLM (LM Studio) through a Cloudflare tunnel. JAlgorithm works differently:

- It is **deterministic**: the same message in the same state always produces the same reply.
- It is **non-generative**: every reply is a predefined template.
- It runs **entirely in the browser**: no model file, no GPU, no external AI service.

---

## 1. Architecture

```
 ChatPage.jsx (React UI)
   │  processMessage(text, state)                         ┌──────────────────────────────┐
   ▼                                                      │ src/services/appointments.js │
 src/jalgorithm/index.js ── createJAlgorithm({actions}) ──►  getAvailableSlots, book,     │
   │                                                      │  find, reschedule, cancel    │
   ├─ analyzer.js        NLU pipeline (pure, synchronous) └──────────────┬───────────────┘
   │    pipeline/  preprocess → tokenizer → normalizer → features → language   │ supabase.rpc()
   │    entities/  date, time, service, contact, reference, name, location     ▼
   │    classifier/ rules + Naive Bayes + TF-IDF → ensemble     Supabase (PostgreSQL)
   ├─ dialogue/manager.js  state machine (slot filling, confirmation, …)   jal_* SECURITY DEFINER
   ├─ responder.js         template selection + value insertion            functions enforce all
   └─ config/ + data/      all language data, rules, replies, training     business rules
```

Separation of concerns:

- **JAlgorithm decides what the user wants.** It handles intent, entities and conversation state. It does no I/O.
- **The application decides what is possible.** `services/appointments.js` calls the Supabase functions in `supabase/migrations/20261112_jalgorithm.sql`. Those functions enforce:
  - working hours (8 AM–7 PM; the service must finish by closing)
  - the 3-day advance rule
  - no overlapping bookings (with a transaction lock against double booking)
  - the 24-hour cancel/reschedule cutoff
  - ownership (reference code **and** mobile number must match)

  They answer with reason codes (`too_soon`, `slot_taken`, `not_found`, `too_late`, …), and the dialogue manager turns each code into a template reply. No business rule is duplicated in the engine.
- **Replies claim success only after the operation succeeds.** "Booked", "cancelled" and "rescheduled" are said only when the corresponding call returned `ok: true`.
- **Salon facts come from the owner.** The owner edits name, location, contact, services, prices, service keywords, hours and booking rules in the Owner's panel (`/owner` → Business Info). These are stored in Supabase (`business_profile`, `services`, `booking_settings`). `src/services/businessInfo.js` loads them into a **catalog** that is passed to `createJAlgorithm({ catalog })`, and the navbar and landing page use the same catalog. If Supabase can't be reached, the last cached copy is used, then the built-in defaults in `config/business.js`. Service keywords the owner adds become part of entity extraction and the normalizer's vocabulary.

## 2. Processing pipeline

| # | Stage | File | What it does |
|---|---|---|---|
| 1 | Input processing | `pipeline/preprocess.js` | Keeps the original text. Unicode NFKC, lowercase, strips emoji, `&`/`+` → "and", `p.m.` → `pm`, collapses elongations (`pleaseee` → `please`) except inside booking references, caps length at 500. |
| 2 | Tokenization | `pipeline/tokenizer.js` | Typed tokens: `ref` (JAL-7K3QX), `phone` (09…/+639…), `time` (3pm, 3:30 pm), `clock` (15:00), `date` (12/25), `num`, `word`, `?`. Structured values are never split or "corrected". |
| 3 | Normalization | `pipeline/normalizer.js` + `config/shortcuts.js` | Four ordered, token-level passes (see §3). Every change is logged. |
| 4 | Entity extraction | `entities/` | Date, time, service, contact, reference; name and venue only when the bot asked for them. |
| 5 | Phrase / synonym recognition | `pipeline/features.js` + `config/lexicon.js` | Maps tokens and multi-word phrases to concept tags (`#BOOK`, `#MOVE`, `#PRICE`, …). Also adds derived features: `#NEG_ATTEND` ("hindi … makapunta"), `#VIEW_Q`, `#FLEX`, `#DATE/#TIME/#SERVICE`. |
| 6 | Language identification | `pipeline/language.js` | Ratio of English vs Filipino marker words → `en` / `fil` / `taglish`. Picks the reply language. |
| 7 | Intent classification | `classifier/` | Rules + Naive Bayes + TF-IDF cosine, fused, then thresholds, ambiguity and out-of-domain checks (see §4). |
| 8 | Dialogue management | `dialogue/manager.js` | Slot filling, follow-ups, corrections, confirmation, reset, interruptions, clarification (see §5). |
| 9 | Action execution | `services/appointments.js` | Supabase RPC; every outcome is normalized to `{ ok, reason, data }`. |
| 10 | Response selection | `responder.js` + `config/responses.js` | Template + validated values. Variation is chosen by turn number, so output is reproducible. |

## 3. Multilingual, shortcut and misspelling handling

Normalization never uses global string replacement. It works on whole tokens in four ordered passes:

1. **Hyphen split.** `pa-schedule` → `pa schedule`; `alas-3` → `alas 3`.
2. **Shortcuts.** Two dictionaries.
   - *Plain shortcuts* map one token to another: `pno → paano`, `aq → ako`, `kau → kayo`, `anu → ano`, `pwde → pwede`, `mgpapa → magpapa`, `sched → schedule`, `appoinemt → appointment`, `pbook → pa book`.
   - *Context shortcuts* only fire when a guard on the neighbouring tokens passes:

   | Token | Becomes | Only when |
   |---|---|---|
   | `d` | `hindi` | followed by a word, and not after "plan/option/letter…" |
   | `b`, `n`, `p` | `ba`, `na`, `pa` | not the first token |
   | `hm` | `magkano` | something other than a filler follows (`hm po cons` yes; `hmm ok sige` no) |
   | `san` | `saan` | not followed by a place name (`san antonio` stays) |
   | `k`, `g` | `okay`, `game` | message is at most 2 tokens |
   | `avail` | `available` | not after `mag/magpa` (`mag avail ng bridal` = book) |

3. **Filipino morphology.** Verbal prefixes are separated from known domain roots: `magpabook → magpa book`, `nakabook → naka book`, `ipacancel → ipa cancel`. Reduplication is also handled: `magbobook → mag book`, `mag-aadjust → mag adjust`, `icacancel → i cancel`. A word is only split when the remainder is a known root, so `paano` and `pasko` are untouched.
4. **Guarded fuzzy correction.** Optimal-string-alignment (Damerau-Levenshtein) distance is used, under four guards:
   - it only applies to out-of-vocabulary tokens
   - it only targets a short list of domain words (`appointment`, `available`, `biyernes`, …)
   - the token must be ≥5 letters (≤1 edit, or ≤2 edits for ≥8 letters), and the first letter must match
   - ties are rejected

   The training data's vocabulary is also protected.

Known ambiguity, documented rather than hidden: `q` is always read as `ko`. That is correct after a verb ("sched q") but loses the `ako` reading. Both map to the same concepts, so classification is unaffected.

Code-switching needs no special mode. The concept lexicon groups English and Filipino synonyms under one tag (`#MOVE` = reschedule, move, ilipat, palitan, iusog, imbes…), and the classifiers are trained on mixed data.

## 4. Intent classification

**Intents:**

- `BOOK_APPOINTMENT`, `CHECK_AVAILABILITY`, `RESCHEDULE_APPOINTMENT`, `CANCEL_APPOINTMENT`, `VIEW_APPOINTMENT`
- `CANNOT_ATTEND` (asks whether to reschedule or cancel)
- `ASK_PRICE` (includes consultation-fee questions), `ASK_SERVICES`, `ASK_LOCATION`, `ASK_OPERATING_HOURS`, `ASK_BOOKING_POLICY`
- `GREETING`, `THANKS`, `GENERAL_INQUIRY`
- `UNKNOWN_INTENT`

**Hybrid model (late fusion).** The final score for each intent is:

```
score(intent) = 0.45 · rules(intent) + 0.35 · NaiveBayes(intent) + 0.20 · TFIDF(intent)
```

Each component is first scaled to a distribution over intents:

| Component | Type | How it works |
|---|---|---|
| Rule scorer (`classifier/rules.js`) | Conventional, hand-written | Weighted sum of concept tags, with penalties (e.g. `#CANCEL` lowers `BOOK_APPOINTMENT`). Weights are in `config/intents.js`. |
| Multinomial Naive Bayes (`classifier/naiveBayes.js`) | **Machine learning** | Class priors and per-class likelihoods of unigrams, bigrams and concept tags are *learned* from labeled examples (`data/training.js`, 453 examples), with Laplace smoothing α = 0.5. Trained when the engine starts (~55 ms) and fully deterministic. |
| TF-IDF + cosine (`classifier/tfidf.js`) | Conventional vector-space model | Similarity to each intent's centroid. The nearest training example's similarity is also used as a relevance signal. This measures **lexical overlap only**; it is not semantic understanding. |

**Decision layer (`classifier/ensemble.js`):**

- **Out-of-domain guard.** If the message has no domain concept tag, no entity, and TF-IDF similarity below 0.18, the result is `UNKNOWN_INTENT`. The same happens if the top class is the training-only `OUT_OF_SCOPE` class, which is also supported by an off-topic lexicon.
- **Confidence threshold.** If the fused confidence is below 0.30, the result is `UNKNOWN_INTENT` (`low_confidence`).
- **Ambiguity.** If the top two scores are within 0.10, the runner-up is ≥ 0.22, and the pair is a known confusable pair (reschedule/cancel, book/availability, …), the bot asks "Reply 1 or 2" instead of guessing.

Messages are never forced into a known intent: unrelated text gets a polite scope message.

## 5. Conversation state management

The state is a plain JSON object (`dialogue/state.js`), persisted across browser sessions in `localStorage` (`jal_sessions_v1` via `src/lib/chatSessions.js`, migrating legacy `sessionStorage`):

```js
{ lang, turn, lastIntent,
  recentContext: { service, date, time, updatedTurn },
  flow: { intent, slots: {service, date, time, name, contact, location, reference},
          awaiting, confirming, appointment, checked, misses, ... } | null,
  pausedFlow: { ... } | null,
  pending: { type: 'clarify' | 'offer_book' | 'cancel_or_abort', ... } | null }
```

| Behaviour | How |
|---|---|
| Missing information | Each flow lists required slots (`config/intents.js`); the manager asks only for the first missing one. |
| Follow-ups | Entity extraction is told which slot is `awaiting`. So "3pm sana", a lone "3", or "25" fill the pending time or date, even though such fragments carry no intent. |
| No repeated questions | Anything given up front is kept ("pa book ng hair and makeup sa nov 20 ng 10am" goes straight to asking the name). |
| Corrections | A new value in any later message replaces the old one ("ay 4pm pala"). Answering "no" at the summary asks what to change. |
| Confirmation | Every write (book / reschedule / cancel) needs a yes/no (oo, opo, sige, yes, g / hindi, no, wag). |
| Reset | "reset", "wag na", "nevermind", "start over", or the reset button in the chat header. |
| Interruptions | An informational question mid-flow is answered, then the bot says "Balik tayo sa booking mo:" and re-asks the pending slot. |
| Switching task | A confident different request starts that flow. "cancel" during a booking asks whether to stop the booking or cancel an existing appointment. |
| Failures | `slot_taken` returns to time selection with fresh slots. `too_soon` returns to date. `unreachable` keeps the details so "yes" can retry. |

## 6. Entity extraction

All dates are computed in Asia/Manila time, independent of the visitor's computer.

| Entity | Recognized forms | Validation |
|---|---|---|
| Date | ngayon/today, bukas/tomorrow, makalawa, weekday names in English and Filipino, "next friday", month + day (Dec 20, 20 disyembre), 12/25, ika-20, a lone day number when a date was asked | Impossible dates are flagged; past dates are rejected; month-day without a year rolls to next year. "bukas ba kayo" is read as *open*; "next linggo" as *a week*; Filipino "may" is only the month after sa/on/… |
| Time | 3pm, 3:30 pm, 15:00, alas tres / alas-3 (y medya), "3 ng hapon", tanghali, bare hours after a cue ("ng 3", "mga 4"), "kahit anong oras", umaga/hapon/gabi | Bare hours are read within business hours (1–7 → PM) and flagged `assumed`. "3 days" and "2 tao" are not times. 13pm is rejected. |
| Service | Aliases in `config/business.js` (bridal, debut, hmu, entourage, buhok…); "hair … makeup" anywhere → package | "makeup" alone is left open, and the bot asks. |
| Contact | PH mobile numbers (09…, +639…, with spaces or dashes) | Normalized to 09XXXXXXXXX; the server re-validates. |
| Reference | JAL-XXXXX, or the bare 5-character code when asked | The server checks it together with the contact number. |
| Name / venue | Free text, only while the bot waits for it, and only if the message isn't itself a question or request | Length and character checks. |

Extracted values are never assumed to be bookable: availability always comes from the server.

## 7. Removed LLM components

| Removed | Was used for |
|---|---|
| `src/lib/lmstudio.js` | LLM chat completions, LLM intent classifier, system prompt, tunnel status, markdown stripping |
| `tunnel_bridge.py`, `start_tunnel.bat`, `requirements.txt` | Cloudflare tunnel exposing LM Studio, Python dependencies |
| Tunnel/Python section of `start.bat` | Launching the tunnel |
| `tunnel_config` table + realtime publication (dropped by the migration) | Publishing the tunnel URL to the browser |
| `SUPABASE_SERVICE_KEY` in `.env.example` | Only used by the tunnel script |
| `public/knowledgebase.md` | Prompt context; its facts moved to `src/jalgorithm/config/business.js` |
| LM Studio / ngrok / `VITE_LM_STUDIO_URL` in the README | Setup instructions |
| Tunnel online/offline UI and "Make sure LM Studio is running" error in `ChatPage.jsx` | |

No npm dependency had to be removed: the LLM integration used plain `fetch`.

## 8. Key Files & Modules

- `src/jalgorithm/` (engine): `index.js`, `analyzer.js`, `responder.js`, `config/{business,shortcuts,lexicon,intents,responses}.js`, `data/training.js`, `pipeline/{preprocess,tokenizer,normalizer,fuzzy,features,language}.js`, `entities/{index,date,time,calendar}.js`, `classifier/{features,naiveBayes,tfidf,rules,ensemble}.js`, `dialogue/{state,manager}.js`
- `src/services/`: `appointments.js`, `businessInfo.js`, `devLogs.js`
- `src/lib/`: `useBusinessInfo.js`, `chatSessions.js`, `ownerInsights.js`, `calendarLinks.js`, `mediaUpload.js`, `nluDebug.js`, `devTools.js`
- `src/components/`: `Navbar.jsx`, `Footer.jsx`, `ProtectedRoute.jsx`, `ChatWidgets.jsx`, `StudioMark.jsx`, `owner/{OwnerPrimitives,DashboardHomeTab,ManualBookingModal}.jsx`
- `src/pages/`: `LandingPage.jsx`, `ChatPage.jsx`, `OwnerLogin.jsx`, `OwnerDashboard.jsx`, `owner/{BusinessInfoTab,ChatLogsTab,OwnerChatSandbox}.jsx`, `DevDebugPage.jsx`, `dev/{DevCleanupTab,DevBatchTesterTab,DevSystemMapTab,DevPaperIpoDiagram,DevNluAnimationTab}.jsx`
- `supabase/`: `schema.sql`, `setup_all.sql`, and append-only migrations (`20261112_jalgorithm.sql` through `20261116_dev_cleanup_and_retention.sql`)
- `vercel.json`: catch-all SPA rewrite so `/chat`, `/owner`, `/owner/login`, and `/dev` resolve directly
- `tests/`: 12 Vitest test files (`appointments`, `businessInfo`, `calendarLinks`, `chatSessions`, `classifier`, `datasets`, `devTools`, `dialogue`, `entities`, `mediaUpload`, `normalizer`, `ownerInsights`) plus `tests/data/{intent_test_set,intent_validation_set,normalization_cases}.json`
- `scripts/{evaluate,baseline}.js`, `reports/evaluation*.{md,json}`, `docs/{JALGORITHM,NAVIGATION,HISTORY}.md`

## 9. Setup

See the README. In short:

1. `npm install`
2. Fill in `.env.local` (Supabase URL and anon key only).
3. Run `supabase/schema.sql`, then both migrations in date order, in the Supabase SQL editor.
4. Add the owner's account to `app_owners` (see README step 4).
5. `npm run dev`, then fill in Business Info at `/owner`.

If you still have `SUPABASE_SERVICE_KEY` in your own `.env.local`, delete it; nothing uses it any more.

## 10. Automated tests

`npm test` runs **267 Vitest tests across 12 test files** in ~4–6 seconds:

| File | Covers |
|---|---|
| `normalizer.test.js` | Preprocessing, tokenization, all 50 normalization cases, Conyo/Jeje normalization, false-correction guards, edit distance |
| `entities.test.js` | Dates/times with a fixed clock (including multi-date `extractDates()`), services, contacts, references, `extractHeadCount()`, attendee names |
| `classifier.test.js` | Naive Bayes and TF-IDF units, rule scorer, the brief's example messages, out-of-domain rejection, language detection |
| `dialogue.test.js` | Multi-turn conversations with mocked actions, cross-turn memory, group head calculation, secondary multi-question answers, draft pausing/resumption, beneficiary interview & Conyo/Jeje scenarios |
| `appointments.test.js` | RPC parameter mapping, reason codes, network failure / missing migration -> `unreachable`, DB error -> `error` |
| `businessInfo.test.js` | Mapping database rows to catalog, pricing modes (`fixed`, `starting`, `range`, `varies`), cache & fallback, `checkOwnerAccess()`, beneficiary preset |
| `datasets.test.js` | Zero overlap between training (`453`), validation (`100`), and test (`222`) sets; valid labels; EN/FIL placeholder parity |
| `chatSessions.test.js` | Multi-session `localStorage` persistence, naming, paused draft detection, saved recent references |
| `ownerInsights.test.js` | Profile completion %, appointment date/status filtering, pagination, calendar grouping, session-grouped chat logs, trash log filtering |
| `calendarLinks.test.js` | Manila date math, Google Calendar & Google Maps URL builders, owner 1-day prep & reminder templates |
| `mediaUpload.test.js` | Image URL sanitization, compression fallback, Storage upload path safety |
| `devTools.test.js` | Localhost host guard, raw log trash grouping, auto-prune helpers, batch NLU suite execution |

**Not covered by unit tests:** SQL RPC functions (`jal_*`) run in Supabase PostgreSQL and require manual end-to-end verification after applying `supabase/setup_all.sql` (or all append-only migrations).

## 11. Evaluation results

Run with `npm run evaluate` (or `node scripts/evaluate.js --set validation` when tuning); full outputs live in `reports/evaluation.md` and `reports/evaluation-validation.md`.

- **Three disjoint sets.** Training (`453` examples used to fit Naive Bayes and TF-IDF), validation (`100` examples used for tuning; **100.0%** strict accuracy, **100.0%** macro-F1, **100.0%** OOD rejection), and held-out test (`222` messages, `0` training overlap).

| Metric (test set, 222 messages) | JAlgorithm | Keyword baseline |
|---|---|---|
| Strict accuracy | **94.6%** | 50.0% |
| Macro F1 | **94.9%** | 52.9% |
| Accuracy excluding seen-in-development (`209`) | 94.3% | |
| Lenient accuracy (clarification / acceptable alternative accepted) | 96.4% | |
| English / Filipino / Taglish accuracy | 89.2% / 98.4% / 97.4% | 55.4% / 38.7% / 53.2% |
| Out-of-domain messages rejected as UNKNOWN | **85.7%** | |
| In-domain messages wrongly rejected | 1.5% | |

**Performance (Node 22):**
- Engine start-up (training normalization + NB + TF-IDF): `57.6 ms` (`55.1 ms` in validation run)
- Per-message analysis latency: `p50 = 0.35 ms`, `p95 = 1.62 ms` (`mean = 0.56 ms`)
- Heap increase from creating the engine: ~`3.71 MB`
- Supabase RPC network time is extra and depends on network latency.

**Normalization:** 50 cases, `100.0%` exact match, `0` false corrections across 19 protected-word cases.

**How to read these numbers.** All evaluation messages were written by the developers to imitate client chat; none were collected from real clients. The results show the method works and beats a keyword baseline. They are **not** the thesis's live-deployment intent accuracy, which should be measured on consented real client messages.

## 12. Known limitations and next steps

1. **English paraphrases with unseen phrasing (`75.0%`)** and **unsupported capability requests (`66.7%`)**: purely lexical matching still relies on adding real-world client phrasing observed in `chat_logs` / `dev_chat_logs` to `training.js` or `lexicon.js`.
2. **Primary single-intent resolution with secondary FAQ answering**: messages asking an operational flow question plus a secondary pricing/hours/location question answer the FAQ inline (`answerSecondaryInfo`), while two competing transactional actions trigger clarification.
3. **Database migrations**: run `supabase/setup_all.sql` (or migrations in date order) on any fresh Supabase project and verify booking RPCs + `salon-media` uploads end to end.
4. **Continuous improvement path**: actionable leads store metadata in `chat_logs` (capped at `1,000` rows), raw diagnostics store turns in `dev_chat_logs` (auto-pruned after `dev_auto_prune_days`), and `/dev` provides batch NLU testing and cleanup controls.

## Which techniques are machine learning?

| Technique | ML? |
|---|---|
| Multinomial Naive Bayes intent model (parameters estimated from labeled data) | **Yes**, supervised machine learning (classical, not deep learning, non-generative) |
| TF-IDF weighting and cosine similarity (IDF estimated from the training corpus) | No: a conventional information-retrieval statistic, not a trained predictive model |
| Rule scorer, concept lexicon, shortcut dictionaries, morphology rules | No: hand-written rules |
| Damerau-Levenshtein fuzzy matching | No: string algorithm |
| Regex/grammar-based date, time and entity extraction | No |
| Dialogue state machine, template responses | No |

No component generates text, and no LLM, neural network or external AI service is used.
