// JAlgorithm evaluation: node scripts/evaluate.js [--set test|validation] [--no-write]
//
// Reports accuracy, per-intent precision/recall/F1, macro-F1, per-language and per-category
// accuracy, confusion matrix, out-of-domain rejection, latency and memory, normalization quality,
// and compares against keyword baselines. Writes reports/evaluation.{md,json}.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createAnalyzer } from '../src/jalgorithm/analyzer.js'
import { createNormalizer } from '../src/jalgorithm/pipeline/normalizer.js'
import { preprocess } from '../src/jalgorithm/pipeline/preprocess.js'
import { tokenize } from '../src/jalgorithm/pipeline/tokenizer.js'
import { trainingExamples } from '../src/jalgorithm/data/training.js'
import { keywordBaseline } from './baseline.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const setName = args.includes('--set') ? args[args.indexOf('--set') + 1] : 'test'
const write = !args.includes('--no-write')
const NOW = new Date('2026-11-12T02:00:00Z') // fixed clock: results are reproducible

const load = (f) => JSON.parse(readFileSync(join(ROOT, 'tests/data', f), 'utf8'))
const dataset = load(setName === 'validation' ? 'intent_validation_set.json' : 'intent_test_set.json').items
const normCases = load('normalization_cases.json').items

// ── metrics helpers ──────────────────────────────────────────────────────────
function metrics(rows, predKey = 'pred') {
  const labels = [...new Set(rows.flatMap((r) => [r.intent, r[predKey]]))].sort()
  const per = {}
  for (const l of labels) {
    const tp = rows.filter((r) => r.intent === l && r[predKey] === l).length
    const fp = rows.filter((r) => r.intent !== l && r[predKey] === l).length
    const fn = rows.filter((r) => r.intent === l && r[predKey] !== l).length
    const precision = tp + fp ? tp / (tp + fp) : 0
    const recall = tp + fn ? tp / (tp + fn) : 0
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
    per[l] = { precision, recall, f1, support: tp + fn }
  }
  const goldLabels = labels.filter((l) => per[l].support > 0)
  const macroF1 = goldLabels.reduce((s, l) => s + per[l].f1, 0) / goldLabels.length
  const accuracy = rows.filter((r) => r[predKey] === r.intent).length / rows.length
  return { accuracy, macroF1, per, labels }
}

const lenientOk = (r) => r.pred === r.intent || (r.accept ?? []).includes(r.pred) || (r.ambiguous && r.candidates.includes(r.intent))
const pct = (x) => `${(x * 100).toFixed(1)}%`
const group = (rows, key) => {
  const out = {}
  for (const r of rows) (out[r[key]] ??= []).push(r)
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { n: v.length, accuracy: v.filter((r) => r.pred === r.intent).length / v.length }]))
}
const percentile = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

// ── engine init (time + memory) ──────────────────────────────────────────────
global.gc?.()
const heapBefore = process.memoryUsage().heapUsed
const t0 = performance.now()
const analyzer = createAnalyzer()
const initMs = performance.now() - t0
global.gc?.()
const heapAfter = process.memoryUsage().heapUsed

// ── overlap check: evaluation messages must not appear in training ───────────
const normalizer = createNormalizer()
const normText = (t) => normalizer.normalize(tokenize(preprocess(t).text)).words.filter((w) => w !== '?').join(' ')
const trainNorm = new Set(trainingExamples().map((e) => normText(e.text)))
const jaccard = (a, b) => {
  const A = new Set(a.split(' '))
  const B = new Set(b.split(' '))
  const inter = [...A].filter((x) => B.has(x)).length
  return inter / (A.size + B.size - inter)
}
const trainList = [...trainNorm]
const overlaps = dataset
  .map((it) => ({ text: it.text, n: normText(it.text) }))
  .filter(({ n }) => trainNorm.has(n) || trainList.some((t) => n.split(' ').length > 2 && jaccard(n, t) >= 0.9))
  .map((o) => o.text)

