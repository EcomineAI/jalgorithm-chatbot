// Rule-based classifier: weighted concept-tag features from config/intents.js.
// Hand-written knowledge that works even for phrasings absent from the training data.

import { INTENTS } from '../config/intents.js'

export function scoreRules(tags) {
  const scores = {}
  let any = false
  for (const [intent, def] of Object.entries(INTENTS)) {
    let s = 0
    for (const [tag, weight] of Object.entries(def.rules)) if (tags.has(tag)) s += weight
    scores[intent] = Math.max(0, s)
    if (scores[intent] > 0) any = true
  }
  return { scores, fired: any }
}
