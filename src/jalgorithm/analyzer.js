// Natural-language understanding pipeline:
//   preprocess → tokenize → normalize → entity extraction → concept features
//   → language detection → hybrid intent classification
// Pure and synchronous: no network, no storage.

import { preprocess } from './pipeline/preprocess.js'
import { tokenize } from './pipeline/tokenizer.js'
import { createNormalizer } from './pipeline/normalizer.js'
import { extractFeatures } from './pipeline/features.js'
import { detectLanguage } from './pipeline/language.js'
import { extractEntities, buildServiceIndex } from './entities/index.js'
import { featureTokens } from './classifier/features.js'
import { createClassifier } from './classifier/ensemble.js'
import { trainingExamples } from './data/training.js'
import { defaultCatalog } from './config/business.js'

export function createAnalyzer({ training = trainingExamples(), classifierConfig, catalog = defaultCatalog() } = {}) {
  const normalizer = createNormalizer({ services: catalog.services })
  const serviceIndex = buildServiceIndex(catalog.services)

  // Normalize the training data with the same pipeline used at runtime, then
  // protect its vocabulary from fuzzy correction and train the classifiers.
  const prepared = training.map(({ text, label }) => {
    const norm = normalizer.normalize(tokenize(preprocess(text).text))
    const entities = extractEntities({ tokens: norm.tokens, words: norm.words, original: text, now: new Date(), expect: null, serviceIndex })
    const { tags } = extractFeatures(norm.words, entities)
    return { label, words: norm.words, features: featureTokens(norm.tokens, tags) }
  })
  normalizer.extendVocabulary(prepared.flatMap((p) => p.words).filter((w) => /^[a-zñ]+$/.test(w)))
  const classifier = createClassifier(prepared, classifierConfig)

  /**
   * @param {string} message
   * @param {{now?: Date, expect?: string|null}} [opts] expect = slot the dialogue is waiting for
   */
  function analyze(message, { now = new Date(), expect = null } = {}) {
    const { original, text } = preprocess(message)
    const norm = normalizer.normalize(tokenize(text))
    const entities = extractEntities({ tokens: norm.tokens, words: norm.words, original, now, expect, serviceIndex })
    const { tags, domainTagCount } = extractFeatures(norm.words, entities)
    const hasEntities = Boolean(entities.date || entities.time || entities.service || entities.contact || entities.reference || entities.dateInfo?.week)
    const result = norm.words.length
      ? classifier.classify(featureTokens(norm.tokens, tags), tags, { hasEntities, domainTagCount })
      : { intent: 'UNKNOWN_INTENT', confidence: 0, reason: 'empty', ambiguous: false, candidates: [], ranked: [] }

    return {
      original,
      normalized: norm.text,
      words: norm.words,
      tokens: norm.tokens,
      changes: norm.changes,
      tags: [...tags],
      language: detectLanguage(norm.words),
      entities,
      intent: result.intent,
      confidence: Number(result.confidence.toFixed(3)),
      ambiguous: result.ambiguous,
      candidates: result.candidates ?? [],
      reason: result.reason ?? null,
      ranked: result.ranked,
      components: result.components,
    }
  }

  return { analyze, labels: classifier.labels, trainingSize: prepared.length }
}