// ── run classification ───────────────────────────────────────────────────────
analyzer.analyze('warm up', { now: NOW })
const latencies = []
const rows = dataset.map((it) => {
  const start = performance.now()
  const r = analyzer.analyze(it.text, { now: NOW })
  latencies.push(performance.now() - start)
  return { ...it, pred: r.intent, confidence: r.confidence, ambiguous: r.ambiguous, candidates: r.candidates, baseline: keywordBaseline(it.text) }
})

const main = metrics(rows)
const base = metrics(rows, 'baseline')
const unseen = rows.filter((r) => !r.seen_in_development)
const unseenMetrics = metrics(unseen)
const lenient = rows.filter(lenientOk).length / rows.length
const outOfDomain = rows.filter((r) => r.intent === 'UNKNOWN_INTENT')
const inDomain = rows.filter((r) => r.intent !== 'UNKNOWN_INTENT')
const rejection = outOfDomain.filter((r) => r.pred === 'UNKNOWN_INTENT').length / (outOfDomain.length || 1)
const falseRejection = inDomain.filter((r) => r.pred === 'UNKNOWN_INTENT').length / (inDomain.length || 1)


// confusion matrix
const labels = main.labels
const confusion = Object.fromEntries(labels.map((g) => [g, Object.fromEntries(labels.map((p) => [p, 0]))]))
for (const r of rows) confusion[r.intent][r.pred]++

// ── normalization ────────────────────────────────────────────────────────────
const normRows = normCases.map((c) => {
  const out = normalizer.normalize(tokenize(preprocess(c.input).text))
  const got = out.words.join(' ')
  const protectedOk = (c.protect ?? []).every((w) => out.words.includes(w))
  return { ...c, got, exact: got === c.expected, protectedOk, changes: out.changes }
})
const normExact = normRows.filter((r) => r.exact).length / normRows.length
const protectedCases = normRows.filter((r) => r.protect)
const falseCorrections = protectedCases.filter((r) => !r.protectedOk)
// Case-level correction precision: of the inputs the normalizer changed, how many ended up exactly right.
// (Counting individual steps would penalize correct multi-step rewrites such as hyphen split → morphology.)
const changedRows = normRows.filter((r) => r.changes.length > 0)
const corrTotal = changedRows.length
const corrRight = changedRows.filter((r) => r.exact).length

// ── report ───────────────────────────────────────────────────────────────────
const result = {
  set: setName,
  generatedAt: new Date().toISOString(),
  fixedClock: NOW.toISOString(),
  sizes: { training: analyzer.trainingSize, evaluated: rows.length, unseenOnly: unseen.length },
  overlapWithTraining: overlaps,
  jalgorithm: {
    accuracy: main.accuracy,
    macroF1: main.macroF1,
    accuracyExcludingSeenInDevelopment: unseenMetrics.accuracy,
    macroF1ExcludingSeenInDevelopment: unseenMetrics.macroF1,
    lenientAccuracy: lenient,
    outOfDomainRejectionRate: rejection,
    inDomainFalseRejectionRate: falseRejection,
    perIntent: main.per,
    perLanguage: group(rows, 'lang'),
    perCategory: group(rows, 'category'),
  },
  keywordBaseline: { accuracy: base.accuracy, macroF1: base.macroF1, perLanguage: Object.fromEntries(Object.entries(group(rows.map((r) => ({ ...r, pred: r.baseline })), 'lang'))) },
  performance: {
    engineInitMs: initMs,
    latencyMs: { mean: latencies.reduce((a, b) => a + b, 0) / latencies.length, p50: percentile(latencies, 50), p95: percentile(latencies, 95), max: Math.max(...latencies) },
    heapIncreaseMB: (heapAfter - heapBefore) / 1024 / 1024,
    heapUsedMB: process.memoryUsage().heapUsed / 1024 / 1024,
    gcExposed: typeof global.gc === 'function',
    node: process.version,
  },
  normalization: {
    cases: normRows.length,
    exactMatch: normExact,
    correctionPrecision: corrTotal ? corrRight / corrTotal : 1,
    correctionsApplied: corrTotal,
    protectedCases: protectedCases.length,
    falseCorrections: falseCorrections.map((r) => ({ input: r.input, got: r.got })),
    mismatches: normRows.filter((r) => !r.exact).map((r) => ({ input: r.input, expected: r.expected, got: r.got })),
  },
  confusion,
  errors: rows.filter((r) => r.pred !== r.intent).map((r) => ({ text: r.text, gold: r.intent, pred: r.pred, confidence: r.confidence, acceptable: lenientOk(r) })),
}

