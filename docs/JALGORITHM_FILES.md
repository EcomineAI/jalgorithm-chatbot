# JAlgorithm Engine: File Checklist

Each file in `app/src/jalgorithm/` with what it does. The descriptions come from each file's header comment. Tick the box after you have checked the file.

Message flow: **pipeline → entities → classifier → dialogue → responder**, with `index.js` tying them together.

---

## Top level

| Check | File | What it does |
|---|---|---|
| ☐ | `index.js` | Public entry point. `createJAlgorithm({ actions })` builds the bot the chat page uses. |
| ☐ | `analyzer.js` | Runs the whole NLU pipeline on one message: preprocess → tokenize → normalize → entities → concept features → language → intent classification. |
| ☐ | `responder.js` | Picks a reply template and fills in its placeholders with validated values. No free text is generated. |

---

## `pipeline/` (text processing, in order)

| Check | File | What it does |
|---|---|---|
| ☐ | `preprocess.js` | Stage 1. Cleans the input and keeps the original message for logs and debugging. |
| ☐ | `tokenizer.js` | Stage 2. Splits text into typed tokens. Times, dates, phone numbers and booking references are recognised here so later stages don't split or change them. |
| ☐ | `normalizer.js` | Stage 3. Fixes shortcuts, spelling and Filipino/Taglish word forms, one whole token at a time. |
| ☐ | `features.js` | Stage 4. Maps tokens to concept tags (from `config/lexicon.js`) and adds derived features for the rules classifier. |
| ☐ | `fuzzy.js` | Edit-distance helper for spelling correction (counts insertions, deletions, substitutions and swapped letters). |
| ☐ | `language.js` | Detects English, Filipino or Taglish from marker words. Used to choose the reply language. |

---

## `entities/` (values pulled from the message)

| Check | File | What it does |
|---|---|---|
| ☐ | `index.js` | Entry point for entity extraction: dates, times, services, phone numbers, booking references, and names or venues when the bot has asked for them. |
| ☐ | `date.js` | Pulls a calendar date from English or Filipino text. Whether the date can be booked is decided later by the booking service. |
| ☐ | `time.js` | Pulls a time such as "3pm", "15:00" or "tanghali". Bare hours are read within business hours and flagged as assumed. |
| ☐ | `calendar.js` | Date helpers fixed to Asia/Manila (UTC+8). Dates are `YYYY-MM-DD` and times are `HH:MM`. |

---

## `classifier/` (intent scoring)

The final intent comes from late fusion of three scores, weighted `0.45 × rules + 0.35 × Naive Bayes + 0.20 × TF-IDF` (set in `config/intents.js`).

| Check | File | What it does |
|---|---|---|
| ☐ | `ensemble.js` | Combines the three scores into one ranking. Flags close results as ambiguous and falls back to `UNKNOWN_INTENT` below the minimum confidence. |
| ☐ | `rules.js` | Hand-written rule scores from weighted concept tags. Works for phrasings missing from the training data. |
| ☐ | `naiveBayes.js` | Multinomial Naive Bayes with Laplace smoothing. The machine-learning part, trained on `data/training.js`. |
| ☐ | `tfidf.js` | TF-IDF with cosine similarity to each intent's centroid. Also checks that the message is about the salon at all. |
| ☐ | `features.js` | Turns an analysed message into unigrams, bigrams and concept tags for the statistical classifiers. Values like "3pm" and "4pm" become the same placeholder. |

---

## `config/` (rules and data the engine reads)

| Check | File | What it does |
|---|---|---|
| ☐ | `intents.js` | Intent definitions: rule weights, the slots each booking flow needs, and the classifier weights and thresholds. |
| ☐ | `lexicon.js` | Groups English, Filipino and Taglish synonyms under one concept tag. |
| ☐ | `shortcuts.js` | Whole-word dictionaries for shortcuts and spelling fixes used in normalisation. |
| ☐ | `responses.js` | All reply templates in English (`en`) and Taglish (`fil`). Every key must exist in both. |
| ☐ | `business.js` | Built-in default salon facts (name, services, prices, hours). Used only when Supabase can't be reached. The live values come from the owner's panel. |

---

## `data/`

| Check | File | What it does |
|---|---|---|
| ☐ | `training.js` | Labelled training examples for Naive Bayes and TF-IDF. Must not copy any validation or test messages. |

---

## `dialogue/` (conversation control)

| Check | File | What it does |
|---|---|---|
| ☐ | `manager.js` | State machine on top of the NLU result. Collects missing slots, handles corrections, confirmations, pausing and resuming, and resets. Reports success only when the booking call returns `ok: true`. |
| ☐ | `state.js` | Conversation state that can be saved as JSON in `sessionStorage`. |

---

## Notes for checking

- The three classifier weights must add up to 1.
- Every reply key in `responses.js` must exist in both `en` and `fil`, with matching placeholders.
- The engine has no LLM and no external AI service. Everything runs in the browser.
