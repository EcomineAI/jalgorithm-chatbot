import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Send,
  RotateCcw,
  Sparkles,
  Terminal,
  Zap,
  ShieldCheck,
  Database,
  Copy,
  Check,
  AlertTriangle,
  Reply,
  X,
} from 'lucide-react'
import { createJAlgorithm } from '../../jalgorithm/index.js'
import { createAppointmentService } from '../../services/appointments.js'
import { supabase } from '../../lib/supabase.js'
import { useBusinessInfo } from '../../lib/useBusinessInfo.js'
import { isOwnerImportantLog } from '../../lib/ownerInsights.js'
import { buildDebugSnapshot, copyText } from '../../lib/nluDebug.js'
import { lookupServiceName, hasSavedSetup } from '../../lib/chatSessions.js'
import {
  ChatBubble,
  FlowControls,
  BOOKING_STEPS,
  getBookingStepIndex,
} from '../../components/ChatWidgets.jsx'

const DEFAULT_SAMPLE_PHRASES = [
  'Magkano bridal makeup?',
  'Do you travel to Subic Bay?',
  'Book glam makeup next Saturday 10am',
  'What payment methods do you accept?',
  'asdfghjkl',
  'Check booking JAL-DRY01',
]

function createDryRunActions(liveActions) {
  return {
    getAvailableSlots: async ({ date, serviceKey = null }) => {
      const res = await liveActions.getAvailableSlots({ date, serviceKey })
      if (res.ok || (res.reason && res.reason !== 'unreachable')) return res
      return { ok: true, data: { slots: ['08:00', '10:00', '13:00', '15:30'], date } }
    },
    bookAppointment: async ({ serviceKey, date, time, name, contact, location }) => ({
      ok: true,
      data: {
        reference_code: 'JAL-DRY01',
        service_key: serviceKey,
        appointment_date: date,
        appointment_time: time,
        client_name: name,
        client_contact: contact,
        location: location || null,
      },
    }),
    findAppointment: async ({ reference, contact }) => {
      if (['DRY-TEST1', 'JAL-DRY01'].includes(String(reference || '').toUpperCase())) {
        return {
          ok: true,
          data: {
            reference_code: 'JAL-DRY01',
            service_key: 'bridal',
            service_type: 'Bridal Makeup',
            appointment_date: '2026-12-15',
            appointment_time: '09:00',
            client_name: 'Sample Client',
            client_contact: contact || '09171234567',
            status: 'confirmed',
          },
        }
      }
      return liveActions.findAppointment({ reference, contact })
    },
    rescheduleAppointment: async ({ reference, date, time }) => ({
      ok: true,
      data: {
        reference_code: reference || 'JAL-DRY01',
        appointment_date: date,
        appointment_time: time,
        status: 'rescheduled',
      },
    }),
    cancelAppointment: async ({ reference }) => ({
      ok: true,
      data: { reference_code: reference || 'JAL-DRY01', status: 'cancelled' },
    }),
  }
}

