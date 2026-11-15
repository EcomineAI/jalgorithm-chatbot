# Development Cycles: Intent Classification, Dialogue Manager, Reminders

Summary of three development cycles, based only on the code, git history, `UPDATES.md`, `docs/HISTORY.md` and the test and evaluation reports. Where a record doesn't exist, the section says so.

Test results were checked on the date of writing: `npx vitest run` gave 12 files and 267 tests, all passing. The evaluation numbers come from `reports/evaluation.md`.

---

## Cycle 1: Intent Classification

### Built

- **Phase A, first version (Nov 4–7, 2026):** an older version that was rough and slow. It sorted each message as `book`, `reschedule`, `cancel`, `faq` or `other` with one call, then wrote the reply with a second call. (Commits `77f552d` to `17c17c8`.)
- **Phase B, JAlgorithm classifier (development began Nov 5, 2026; first committed Nov 12, 2026):** a deterministic, in-browser classifier with three scorers fused as `0.45 × rules + 0.35 × Naive Bayes + 0.20 × TF-IDF`, with a fallback to `UNKNOWN_INTENT` below a minimum confidence. Files: `src/jalgorithm/classifier/` (`ensemble.js`, `rules.js`, `naiveBayes.js`, `tfidf.js`, `features.js`) and `config/intents.js`.
- **Ambiguity check:** if the top two scores are within 0.10 and form a known confusable pair (for example reschedule vs cancel), the bot asks "Reply 1 or 2" instead of guessing.

### Tested

- `tests/classifier.test.js`: 7 tests.
- `reports/evaluation.md` (222 test messages, written by the developer, not real clients):

| Measure | JAlgorithm | Keyword baseline |
|---|---|---|
| Accuracy (strict) | 94.6% | 50.0% |
| Macro F1 | 94.9% | 52.9% |
| Lenient accuracy (accepts listed alternatives) | 96.4% | n/a |
| Out-of-domain messages rejected as UNKNOWN | 85.7% | n/a |
| In-domain messages wrongly rejected | 1.5% | n/a |

- Validation set (`tests/data/intent_validation_set.json`): 100.0% strict accuracy on 100 messages (per `UPDATES.md`). Used for tuning. The test set is held out.

### Found and fixed

Recorded in git and `UPDATES.md`:

| Date | Issue | Fix | Commit |
|---|---|---|---|
| Nov 4 | FAQ messages misclassified | Added examples to the LLM prompt | `25f76d0` |
| Nov 4 | Off-topic messages answered | Refused off-topic, strict prompt, intent guard | `1362aae` |
| Nov 7 | Qwen3 reasoning model broke the intent parser | Parser fix | `b1daa2c` |
| Nov 7 | Qwen3 echoed the system prompt | Prompt fix | `3b9ebc1` |
| Nov 7 | Replies used `[Your name]` placeholders | Prompt fix | `9c93845` |
| Nov 7 | Markdown in replies | Stripped markdown | `f829e3d` |
| Nov 12 | LLM replaced entirely | JAlgorithm classifier | `8084f4f` |

Within the JAlgorithm classifier, `UPDATES.md` records later changes:
- Conyo, Gen-Z, Jeje and SMS spellings were added to the shortcuts and lexicon.
- 130 unseen training examples were added across all 15 intents, and 28 unseen validation items.
- Out-of-domain terms were added, and a conversational guard was added for messages like "ano ginagawa mo".
- Tighter gating for bare dates and times that aren't about bookings.

**Known weak spots** (from the evaluation report): `ASK_BOOKING_POLICY` recall is 75%, `GENERAL_INQUIRY` precision is 84.6%, and `UNKNOWN_INTENT` F1 is 85.7%.

### Not yet resolved

- The thesis document reports **86.67%** on a separate 15-message test set. That's a different set from the 222-message app evaluation, so the two figures can't be compared directly.
- The app's evaluation sets were written by the developer. Thesis accuracy needs real, consented client messages.

---

## Cycle 2: Dialogue Manager

### Built

- `src/jalgorithm/dialogue/manager.js` (about 1,200 lines): a state machine that collects missing details, handles corrections, confirmations, cancellations, resets and interruptions.
- `src/jalgorithm/dialogue/state.js`: a state object that can be saved as JSON in `sessionStorage`.
- The flows for booking, rescheduling, cancelling and viewing an appointment are defined in `config/intents.js` (`flow.required` and `flow.optional`).
- Replies are chosen from `config/responses.js`. The bot only says "booked", "rescheduled" or "cancelled" when the database call returns `ok: true`.

