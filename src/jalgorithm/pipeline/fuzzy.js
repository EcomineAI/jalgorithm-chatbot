// Optimal-string-alignment (restricted Damerau-Levenshtein) edit distance.
// Counts insertions, deletions, substitutions and adjacent transpositions ("tiem" → "time").
export function editDistance(a, b, maxDistance = Infinity) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1
  const rows = a.length + 1
  const cols = b.length + 1
  const d = Array.from({ length: rows }, (_, i) => {
    const row = new Array(cols).fill(0)
    row[0] = i
    return row
  })
  for (let j = 0; j < cols; j++) d[0][j] = j
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1)
      d[i][j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > maxDistance) return maxDistance + 1
  }
  return d[rows - 1][cols - 1]
}

/** Allowed distance for a token of this length (short words are never fuzzy-corrected). */
export function allowedDistance(length) {
  if (length < 5) return 0
  if (length < 8) return 1
  return 2
}

const PHONETIC_PAIRS = new Set(['ck', 'kc', 'fp', 'pf', 'vb', 'bv', 'sc', 'cs'])

function sameOrTransposedStart(word, target) {
  if (target[0] === word[0]) return true
  if (word.length >= 5 && target.length >= 5 && word[0] === target[1] && word[1] === target[0]) return true
  return PHONETIC_PAIRS.has(word[0] + target[0])
}

/**
 * Returns the single best target within the allowed distance, or null when there is no
 * candidate or when two different targets tie (ambiguous correction is not applied).
 * Candidates must share the first letter (or first-two transposition / Filipino phonetic equivalent),
 * which removes most false corrections.
 */
export function bestFuzzyMatch(word, targets, maxOverride = null) {
  const baseMax = allowedDistance(word.length)
  const max = maxOverride != null ? Math.min(baseMax, maxOverride) : baseMax
  if (max === 0) return null
  let best = null
  let bestDist = Infinity
  let tie = false
  for (const t of targets) {
    if (!sameOrTransposedStart(word, t)) continue
    const dist = editDistance(word, t, max)
    if (dist > max) continue
    if (dist < bestDist) {
      best = t
      bestDist = dist
      tie = false
    } else if (dist === bestDist && t !== best) {
      tie = true
    }
  }
  return best && !tie ? { target: best, distance: bestDist } : null
}
