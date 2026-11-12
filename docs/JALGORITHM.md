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
| Multinomial Naive Bayes (`classifier/naiveBayes.js`) | **Machine learning** | Class priors and per-class likelihoods of unigrams, bigrams and concept tags are *learned* from labeled examples (`data/training.js`, 291 examples), with Laplace smoothing α = 0.5. Trained when the engine starts (~40 ms) and fully deterministic. |
| TF-IDF + cosine (`classifier/tfidf.js`) | Conventional vector-space model | Similarity to each intent's centroid. The nearest training example's similarity is also used as a relevance signal. This measures **lexical overlap only**; it is not semantic understanding. |

**Decision layer (`classifier/ensemble.js`):**

- **Out-of-domain guard.** If the message has no domain concept tag, no entity, and TF-IDF similarity below 0.18, the result is `UNKNOWN_INTENT`. The same happens if the top class is the training-only `OUT_OF_SCOPE` class, which is also supported by an off-topic lexicon.
- **Confidence threshold.** If the fused confidence is below 0.30, the result is `UNKNOWN_INTENT` (`low_confidence`).
- **Ambiguity.** If the top two scores are within 0.10, the runner-up is ≥ 0.22, and the pair is a known confusable pair (reschedule/cancel, book/availability, …), the bot asks "Reply 1 or 2" instead of guessing.

Messages are never forced into a known intent: unrelated text gets a polite scope message.

## 5. Conversation state management

The state is a plain JSON object (`dialogue/state.js`), saved in `sessionStorage` so a page refresh keeps the conversation:

