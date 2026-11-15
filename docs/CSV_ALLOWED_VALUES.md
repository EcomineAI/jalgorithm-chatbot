# CSV Allowed Values

Lists the values the system uses for the fields in the Chat Logs and Appointments exports, templates and imports. Everything here comes from the code and database schema. Nothing is invented.

Sources:
- Intents: `app/src/jalgorithm/config/intents.js`
- Bot replies: `app/src/jalgorithm/config/responses.js`
- Services: `app/supabase/migrations/20261112_jalgorithm.sql` (defaults), editable by the owner in Business Info
- Status, booking method, reminder: `app/supabase/schema.sql` and the `jal_book` function
- Import rules: `app/src/lib/csvExport.js`

---

## 1. Chat Logs

### Detected Intent

The value the chatbot assigned to the client message (`chat_logs.intent_classified`).

| Value | Meaning |
|---|---|
| `BOOK_APPOINTMENT` | Client wants to book |
| `CHECK_AVAILABILITY` | Client asks whether a date or time is free |
| `RESCHEDULE_APPOINTMENT` | Client wants to move an existing booking |
| `CANCEL_APPOINTMENT` | Client wants to cancel a booking |
| `VIEW_APPOINTMENT` | Client asks to see an existing booking |
| `CANNOT_ATTEND` | Client says they can't make it |
| `ASK_PRICE` | Question about prices |
| `ASK_SERVICES` | Question about the services offered |
| `ASK_LOCATION` | Question about the location |
| `ASK_OPERATING_HOURS` | Question about opening hours |
| `ASK_BOOKING_POLICY` | Question about booking, deposit or cancellation rules |
| `GREETING` | Greeting |
| `THANKS` | Thank you message |
| `GENERAL_INQUIRY` | Other questions about the salon |
| `UNKNOWN_INTENT` | Not understood. Also used for messages that are out of scope |

Leave the cell empty if the message has no detected intent.

### Bot Reply

The bot never writes free text. Every reply is one of the templates below, with placeholders such as `{service}` or `{date}` filled in. The stored text is the filled-in version, in English or in Taglish (the `fil` wording with the same key).

The `\n` marks a line break in the template. Placeholders in braces are filled at runtime.

**Greetings and general replies**

| Key | Template (English) |
|---|---|
| `welcome` | Hi! I'm JAL, the booking assistant of {business}. I can help you book, check available slots, reschedule, cancel, or answer questions about our services. What can I do for you? |
| `greeting` | Hi! I'm JAL from {business}. Would you like to book an appointment, check availability, or ask about our services? |
| `greeting` (variant) | Hello! I'm JAL. How can I help you today? I can book, reschedule, or cancel appointments and answer questions about our services. |
| `thanks` | You're welcome! Message me anytime if you need anything else. |
| `thanks` (variant) | Happy to help! Just send a message if you need anything else. |
| `unknown` | Sorry, I didn't quite get that. I can help you book, check availability, reschedule, cancel, or view an appointment, and answer questions about prices, services, location, and hours. |
| `unknown` (variant) | I'm not sure what you mean. You can say things like "book an appointment", "available tomorrow?", or "how much is bridal makeup?" |
| `out_of_scope` | Sorry, I can only help with appointments and questions about {business}'s hair and makeup services. |
| `clarify` | Just to be sure, do you want to {a} or {b}? Reply 1 or 2. |
| `cannot_attend` | I understand. Would you like to (1) reschedule your appointment or (2) cancel it? |
| `cancel_or_abort` | Do you want to (1) stop this booking, or (2) cancel an existing appointment? |
| `offer_declined` | Okay! Just message me when you're ready to book. |
| `ack_prompt` | Got it! |
| `not_understood` | Sorry, I didn't get that. |
| `too_many_misses` | You can type "reset" anytime to start over. |
| `resume` | Back to your {flow}: |
| `reset_done` | Okay, cancelled that. What else can I help you with? |
| `nothing_to_reset` | Okay! What can I help you with? |
| `action_aborted` | Okay, I didn't change anything. |
| `remembered_service` | Got it, continuing with {service}. |
| `setup_paused` | Okay, I paused your {flow} and saved the details you already entered. Click Resume Setup or type "resume" anytime to continue, or "discard draft" to clear them. |
| `setup_hesitation_paused` | Take your time! I paused your {flow} and saved the details you entered so far. Just type "resume" or click Resume Setup whenever you are ready to continue. |
| `setup_resumed` | Welcome back! Resuming your {flow} with your saved details: |
| `draft_discarded` | Okay, I cleared your saved setup draft. How can I help you today? |

