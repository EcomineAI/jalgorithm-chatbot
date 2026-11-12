import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { trainingExamples } from '../src/jalgorithm/data/training.js'
import { INTENTS } from '../src/jalgorithm/config/intents.js'
import { createNormalizer } from '../src/jalgorithm/pipeline/normalizer.js'
import { preprocess } from '../src/jalgorithm/pipeline/preprocess.js'
import { tokenize } from '../src/jalgorithm/pipeline/tokenizer.js'
import { RESPONSES } from '../src/jalgorithm/config/responses.js'

const load = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8')).items
const normalizer = createNormalizer()
const key = (t) => normalizer.normalize(tokenize(preprocess(t).text)).words.filter((w) => w !== '?').join(' ')
const training = new Set(trainingExamples().map((e) => key(e.text)))
const validLabels = new Set([...Object.keys(INTENTS).filter((k) => k !== 'OUT_OF_SCOPE'), 'UNKNOWN_INTENT'])

describe('evaluation data hygiene', () => {
  for (const file of ['intent_test_set.json', 'intent_validation_set.json']) {
    it(`${file} has no exact (normalized) overlap with training`, () => {
      const dupes = load(file).filter((it) => training.has(key(it.text))).map((it) => it.text)
      expect(dupes).toEqual([])
    })
    it(`${file} only uses known intent labels`, () => {
      for (const it of load(file)) {
        expect(validLabels.has(it.intent), it.text).toBe(true)
        for (const a of it.accept ?? []) expect(validLabels.has(a), it.text).toBe(true)
      }
    })
  }
  it('test and validation sets do not share messages', () => {
    const test = new Set(load('intent_test_set.json').map((it) => key(it.text)))
    expect(load('intent_validation_set.json').filter((it) => test.has(key(it.text)))).toEqual([])
  })
})

describe('response templates', () => {
  it('every English template has a Filipino counterpart and vice versa', () => {
    expect(Object.keys(RESPONSES.fil).sort()).toEqual(Object.keys(RESPONSES.en).sort())
  })
})
