// TF-IDF vector space model with cosine similarity.
// Each intent is represented by the normalized centroid of its training examples; a message is
// scored by cosine similarity to each centroid. The nearest single example's similarity is also
// returned and used as a lexical "is this even about the salon?" signal. Note that this is
// lexical overlap, not semantic understanding: paraphrases with unseen words score low.

function l2normalize(vec) {
  let norm = 0
  for (const v of vec.values()) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  for (const [k, v] of vec) vec.set(k, v / norm)
  return vec
}

function cosine(a, b) {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let dot = 0
  for (const [k, v] of small) {
    const w = large.get(k)
    if (w) dot += v * w
  }
  return dot
}

export function trainTfidf(examples) {
  const N = examples.length
  const df = new Map()
  for (const { features } of examples) for (const f of new Set(features)) df.set(f, (df.get(f) ?? 0) + 1)
  const idf = new Map()
  for (const [f, n] of df) idf.set(f, Math.log((1 + N) / (1 + n)) + 1)

  function vectorize(features) {
    const tf = new Map()
    for (const f of features) if (idf.has(f)) tf.set(f, (tf.get(f) ?? 0) + 1)
    const vec = new Map()
    for (const [f, n] of tf) vec.set(f, (1 + Math.log(n)) * idf.get(f))
    return l2normalize(vec)
  }

  const docs = examples.map((e) => ({ label: e.label, vec: vectorize(e.features) }))
  const classes = [...new Set(examples.map((e) => e.label))].sort()
  const centroids = {}
  for (const c of classes) {
    const sum = new Map()
    for (const d of docs) if (d.label === c) for (const [k, v] of d.vec) sum.set(k, (sum.get(k) ?? 0) + v)
    centroids[c] = l2normalize(sum)
  }

  /** @returns {{ scores: Record<string, number>, nearest: {label: string, similarity: number} }} */
  function score(features) {
    const vec = vectorize(features)
    const scores = {}
    for (const c of classes) scores[c] = cosine(vec, centroids[c])
    let nearest = { label: null, similarity: 0 }
    for (const d of docs) {
      const s = cosine(vec, d.vec)
      if (s > nearest.similarity) nearest = { label: d.label, similarity: s }
    }
    return { scores, nearest }
  }

  return { classes, score }
}
