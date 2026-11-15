// Entity extraction façade: dates, times, services, contact numbers, booking references,
// and (only when the bot asked for them) names and event locations.

import { extractDate } from './date.js'
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

const NAME_LEADS = /^(?:(?:ako\s+(?:po\s+)?si|si|ako\s+po\s+ay|ako\s+ay|my\s+name\s+is|name\s+ko\s+(?:po\s+)?(?:ay\s+)?|pangalan\s+ko\s+(?:po\s+)?(?:ay\s+)?|i\s*'?\s*am|i'm|im|this\s+is|it's|its|name:?)\s+)/i
const NAME_TRAIL = /\s+(?:po|lang|nga|pala)$/i

export function extractName(original) {
  let s = original.trim().replace(/[.!?,]+$/g, '')
  s = s.replace(NAME_LEADS, '').replace(NAME_TRAIL, '').trim()
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
  const date = pickWithCorrection(words, (ws) => extractDate(ws, { now, expect }), (d) => Boolean(d?.date || d?.week || d?.invalid))
  const time = pickWithCorrection(words, (ws) => extractTime(ws, { expect }), (t) => Boolean(t?.time || t?.anyTime || t?.invalid))
  const service = pickWithCorrection(words, (ws) => extractService(ws, serviceIndex), (s) => Boolean(s?.key))
  const entities = {
    date: date?.date ?? null,
    dateInfo: date,
    time: time?.time ?? null,
    timeInfo: time,
    service: service?.key ?? null,
    contact: extractContact(tokens),
    reference: extractReference(tokens, expect),
  }
  if (expect === 'name' && !entities.contact) entities.name = extractName(original)
  if (expect === 'location') entities.location = extractLocation(original)
  return entities
}
