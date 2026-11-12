# JAlgorithm evaluation (test set)

Generated 2026-11-12T04:26:30.677Z with a fixed clock (2026-11-12T02:00:00.000Z) on Node v22.16.0.

> The evaluation messages were written by the developers to imitate real client chat. They were not collected from real clients. Treat these numbers as a development benchmark. Thesis results should come from a test set of real, consented client messages.

Training examples: 291. Evaluated messages: 222 (209 excluding the brief's example messages that were seen during development).

Overlap with training data (exact/near-duplicate): none

## Intent recognition

| Metric | JAlgorithm | Keyword baseline |
|---|---|---|
| Accuracy (strict) | 88.3% | 50.0% |
| Macro F1 | 88.7% | 52.9% |
| Accuracy excl. seen-in-development | 87.6% | |
| Macro F1 excl. seen-in-development | 88.5% | |
| Lenient accuracy (accepts listed alternatives / clarification) | 91.0% | |
| Out-of-domain messages rejected as UNKNOWN | 57.1% | |
| In-domain messages wrongly rejected as UNKNOWN | 3.0% | |

### Per intent

| Intent | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| ASK_BOOKING_POLICY | 100.0% | 62.5% | 76.9% | 8 |
| ASK_LOCATION | 100.0% | 72.7% | 84.2% | 11 |
| ASK_OPERATING_HOURS | 100.0% | 77.8% | 87.5% | 9 |
| ASK_PRICE | 90.0% | 94.7% | 92.3% | 19 |
| ASK_SERVICES | 88.9% | 88.9% | 88.9% | 9 |
| BOOK_APPOINTMENT | 88.6% | 96.9% | 92.5% | 32 |
| CANCEL_APPOINTMENT | 94.1% | 100.0% | 97.0% | 16 |
| CANNOT_ATTEND | 100.0% | 100.0% | 100.0% | 8 |
| CHECK_AVAILABILITY | 82.4% | 93.3% | 87.5% | 30 |
| GENERAL_INQUIRY | 64.3% | 75.0% | 69.2% | 12 |
| GREETING | 100.0% | 100.0% | 100.0% | 7 |
| RESCHEDULE_APPOINTMENT | 95.7% | 100.0% | 97.8% | 22 |
| THANKS | 100.0% | 100.0% | 100.0% | 6 |
| UNKNOWN_INTENT | 66.7% | 57.1% | 61.5% | 21 |
| VIEW_APPOINTMENT | 100.0% | 91.7% | 95.7% | 12 |

### Per language

| Language | N | JAlgorithm | Keyword baseline |
|---|---|---|---|
| en | 83 | 88.0% | 55.4% |
| fil | 62 | 82.3% | 38.7% |
| taglish | 77 | 93.5% | 53.2% |

### Per category

| Category | N | Accuracy |
|---|---|---|
| english | 27 | 96.3% |
| paraphrase | 28 | 75.0% |
| tagalog | 34 | 91.2% |
| shortcuts | 33 | 90.9% |
| misspellings | 16 | 93.8% |
| taglish | 39 | 97.4% |
| incomplete | 16 | 100.0% |
| unrelated | 15 | 60.0% |
| unsupported | 6 | 50.0% |
| ambiguous | 8 | 87.5% |

### Confusion matrix (rows = gold, columns = predicted)

| gold \ pred | BOOKING_POLICY | LOCATION | HOURS | PRICE | SERVICES | BOOK_APPT | CANCEL_APPT | CANNOT_ATTEND | CHECK_AVAILABILITY | GENERAL_INQUIRY | GREETING | RESCHEDULE_APPT | THANKS | UNKNOWN | VIEW_APPT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BOOKING_POLICY | 5 | · | · | · | · | 1 | · | · | · | 1 | · | · | · | 1 | · |
| LOCATION | · | 8 | · | · | · | · | · | · | · | 1 | · | · | · | 2 | · |
| HOURS | · | · | 7 | · | · | · | · | · | 2 | · | · | · | · | · | · |
| PRICE | · | · | · | 18 | 1 | · | · | · | · | · | · | · | · | · | · |
| SERVICES | · | · | · | · | 8 | 1 | · | · | · | · | · | · | · | · | · |
| BOOK_APPT | · | · | · | 1 | · | 31 | · | · | · | · | · | · | · | · | · |
| CANCEL_APPT | · | · | · | · | · | · | 16 | · | · | · | · | · | · | · | · |
| CANNOT_ATTEND | · | · | · | · | · | · | · | 8 | · | · | · | · | · | · | · |
| CHECK_AVAILABILITY | · | · | · | · | · | · | 1 | · | 28 | · | · | 1 | · | · | · |
| GENERAL_INQUIRY | · | · | · | · | · | · | · | · | · | 9 | · | · | · | 3 | · |
| GREETING | · | · | · | · | · | · | · | · | · | · | 7 | · | · | · | · |
| RESCHEDULE_APPT | · | · | · | · | · | · | · | · | · | · | · | 22 | · | · | · |
| THANKS | · | · | · | · | · | · | · | · | · | · | · | · | 6 | · | · |
| UNKNOWN | · | · | · | 1 | · | 1 | · | · | 4 | 3 | · | · | · | 12 | · |
| VIEW_APPT | · | · | · | · | · | 1 | · | · | · | · | · | · | · | · | 11 |

## Performance

- Engine start-up (normalize training data + train Naive Bayes and TF-IDF): 48.0 ms
- Per-message analysis latency: mean 0.34 ms, p50 0.27 ms, p95 0.80 ms, max 4.99 ms
- Heap increase from creating the engine: 0.97 MB; total heap in use after the run: 8.7 MB
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
| What date did I book? | VIEW_APPOINTMENT | BOOK_APPOINTMENT | 0.749 | no |
| how mutch is the package | ASK_PRICE | ASK_SERVICES | 0.414 | yes |
| What can I book with you? | ASK_SERVICES | BOOK_APPOINTMENT | 0.801 | yes |
| How do I get to your place? | ASK_LOCATION | GENERAL_INQUIRY | 0.486 | no |
| anong city kayo | ASK_LOCATION | UNKNOWN_INTENT | 0.253 | no |
| sakop nyo ba ang subic | ASK_LOCATION | UNKNOWN_INTENT | 0.238 | no |
| anong oras po kayo nagsasara | ASK_OPERATING_HOURS | CHECK_AVAILABILITY | 0.37 | no |
| bukas po ba kayo tuwing linggo | ASK_OPERATING_HOURS | CHECK_AVAILABILITY | 0.489 | no |
| Do I need to pay a deposit to secure the date? | ASK_BOOKING_POLICY | GENERAL_INQUIRY | 0.314 | no |
| How far ahead do I have to book? | ASK_BOOKING_POLICY | BOOK_APPOINTMENT | 0.804 | no |
| may dp po ba | ASK_BOOKING_POLICY | UNKNOWN_INTENT | 0.286 | no |
| Will you remind me before my appointment? | GENERAL_INQUIRY | UNKNOWN_INTENT | 0.237 | no |
| pno mgbayad | GENERAL_INQUIRY | UNKNOWN_INTENT | 0.269 | no |
| may fb page po kayo | GENERAL_INQUIRY | UNKNOWN_INTENT | 0.284 | no |
| I'm so tired today | UNKNOWN_INTENT | CHECK_AVAILABILITY | 0.394 | no |
| anong oras na ngayon | UNKNOWN_INTENT | CHECK_AVAILABILITY | 0.453 | no |
| may pasok ba bukas | UNKNOWN_INTENT | CHECK_AVAILABILITY | 0.575 | no |
| uulan ba mamaya | UNKNOWN_INTENT | CHECK_AVAILABILITY | 0.528 | no |
| magkano ang bigas ngayon | UNKNOWN_INTENT | ASK_PRICE | 0.807 | yes |
| who is the president of the philippines | UNKNOWN_INTENT | GENERAL_INQUIRY | 0.57 | yes |
| hiring po ba kayo ng assistant | UNKNOWN_INTENT | GENERAL_INQUIRY | 0.359 | no |
| pwede po ba magpagupit ng buhok ng lalaki | UNKNOWN_INTENT | BOOK_APPOINTMENT | 0.45 | yes |
| nagrerent din po ba kayo ng gown | UNKNOWN_INTENT | GENERAL_INQUIRY | 0.354 | no |
| pwede ba sa sabado or i-cancel ko na lang | CHECK_AVAILABILITY | CANCEL_APPOINTMENT | 0.708 | yes |
