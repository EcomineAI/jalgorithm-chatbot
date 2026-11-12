// Stage 3: shortcut, spelling and morphology normalization.
//
// Ordered passes over word tokens (never global string replacement):
//   1. split hyphenated forms         "pa-schedule" → "pa" "schedule", "alas-3" → "alas" "3"
//   2. contextual + plain shortcuts    "d q mkapunta" → "hindi ko makapunta"
//   3. Filipino prefix separation      "magpabook" → "magpa" "book", "pasched" → "pa" "schedule"
//   4. guarded fuzzy correction        "apointmint" → "appointment" (domain words only)
// Every change is recorded so the original message can always be reconstructed/debugged.

import { SIMPLE_SHORTCUTS, CONTEXT_SHORTCUTS, PREFIXES, PREFIX_ROOTS } from '../config/shortcuts.js'
import { KNOWN_WORDS, CONCEPTS, FUZZY_TARGETS } from '../config/lexicon.js'
import { bestFuzzyMatch } from './fuzzy.js'
import { defaultCatalog } from '../config/business.js'

function buildVocabulary(extra = [], services = []) {
  const vocab = new Set(KNOWN_WORDS)
  for (const patterns of Object.values(CONCEPTS)) {
    for (const p of patterns) for (const w of [].concat(p)) vocab.add(w)
  }
  for (const v of Object.values(SIMPLE_SHORTCUTS)) for (const w of v.split(' ')) vocab.add(w)
  for (const { to } of Object.values(CONTEXT_SHORTCUTS)) vocab.add(to)
  for (const s of services) for (const a of [s.name, ...(s.aliases ?? [])]) for (const w of String(a).toLowerCase().split(/\s+/)) if (w) vocab.add(w)
  for (const r of PREFIX_ROOTS) vocab.add(r)
  for (const p of PREFIXES) vocab.add(p)
  for (const w of extra) vocab.add(w)
  return vocab
}

const isNumeric = (s) => /^\d+(?:st|nd|rd|th)?$/.test(s)

function canonicalStructured(token) {
  if (token.type === 'ref') {
    const code = token.text.replace(/^jal-?/, '').toUpperCase()
    return `JAL-${code}`
  }
  if (token.type === 'phone') {
    const digits = token.text.replace(/\D/g, '')
    return digits.startsWith('63') ? `0${digits.slice(2)}` : digits
  }
  return token.text
}

// Filipino reduplication of the first syllable marks aspect: "bobook", "aadjust", "cacancel".
function resolveRoot(candidate) {
  const direct = SIMPLE_SHORTCUTS[candidate] ?? candidate
  if (PREFIX_ROOTS.has(direct)) return direct
  for (const k of [1, 2, 3]) {
    const rest = candidate.slice(k)
    if (rest.length >= 3 && rest.startsWith(candidate.slice(0, k))) {
      const root = SIMPLE_SHORTCUTS[rest] ?? rest
      if (PREFIX_ROOTS.has(root)) return root
    }
  }
  return null
}

function splitPrefix(word, vocab) {
  if (vocab.has(word)) return null
  for (const prefix of [...PREFIXES, '']) {
    if (!word.startsWith(prefix) || word.length - prefix.length < 3) continue
    const root = resolveRoot(word.slice(prefix.length))
    if (root) return prefix ? [prefix, root] : [root]
  }
  return null
}

/** @param {{extraVocabulary?: string[], services?: {name: string, aliases?: string[]}[]}} [opts] */
export function createNormalizer({ extraVocabulary = [], services = defaultCatalog().services } = {}) {
  let vocab = buildVocabulary(extraVocabulary, services)

  function normalize(rawTokens) {
    const changes = []
    // Pass 1: hyphen split (keeps structured tokens intact)
    const expanded = []
    for (const t of rawTokens) {
      if (t.type === 'word' && t.text.includes('-')) {
        const parts = t.text.split('-').filter(Boolean)
        changes.push({ from: t.text, to: parts.join(' '), rule: 'hyphen-split' })
        for (const p of parts) expanded.push({ type: isNumeric(p) ? 'num' : 'word', text: p, original: t.text })
      } else {
        expanded.push({ ...t, original: t.text })
      }
    }

    // Pass 2: shortcuts (left to right, so `prev` is already normalized)
    const out = []
    for (let i = 0; i < expanded.length; i++) {
      const t = expanded[i]
      if (t.type !== 'word') {
        out.push({ ...t, text: canonicalStructured(t) })
        continue
      }
      const ctx = {
        prev: out.length ? out[out.length - 1].text : undefined,
        next: expanded[i + 1]?.text,
        index: i,
        count: expanded.length,
      }
      let text = t.text
      const contextual = CONTEXT_SHORTCUTS[text]
      if (contextual && (!contextual.when || contextual.when(ctx))) {
        changes.push({ from: text, to: contextual.to, rule: 'context-shortcut' })
        text = contextual.to
      } else if (!contextual && SIMPLE_SHORTCUTS[text] && SIMPLE_SHORTCUTS[text] !== text) {
        changes.push({ from: text, to: SIMPLE_SHORTCUTS[text], rule: 'shortcut' })
        text = SIMPLE_SHORTCUTS[text]
        if (text.includes(' ')) {
          for (const part of text.split(' ')) out.push({ type: 'word', text: part, original: t.original })
          continue
        }
      }

      // Pass 3: Filipino verbal prefix + domain root
      const split = splitPrefix(text, vocab)
      if (split) {
        changes.push({ from: text, to: split.join(' '), rule: 'morphology' })
        for (const part of split) out.push({ type: 'word', text: part, original: t.original })
        continue
      }

      // Pass 4: fuzzy correction for out-of-vocabulary words only
      if (!vocab.has(text) && /^[a-zñ]+$/.test(text)) {
        const match = bestFuzzyMatch(text, FUZZY_TARGETS)
        if (match) {
          changes.push({ from: text, to: match.target, rule: `fuzzy(d=${match.distance})` })
          text = match.target
        }
      }
      out.push({ type: 'word', text, original: t.original })
    }

    return {
      tokens: out,
      words: out.map((t) => t.text),
      text: out.map((t) => t.text).join(' '),
      changes,
    }
  }

  return {
    normalize,
    /** Adds words (e.g. from the training data) so they are never fuzzy-corrected. */
    extendVocabulary(words) {
      vocab = new Set([...vocab, ...words])
    },
    isKnown: (w) => vocab.has(w),
  }
}
