import { describe, it, expect, vi } from 'vitest'
import { createJAlgorithm } from '../src/jalgorithm/index.js'
import { BENEFICIARY_PRESET_TREV_LUNA } from '../src/jalgorithm/config/business.js'
import { toCatalog } from '../src/services/businessInfo.js'

// Thursday 12 Nov 2026, 10:00 Manila. Earliest bookable date (3-day rule, enforced by the mock) = Nov 15.
const NOW = new Date('2026-11-12T02:00:00Z')
const SLOTS = ['09:00', '10:00', '13:00', '14:00', '15:00']
const APPT = { reference_code: 'JAL-7K3QX', service_key: 'bridal', service_name: 'Bridal Makeup (full)', date: '2026-11-20', time: '10:00', status: 'confirmed' }

function mockActions(overrides = {}) {
  return {
    getAvailableSlots: vi.fn(async ({ date }) =>
      date < '2026-11-15' ? { ok: false, reason: 'too_soon', data: { min_date: '2026-11-15' } } : { ok: true, data: { slots: SLOTS } }),
    bookAppointment: vi.fn(async () => ({ ok: true, data: { reference_code: 'JAL-ABCDE' } })),
    findAppointment: vi.fn(async ({ reference, contact }) =>
      reference === 'JAL-7K3QX' && contact === '09171234567' ? { ok: true, data: APPT } : { ok: false, reason: 'not_found' }),
    rescheduleAppointment: vi.fn(async () => ({ ok: true })),
    cancelAppointment: vi.fn(async () => ({ ok: true })),
    ...overrides,
  }
}

async function chat(messages, actions = mockActions()) {
  const bot = createJAlgorithm({ actions, now: () => NOW })
  let state = bot.initialState()
  const turns = []
  for (const m of messages) {
    const r = await bot.processMessage(m, state)
    state = r.state
    turns.push(r)
  }
  return { turns, state, actions, last: turns[turns.length - 1] }
}

describe('availability follow-ups', () => {
  it('understands "3pm sana" as the time for the pending availability check', async () => {
    const { turns, last } = await chat(['May available ba sa lunes?', '3pm sana'])
    expect(turns[0].intent).toBe('CHECK_AVAILABILITY')
    expect(turns[0].reply).toMatch(/Anong oras/)
    expect(turns[0].state.flow.awaiting).toBe('time')
    expect(last.intent).toBe('CHECK_AVAILABILITY')
    expect(last.reply).toMatch(/3:00 PM/)
    expect(last.reply).toMatch(/Available po/)
  })

  it('reports the 3-day rule from the booking service instead of inventing availability', async () => {
    const { last } = await chat(['may available ba bukas?'])
    expect(last.reply).toMatch(/3 araw in advance/)
    expect(last.reply).toMatch(/Nov 15/)
    expect(last.state.flow.awaiting).toBe('date')
  })

  it('offers to book an available slot and carries date/time into the booking', async () => {
    const { last } = await chat(['available ba sa lunes ng 2pm?', 'oo', 'bridal'])
    expect(last.intent).toBe('BOOK_APPOINTMENT')
    expect(last.state.flow.slots).toMatchObject({ date: '2026-11-16', time: '14:00', service: 'bridal' })
    expect(last.reply).toMatch(/pangalan/)
  })

  it('suggests alternatives when the requested time is taken', async () => {
    const { last } = await chat(['may slot ba sa lunes ng 5pm?'])
    expect(last.reply).toMatch(/hindi available ang 5:00 PM/)
    expect(last.reply).toMatch(/9:00 AM/)
  })
})

