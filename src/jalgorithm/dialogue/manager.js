// Dialogue manager: a rule-based state machine on top of the NLU result.
//
// Responsibilities
//  • slot filling: asks only for information that is still missing
//  • follow-ups: "3pm sana" fills the slot the bot is waiting for
//  • corrections: "ay 4pm pala" replaces a slot; "no" at the summary asks what to change
//  • confirmation (yes/no) before any write operation
//  • reset ("wag na", "nevermind") and interruptions (a price question mid-booking)
//  • clarification for ambiguous / "can't attend" messages
//
// It never decides business rules itself: availability, advance notice, ownership and
// cutoffs come back from the injected `actions` (src/services/appointments.js) as reason codes,
// and it only reports success when an action returned ok: true.

import { newFlow, cloneState } from './state.js'
import { INTENTS, FLOW_INTENTS } from '../config/intents.js'
import { YES_WORDS, NO_WORDS, RESET_PHRASES } from '../config/lexicon.js'
import { manilaToday, compareIso } from '../entities/calendar.js'
import { replyLanguage } from '../pipeline/language.js'

const INFO_INTENTS = new Set(['ASK_PRICE', 'ASK_SERVICES', 'ASK_LOCATION', 'ASK_OPERATING_HOURS', 'ASK_BOOKING_POLICY', 'GENERAL_INQUIRY', 'GREETING', 'THANKS'])
const YESNO_FILLER = new Set(['po', 'na', 'lang', 'nalang', 'naman', '?', 'please', 'talaga', 'yan', 'yun', 'ito', 'iyan', 'go', 'ahead'])
const CHANGE_WORDS = {
  service: ['service', 'serbisyo', 'package'],
  date: ['date', 'araw', 'petsa', 'day'],
  time: ['time', 'oras'],
  name: ['name', 'pangalan'],
  contact: ['number', 'contact', 'mobile', 'phone', 'cp', 'cellphone'],
  location: ['location', 'venue', 'lugar', 'address'],
}
const OPTION_TAGS = {
  RESCHEDULE_APPOINTMENT: 'MOVE', CANCEL_APPOINTMENT: 'CANCEL', BOOK_APPOINTMENT: 'BOOK', CHECK_AVAILABILITY: 'AVAIL',
  ASK_PRICE: 'PRICE', ASK_SERVICES: 'SERVICE_Q', ASK_OPERATING_HOURS: 'HOURS', VIEW_APPOINTMENT: 'VIEW',
}
const FAQ_FIELDS = { contact: 'contact', portfolio: 'portfolio', payment: 'paymentMethods' }
const FREE_TEXT_TAGS = new Set(['QUESTION', 'POSS', 'WANT', 'LOCATION', 'GENERAL', 'SERVICE', 'DATE', 'TIME'])
const FIRST = new Set(['1', 'una', 'first', 'unang'])
const SECOND = new Set(['2', 'pangalawa', 'second', 'ikalawa'])

export function yesNo(words) {
  const w = words.filter((x) => !YESNO_FILLER.has(x))
  if (!w.length || w.length > 5) return null
  if (w.some((x) => NO_WORDS.has(x))) return 'no'
  if (YES_WORDS.has(w[0]) || w.includes('confirm')) return 'yes'
  return null
}

export function isReset(words) {
  const w = words.filter((x) => x !== 'po' && x !== '?' && x !== 'please')
  return RESET_PHRASES.some((p) => p.length <= w.length && w.length <= p.length + 1 && p.every((x, i) => w[i] === x))
}

const periodOf = (hhmm) => (hhmm < '12:00' ? 'morning' : hhmm < '17:00' ? 'afternoon' : 'evening')
const flowSlots = (intent) => new Set([...(INTENTS[intent]?.flow?.required ?? []), ...(INTENTS[intent]?.flow?.optional ?? [])])

