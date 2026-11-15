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
import { manilaToday, addDays, compareIso } from '../entities/calendar.js'
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
const CHANGE_VERBS = new Set(['change', 'edit', 'palitan', 'palit', 'ibahin', 'update', 'baguhin'])
const POLICY_EXPLICIT_WORDS = new Set(['policy', 'policies', 'rules', 'rule', 'refund', 'refundable', 'downpayment', 'dp', 'deposit', 'penalty', 'patakaran'])
const HOURS_EXPLICIT_WORDS = new Set(['hours', 'opening', 'closing', 'sarado', 'operating', 'magsasara', 'nagsasara', 'nagbubukas', 'magbubukas'])
const NON_SCHED_CHANGE_TARGETS = ['contact', 'location', 'service', 'name']
const OPTION_TAGS = {
  RESCHEDULE_APPOINTMENT: 'MOVE', CANCEL_APPOINTMENT: 'CANCEL', BOOK_APPOINTMENT: 'BOOK', CHECK_AVAILABILITY: 'AVAIL',
  ASK_PRICE: 'PRICE', ASK_SERVICES: 'SERVICE_Q', ASK_OPERATING_HOURS: 'HOURS', VIEW_APPOINTMENT: 'VIEW',
}
const FAQ_FIELDS = { contact: 'contact', portfolio: 'portfolio', payment: 'paymentMethods' }
const FREE_TEXT_TAGS = new Set(['QUESTION', 'POSS', 'WANT', 'LOCATION', 'GENERAL', 'SERVICE', 'DATE', 'TIME'])
const FIRST = new Set(['1', 'una', 'first', 'unang'])
const SECOND = new Set(['2', 'pangalawa', 'second', 'ikalawa'])
const INCLUSION_WORDS = new Set(['inclusion', 'inclusions', 'include', 'includes', 'included', 'kasama', 'kasali', 'pinagkaiba', 'kaibahan', 'difference', 'compare'])
const HEAD_WORDS = new Set(['additional', 'dagdag', 'extra', 'head', 'heads', 'person', 'pax', 'kasabay', 'companion', 'bridesmaid', 'bridesmaids'])
const ACK_EXTRA_WORDS = new Set(['noted', 'gets', 'cge', 'copy', 'alright', 'right', 'oh', 'ah', 'ahh', 'hmm', 'thank', 'thanks', 'ty', 'salamat'])
const RESUME_PHRASES = [['resume'], ['continue'], ['ituloy'], ['tuloy'], ['tuloy', 'natin'], ['resume', 'booking'], ['resume', 'setup']]
const DISCARD_DRAFT_PHRASES = [['discard', 'draft'], ['clear', 'draft'], ['delete', 'draft'], ['burahin', 'draft'], ['start', 'fresh']]
const FORGOT_REF_WORDS = new Set(['nakalimutan', 'limot', 'kalimutan', 'maalala', 'tandaan', 'forgot', 'lost', 'nawala'])
const CALLTIME_WORDS = new Set(['calltime', 'early', 'maaga', 'madaling', 'dawn'])
const HESITATE_STARTERS = new Set(['wait', 'sandali', 'teka'])
const HESITATE_CHECK_VERBS = new Set(['check', 'tanong', 'tanungin', 'ask', 'confirm', 'usap', 'consult'])

const hasFilledSetup = (flow) => Boolean(flow?.slots && Object.values(flow.slots).some(Boolean))
const hasBigram = (words, a, b) => words.some((w, i) => w === a && words[i + 1] === b)
const isHesitationPause = (words, entities) => {
  if (!words.length) return false
  if (entities?.date || entities?.time || entities?.reference || entities?.contact || entities?.service) return false
  if (hasBigram(words, 'hold', 'on') || hasBigram(words, 'one', 'sec')) return true
  if (HESITATE_STARTERS.has(words[0]) && words.length >= 2 && !NO_WORDS.has(words[1]) && !words.some((w) => ['mali', 'wrong', 'cancel', 'reset'].includes(w))) return true
  return words.includes('muna') && words.some((w) => HESITATE_CHECK_VERBS.has(w))
}
const isEarlyCallTime = (words, entities, biz) => {
  const open = biz?.hours?.open || '08:00'
  if (entities?.time && entities.time < open) return true
  const isAskingOpenTime = !entities?.time && words.some((w) => ['anong', 'ano', 'what', 'kailan', 'when'].includes(w))
  if (isAskingOpenTime) return false
  const hasCallCue = hasWordIn(words, CALLTIME_WORDS) || hasBigram(words, 'call', 'time') || hasBigram(words, 'madaling', 'araw')
  return hasCallCue && !words.some((w) => ['magsasara', 'close', 'closing', 'sarado'].includes(w))
}
const matchesPhraseList = (words, phrases) => {
  const clean = words.filter((x) => x !== 'po' && x !== '?' && x !== 'please')
  return phrases.some((p) => p.length === clean.length && p.every((x, i) => clean[i] === x))
}