**Prices and services**

| Key | Template (English) |
|---|---|
| `price_list` | Here are our rates:\n{list} |
| `price_service` | {service} is {price}. |
| `services` | We offer:\n{list}\nWould you like to book one? |
| `consultation_fee` | I don't have a consultation fee on record, so I can't quote one. Please ask {artist} directly when you book. For reference, here are our service rates:\n{list} |
| `consultation_fee_set` | The consultation fee is PHP {consultationFee}. For reference, here are our service rates:\n{list} |
| `reservation_fee_note` | These services need a PHP {fee} reservation fee: {feeServices}. |
| `reservation_fee_reminder` | This service needs a PHP {fee} reservation fee. Payment details will be sent separately. |
| `service_inclusions` | {service} ({price}) includes: {inclusions}. |
| `service_inclusions_none` | {service} is {price}. Detailed package inclusions aren't listed here yet, so please message {artist} on our page for the full breakdown. |
| `package_inclusions_list` | Here is what is included in each service package:\n{list}\nYou can also message {artist} on our page for custom packages or further details. |
| `additional_heads_set` | Additional head / extra person rate starts at PHP {additionalHeadPrice}. {additionalHeadNote} |
| `additional_heads_unset` | Additional head pricing depends on the event and hair/makeup scope. Please message {artist} on our page for a custom group quote. |
| `additional_heads_quote` | For {count} additional head(s) at PHP {additionalHeadPrice}/head, the extra rate is about PHP {total}. {additionalHeadNote} |
| `additional_heads_quote_with_service` | Estimated total for {service} ({servicePrice}) + {extra} additional head(s) at PHP {additionalHeadPrice}/head: PHP {total}. {additionalHeadNote} |
| `additional_heads_unset_count` | Additional head pricing for {count} head(s) depends on the event and hair/makeup scope. Please message {artist} on our page for an exact group quote. |

**Location, travel and hours**

| Key | Template (English) |
|---|---|
| `location` | {business} is based in {location}. {artist} also travels to your venue; a travel fee may apply for {areas} and beyond. |
| `location_with_travel_note` | {business} is based in {location}. {artist} travels to client venues.\n• Free / inclusive areas: {freeAreas}\n• Out-of-town / variable fee areas: {areas}\n{travelFeeNote} |
| `hours` | We are open {open} to {close}, {days}. |
| `faq_home_service` | Yes, {artist} travels to your location. A travel fee may apply outside {city}. |
| `faq_home_service_note` | Yes, {artist} travels to client venues. Inclusive / free areas: {freeAreas}. Out-of-town ({areas}): {travelFeeNote} |
| `faq_travel_fee` | A travel fee applies for {areas} and areas beyond {city}. The exact amount is confirmed by {artist}. |
| `faq_travel_fee_note` | Travel and transportation fee guide:\n• Inclusive areas: {freeAreas}\n• Out-of-town areas: {areas}\n{travelFeeNote} |

**Policies and FAQ**