```js
{ lang, turn, lastIntent,
  flow: { intent, slots: {service, date, time, name, contact, location, reference},
          awaiting, confirming, appointment, checked, misses, … } | null,
  pending: { type: 'clarify' | 'offer_book' | 'cancel_or_abort', … } | null }
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

## 8. Files

**New**
- `src/jalgorithm/` (engine):
  - `index.js`, `analyzer.js`, `responder.js`
  - `config/{business,shortcuts,lexicon,intents,responses}.js`
  - `data/training.js`
  - `pipeline/{preprocess,tokenizer,normalizer,fuzzy,features,language}.js`
  - `entities/{index,date,time,calendar}.js`
  - `classifier/{features,naiveBayes,tfidf,rules,ensemble}.js`
  - `dialogue/{state,manager}.js`
- `src/services/appointments.js`, `src/services/businessInfo.js`, `src/lib/useBusinessInfo.js`
- `src/pages/owner/BusinessInfoTab.jsx` (Owner's panel → Business Info)
- `supabase/migrations/20261112_jalgorithm.sql`, `supabase/migrations/20261113_owner_panel.sql`
- `tests/*.test.js` (normalizer, entities, classifier, dialogue, appointments, businessInfo, datasets)
- `tests/data/{intent_test_set,intent_validation_set,normalization_cases}.json`
- `scripts/{evaluate,baseline}.js`
- `reports/evaluation*.{md,json}` (generated)
- `docs/JALGORITHM.md`

**Modified**
- `src/pages/ChatPage.jsx`: engine integration, session persistence, reset button, offline indicator, richer chat logs
- `src/pages/AdminDashboard.jsx` → renamed `OwnerDashboard.jsx` (route `/owner`): reference code column, appointment time, intent confidence, Business Info tab, tab picker on phones
- `src/pages/AdminLogin.jsx` → renamed `OwnerLogin.jsx` (route `/owner/login`)
- `src/components/ProtectedRoute.jsx`: also requires the account to be in `app_owners`
- `src/components/Navbar.jsx`, `src/pages/LandingPage.jsx`: services, prices, location and hours come from the owner's data
- `supabase/schema.sql`: tunnel table removed; intent check constraint removed
- `package.json`: vitest, `test` and `evaluate` scripts
- `start.bat`, `.env.example`, `.gitignore`, `README.md`

## 9. Setup

See the README. In short:

1. `npm install`
2. Fill in `.env.local` (Supabase URL and anon key only).
3. Run `supabase/schema.sql`, then both migrations in date order, in the Supabase SQL editor.
4. Add the owner's account to `app_owners` (see README step 4).
5. `npm run dev`, then fill in Business Info at `/owner`.

If you still have `SUPABASE_SERVICE_KEY` in your own `.env.local`, delete it; nothing uses it any more.

## 10. Automated tests

`npm test` runs 171 Vitest tests in about 3 seconds, all passing at the time of writing:

| File | Covers |
|---|---|
| `normalizer.test.js` | Preprocessing, tokenization, all 50 normalization cases, false-correction guards, edit distance |
| `entities.test.js` | Dates/times with a fixed clock (relative, weekdays, months, Filipino forms, invalid values), services, contacts, references, names |
| `classifier.test.js` | Naive Bayes and TF-IDF units, rule scorer, the brief's 10 example messages, out-of-domain rejection, language detection |
| `dialogue.test.js` | Multi-turn conversations with mocked actions: availability → "3pm sana"; book → Friday → "Kahit 2pm"; corrections; interruption + resume; reset; cancel-vs-stop clarification; reschedule; can't-attend → cancel; view; failure and offline handling |
| `appointments.test.js` | RPC parameter mapping, reason codes, network failure / missing migration → `unreachable`, DB error → `error` |
| `businessInfo.test.js` | Mapping database rows to the catalog, cache and offline fallback, blocked writes reported as `not_authorized`, error mapping; the chatbot answering with the owner's prices, keywords, hours, rules and contact details |
| `datasets.test.js` | No overlap between training, validation and test sets; valid labels; every reply exists in both languages |

**Not covered by automated tests:** the SQL functions themselves. No database was available in the development environment, so the migration has not been executed against Supabase yet. Run it, then do the manual end-to-end check in the README (book → view → reschedule → cancel).

## 11. Evaluation results

Run with `npm run evaluate`; full output is in `reports/evaluation.md`. The method:

- **Three disjoint data sets.** Training (291, used to fit Naive Bayes / TF-IDF), validation (72, used to tune lexicon/weights/thresholds) and test (222, held out). Exact or near-duplicate overlap is checked automatically.
- **Tuning used validation errors only.** During development, some off-topic words had been added that mirrored test items. They were removed before the final run, which lowered test accuracy from 90.1% to the 88.3% reported here.
- **13 test messages are the example messages from the project brief.** They were looked at during development, so results are also reported without them.

| Metric (test set, 222 messages) | JAlgorithm | Keyword baseline |
|---|---|---|
| Accuracy | **88.3%** | 50.0% |
| Macro F1 | **88.7%** | 52.9% |
| Accuracy excluding brief examples (209) | 87.6% | |
| Lenient accuracy (listed alternatives / clarification accepted) | 91.0% | |
| English / Filipino / Taglish accuracy | 88.0% / 82.3% / 93.5% | 55.4% / 38.7% / 53.2% |
| Unrelated/unsupported messages rejected as UNKNOWN | **57.1%** | |
| In-domain messages wrongly rejected | 3.0% | |

**Per category:**

| Category | Accuracy |
|---|---|
| Taglish | 97.4% |
| English | 96.3% |
| Misspellings | 93.8% |
| Tagalog | 91.2% |
| Shortcuts | 90.9% |
| Incomplete messages | 100% |
| Ambiguous | 87.5% |
| English paraphrases | 75.0% |
| Unrelated | 60.0% |
| Unsupported requests | 50.0% |

**Performance (Node 22, ordinary laptop):**
- Engine start-up: ~40 ms
- Per-message analysis: p50 ≈ 0.3 ms, p95 ≈ 1 ms
- Heap growth from creating the engine: ≈ 1 MB
- Network time for Supabase calls is extra and not measured here.

**Normalization:** 50 cases, all correctly normalized, 0 false corrections in 19 protected-word cases. These cases were written together with the normalizer, so they work as a regression suite, not as an independent accuracy estimate.

**How to read these numbers.** All evaluation messages were written by the developers to imitate client chat; none were collected from real clients. The results show the method works and beats a keyword baseline. They are **not** the thesis's intent-recognition accuracy. That should be measured on real, consented client messages that JAlgorithm has never seen, split as the methodology describes.

## 12. Limitations and future work

1. **Out-of-domain rejection is the weakest part (57%).** Unrelated questions that contain domain-like words still get pulled into an intent. Examples: "anong oras na ngayon" (oras + ngayon → availability) and "hiring po ba kayo ng assistant" (→ general inquiry). Options: more `OUT_OF_SCOPE` training data from real logs, and a stricter relevance guard.
2. **English paraphrases with unseen vocabulary (75%).** Lexical methods can't infer that "how far ahead do I have to book" asks about policy. Fix: add phrasings observed in chat logs to the lexicon and training data.
3. **Filipino informational questions** with uncommon words ("sakop", "nagsasara", "dp") are missed. Same fix.
4. **Single-intent output.** A message with two requests gets one intent (the ambiguity check may ask). Multi-intent splitting is not implemented.
5. **Date heuristics.** "Sa susunod na Biyernes" is read as next week's Friday when this week's is still ahead, which some speakers would read differently; the bot always shows the full date before confirming. A lone "q" is read as "ko".
6. **Service durations in the migration are assumptions.** Confirm them with the artist.
7. **The SQL migration still needs to be run and checked** on the real Supabase project.
8. **Reminders** (3 days / 1 day before) are described to clients but not implemented in this codebase. The dashboard's Reminders tab is still a placeholder.
9. **Business info changes reach the chatbot on the next chat load**, not instantly in an already-open chat. Landing-page photos are still chosen in code (by service key); services without a photo get a default image.
10. **Continuous improvement path.** `chat_logs` now stores the normalized text, confidence, raw intent, corrections and action outcome of every turn. Low-confidence and UNKNOWN turns can be reviewed, labeled, and added to `training.js` or the lexicon; Naive Bayes retrains automatically on the next load.

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