function toMarkdown(res) {
  const j = res.jalgorithm
  const lines = []
  lines.push(`# JAlgorithm evaluation (${res.set} set)`, '')
  lines.push(`Generated ${res.generatedAt} with a fixed clock (${res.fixedClock}) on Node ${res.performance.node}.`, '')
  lines.push('> The evaluation messages were written by the developers to imitate real client chat. They were not collected from real clients. Treat these numbers as a development benchmark. Thesis results should come from a test set of real, consented client messages.', '')
  lines.push(`Training examples: ${res.sizes.training}. Evaluated messages: ${res.sizes.evaluated} (${res.sizes.unseenOnly} excluding the brief's example messages that were seen during development).`, '')
  lines.push(`Overlap with training data (exact/near-duplicate): ${res.overlapWithTraining.length ? res.overlapWithTraining.join('; ') : 'none'}`, '')
  lines.push('## Intent recognition', '')
  lines.push('| Metric | JAlgorithm | Keyword baseline |', '|---|---|---|')
  lines.push(`| Accuracy (strict) | ${pct(j.accuracy)} | ${pct(res.keywordBaseline.accuracy)} |`)
  lines.push(`| Macro F1 | ${pct(j.macroF1)} | ${pct(res.keywordBaseline.macroF1)} |`)
  lines.push(`| Accuracy excl. seen-in-development | ${pct(j.accuracyExcludingSeenInDevelopment)} | |`)
  lines.push(`| Macro F1 excl. seen-in-development | ${pct(j.macroF1ExcludingSeenInDevelopment)} | |`)
  lines.push(`| Lenient accuracy (accepts listed alternatives / clarification) | ${pct(j.lenientAccuracy)} | |`)
  lines.push(`| Out-of-domain messages rejected as UNKNOWN | ${pct(j.outOfDomainRejectionRate)} | |`)
  lines.push(`| In-domain messages wrongly rejected as UNKNOWN | ${pct(j.inDomainFalseRejectionRate)} | |`, '')
  lines.push('### Per intent', '', '| Intent | Precision | Recall | F1 | Support |', '|---|---|---|---|---|')
  for (const [l, m] of Object.entries(j.perIntent)) lines.push(`| ${l} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.f1)} | ${m.support} |`)
  lines.push('', '### Per language', '', '| Language | N | JAlgorithm | Keyword baseline |', '|---|---|---|---|')
  for (const [l, m] of Object.entries(j.perLanguage)) lines.push(`| ${l} | ${m.n} | ${pct(m.accuracy)} | ${pct(res.keywordBaseline.perLanguage[l]?.accuracy ?? 0)} |`)
  lines.push('', '### Per category', '', '| Category | N | Accuracy |', '|---|---|---|')
  for (const [c, m] of Object.entries(j.perCategory)) lines.push(`| ${c} | ${m.n} | ${pct(m.accuracy)} |`)
  lines.push('', '### Confusion matrix (rows = gold, columns = predicted)', '')
  const abbr = (l) => l.replace('APPOINTMENT', 'APPT').replace('_INTENT', '').replace('ASK_', '').replace('OPERATING_', '')
  lines.push(`| gold \\ pred | ${labels.map(abbr).join(' | ')} |`, `|---|${labels.map(() => '---').join('|')}|`)
  for (const g of labels) lines.push(`| ${abbr(g)} | ${labels.map((p) => confusion[g][p] || '·').join(' | ')} |`)
  lines.push('', '## Performance', '')
  const p = res.performance
  lines.push(`- Engine start-up (normalize training data + train Naive Bayes and TF-IDF): ${p.engineInitMs.toFixed(1)} ms`)
  lines.push(`- Per-message analysis latency: mean ${p.latencyMs.mean.toFixed(2)} ms, p50 ${p.latencyMs.p50.toFixed(2)} ms, p95 ${p.latencyMs.p95.toFixed(2)} ms, max ${p.latencyMs.max.toFixed(2)} ms`)
  lines.push(`- Heap increase from creating the engine: ${p.heapIncreaseMB.toFixed(2)} MB${p.gcExposed ? '' : ' (approximate; run with node --expose-gc for a cleaner measurement)'}; total heap in use after the run: ${p.heapUsedMB.toFixed(1)} MB`)
  lines.push('- Latency excludes Supabase calls, which depend on the network.', '')
  lines.push('## Normalization', '')
  const n = res.normalization
  lines.push(`- Cases: ${n.cases}; exact match of the normalized form: ${pct(n.exactMatch)}`)
  lines.push(`- Inputs changed by the normalizer: ${n.correctionsApplied}; of those, correctly normalized: ${pct(n.correctionPrecision)}`)
  lines.push(`- False corrections in ${n.protectedCases} protected-word cases: ${n.falseCorrections.length}`)
  if (n.mismatches.length) {
    lines.push('', '| Input | Expected | Got |', '|---|---|---|')
    for (const m of n.mismatches) lines.push(`| ${m.input} | ${m.expected} | ${m.got} |`)
  }
  lines.push('', '## Misclassified messages', '', '| Message | Gold | Predicted | Confidence | Acceptable alternative? |', '|---|---|---|---|---|')
  for (const e of res.errors) lines.push(`| ${e.text.replace(/\|/g, '/')} | ${e.gold} | ${e.pred} | ${e.confidence} | ${e.acceptable ? 'yes' : 'no'} |`)
  return lines.join('\n') + '\n'
}

