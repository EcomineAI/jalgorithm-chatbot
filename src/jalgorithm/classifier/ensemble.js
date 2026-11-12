// Hybrid intent classifier: late fusion of
//   (1) rule scores        – conventional, hand-written
//   (2) Naive Bayes        – machine learning (trained on data/training.js)
//   (3) TF-IDF + cosine    – conventional vector-space similarity
// followed by confidence thresholding, ambiguity detection and an out-of-domain guard.

import { INTENTS, CLASSIFIER_CONFIG, CLARIFY_PAIRS } from '../config/intents.js'
import { trainNaiveBayes } from './naiveBayes.js'
import { trainTfidf } from './tfidf.js'
import { scoreRules } from './rules.js'

export const UNKNOWN = 'UNKNOWN_INTENT'
const LABELS = Object.keys(INTENTS)

function toDistribution(scores) {
  const dist = {}
  let sum = 0
  for (const l of LABELS) sum += scores[l] ?? 0
  for (const l of LABELS) dist[l] = sum > 0 ? (scores[l] ?? 0) / sum : 1 / LABELS.length
  return dist
}

const isClarifyPair = (a, b) => CLARIFY_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

/**
 * @param {{features: string[], label: string}[]} trainingExamples
 * @param {object} [config] overrides for CLASSIFIER_CONFIG
 */
export function createClassifier(trainingExamples, config = {}) {
  const cfg = { ...CLASSIFIER_CONFIG, ...config, weights: { ...CLASSIFIER_CONFIG.weights, ...config.weights } }
  const nb = trainNaiveBayes(trainingExamples, { alpha: cfg.nbAlpha })
  const tfidf = trainTfidf(trainingExamples)

  /**
   * @param {string[]} features  output of featureTokens()
   * @param {Set<string>} tags   concept tags
   * @param {{hasEntities: boolean, domainTagCount: number}} evidence
   */
  function classify(features, tags, evidence) {
    const rules = scoreRules(tags)
    const nbDist = toDistribution(nb.predict(features))
    const tf = tfidf.score(features)
    const tfDist = toDistribution(tf.scores)
    const ruleDist = toDistribution(rules.scores)

    const fused = {}
    for (const l of LABELS) {
      fused[l] = cfg.weights.rules * ruleDist[l] + cfg.weights.naiveBayes * nbDist[l] + cfg.weights.tfidf * tfDist[l]
    }
    const ranked = LABELS.map((l) => ({ intent: l, score: fused[l] })).sort((a, b) => b.score - a.score)
    const [top, second] = ranked

    const relevant = evidence.domainTagCount > 0 || evidence.hasEntities || tf.nearest.similarity >= cfg.minTfidfSimilarity
    const components = { rules: rules.scores, naiveBayes: nbDist, tfidf: tf.scores, nearest: tf.nearest }
    const base = { confidence: top.score, ranked: ranked.slice(0, 3), components }

    if (!relevant) return { ...base, intent: UNKNOWN, reason: 'out_of_domain', ambiguous: false }
    if (top.intent === 'OUT_OF_SCOPE') return { ...base, intent: UNKNOWN, reason: 'out_of_scope', ambiguous: false }
    if (top.score < cfg.minConfidence) return { ...base, intent: UNKNOWN, reason: 'low_confidence', ambiguous: false, candidates: [top.intent, second.intent] }

    const ambiguous =
      second.intent !== 'OUT_OF_SCOPE' &&
      top.score - second.score < cfg.ambiguityMargin &&
      second.score >= cfg.ambiguityFloor &&
      isClarifyPair(top.intent, second.intent)

    return { ...base, intent: top.intent, ambiguous, candidates: ambiguous ? [top.intent, second.intent] : [top.intent] }
  }

  return { classify, labels: LABELS, nbVocabularySize: nb.vocabularySize }
}
