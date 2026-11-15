import { describe, it, expect } from 'vitest'
import { computeBookingCompletion } from '../src/lib/bookingFunnel.js'

const t = (min) => new Date(Date.UTC(2026, 10, 20, 0, min)).toISOString()
const row = (session_id, min, extra = {}) => ({ session_id, created_at: t(min), bot_reply: '', entities: {}, ...extra })
const flow = (step) => ({ flow_intent: 'BOOK_APPOINTMENT', flow_step: step })

describe('computeBookingCompletion', () => {
  it('counts started and completed sessions and the rate', () => {
    const rows = [
      row('a', 0, { intent_classified: 'BOOK_APPOINTMENT', entities: flow('service') }),
      row('a', 2, { intent_classified: 'BOOK_APPOINTMENT', entities: { ...flow(null), action: { name: 'bookAppointment', ok: true } } }),
      row('b', 0, { intent_classified: 'BOOK_APPOINTMENT', entities: flow('service') }),
      row('b', 1, { intent_classified: 'BOOK_APPOINTMENT', entities: flow('date') }),
      row('c', 0, { intent_classified: 'ASK_PRICE' }),
    ]
    const r = computeBookingCompletion(rows)
    expect(r.started).toBe(2)
    expect(r.completed).toBe(1)
    expect(r.rate).toBe(50)
    expect(r.medianMinutes).toBe(2)
  })

  it('builds the funnel from logged steps; a booked session reaches every step', () => {
    const rows = [
      row('a', 0, { intent_classified: 'BOOK_APPOINTMENT', entities: { ...flow('service'), action: { name: 'bookAppointment', ok: true } } }),
      row('b', 0, { intent_classified: 'BOOK_APPOINTMENT', entities: flow('date') }),
    ]
    const f = computeBookingCompletion(rows).funnel
    expect(f.find((s) => s.step === 'service').count).toBe(2)
    expect(f.find((s) => s.step === 'date').count).toBe(2)
    expect(f.find((s) => s.step === 'time').count).toBe(1)
    expect(f.find((s) => s.step === 'booked').count).toBe(1)
  })

  it('counts failure reasons and accepts older logs with only a reference code', () => {
    const rows = [
      row('a', 0, { intent_classified: 'BOOK_APPOINTMENT', entities: { action: { name: 'bookAppointment', ok: false, reason: 'slot_taken' } } }),
      row('b', 0, { intent_classified: 'BOOK_APPOINTMENT', bot_reply: 'Booked! Code JAL-AB12C' }),
    ]
    const r = computeBookingCompletion(rows)
    expect(r.failures).toEqual({ slot_taken: 1 })
    expect(r.completed).toBe(1)
  })

  it('ignores sessions that started before the "since" date', () => {
    const rows = [row('old', 0, { intent_classified: 'BOOK_APPOINTMENT' })]
    expect(computeBookingCompletion(rows, { since: '2026-12-01' }).started).toBe(0)
    expect(computeBookingCompletion(rows, { since: '2026-11-01' }).started).toBe(1)
  })
})
