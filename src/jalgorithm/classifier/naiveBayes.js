// Multinomial Naive Bayes with Laplace (additive) smoothing.
// This is the machine-learning component of JAlgorithm: its parameters (class priors and
// per-class token likelihoods) are estimated from the labeled examples in data/training.js.
// Training is deterministic and takes a few milliseconds, so it runs when the engine starts.

export function trainNaiveBayes(examples, { alpha = 1 } = {}) {
  const classes = [...new Set(examples.map((e) => e.label))].sort()
  const docCount = {}
  const tokenCount = {}
  const totalTokens = {}
  const vocab = new Set()

  for (const c of classes) {
    docCount[c] = 0
    tokenCount[c] = new Map()
    totalTokens[c] = 0
  }
  for (const { features, label } of examples) {
    docCount[label]++
    for (const f of features) {
      vocab.add(f)
      tokenCount[label].set(f, (tokenCount[label].get(f) ?? 0) + 1)
      totalTokens[label]++
    }
  }

  const V = vocab.size
  const logPrior = {}
  const logLikelihood = {}
  const logUnseen = {}
  for (const c of classes) {
    logPrior[c] = Math.log(docCount[c] / examples.length)
    const denom = totalTokens[c] + alpha * V
    logUnseen[c] = Math.log(alpha / denom)
    const ll = new Map()
    for (const [f, n] of tokenCount[c]) ll.set(f, Math.log((n + alpha) / denom))
    logLikelihood[c] = ll
  }

  /** @returns {Record<string, number>} posterior probability per class (sums to 1) */
  function predict(features) {
    const scores = {}
    for (const c of classes) {
      let s = logPrior[c]
      for (const f of features) {
        if (!vocab.has(f)) continue // unseen features carry no evidence
        s += logLikelihood[c].get(f) ?? logUnseen[c]
      }
      scores[c] = s
    }
    const max = Math.max(...Object.values(scores))
    let sum = 0
    for (const c of classes) {
      scores[c] = Math.exp(scores[c] - max)
      sum += scores[c]
    }
    for (const c of classes) scores[c] /= sum
    return scores
  }

  return { classes, predict, vocabularySize: V }
}
