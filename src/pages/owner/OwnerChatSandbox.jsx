import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Send,
  RotateCcw,
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
import StudioMark from '../../components/StudioMark.jsx'
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

const DEV_MULTI_TURN_SCENARIOS = [
  {
    id: 'forgot_ref',
    label: 'Forgot Ref Code',
    steps: ['check my booking', 'nakalimutan ko ref code ko'],
  },
  {
    id: 'dual_dates',
    label: 'Dual-Date Check',
    steps: ['May available ba sa Dec 5 o Dec 6?', 'dec 5'],
  },
  {
    id: 'for_other',
    label: 'Book for Someone Else',
    steps: ['pbook nmn aq ng bridal s dec 5 10am', 'para kay Maria Santos', '09171234567', 'skip'],
  },
  {
    id: 'pause_resume',
    label: 'Hesitation Pause + Resume',
    steps: ['book bridal sa dec 5 10am', 'wait lang tanong ko muna kay mama', 'resume', 'Ana Cruz'],
  },
  {
    id: 'early_calltime',
    label: 'Early 4AM Call-Time',
    steps: ['pwede ba 4am call time sa bridal?'],
  },
  {
    id: 'conyo_jeje',
    label: 'Conyo / Jeje Mix',
    steps: ['g ba this sat?', 'hm bridal sis?'],
  },
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

  async function handleRunScenario(scenario) {
    if (!scenario?.steps?.length || sending || !bot) return
    setSending(true)
    setConfirmReset(false)
    setReplyTarget(null)
    setInput('')

    try {
      let currentState = bot.initialState()
      const nextMsgs = []
      let latestDebug = null

      for (let i = 0; i < scenario.steps.length; i += 1) {
        const text = scenario.steps[i]
        const now = new Date()
        const result = await bot.processMessage(text, currentState, { replyContext: null })
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

        nextMsgs.push({
          id: now.getTime() + i * 2,
          role: 'user',
          content: text,
          replyTo: null,
          createdAt: now.toISOString(),
        })
        nextMsgs.push({
          id: now.getTime() + i * 2 + 1,
          role: 'assistant',
          content: result.reply,
          intent: result.intent,
          confidence: result.nlu?.confidence ?? null,
          elapsedMs: result.elapsedMs ?? null,
          isTrash: !ownerLogged,
          serviceKey: result.nlu?.entities?.service ?? result.state?.flow?.slots?.service ?? null,
          replyTo: null,
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
        })

        currentState = result.state
        latestDebug = debug
      }

      setMessages(nextMsgs)
      setBotState(currentState)
      setLastDebug(latestDebug)
      setLastTurnState(currentState)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: `Scenario playback error: ${err?.message || 'Unable to run scenario.'}`,
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
    <div className={`grid gap-4 sm:gap-5 ${isDev ? 'lg:grid-cols-12' : 'lg:grid-cols-12 max-w-6xl'}`}>
      {/* Left: Interactive Sandbox Chat */}
      <div className={`${isDev ? 'lg:col-span-7' : 'lg:col-span-8'} bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs flex flex-col overflow-hidden min-h-[460px] sm:min-h-[580px] max-h-[75dvh] sm:max-h-[78vh]`}>
        {/* Top bar */}
        <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-stone-200/80 bg-[#f8f6f2] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {isDev ? (
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-pink-300 flex items-center justify-center shrink-0">
                <Terminal size={15} />
              </div>
            ) : (
              <StudioMark size="sm" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-stone-900 truncate">
                {isDev ? 'JAlgorithm Dev Runner' : 'Owner Reply Tester'}
              </div>
              <div className="text-xs text-stone-500 truncate">
                Uses your latest saved services, hours, travel &amp; payment policies
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setDryRun((v) => !v)}
              title="Toggle Dry-Run vs Live Slot/Booking RPCs (chat logs are never recorded from Sandbox)"
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                dryRun
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
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
                  className="text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="text-xs font-medium bg-[#fdfcfa] border border-stone-200/80 hover:bg-stone-100 text-stone-600 px-2 py-1.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-pink-700 bg-[#fdfcfa] border border-stone-200/80 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <RotateCcw size={13} />
                Reset
              </button>
            )}
          </div>
        </div>

        {!dryRun && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle size={13} className="shrink-0" />
            Live DB mode is active: confirming a booking here calls real Supabase booking functions (turns still stay out of Owner Chat Logs).
          </div>
        )}

        {bookingStepIdx >= 0 && (
          <div className="bg-[#fdfcfa] border-b border-stone-200/80 px-3 sm:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto">
            {BOOKING_STEPS.map((step, idx) => {
              const done = idx < bookingStepIdx
              const current = idx === bookingStepIdx
              return (
                <div key={step.key} className="flex items-center gap-1 sm:gap-1.5 shrink-0 sm:flex-1 sm:min-w-0">
                  <span
                    className={`w-5 h-5 rounded-md text-xs font-medium flex items-center justify-center shrink-0 tabular-nums ${
                      done
                        ? 'bg-pink-600 text-white'
                        : current
                          ? 'bg-pink-50 text-pink-700 border border-pink-300'
                          : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {done ? <Check size={11} /> : idx + 1}
                  </span>
                  <span
                    className={`text-xs whitespace-nowrap sm:truncate ${
                      current ? 'font-medium text-pink-700' : done ? 'font-medium text-stone-700' : 'text-stone-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < BOOKING_STEPS.length - 1 && (
                    <div className={`hidden sm:block flex-1 h-px ${done ? 'bg-pink-300' : 'bg-stone-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Quick phrase chips */}
        <div className="px-4 py-2 border-b border-stone-200/80 bg-[#f8f6f2] space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-stone-400 mr-1">Try:</span>
            {DEFAULT_SAMPLE_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => handleSend(phrase, null)}
                disabled={sending || !bot}
                className="text-xs font-medium bg-[#fdfcfa] hover:bg-stone-100 text-stone-600 hover:text-pink-700 border border-stone-200/80 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
              >
                {phrase}
              </button>
            ))}
          </div>
          {isDev && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-200/70">
              <span className="text-xs font-medium text-pink-700 mr-1">Scenarios:</span>
              {DEV_MULTI_TURN_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handleRunScenario(sc)}
                  disabled={sending || !bot}
                  title={sc.steps.join(' -> ')}
                  className="text-xs font-medium bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 tabular-nums"
                >
                  {sc.label} ({sc.steps.length}t)
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message thread + Interactive Guest Controls */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/40">
          {messages.length === 0 ? (
            <div className="py-4 space-y-4">
              <div className="flex flex-col items-center justify-center text-center px-4">
                <div className="mb-2.5">
                  <StudioMark size="md" tone="soft" />
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
        <div className="p-2.5 sm:p-3 border-t border-gray-100 bg-white space-y-2">
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
              className="flex-1 min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || !bot}
              className="inline-flex items-center gap-1.5 shrink-0 bg-pink-600 hover:bg-pink-700 disabled:bg-pink-300 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 min-h-10 rounded-lg transition-colors"
            >
              <Send size={15} />
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Owner Summary OR Full Dev NLU Inspector */}
      <aside className={`${isDev ? 'lg:col-span-5' : 'lg:col-span-4'} space-y-4 min-w-0`}>
        {!isDev ? (
          <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-stone-900">Last Detected Request</h3>
              {lastDebug?.confidence != null && (
                <span className="text-xs font-medium bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-md tabular-nums">
                  {Math.round(lastDebug.confidence * 100)}% match
                </span>
              )}
            </div>

            {!lastDebug ? (
              <p className="text-xs text-stone-500 leading-relaxed">
                Send a message on the left to verify how JAL classifies the question and pulls from your live Business Info catalog.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Topic</span>
                    <span className="font-mono font-medium text-stone-800">{lastDebug.intent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Language</span>
                    <span className="font-medium text-stone-800">{lastDebug.language || 'en/fil'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Action</span>
                    <span className="font-mono text-stone-700">{lastDebug.action || 'reply'}</span>
                  </div>
                </div>

                {flow && (
                  <div className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3 space-y-1.5">
                    <div className="font-semibold text-pink-700">Active Booking Flow</div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Waiting for</span>
                      <span className="font-mono text-stone-800">{flow.awaiting || 'confirmation'}</span>
                    </div>
                    {Object.entries(flow.slots || {}).map(([k, v]) => v && (
                      <div key={k} className="flex justify-between">
                        <span className="text-stone-500">{k}</span>
                        <span className="font-medium text-stone-800">
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
          <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-200/80 flex items-center justify-between gap-2 bg-[#f8f6f2]">
              <div className="flex items-center gap-2">
                <Terminal size={15} className="text-stone-600" />
                <span className="font-semibold text-sm text-stone-900">JAlgorithm Pipeline Inspector</span>
              </div>
              <div className="flex items-center gap-2">
                {lastDebug?.elapsedMs != null && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 tabular-nums">
                    <Zap size={12} className="text-pink-600" />
                    {lastDebug.elapsedMs}ms
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopyTrace}
                  className="inline-flex items-center gap-1 text-xs font-medium bg-[#fdfcfa] hover:bg-stone-100 text-stone-700 hover:text-pink-700 border border-stone-200/80 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {copiedTrace ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copiedTrace ? 'Copied' : 'Copy Trace JSON'}
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 text-xs max-h-[68vh] overflow-y-auto">
              {/* Dialogue State */}
              <section className="space-y-1.5">
                <div className="text-xs font-medium text-stone-500">
                  Dialogue state machine
                </div>
                <div className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Flow</span>
                    <span className="font-mono font-medium text-stone-800">{flow?.intent || 'idle'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Awaiting</span>
                    <span className="font-mono text-pink-700 font-medium">{flow?.awaiting || 'none'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Confirming</span>
                    <span className="font-mono text-stone-800">{String(Boolean(flow?.confirming))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Language / Turn</span>
                    <span className="font-mono text-stone-800 tabular-nums">
                      {lastTurnState?.lang || 'fil'} / #{lastTurnState?.turn ?? 0}
                    </span>
                  </div>
                  {flow?.slots && (
                    <div className="pt-2 border-t border-stone-200/70 space-y-1">
                      <div className="text-xs font-medium text-stone-500">Slots</div>
                      {Object.entries(flow.slots).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-stone-400">{k}</span>
                          <span className="font-mono text-stone-800 truncate">
                            {k === 'service' && v ? lookupServiceName(v, catalog) : (v ?? 'null')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {!lastDebug ? (
                <div className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-4 text-stone-400 text-center">
                  Send a test message to inspect normalization, concept tags, entities, and Late Fusion scores.
                </div>
              ) : (
                <>
                  {/* Normalization */}
                  <section className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3 space-y-1.5">
                    <div>
                      <div className="text-xs font-medium text-stone-500">Original</div>
                      <div className="font-mono text-stone-800 break-words">{lastDebug.original}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-stone-500">Normalized</div>
                      <div className="font-mono text-pink-700 break-words">{lastDebug.normalized || '(empty)'}</div>
                    </div>
                    {lastDebug.changes?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {lastDebug.changes.map((c, idx) => (
                          <span key={idx} className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md text-xs font-mono">
                            {c.from} {'->'} {c.to}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Late Fusion */}
                  <section className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3 space-y-2">
                    <div className="text-xs font-medium text-stone-700">
                      Late Fusion (0.45 Rules + 0.35 NB + 0.20 TF-IDF)
                    </div>
                    {(lastDebug.ranked || []).map((r) => (
                      <div key={r.intent} className="space-y-1">
                        <div className="flex justify-between text-xs tabular-nums">
                          <span className="font-mono text-stone-700 truncate">{r.intent}</span>
                          <span className="font-semibold text-stone-900">{Math.round(r.score * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-pink-600 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, Math.round(r.score * 100)))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {lastDebug.components && (
                      <div className="pt-2 border-t border-stone-200/70 grid grid-cols-3 gap-1.5 text-center text-xs text-stone-500 tabular-nums">
                        <div className="bg-[#fdfcfa] rounded-lg p-1.5 border border-stone-200/80">
                          <div className="font-semibold text-stone-800">{lastDebug.components.rulesTop}</div>
                          <div>Rules (45%)</div>
                        </div>
                        <div className="bg-[#fdfcfa] rounded-lg p-1.5 border border-stone-200/80">
                          <div className="font-semibold text-stone-800">
                            {Math.round(lastDebug.components.naiveBayesTop * 100)}%
                          </div>
                          <div>Naive Bayes (35%)</div>
                        </div>
                        <div className="bg-[#fdfcfa] rounded-lg p-1.5 border border-stone-200/80">
                          <div className="font-semibold text-stone-800">
                            {Math.round(lastDebug.components.tfidfTop * 100)}%
                          </div>
                          <div>TF-IDF (20%)</div>
                        </div>
                      </div>
                    )}
                    {lastDebug.reason && (
                      <div className="text-xs text-amber-700 font-medium">
                        Guard reason: {lastDebug.reason}
                      </div>
                    )}
                  </section>

                  {/* Tags & Entities */}
                  <section className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3 space-y-2">
                    <div>
                      <div className="text-xs font-medium text-stone-500 mb-1">Concept Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {lastDebug.tags?.length ? (
                          lastDebug.tags.map((tag) => (
                            <span key={tag} className="bg-[#fdfcfa] border border-stone-200 text-stone-700 px-1.5 py-0.5 rounded-md font-mono text-xs">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-stone-400">none</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-stone-500 mb-1">Extracted Entities</div>
                      <div className="space-y-1">
                        {Object.entries(lastDebug.entities || {}).filter(([, val]) => val != null).length ? (
                          Object.entries(lastDebug.entities).map(([k, val]) => val != null && (
                            <div key={k} className="flex justify-between font-mono text-xs">
                              <span className="text-stone-500">{k}</span>
                              <span className="text-stone-800">{String(val)}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-stone-400">none</span>
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