const md = toMarkdown(result)
if (write) {
  mkdirSync(join(ROOT, 'reports'), { recursive: true })
  const suffix = setName === 'test' ? '' : `-${setName}`
  writeFileSync(join(ROOT, `reports/evaluation${suffix}.json`), JSON.stringify(result, null, 2))
  writeFileSync(join(ROOT, `reports/evaluation${suffix}.md`), md)
}

const j = result.jalgorithm
console.log(`JAlgorithm on ${setName} set (${rows.length} messages)`)
console.log(`  accuracy ${pct(j.accuracy)}  macro-F1 ${pct(j.macroF1)}  lenient ${pct(j.lenientAccuracy)}  excl-seen ${pct(j.accuracyExcludingSeenInDevelopment)}`)
console.log(`  keyword baseline: accuracy ${pct(result.keywordBaseline.accuracy)}  macro-F1 ${pct(result.keywordBaseline.macroF1)}`)
console.log(`  OOD rejection ${pct(j.outOfDomainRejectionRate)}  in-domain false rejection ${pct(j.inDomainFalseRejectionRate)}`)
console.log(`  per language: ${Object.entries(j.perLanguage).map(([k, v]) => `${k} ${pct(v.accuracy)} (n=${v.n})`).join(', ')}`)
console.log(`  latency p50 ${result.performance.latencyMs.p50.toFixed(2)} ms, p95 ${result.performance.latencyMs.p95.toFixed(2)} ms; init ${initMs.toFixed(1)} ms`)
console.log(`  normalization exact ${pct(normExact)}, false corrections ${falseCorrections.length}/${protectedCases.length}`)
console.log(`  overlap with training: ${overlaps.length}`)
if (args.includes('--errors')) for (const e of result.errors) console.log(`   ✗ ${e.gold.padEnd(24)} → ${e.pred.padEnd(24)} ${e.confidence}  ${e.text}`)
if (args.includes('--errors')) for (const m of result.normalization.mismatches) console.log(`   norm ✗ ${m.input} → ${m.got} (expected ${m.expected})`)