| Key | Template (English) |
|---|---|
| `policy` | Booking rules:\n• Book at least {minDays} days in advance.\n• A PHP {fee} reservation fee is needed for: {feeServices}.\n• Cancellations and reschedules must be made at least {cutoff} hours before the appointment.\n• The reservation fee is not refunded for same-day cancellations. |
| `policy_tiered` | Booking and cancellation policies:\n• Advance notice: Book at least {minDays} days before your event.\n• Weddings / Bridal: {weddingDp}% down payment plus contract to lock your date. Refundable if cancelled at least {weddingCutoff} days before; non-refundable within {weddingCutoff} days.\n• Events / Debut / Everyday Glam: {eventDp} reservation fee. Cancellations or reschedules must be made at least {eventCutoff} days before the event (otherwise the reservation fee is forfeited).\n• Rescheduling is free if the new slot is available and within the notice period.\n• {rushNote} |
| `faq_reminder` | Yes. A reminder is sent 3 days before your appointment and again 1 day before. |
| `faq_confirmation` | When you book here, you get a reference code once the booking is saved. Some services ({feeServices}) also need a reservation fee; payment details are sent separately. |
| `faq_confirmation_tiered` | When you book here, you immediately get a reference code. To lock in your date, confirm your down payment ({weddingDp}% for weddings, {eventDp} for events) via our page. |
| `faq_payment` | Payment details are sent separately after booking. I don't have the accepted payment methods on record. |
| `faq_payment_tiered` | Accepted payment: {paymentMethods}.\n• Weddings: {weddingDp}% down payment + contract.\n• Regular events: {eventDp} reservation fee.\nPlease send your payment proof on our page to confirm your slot. |
| `faq_payment_set` | Accepted payment: {paymentMethods}. Payment details are sent after booking. |
| `faq_portfolio` | {artist}'s portfolio link isn't set up in this chat yet. Please ask when you book. |
| `faq_portfolio_set` | You can see {artist}'s work here: {portfolio} |
| `faq_contact` | The contact details aren't set up in this chat yet. You can book, reschedule, or cancel right here though. |
| `faq_contact_set` | You can reach {artist} at {contact}. You can also book, reschedule, or cancel right here. |
| `faq_artist` | Your artist is {artist} of {business}, a freelance hair and makeup service in {city}. |
| `faq_default` | I don't have an answer for that yet. I can help with bookings, prices, services, location, and hours. |
| `downpayment_handoff_note` | Reminder: To lock in your date, please send your reservation/down payment ({dpDetail}) via our page using the message box below. |
| `rush_booking_note` | {rushNote} |
| `change_venue_guide` | To update the venue or location of an existing booking, please message {artist} directly on our page with your reference code (e.g. JAL-7K3QX) and new address so any travel fee can also be checked. If you want to change the date or time instead, just say "reschedule". |
| `change_booking_detail_guide` | Self-service changes here handle booking dates and times. To update the {detail} on an existing appointment ({refLabel}), please message {artist} directly on our page using the message box below so your record stays accurate. If you want to move the date or time instead, just say "reschedule". |

**Availability**

| Key | Template (English) |
|---|---|
| `avail_list` | Available times on {date}: {slots}. |
| `avail_none` | Sorry, there are no available slots on {date}. Would you like to try another date? |
| `avail_yes` | {time} on {date} is available! Would you like me to book it for you? |
| `avail_no` | Sorry, {time} on {date} isn't available. Available times that day: {slots}. Would you like one of those? |
| `dual_date_avail_summary` | Here is our slot availability for the dates you asked:\n{summary}\nWhich date works best for you? |
| `nearest_date_slots` | Earliest date with open slots: {date} ({slots}). Reply "yes" or choose a time to pick {date}, or type another date. |
| `early_calltime_guide` | Standard online booking runs during operating hours ({open} to {close}), so {time} falls outside regular hours. For early call-times (like bridal or event prep), please use the Page handoff button below to confirm availability directly with {artist}. |
| `forgot_reference_guide` | No worries! If you still have your booking confirmation message (like JAL-7K3QX), you can send that code anytime. Otherwise, click the Page handoff button below so {artist} can look up your booking using your name, event date, and mobile number. |

**Questions the bot asks (to fill in a booking)**

