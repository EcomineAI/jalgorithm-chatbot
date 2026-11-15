# JAlgorithm evaluation (validation set)

Generated 2026-11-14T15:01:51.737Z with a fixed clock (2026-11-12T02:00:00.000Z) on Node v22.16.0.

> The evaluation messages were written by the developers to imitate real client chat. They were not collected from real clients. Treat these numbers as a development benchmark. Thesis results should come from a test set of real, consented client messages.

Training examples: 291. Evaluated messages: 72 (72 excluding the brief's example messages that were seen during development).

Overlap with training data (exact/near-duplicate): none

## Intent recognition

| Metric | JAlgorithm | Keyword baseline |
|---|---|---|
| Accuracy (strict) | 98.6% | 50.0% |
| Macro F1 | 98.5% | 57.2% |
| Accuracy excl. seen-in-development | 98.6% | |
| Macro F1 excl. seen-in-development | 98.5% | |
| Lenient accuracy (accepts listed alternatives / clarification) | 100.0% | |
| Out-of-domain messages rejected as UNKNOWN | 85.7% | |
| In-domain messages wrongly rejected as UNKNOWN | 0.0% | |

### Per intent

| Intent | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| ASK_BOOKING_POLICY | 100.0% | 100.0% | 100.0% | 3 |
| ASK_LOCATION | 100.0% | 100.0% | 100.0% | 3 |
| ASK_OPERATING_HOURS | 100.0% | 100.0% | 100.0% | 3 |
| ASK_PRICE | 100.0% | 100.0% | 100.0% | 5 |
| ASK_SERVICES | 75.0% | 100.0% | 85.7% | 3 |
| BOOK_APPOINTMENT | 100.0% | 100.0% | 100.0% | 10 |
| CANCEL_APPOINTMENT | 100.0% | 100.0% | 100.0% | 5 |
| CANNOT_ATTEND | 100.0% | 100.0% | 100.0% | 3 |
| CHECK_AVAILABILITY | 100.0% | 100.0% | 100.0% | 9 |
| GENERAL_INQUIRY | 100.0% | 100.0% | 100.0% | 4 |
| GREETING | 100.0% | 100.0% | 100.0% | 3 |
| RESCHEDULE_APPOINTMENT | 100.0% | 100.0% | 100.0% | 7 |
| THANKS | 100.0% | 100.0% | 100.0% | 3 |
| UNKNOWN_INTENT | 100.0% | 85.7% | 92.3% | 7 |
| VIEW_APPOINTMENT | 100.0% | 100.0% | 100.0% | 4 |

### Per language

| Language | N | JAlgorithm | Keyword baseline |
|---|---|---|---|
| en | 30 | 100.0% | 63.3% |
| taglish | 17 | 100.0% | 52.9% |
| fil | 25 | 96.0% | 32.0% |

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
| unrelated | 6 | 83.3% |
| unsupported | 1 | 100.0% |

### Confusion matrix (rows = gold, columns = predicted)

| gold \ pred | BOOKING_POLICY | LOCATION | HOURS | PRICE | SERVICES | BOOK_APPT | CANCEL_APPT | CANNOT_ATTEND | CHECK_AVAILABILITY | GENERAL_INQUIRY | GREETING | RESCHEDULE_APPT | THANKS | UNKNOWN | VIEW_APPT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BOOKING_POLICY | 3 | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| LOCATION | · | 3 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| HOURS | · | · | 3 | · | · | · | · | · | · | · | · | · | · | · | · |
| PRICE | · | · | · | 5 | · | · | · | · | · | · | · | · | · | · | · |
| SERVICES | · | · | · | · | 3 | · | · | · | · | · | · | · | · | · | · |
| BOOK_APPT | · | · | · | · | · | 10 | · | · | · | · | · | · | · | · | · |
| CANCEL_APPT | · | · | · | · | · | · | 5 | · | · | · | · | · | · | · | · |
| CANNOT_ATTEND | · | · | · | · | · | · | · | 3 | · | · | · | · | · | · | · |
| CHECK_AVAILABILITY | · | · | · | · | · | · | · | · | 9 | · | · | · | · | · | · |
| GENERAL_INQUIRY | · | · | · | · | · | · | · | · | · | 4 | · | · | · | · | · |
| GREETING | · | · | · | · | · | · | · | · | · | · | 3 | · | · | · | · |
| RESCHEDULE_APPT | · | · | · | · | · | · | · | · | · | · | · | 7 | · | · | · |
| THANKS | · | · | · | · | · | · | · | · | · | · | · | · | 3 | · | · |
| UNKNOWN | · | · | · | · | 1 | · | · | · | · | · | · | · | · | 6 | · |
| VIEW_APPT | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 4 |

## Performance

- Engine start-up (normalize training data + train Naive Bayes and TF-IDF): 201.2 ms
- Per-message analysis latency: mean 2.89 ms, p50 2.43 ms, p95 7.16 ms, max 12.89 ms
- Heap increase from creating the engine: 2.05 MB (approximate; run with node --expose-gc for a cleaner measurement); total heap in use after the run: 9.1 MB
- Latency excludes Supabase calls, which depend on the network.

## Normalization

- Cases: 50; exact match of the normalized form: 100.0%
- Inputs changed by the normalizer: 28; of those, correctly normalized: 100.0%
- False corrections in 19 protected-word cases: 0

## Misclassified messages

| Message | Gold | Predicted | Confidence | Acceptable alternative? |
|---|---|---|---|---|
| ano ginagawa mo | UNKNOWN_INTENT | ASK_SERVICES | 0.807 | yes |
