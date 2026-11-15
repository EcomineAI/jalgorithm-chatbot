import { useEffect, useMemo, useState } from 'react'
import {
  Brain,
  CheckCircle2,
  Filter,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Tag,
  Terminal,
} from 'lucide-react'
import { createJAlgorithm } from '../../jalgorithm/index.js'
import { CLASSIFIER_CONFIG } from '../../jalgorithm/config/intents.js'
import { useBusinessInfo } from '../../lib/useBusinessInfo.js'
import { isTrashChatLog } from '../../lib/ownerInsights.js'

const PRESET_MESSAGES = [
  { label: 'Taglish Price + Date', text: 'hm bridal makeup sa nov 25 ng 3pm?' },
  { label: 'Shortcut Booking', text: 'pwde b magpabook hair and makeup bukas ng 10am' },
  { label: 'Reschedule Shortcut', text: 'pa-move po sched q sa dec 10' },
  { label: 'Trash / Spam Guard', text: 'asdfghjkl' },
]

const PIPELINE_STAGES = [
  { id: 1, short: '1. Preprocess', title: 'Input Preprocessing' },
  { id: 2, short: '2. Tokenizer', title: 'Typed Tokenization' },
  { id: 3, short: '3. Normalizer', title: '4-Pass Normalization' },
  { id: 4, short: '4. Entities & Tags', title: 'Entity & Concept Extraction' },
  { id: 5, short: '5. Late Fusion', title: '3-Model Ensemble Race' },
  { id: 6, short: '6. Decision Gate', title: 'Guards & Final Intent' },
]

function AnimatedWire({ active, passed }) {
  return (
    <div className="relative flex items-center justify-center w-9 shrink-0 h-8">
      <svg viewBox="0 0 40 16" className="w-full h-4 overflow-visible">
        <line
          x1="0"
          y1="8"
          x2="40"
          y2="8"
          stroke={active ? '#ec4899' : passed ? '#10b981' : '#f3d1df'}
          strokeWidth="2.5"
          strokeLinecap="round"
          className={active ? 'animate-flow-dash' : ''}
        />
      </svg>
      {active && (
        <span
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.85)] animate-packet-slide pointer-events-none"
        />
      )}
    </div>
  )
}

