// Time entity extraction: "3pm", "3:30 pm", "15:00", "alas tres", "alas-3 ng hapon",
// "tanghali", "around 2", "kahit anong oras". Bare hours without am/pm are interpreted
// within business hours (1–7 → PM, 8–11 → AM) and flagged `assumed` so replies can confirm them.

const SPANISH_NUMBERS = {
  una: 1, dos: 2, tres: 3, kwatro: 4, kuwatro: 4, singko: 5, sinko: 5, sais: 6,
  siyete: 7, syete: 7, otso: 8, nuwebe: 9, nwebe: 9, diyes: 10, dyes: 10, onse: 11, dose: 12,
}
const AM_WORDS = new Set(['umaga', 'morning', 'am', 'madaling'])
const PM_WORDS = new Set(['hapon', 'afternoon', 'gabi', 'evening', 'night', 'pm'])
const NOON_WORDS = new Set(['tanghali', 'noon', 'tanghaling', 'lunch', 'lunchtime'])
const TIME_CUES = new Set(['sa', 'ng', 'at', 'around', 'mga', 'by', 'before', 'after', 'bandang', 'alas', 'mag', 'til', 'until', 'hanggang', 'kahit', 'start', 'mula', 'from', 'pagdating'])
const NOT_TIME_AFTER = new Set(['days', 'day', 'araw', 'hours', 'hour', 'oras', 'people', 'tao', 'pax', 'slot', 'slots', 'weeks', 'week', 'linggo', 'months', 'buwan', 'beses', 'times', 'pcs', 'php', 'pesos', 'k'])
const MONTHS = new Set(['january', 'jan', 'february', 'feb', 'march', 'mar', 'april', 'apr', 'may', 'june', 'jun', 'july', 'jul', 'august', 'aug', 'september', 'sep', 'sept', 'october', 'oct', 'november', 'nov', 'december', 'dec', 'enero', 'pebrero', 'marso', 'abril', 'mayo', 'hunyo', 'hulyo', 'agosto', 'setyembre', 'oktubre', 'nobyembre', 'disyembre'])

const pad = (n) => String(n).padStart(2, '0')

function applyMeridiem(hour, meridiem) {
  if (meridiem === 'am') return hour === 12 ? 0 : hour
  if (meridiem === 'pm') return hour === 12 ? 12 : hour + 12
  return hour
}

function periodAround(words, i) {
  const window = words.slice(i + 1, i + 4)
  if (window.some((w) => AM_WORDS.has(w))) return 'am'
  if (window.some((w) => PM_WORDS.has(w))) return 'pm'
  if (window.some((w) => NOON_WORDS.has(w))) return 'pm'
  return null
}

function bareHour(hour, minute, words, i) {
  const meridiem = periodAround(words, i)
  if (meridiem) return { time: `${pad(applyMeridiem(hour, meridiem))}:${pad(minute)}`, assumed: false }
  // Business-hours heuristic (salon is open 8AM–7PM)
  const h24 = hour >= 13 ? hour : hour === 12 ? 12 : hour <= 7 ? hour + 12 : hour
  return { time: `${pad(h24)}:${pad(minute)}`, assumed: hour < 13 }
}

/**
 * @param {string[]} words normalized words
 * @returns {{time?: string, assumed?: boolean, anyTime?: boolean, period?: 'morning'|'afternoon'|'evening', text?: string, invalid?: boolean}|null}
 */
export function extractTime(words, { expect } = {}) {
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const prev = words[i - 1]
    const next = words[i + 1]

    const ampm = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(w)
    if (ampm) {
      const h = Number(ampm[1])
      const m = Number(ampm[2] ?? 0)
      if (h < 1 || h > 12 || m > 59) return { invalid: true, text: w }
      return { time: `${pad(applyMeridiem(h, ampm[3]))}:${pad(m)}`, assumed: false, text: w }
    }

    const clock = /^(\d{1,2}):(\d{2})$/.exec(w)
    if (clock) {
      const h = Number(clock[1])
      const m = Number(clock[2])
      if (h > 23 || m > 59) return { invalid: true, text: w }
      return { ...bareHour(h, m, words, i), text: w }
    }

    if (w === 'alas' && next) {
      const h = SPANISH_NUMBERS[next] ?? (/^\d{1,2}$/.test(next) ? Number(next) : null)
      if (h != null && h >= 1 && h <= 12) {
        const half = words[i + 2] === 'y' && ['medya', 'media', 'medja'].includes(words[i + 3])
        return { ...bareHour(h, half ? 30 : 0, words, i + (half ? 3 : 1)), text: `alas ${next}` }
      }
    }

    // bare number with a time cue: "ng 3", "around 2", "mga 4 ng hapon", "3 sana"
    if (/^\d{1,2}$/.test(w)) {
      const h = Number(w)
      const cue = TIME_CUES.has(prev) || periodAround(words, i) != null || next === 'oclock' || (next === 'o' && words[i + 2] === 'clock')
      const blocked = NOT_TIME_AFTER.has(next) || MONTHS.has(next) || MONTHS.has(prev) || prev === 'ika' || /\d/.test(next ?? '')
      const loneAnswer = expect === 'time' && words.filter((x) => /^\d/.test(x)).length === 1
      if (h >= 1 && h <= 12 && !blocked && (cue || loneAnswer)) return { ...bareHour(h, 0, words, i), text: w }
    }
  }

  if (words.some((w) => NOON_WORDS.has(w)) && !words.some((w) => /^\d/.test(w))) return { time: '12:00', assumed: false, text: 'tanghali' }

  const joined = ` ${words.join(' ')} `
  if (/ (kahit|any) ?(anong|ano|what)? ?(oras|time) |anytime|kahit kailan|any time/.test(joined)) return { anyTime: true, text: 'any time' }
  if (words.some((w) => AM_WORDS.has(w) && w !== 'am')) return { period: 'morning', text: 'morning' }
  if (words.includes('hapon') || words.includes('afternoon')) return { period: 'afternoon', text: 'afternoon' }
  if (words.some((w) => ['gabi', 'evening', 'night'].includes(w))) return { period: 'evening', text: 'evening' }
  return null
}
