# JAlgorithm evaluation (validation set)

Generated 2026-11-15T06:39:33.991Z with a fixed clock (2026-11-12T02:00:00.000Z) on Node v22.16.0.

> The evaluation messages were written by the developers to imitate real client chat. They were not collected from real clients. Treat these numbers as a development benchmark. Thesis results should come from a test set of real, consented client messages.

Training examples: 453. Evaluated messages: 100 (100 excluding the brief's example messages that were seen during development).

Overlap with training data (exact/near-duplicate): none

## Intent recognition

| Metric | JAlgorithm | Keyword baseline |
|---|---|---|
| Accuracy (strict) | 100.0% | 48.0% |
| Macro F1 | 100.0% | 53.7% |
| Accuracy excl. seen-in-development | 100.0% | |
| Macro F1 excl. seen-in-development | 100.0% | |
| Lenient accuracy (accepts listed alternatives / clarification) | 100.0% | |
| Out-of-domain messages rejected as UNKNOWN | 100.0% | |
| In-domain messages wrongly rejected as UNKNOWN | 0.0% | |

### Per intent

| Intent | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| ASK_BOOKING_POLICY | 100.0% | 100.0% | 100.0% | 4 |
| ASK_LOCATION | 100.0% | 100.0% | 100.0% | 4 |
| ASK_OPERATING_HOURS | 100.0% | 100.0% | 100.0% | 4 |
| ASK_PRICE | 100.0% | 100.0% | 100.0% | 7 |
| ASK_SERVICES | 100.0% | 100.0% | 100.0% | 4 |
| BOOK_APPOINTMENT | 100.0% | 100.0% | 100.0% | 14 |
| CANCEL_APPOINTMENT | 100.0% | 100.0% | 100.0% | 7 |
| CANNOT_ATTEND | 100.0% | 100.0% | 100.0% | 4 |
| CHECK_AVAILABILITY | 100.0% | 100.0% | 100.0% | 13 |
| GENERAL_INQUIRY | 100.0% | 100.0% | 100.0% | 5 |
| GREETING | 100.0% | 100.0% | 100.0% | 3 |
| RESCHEDULE_APPOINTMENT | 100.0% | 100.0% | 100.0% | 10 |
| THANKS | 100.0% | 100.0% | 100.0% | 4 |
| UNKNOWN_INTENT | 100.0% | 100.0% | 100.0% | 11 |
| VIEW_APPOINTMENT | 100.0% | 100.0% | 100.0% | 6 |

### Per language

| Language | N | JAlgorithm | Keyword baseline |
|---|---|---|---|
| en | 34 | 100.0% | 58.8% |
| taglish | 23 | 100.0% | 47.8% |
| fil | 43 | 100.0% | 39.5% |

### Per category

| Category | N | Accuracy |
|---|---|---|
| english | 17 | 100.0% |
| paraphrase | 2 | 100.0% |
| taglish | 11 | 100.0% |
| tagalog | 15 | 100.0% |
| shortcuts | 12 | 100.0% |
| misspellings | 5 | 100.0% |
| incomplete | 3 | 100.0% |
| unrelated | 8 | 100.0% |
| unsupported | 3 | 100.0% |
| conyo | 8 | 100.0% |
| jeje | 8 | 100.0% |
| indirect | 8 | 100.0% |

### Confusion matrix (rows = gold, columns = predicted)

| gold \ pred | BOOKING_POLICY | LOCATION | HOURS | PRICE | SERVICES | BOOK_APPT | CANCEL_APPT | CANNOT_ATTEND | CHECK_AVAILABILITY | GENERAL_INQUIRY | GREETING | RESCHEDULE_APPT | THANKS | UNKNOWN | VIEW_APPT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BOOKING_POLICY | 4 | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| LOCATION | · | 4 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| HOURS | · | · | 4 | · | · | · | · | · | · | · | · | · | · | · | · |
| PRICE | · | · | · | 7 | · | · | · | · | · | · | · | · | · | · | · |
| SERVICES | · | · | · | · | 4 | · | · | · | · | · | · | · | · | · | · |
| BOOK_APPT | · | · | · | · | · | 14 | · | · | · | · | · | · | · | · | · |
| CANCEL_APPT | · | · | · | · | · | · | 7 | · | · | · | · | · | · | · | · |
| CANNOT_ATTEND | · | · | · | · | · | · | · | 4 | · | · | · | · | · | · | · |
| CHECK_AVAILABILITY | · | · | · | · | · | · | · | · | 13 | · | · | · | · | · | · |
| GENERAL_INQUIRY | · | · | · | · | · | · | · | · | · | 5 | · | · | · | · | · |
| GREETING | · | · | · | · | · | · | · | · | · | · | 3 | · | · | · | · |
| RESCHEDULE_APPT | · | · | · | · | · | · | · | · | · | · | · | 10 | · | · | · |
| THANKS | · | · | · | · | · | · | · | · | · | · | · | · | 4 | · | · |
| UNKNOWN | · | · | · | · | · | · | · | · | · | · | · | · | · | 11 | · |
| VIEW_APPT | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 6 |

## Performance

- Engine start-up (normalize training data + train Naive Bayes and TF-IDF): 55.1 ms
- Per-message analysis latency: mean 0.30 ms, p50 0.26 ms, p95 0.75 ms, max 1.20 ms
- Heap increase from creating the engine: 3.29 MB (approximate; run with node --expose-gc for a cleaner measurement); total heap in use after the run: 9.6 MB
- Latency excludes Supabase calls, which depend on the network.

## Normalization

- Cases: 50; exact match of the normalized form: 100.0%
- Inputs changed by the normalizer: 28; of those, correctly normalized: 100.0%
- False corrections in 19 protected-word cases: 0

## Misclassified messages

| Message | Gold | Predicted | Confidence | Acceptable alternative? |
|---|---|---|---|---|