| Key | Template (English) |
|---|---|
| `ask_service` | Which service would you like?\n{list} |
| `ask_date` | What date would you like? |
| `ask_date_avail` | What date would you like me to check? |
| `ask_week_day` | Which day {week} week? |
| `ask_time` | What time do you prefer? |
| `ask_time_slots` | Available times on {date}: {slots}. What time do you prefer? |
| `ask_period_slots` | Available {period} times on {date}: {slots}. Which one? |
| `ask_name` | May I have your full name? |
| `ask_contact` | What is your mobile number? (e.g. 09171234567) |
| `ask_location` | Where is the venue or event location? (You can type "skip" if not sure yet.) |
| `ask_reference` | Please send your booking reference code (e.g. JAL-7K3QX). |
| `ask_contact_lookup` | Please also send the mobile number you used when booking. |
| `ask_new_date` | What new date would you like? |
| `ask_new_time` | Available times on {date}: {slots}. What new time would you like? |
| `ask_change` | What would you like to change: the service, date, time, name, number, or location? |

**Input problems**

| Key | Template (English) |
|---|---|
| `invalid_date` | That date doesn't look valid. What date would you like? |
| `past_date` | That date has already passed. Please choose a future date. |
| `invalid_time` | That time doesn't look valid. What time would you like? |
| `invalid_name` | Please type your name (letters only). |
| `invalid_contact` | Please send a valid PH mobile number, like 09171234567. |
| `time_not_in_slots` | {time} isn't available on {date}. Available times: {slots}. Which one works for you? |
| `period_none` | There are no {period} slots on {date}. Available times: {slots}. |

**Booking, reschedule and cancel confirmations**

| Key | Template (English) |
|---|---|
| `booking_summary` | Please confirm your booking:\n• Service: {service}\n• Date: {date}\n• Time: {time}\n• Name: {name}\n• Mobile: {contact}\n• Venue: {location}\nIs this correct? (yes / no) |
| `booking_success` | Your appointment is booked! Your reference code is {ref}. Please keep it; you need it to view, reschedule, or cancel.\n{service} on {date} at {time}. |
| `appointment_details` | Your appointment {ref}: {service} on {date} at {time}. Status: {status}. |
| `reschedule_found` | Found it: {service} on {date} at {time}. |
| `reschedule_summary` | Please confirm the reschedule of {ref}:\n• From: {oldDate} at {oldTime}\n• To: {date} at {time}\nIs this correct? (yes / no) |
| `reschedule_success` | Done! Appointment {ref} is now on {date} at {time}. |
| `cancel_summary` | Cancel appointment {ref} ({service} on {date} at {time})? (yes / no) |
| `cancel_success` | Appointment {ref} has been cancelled. |

**Reasons a booking action is refused**

| Key | Template (English) |
|---|---|
| `reason_too_soon` | Appointments must be booked at least {minDays} days in advance. The earliest available date is {minDate}. Please choose another date. |
| `reason_past_date` | That date has already passed. Please choose a future date. |
| `reason_outside_hours` | That time is outside our working hours ({open} to {close}, and the service has to finish by closing). |
| `reason_slot_taken` | Sorry, that slot was just taken. |
| `reason_not_found` | I couldn't find an appointment with that reference code and mobile number. Please check them and try again. |
| `reason_too_late` | Changes must be made at least {cutoff} hours before the appointment, so I can no longer change this one here. |
| `reason_already_cancelled` | That appointment is already cancelled. |
| `reason_invalid_service` | Sorry, that service isn't available for booking. |
| `reason_invalid_contact` | Please send a valid PH mobile number, like 09171234567. |
| `reason_invalid_name` | Please type your name. |
| `reason_unreachable` | I can't reach the booking system right now (no internet connection or the server is down). I can still answer questions about prices, services, location, and hours. Please try booking again later. |
| `reason_error` | Something went wrong on the booking system, so nothing was changed. Please try again. |