describe('booking flow', () => {
  it('collects missing details one at a time and only confirms after the action succeeds', async () => {
    const { turns, actions, last } = await chat([
      'Gusto ko magpa-appointment.',
      'bridal',
      'next week friday',
      'Kahit 2pm.',
      'Maria Santos',
      '09171234567',
      'skip',
      'oo',
    ])
    expect(turns[0].reply).toMatch(/Anong service/)
    expect(turns[1].reply).toMatch(/Anong date/)
    expect(turns[2].reply).toMatch(/Available na oras/)
    expect(turns[3].reply).toMatch(/pangalan/)
    expect(turns[4].reply).toMatch(/mobile number/)
    expect(turns[5].reply).toMatch(/venue/)
    expect(turns[6].reply).toMatch(/Paki-confirm/)
    expect(actions.bookAppointment).toHaveBeenCalledWith({
      serviceKey: 'bridal', date: '2026-11-20', time: '14:00', name: 'Maria Santos', contact: '09171234567', location: null,
    })
    expect(last.reply).toMatch(/JAL-ABCDE/)
    expect(last.state.flow).toBeNull()
  })

  it('does not ask again for information given up front', async () => {
    const { turns } = await chat(['pa book po ng hair and makeup sa nov 20 ng 10am'])
    expect(turns[0].state.flow.slots).toMatchObject({ service: 'hair_makeup', date: '2026-11-20', time: '10:00' })
    expect(turns[0].reply).toMatch(/pangalan/)
  })

  it('handles corrections at the confirmation step', async () => {
    const { turns, actions } = await chat([
      'book bridal sa nov 20 ng 10am', 'Ana Cruz', '09171234567', 'skip', 'hindi', 'oras', 'ay 1pm pala', 'oo',
    ])
    expect(turns[4].reply).toMatch(/palitan/)
    expect(turns[6].reply).toMatch(/1:00 PM/)
    expect(actions.bookAppointment).toHaveBeenCalledWith(expect.objectContaining({ time: '13:00' }))
  })

  it('accepts a direct correction without saying no first', async () => {
    const { last } = await chat(['book bridal sa nov 20 ng 10am', 'Ana Cruz', '09171234567', 'skip', '2pm na lang pala'])
    expect(last.reply).toMatch(/Paki-confirm/)
    expect(last.state.flow.slots.time).toBe('14:00')
  })

  it('answers an unrelated question mid-flow and then resumes', async () => {
    const { last } = await chat(['book bridal sa nov 20 ng 10am', 'magkano bridal?'])
    expect(last.reply).toMatch(/PHP 3,500/)
    expect(last.reply).toMatch(/Balik tayo/)
    expect(last.reply).toMatch(/pangalan/)
    expect(last.state.flow.slots.name).toBeNull()
  })

  it('never claims success when the booking fails', async () => {
    const actions = mockActions({ bookAppointment: vi.fn(async () => ({ ok: false, reason: 'slot_taken' })) })
    const { last } = await chat(['book bridal sa nov 20 ng 10am', 'Ana Cruz', '09171234567', 'skip', 'yes'], actions)
    expect(last.reply).not.toMatch(/Booked|booked/)
    expect(last.reply).toMatch(/may nakakuha na|just taken/)
    expect(last.state.flow.awaiting).toBe('time')
  })

  it('keeps the details for a retry when the booking system is unreachable', async () => {
    const actions = mockActions({ bookAppointment: vi.fn(async () => ({ ok: false, reason: 'unreachable' })) })
    const { last } = await chat(['book bridal sa nov 20 ng 10am', 'Ana Cruz', '09171234567', 'skip', 'yes'], actions)
    expect(last.reply).toMatch(/booking system/)
    expect(last.state.flow.confirming).toBe(true)
  })

  it('works with no booking backend at all (offline): FAQ still answers, booking says it is unavailable', async () => {
    const bot = createJAlgorithm({ actions: null, now: () => NOW })
    const faq = await bot.processMessage('magkano bridal?', bot.initialState())
    expect(faq.reply).toMatch(/3,500/)
    const r = await bot.processMessage('may available ba sa lunes?', bot.initialState())
    expect(r.reply).toMatch(/booking system/)
    expect(r.state.flow).toBeNull()
  })

  it('resets on request', async () => {
    const { last } = await chat(['pa book po', 'wag na lang'])
    expect(last.state.flow).toBeNull()
    expect(last.reply).toMatch(/itinigil/)
  })

  it('asks whether "cancel" during a booking means stopping or cancelling an appointment', async () => {
    const { turns } = await chat(['mgpapa sched sana aq', 'cancel q n lng appointment q', '2'])
    expect(turns[1].reply).toMatch(/\(1\).*\(2\)/s)
    expect(turns[2].intent).toBe('CANCEL_APPOINTMENT')
    expect(turns[2].reply).toMatch(/reference code/)
  })
})

