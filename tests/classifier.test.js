import { describe, it, expect } from 'vitest'
import { trainNaiveBayes } from '../src/jalgorithm/classifier/naiveBayes.js'
import { trainTfidf } from '../src/jalgorithm/classifier/tfidf.js'
import { scoreRules } from '../src/jalgorithm/classifier/rules.js'
import { createAnalyzer } from '../src/jalgorithm/analyzer.js'

const NOW = new Date('2026-11-12T02:00:00Z')
const analyzer = createAnalyzer()
const classify = (t) => analyzer.analyze(t, { now: NOW })

const toy = [
  { features: ['book', 'appointment'], label: 'BOOK' },
  { features: ['book', 'me'], label: 'BOOK' },
  { features: ['cancel', 'appointment'], label: 'CANCEL' },
  { features: ['cancel', 'please'], label: 'CANCEL' },
]

describe('Multinomial Naive Bayes', () => {
  const nb = trainNaiveBayes(toy, { alpha: 1 })
  it('returns a probability distribution', () => {
    const p = nb.predict(['book'])
    expect(p.BOOK + p.CANCEL).toBeCloseTo(1, 10)
    expect(p.BOOK).toBeGreaterThan(p.CANCEL)
  })
  it('falls back to priors for unseen features', () => {
    expect(nb.predict(['zzz'])).toEqual({ BOOK: 0.5, CANCEL: 0.5 })
  })
  it('is deterministic', () => {
    expect(trainNaiveBayes(toy).predict(['cancel'])).toEqual(trainNaiveBayes(toy).predict(['cancel']))
  })
})

describe('TF-IDF cosine', () => {
  const tf = trainTfidf(toy)
  it('scores the closest class highest and reports the nearest example', () => {
    const r = tf.score(['cancel', 'appointment'])
    expect(r.scores.CANCEL).toBeGreaterThan(r.scores.BOOK)
    expect(r.nearest.label).toBe('CANCEL')
    expect(r.nearest.similarity).toBeCloseTo(1, 5)
  })
  it('gives zero similarity to unrelated text', () => {
    expect(tf.score(['weather']).nearest.similarity).toBe(0)
  })
})

describe('rule scorer', () => {
  it('applies weights and penalties from config/intents.js', () => {
    const { scores, fired } = scoreRules(new Set(['MOVE', 'APPT']))
    expect(fired).toBe(true)
    expect(scores.RESCHEDULE_APPOINTMENT).toBeGreaterThan(scores.BOOK_APPOINTMENT)
    expect(scoreRules(new Set()).fired).toBe(false)
  })
})

describe('hybrid classifier on the project brief examples', () => {
  it.each([
    ['pno yung appoinemt ng gantong oras kaya ba or aq magadjust?', 'CHECK_AVAILABILITY'],
    ['pwde b bukas?', 'CHECK_AVAILABILITY'],
    ['mgpapa sched sana aq', 'BOOK_APPOINTMENT'],
    ['anu oras available kau?', 'CHECK_AVAILABILITY'],
    ['d q mkapunta bukas', 'CANNOT_ATTEND'],
    ['pa move n lng ng sched ko', 'RESCHEDULE_APPOINTMENT'],
    ['hm po cons?', 'ASK_PRICE'],
    ['san loc nyo?', 'ASK_LOCATION'],
    ['may slot p b ng 3pm?', 'CHECK_AVAILABILITY'],
    ['cancel q n lng appointment q', 'CANCEL_APPOINTMENT'],
  ])('%s → %s', (text, intent) => {
    expect(classify(text).intent).toBe(intent)
  })
})

describe('out-of-domain protection', () => {
  it.each(['what is the weather today', 'tell me a joke', 'asdfgh', 'kumain ka na ba'])('%s → UNKNOWN_INTENT', (t) => {
    expect(classify(t).intent).toBe('UNKNOWN_INTENT')
  })
  it('reports a confidence and the top candidates', () => {
    const r = classify('magkano bridal')
    expect(r.intent).toBe('ASK_PRICE')
    expect(r.confidence).toBeGreaterThan(0.5)
    expect(r.ranked[0].intent).toBe('ASK_PRICE')
  })
})

describe('language detection', () => {
  it.each([
    ['how much is bridal makeup', 'en'],
    ['magkano po ang bridal', 'fil'],
    ['pwede ba mag book tomorrow', 'taglish'],
    ['saan po kayo', 'fil'],
    ['3pm', null],
  ])('%s → %s', (t, lang) => {
    expect(classify(t).language).toBe(lang)
  })
})
