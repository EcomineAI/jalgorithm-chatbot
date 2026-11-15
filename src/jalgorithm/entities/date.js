// Date entity extraction (English + Filipino). Output is a calendar date only; whether the
// date is bookable (advance notice, past, fully booked) is decided by the booking service.

import { manilaToday, addDays, dayOfWeek, toIso, parseIso, isValidDate, compareIso } from './calendar.js'

const WEEKDAY_WORDS = {
  sunday: 0, sun: 0, linggo: 0,
  monday: 1, mon: 1, lunes: 1,
  tuesday: 2, tue: 2, tues: 2, martes: 2,
  wednesday: 3, wed: 3, miyerkules: 3, miyerkoles: 3, myerkules: 3,
  thursday: 4, thu: 4, thurs: 4, huwebes: 4, webes: 4,
  friday: 5, fri: 5, biyernes: 5, byernes: 5, biernes: 5,
  saturday: 6, sat: 6, sabado: 6,
}

const MONTH_WORDS = {
  january: 1, jan: 1, enero: 1,
  february: 2, feb: 2, pebrero: 2, febrero: 2,
  march: 3, mar: 3, marso: 3,
  april: 4, apr: 4, abril: 4,
  may: 5, mayo: 5,
  june: 6, jun: 6, hunyo: 6,
  july: 7, jul: 7, hulyo: 7,
  august: 8, aug: 8, agosto: 8,
  september: 9, sep: 9, sept: 9, setyembre: 9, septyembre: 9,
  october: 10, oct: 10, oktubre: 10,
  november: 11, nov: 11, nobyembre: 11,
  december: 12, dec: 12, disyembre: 12,
}

const NEXT_WORDS = new Set(['next', 'susunod', 'sunod'])
const THIS_WORDS = new Set(['this', 'ngayong', 'ngayon', 'darating', 'coming'])
const MAY_MONTH_CUES = new Set(['sa', 'on', 'ng', 'this', 'next', 'by', 'until', 'hanggang', 'of', 'month'])

const dayNum = (w) => {
  const m = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(w ?? '')
  return m ? Number(m[1]) : null
}

function resolveMonthDay(today, month, day, year) {
  const { y } = parseIso(today)
  let yy = year ?? y
  if (yy < 100) yy += 2000
  if (!isValidDate(yy, month, day)) return { invalid: true }
  let iso = toIso(yy, month, day)
  if (year == null && compareIso(iso, today) < 0) {
    if (!isValidDate(yy + 1, month, day)) return { invalid: true }
    iso = toIso(yy + 1, month, day)
  }
  return { date: iso }
}

function resolveWeekday(today, target, modifier) {
  const todayIdx = (dayOfWeek(today) + 6) % 7 // Monday-based
  const targetIdx = (target + 6) % 7
  let ahead = targetIdx - todayIdx
  if (modifier === 'this') {
    if (ahead < 0) ahead += 7
  } else {
    if (ahead <= 0) ahead += 7
    // "next friday" = the Friday of next week when this week's Friday is still ahead
    if (modifier === 'next' && targetIdx > todayIdx) ahead += 7
  }
  return addDays(today, ahead)
}

/**
 * @param {string[]} words normalized words
 * @param {{now?: Date, expect?: string, max?: number}} opts
 * @returns {Array<{date?: string, week?: 'this'|'next', text?: string, invalid?: boolean, past?: boolean}>}
 */
