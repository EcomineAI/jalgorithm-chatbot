// Entity extraction façade: dates, times, services, contact numbers, booking references,
// and (only when the bot asked for them) names and event locations.

import { extractDate, extractDates } from './date.js'
import { extractTime } from './time.js'

/** Builds the alias index for the owner's current services (longest alias first). */
export function buildServiceIndex(services) {
  const aliases = services
    .flatMap((s) => [s.name, ...(s.aliases ?? [])].map((alias) => ({ key: s.key, alias: String(alias).toLowerCase().trim() })))
    .filter((a) => a.alias)
    .sort((a, b) => b.alias.length - a.alias.length)
  return { aliases, keys: new Set(services.map((s) => s.key)) }
}

export function extractService(words, index) {
  const text = ` ${words.join(' ')} `
  const hasHair = /\b(hair|buhok|hairstyle|hairdo)\b/.test(text)
  const hasMakeup = /\bmakeup\b/.test(text)
  const combo = index.keys.has('hair_makeup') && hasHair && hasMakeup
  for (const { key, alias } of index.aliases) {
    if (text.includes(` ${alias} `)) {
      // "hair ... makeup" anywhere in the message = the hair + makeup package
      if ((key === 'hair_styling' || key === 'personal_makeup') && combo) return { key: 'hair_makeup', text: alias }
      return { key, text: alias }
    }
  }
  if (combo) return { key: 'hair_makeup', text: 'hair makeup' }
  return null
}

export function extractContact(tokens) {
  const phone = tokens.find((t) => t.type === 'phone')
  return phone ? phone.text : null
}

export function extractReference(tokens, expect) {
  const ref = tokens.find((t) => t.type === 'ref')
  if (ref) return ref.text
  if (expect === 'reference') {
    // accept the bare 5-character code ("7k3qx") when we just asked for it
    const bare = tokens.find((t) => /^[a-z0-9]{5}$/.test(t.text) && /\d/.test(t.text) && /[a-z]/.test(t.text))
    if (bare) return `JAL-${bare.text.toUpperCase()}`
  }
  return null
}

