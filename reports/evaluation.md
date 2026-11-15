# JAlgorithm evaluation (test set)

Generated 2026-11-15T06:21:16.087Z with a fixed clock (2026-11-12T02:00:00.000Z) on Node v22.16.0.

> The evaluation messages were written by the developers to imitate real client chat. They were not collected from real clients. Treat these numbers as a development benchmark. Thesis results should come from a test set of real, consented client messages.

Training examples: 453. Evaluated messages: 222 (209 excluding the brief's example messages that were seen during development).

Overlap with training data (exact/near-duplicate): none

## Intent recognition

| Metric | JAlgorithm | Keyword baseline |
|---|---|---|
| Accuracy (strict) | 94.6% | 50.0% |
| Macro F1 | 94.9% | 52.9% |
| Accuracy excl. seen-in-development | 94.3% | |
| Macro F1 excl. seen-in-development | 94.7% | |
| Lenient accuracy (accepts listed alternatives / clarification) | 96.4% | |
| Out-of-domain messages rejected as UNKNOWN | 85.7% | |
| In-domain messages wrongly rejected as UNKNOWN | 1.5% | |

### Per intent

| Intent | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| ASK_BOOKING_POLICY | 100.0% | 75.0% | 85.7% | 8 |
| ASK_LOCATION | 100.0% | 100.0% | 100.0% | 11 |
| ASK_OPERATING_HOURS | 90.0% | 100.0% | 94.7% | 9 |
| ASK_PRICE | 100.0% | 100.0% | 100.0% | 19 |
| ASK_SERVICES | 88.9% | 88.9% | 88.9% | 9 |
| BOOK_APPOINTMENT | 93.8% | 93.8% | 93.8% | 32 |
| CANCEL_APPOINTMENT | 88.9% | 100.0% | 94.1% | 16 |
| CANNOT_ATTEND | 100.0% | 100.0% | 100.0% | 8 |
| CHECK_AVAILABILITY | 100.0% | 90.0% | 94.7% | 30 |
| GENERAL_INQUIRY | 84.6% | 91.7% | 88.0% | 12 |
| GREETING | 100.0% | 100.0% | 100.0% | 7 |
| RESCHEDULE_APPOINTMENT | 95.7% | 100.0% | 97.8% | 22 |
| THANKS | 100.0% | 100.0% | 100.0% | 6 |
| UNKNOWN_INTENT | 85.7% | 85.7% | 85.7% | 21 |
| VIEW_APPOINTMENT | 100.0% | 100.0% | 100.0% | 12 |

### Per language

| Language | N | JAlgorithm | Keyword baseline |
|---|---|---|---|
| en | 83 | 89.2% | 55.4% |
| fil | 62 | 98.4% | 38.7% |
| taglish | 77 | 97.4% | 53.2% |

### Per category

| Category | N | Accuracy |
|---|---|---|
| english | 27 | 100.0% |
| paraphrase | 28 | 75.0% |
| tagalog | 34 | 100.0% |
| shortcuts | 33 | 100.0% |
| misspellings | 16 | 100.0% |
| taglish | 39 | 100.0% |
| incomplete | 16 | 100.0% |
| unrelated | 15 | 93.3% |
| unsupported | 6 | 66.7% |
| ambiguous | 8 | 75.0% |

### Confusion matrix (rows = gold, columns = predicted)

| gold \ pred | BOOKING_POLICY | LOCATION | HOURS | PRICE | SERVICES | BOOK_APPT | CANCEL_APPT | CANNOT_ATTEND | CHECK_AVAILABILITY | GENERAL_INQUIRY | GREETING | RESCHEDULE_APPT | THANKS | UNKNOWN | VIEW_APPT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BOOKING_POLICY | 6 | · | · | · | · | 1 | 1 | · | · | · | · | · | · | · | · |
| LOCATION | · | 11 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| HOURS | · | · | 9 | · | · | · | · | · | · | · | · | · | · | · | · |
| PRICE | · | · | · | 19 | · | · | · | · | · | · | · | · | · | · | · |
| SERVICES | · | · | · | · | 8 | 1 | · | · | · | · | · | · | · | · | · |
| BOOK_APPT | · | · | · | · | 1 | 30 | · | · | · | · | · | · | · | 1 | · |
| CANCEL_APPT | · | · | · | · | · | · | 16 | · | · | · | · | · | · | · | · |
| CANNOT_ATTEND | · | · | · | · | · | · | · | 8 | · | · | · | · | · | · | · |
| CHECK_AVAILABILITY | · | · | · | · | · | · | 1 | · | 27 | · | · | 1 | · | 1 | · |
| GENERAL_INQUIRY | · | · | · | · | · | · | · | · | · | 11 | · | · | · | 1 | · |
| GREETING | · | · | · | · | · | · | · | · | · | · | 7 | · | · | · | · |
| RESCHEDULE_APPT | · | · | · | · | · | · | · | · | · | · | · | 22 | · | · | · |
| THANKS | · | · | · | · | · | · | · | · | · | · | · | · | 6 | · | · |
| UNKNOWN | · | · | 1 | · | · | · | · | · | · | 2 | · | · | · | 18 | · |
| VIEW_APPT | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 12 |

## Performance

- Engine start-up (normalize training data + train Naive Bayes and TF-IDF): 57.6 ms
- Per-message analysis latency: mean 0.56 ms, p50 0.35 ms, p95 1.62 ms, max 3.91 ms
- Heap increase from creating the engine: 3.71 MB (approximate; run with node --expose-gc for a cleaner measurement); total heap in use after the run: 8.3 MB
- Latency excludes Supabase calls, which depend on the network.

## Normalization

- Cases: 50; exact match of the normalized form: 100.0%
- Inputs changed by the normalizer: 28; of those, correctly normalized: 100.0%
- False corrections in 19 protected-word cases: 0

## Misclassified messages

| Message | Gold | Predicted | Confidence | Acceptable alternative? |
|---|---|---|---|---|
| Could you put me down for the hair and makeup package? | BOOK_APPOINTMENT | ASK_SERVICES | 0.337 | no |
| Can you still fit me in next week? | CHECK_AVAILABILITY | UNKNOWN_INTENT | 0.209 | no |
| ok lang ba 6pm or adjust nalang ako | CHECK_AVAILABILITY | RESCHEDULE_APPOINTMENT | 0.42 | no |
| What can I book with you? | ASK_SERVICES | BOOK_APPOINTMENT | 0.806 | yes |
| How far ahead do I have to book? | ASK_BOOKING_POLICY | BOOK_APPOINTMENT | 0.535 | no |
| Can I get my reservation fee back if I cancel? | ASK_BOOKING_POLICY | CANCEL_APPOINTMENT | 0.45 | yes |
| Will you remind me before my appointment? | GENERAL_INQUIRY | UNKNOWN_INTENT | 0.253 | no |
| anong oras na ngayon | UNKNOWN_INTENT | ASK_OPERATING_HOURS | 0.376 | no |
| Can you do my nails too? | UNKNOWN_INTENT | GENERAL_INQUIRY | 0.35 | no |
| can you send me a tutorial on contouring | UNKNOWN_INTENT | GENERAL_INQUIRY | 0.328 | no |
| pwede ba sa sabado or i-cancel ko na lang | CHECK_AVAILABILITY | CANCEL_APPOINTMENT | 0.689 | yes |
| schedule | BOOK_APPOINTMENT | UNKNOWN_INTENT | 0.261 | yes |