const hasWordIn = (words, set) => words.some((w) => set.has(w))
const isTieredPolicy = (rules) =>
  Boolean(rules?.weddingDownpaymentPercent != null || rules?.weddingCancelCutoffDays != null || rules?.eventDownpaymentPercent || rules?.eventCancelCutoffDays != null || rules?.sameDayRushNote)
const hasTravelDetails = (biz) => Boolean(biz?.travelFeeNote || (biz?.freeTravelAreas && biz.freeTravelAreas.length > 0))

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
  const { serviceName, serviceList, serviceInclusionsList } = responder
  async function handle(text, prevState, opts = {}) {
    const state = cloneState(prevState)
    state.turn += 1
    const nowDate = now()
    const replyContext = opts?.replyContext || null
    const nlu = analyzer.analyze(text, { now: nowDate, expect: state.flow?.awaiting ?? null })
    if (replyContext?.service && !nlu.entities?.service) {
      const hasTopicCue =
        nlu.intent === 'ASK_PRICE' ||
        nlu.intent === 'BOOK_APPOINTMENT' ||
        hasWordIn(nlu.words, INCLUSION_WORDS) ||
        nlu.words.some((w) => ['price', 'magkano', 'book', 'include', 'includes', 'kasama', 'how', 'much'].includes(w))
      if (hasTopicCue) nlu.entities.service = replyContext.service
    }
    state.lang = replyLanguage(nlu.language, state.lang)

    const ctx = {
      state,
      nlu,
      nowDate,
      out: [],
      action: null,
      resolvedIntent: nlu.intent,
      handoff: null,
      appointment: null,
      replyTo: replyContext,
    }
    ctx.say = (key, vars) => ctx.out.push(responder.t(key, vars, { lang: state.lang, turn: state.turn }))
    ctx.label = (key) => responder.t(key, {}, { lang: state.lang })

    await route(ctx)

    state.lastIntent = ctx.resolvedIntent
    rememberContext(state, nlu, nowDate)
    return {
      reply: ctx.out.join('\n\n'),
      state,
      intent: ctx.resolvedIntent,
      nlu,
      action: ctx.action,
      handoff: ctx.handoff,
      appointment: ctx.appointment,
      replyTo: ctx.replyTo,
    }
  }

  function rememberContext(state, nlu, nowDate) {
    const e = nlu?.entities
    if (!e) return
    const today = manilaToday(nowDate)
    const prev = state.recentContext ?? { service: null, date: null, time: null, updatedTurn: 0 }
    const next = { ...prev }
    let updated = false
    if (e.service) {
      next.service = e.service
      updated = true
    }
    if (e.date && compareIso(e.date, today) >= 0) {
      next.date = e.date
      updated = true
    }
    if (e.time) {
      next.time = e.time
      updated = true
    }
    if (updated) {
      next.updatedTurn = state.turn
      state.recentContext = next
    }
  }

  function clearRecentContext(state) {
    state.recentContext = { service: null, date: null, time: null, updatedTurn: 0 }
  }

  function replyBookingDetailChange(ctx, target, refCode = null) {
    ctx.resolvedIntent = 'RESCHEDULE_APPOINTMENT'
    const refLabel = refCode || (ctx.state.lang === 'fil' ? 'kasama ang reference code mo' : 'with your reference code')
    const detail = ctx.label(`detail_${target}`)
    if (target === 'location') ctx.say('change_venue_guide')
    else ctx.say('change_booking_detail_guide', { detail, refLabel })
    setHandoff(ctx, {
      reason: target === 'location' ? 'change_venue' : 'edit_booking_detail',
      topic: `Update ${detail} on Page`,
      draft: `Hi ${business.artist}! I want to update the ${detail} for my booking (${refCode || 'Ref Code: '}). Updated ${detail}: `,
    })
  }

  function replyForgotReference(ctx) {
    ctx.state.flow = null
    ctx.say('forgot_reference_guide')
    setHandoff(ctx, {
      reason: 'forgot_reference',
      topic: 'Help find booking reference code on Page',
      draft: `Hi ${business.artist}! I forgot or lost my booking reference code. Could you help me check my booking? Name, event date & mobile number: `,
    })
  }

  function replyEarlyCallTime(ctx, slotLike = ctx.nlu.entities) {
    const timeLabel = slotLike?.time ? fmtTime(slotLike.time) : 'early call-time'
    const svc = slotLike?.service ? services.find((x) => x.key === slotLike.service) : null
    const svcDraft = svc ? ` (${svc.name})` : ''
    const dateDraft = slotLike?.date ? ` on ${fmtDate(ctx, slotLike.date)}` : ''
    ctx.say('early_calltime_guide', { time: timeLabel })
    setHandoff(ctx, {
      reason: 'early_calltime',
      topic: 'Request early call-time / pre-opening slot on Page',
      draft: `Hi ${business.artist}! Could I request an early call-time at ${timeLabel}${svcDraft}${dateDraft}? Location: `,
    })
  }

  function setHandoff(ctx, { reason, topic, draft }) {
    ctx.handoff = {
      reason,
      topic,
      draft,
      businessName: business.name,
      artist: business.artist,
      messengerUrl: business.messengerUrl || null,
      portfolioUrl: business.portfolio || null,
      contact: business.contact || null,
    }
  }

  // ── routing ────────────────────────────────────────────────────────────────

  async function route(ctx) {
    const { state, nlu } = ctx

    if (matchesPhraseList(nlu.words, DISCARD_DRAFT_PHRASES)) {
      const hadAnything = Boolean(state.flow || state.pausedFlow || state.pending)
      state.flow = null
      state.pausedFlow = null
      state.pending = null
      clearRecentContext(state)
      ctx.resolvedIntent = 'RESET'
      return ctx.say(hadAnything ? 'draft_discarded' : 'nothing_to_reset')
    }

    if (!state.flow && state.pausedFlow && matchesPhraseList(nlu.words, RESUME_PHRASES)) {
      state.flow = state.pausedFlow
      state.pausedFlow = null
      state.pending = null
      ctx.resolvedIntent = state.flow.intent
      ctx.say('setup_resumed', { flow: ctx.label(`flow_${state.flow.intent}`) })
      return advance(ctx)
    }

    if (isReset(nlu.words)) {
      const hadFilled = hasFilledSetup(state.flow)
      if (hadFilled) {
        const paused = state.flow
        paused.confirming = false
        state.pausedFlow = paused
        state.flow = null
        state.pending = null
        ctx.resolvedIntent = 'RESET'
        return ctx.say('setup_paused', { flow: ctx.label(`flow_${paused.intent}`) })
      }
      const wasConfirming = state.flow?.confirming
      const hadSomething = state.flow || state.pending
      state.flow = null
      state.pending = null
      clearRecentContext(state)
      ctx.resolvedIntent = 'RESET'
      return ctx.say(wasConfirming ? 'action_aborted' : hadSomething ? 'reset_done' : 'nothing_to_reset')
    }

    if (state.pending) {
      const handled = await handlePending(ctx)
      if (handled) return
    }

    if (state.flow) return handleFlowTurn(ctx)

    // Out-of-flow explicit request to change a non-schedule booking detail (venue, mobile number, service, or name)
    const outDetailTarget =
      (hasWordIn(nlu.words, CHANGE_VERBS) || nlu.tags.includes('MOVE')) &&
      !nlu.entities.date &&
      !nlu.entities.time &&
      !nlu.words.some((w) => ['saan', 'where', 'nasaan', 'located', 'magkano', 'price', 'book', 'reserve'].includes(w))
        ? NON_SCHED_CHANGE_TARGETS.find((k) => CHANGE_WORDS[k].some((w) => nlu.words.includes(w)))
        : null
    if (outDetailTarget) {
      return replyBookingDetailChange(ctx, outDetailTarget, nlu.entities.reference)
    }

    if (isEarlyCallTime(nlu.words, nlu.entities, business)) {
      ctx.resolvedIntent = FLOW_INTENTS.includes(nlu.intent) ? nlu.intent : 'ASK_OPERATING_HOURS'
      return replyEarlyCallTime(ctx, nlu.entities)
    }

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
      const recent = state.recentContext
      const recentFresh = Boolean(recent?.updatedTurn && state.turn - recent.updatedTurn <= 4)
      const shouldInheritService =
        recentFresh &&
        recent.service &&
        !carried.service &&
        !nlu.entities.service &&
        (intent === 'BOOK_APPOINTMENT' || intent === 'CHECK_AVAILABILITY')
      const mergedCarried = shouldInheritService ? { service: recent.service, ...carried } : { ...carried }
      state.flow = newFlow(intent, mergedCarried)
      const { notes } = absorb(ctx, state.flow)
      if (shouldInheritService && intent === 'BOOK_APPOINTMENT') {
        ctx.say('remembered_service', { service: serviceName(mergedCarried.service) })
      }
      notes.forEach((n) => ctx.say(n.key, n.vars))
      answerSecondaryInfo(ctx, intent)
      return advance(ctx)
    }
    if (intent === 'CANNOT_ATTEND') {
      state.pending = { type: 'clarify', options: ['RESCHEDULE_APPOINTMENT', 'CANCEL_APPOINTMENT'], slots: {} }
      return ctx.say('cannot_attend')
    }
    if (INFO_INTENTS.has(intent)) {
      answerInfo(ctx, intent)
      answerSecondaryInfo(ctx, intent)
      return
    }
    return ctx.say(nlu.reason === 'out_of_scope' || nlu.reason === 'out_of_domain' ? 'out_of_scope' : 'unknown')
  }

  async function handleFlowTurn(ctx) {
    const { state, nlu } = ctx
    const f = state.flow
    ctx.resolvedIntent = f.intent

    if (isHesitationPause(nlu.words, nlu.entities)) {
      const paused = f
      paused.confirming = false
      state.pausedFlow = paused
      state.flow = null
      ctx.resolvedIntent = 'RESET'
      return ctx.say('setup_hesitation_paused', { flow: ctx.label(`flow_${paused.intent}`) })
    }

    if (f.confirming) {
      const yn = yesNo(nlu.words)
      if (yn === 'yes') return execute(ctx)
      if (yn === 'no') {
        f.confirming = false
        f.awaiting = 'change'
        return ctx.say('ask_change')
      }
    }

    if (f.awaiting === 'reference' && !nlu.entities.reference && hasWordIn(nlu.words, FORGOT_REF_WORDS)) {
      return replyForgotReference(ctx)
    }

    if (isEarlyCallTime(nlu.words, nlu.entities, business)) {
      f.slots.time = null
      f.awaiting = 'time'
      return replyEarlyCallTime(ctx, { ...f.slots, ...nlu.entities })
    }

    let changeRequested = false
    const wantsChange = f.awaiting === 'change' || hasWordIn(nlu.words, CHANGE_VERBS)
    if (wantsChange) {
      const target = Object.keys(CHANGE_WORDS).find((k) => CHANGE_WORDS[k].some((w) => nlu.words.includes(w)))
      // Inside RESCHEDULE after the booking is verified, requesting to edit contact/location/service/name
      // cannot be done via the date/time reschedule RPC -> guide to artist handoff cleanly instead of looping.
      if (
        f.intent === 'RESCHEDULE_APPOINTMENT' &&
        f.appointment &&
        target &&
        NON_SCHED_CHANGE_TARGETS.includes(target) &&
        !nlu.entities.date &&
        !nlu.entities.time
      ) {
        const ref = f.appointment.reference_code
        state.flow = null
        return replyBookingDetailChange(ctx, target, ref)
      }
      if (target && flowSlots(f.intent).has(target)) {
        f.slots[target] = null
        if (target === 'location') f.locationAsked = false
        if (target === 'date' || target === 'service') f.checked = null
        if (target === 'date') f.suggestedDate = null
        changeRequested = true
      }
    }

    // If the bot suggested an earliest/next valid date after too_soon or avail_none and user accepts or sends a time
    let acceptedSuggestion = false
    if (f.awaiting === 'date' && f.suggestedDate && !nlu.entities.date && !nlu.entities.dateInfo?.week) {
      if (yesNo(nlu.words) === 'yes' || nlu.entities.time || nlu.entities.timeInfo?.period) {
        f.slots.date = f.suggestedDate
        f.suggestedDate = null
        acceptedSuggestion = true
      }
    }

    const { filled, notes } = absorb(ctx, f)
    if (filled.length || notes.length || changeRequested || acceptedSuggestion) {
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
    const isAck =
      yesNo(nlu.words) === 'yes' ||
      (nlu.words.length > 0 && nlu.words.length <= 4 && nlu.words.every((w) => YES_WORDS.has(w) || YESNO_FILLER.has(w) || ACK_EXTRA_WORDS.has(w)))
    if (isAck) {
      f.misses = 0
      ctx.say('ack_prompt')
      return advance(ctx)
    }
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
        if (f.intent === 'CHECK_AVAILABILITY' && Array.isArray(e.dates) && e.dates.length >= 2) {
          const todayIso = manilaToday(ctx.nowDate)
          const futureDates = e.dates.filter((d) => compareIso(d, todayIso) >= 0)
          f.multiDates = futureDates.length >= 2 ? futureDates.slice(0, 3) : null
        } else {
          f.multiDates = null
        }
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
    const isRelationName = /^(?:(?:this\s+)?(?:booking\s+)?(?:is\s+)?)?(?:para\s+(?:kay|sa)|for\s+(?:my|the)|name\s+(?:ko|ni|ng)|pangalan\s+(?:ko|ni|ng))/i.test(ctx.nlu.original.trim())
    const isFreeText = !ctx.nlu.words.includes('?') && ctx.nlu.tags.every((t) => FREE_TEXT_TAGS.has(t))
    if (f.awaiting === 'name' && e.name && (isFreeText || (isRelationName && !INFO_INTENTS.has(ctx.nlu.intent)))) set('name', e.name)
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
    if (Array.isArray(f.multiDates) && f.multiDates.length >= 2) {
      const targetDates = f.multiDates
      f.multiDates = null
      const lines = []
      for (const d of targetDates) {
        const r = await call(ctx, 'getAvailableSlots', { date: d, serviceKey: s.service ?? null })
        if (!r.ok && (r.reason === 'unreachable' || r.reason === 'error')) {
          sayReason(ctx, r)
          ctx.state.flow = null
          return
        }
        if (!r.ok) {
          const msg =
            r.reason === 'too_soon'
              ? ctx.state.lang === 'fil'
                ? `hindi pa open online (min ${business.rules.minAdvanceDays} araw in advance)`
                : `requires ${business.rules.minAdvanceDays}-day advance notice`
              : ctx.state.lang === 'fil'
                ? 'hindi available'
                : 'unavailable'
          lines.push(`• ${fmtDate(ctx, d)}: ${msg}`)
        } else {
          const daySlots = r.data?.slots ?? []
          lines.push(`• ${fmtDate(ctx, d)}: ${daySlots.length ? fmtSlots(daySlots) : ctx.state.lang === 'fil' ? 'walang bakanteng slot' : 'fully booked'}`)
        }
      }
      s.date = null
      f.awaiting = 'date'
      return ctx.say('dual_date_avail_summary', { summary: lines.join('\n') })
    }
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
    if (!s.reference) {
      if (hasWordIn(ctx.nlu.words, FORGOT_REF_WORDS)) return replyForgotReference(ctx)
      return ask(ctx, 'ask_reference', 'reference')
    }
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
        const svcObj = services.find((x) => x.key === r.data.service_key)
        ctx.appointment = {
          reference_code: r.data.reference_code,
          service_key: r.data.service_key,
          service_name: r.data.service_name ?? serviceName(r.data.service_key),
          duration_minutes: r.data.duration_minutes ?? svcObj?.durationMinutes ?? 120,
          date: r.data.date,
          time: r.data.time,
          client_name: r.data.client_name ?? null,
          location: r.data.location ?? null,
          status: r.data.status,
        }
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
      if (r.reason === 'too_soon') {
        if (r.data?.min_date && actions && typeof actions.getAvailableSlots === 'function') {
          try {
            const minRes = await actions.getAvailableSlots({ date: r.data.min_date, serviceKey: serviceKey ?? null })
            if (minRes?.ok && minRes.data?.slots?.length) {
              f.suggestedDate = r.data.min_date
              ctx.say('nearest_date_slots', { date: fmtDate(ctx, r.data.min_date), slots: fmtSlots(minRes.data.slots) })
            }
          } catch {
            // Side peek is advisory only; fall through to standard prompt.
          }
        }
        if (business.rules?.sameDayRushNote) {
          ctx.say('rush_booking_note')
          const svcLabel = serviceKey ? ` for ${serviceName(serviceKey)}` : ''
          setHandoff(ctx, {
            reason: 'rush_inquiry',
            topic: 'Rush / short-notice slot inquiry',
            draft: `Hi ${business.artist}! I want to ask if a rush or short-notice slot on ${fmtDate(ctx, date)}${svcLabel} is available.`,
          })
        }
      }
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
      if (actions && typeof actions.getAvailableSlots === 'function') {
        for (let offset = 1; offset <= 3; offset++) {
          const candidateDate = addDays(date, offset)
          try {
            const altRes = await actions.getAvailableSlots({ date: candidateDate, serviceKey: serviceKey ?? null })
            if (altRes?.ok && altRes.data?.slots?.length) {
              f.suggestedDate = candidateDate
              ctx.say('nearest_date_slots', { date: fmtDate(ctx, candidateDate), slots: fmtSlots(altRes.data.slots) })
              break
            }
          } catch {
            break
          }
        }
      }
      f.slots.date = null
      f.slots.time = null
      f.awaiting = 'date'
      return null
    }
    f.suggestedDate = null
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
        const svcObj = services.find((x) => x.key === s.service)
        const svcTitle = serviceName(s.service)
        const fDate = fmtDate(ctx, s.date)
        const fTime = fmtTime(s.time)
        ctx.appointment = {
          reference_code: r.data.reference_code,
          service_key: s.service,
          service_name: svcTitle,
          duration_minutes: svcObj?.durationMinutes ?? 120,
          date: s.date,
          time: s.time,
          client_name: s.name,
          client_contact: s.contact,
          location: s.location || null,
          status: 'confirmed',
        }
        ctx.state.flow = null
        ctx.state.pausedFlow = null
        clearRecentContext(ctx.state)
        ctx.say('booking_success', { ref: r.data.reference_code, service: svcTitle, date: fDate, time: fTime })
        if (isTieredPolicy(business.rules)) {
          const isWedding = ['bridal', 'wedding_package'].includes(s.service)
          const dpDetail = isWedding
            ? `${business.rules.weddingDownpaymentPercent ?? 40}% down payment + contract`
            : `${business.rules.eventDownpaymentPercent || '10% to 20%'} reservation fee`
          ctx.say('downpayment_handoff_note', { dpDetail })
        } else if (business.rules.reservationFee > 0 && business.rules.reservationFeeServices.includes(s.service)) {
          ctx.say('reservation_fee_reminder')
        }
        setHandoff(ctx, {
          reason: 'downpayment',
          topic: 'Confirm down payment on Page',
          draft: `Hi ${business.artist}! I booked ${svcTitle} on ${fDate} at ${fTime} (Ref: ${r.data.reference_code}, Name: ${s.name}, Mobile: ${s.contact}${s.location ? `, Venue: ${s.location}` : ''}). Sending this to confirm my down payment.`,
        })
        return
      }
      return recoverFromFailure(ctx, f, r)
    }

    if (f.intent === 'RESCHEDULE_APPOINTMENT') {
      const r = await call(ctx, 'rescheduleAppointment', { reference: s.reference, contact: s.contact, date: s.date, time: s.time })
      if (r.ok) {
        const orig = f.appointment
        const svcObj = services.find((x) => x.key === orig?.service_key)
        ctx.appointment = {
          reference_code: s.reference,
          service_key: orig?.service_key ?? null,
          service_name: orig?.service_name ?? serviceName(orig?.service_key),
          duration_minutes: orig?.duration_minutes ?? svcObj?.durationMinutes ?? 120,
          date: s.date,
          time: s.time,
          client_name: orig?.client_name ?? null,
          location: orig?.location ?? null,
          status: 'rescheduled',
        }
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
    if (r.reason === 'too_soon' && business.rules?.sameDayRushNote) {
      ctx.say('rush_booking_note')
      setHandoff(ctx, {
        reason: 'rush_inquiry',
        topic: 'Rush / short-notice slot inquiry',
        draft: `Hi ${business.artist}! I want to ask if a short-notice slot${f.slots?.service ? ` for ${serviceName(f.slots.service)}` : ''} is possible.`,
      })
    }
    const s = f.slots
    switch (r.reason) {
      case 'slot_taken':
        f.checked = null
        s.time = null
        return advance(ctx)
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

  function sayInclusions(ctx) {
    const svc = services.find((x) => x.key === ctx.nlu.entities.service)
    if (svc) {
      ctx.say(svc.inclusions ? 'service_inclusions' : 'service_inclusions_none', {
        service: svc.name,
        price: responder.fmt.servicePrice(svc),
        inclusions: svc.inclusions || '',
      })
      setHandoff(ctx, {
        reason: 'custom_package',
        topic: `Ask about ${svc.name} details on Page`,
        draft: `Hi ${business.artist}! I would like to ask more about ${svc.name} (inclusions / custom requests).`,
      })
      return
    }
    ctx.say('package_inclusions_list', { list: serviceInclusionsList() })
    setHandoff(ctx, {
      reason: 'custom_package',
      topic: 'Ask about package options on Page',
      draft: `Hi ${business.artist}! I would like to ask about your hair and makeup package inclusions and custom rates.`,
    })
  }

  function sayAdditionalHeads(ctx) {
    const hc = ctx.nlu.entities.headCount
    const svcKey = ctx.nlu.entities.service || ctx.state.recentContext?.service
    const svc = svcKey ? services.find((x) => x.key === svcKey) : null
    if (hc && business.additionalHeadPrice != null) {
      if (svc && svc.price != null) {
        const extra = hc.kind === 'total' ? Math.max(0, hc.count - 1) : hc.count
        const total = Number(svc.price) + extra * Number(business.additionalHeadPrice)
        ctx.say('additional_heads_quote_with_service', {
          service: svc.name,
          servicePrice: responder.fmt.servicePrice(svc),
          extra,
          total: responder.fmt.price(total),
        })
      } else {
        const total = hc.count * Number(business.additionalHeadPrice)
        ctx.say('additional_heads_quote', {
          count: hc.count,
          total: responder.fmt.price(total),
        })
      }
    } else if (hc && business.additionalHeadPrice == null) {
      ctx.say('additional_heads_unset_count', { count: hc.count })
    } else {
      ctx.say(business.additionalHeadPrice != null ? 'additional_heads_set' : 'additional_heads_unset')
    }
    const svcDraft = svc ? `${svc.name} + ` : ''
    const headDraft = hc ? `${hc.count} ${hc.kind === 'total' ? 'total heads' : 'additional head(s)'}` : 'additional heads / entourage members'
    setHandoff(ctx, {
      reason: 'additional_heads',
      topic: 'Get group / additional heads quote on Page',
      draft: `Hi ${business.artist}! I would like to ask for a quote for ${svcDraft}${headDraft}. Event date: `,
    })
  }

  function answerSecondaryInfo(ctx, primaryIntent) {
    const { nlu } = ctx
    const tags = new Set(nlu.tags ?? [])

    // 1. Price / additional heads / inclusions mentioned alongside booking, availability, location, or hours
    if (
      primaryIntent !== 'ASK_PRICE' &&
      primaryIntent !== 'ASK_SERVICES' &&
      tags.has('PRICE') &&
      !nlu.words.includes('consultation')
    ) {
      if (hasWordIn(nlu.words, HEAD_WORDS) || nlu.entities.headCount) {
        sayAdditionalHeads(ctx)
      } else {
        const svc = services.find((x) => x.key === nlu.entities.service)
        if (svc) {
          ctx.say('price_service', { service: svc.name, price: responder.fmt.servicePrice(svc) })
          if (business.rules.reservationFee > 0 && business.rules.reservationFeeServices.includes(svc.key)) {
            ctx.say('reservation_fee_note')
          }
        }
      }
    } else if (FLOW_INTENTS.includes(primaryIntent)) {
      if (hasWordIn(nlu.words, INCLUSION_WORDS)) sayInclusions(ctx)
      else if (hasWordIn(nlu.words, HEAD_WORDS) || nlu.entities.headCount) sayAdditionalHeads(ctx)
    }

    // 2. Explicit location question combined with price/services/hours/policy
    if (
      primaryIntent !== 'ASK_LOCATION' &&
      INFO_INTENTS.has(primaryIntent) &&
      tags.has('LOCATION')
    ) {
      if (hasTravelDetails(business)) {
        ctx.say('location_with_travel_note')
        if (!ctx.handoff) {
          setHandoff(ctx, {
            reason: 'travel_quote',
            topic: 'Request out-of-town / venue travel quote',
            draft: `Hi ${business.artist}! I would like to check if an out-of-town travel fee applies to our event venue. Venue & date: `,
          })
        }
      } else {
        ctx.say('location')
      }
    }

    // 3. Explicit operating hours question combined with another info inquiry
    if (
      primaryIntent !== 'ASK_OPERATING_HOURS' &&
      INFO_INTENTS.has(primaryIntent) &&
      hasWordIn(nlu.words, HOURS_EXPLICIT_WORDS)
    ) {
      ctx.say('hours')
    }

    // 4. Explicit policy / downpayment question combined with another info inquiry
    if (
      primaryIntent !== 'ASK_BOOKING_POLICY' &&
      INFO_INTENTS.has(primaryIntent) &&
      hasWordIn(nlu.words, POLICY_EXPLICIT_WORDS)
    ) {
      ctx.say(isTieredPolicy(business.rules) ? 'policy_tiered' : 'policy')
    }
  }

  function answerInfo(ctx, intent) {
    const { nlu } = ctx
    switch (intent) {
      case 'ASK_PRICE': {
        if (nlu.words.includes('consultation')) return ctx.say(business.consultationFee != null ? 'consultation_fee_set' : 'consultation_fee', { list: serviceList() })
        if (hasWordIn(nlu.words, HEAD_WORDS)) return sayAdditionalHeads(ctx)
        if (hasWordIn(nlu.words, INCLUSION_WORDS)) return sayInclusions(ctx)
        const svc = services.find((x) => x.key === nlu.entities.service)
        if (svc) {
          ctx.say('price_service', { service: svc.name, price: responder.fmt.servicePrice(svc) })
          if (business.rules.reservationFee > 0 && business.rules.reservationFeeServices.includes(svc.key)) ctx.say('reservation_fee_note')
          return
        }
        return ctx.say('price_list', { list: serviceList() })
      }
      case 'ASK_SERVICES':
        if (hasWordIn(nlu.words, INCLUSION_WORDS)) return sayInclusions(ctx)
        return ctx.say('services', { list: serviceList() })
      case 'ASK_LOCATION':
        if (hasTravelDetails(business)) {
          ctx.say('location_with_travel_note')
          setHandoff(ctx, {
            reason: 'travel_quote',
            topic: 'Request out-of-town / venue travel quote',
            draft: `Hi ${business.artist}! I would like to check if an out-of-town travel fee applies to our event venue. Venue & date: `,
          })
          return
        }
        return ctx.say('location')
      case 'ASK_OPERATING_HOURS':
        return ctx.say('hours')
      case 'ASK_BOOKING_POLICY':
        return ctx.say(isTieredPolicy(business.rules) ? 'policy_tiered' : 'policy')
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
        if (best.id === 'inclusions') return sayInclusions(ctx)
        if (best.id === 'additional_heads') return sayAdditionalHeads(ctx)
        if (best.id === 'travel_fee') {
          ctx.say(hasTravelDetails(business) ? 'faq_travel_fee_note' : 'faq_travel_fee')
          setHandoff(ctx, {
            reason: 'travel_quote',
            topic: 'Request out-of-town travel quote on Page',
            draft: `Hi ${business.artist}! I want to ask for the out-of-town / transpo fee for my event venue. Venue & date: `,
          })
          return
        }
        if (best.id === 'home_service') {
          ctx.say(hasTravelDetails(business) ? 'faq_home_service_note' : 'faq_home_service')
          setHandoff(ctx, {
            reason: 'travel_quote',
            topic: 'Ask about on-location service & venue fee',
            draft: `Hi ${business.artist}! I want to inquire about on-location service for our venue. Location & event date: `,
          })
          return
        }
        if (best.id === 'payment' && isTieredPolicy(business.rules)) {
          ctx.say('faq_payment_tiered')
          setHandoff(ctx, {
            reason: 'downpayment',
            topic: 'Send payment proof / inquire on Page',
            draft: `Hi ${business.artist}! I would like to ask about payment details or send my reservation payment.`,
          })
          return
        }
        if (best.id === 'confirmation' && isTieredPolicy(business.rules)) {
          return ctx.say('faq_confirmation_tiered')
        }
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
