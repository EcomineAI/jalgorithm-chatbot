import { useMemo, useState } from 'react'
import { Play, Zap, ShieldCheck, AlertTriangle, Copy, Check } from 'lucide-react'
import { createJAlgorithm } from '../../jalgorithm/index.js'
import { useBusinessInfo } from '../../lib/useBusinessInfo.js'
import { copyText } from '../../lib/nluDebug.js'
import {
  BATCH_TEST_SUITES,
  parseBatchInput,
  runBatchNluEvaluation,
} from '../../lib/devTools.js'

export default function DevBatchTesterTab() {
  const { catalog } = useBusinessInfo()
  const [rawText, setRawText] = useState(BATCH_TEST_SUITES[0].phrases.join('\n'))
  const [activeSuiteId, setActiveSuiteId] = useState(BATCH_TEST_SUITES[0].id)
  const [report, setReport] = useState(null)
  const [copiedJson, setCopiedJson] = useState(false)

  const bot = useMemo(
    () => createJAlgorithm({ catalog: catalog || undefined }),
    [catalog],
  )

  function runWithText(textToTest) {
    if (!bot) return
    const phrases = parseBatchInput(textToTest)
    const nextReport = runBatchNluEvaluation(bot, phrases)
    setReport(nextReport)
  }

  function handlePickSuite(suite) {
    const text = suite.phrases.join('\n')
    setActiveSuiteId(suite.id)
    setRawText(text)
    runWithText(text)
  }

  async function handleCopyJson() {
    if (!report) return
    const ok = await copyText(JSON.stringify(report, null, 2))
    if (!ok) return
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 1800)
  }

  const activeReport = useMemo(() => {
    if (report) return report
    if (!bot) return null
    return runBatchNluEvaluation(bot, parseBatchInput(rawText))
  }, [report, bot, rawText])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-12 gap-5">
        {/* Left: Input & Presets */}
        <div className="col-span-4 bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Batch NLU Stress Tester</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Test multiple client messages in 1 click using the live in-browser JAlgorithm engine (zero database writes).
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-stone-500">
              Quick test packs
            </div>
            <div className="space-y-2">
              {BATCH_TEST_SUITES.map((suite) => (
                <button
                  key={suite.id}
                  type="button"
                  onClick={() => handlePickSuite(suite)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    activeSuiteId === suite.id
                      ? 'bg-pink-50 border-pink-300'
                      : 'bg-[#fdfcfa] border-stone-200/80 hover:bg-stone-100'
                  }`}
                >
                  <div className="text-xs font-semibold text-stone-900">{suite.label}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{suite.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-stone-500">
              Test phrases (1 per line, max 60)
            </label>
            <textarea
              rows={7}
              value={rawText}
              onChange={(e) => {
                setActiveSuiteId('custom')
                setRawText(e.target.value)
              }}
              placeholder="Paste phrases, one per line"
              className="w-full rounded-lg border border-stone-200/80 bg-white p-3 text-xs font-mono text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runWithText(rawText)}
              className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 min-h-10 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-xs font-medium"
            >
              <Play size={13} />
              Run Batch Test
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              disabled={!activeReport}
              className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-lg border border-stone-200/80 bg-[#fdfcfa] text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors"
            >
              {copiedJson ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              {copiedJson ? 'Copied' : 'JSON'}
            </button>
          </div>
        </div>

        {/* Right: Summary & Results Table */}
        <div className="col-span-8 space-y-4">
          {activeReport && (
            <>
              <div className="grid grid-cols-4 gap-3 tabular-nums">
                <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 p-4">
                  <div className="text-xs font-normal text-stone-500">Phrases Tested</div>
                  <div className="text-2xl font-medium text-stone-900 mt-1">{activeReport.summary.total}</div>
                </div>
                <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 p-4">
                  <div className="text-xs font-normal text-stone-500">Matched Intent</div>
                  <div className="text-2xl font-medium text-emerald-700 mt-1">{activeReport.summary.matched}</div>
                </div>
                <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 p-4">
                  <div className="text-xs font-normal text-stone-500">Trash Filtered</div>
                  <div className="text-2xl font-medium text-amber-700 mt-1">{activeReport.summary.trashCount}</div>
                </div>
                <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 p-4">
                  <div className="text-xs font-normal text-stone-500">Avg Engine Speed</div>
                  <div className="text-2xl font-medium text-pink-700 mt-1 flex items-center gap-1">
                    <Zap size={16} />
                    {activeReport.summary.avgMs} ms
                  </div>
                </div>
              </div>

              <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200/80 bg-[#f8f6f2] text-xs font-medium text-stone-500">
                      <th className="py-3 px-4">Input Phrase</th>
                      <th className="py-3 px-4">Predicted Intent</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4">Speed</th>
                      <th className="py-3 px-4">Owner Log Routing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200/60 text-xs">
                    {activeReport.rows.map((row, idx) => (
                      <tr key={`${row.phrase}-${idx}`} className="hover:bg-stone-100/50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-stone-900">{row.phrase}</div>
                          {row.normalized !== row.phrase.toLowerCase() && (
                            <div className="text-xs text-stone-400 font-mono">
                              norm: {row.normalized}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md font-mono text-xs font-medium ${
                              row.isUnknown
                                ? 'bg-stone-100 text-stone-600'
                                : 'bg-pink-50 text-pink-700'
                            }`}
                          >
                            {row.intent}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-700 tabular-nums">
                          {Math.round(row.confidence * 100)}%
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-500 tabular-nums">
                          {row.elapsedMs} ms
                        </td>
                        <td className="py-3 px-4">
                          {row.isTrash ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle size={11} />
                              Trash Filtered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ShieldCheck size={11} />
                              Owner Logged
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
