// Stage 2: tokenization into typed tokens. Structured values (times, dates, phone numbers,
// booking references) are recognized here so later stages never split or "correct" them.

const TOKEN_PATTERNS = [
  ['ref', /jal-?[a-z0-9]{5}(?![a-z0-9])/y],
  ['phone', /(?:\+?63[\s-]?9\d{2}|09\d{2})[\s-]?\d{3}[\s-]?\d{4}(?!\d)/y],
  ['time', /\d{1,2}(?::\d{2})?\s?(?:am|pm)(?![a-z])/y],
  ['clock', /\d{1,2}:\d{2}(?!\d)/y],
  ['date', /\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?(?!\d)/y],
  ['num', /\d+(?:st|nd|rd|th)?(?![a-z0-9])/y],
  ['word', /[a-zñ0-9]+(?:['-][a-zñ0-9]+)*/y],
  ['punct', /\?/y],
]

/**
 * @param {string} text preprocessed (lowercased) text
 * @returns {{type: string, text: string}[]}
 */
export function tokenize(text) {
  const tokens = []
  let i = 0
  outer: while (i < text.length) {
    for (const [type, re] of TOKEN_PATTERNS) {
      re.lastIndex = i
      const m = re.exec(text)
      if (m) {
        const raw = m[0]
        tokens.push({ type, text: type === 'time' ? raw.replace(/\s+/g, '') : raw })
        i += raw.length
        continue outer
      }
    }
    i += 1 // skip whitespace and unhandled punctuation
  }
  return tokens
}
