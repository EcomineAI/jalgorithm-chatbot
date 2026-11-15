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

const DEFAULT_PREPARE_CACHE = new Map()

function servicesCacheKey(services = []) {
  return services
    .map((s) => `${s.key}:${s.name}:${(s.aliases ?? []).join(',')}`)
    .join('|')
}

export function createAnalyzer({ training, classifierConfig, catalog = defaultCatalog() } = {}) {
  const isDefaultTraining = training === undefined
  const resolvedTraining = isDefaultTraining ? trainingExamples() : training
  const normalizer = createNormalizer({ services: catalog.services })
  const serviceIndex = buildServiceIndex(catalog.services)

  // Normalize the training data with the same pipeline used at runtime, then
  // protect its vocabulary from fuzzy correction and train the classifiers.
  let prepared
  const cacheKey = isDefaultTraining ? servicesCacheKey(catalog.services) : null
  if (cacheKey && DEFAULT_PREPARE_CACHE.has(cacheKey)) {
    prepared = DEFAULT_PREPARE_CACHE.get(cacheKey)
  } else {
    prepared = resolvedTraining.map(({ text, label }) => {
      const norm = normalizer.normalize(tokenize(preprocess(text).text))
      const entities = extractEntities({ tokens: norm.tokens, words: norm.words, original: text, now: new Date(), expect: null, serviceIndex })
      const { tags } = extractFeatures(norm.words, entities)
      return { label, words: norm.words, features: featureTokens(norm.tokens, tags) }
    })
    if (cacheKey) DEFAULT_PREPARE_CACHE.set(cacheKey, prepared)
  }
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
    const hasEntities = Boolean(entities.service || entities.contact || entities.reference || ((entities.date || entities.time || entities.dateInfo?.week) && domainTagCount > 0))
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