**Short words used inside sentences (not replies on their own)**

`flow_*`, `intent_*`, `period_*`, `week_*`, `status_*`, `detail_*` and `none` are filled into the templates above. For example, `status_confirmed` becomes "confirmed" inside `appointment_details`. They are never sent as a full reply.

### Other chat log fields

| Field | Allowed values |
|---|---|
| Record ID | Any value. Ignored on import, since the database creates new IDs. |
| Session ID | Any text. Groups messages into one conversation. |
| Client Message | Required on import. Any text. |
| Bot Reply | Use one of the reply texts above, with placeholders filled in. Can be empty. |
| Created At | Optional on import. `2026-11-05 14:00` (read as Manila time), or a full timestamp with a timezone such as `2026-11-05T06:00:00Z`. |

---

## 2. Appointments

### Service

Stored as the service name. The owner can rename services in Business Info, so the names below are the defaults from the migration. The matching key (`service_key`) is stored by the chatbot booking.

| Key | Default name |
|---|---|
| `bridal` | Bridal Makeup (full) |
| `event_makeup` | Event / Debut Makeup |
| `personal_makeup` | Personal Makeup |
| `hair_styling` | Hair Styling |
| `hair_makeup` | Hair + Makeup Package |
| `wedding_package` | Wedding Package (bride + entourage) |

Import note: the import fills the `service_type` name only. It doesn't set `service_key`, so use one of the names above to match what the owner sees.

### Status

| Value | Meaning |
|---|---|
| `confirmed` | Booked and not changed. The default. |
| `rescheduled` | The date or time was moved |
| `cancelled` | Cancelled |
| `no_show` | Client did not attend |

The app doesn't have an "attended" status. Completed appointments stay `confirmed`.

### Booking Method

| Value | Meaning |
|---|---|
| `chatbot` | Created by the chatbot (the booking function sets this) |
| `import` | Set by the CSV import when the cell is left blank |

### Reminder Sent

| Value | Meaning |
|---|---|
| `yes`, `true`, `1` | Reminder was sent |
| anything else, or blank | Reminder not sent |

Import note: when `Reminder Sent` is set to yes, `Reminder Sent At` should also be filled in, using `2026-11-07 09:00`.

### Other appointment fields

| Field | Allowed values |
|---|---|
| Record ID | Any value. Ignored on import. |
| Reference Code | Optional. Must be unique. The system uses `JAL-` codes. Blank shows as "No Ref". |
| Client Name | Required on import |
| Client Contact | Optional. Any text. |
| Appointment Date & Time | Required on import. `2026-11-08 14:00` (Manila time), or a full timestamp with a timezone. |
| Venue | Optional. Any text. |
| Notes | Optional. Any text. |
| Created At | Ignored on import. |

---

## 3. Possible Appointments

### Which statuses count as active

| Status | Active? | Effect |
|---|---|---|
| `confirmed` | Yes | Blocks the time slot. Shows in upcoming bookings. Gets reminders. |
| `rescheduled` | Yes | Same as confirmed. Reminder is reset, so it's sent again for the new date. |
| `cancelled` | No | Frees the slot. Can't be changed by the chatbot. |
| `no_show` | No | Frees the slot. Can't be changed by the chatbot. |

### How a status can change

| From | To | Who | Rule |
|---|---|---|---|
| `confirmed` | `rescheduled` | Client (chatbot) | Needs the reference code and mobile number. The new slot must be free. Must be at least the cut-off hours before the appointment (default 24). |
| `rescheduled` | `rescheduled` | Client (chatbot) | Same rules as above. Can happen more than once. |
| `confirmed` or `rescheduled` | `cancelled` | Client (chatbot) | Needs the reference code and mobile number. Must be at least the cut-off hours before the appointment. |
| any | `cancelled` | Owner (dashboard) | Asks for confirmation first. |
| any | `no_show` | Owner (dashboard) | Asks for confirmation first. |
| any | `confirmed` or `rescheduled` | Owner (dashboard) | Set from the status dropdown. No confirmation. |