### Tested

- `tests/dialogue.test.js`: 43 tests, all passing. Covers multi-turn bookings, reschedules, cancellations, corrections, confirmations and the five real-world scenarios listed below.
- The Dev Studio batch tester and the scenario playback (`DevNluAnimationTab.jsx`) run the same flows for manual checks.

### Found and fixed

`UPDATES.md` records these changes to the dialogue manager:

| Change | What it fixed or added |
|---|---|
| Cross-turn memory (`recentContext`) | Services asked in a price question now carry into the next booking request, instead of being asked again |
| Compound questions (`answerSecondaryInfo`) | A message with two questions (for example price and location) gets both answered in one reply |
| Nearest valid date (`nearest_date_slots`) | When a date is too soon or fully booked, the bot suggests the earliest open date instead of only refusing |
| Slot refresh on `slot_taken` | After a slot is taken by someone else, the bot reloads the available times |
| Mid-flow edits | The client can change the date, time, service, name, contact or location while booking |
| Group head count (`extractHeadCount`) | Estimates the extra-head fee for group bookings |
| Five salon scenarios | Forgot reference code, dual-date availability, booking for someone else, hesitation pause (`"wait lang tanong ko muna"`), and early call-time guidance |

The update log doesn't record a dated list of individual dialogue bugs, so this table lists the features that were added. It doesn't show a before-and-after for each bug.

### Not yet resolved

- The thesis document's pilot conversations (Table 9) show "Client left before confirming" as incomplete. The code has no feature that follows up on that case. The thesis lists it as a high-priority issue.
- The dialogue tests use mocked database calls. They don't prove the booking functions in Supabase behave the same way.

---

## Cycle 3: Automated Reminders

### Built

- **Reminders tab (Owner Dashboard):** shows a 1-day owner preparation schedule, and copyable client reminder messages for 3 days before the appointment (`src/lib/calendarLinks.js`, `buildClientReminderText`).
- **Reminder flag:** when the owner marks a reminder as sent, the app sets `reminder_sent = true` and `reminder_sent_at` on the appointment (`OwnerDashboard.jsx`).
- **Reschedule reset:** when a booking is rescheduled, the database sets `reminder_sent = false` so the new date gets its own reminder (`jal_reschedule`, `20261112_jalgorithm.sql`).

### Tested

- `tests/calendarLinks.test.js`: 7 tests, covering Manila date arithmetic, Google Calendar and Maps links, and the owner and client reminder templates.

### What does not exist

**No automatic reminder is sent.** Searching the code found no scheduled job, no Edge Function, no SMS or email sender, and no cron. The history log states this directly: "Reminders currently prepares ... rather than auto-sending external SMS/email."

This has three consequences:

1. **The bot promises an automatic reminder.** The reply template `faq_reminder` says "A reminder is sent 3 days before your appointment and again 1 day before." Nothing in the code sends it.
2. **The timing rules disagreed.** Fixed: the bot reply, the owner dashboard and the client message now all use 3 days before. There is no reminder setting in Business Info. The 1-day and 3-day options there are cancellation-notice settings.
3. **The thesis reminder test can't come from this system.** The thesis document reports seven reminders "delivered" with a 100% delivery rate. The code has no sender that could produce a delivery status, so those results can't have come from the app as it stands. Either the reminders were sent by hand and logged, or another tool was used. This needs to be explained before the defense, and the thesis wording needs to match what happened.

### Found and fixed

Found and fixed: The reminder timing was inconsistent, and it now uses 3 days before everywhere. But reminders are not automatic, and the owner still sends them by hand.

Decisions and current status:
- **Reminder rule:** 3 days before the appointment. The bot reply, the owner dashboard and the client message all follow this rule.
- **Sending:** manual for now. The owner copies the message and sends it. Automatic sending is not built.
- **1-day reminder:** not tracked separately. The system has one sent flag per booking, so the 1-day reminder is a manual step only.
- **Thesis:** reports seven reminders delivered at 100%. The current system cannot produce that result, so the thesis wording must match how reminders were actually sent.

### Not yet resolved

- Track the 1-day reminder separately. That needs a second sent-flag column, added in a new migration file (migrations are append-only).
- If reminders should be automatic, that needs a scheduled job and a message sender (an SMS or email provider account). Neither exists yet.
- Update the thesis reminder section to describe the real process.
