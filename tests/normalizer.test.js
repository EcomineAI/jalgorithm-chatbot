import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { preprocess } from '../src/jalgorithm/pipeline/preprocess.js'
import { tokenize } from '../src/jalgorithm/pipeline/tokenizer.js'
import { createNormalizer } from '../src/jalgorithm/pipeline/normalizer.js'
import { editDistance, bestFuzzyMatch } from '../src/jalgorithm/pipeline/fuzzy.js'

const normalizer = createNormalizer()
const norm = (s) => normalizer.normalize(tokenize(preprocess(s).text))
const cases = JSON.parse(readFileSync(new URL('./data/normalization_cases.json', import.meta.url), 'utf8')).items

describe('preprocess', () => {
  it('keeps the original message untouched', () => {
    const r = preprocess('  Pwde B bukas?? 😊 ')
    expect(r.original).toBe('  Pwde B bukas?? 😊 ')
    expect(r.text).toBe('pwde b bukas?')
  })
  it('collapses elongations and normalizes am/pm and ampersands', () => {
    expect(preprocess('pleaseee hiii').text).toBe('please hi')
    expect(preprocess('3 p.m.').text).toBe('3 pm')
    expect(preprocess('hair & makeup').text).toBe('hair and makeup')
    expect(preprocess('hair+makeup').text).toBe('hair and makeup')
  })
})

describe('tokenizer', () => {
  it('recognizes structured tokens', () => {
    const types = (s) => tokenize(s).map((t) => `${t.type}:${t.text}`)
    expect(types('may slot ba ng 3 pm')).toContain('time:3pm')
    expect(types('3:30pm sa 12/20')).toEqual(['time:3:30pm', 'word:sa', 'date:12/20'])
    expect(types('0917-123-4567')).toEqual(['phone:0917-123-4567'])
    expect(types('jal-7k3qx')).toEqual(['ref:jal-7k3qx'])
    expect(types('alas-3')).toEqual(['word:alas-3'])
  })
})

describe('normalizer: dataset cases', () => {
  for (const c of cases) {
    it(`"${c.input}" → "${c.expected}"`, () => {
      const out = norm(c.input)
      expect(out.words.join(' ')).toBe(c.expected)
      for (const w of c.protect ?? []) expect(out.words).toContain(w)
    })
  }
})

describe('normalizer: false-correction guards', () => {
  it('never rewrites substrings of words', () => {
    // "b", "d", "q" shortcuts must not touch "bukas", "dito", "quick"
    expect(norm('bukas dito quick').words).toEqual(['bukas', 'dito', 'quick'])
  })
  it('keeps place names after "san"', () => {
    expect(norm('san fernando').words).toEqual(['san', 'fernando'])
    expect(norm('san kayo').words).toEqual(['saan', 'kayo'])
  })
  it('only treats "hm" as magkano when something follows that is not a filler', () => {
    expect(norm('hm').words).toEqual(['hm'])
    expect(norm('hm ok').words).toEqual(['hm', 'ok'])
    expect(norm('hm bridal').words).toEqual(['magkano', 'bridal'])
  })
  it('does not fuzzy-correct short words or ordinary vocabulary', () => {
    expect(norm('ate kuya').words).toEqual(['ate', 'kuya'])
    expect(norm('maganda').words).toEqual(['maganda'])
  })
  it('records every change for debugging', () => {
    const out = norm('pwde b mgpapa sched')
    expect(out.changes.map((c) => c.from)).toEqual(['pwde', 'b', 'mgpapa', 'sched'])
  })
  it('does not split ordinary words that start with a prefix', () => {
    expect(norm('paano pasko maganda').words).toEqual(['paano', 'pasko', 'maganda'])
  })
})

describe('fuzzy matching', () => {
  it('computes OSA distance with transpositions', () => {
    expect(editDistance('tiem', 'time')).toBe(1)
    expect(editDistance('appointmnt', 'appointment')).toBe(1)
    expect(editDistance('kitten', 'sitting')).toBe(3)
  })
  it('refuses ties and different first letters', () => {
    expect(bestFuzzyMatch('xppointment', ['appointment'])).toBeNull()
    expect(bestFuzzyMatch('abcde', ['abcdf', 'abcdg'])).toBeNull()
  })
})
