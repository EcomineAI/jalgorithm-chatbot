# JAlgorithm evaluation (validation set)

Generated 2026-11-12T04:26:30.091Z with a fixed clock (2026-11-12T02:00:00.000Z) on Node v22.16.0.

> The evaluation messages were written by the developers to imitate real client chat. They were not collected from real clients. Treat these numbers as a development benchmark. Thesis results should come from a test set of real, consented client messages.

Training examples: 291. Evaluated messages: 72 (72 excluding the brief's example messages that were seen during development).

Overlap with training data (exact/near-duplicate): none

## Intent recognition

| Metric | JAlgorithm | Keyword baseline |
|---|---|---|
| Accuracy (strict) | 95.8% | 50.0% |
| Macro F1 | 96.1% | 57.2% |
| Accuracy excl. seen-in-development | 95.8% | |
| Macro F1 excl. seen-in-development | 96.1% | |
| Lenient accuracy (accepts listed alternatives / clarification) | 97.2% | |
| Out-of-domain messages rejected as UNKNOWN | 71.4% | |
| In-domain messages wrongly rejected as UNKNOWN | 0.0% | |

### Per intent

| Intent | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| ASK_BOOKING_POLICY | 100.0% | 100.0% | 100.0% | 3 |
| ASK_LOCATION | 75.0% | 100.0% | 85.7% | 3 |
| ASK_OPERATING_HOURS | 100.0% | 100.0% | 100.0% | 3 |
| ASK_PRICE | 100.0% | 100.0% | 100.0% | 5 |
| ASK_SERVICES | 75.0% | 100.0% | 85.7% | 3 |
| BOOK_APPOINTMENT | 100.0% | 100.0% | 100.0% | 10 |
| CANCEL_APPOINTMENT | 100.0% | 100.0% | 100.0% | 5 |
| CANNOT_ATTEND | 100.0% | 100.0% | 100.0% | 3 |
| CHECK_AVAILABILITY | 90.0% | 100.0% | 94.7% | 9 |
| GENERAL_INQUIRY | 100.0% | 100.0% | 100.0% | 4 |
| GREETING | 100.0% | 100.0% | 100.0% | 3 |
| RESCHEDULE_APPOINTMENT | 100.0% | 85.7% | 92.3% | 7 |
| THANKS | 100.0% | 100.0% | 100.0% | 3 |
| UNKNOWN_INTENT | 100.0% | 71.4% | 83.3% | 7 |
| VIEW_APPOINTMENT | 100.0% | 100.0% | 100.0% | 4 |

### Per language

| Language | N | JAlgorithm | Keyword baseline |
|---|---|---|---|
| en | 30 | 100.0% | 63.3% |
| taglish | 17 | 94.1% | 52.9% |
| fil | 25 | 92.0% | 32.0% |

### Per category

| Category | N | Accuracy |
|---|---|---|
| english | 17 | 100.0% |
| paraphrase | 2 | 100.0% |
| taglish | 11 | 90.9% |
| tagalog | 15 | 100.0% |
| shortcuts | 12 | 100.0% |
| misspellings | 5 | 100.0% |
| incomplete | 3 | 100.0% |
| unrelated | 6 | 66.7% |
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
| RESCHEDULE_APPT | · | · | · | · | · | · | · | · | 1 | · | · | 6 | · | · | · |
| THANKS | · | · | · | · | · | · | · | · | · | · | · | · | 3 | · | · |
| UNKNOWN | · | 1 | · | · | 1 | · | · | · | · | · | · | · | · | 5 | · |
| VIEW_APPT | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 4 |

## Performance

- Engine start-up (normalize training data + train Naive Bayes and TF-IDF): 59.7 ms
- Per-message analysis latency: mean 0.67 ms, p50 0.55 ms, p95 1.88 ms, max 2.68 ms
- Heap increase from creating the engine: 1.26 MB (approximate; run with node --expose-gc for a cleaner measurement); total heap in use after the run: 7.4 MB
- Latency excludes Supabase calls, which depend on the network.

## Normalization

- Cases: 50; exact match of the normalized form: 100.0%
- Inputs changed by the normalizer: 28; of those, correctly normalized: 100.0%
- False corrections in 19 protected-word cases: 0

## Misclassified messages

| Message | Gold | Predicted | Confidence | Acceptable alternative? |
|---|---|---|---|---|
| pwede ba gawing sunday imbes na saturday | RESCHEDULE_APPOINTMENT | CHECK_AVAILABILITY | 0.53 | no |
| san ba masarap kumain dito | UNKNOWN_INTENT | ASK_LOCATION | 0.437 | no |
| ano ginagawa mo | UNKNOWN_INTENT | ASK_SERVICES | 0.807 | yes |
