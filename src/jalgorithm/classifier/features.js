// Converts an analyzed message into the bag of features used by the statistical classifiers:
// unigrams, bigrams and concept tags. Structured values are replaced by placeholders so that
// "3pm" and "4pm" look identical to the classifier.

const PLACEHOLDER = { time: '<time>', clock: '<time>', date: '<date>', num: '<num>', phone: '<phone>', ref: '<ref>' }

export function featureTokens(tokens, tags) {
  const words = tokens.map((t) => PLACEHOLDER[t.type] ?? t.text).filter((w) => w !== '?')
  const feats = [...words]
  for (let i = 0; i + 1 < words.length; i++) feats.push(`${words[i]}_${words[i + 1]}`)
  for (const tag of tags) feats.push(`#${tag}`)
  return feats
}
