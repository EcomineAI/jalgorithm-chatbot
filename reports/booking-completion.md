# Booking completion (objective 3.2)

Generated 2026-11-15 from the live `chat_logs` table using `supabase/reports/booking_completion.sql`.

> **Read this first.** These conversations were run while the system was being developed and tested. They are not
> consented real-client sessions, so the numbers show that the measurement works, not how real clients behave.
> Re-run the query after the field test and report those numbers in the thesis.

## Definitions

| Term | Meaning |
|---|---|
| Started booking | A chat session with a turn classified `BOOK_APPOINTMENT`, or a turn logged while a booking flow was active |
| Completed | The session has a successful `bookAppointment` action. Logs from before action logging lack that field, so for those, a booking reply that contains a `JAL-XXXXX` reference code counts |
| Completion rate | Completed ÷ started |

## Data validity check (re-run 2026-11-15)

Of the 48 booking sessions, **38 are dated before the JAlgorithm engine existed** (27 before the project started on
Nov 4, and 11 during the LLM phase, which never saved bookings or issued `JAL-` codes). The 48 appointments were also
created at only 4 distinct moments. These 38 sessions are therefore seeded or backfilled sample data with backdated
timestamps, not real runs of the chatbot. **Only the 10 sessions from Nov 12 onward can count as system evidence, and
all 10 completed (10/10).**

Cross-check that does hold: every one of the 48 codes in the bot replies matches exactly one real appointment, and
every chatbot appointment matches a session (no missing or extra bookings).

## Results (all 48 logged sessions, including the sample data above)

| Measure | Value |
|---|---|
| Sessions that started a booking | 48 |
| Sessions that completed a booking | 48 |
| **Completion rate** | **100.0%** |
| Completed, confirmed by action log | 3 |
| Completed, confirmed by reference-code rule (older logs) | 45 |
| Started but not completed | 0 |
| Failed booking attempts (slot taken, outside hours, etc.) | 0 |
| Median messages per completed booking | 9 |
| Median time to complete a booking | 1.4 minutes |

## Booking funnel

The funnel (how many sessions reached service → date → time → name → contact → location → confirm → booked)
needs the step logging added on 2026-11-16 (`entities.flow_step`). No logs have it yet, so section 2 of the query
returns nothing until new conversations come in.

## Limitations

- **Test data.** A 100% rate from developer testing is expected, since the tester always finishes. Real clients will
  abandon some bookings, and that drop-off is what the funnel is for.
- **Only owner-relevant turns are logged.** `chat_logs` skips spam and off-topic chatter, so a session that never
  reached a booking intent is not counted as "started".
- **Mixed evidence.** 45 of 48 completions are inferred from the reference code in the bot's reply, because they
  predate action logging. New sessions use the action log directly.
