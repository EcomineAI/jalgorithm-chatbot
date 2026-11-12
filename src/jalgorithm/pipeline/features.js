// Stage 4: synonym & phrase recognition. Maps normalized tokens to concept tags (config/lexicon.js)
// and adds derived features used by the rule classifier.

import { CONCEPTS } from '../config/lexicon.js'

function compile(concepts) {
  const single = new Map() // token → [tags]
  const sequences = [] // { tag, seq }
  for (const [tag, patterns] of Object.entries(concepts)) {
    for (const p of patterns) {
      if (Array.isArray(p) && p.length > 1) sequences.push({ tag, seq: p })
      else {
        const w = Array.isArray(p) ? p[0] : p
        if (!single.has(w)) single.set(w, [])
        single.get(w).push(tag)
      }
    }
  }
  return { single, sequences }
}

const COMPILED = compile(CONCEPTS)

function containsSequence(words, seq) {
  outer: for (let i = 0; i + seq.length <= words.length; i++) {
    for (let j = 0; j < seq.length; j++) if (words[i + j] !== seq[j]) continue outer
    return i
  }
  return -1
}

// Domain tags: their presence is evidence that the message is about the salon at all.
const DOMAIN_TAGS = new Set([
  'BOOK', 'APPT', 'MOVE', 'CANCEL', 'VIEW', 'AVAIL', 'FLEX', 'PRICE', 'SERVICE_Q', 'LOCATION', 'HOURS', 'POLICY',
  'GREETING', 'THANKS', 'GENERAL', 'NEG_ATTEND', 'VIEW_Q', 'SERVICE', 'DATE', 'TIME',
])

/**
 * @param {string[]} words normalized words
 * @param {object} entities output of entity extraction (used for #DATE/#TIME/#SERVICE)
 */
export function extractFeatures(words, entities = {}) {
  const tags = new Set()
  for (const w of words) for (const tag of COMPILED.single.get(w) ?? []) tags.add(tag)
  for (const { tag, seq } of COMPILED.sequences) if (containsSequence(words, seq) >= 0) tags.add(tag)
  if (words.includes('?')) tags.add('QUESTION')
  // "...or ako na lang mag-adjust": the client adjusting is flexibility, not moving a booking
  if (tags.has('FLEX') && !words.some((w) => ['reschedule', 'move', 'ilipat', 'lipat', 'palitan'].includes(w))) tags.delete('MOVE')

  // Derived: negation shortly before an attendance verb → "can't make it"
  const negIdx = words.map((w, i) => (COMPILED.single.get(w)?.includes('NEG') ? i : -1)).filter((i) => i >= 0)
  const attIdx = words.map((w, i) => (COMPILED.single.get(w)?.includes('ATTEND') ? i : -1)).filter((i) => i >= 0)
  if (negIdx.some((n) => attIdx.some((a) => a > n && a - n <= 4))) tags.add('NEG_ATTEND')
  if (['make', 'it'].every((w) => words.includes(w)) && tags.has('NEG')) tags.add('NEG_ATTEND')

  // Derived: "when/what time is MY appointment" without an action verb → view
  if (tags.has('QWHEN') && tags.has('POSS') && tags.has('APPT') && !tags.has('BOOK') && !tags.has('MOVE') && !tags.has('CANCEL')) {
    tags.add('VIEW_Q')
  }

  if (entities.date) tags.add('DATE')
  if (entities.time) tags.add('TIME')
  if (entities.service) tags.add('SERVICE')

  const domainTags = [...tags].filter((t) => DOMAIN_TAGS.has(t))
  if (domainTags.length >= 3) tags.add('MANY_TAGS')

  return { tags, domainTagCount: domainTags.length }
}