export default function OwnerChatSandbox({ mode = 'owner' }) {
  const { catalog } = useBusinessInfo()
  const [dryRun, setDryRun] = useState(true)
  const [messages, setMessages] = useState([])
  const [botState, setBotState] = useState(undefined)
  const [lastDebug, setLastDebug] = useState(null)
  const [lastTurnState, setLastTurnState] = useState(null)
  const [input, setInput] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [sending, setSending] = useState(false)
  const [copiedTrace, setCopiedTrace] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const liveActions = useMemo(() => createAppointmentService(supabase), [])
  const dryRunActions = useMemo(() => createDryRunActions(liveActions), [liveActions])

  const bot = useMemo(() => {
    if (!catalog) return null
    return createJAlgorithm({
      actions: dryRun ? dryRunActions : liveActions,
      catalog,
    })
  }, [catalog, dryRun, dryRunActions, liveActions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, botState])

  function handleReset() {
    if (hasSavedSetup({ state: botState, messages }) && !confirmReset) {
      setConfirmReset(true)
      return
    }
    setConfirmReset(false)
    setMessages([])
    setBotState(undefined)
    setLastDebug(null)
    setLastTurnState(null)
    setReplyTarget(null)
    inputRef.current?.focus()
  }

  function handleJumpToMessage(msgId) {
    if (!msgId) return
    const el = document.getElementById(`msg-${msgId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function handleSend(rawText, explicitReplyTarget) {
    const text = String(rawText ?? '').trim()
    if (!text || sending || !bot) return

    setSending(true)
    setInput('')
    setConfirmReset(false)

    const activeReply = explicitReplyTarget !== undefined ? explicitReplyTarget : replyTarget
    setReplyTarget(null)

    const now = new Date()
    const replyContext = activeReply
      ? {
          text: activeReply.content,
          intent: activeReply.intent ?? null,
          role: activeReply.role,
          appointment: activeReply.appointment ?? null,
          serviceKey: activeReply.serviceKey ?? activeReply.appointment?.service_key ?? null,
        }
      : null

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      replyTo: activeReply
        ? { id: activeReply.id, role: activeReply.role, text: (activeReply.content || '').slice(0, 140) }
        : null,
      createdAt: now.toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const result = await bot.processMessage(text, botState, { replyContext })
      const debug = buildDebugSnapshot(result)
      const ownerLogged = isOwnerImportantLog({
        user_message: text,
        intent_classified: result.intent,
        confidence: result.nlu?.confidence ?? null,
        entities: result.nlu
          ? {
              date: result.nlu.entities?.date,
              time: result.nlu.entities?.time,
              service: result.nlu.entities?.service,
              action: result.action,
            }
          : null,
      })

      const botMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.reply,
        intent: result.intent,
        confidence: result.nlu?.confidence ?? null,
        elapsedMs: result.elapsedMs ?? null,
        isTrash: !ownerLogged,
        serviceKey: result.nlu?.entities?.service ?? result.state?.flow?.slots?.service ?? null,
        replyTo: activeReply
          ? { id: userMsg.id, role: 'user', text: text.slice(0, 140) }
          : null,
        handoff: result.handoff ?? null,
        appointment: result.appointment ?? null,
        meta: {
          intent: result.intent,
          confidence: result.nlu?.confidence ?? null,
          elapsedMs: result.elapsedMs ?? null,
          isTrash: !ownerLogged,
        },
        createdAt: new Date().toISOString(),
        debug,
      }

      setMessages((prev) => [...prev, botMsg])
      setBotState(result.state)
      setLastDebug(debug)
      setLastTurnState(result.state)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Sandbox error: ${err?.message || 'Unable to process test message.'}`,
          intent: 'ERROR',
          confidence: null,
          isTrash: false,
          createdAt: new Date().toISOString(),
          debug: null,
        },
      ])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function handleCopyTrace() {
    const payload = JSON.stringify(
      {
        mode,
        dryRun,
        business: catalog?.business?.name,
        lastDebug,
        state: lastTurnState,
        transcript: messages.map((m) => ({
          role: m.role,
          content: m.content,
          intent: m.intent,
          confidence: m.confidence,
          isTrash: m.isTrash,
        })),
      },
      null,
      2
    )
    const ok = await copyText(payload)
    if (!ok) return
    setCopiedTrace(true)
    setTimeout(() => setCopiedTrace(false), 1800)
  }

  const isDev = mode === 'dev'
  const flow = lastTurnState?.flow
  const bookingStepIdx = getBookingStepIndex(botState?.flow)

  return (
    <div className={`grid gap-5 ${isDev ? 'lg:grid-cols-12' : 'lg:grid-cols-12 max-w-6xl'}`}>
      {/* Left: Interactive Sandbox Chat */}
      <div className={`${isDev ? 'lg:col-span-7' : 'lg:col-span-8'} bg-white rounded-2xl border border-pink-100/80 shadow-xs flex flex-col overflow-hidden min-h-[580px] max-h-[78vh]`}>
        {/* Top bar */}
        <div className="px-4 py-3 border-b border-gray-100 bg-rose-50/40 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center shrink-0">
              {isDev ? <Terminal size={15} /> : <Sparkles size={15} />}
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">
                {isDev ? 'JAlgorithm Dev Runner' : 'Owner Reply Tester'}
              </div>
              <div className="text-[11px] text-gray-500">
                Uses your latest saved services, hours, travel &amp; payment policies
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDryRun((v) => !v)}
              title="Toggle Dry-Run vs Live Slot/Booking RPCs (chat logs are never recorded from Sandbox)"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                dryRun
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              {dryRun ? <ShieldCheck size={13} /> : <Database size={13} />}
              {dryRun ? 'Dry-Run (No DB Writes)' : 'Live DB Actions'}
            </button>
            {confirmReset ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-2 py-1.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-pink-600 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <RotateCcw size={13} />
                Reset
              </button>
            )}
          </div>
        </div>

        {!dryRun && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-800 flex items-center gap-2">
            <AlertTriangle size={13} className="shrink-0" />
            Live DB mode is active: confirming a booking here calls real Supabase booking functions (turns still stay out of Owner Chat Logs).
          </div>
        )}

        {bookingStepIdx >= 0 && (
          <div className="bg-white border-b border-pink-100/80 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
            {BOOKING_STEPS.map((step, idx) => {
              const done = idx < bookingStepIdx
              const current = idx === bookingStepIdx
              return (
                <div key={step.key} className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] font-semibold flex items-center justify-center shrink-0 ${
                      done
                        ? 'bg-pink-500 text-white'
                        : current
                          ? 'bg-pink-100 text-pink-600 border border-pink-300'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {done ? <Check size={10} /> : idx + 1}
                  </span>
                  <span
                    className={`text-[11px] truncate ${
                      current ? 'font-semibold text-pink-600' : done ? 'font-medium text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < BOOKING_STEPS.length - 1 && (
                    <div className={`hidden sm:block flex-1 h-px ${done ? 'bg-pink-300' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Quick phrase chips */}
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/70 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-400 mr-1">Try:</span>
          {DEFAULT_SAMPLE_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => handleSend(phrase, null)}
              disabled={sending || !bot}
              className="text-[11px] font-medium bg-white hover:bg-pink-50 text-gray-600 hover:text-pink-600 border border-gray-200 hover:border-pink-200 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
            >
              {phrase}
            </button>
          ))}
        </div>

        {/* Message thread + Interactive Guest Controls */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/40">
          {messages.length === 0 ? (
            <div className="py-4 space-y-4">
              <div className="flex flex-col items-center justify-center text-center px-4">
                <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center mb-2.5">
                  <Sparkles size={18} />
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  {isDev ? 'Ready for NLU & dialogue testing' : 'Preview how JAL answers clients'}
                </p>
                <p className="text-xs text-gray-400 max-w-sm mt-1">
                  Uses the exact same interactive controls, location picker, and confirmation cards as the public guest chat.
                </p>
              </div>
              {bot && (
                <FlowControls
                  state={botState}
                  catalog={catalog}
                  disabled={sending}
                  showStarters={true}
                  onSelect={(value) => handleSend(value, null)}
                  onResumeDraft={() => handleSend('resume', null)}
                  onDiscardDraft={() => handleSend('discard draft', null)}
                />
              )}
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  catalog={catalog}
                  showDevMeta={true}
                  onReply={(msg) => {
                    setReplyTarget(msg)
                    inputRef.current?.focus()
                  }}
                  onJumpToMessage={handleJumpToMessage}
                />
              ))}
              {bot && !sending && (
                <FlowControls
                  state={botState}
                  catalog={catalog}
                  disabled={sending}
                  showStarters={false}
                  onSelect={(value) => handleSend(value, null)}
                  onResumeDraft={() => handleSend('resume', null)}
                  onDiscardDraft={() => handleSend('discard draft', null)}
                />
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar with reply context indicator */}
        <div className="p-3 border-t border-gray-100 bg-white space-y-2">
          {replyTarget && (
            <div className="flex items-center justify-between gap-2 bg-pink-50/80 border border-pink-200 rounded-xl px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Reply size={13} className="text-pink-500 shrink-0" />
                <span className="font-semibold text-pink-700 shrink-0">
                  Replying to {replyTarget.role === 'user' ? 'Client' : 'JAL'}:
                </span>
                <span className="text-gray-600 truncate">{replyTarget.content}</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                title="Cancel reply"
                className="p-0.5 text-gray-400 hover:text-gray-700 rounded shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend(input)
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a client message to test JAL..."
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || !bot}
              className="inline-flex items-center gap-1.5 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Send size={15} />
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Owner Summary OR Full Dev NLU Inspector */}
      <aside className={`${isDev ? 'lg:col-span-5' : 'lg:col-span-4'} space-y-4`}>
        {!isDev ? (
          <div className="bg-white rounded-2xl border border-pink-100/80 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900">Last Detected Request</h3>
              {lastDebug?.confidence != null && (
                <span className="text-xs font-semibold bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">
                  {Math.round(lastDebug.confidence * 100)}% match
                </span>
              )}
            </div>

            {!lastDebug ? (
              <p className="text-xs text-gray-400 leading-relaxed">
                Send a message on the left to verify how JAL classifies the question and pulls from your live Business Info catalog.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Topic</span>
                    <span className="font-mono font-semibold text-gray-800">{lastDebug.intent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Language</span>
                    <span className="font-medium text-gray-800">{lastDebug.language || 'en/fil'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Action</span>
                    <span className="font-mono text-gray-700">{lastDebug.action || 'reply'}</span>
                  </div>
                </div>

                {flow && (
                  <div className="bg-rose-50/50 border border-pink-100 rounded-xl p-3 space-y-1.5">
                    <div className="font-semibold text-pink-700">Active Booking Flow</div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Waiting for</span>
                      <span className="font-mono text-gray-800">{flow.awaiting || 'confirmation'}</span>
                    </div>
                    {Object.entries(flow.slots || {}).map(([k, v]) => v && (
                      <div key={k} className="flex justify-between">
                        <span className="text-gray-500">{k}</span>
                        <span className="font-medium text-gray-800">
                          {k === 'service' ? lookupServiceName(v, catalog) : v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-pink-100/80 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 bg-gray-50/70">
              <div className="flex items-center gap-2">
                <Terminal size={15} className="text-pink-500" />
                <span className="font-bold text-sm text-gray-900">JAlgorithm Pipeline Inspector</span>
              </div>
              <div className="flex items-center gap-2">
                {lastDebug?.elapsedMs != null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
                    <Zap size={11} className="text-pink-500" />
                    {lastDebug.elapsedMs}ms
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopyTrace}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white hover:bg-pink-50 text-gray-700 hover:text-pink-600 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {copiedTrace ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  {copiedTrace ? 'Copied' : 'Copy Trace JSON'}
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 text-xs max-h-[68vh] overflow-y-auto">
              {/* Dialogue State */}
              <section className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Dialogue State Machine
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Flow</span>
                    <span className="font-mono font-semibold text-gray-800">{flow?.intent || 'idle'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Awaiting</span>
                    <span className="font-mono text-pink-600 font-medium">{flow?.awaiting || 'none'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Confirming</span>
                    <span className="font-mono text-gray-800">{String(Boolean(flow?.confirming))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Language / Turn</span>
                    <span className="font-mono text-gray-800">
                      {lastTurnState?.lang || 'fil'} / #{lastTurnState?.turn ?? 0}
                    </span>
                  </div>
                  {flow?.slots && (
                    <div className="pt-2 border-t border-gray-200/70 space-y-1">
                      <div className="text-[11px] font-semibold text-gray-500">Slots</div>
                      {Object.entries(flow.slots).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-gray-400">{k}</span>
                          <span className="font-mono text-gray-800 truncate">
                            {k === 'service' && v ? lookupServiceName(v, catalog) : (v ?? 'null')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {!lastDebug ? (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-gray-400 text-center">
                  Send a test message to inspect normalization, concept tags, entities, and Late Fusion scores.
                </div>
              ) : (
                <>
                  {/* Normalization */}
                  <section className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5">
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-gray-400">Original</div>
                      <div className="font-mono text-gray-800 break-words">{lastDebug.original}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-gray-400">Normalized</div>
                      <div className="font-mono text-pink-700 break-words">{lastDebug.normalized || '(empty)'}</div>
                    </div>
                    {lastDebug.changes?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {lastDebug.changes.map((c, idx) => (
                          <span key={idx} className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-mono">
                            {c.from} {'->'} {c.to}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Late Fusion */}
                  <section className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-gray-700">
                      Late Fusion (0.45 Rules + 0.35 NB + 0.20 TF-IDF)
                    </div>
                    {(lastDebug.ranked || []).map((r) => (
                      <div key={r.intent} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-mono text-gray-700 truncate">{r.intent}</span>
                          <span className="font-semibold text-gray-900">{Math.round(r.score * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-pink-500 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, Math.round(r.score * 100)))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {lastDebug.components && (
                      <div className="pt-2 border-t border-gray-200/70 grid grid-cols-3 gap-1.5 text-center text-[10px] text-gray-500">
                        <div className="bg-white rounded-lg p-1.5 border border-gray-100">
                          <div className="font-semibold text-gray-800">{lastDebug.components.rulesTop}</div>
                          <div>Rules (45%)</div>
                        </div>
                        <div className="bg-white rounded-lg p-1.5 border border-gray-100">
                          <div className="font-semibold text-gray-800">
                            {Math.round(lastDebug.components.naiveBayesTop * 100)}%
                          </div>
                          <div>Naive Bayes (35%)</div>
                        </div>
                        <div className="bg-white rounded-lg p-1.5 border border-gray-100">
                          <div className="font-semibold text-gray-800">
                            {Math.round(lastDebug.components.tfidfTop * 100)}%
                          </div>
                          <div>TF-IDF (20%)</div>
                        </div>
                      </div>
                    )}
                    {lastDebug.reason && (
                      <div className="text-[11px] text-amber-700 font-medium">
                        Guard reason: {lastDebug.reason}
                      </div>
                    )}
                  </section>

                  {/* Tags & Entities */}
                  <section className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Concept Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {lastDebug.tags?.length ? (
                          lastDebug.tags.map((tag) => (
                            <span key={tag} className="bg-white border border-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">none</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Extracted Entities</div>
                      <div className="space-y-1">
                        {Object.entries(lastDebug.entities || {}).filter(([, val]) => val != null).length ? (
                          Object.entries(lastDebug.entities).map(([k, val]) => val != null && (
                            <div key={k} className="flex justify-between font-mono text-[11px]">
                              <span className="text-gray-500">{k}</span>
                              <span className="text-gray-800">{String(val)}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-400">none</span>
                        )}
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
