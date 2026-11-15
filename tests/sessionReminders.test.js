import { describe, it, expect } from 'vitest'
import {
  normalizeMobile,
  findSessionContact,
  collectReferenceContacts,
  appendReminderMessages,
} from '../src/lib/sessionReminders.js'

const session = (id, messages) => ({ id, messages, activityMeta: {}, state: {} })

describe('normalizeMobile', () => {
  it('accepts 09 numbers and +63 numbers, and rejects everything else', () => {
    expect(normalizeMobile('0917 624 8831')).toBe('09176248831')
    expect(normalizeMobile('+63 917 624 8831')).toBe('09176248831')
    expect(normalizeMobile('639176248831')).toBe('09176248831')
    expect(normalizeMobile('12345')).toBeNull()
    expect(normalizeMobile(null)).toBeNull()
  })
})

describe('findSessionContact', () => {
  it('uses the first mobile the client typed, ignoring bot messages', () => {
    const s = session('a', [
      { role: 'assistant', content: 'Call 0999 000 0000 for help' },
      { role: 'user', content: 'my number is 09176248831' },
    ])
    expect(findSessionContact(s)).toBe('09176248831')
  })

  it('returns null when the client never typed a mobile number', () => {
    expect(findSessionContact(session('a', [{ role: 'user', content: 'hi' }]))).toBeNull()
  })
})

describe('collectReferenceContacts', () => {
  it('pairs booking references with the mobile in the same session', () => {
    const pairs = collectReferenceContacts([
      session('s1', [
        { role: 'user', content: '09176248831' },
        { role: 'assistant', content: 'Booked! Your code is JAL-HCQ4G.' },
      ]),
    ])
    expect(pairs).toEqual([{ reference: 'JAL-HCQ4G', contact: '09176248831', sessionId: 's1' }])
  })

  it('skips sessions without a mobile and removes duplicates', () => {
    const pairs = collectReferenceContacts([
      session('s1', [{ role: 'assistant', content: 'Your code is JAL-HCQ4G' }]),
      session('s2', [
        { role: 'user', content: '09176248831' },
        { role: 'assistant', content: 'Your code is JAL-HCQ4G and again JAL-HCQ4G' },
      ]),
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].sessionId).toBe('s2')
  })
})

describe('appendReminderMessages', () => {
  const sessions = [session('s1', [{ role: 'user', content: 'hi' }])]
  const now = new Date('2026-11-18T01:00:00Z')

  it('appends the reminder to the matching session only', () => {
    const out = appendReminderMessages(sessions, 's1', [{ id: 'm1', body: 'Reminder text' }], now)
    expect(out[0].messages).toHaveLength(2)
    expect(out[0].messages[1]).toMatchObject({ role: 'assistant', content: 'Reminder text', kind: 'reminder' })
  })

  it('does not add the same reminder twice (polling is safe to repeat)', () => {
    const once = appendReminderMessages(sessions, 's1', [{ id: 'm1', body: 'Reminder text' }], now)
    const twice = appendReminderMessages(once, 's1', [{ id: 'm1', body: 'Reminder text' }], now)
    expect(twice[0].messages).toHaveLength(2)
  })

  it('leaves other sessions and empty input untouched', () => {
    expect(appendReminderMessages(sessions, 'other', [{ id: 'm1', body: 'x' }], now)).toEqual(sessions)
    expect(appendReminderMessages(sessions, 's1', [], now)).toBe(sessions)
  })
})
