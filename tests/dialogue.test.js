import { describe, it, expect, vi } from 'vitest'
import { createJAlgorithm } from '../src/jalgorithm/index.js'

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