export default function DevNluAnimationTab() {
  const { catalog } = useBusinessInfo()
  const [inputText, setInputText] = useState(PRESET_MESSAGES[0].text)
  const [submittedText, setSubmittedText] = useState(PRESET_MESSAGES[0].text)
  const [activeStep, setActiveStep] = useState(1)
  const [isPlaying, setIsPlaying] = useState(true)
  const [speedMs, setSpeedMs] = useState(1100)

  const bot = useMemo(
    () => createJAlgorithm({ catalog: catalog || undefined }),
    [catalog],
  )

  const trace = useMemo(() => {
    const clean = String(submittedText || '').trim() || PRESET_MESSAGES[0].text
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const nlu = bot.analyze(clean)
    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const elapsedMs = Number(Math.max(0.05, ended - started).toFixed(2))
    const trashFlag = isTrashChatLog({
      user_message: clean,
      intent_classified: nlu.intent,
      confidence: nlu.confidence,
      entities: nlu.entities,
    })
    return { nlu, elapsedMs, trashFlag }
  }, [bot, submittedText])

  useEffect(() => {
    if (!isPlaying) return undefined
    const timer = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= 6) {
          setIsPlaying(false)
          return 6
        }
        return prev + 1
      })
    }, speedMs)
    return () => clearInterval(timer)
  }, [isPlaying, speedMs])

  function handleRunAnimation(nextText = inputText) {
    const trimmed = String(nextText || '').trim()
    if (!trimmed) return
    setSubmittedText(trimmed)
    setActiveStep(1)
    setIsPlaying(true)
  }

  function handleReplay() {
    setActiveStep(1)
    setIsPlaying(true)
  }

  const { nlu, elapsedMs, trashFlag } = trace
  const topIntent = nlu.intent
  const topCandidate = nlu.ranked?.[0]?.intent || topIntent
  const rulesScore = nlu.components?.rules?.[topCandidate] ?? 0
  const nbScore = nlu.components?.naiveBayes?.[topCandidate] ?? 0
  const tfidfScore = nlu.components?.tfidf?.[topCandidate] ?? 0
  const fusionReached = activeStep >= 5
  const decisionReached = activeStep >= 6

  return (
    <div className="space-y-5">
      {/* Controls & Message Runner */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center shrink-0">
              <Brain size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Real-Time Moving NLU Pipeline Simulator
              </h2>
              <p className="text-xs text-gray-500">
                Watch how a live message moves step-by-step inside JAlgorithm (`0.45 Rules + 0.35 Naive Bayes + 0.20 TF-IDF`).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-500">Speed:</span>
            {[
              { label: '0.5x', ms: 1900 },
              { label: '1x', ms: 1100 },
              { label: '2x', ms: 550 },
            ].map((sp) => (
              <button
                key={sp.label}
                type="button"
                onClick={() => setSpeedMs(sp.ms)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  speedMs === sp.ms
                    ? 'bg-gray-900 text-pink-300 border-gray-900'
                    : 'bg-white text-gray-600 border-pink-100 hover:bg-pink-50'
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Terminal size={14} className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunAnimation(inputText)
              }}
              placeholder="Type any English, Tagalog, or Taglish message to animate..."
              className="w-full min-h-[42px] border border-pink-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-900 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
            />
          </div>

          <button
            type="button"
            onClick={() => handleRunAnimation(inputText)}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Play size={13} />
            Animate Message
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl border border-pink-200 bg-white hover:bg-pink-50 text-xs font-semibold text-gray-700 transition-colors"
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            {isPlaying ? 'Pause' : 'Resume'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false)
              setActiveStep((s) => Math.max(1, s - 1))
            }}
            title="Previous Step"
            className="min-h-[42px] px-3 rounded-xl border border-pink-100 bg-white hover:bg-pink-50 text-gray-600 transition-colors"
          >
            <SkipBack size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false)
              setActiveStep((s) => Math.min(6, s + 1))
            }}
            title="Next Step"
            className="min-h-[42px] px-3 rounded-xl border border-pink-100 bg-white hover:bg-pink-50 text-gray-600 transition-colors"
          >
            <SkipForward size={14} />
          </button>

          <button
            type="button"
            onClick={handleReplay}
            title="Replay from Stage 1"
            className="inline-flex items-center gap-1 min-h-[42px] px-3 rounded-xl border border-pink-100 bg-white hover:bg-pink-50 text-xs font-semibold text-gray-600 transition-colors"
          >
            <RotateCcw size={13} />
            Replay
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-400">Presets:</span>
          {PRESET_MESSAGES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setInputText(preset.text)
                handleRunAnimation(preset.text)
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                submittedText === preset.text
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-rose-50/40 text-gray-700 border-pink-100 hover:bg-pink-50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Moving Horizontal 6-Stage Pipeline Diagram */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-gray-800">
            Live Signal Flow (Click any stage or let animation run)
          </div>
          <div className="text-[11px] font-mono text-gray-500">
            Stage {activeStep} of 6 · Engine runtime {elapsedMs} ms
          </div>
        </div>

        <div className="flex items-center justify-between">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isActive = activeStep === stage.id
            const isPassed = activeStep > stage.id
            return (
              <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false)
                    setActiveStep(stage.id)
                  }}
                  className={`flex-1 min-w-[140px] text-left p-3.5 rounded-2xl border transition-all duration-300 ${
                    isActive
                      ? 'bg-pink-500 text-white border-pink-500 shadow-md scale-[1.03] animate-pulse-glow'
                      : isPassed
                        ? 'bg-emerald-50/70 text-emerald-900 border-emerald-200'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-pink-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isActive ? 'text-pink-100' : isPassed ? 'text-emerald-600' : 'text-gray-400'
                      }`}
                    >
                      {stage.short}
                    </span>
                    {isPassed && <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />}
                    {isActive && <Sparkles size={13} className="text-white animate-spin-slow shrink-0" />}
                  </div>
                  <div className="text-xs font-bold mt-1 leading-snug">{stage.title}</div>
                </button>

                {idx < PIPELINE_STAGES.length - 1 && (
                  <AnimatedWire active={activeStep === stage.id} passed={activeStep > stage.id} />
                )}
              </div>
            )
          })}
        </div>

        {/* Parallel 3-Lane Late Fusion Visualization */}
        <div className="rounded-2xl border border-pink-100 bg-rose-50/25 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-gray-900">
                Parallel Late Fusion Classification Race (Target Intent: <span className="font-mono text-pink-600">{topCandidate}</span>)
              </div>
              <div className="text-[11px] text-gray-500">
                All 3 lightweight classifiers vote simultaneously; their weighted votes merge in Stage 5.
              </div>
            </div>
            <span className="font-mono text-[11px] font-semibold bg-white border border-pink-200 px-3 py-1 rounded-full text-gray-700">
              Fused = 0.45 Rules + 0.35 NB + 0.20 TF-IDF
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Lane 1: Rule Scorer',
                weight: `${Math.round(CLASSIFIER_CONFIG.weights.rules * 100)}% Weight`,
                rawScore: rulesScore,
                barColor: 'bg-pink-500',
                desc: 'Weighted concept tags + conflict penalties',
              },
              {
                label: 'Lane 2: Multinomial Naive Bayes',
                weight: `${Math.round(CLASSIFIER_CONFIG.weights.naiveBayes * 100)}% Weight`,
                rawScore: nbScore,
                barColor: 'bg-purple-500',
                desc: 'Learned word/bigram & tag probabilities',
              },
              {
                label: 'Lane 3: TF-IDF Cosine',
                weight: `${Math.round(CLASSIFIER_CONFIG.weights.tfidf * 100)}% Weight`,
                rawScore: tfidfScore,
                barColor: 'bg-emerald-500',
                desc: 'Lexical centroid & nearest match similarity',
              },
            ].map((lane) => {
              const pct = fusionReached ? Math.min(100, Math.round(lane.rawScore * 100)) : 0
              return (
                <div
                  key={lane.label}
                  className={`rounded-xl border p-4 bg-white transition-all duration-500 space-y-2 ${
                    activeStep === 5 ? 'border-pink-400 shadow-xs' : 'border-pink-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-900">{lane.label}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {lane.weight}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${lane.barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">{lane.desc}</span>
                    <span className="font-mono font-bold text-gray-800">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Stage-by-Stage Live Inspector */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left: Live Data Output at Current Stage */}
        <div className="col-span-7 bg-white rounded-2xl border border-pink-100 shadow-xs p-6 space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-pink-500">
            Stage {activeStep} Output Inspection
          </div>

          {activeStep === 1 && (
            <div className="space-y-3 animate-msg-in">
              <h3 className="text-base font-bold text-gray-900">Preprocess Cleanup</h3>
              <p className="text-xs text-gray-600">
                Normalizes Unicode, lowercases text, converts symbols (`&` / `+` -&gt; `and`), collapses stretched letters (`pleaseee` -&gt; `please`), and caps input at 500 characters while keeping the original text untouched.
              </p>
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2 text-xs font-mono">
                <div><span className="text-gray-400">Original:</span> {nlu.original}</div>
                <div><span className="text-pink-600">Cleaned: </span> {nlu.normalized}</div>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-3 animate-msg-in">
              <h3 className="text-base font-bold text-gray-900">Typed Tokenization</h3>
              <p className="text-xs text-gray-600">
                Splits the cleaned message into typed tokens so structured values like `JAL-XXXXX`, PH mobile numbers, dates, and clock times are protected from word spell-correction.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(nlu.tokens || []).map((tok, i) => (
                  <span
                    key={`${tok.value}-${i}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-pink-200 text-xs font-mono"
                  >
                    <strong className="text-gray-900">{tok.value}</strong>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-pink-600 border border-pink-100">
                      {tok.type}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-3 animate-msg-in">
              <h3 className="text-base font-bold text-gray-900">4-Pass Normalization (Shortcuts &amp; Taglish Morphology)</h3>
              <p className="text-xs text-gray-600">
                Applies hyphen splitting, plain &amp; context-guarded shortcuts (`hm` -&gt; `magkano`), Filipino prefix splitting (`magpabook` -&gt; `magpa book`), and guarded Damerau-Levenshtein typo fixes.
              </p>
              {nlu.changes?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {nlu.changes.map((ch, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-mono text-purple-900"
                    >
                      <span>{ch.from}</span>
                      <span className="text-purple-400">-&gt;</span>
                      <strong>{ch.to}</strong>
                      <span className="text-[10px] text-purple-600">({ch.pass || 'norm'})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500">
                  No token substitutions needed for this sentence (`normalized`: <span className="font-mono">{nlu.normalized}</span>).
                </div>
              )}
            </div>
          )}

          {activeStep === 4 && (
            <div className="space-y-3 animate-msg-in">
              <h3 className="text-base font-bold text-gray-900">Entity &amp; Concept Feature Extraction</h3>
              <p className="text-xs text-gray-600">
                Pulls out structured salon slots (in Asia/Manila time), maps English/Filipino synonyms into unified concept tags (`#PRICE`, `#BOOK`, `#MOVE`), and detects reply language.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-rose-50/40 border border-pink-100 p-3 space-y-1.5">
                  <div className="font-bold text-gray-800">Extracted Entities</div>
                  <div className="font-mono text-[11px] space-y-1 text-gray-700">
                    <div>service: {nlu.entities?.service || 'null'}</div>
                    <div>date: {nlu.entities?.date || 'null'}</div>
                    <div>time: {nlu.entities?.time || 'null'}</div>
                    <div>contact: {nlu.entities?.contact || 'null'}</div>
                    <div>reference: {nlu.entities?.reference || 'null'}</div>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-2">
                  <div className="font-bold text-gray-800 flex items-center gap-1.5">
                    <Tag size={12} />
                    Concept Tags &amp; Language
                  </div>
                  <div className="text-[11px] font-semibold text-pink-600">
                    Detected Language: {nlu.language || 'en'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(nlu.tags || []).length > 0 ? (
                      nlu.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded bg-white border border-gray-200 font-mono text-[11px] text-gray-800"
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-gray-400">No domain concept tags matched</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 5 && (
            <div className="space-y-3 animate-msg-in">
              <h3 className="text-base font-bold text-gray-900">Top 3 Ranked Intents After Late Fusion</h3>
              <p className="text-xs text-gray-600">
                All three normalized probability distributions are combined using the thesis fusion weights (`0.45 / 0.35 / 0.20`), ranking the top candidate intents.
              </p>
              <div className="space-y-2">
                {(nlu.ranked || []).map((item, idx) => (
                  <div key={item.intent} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-bold text-gray-800">
                        #{idx + 1} {item.intent}
                      </span>
                      <span className="text-pink-600 font-bold">{(item.score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          idx === 0 ? 'bg-pink-500' : 'bg-gray-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.round(item.score * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeStep === 6 && (
            <div className="space-y-3 animate-msg-in">
              <h3 className="text-base font-bold text-gray-900">Decision Guard &amp; Owner Log Routing</h3>
              <p className="text-xs text-gray-600">
                Checks out-of-domain relevance, minimum confidence (`&gt;= 30%`), and ambiguity tolerance (`gap &gt;= 10%`), then decides whether to log to Owner Studio or filter as noise.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-pink-200 bg-pink-50/40 p-3.5 space-y-1">
                  <div className="text-[11px] font-semibold text-gray-500">Final Intent Decision</div>
                  <div className="font-mono text-sm font-bold text-pink-700">{nlu.intent}</div>
                  <div className="text-[11px] text-gray-600">
                    Confidence: {Math.round((nlu.confidence || 0) * 100)}%
                    {nlu.reason ? ` (${nlu.reason})` : ''}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-1">
                  <div className="text-[11px] font-semibold text-gray-500">Split Logging Outcome</div>
                  {trashFlag ? (
                    <div className="inline-flex items-center gap-1.5 text-amber-700 font-bold text-xs">
                      <ShieldAlert size={14} />
                      Filtered to Dev Logs Only (Trash)
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                      <ShieldCheck size={14} />
                      Saved to Owner Chat Logs
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Persistent Summary Card */}
        <div className="col-span-5 bg-white rounded-2xl border border-pink-100 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900">Live Classification Verdict</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500">
              <Filter size={11} />
              {decisionReached ? 'Completed' : `Animating Step ${activeStep}/6`}
            </span>
          </div>

          <div className="rounded-xl bg-gray-900 text-white p-4 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-pink-300">
              Predicted Intent
            </div>
            <div className="font-mono text-base font-bold">
              {decisionReached ? nlu.intent : `${topCandidate} (Scoring...)`}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-300 pt-1 border-t border-gray-800">
              <span>Confidence: {Math.round((nlu.confidence || 0) * 100)}%</span>
              <span>Speed: {elapsedMs} ms</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-gray-600">
            <div className="font-bold text-gray-800">Nearest Training Match (TF-IDF)</div>
            <div className="rounded-xl bg-rose-50/40 border border-pink-100 p-3 text-[11px]">
              {nlu.components?.nearest ? (
                <div className="space-y-1">
                  <div>
                    <span className="text-gray-500">Label: </span>
                    <span className="font-mono font-bold text-gray-900">
                      {nlu.components.nearest.label || nlu.components.nearest.intent}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Similarity: </span>
                    <span className="font-mono font-bold text-pink-600">
                      {Math.round((nlu.components.nearest.similarity || 0) * 100)}%
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-gray-400">No training vector match</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