export function createDialogueManager({ analyzer, responder, actions, catalog, now = () => new Date() }) {
  const { business, services, faqTopics } = catalog
  const { serviceName, serviceList } = responder
  async function handle(text, prevState) {
    const state = cloneState(prevState)
    state.turn += 1
    const nowDate = now()
    const nlu = analyzer.analyze(text, { now: nowDate, expect: state.flow?.awaiting ?? null })
    state.lang = replyLanguage(nlu.language, state.lang)

    const ctx = { state, nlu, nowDate, out: [], action: null, resolvedIntent: nlu.intent }
    ctx.say = (key, vars) => ctx.out.push(responder.t(key, vars, { lang: state.lang, turn: state.turn }))
    ctx.label = (key) => responder.t(key, {}, { lang: state.lang })

    await route(ctx)

    state.lastIntent = ctx.resolvedIntent
    return { reply: ctx.out.join('\n\n'), state, intent: ctx.resolvedIntent, nlu, action: ctx.action }
  }

  // ── routing ────────────────────────────────────────────────────────────────

  async function route(ctx) {
    const { state, nlu } = ctx

    if (isReset(nlu.words)) {
      const wasConfirming = state.flow?.confirming
      const hadSomething = state.flow || state.pending
      state.flow = null
      state.pending = null
      ctx.resolvedIntent = 'RESET'
      return ctx.say(wasConfirming ? 'action_aborted' : hadSomething ? 'reset_done' : 'nothing_to_reset')
    }

    if (state.pending) {
      const handled = await handlePending(ctx)
      if (handled) return
    }

    if (state.flow) return handleFlowTurn(ctx)

    if (nlu.ambiguous && nlu.candidates.length === 2) {
      state.pending = { type: 'clarify', options: nlu.candidates, slots: carriedSlots(ctx) }
      ctx.resolvedIntent = nlu.candidates[0]
      return ctx.say('clarify', { a: ctx.label(`intent_${nlu.candidates[0]}`), b: ctx.label(`intent_${nlu.candidates[1]}`) })
    }
    return startIntent(ctx, nlu.intent)
  }

  async function handlePending(ctx) {
    const { state, nlu } = ctx
    const p = state.pending
    state.pending = null
    const words = nlu.words

    if (p.type === 'offer_book') {
      const yn = yesNo(words)
      if (yn === 'yes') {
        state.flow = newFlow('BOOK_APPOINTMENT', p.slots)
        ctx.resolvedIntent = 'BOOK_APPOINTMENT'
        await advance(ctx)
        return true
      }
      if (yn === 'no') {
        ctx.say('offer_declined')
        return true
      }
      return false
    }

    if (p.type === 'clarify') {
      let choice = null
      if (words.some((w) => FIRST.has(w))) choice = p.options[0]
      else if (words.some((w) => SECOND.has(w))) choice = p.options[1]
      else if (p.options.includes(nlu.intent)) choice = nlu.intent
      else choice = p.options.find((o) => OPTION_TAGS[o] && nlu.tags.includes(OPTION_TAGS[o])) ?? null
      if (choice) {
        await startIntent(ctx, choice, p.slots)
        return true
      }
      return false
    }

    if (p.type === 'cancel_or_abort') {
      if (words.some((w) => FIRST.has(w) || ['stop', 'itigil', 'booking', 'ito'].includes(w))) {
        state.flow = null
        ctx.resolvedIntent = 'RESET'
        ctx.say('reset_done')
        return true
      }
      if (words.some((w) => SECOND.has(w) || ['existing', 'dati', 'luma', 'old'].includes(w)) || nlu.entities.reference) {
        state.flow = null
        await startIntent(ctx, 'CANCEL_APPOINTMENT')
        return true
      }
      return false
    }
    return false
  }

  async function startIntent(ctx, intent, carried = {}) {
    const { state, nlu } = ctx
    ctx.resolvedIntent = intent

    if (FLOW_INTENTS.includes(intent)) {
      state.flow = newFlow(intent, carried)
      const { notes } = absorb(ctx, state.flow)
      notes.forEach((n) => ctx.say(n.key, n.vars))
      return advance(ctx)
    }
    if (intent === 'CANNOT_ATTEND') {
      state.pending = { type: 'clarify', options: ['RESCHEDULE_APPOINTMENT', 'CANCEL_APPOINTMENT'], slots: {} }
      return ctx.say('cannot_attend')
    }
    if (INFO_INTENTS.has(intent)) return answerInfo(ctx, intent)
    return ctx.say(nlu.reason === 'out_of_scope' || nlu.reason === 'out_of_domain' ? 'out_of_scope' : 'unknown')
  }

  async function handleFlowTurn(ctx) {
    const { state, nlu } = ctx
    const f = state.flow
    ctx.resolvedIntent = f.intent

    if (f.confirming) {
      const yn = yesNo(nlu.words)
      if (yn === 'yes') return execute(ctx)
      if (yn === 'no') {
        f.confirming = false
        f.awaiting = 'change'
        return ctx.say('ask_change')
      }
    }

    let changeRequested = false
    if (f.awaiting === 'change') {
      const target = Object.keys(CHANGE_WORDS).find((k) => CHANGE_WORDS[k].some((w) => nlu.words.includes(w)))
      if (target && flowSlots(f.intent).has(target)) {
        f.slots[target] = null
        if (target === 'location') f.locationAsked = false
        if (target === 'date' || target === 'service') f.checked = null
        changeRequested = true
      }
    }

    const { filled, notes } = absorb(ctx, f)
    if (filled.length || notes.length || changeRequested) {
      notes.forEach((n) => ctx.say(n.key, n.vars))
      f.misses = 0
      f.confirming = false
      return advance(ctx)
    }

    // Nothing for this flow in the message: is it a different request?
    const intent = nlu.intent
    if (FLOW_INTENTS.includes(intent) && intent !== f.intent && nlu.confidence >= 0.45) {
      if (f.intent === 'BOOK_APPOINTMENT' && intent === 'CANCEL_APPOINTMENT') {
        state.pending = { type: 'cancel_or_abort' }
        return ctx.say('cancel_or_abort')
      }
      const carried = pick(f.slots, ['date', 'time', 'service'])
      state.flow = null
      return startIntent(ctx, intent, f.intent === 'CHECK_AVAILABILITY' ? carried : {})
    }
    if (intent === 'CANNOT_ATTEND') {
      state.flow = null
      return startIntent(ctx, intent)
    }
    if (INFO_INTENTS.has(intent) && !(intent === 'THANKS' && f.confirming)) {
      ctx.resolvedIntent = intent
      answerInfo(ctx, intent)
      ctx.say('resume', { flow: ctx.label(`flow_${f.intent}`) })
      return advance(ctx)
    }

    if (f.awaiting === 'name') return ctx.say('invalid_name')
    if (f.awaiting === 'contact') return ctx.say('invalid_contact')
    f.misses += 1
    ctx.say('not_understood')
    await advance(ctx)
    if (f.misses >= 2) ctx.say('too_many_misses')
  }

  // ── slot filling ───────────────────────────────────────────────────────────

  function carriedSlots(ctx) {
    const e = ctx.nlu.entities
    const today = manilaToday(ctx.nowDate)
    const slots = {}
    if (e.date && compareIso(e.date, today) >= 0) slots.date = e.date
    if (e.time) slots.time = e.time
    if (e.service) slots.service = e.service
    return slots
  }

  /** Copies entities from the current message into the flow. Returns filled slot names and notes to say. */
  function absorb(ctx, f) {
    const e = ctx.nlu.entities
    const relevant = flowSlots(f.intent)
    const filled = []
    const notes = []
    const set = (slot, value) => {
      if (!relevant.has(slot) || value == null) return
      const changed = f.slots[slot] !== value
      if (changed) {
        f.slots[slot] = value
        if (slot === 'date' || slot === 'service') f.checked = f.checked && f.checked.date === f.slots.date && f.checked.service === f.slots.service ? f.checked : null
        if (slot === 'reference' || slot === 'contact') f.appointment = null
      }
      // Re-mentioning an already-known value ("magkano bridal?" mid-booking) is not progress.
      if (changed || f.awaiting === slot) filled.push(slot)
    }

    if (relevant.has('service') && e.service) set('service', e.service)

    if (relevant.has('date') && e.dateInfo) {
      if (e.dateInfo.invalid) notes.push({ key: 'invalid_date' })
      else if (e.dateInfo.week) {
        f.weekHint = e.dateInfo.week
        notes.push({ key: 'ask_week_day', vars: { week: ctx.label(`week_${e.dateInfo.week}`) } })
      } else if (e.dateInfo.past) notes.push({ key: 'past_date' })
      else if (e.date) {
        set('date', e.date)
        f.weekHint = null
      }
    }

    if (relevant.has('time') && e.timeInfo) {
      const ti = e.timeInfo
      if (ti.invalid) notes.push({ key: 'invalid_time' })
      else if (ti.time) {
        set('time', ti.time)
        f.period = null
        f.anyTime = false
      } else if (ti.anyTime) {
        f.anyTime = true
        filled.push('time-any')
      } else if (ti.period) {
        f.period = ti.period
        filled.push('time-period')
      }
    }

    if (e.contact) set('contact', e.contact)
    else if (f.awaiting === 'contact' && ctx.nlu.tokens.some((t) => /\d{5,}/.test(t.text))) notes.push({ key: 'invalid_contact' })
    if (e.reference) set('reference', e.reference)
    // Free-text answers (name, venue) are only accepted when the message isn't itself a request
    // or question, so "magkano bridal?" while we wait for a name is answered, not saved as a name.
    const isFreeText = !ctx.nlu.words.includes('?') && ctx.nlu.tags.every((t) => FREE_TEXT_TAGS.has(t))
    if (f.awaiting === 'name' && e.name && isFreeText) set('name', e.name)
    if (f.awaiting === 'location' && e.location && isFreeText) {
      f.locationAsked = true
      if (e.location.skipped) filled.push('location')
      else set('location', e.location.value)
    }
    return { filled, notes }
  }

  // ── flow progression ───────────────────────────────────────────────────────

  function ask(ctx, key, slot, vars) {
    ctx.state.flow.awaiting = slot
    ctx.say(key, vars)
  }

  async function advance(ctx) {
    const f = ctx.state.flow
    if (!f) return
    switch (f.intent) {
      case 'BOOK_APPOINTMENT':
        return advanceBooking(ctx, f)
      case 'CHECK_AVAILABILITY':
        return advanceAvailability(ctx, f)
      case 'RESCHEDULE_APPOINTMENT':
      case 'CANCEL_APPOINTMENT':
      case 'VIEW_APPOINTMENT':
        return advanceExisting(ctx, f)
    }
  }

  async function advanceBooking(ctx, f) {
    const s = f.slots
    if (!s.service) return ask(ctx, 'ask_service', 'service', { list: serviceList() })
    if (!s.date) return askDate(ctx, f, 'ask_date')
    const slots = await availableSlots(ctx, f, s.date, s.service)
    if (!slots) return
    if (!s.time) return askTime(ctx, f, slots, 'ask_time_slots')
    if (!slots.includes(s.time)) {
      const vars = { time: fmtTime(s.time), date: fmtDate(ctx, s.date), slots: fmtSlots(slots) }
      s.time = null
      return ask(ctx, 'time_not_in_slots', 'time', vars)
    }
    if (!s.name) return ask(ctx, 'ask_name', 'name')
    if (!s.contact) return ask(ctx, 'ask_contact', 'contact')
    if (!f.locationAsked) {
      f.locationAsked = true
      return ask(ctx, 'ask_location', 'location')
    }
    f.confirming = true
    f.awaiting = 'confirm'
    ctx.say('booking_summary', {
      service: serviceName(s.service),
      date: fmtDate(ctx, s.date),
      time: fmtTime(s.time),
      name: s.name,
      contact: s.contact,
      location: s.location ?? ctx.label('none'),
    })
  }

  async function advanceAvailability(ctx, f) {
    const s = f.slots
    if (!s.date) return askDate(ctx, f, 'ask_date_avail')
    const slots = await availableSlots(ctx, f, s.date, s.service)
    if (!slots) return
    if (!s.time) return askTime(ctx, f, slots, 'ask_time_slots')
    const vars = { time: fmtTime(s.time), date: fmtDate(ctx, s.date), slots: fmtSlots(slots) }
    if (slots.includes(s.time)) {
      ctx.state.pending = { type: 'offer_book', slots: pick(s, ['date', 'time', 'service']) }
      ctx.state.flow = null
      return ctx.say('avail_yes', vars)
    }
    s.time = null
    return ask(ctx, 'avail_no', 'time', vars)
  }

  async function advanceExisting(ctx, f) {
    const s = f.slots
    if (!s.reference) return ask(ctx, 'ask_reference', 'reference')
    if (!s.contact) return ask(ctx, 'ask_contact_lookup', 'contact')

    if (!f.appointment) {
      const r = await call(ctx, 'findAppointment', { reference: s.reference, contact: s.contact })
      if (!r.ok) {
        if (r.reason === 'not_found') {
          f.lookups += 1
          s.reference = null
          s.contact = null
          sayReason(ctx, r)
          if (f.lookups >= 2) {
            ctx.state.flow = null
            return
          }
          return ask(ctx, 'ask_reference', 'reference')
        }
        sayReason(ctx, r)
        ctx.state.flow = null
        return
      }
      f.appointment = r.data
      const appt = apptVars(ctx, r.data)
      if (f.intent === 'VIEW_APPOINTMENT') {
        ctx.state.flow = null
        return ctx.say('appointment_details', appt)
      }
      if (r.data.status === 'cancelled') {
        ctx.state.flow = null
        return ctx.say('reason_already_cancelled')
      }
      if (f.intent === 'CANCEL_APPOINTMENT') {
        f.confirming = true
        f.awaiting = 'confirm'
        return ctx.say('cancel_summary', appt)
      }
      ctx.say('reschedule_found', appt)
    }

    if (f.intent === 'CANCEL_APPOINTMENT') {
      f.confirming = true
      f.awaiting = 'confirm'
      return ctx.say('cancel_summary', apptVars(ctx, f.appointment))
    }

    // reschedule: collect the new date and time
    if (!s.date) return askDate(ctx, f, 'ask_new_date')
    const slots = await availableSlots(ctx, f, s.date, f.appointment.service_key)
    if (!slots) return
    if (!s.time) return askTime(ctx, f, slots, 'ask_new_time')
    if (!slots.includes(s.time)) {
      const vars = { time: fmtTime(s.time), date: fmtDate(ctx, s.date), slots: fmtSlots(slots) }
      s.time = null
      return ask(ctx, 'time_not_in_slots', 'time', vars)
    }
    f.confirming = true
    f.awaiting = 'confirm'
    const appt = apptVars(ctx, f.appointment)
    ctx.say('reschedule_summary', { ref: appt.ref, oldDate: appt.date, oldTime: appt.time, date: fmtDate(ctx, s.date), time: fmtTime(s.time) })
  }

  function askDate(ctx, f, key) {
    if (f.weekHint) return ask(ctx, 'ask_week_day', 'date', { week: ctx.label(`week_${f.weekHint}`) })
    return ask(ctx, key, 'date')
  }

  function askTime(ctx, f, slots, key) {
    const date = fmtDate(ctx, f.slots.date)
    if (f.period) {
      const inPeriod = slots.filter((t) => periodOf(t) === f.period)
      const period = ctx.label(`period_${f.period}`)
      if (inPeriod.length) return ask(ctx, 'ask_period_slots', 'time', { period, date, slots: fmtSlots(inPeriod) })
      ctx.say('period_none', { period, date, slots: fmtSlots(slots) })
      return ask(ctx, 'ask_time', 'time')
    }
    return ask(ctx, key, 'time', { date, slots: fmtSlots(slots) })
  }

  /** Fetches (or reuses) free start times. Returns null after saying why when unavailable. */
  async function availableSlots(ctx, f, date, serviceKey) {
    if (f.checked && f.checked.date === date && f.checked.service === (serviceKey ?? null)) return f.checked.slots
    const r = await call(ctx, 'getAvailableSlots', { date, serviceKey: serviceKey ?? null })
    if (!r.ok) {
      sayReason(ctx, r)
      if (['too_soon', 'past_date', 'invalid_date'].includes(r.reason)) {
        f.slots.date = null
        f.slots.time = null
        f.awaiting = 'date'
      } else if (r.reason === 'invalid_service') {
        f.slots.service = null
        ask(ctx, 'ask_service', 'service', { list: serviceList() })
      } else {
        ctx.state.flow = null // unreachable / error: stop instead of pretending
      }
      return null
    }
    const slots = r.data?.slots ?? []
    if (!slots.length) {
      ctx.say('avail_none', { date: fmtDate(ctx, date) })
      f.slots.date = null
      f.slots.time = null
      f.awaiting = 'date'
      return null
    }
    f.checked = { date, service: serviceKey ?? null, slots }
    return slots
  }

  // ── actions ────────────────────────────────────────────────────────────────

  async function call(ctx, name, args) {
    let result
    try {
      if (!actions || typeof actions[name] !== 'function') result = { ok: false, reason: 'unreachable' }
      else result = (await actions[name](args)) ?? { ok: false, reason: 'error' }
    } catch {
      result = { ok: false, reason: 'error' }
    }
    ctx.action = { name, ok: Boolean(result.ok), reason: result.reason ?? null }
    return result
  }

  function sayReason(ctx, r) {
    const key = `reason_${r.reason}`
    const vars = { minDate: r.data?.min_date ? fmtDate(ctx, r.data.min_date) : undefined }
    try {
      ctx.say(key, vars)
    } catch {
      ctx.say('reason_error')
    }
  }

  async function execute(ctx) {
    const f = ctx.state.flow
    const s = f.slots
    f.confirming = false

    if (f.intent === 'BOOK_APPOINTMENT') {
      const r = await call(ctx, 'bookAppointment', {
        serviceKey: s.service, date: s.date, time: s.time, name: s.name, contact: s.contact, location: s.location,
      })
      if (r.ok) {
        ctx.state.flow = null
        ctx.say('booking_success', { ref: r.data.reference_code, service: serviceName(s.service), date: fmtDate(ctx, s.date), time: fmtTime(s.time) })
        if (business.rules.reservationFee > 0 && business.rules.reservationFeeServices.includes(s.service)) ctx.say('reservation_fee_reminder')
        return
      }
      return recoverFromFailure(ctx, f, r)
    }

    if (f.intent === 'RESCHEDULE_APPOINTMENT') {
      const r = await call(ctx, 'rescheduleAppointment', { reference: s.reference, contact: s.contact, date: s.date, time: s.time })
      if (r.ok) {
        ctx.state.flow = null
        return ctx.say('reschedule_success', { ref: s.reference, date: fmtDate(ctx, s.date), time: fmtTime(s.time) })
      }
      return recoverFromFailure(ctx, f, r)
    }

    if (f.intent === 'CANCEL_APPOINTMENT') {
      const r = await call(ctx, 'cancelAppointment', { reference: s.reference, contact: s.contact })
      ctx.state.flow = null
      if (r.ok) return ctx.say('cancel_success', { ref: s.reference })
      return sayReason(ctx, r)
    }
  }

  async function recoverFromFailure(ctx, f, r) {
    sayReason(ctx, r)
    const s = f.slots
    switch (r.reason) {
      case 'slot_taken':
      case 'outside_hours':
        s.time = null
        f.checked = null
        return advance(ctx)
      case 'too_soon':
      case 'past_date':
        s.date = null
        s.time = null
        f.checked = null
        return advance(ctx)
      case 'invalid_contact':
        s.contact = null
        return advance(ctx)
      case 'invalid_name':
        s.name = null
        return advance(ctx)
      case 'invalid_service':
        s.service = null
        return advance(ctx)
      case 'unreachable':
      case 'error':
        // keep the details so the user can simply say "yes" again to retry
        f.confirming = true
        f.awaiting = 'confirm'
        return
      default:
        ctx.state.flow = null
    }
  }

  // ── informational answers ──────────────────────────────────────────────────

  function answerInfo(ctx, intent) {
    const { nlu } = ctx
    switch (intent) {
      case 'ASK_PRICE': {
        if (nlu.words.includes('consultation')) return ctx.say(business.consultationFee != null ? 'consultation_fee_set' : 'consultation_fee', { list: serviceList() })
        const svc = services.find((x) => x.key === nlu.entities.service)
        if (svc) {
          ctx.say('price_service', { service: svc.name, price: responder.fmt.price(svc.price) })
          if (business.rules.reservationFee > 0 && business.rules.reservationFeeServices.includes(svc.key)) ctx.say('reservation_fee_note')
          return
        }
        return ctx.say('price_list', { list: serviceList() })
      }
      case 'ASK_SERVICES':
        return ctx.say('services', { list: serviceList() })
      case 'ASK_LOCATION':
        return ctx.say('location')
      case 'ASK_OPERATING_HOURS':
        return ctx.say('hours')
      case 'ASK_BOOKING_POLICY':
        return ctx.say('policy')
      case 'GREETING':
        return ctx.say('greeting')
      case 'THANKS':
        return ctx.say('thanks')
      case 'GENERAL_INQUIRY': {
        let best = null
        let bestScore = 0
        for (const topic of faqTopics) {
          const score = topic.keywords.filter((k) => nlu.words.includes(k)).length
          if (score > bestScore) {
            best = topic
            bestScore = score
          }
        }
        if (!best) return ctx.say('faq_default')
        // contact / portfolio / payment answers use the owner's info when it has been filled in
        const field = FAQ_FIELDS[best.id]
        return ctx.say(field && business[field] ? `faq_${best.id}_set` : `faq_${best.id}`)
      }
    }
  }

  // ── formatting helpers ─────────────────────────────────────────────────────

  const fmtDate = (ctx, iso) => responder.fmt.date(iso, ctx.state.lang)
  const fmtTime = (hhmm) => responder.fmt.time(hhmm)
  const fmtSlots = (list) => responder.fmt.slots(list)
  const apptVars = (ctx, a) => ({
    ref: a.reference_code,
    service: a.service_name ?? serviceName(a.service_key),
    date: fmtDate(ctx, a.date),
    time: fmtTime(a.time),
    status: ctx.label(`status_${a.status}`),
  })

  return { handle }
}

function pick(obj, keys) {
  const out = {}
  for (const k of keys) if (obj[k] != null) out[k] = obj[k]
  return out
}
