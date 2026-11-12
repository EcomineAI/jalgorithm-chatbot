// Language identification by marker-word ratios. Used to pick the reply language, not to
// route the classifier (all classifiers are trained on mixed English/Filipino/Taglish data).

import { FILIPINO_MARKERS, ENGLISH_MARKERS } from '../config/lexicon.js'

/**
 * @returns {'en'|'fil'|'taglish'|null} null when the message has no marker words (e.g. "3pm")
 */
export function detectLanguage(words) {
  let fil = 0
  let en = 0
  for (const w of words) {
    const isFil = FILIPINO_MARKERS.has(w)
    const isEn = ENGLISH_MARKERS.has(w)
    if (isFil && !isEn) fil++
    else if (isEn && !isFil) en++
  }
  if (fil === 0 && en === 0) return null
  if (fil > 0 && en > 0) return fil >= en ? 'taglish' : en >= fil * 2 ? 'en' : 'taglish'
  return fil > 0 ? 'fil' : 'en'
}

/** Reply templates exist in 'en' and 'fil' (casual Taglish). */
export function replyLanguage(detected, previous = 'fil') {
  if (detected === 'en') return 'en'
  if (detected === 'fil' || detected === 'taglish') return 'fil'
  return previous
}
