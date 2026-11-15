# JAlgorithm evaluation (test set)

Generated 2026-11-14T13:48:15.426Z with a fixed clock (2026-11-12T02:00:00.000Z) on Node v22.16.0.

> The evaluation messages were written by the developers to imitate real client chat. They were not collected from real clients. Treat these numbers as a development benchmark. Thesis results should come from a test set of real, consented client messages.

Training examples: 291. Evaluated messages: 222 (209 excluding the brief's example messages that were seen during development).

Overlap with training data (exact/near-duplicate): none

## Intent recognition

| Metric | JAlgorithm | Keyword baseline |
|---|---|---|
| Accuracy (strict) | 95.9% | 50.0% |
| Macro F1 | 96.2% | 52.9% |
| Accuracy excl. seen-in-development | 95.7% | |
| Macro F1 excl. seen-in-development | 96.1% | |
| Lenient accuracy (accepts listed alternatives / clarification) | 96.8% | |
| Out-of-domain messages rejected as UNKNOWN | 95.2% | |
| In-domain messages wrongly rejected as UNKNOWN | 0.5% | |

### Per intent

| Intent | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| ASK_BOOKING_POLICY | 100.0% | 75.0% | 85.7% | 8 |
| ASK_LOCATION | 100.0% | 100.0% | 100.0% | 11 |
| ASK_OPERATING_HOURS | 100.0% | 100.0% | 100.0% | 9 |
| ASK_PRICE | 95.0% | 100.0% | 97.4% | 19 |
| ASK_SERVICES | 100.0% | 88.9% | 94.1% | 9 |
| BOOK_APPOINTMENT | 91.2% | 96.9% | 93.9% | 32 |
| CANCEL_APPOINTMENT | 94.1% | 100.0% | 97.0% | 16 |
| CANNOT_ATTEND | 100.0% | 100.0% | 100.0% | 8 |
| CHECK_AVAILABILITY | 96.6% | 93.3% | 94.9% | 30 |
| GENERAL_INQUIRY | 91.7% | 91.7% | 91.7% | 12 |
| GREETING | 100.0% | 100.0% | 100.0% | 7 |
| RESCHEDULE_APPOINTMENT | 95.7% | 100.0% | 97.8% | 22 |
| THANKS | 100.0% | 100.0% | 100.0% | 6 |
| UNKNOWN_INTENT | 95.2% | 95.2% | 95.2% | 21 |
| VIEW_APPOINTMENT | 100.0% | 91.7% | 95.7% | 12 |

### Per language

| Language | N | JAlgorithm | Keyword baseline |
|---|---|---|---|
| en | 83 | 92.8% | 55.4% |
| fil | 62 | 98.4% | 38.7% |
| taglish | 77 | 97.4% | 53.2% |

### Per category

| Category | N | Accuracy |
|---|---|---|
| english | 27 | 96.3% |
| paraphrase | 28 | 78.6% |
| tagalog | 34 | 100.0% |
| shortcuts | 33 | 100.0% |
| misspellings | 16 | 100.0% |
| taglish | 39 | 100.0% |
| incomplete | 16 | 100.0% |
| unrelated | 15 | 93.3% |
| unsupported | 6 | 100.0% |
| ambiguous | 8 | 87.5% |

### Confusion matrix (rows = gold, columns = predicted)

| gold \ pred | BOOKING_POLICY | LOCATION | HOURS | PRICE | SERVICES | BOOK_APPT | CANCEL_APPT | CANNOT_ATTEND | CHECK_AVAILABILITY | GENERAL_INQUIRY | GREETING | RESCHEDULE_APPT | THANKS | UNKNOWN | VIEW_APPT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BOOKING_POLICY | 6 | · | · | · | · | 1 | · | · | · | 1 | · | · | · | · | · |
| LOCATION | · | 11 | · | · | · | · | · | · | · | · | · | · | · | · | · |
| HOURS | · | · | 9 | · | · | · | · | · | · | · | · | · | · | · | · |
| PRICE | · | · | · | 19 | · | · | · | · | · | · | · | · | · | · | · |
| SERVICES | · | · | · | · | 8 | 1 | · | · | · | · | · | · | · | · | · |
| BOOK_APPT | · | · | · | 1 | · | 31 | · | · | · | · | · | · | · | · | · |
| CANCEL_APPT | · | · | · | · | · | · | 16 | · | · | · | · | · | · | · | · |
| CANNOT_ATTEND | · | · | · | · | · | · | · | 8 | · | · | · | · | · | · | · |
| CHECK_AVAILABILITY | · | · | · | · | · | · | 1 | · | 28 | · | · | 1 | · | · | · |
| GENERAL_INQUIRY | · | · | · | · | · | · | · | · | · | 11 | · | · | · | 1 | · |
| GREETING | · | · | · | · | · | · | · | · | · | · | 7 | · | · | · | · |
| RESCHEDULE_APPT | · | · | · | · | · | · | · | · | · | · | · | 22 | · | · | · |
| THANKS | · | · | · | · | · | · | · | · | · | · | · | · | 6 | · | · |
| UNKNOWN | · | · | · | · | · | · | · | · | 1 | · | · | · | · | 20 | · |
| VIEW_APPT | · | · | · | · | · | 1 | · | · | · | · | · | · | · | · | 11 |

## Performance

- Engine start-up (normalize training data + train Naive Bayes and TF-IDF): 83.4 ms
- Per-message analysis latency: mean 0.58 ms, p50 0.38 ms, p95 1.55 ms, max 4.40 ms
- Heap increase from creating the engine: 2.05 MB (approximate; run with node --expose-gc for a cleaner measurement); total heap in use after the run: 9.1 MB
- Latency excludes Supabase calls, which depend on the network.

## Normalization

- Cases: 50; exact match of the normalized form: 100.0%
- Inputs changed by the normalizer: 28; of those, correctly normalized: 100.0%
- False corrections in 19 protected-word cases: 0

## Misclassified messages

| Message | Gold | Predicted | Confidence | Acceptable alternative? |
|---|---|---|---|---|
| Could you put me down for the hair and makeup package? | BOOK_APPOINTMENT | ASK_PRICE | 0.442 | no |
| ok lang ba 6pm or adjust nalang ako | CHECK_AVAILABILITY | RESCHEDULE_APPOINTMENT | 0.423 | no |
| What date did I book? | VIEW_APPOINTMENT | BOOK_APPOINTMENT | 0.451 | no |
| What can I book with you? | ASK_SERVICES | BOOK_APPOINTMENT | 0.801 | yes |
| Do I need to pay a deposit to secure the date? | ASK_BOOKING_POLICY | GENERAL_INQUIRY | 0.317 | no |
| How far ahead do I have to book? | ASK_BOOKING_POLICY | BOOK_APPOINTMENT | 0.55 | no |
| Will you remind me before my appointment? | GENERAL_INQUIRY | UNKNOWN_INTENT | 0.252 | no |
| anong oras na ngayon | UNKNOWN_INTENT | CHECK_AVAILABILITY | 0.454 | no |
| pwede ba sa sabado or i-cancel ko na lang | CHECK_AVAILABILITY | CANCEL_APPOINTMENT | 0.708 | yes |
