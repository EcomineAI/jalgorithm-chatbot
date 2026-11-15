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
        <div className="col-span-4 bg-white rounded-2xl border border-pink-100 shadow-xs p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Batch NLU Stress Tester</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Test multiple client messages in 1 click using the live in-browser JAlgorithm engine (zero database writes).
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Quick Test Packs
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
                      : 'bg-white border-pink-100 hover:bg-rose-50/40'
                  }`}
                >
                  <div className="text-xs font-bold text-gray-900">{suite.label}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{suite.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Test Phrases (1 per line, max 60)
            </label>
            <textarea
              rows={7}
              value={rawText}
              onChange={(e) => {
                setActiveSuiteId('custom')
                setRawText(e.target.value)
              }}
              placeholder="Paste test phrases here, one per line..."
              className="w-full rounded-xl border border-pink-100 p-3 text-xs font-mono text-gray-800 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runWithText(rawText)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-colors shadow-xs"
            >
              <Play size={13} />
              Run Batch Test
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              disabled={!activeReport}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-pink-200 text-xs font-semibold text-gray-700 hover:bg-pink-50 transition-colors"
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
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-pink-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-gray-500">Phrases Tested</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{activeReport.summary.total}</div>
                </div>
                <div className="bg-white rounded-2xl border border-pink-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-gray-500">Matched Intent</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">{activeReport.summary.matched}</div>
                </div>
                <div className="bg-white rounded-2xl border border-pink-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-gray-500">Trash Filtered</div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">{activeReport.summary.trashCount}</div>
                </div>
                <div className="bg-white rounded-2xl border border-pink-100 p-4 shadow-xs">
                  <div className="text-[11px] font-semibold text-gray-500">Avg Engine Speed</div>
                  <div className="text-2xl font-bold text-pink-600 mt-1 flex items-center gap-1">
                    <Zap size={16} />
                    {activeReport.summary.avgMs} ms
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-pink-100 shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-pink-100 bg-rose-50/40 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      <th className="py-3 px-4">Input Phrase</th>
                      <th className="py-3 px-4">Predicted Intent</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4">Speed</th>
                      <th className="py-3 px-4">Owner Log Routing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-50 text-xs">
                    {activeReport.rows.map((row, idx) => (
                      <tr key={`${row.phrase}-${idx}`} className="hover:bg-rose-50/20">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900">{row.phrase}</div>
                          {row.normalized !== row.phrase.toLowerCase() && (
                            <div className="text-[11px] text-gray-400 font-mono">
                              norm: {row.normalized}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                              row.isUnknown
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-pink-50 text-pink-700'
                            }`}
                          >
                            {row.intent}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-700">
                          {Math.round(row.confidence * 100)}%
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-500">
                          {row.elapsedMs} ms
                        </td>
                        <td className="py-3 px-4">
                          {row.isTrash ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle size={11} />
                              Trash Filtered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