describe('existing appointments', () => {
  it('reschedules with reference + contact, using a date given in the first message', async () => {
    const { turns, actions, last } = await chat([
      'pa move ng appointment ko sa nov 21 ng 2pm', 'JAL-7K3QX', '09171234567', 'opo',
    ])
    expect(turns[0].intent).toBe('RESCHEDULE_APPOINTMENT')
    expect(turns[2].reply).toMatch(/Nahanap ko po/)
    expect(turns[2].reply).toMatch(/Paki-confirm po ang reschedule/)
    expect(actions.rescheduleAppointment).toHaveBeenCalledWith({ reference: 'JAL-7K3QX', contact: '09171234567', date: '2026-11-21', time: '14:00' })
    expect(last.reply).toMatch(/Done po/)
  })

  it('does not reveal anything when the reference and number do not match', async () => {
    const { turns } = await chat(['cancel my booking', 'JAL-ZZZZZ', '09170000000'])
    expect(turns[2].reply).toMatch(/couldn't find/)
    expect(turns[2].reply).not.toMatch(/Bridal/)
  })

  it('handles "can\'t attend" with a reschedule-or-cancel question', async () => {
    const { turns, actions } = await chat(['d q mkapunta bukas', '2', 'jal-7k3qx', '09171234567', 'opo'])
    expect(turns[0].reply).toMatch(/i-reschedule o .*i-cancel/)
    expect(turns[3].reply).toMatch(/I-cancel ang appointment JAL-7K3QX/)
    expect(actions.cancelAppointment).toHaveBeenCalledOnce()
    expect(turns[4].reply).toMatch(/Na-cancel/)
  })

  it('shows appointment details for VIEW', async () => {
    const { last } = await chat(['when is my appointment?', 'JAL-7K3QX', '09171234567'])
    expect(last.reply).toMatch(/Bridal Makeup \(full\)/)
    expect(last.reply).toMatch(/Status: confirmed/)
  })
})

describe('informational intents and fallbacks', () => {
  it('answers in the user\'s language', async () => {
    const en = await chat(['where are you located?'])
    expect(en.last.reply).toMatch(/is based in Olongapo/)
    const fil = await chat(['san loc nyo?'])
    expect(fil.last.reply).toMatch(/nasa Olongapo/)
  })
  it('does not invent a consultation fee', async () => {
    const { last } = await chat(['hm po cons?'])
    expect(last.reply).toMatch(/Wala po akong record ng consultation fee/)
  })
  it('refuses unrelated messages politely', async () => {
    const { last } = await chat(['what is the weather today'])
    expect(last.intent).toBe('UNKNOWN_INTENT')
    expect(last.reply).toMatch(/only help with appointments/)
  })
  it('ignores empty input', async () => {
    const bot = createJAlgorithm({ now: () => NOW })
    const r = await bot.processMessage('   ', bot.initialState())
    expect(r.reply).toBe('')
  })
  it('produces a JSON-serializable state', async () => {
    const { state } = await chat(['pa book po ng bridal'])
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })
})

describe('beneficiary interview dialogue features (Trev Luna preset)', () => {
  const trevCatalog = toCatalog({
    profile: BENEFICIARY_PRESET_TREV_LUNA.profile,
    services: BENEFICIARY_PRESET_TREV_LUNA.services,
    settings: BENEFICIARY_PRESET_TREV_LUNA.settings,
  })

  it('answers service inclusions and attaches Page handoff metadata', async () => {
    const bot = createJAlgorithm({ catalog: trevCatalog, now: () => NOW })
    const r1 = await bot.processMessage('ano inclusion ng bridal makeup?', bot.initialState())
    expect(r1.reply).toMatch(/Bridal Makeup/)
    expect(r1.reply).toMatch(/Full skin prep/)
    expect(r1.handoff?.topic).toMatch(/Bridal/)

    const r2 = await bot.processMessage('what are the inclusions of your packages?', bot.initialState())
    expect(r2.reply).toMatch(/Everyday Glam/)
    expect(r2.reply).toMatch(/Special Events/)
  })

  it('quotes additional heads rate and triggers group quote handoff', async () => {
    const bot = createJAlgorithm({ catalog: trevCatalog, now: () => NOW })
    const r = await bot.processMessage('how much additional heads?', bot.initialState())
    expect(r.reply).toMatch(/PHP 1,000/)
    expect(r.handoff?.reason).toBe('additional_heads')
  })

  it('explains inclusive vs. out-of-town travel areas and triggers travel quote handoff', async () => {
    const bot = createJAlgorithm({ catalog: trevCatalog, now: () => NOW })
    const rLoc = await bot.processMessage('where are you located?', bot.initialState())
    expect(rLoc.reply).toMatch(/Subic Bay/)
    expect(rLoc.reply).toMatch(/Clark/)
    expect(rLoc.handoff?.reason).toBe('travel_quote')

    const rFee = await bot.processMessage('may travel fee ba sa clark?', bot.initialState())
    expect(rFee.reply).toMatch(/Subic Bay/)
    expect(rFee.reply).toMatch(/toll fees|out-of-town/i)
    expect(rFee.handoff?.reason).toBe('travel_quote')
  })

  it('explains tiered wedding and event down payment and cancellation rules', async () => {
    const bot = createJAlgorithm({ catalog: trevCatalog, now: () => NOW })
    const r = await bot.processMessage('what is your booking policy?', bot.initialState())
    expect(r.reply).toMatch(/7 days/)
    expect(r.reply).toMatch(/40%/)
    expect(r.reply).toMatch(/30 days/)
    expect(r.reply).toMatch(/10% to 20%/)
    expect(r.reply).toMatch(/3 days/)
  })

  it('returns appointment metadata and down payment handoff on booking success, and rush note when too soon', async () => {
    const actions = mockActions({
      getAvailableSlots: vi.fn(async ({ date }) =>
        date < '2026-11-19' ? { ok: false, reason: 'too_soon', data: { min_date: '2026-11-19' } } : { ok: true, data: { slots: SLOTS } }),
    })
    const bot = createJAlgorithm({ catalog: trevCatalog, actions, now: () => NOW })

    // Too soon triggers rush note and handoff
    const rSoon = await bot.processMessage('check slots bukas', bot.initialState())
    expect(rSoon.reply).toMatch(/Same-day or on-the-day rush bookings/i)
    expect(rSoon.handoff?.reason).toBe('rush_inquiry')

    // Full booking returns appointment & downpayment handoff
    let state = bot.initialState()
    const msgs = ['book bridal sa nov 20 ng 10am', 'Maria Santos', '09171234567', 'Subic Bay Harbor Hotel', 'yes']
    let last = null
    for (const m of msgs) {
      last = await bot.processMessage(m, state)
      state = last.state
    }
    expect(last.reply).toMatch(/JAL-ABCDE/)
    expect(last.reply).toMatch(/40% down payment/)
    expect(last.appointment).toMatchObject({
      reference_code: 'JAL-ABCDE',
      service_key: 'bridal',
      date: '2026-11-20',
      time: '10:00',
      location: 'Subic Bay Harbor Hotel',
    })
    expect(last.handoff?.reason).toBe('downpayment')
    expect(last.handoff?.draft).toContain('JAL-ABCDE')
    expect(last.handoff?.draft).toContain('Subic Bay Harbor Hotel')
  })

  it('quotes range and price-may-vary service rates in ASK_PRICE replies', async () => {
    const customCatalog = {
      ...trevCatalog,
      services: trevCatalog.services.map((s) =>
        s.key === 'bridal'
          ? { ...s, price: 3500, priceMode: 'range', priceMax: 5500, priceNote: 'Depending on peg' }
          : s.key === 'event_makeup'
            ? { ...s, price: 2000, priceMode: 'varies', priceNote: 'Rates vary by scope' }
            : s,
      ),
    }
    const bot = createJAlgorithm({ catalog: customCatalog, now: () => NOW })

    const rRange = await bot.processMessage('magkano ang bridal makeup?', bot.initialState())
    expect(rRange.reply).toMatch(/3,500 - 5,500/)
    expect(rRange.reply).toMatch(/Depending on peg/)

    const rVaries = await bot.processMessage('how much for debut makeup?', bot.initialState())
    expect(rVaries.reply).toMatch(/Price varies.*PHP 2,000/i)
    expect(rVaries.reply).toMatch(/Rates vary by scope/)
  })

  it('avoids duplicate PHP prefix when price is 0 (varies mode), handles mid-flow okay, pauses/resumes drafts, and uses replyContext', async () => {
    const variesCatalog = {
      ...trevCatalog,
      services: trevCatalog.services.map((s) =>
        s.key === 'bridal'
          ? { ...s, price: 0, priceMode: 'varies', priceNote: '5000-7000 depending on scope' }
          : s,
      ),
    }
    const bot = createJAlgorithm({ catalog: variesCatalog, actions: mockActions(), now: () => NOW })

    // 1. Price wording without "PHP varies"
    const rZeroVaries = await bot.processMessage('how much bridal makeup?', bot.initialState())
    expect(rZeroVaries.reply).not.toMatch(/PHP varies/i)
    expect(rZeroVaries.reply).toMatch(/Price varies/i)

    // 2. Mid-flow "okay" re-prompts cleanly without "Sorry, I didn't get that"
    const rBookStart = await bot.processMessage('I want to book bridal makeup', bot.initialState())
    expect(rBookStart.state.flow.awaiting).toBe('date')
    const rAck = await bot.processMessage('okay', rBookStart.state)
    expect(rAck.reply).not.toMatch(/Sorry, I didn't get that/i)
    expect(rAck.state.flow.awaiting).toBe('date')

    // 3. "ayaw ko na" pauses instead of deleting filled setup, then "resume" restores it, then "discard draft" clears it
    const rPaused = await bot.processMessage('ayaw ko na', rAck.state)
    expect(rPaused.state.flow).toBeNull()
    expect(rPaused.state.pausedFlow).toBeTruthy()
    expect(rPaused.state.pausedFlow.slots.service).toBe('bridal')

    const rResumed = await bot.processMessage('resume', rPaused.state)
    expect(rResumed.state.flow).toBeTruthy()
    expect(rResumed.state.flow.slots.service).toBe('bridal')
    expect(rResumed.state.pausedFlow).toBeNull()

    const rPausedAgain = await bot.processMessage('pause', rResumed.state)
    expect(rPausedAgain.state.pausedFlow).toBeTruthy()
    const rDiscarded = await bot.processMessage('discard draft', rPausedAgain.state)
    expect(rDiscarded.state.pausedFlow).toBeNull()

    // 4. Replying "how much" to a Bridal message inherits service context
    const rReplyPrice = await bot.processMessage('how much?', bot.initialState(), {
      replyContext: { text: 'Bridal Makeup Full Package', serviceKey: 'bridal', intent: 'ASK_SERVICES' },
    })
    expect(rReplyPrice.intent).toBe('ASK_PRICE')
    expect(rReplyPrice.reply).toMatch(/Bridal/i)
    expect(rReplyPrice.reply).toMatch(/5000-7000/)
  })
})

describe('smarter NLU, memory & JAL identity', () => {
  it('introduces itself as JAL in welcome and greeting messages', async () => {
    const bot = createJAlgorithm({ actions: mockActions(), now: () => NOW })
    expect(bot.welcome('en')).toMatch(/\bJAL\b/)
    expect(bot.welcome('fil')).toMatch(/\bJAL\b/)
    const hiEn = await bot.processMessage('hello', bot.initialState())
    expect(hiEn.reply).toMatch(/\bJAL\b/)
    const hiFil = await bot.processMessage('hi po kumusta', bot.initialState())
    expect(hiFil.reply).toMatch(/\bJAL\b/)
  })

  it('remembers service context from an FAQ turn into a following booking turn', async () => {
    const { turns } = await chat([
      'Magkano bridal makeup?',
      'Pa-book po sa Nov 20 10am',
    ])
    expect(turns[0].intent).toBe('ASK_PRICE')
    expect(turns[0].reply).toMatch(/3,500/)
    expect(turns[1].intent).toBe('BOOK_APPOINTMENT')
    expect(turns[1].state.flow.slots.service).toBe('bridal')
    expect(turns[1].state.flow.slots.date).toBe('2026-11-20')
    expect(turns[1].state.flow.slots.time).toBe('10:00')
    expect(turns[1].reply).toMatch(/pangalan/)
  })

  it('computes group additional-head estimates when additionalHeadPrice is configured', async () => {
    const trevCatalog = toCatalog(BENEFICIARY_PRESET_TREV_LUNA)
    const catalogWithHeadPrice = {
      ...trevCatalog,
      business: { ...trevCatalog.business, additionalHeadPrice: 1500, additionalHeadNote: 'Includes hair & makeup.' },
    }
    const bot = createJAlgorithm({ catalog: catalogWithHeadPrice, actions: mockActions(), now: () => NOW })
    const res = await bot.processMessage('Magkano bridal with 3 additional heads?', bot.initialState())
    expect(res.reply).toMatch(/9,500/)
    expect(res.reply).toMatch(/3 additional head/)
    expect(res.handoff?.draft).toMatch(/3 additional head/i)
  })

  it('answers compound multi-question inquiries (price + location) in one reply', async () => {
    const { last } = await chat(['Magkano bridal makeup at saan po location ninyo?'])
    expect(last.reply).toMatch(/3,500/)
    expect(last.reply).toMatch(/Olongapo/)
  })

  it('proactively suggests earliest valid slots on too_soon and lets client accept with a time', async () => {
    const { turns } = await chat([
      'May available ba bukas?',
      '10am',
      'oo',
    ])
    expect(turns[0].reply).toMatch(/Nov 15/)
    expect(turns[0].reply).toMatch(/9:00 AM/)
    expect(turns[1].state.pending).toMatchObject({ type: 'offer_book', slots: { date: '2026-11-15', time: '10:00' } })
    expect(turns[1].reply).toMatch(/Available po ang 10:00 AM/i)
    expect(turns[2].intent).toBe('BOOK_APPOINTMENT')
    expect(turns[2].state.flow.slots.date).toBe('2026-11-15')
  })

  it('allows direct mid-flow slot editing before reaching confirmation and handles venue/number change requests', async () => {
    const bot = createJAlgorithm({ actions: mockActions(), now: () => NOW })

    const editStart = await bot.processMessage('book bridal sa nov 20 10am', bot.initialState())
    const editDate = await bot.processMessage('change date', editStart.state)
    expect(editDate.state.flow.slots.date).toBeNull()
    expect(editDate.state.flow.awaiting).toBe('date')
    expect(editDate.reply).toMatch(/What date|Anong date/i)

    const venueGuide = await bot.processMessage('chaneg my loc for JAL-7K3QX', bot.initialState())
    expect(venueGuide.reply).toMatch(/venue|location/i)
    expect(venueGuide.handoff?.reason).toBe('change_venue')

    const numGuide = await bot.processMessage('change numb', bot.initialState())
    expect(numGuide.reply).toMatch(/mobile number/i)
    expect(numGuide.handoff?.reason).toBe('edit_booking_detail')
  })

  it('guides clients cleanly when requesting a number update mid-reschedule after booking lookup', async () => {
    const midReschedNum = await chat([
      'reschedule my appointment',
      'JAL-7K3QX',
      '09171234567',
      'change number',
    ])
    expect(midReschedNum.last.reply).not.toMatch(/didn't get that/i)
    expect(midReschedNum.last.reply).toMatch(/JAL-7K3QX/)
    expect(midReschedNum.last.reply).toMatch(/mobile number/i)
    expect(midReschedNum.last.handoff?.draft).toMatch(/JAL-7K3QX/)
  })
})

describe('multi-style NLU and real-world salon scenarios', () => {
  it('routes forgot-reference-code messages to Page Handoff without looping on ask_reference', async () => {
    const { last } = await chat(['check my booking', 'nakalimutan ko ref code ko'])
    expect(last.reply).not.toMatch(/Pakisend po ang booking reference/i)
    expect(last.reply).toMatch(/Page handoff/i)
    expect(last.handoff?.reason).toBe('forgot_reference')
    expect(last.state.flow).toBeNull()
  })

  it('checks availability for both dates when asked dual-date availability', async () => {
    const { turns } = await chat([
      'May available ba sa Nov 20 o Nov 21?',
      'nov 20',
    ])
    expect(turns[0].intent).toBe('CHECK_AVAILABILITY')
    expect(turns[0].reply).toMatch(/Nov 20/)
    expect(turns[0].reply).toMatch(/Nov 21/)
    expect(turns[0].state.flow?.awaiting).toBe('date')
    expect(turns[1].state.flow?.slots.date).toBe('2026-11-20')
  })

  it('extracts attendee name cleanly when booking for someone else', async () => {
    const { turns, actions } = await chat([
      'book bridal sa nov 20 10am',
      'para kay Maria Santos',
      '09171234567',
      'skip',
      'oo',
    ])
    expect(turns[1].state.flow.slots.name).toBe('Maria Santos')
    expect(turns[3].reply).toMatch(/Maria Santos/)
    expect(actions.bookAppointment).toHaveBeenCalledWith(expect.objectContaining({ name: 'Maria Santos' }))
  })

  it('pauses the flow warmly on mid-flow hesitation and resumes later', async () => {
    const { turns } = await chat([
      'book bridal sa nov 20 10am',
      'wait lang tanong ko muna kay mama',
      'resume',
      'Ana Cruz',
    ])
    expect(turns[1].reply).not.toMatch(/hindi ko nakuha|didn't get/i)
    expect(turns[1].reply).toMatch(/resume|ituloy/i)
    expect(turns[1].state.flow).toBeNull()
    expect(turns[1].state.pausedFlow?.slots.service).toBe('bridal')
    expect(turns[2].reply).toMatch(/pangalan|name/i)
    expect(turns[3].state.flow?.slots.name).toBe('Ana Cruz')
  })

  it('handles pre-opening early call-time requests with operating hours note and Page Handoff', async () => {
    const { last } = await chat(['pwede ba 4am call time sa bridal?'])
    expect(last.reply).toMatch(/8:00 AM/)
    expect(last.reply).toMatch(/4:00 AM/)
    expect(last.handoff?.reason).toBe('early_calltime')
    expect(last.handoff?.draft).toMatch(/4:00 AM/)
  })

  it('understands Conyo and Jeje booking/inquiry phrasing in conversation', async () => {
    const conyoAvail = await chat(['avail p b tom?'])
    expect(conyoAvail.last.intent).toBe('CHECK_AVAILABILITY')

    const jejeBook = await chat(['pbook nmn aq ng bridal s dec 5 10am'])
    expect(jejeBook.last.intent).toBe('BOOK_APPOINTMENT')
    expect(jejeBook.last.state.flow?.slots).toMatchObject({ service: 'bridal', date: '2026-12-05', time: '10:00' })
  })
})