The chatbot refuses a change if the appointment is already `cancelled`, or is `no_show`, or is inside the cut-off window. The owner dashboard doesn't block any of these changes.

The database has no "attended" status. Completed appointments stay `confirmed`, and the owner can mark a missed one `no_show`.

### Services with price and length

These are the database defaults. The owner can change them in Business Info, and the price and length shown in the app come from the database.

| Key | Service | Price (PHP) | Length |
|---|---|---|---|
| `bridal` | Bridal Makeup (full) | 3,500 | 180 min |
| `event_makeup` | Event / Debut Makeup | 2,000 | 120 min |
| `personal_makeup` | Personal Makeup | 800 | 90 min |
| `hair_styling` | Hair Styling | 500 | 60 min |
| `hair_makeup` | Hair + Makeup Package | 2,500 | 150 min |
| `wedding_package` | Wedding Package (bride + entourage) | 8,000 | 300 min |

A service must finish before closing time (default 19:00), so a 180-minute service has to start by 16:00.

### Example appointment rows

| Ref | Client | Service | Date and time | Status | Reminder Sent | Notes |
|---|---|---|---|---|---|---|
| JAL-7K3QX | Ana Reyes | Hair Styling | 2026-11-20 10:00 | confirmed | no | (empty) |
| JAL-M4P9T | Ana Reyes | Hair Styling | 2026-11-22 14:00 | rescheduled | no | Moved from Nov 20 |
| JAL-W2N8R | Liza Cruz | Bridal Makeup (full) | 2026-12-05 06:00 | cancelled | yes | Client cancelled |
| JAL-H6D3V | Mae Santos | Event / Debut Makeup | 2026-11-28 09:00 | no_show | yes | Did not arrive |

The names and times above are examples only, to show the format. Don't import them as real records.

---

## 4. Remaining Field Formats

### Reference Code (appointments)

- Format: `JAL-` followed by 5 characters, for example `JAL-7K3QX`.
- Characters allowed: `2 3 4 5 6 7 8 9 A B C D E F G H J K L M N P Q R S T U V W X Y Z` (no `0`, `1`, `I` or `O`).
- Generated by the database, so it's unique. Imported rows can use their own code, but a duplicate is rejected.

### Client Contact and Mobile Number (appointments and bot)

- Accepted format: a Philippine mobile number, either `09XXXXXXXXX` (11 digits) or `639XXXXXXXXX` (12 digits). The database stores it in the `09` form.
- Anything else is rejected by the booking function.
- The CSV import doesn't check this format, so check the value before you import.

### Session ID (chat logs)

- Format: `session_` + a millisecond timestamp + `_` + up to 6 random lowercase letters or digits. Example: `session_1763164800000_k3j9x2`.
- Created by the chat page. Imported rows can use any text, but keep the same format so the sessions group together.

### Appointment date and time

- Stored in Manila time (Asia/Manila, UTC+8).
- Default booking rules, from the database `booking_settings` table. The owner can change them in Business Info:

| Setting | Default |
|---|---|
| Opening time | 08:00 |
| Closing time | 19:00 (a service must finish by closing time) |
| Minimum advance notice | 3 days |
| Cancel or reschedule cut-off | 24 hours before the appointment |
| Slot interval | 60 minutes |
| Default service length | 60 minutes |

- The CSV import doesn't check these rules. An imported appointment can fall outside opening hours or inside the advance-notice window, so check dates and times against these rules before you import.

### Venue, Notes and other free text

- Any text. Venue can be empty. Notes can be empty. Avoid line breaks in Excel, since they're kept inside the cell.

---

## 5. Import Rules Summary

- A file must have a header row. Labels must match exactly, ignoring capital letters.
- **Appointments:** Client Name, Service and Appointment Date & Time are required.
- **Chat logs:** Client Message is required.
- If any row fails, nothing is imported. The message lists each failing line.
