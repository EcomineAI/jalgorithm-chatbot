// Stage 3: shortcut, spelling and morphology normalization.
//
// Ordered passes over word tokens (never global string replacement):
//   1. split hyphenated forms         "pa-schedule" → "pa" "schedule", "alas-3" → "alas" "3"
//   2. contextual + plain shortcuts    "d q mkapunta" → "hindi ko makapunta"
//   3. Filipino prefix separation      "magpabook" → "magpa" "book", "pasched" → "pa" "schedule"
//   4. guarded fuzzy correction        "apointmint" → "appointment" (domain words only)
// Every change is recorded so the original message can always be reconstructed/debugged.

import { SIMPLE_SHORTCUTS, CONTEXT_SHORTCUTS, PREFIXES, PREFIX_ROOTS, PREFIX_CANONICAL } from '../config/shortcuts.js'
import { KNOWN_WORDS, CONCEPTS, FUZZY_TARGETS } from '../config/lexicon.js'
import { bestFuzzyMatch } from './fuzzy.js'
import { defaultCatalog } from '../config/business.js'

const GLUED_DATE_TIME_WORDS = new Set([
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'enero', 'pebrero', 'marso', 'abril', 'mayo', 'hunyo', 'hulyo', 'agosto', 'setyembre', 'oktubre', 'nobyembre', 'disyembre',
  'alas', 'ika',
])
const ROOT_FUZZY_TARGETS = [...PREFIX_ROOTS].filter((r) => r.length >= 5)

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

function buildFuzzyTargets(services = []) {
  const targets = new Set(FUZZY_TARGETS)
  for (const s of services) {
    for (const a of [s.name, ...(s.aliases ?? [])]) {
      for (const w of String(a).toLowerCase().split(/\s+/)) {
        if (w.length >= 5 && /^[a-zñ]+$/.test(w)) targets.add(w)
      }
    }
  }
  return [...targets]
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
function resolveRoot(candidate, allowFuzzy = true) {
  const direct = SIMPLE_SHORTCUTS[candidate] ?? candidate
  if (PREFIX_ROOTS.has(direct)) return direct
  for (const k of [1, 2, 3]) {
    const rest = candidate.slice(k)
    if (rest.length >= 3 && rest.startsWith(candidate.slice(0, k))) {
      const root = SIMPLE_SHORTCUTS[rest] ?? rest
      if (PREFIX_ROOTS.has(root)) return root
    }
  }
  if (allowFuzzy && candidate.length >= 5) {
    const fuzzy = bestFuzzyMatch(candidate, ROOT_FUZZY_TARGETS, 1)
    if (fuzzy) return fuzzy.target
  }
  return null
}

function splitPrefix(word, vocab) {
  if (vocab.has(word)) return null
  for (const prefix of [...PREFIXES, '']) {
    if (!word.startsWith(prefix) || word.length - prefix.length < 3) continue
    const root = resolveRoot(word.slice(prefix.length), Boolean(prefix))
    if (root) {
      const canon = PREFIX_CANONICAL[prefix] ?? prefix
      return canon ? [canon, root] : [root]
    }
  }
  return null
}

/** @param {{extraVocabulary?: string[], services?: {name: string, aliases?: string[]}[]}} [opts] */
export function createNormalizer({ extraVocabulary = [], services = defaultCatalog().services } = {}) {
  let vocab = buildVocabulary(extraVocabulary, services)
  const fuzzyTargets = buildFuzzyTargets(services)

  function normalize(rawTokens) {
    const changes = []
    // Pass 1: hyphen & glued date/time splits (keeps structured tokens intact)
    const expanded = []
    for (const t of rawTokens) {
      if (t.type === 'word' && t.text.includes('-')) {
        const parts = t.text.split('-').filter(Boolean)
        changes.push({ from: t.text, to: parts.join(' '), rule: 'hyphen-split' })
        for (const p of parts) expanded.push({ type: isNumeric(p) ? 'num' : 'word', text: p, original: t.text })
      } else if (t.type === 'word') {
        const timeGlued = /^(\d{1,2}(?::\d{2})?(?:am|pm))(po|ba|na|pa|sana|lang|nalang|pala)$/.exec(t.text)
        const dtGlued = !timeGlued && t.text !== '2day'
          ? /^(?:([a-zñ]+)(\d{1,2})|(\d{1,2})([a-zñ]+))$/.exec(t.text)
          : null
        if (timeGlued) {
          changes.push({ from: t.text, to: `${timeGlued[1]} ${timeGlued[2]}`, rule: 'glued-split' })
          expanded.push({ type: 'time', text: timeGlued[1], original: t.text })
          expanded.push({ type: 'word', text: timeGlued[2], original: t.text })
        } else if (dtGlued && GLUED_DATE_TIME_WORDS.has(dtGlued[1] || dtGlued[4])) {
          if (dtGlued[1]) {
            changes.push({ from: t.text, to: `${dtGlued[1]} ${dtGlued[2]}`, rule: 'glued-split' })
            expanded.push({ type: 'word', text: dtGlued[1], original: t.text })
            expanded.push({ type: 'num', text: dtGlued[2], original: t.text })
          } else {
            changes.push({ from: t.text, to: `${dtGlued[3]} ${dtGlued[4]}`, rule: 'glued-split' })
            expanded.push({ type: 'num', text: dtGlued[3], original: t.text })
            expanded.push({ type: 'word', text: dtGlued[4], original: t.text })
          }
        } else {
          expanded.push({ ...t, original: t.text })
        }
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

      // Pass 2b: glued enclitic particle split ("magkanopo" → "magkano po")
      if (!vocab.has(text)) {
        const enclitic = /^([a-zñ]{4,}?)(nalang|pala|sana|lang|po|ba|ko|na)$/.exec(text)
        if (enclitic) {
          const stem = SIMPLE_SHORTCUTS[enclitic[1]] ?? enclitic[1]
          const stemParts = vocab.has(stem) ? stem.split(' ') : splitPrefix(stem, vocab)
          if (stemParts) {
            changes.push({ from: text, to: `${stemParts.join(' ')} ${enclitic[2]}`, rule: 'enclitic-split' })
            for (const part of stemParts) out.push({ type: 'word', text: part, original: t.original })
            out.push({ type: 'word', text: enclitic[2], original: t.original })
            continue
          }
        }
      }

      // Pass 3: Filipino verbal prefix + domain root
      const split = splitPrefix(text, vocab)
      if (split) {
        changes.push({ from: text, to: split.join(' '), rule: 'morphology' })
        for (const part of split) out.push({ type: 'word', text: part, original: t.original })
        continue
      }

      // Pass 3b: collapse duplicate letter slips ("bukass" → "bukas", "magkanoo" → "magkano")
      if (!vocab.has(text) && /([a-zñ])\1/.test(text)) {
        const candidates = [text.replace(/([a-zñ])\1$/, '$1'), text.replace(/([a-zñ])\1+/g, '$1')]
        for (const c of candidates) {
          if (c === text || c.length < 2) continue
          const resolved = SIMPLE_SHORTCUTS[c] ?? c
          if (vocab.has(resolved)) {
            changes.push({ from: text, to: resolved, rule: 'dedup' })
            for (const part of resolved.split(' ')) out.push({ type: 'word', text: part, original: t.original })
            text = null
            break
          }
        }
        if (text === null) continue
      }

      // Pass 4: fuzzy correction for out-of-vocabulary words only
      if (!vocab.has(text) && /^[a-zñ]+$/.test(text)) {
        const match = bestFuzzyMatch(text, fuzzyTargets)
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
