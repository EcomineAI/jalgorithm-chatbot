import { describe, it, expect } from 'vitest'
import { createJAlgorithm } from '../src/jalgorithm/index.js'
import { extractDate } from '../src/jalgorithm/entities/date.js'
import { extractTime } from '../src/jalgorithm/entities/time.js'
import { formatDate, formatTime, manilaToday } from '../src/jalgorithm/entities/calendar.js'

// Thursday 12 Nov 2026, 10:00 in Manila
const NOW = new Date('2026-11-12T02:00:00Z')
const bot = createJAlgorithm({ now: () => NOW })
const ent = (text, expect) => bot.analyze(text, { expect }).entities

describe('calendar', () => {
  it('uses Manila time regardless of the machine timezone', () => {
    expect(manilaToday(new Date('2026-11-12T17:00:00Z'))).toBe('2026-11-13') // 1AM next day in Manila
    expect(formatDate('2026-11-13', 'en')).toBe('Friday, Nov 13, 2026')
    expect(formatDate('2026-11-13', 'fil')).toBe('Biyernes, Nov 13, 2026')
    expect(formatTime('15:00')).toBe('3:00 PM')
    expect(formatTime('00:30')).toBe('12:30 AM')
  })
})

describe('date extraction', () => {
  it.each([
    ['may available ba bukas', '2026-11-13'],
    ['tomorrow po', '2026-11-13'],
    ['ngayon na', '2026-11-12'],
    ['sa makalawa', '2026-11-14'],
    ['friday', '2026-11-13'],
    ['sa biyernes', '2026-11-13'],
    ['next friday', '2026-11-20'],
    ['next week friday', '2026-11-20'],
    ['sa sabado', '2026-11-14'],
    ['sa linggo', '2026-11-15'],
    ['lunes', '2026-11-16'],
    ['dec 20', '2026-12-20'],
    ['20 december', '2026-12-20'],
    ['disyembre 5', '2026-12-05'],
    ['12/25', '2026-12-25'],
    ['jan 3', '2027-01-03'], // already passed this year → next year
    ['sa may 5', '2027-05-05'],
    ['ika-20', '2026-11-20'],
  ])('%s → %s', (text, date) => {
    expect(ent(text).date).toBe(date)
  })

  it('treats "linggo" after next/this as a week, not Sunday', () => {
    const e = ent('sa susunod na linggo')
    expect(e.date).toBeNull()
    expect(e.dateInfo.week).toBe('next')
  })
  it('does not read "bukas ba kayo" (are you open) as tomorrow', () => {
    expect(ent('bukas ba kayo sa sunday').date).toBe('2026-11-15')
    expect(ent('bukas ba kayo').date).toBeNull()
  })
  it('does not read Filipino "may" (there is) as the month', () => {
    expect(ent('may 2 slots pa').date).toBeNull()
  })
  it('flags impossible dates instead of guessing', () => {
    expect(extractDate(['feb', '30'], { now: NOW })).toEqual({ invalid: true, text: 'feb 30' })
  })
  it('reads a lone number as day of month only when a date was asked for', () => {
    expect(ent('25', 'date').date).toBe('2026-11-25')
    expect(ent('25').date).toBeNull()
  })
})

describe('time extraction', () => {
  it.each([
    ['may slot ba ng 3pm', '15:00', false],
    ['3:30 pm po', '15:30', false],
    ['10am', '10:00', false],
    ['15:00', '15:00', false],
    ['alas tres ng hapon', '15:00', false],
    ['alas-9 ng umaga', '09:00', false],
    ['alas dos y medya', '14:30', true],
    ['mga 4 ng hapon', '16:00', false],
    ['sa 2', '14:00', true],
    ['tanghali', '12:00', false],
    ['12nn', null, null],
  ])('%s → %s', (text, time, assumed) => {
    const e = ent(text)
    expect(e.time).toBe(time)
    if (time) expect(e.timeInfo.assumed).toBe(assumed)
  })

  it('reads a bare number as a time only when a time was asked for', () => {
    expect(ent('3', 'time').time).toBe('15:00')
    expect(ent('3').time).toBeNull()
  })
  it('does not treat counts as times', () => {
    expect(ent('3 days before').time).toBeNull()
    expect(ent('sa 2 tao').time).toBeNull()
  })
  it('recognizes vague times', () => {
    expect(extractTime(['kahit', 'anong', 'oras'])).toMatchObject({ anyTime: true })
    expect(extractTime(['sa', 'umaga'])).toMatchObject({ period: 'morning' })
  })
  it('rejects impossible times', () => {
    expect(ent('13pm').timeInfo).toMatchObject({ invalid: true })
  })
})

describe('other entities', () => {
  it('extracts services, contact numbers and references', () => {
    expect(ent('magkano bridal').service).toBe('bridal')
    expect(ent('hair and makeup po').service).toBe('hair_makeup')
    expect(ent('hair tsaka makeup').service).toBe('hair_makeup')
    expect(ent('para sa debut ko').service).toBe('event_makeup')
    expect(ent('makeup lang').service).toBeNull()
    expect(ent('number ko 0917 123 4567').contact).toBe('09171234567')
    expect(ent('+639171234567').contact).toBe('09171234567')
    expect(ent('ref ko jal-7k3qx').reference).toBe('JAL-7K3QX')
    expect(ent('7k3qx', 'reference').reference).toBe('JAL-7K3QX')
  })
  it('extracts names only when asked', () => {
    expect(ent('ako po si maria santos', 'name').name).toBe('Maria Santos')
    expect(ent('My name is Ana Cruz', 'name').name).toBe('Ana Cruz')
    expect(ent('maria santos').name).toBeUndefined()
  })
})