export function extractDates(words, { now = new Date(), expect, max = 3 } = {}) {
  const today = manilaToday(now)
  const found = (date, text) => ({ date, text, past: compareIso(date, today) < 0 })
  const results = []
  const seenDates = new Set()
  const pushResult = (item) => {
    if (!item) return false
    if (item.date) {
      if (seenDates.has(item.date)) return false
      seenDates.add(item.date)
    }
    results.push(item)
    return results.length >= max
  }

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const prev = words[i - 1]
    const prev2 = words[i - 2]
    const next = words[i + 1]

    if (w === 'today' || w === 'mamaya' || (w === 'ngayon' && WEEKDAY_WORDS[next] === undefined && next !== 'week')) {
      if (pushResult(found(today, w))) break
      continue
    }
    if (w === 'tomorrow' || w === 'kinabukasan') {
      if (pushResult(found(addDays(today, 1), w))) break
      continue
    }
    if (w === 'bukas') {
      // "bukas ba kayo" / "bukas kayo" = "are you open", not "tomorrow"
      const isOpenQuestion = next === 'kayo' || (next === 'ba' && words[i + 2] === 'kayo')
      if (!isOpenQuestion && pushResult(found(addDays(today, 1), w))) break
      continue
    }
    if (w === 'makalawa') {
      if (pushResult(found(addDays(today, 2), w))) break
      continue
    }
    if (w === 'day' && next === 'after' && words[i + 2] === 'tomorrow') {
      if (pushResult(found(addDays(today, 2), 'day after tomorrow'))) break
      i += 2
      continue
    }

    // relative day counts: "in 3 days", "after 5 days", "4 araw mula ngayon"
    if (/^\d{1,2}$/.test(w) && ['day', 'days', 'araw'].includes(next)) {
      const n = Number(w)
      const isOffset =
        ['in', 'after', 'sa', 'pagkalipas'].includes(prev) ||
        (prev === 'ng' && prev2 === 'pagkalipas') ||
        (words[i + 2] === 'from' && words[i + 3] === 'now') ||
        (words[i + 2] === 'mula' && words[i + 3] === 'ngayon')
      if (isOffset && n >= 1 && n <= 90) {
        if (pushResult(found(addDays(today, n), `${w} ${next}`))) break
        i += 1
        continue
      }
    }

    // weekend shorthand: "this weekend" / "next weekend" / "weekend" -> Saturday
    if (w === 'weekend') {
      const before = words.slice(Math.max(0, i - 2), i)
      const modifier = before.some((x) => NEXT_WORDS.has(x)) ? 'next' : before.some((x) => THIS_WORDS.has(x)) ? 'this' : null
      if (pushResult(found(resolveWeekday(today, 6, modifier), w))) break
      continue
    }

    // week references (no specific day)
    if (w === 'week' || (w === 'linggo' && (NEXT_WORDS.has(prev) || NEXT_WORDS.has(prev2) || THIS_WORDS.has(prev) || prev === 'isang'))) {
      const weekday = words.slice(i + 1).find((x) => WEEKDAY_WORDS[x] !== undefined && x !== 'linggo')
      if (weekday) continue // "next week friday" -> resolved at the weekday token
      const isNext = NEXT_WORDS.has(prev) || NEXT_WORDS.has(prev2)
      if (isNext || THIS_WORDS.has(prev) || prev === 'isang') {
        if (pushResult({ week: isNext ? 'next' : 'this', text: `${prev} ${w}` })) break
        continue
      }
    }

    if (WEEKDAY_WORDS[w] !== undefined) {
      const before = words.slice(Math.max(0, i - 3), i)
      const modifier = before.some((x) => NEXT_WORDS.has(x)) ? 'next' : before.some((x) => THIS_WORDS.has(x)) ? 'this' : null
      if (pushResult(found(resolveWeekday(today, WEEKDAY_WORDS[w], modifier), w))) break
      continue
    }

    if (MONTH_WORDS[w] !== undefined) {
      if (w === 'may' && !MAY_MONTH_CUES.has(prev)) continue
      const after = dayNum(next)
      const before = dayNum(prev)
      const day = after ?? before
      if (day != null) {
        const yearWord = after != null ? words[i + 2] : null
        const year = /^\d{4}$/.test(yearWord ?? '') ? Number(yearWord) : null
        const r = resolveMonthDay(today, MONTH_WORDS[w], day, year)
        if (r.invalid) {
          if (pushResult({ invalid: true, text: `${w} ${day}` })) break
        } else {
          if (pushResult(found(r.date, `${w} ${day}`))) break
          // Handle "Nov 20 o 21" / "Nov 20 or 21" in the same month
          if (after != null && ['or', 'o', 'and'].includes(words[i + 2])) {
            const secondDay = dayNum(words[i + 3])
            const afterSecond = words[i + 4]
            if (secondDay != null && MONTH_WORDS[afterSecond] === undefined && !['am', 'pm'].includes(afterSecond)) {
              const r2 = resolveMonthDay(today, MONTH_WORDS[w], secondDay, year)
              if (!r2.invalid && pushResult(found(r2.date, `${w} ${secondDay}`))) break
              i += 3
              continue
            }
          }
        }
        if (after != null) i += year ? 2 : 1
        continue
      }
    }

    const numeric = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(w)
    if (numeric) {
      const r = resolveMonthDay(today, Number(numeric[1]), Number(numeric[2]), numeric[3] ? Number(numeric[3]) : null)
      if (r.invalid) {
        if (pushResult({ invalid: true, text: w })) break
      } else if (pushResult(found(r.date, w))) {
        break
      }
      continue
    }

    // "ika-20" / "on the 20th" -> day of the current or next month
    const n = dayNum(w)
    if (n != null && n >= 1 && n <= 31 && (prev === 'ika' || (prev === 'the' && /\d(st|nd|rd|th)$/.test(w)))) {
      if (pushResult(resolveDayOfMonth(today, n, w, found))) break
    }
  }

  // While the bot is waiting for a date, a lone number like "25" means the 25th.
  if (!results.length && expect === 'date') {
    const nums = words.filter((x) => dayNum(x) != null)
    if (nums.length === 1 && words.length <= 3) {
      const r = resolveDayOfMonth(today, dayNum(nums[0]), nums[0], found)
      if (r) results.push(r)
    }
  }
  return results
}

/**
 * @param {string[]} words normalized words
 * @param {{now?: Date, expect?: string}} opts
 * @returns {{date?: string, week?: 'this'|'next', text?: string, invalid?: boolean, past?: boolean}|null}
 */
export function extractDate(words, { now = new Date(), expect } = {}) {
  return extractDates(words, { now, expect, max: 1 })[0] ?? null
}

function resolveDayOfMonth(today, day, text, found) {
  const { y, m } = parseIso(today)
  for (let k = 0; k < 2; k++) {
    const mm = ((m - 1 + k) % 12) + 1
    const yy = y + Math.floor((m - 1 + k) / 12)
    if (isValidDate(yy, mm, day)) {
      const iso = toIso(yy, mm, day)
      if (compareIso(iso, today) >= 0) return found(iso, text)
    }
  }
  return { invalid: true, text }
}