const NAME_LEADS = /^(?:(?:ako\s+(?:po\s+)?si|si|ako\s+po\s+ay|ako\s+ay|my\s+name\s+is|name\s+(?:ko|ni|ng)\s+(?:(?:my|sister|brother|mom|mother|mama|nanay|friend|bride|kapatid|ate|kuya|client)\s+)?(?:ko\s+)?(?:po\s+)?(?:ay\s+|si\s+)?|pangalan\s+(?:ko|ni|ng)\s+(?:(?:kapatid|ate|nanay|mama|kaibigan|client)\s+)?(?:ko\s+)?(?:po\s+)?(?:ay\s+|si\s+)?|i\s*'?\s*am|i'm|im|this\s+is|it's|its|name:?)\s+)/i
const NAME_FOR_OTHERS = /^(?:(?:this\s+)?(?:booking\s+)?(?:is\s+)?)?(?:para\s+(?:kay|sa)|for)\s+(?:(?:my|the)\s+)?(?:(?:elder|older|younger|little)?\s*(?:sister|brother|mom|mother|mama|nanay|dad|father|papa|tatay|friend|bestie|bestfriend|cousin|pinsan|aunt|tita|bride|debutante|client|kapatid|ate|kuya|anak|gf|wife|asawa)(?:\s+ko)?(?:\s+(?:po|named|si|ay))?\s+|(?:po\s+)?(?:si\s+)?)?/i
const NAME_TRAIL_PAREN = /\s*\((?:for|para|bride|sister|mom|mother|mama|kapatid|ate|friend)[^)]{0,40}\)\s*$/i
const NAME_TRAIL = /(?:\s+(?:po|lang|nga|pala|na\s+lang|nalang))+$/i

export function extractName(original) {
  let s = original.trim().replace(/[.!?,]+$/g, '')
  s = s.replace(NAME_TRAIL_PAREN, '').replace(NAME_TRAIL, '').trim()
  s = s.replace(NAME_LEADS, '').replace(NAME_FOR_OTHERS, '').replace(NAME_TRAIL, '').trim()
  if (!/^[\p{L}][\p{L} .'-]{1,59}$/u.test(s)) return null
  if (s.split(/\s+/).length > 5) return null
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

const SKIP_LOCATION = /^(skip|wala|none|n\/?a|hindi pa sure|di pa sure|di pa alam|hindi ko pa alam|not sure|later|tba|tbd|pass)\b/i

export function extractLocation(original) {
  const s = original.trim().replace(/[.!]+$/g, '')
  if (!s) return null
  if (SKIP_LOCATION.test(s)) return { skipped: true }
  if (s.length < 2 || s.length > 200) return null
  return { value: s }
}

const CORRECTION_MARKERS = new Set(['este', 'mali'])

function correctionTail(words) {
  let cut = -1
  for (let i = 0; i < words.length - 1; i++) {
    if (CORRECTION_MARKERS.has(words[i])) cut = i + 1
    else if (words[i] === 'wait' && i > 0) cut = i + 1
    else if (words[i] === 'i' && words[i + 1] === 'mean' && i + 2 < words.length) cut = i + 2
  }
  return cut > 0 ? words.slice(cut) : null
}

function pickWithCorrection(words, extractor, hasValue) {
  const tail = correctionTail(words)
  if (tail) {
    const corrected = extractor(tail)
    if (hasValue(corrected)) return corrected
  }
  if (words.includes('pala')) {
    let last = null
    for (let i = 0; i < words.length; i++) {
      const res = extractor(words.slice(i))
      if (hasValue(res)) last = res
    }
    if (last) return last
  }
  return extractor(words)
}

const HEAD_NOUNS = new Set([
  'head', 'heads', 'person', 'persons', 'people', 'pax', 'kasabay', 'companion', 'companions',
  'bridesmaid', 'bridesmaids', 'entourage',
])
const HEAD_ADDITIONAL_CUES = new Set([
  'additional', 'dagdag', 'extra', 'plus', 'with', 'may', 'meron', 'kasabay', 'companion', 'companions',
  'bridesmaid', 'bridesmaids', 'entourage',
])
const WORD_NUMBERS = {
  one: 1, isa: 1, isang: 1, two: 2, dalawa: 2, dalawang: 2, three: 3, tatlo: 3, tatlong: 3,
  four: 4, apat: 4, five: 5, lima: 5, limang: 5, six: 6, anim: 6, seven: 7, pito: 7, pitong: 7,
  eight: 8, walo: 8, walong: 8, nine: 9, siyam: 9, ten: 10, sampu: 10, sampung: 10,
}

export function extractHeadCount(words) {
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const n = /^\d{1,2}$/.test(w) ? Number(w) : WORD_NUMBERS[w] ?? null
    if (n == null || n < 1 || n > 40) continue
    const window = words.slice(Math.max(0, i - 1), Math.min(words.length, i + 4))
    const hasHeadNoun = window.some((x) => HEAD_NOUNS.has(x))
    const hasAddAdj = window.some((x) => ['additional', 'dagdag', 'extra'].includes(x))
    if (hasHeadNoun || (hasAddAdj && words[i + 1] !== 'day' && words[i + 1] !== 'days' && words[i + 1] !== 'araw')) {
      const wideWindow = words.slice(Math.max(0, i - 2), Math.min(words.length, i + 4))
      const kind = wideWindow.some((x) => HEAD_ADDITIONAL_CUES.has(x)) ? 'additional' : 'total'
      return { count: n, kind, text: `${w} ${words[i + 1] ?? ''}`.trim() }
    }
  }
  return null
}

/**
 * @param {object} p
 * @param {{type: string, text: string}[]} p.tokens normalized tokens
 * @param {string[]} p.words normalized words
 * @param {string} p.original original user message
 * @param {Date} p.now
 * @param {string|null} p.expect slot the bot is currently waiting for
 * @param {object} p.serviceIndex output of buildServiceIndex()
 */
export function extractEntities({ tokens, words, original, now, expect, serviceIndex }) {
  const dateList = pickWithCorrection(
    words,
    (ws) => {
      const list = extractDates(ws, { now, expect })
      return list.length ? list : null
    },
    (list) => Array.isArray(list) && list.some((d) => Boolean(d?.date || d?.week || d?.invalid))
  )
  const date = dateList?.[0] ?? null
  const dates = (dateList ?? []).filter((d) => d?.date).map((d) => d.date)
  const time = pickWithCorrection(words, (ws) => extractTime(ws, { expect }), (t) => Boolean(t?.time || t?.anyTime || t?.invalid))
  const service = pickWithCorrection(words, (ws) => extractService(ws, serviceIndex), (s) => Boolean(s?.key))
  const entities = {
    date: date?.date ?? null,
    dateInfo: date,
    dates,
    dateInfos: dateList ?? [],
    time: time?.time ?? null,
    timeInfo: time,
    service: service?.key ?? null,
    headCount: extractHeadCount(words),
    contact: extractContact(tokens),
    reference: extractReference(tokens, expect),
  }
  if (expect === 'name' && !entities.contact) entities.name = extractName(original)
  if (expect === 'location') entities.location = extractLocation(original)
  return entities
}
