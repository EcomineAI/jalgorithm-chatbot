import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Send,
  ArrowLeft,
  Wifi,
  WifiOff,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Trash2,
  Check,
  X,
  Settings,
  ArrowDown,
  MessageSquare,
  Reply,
  Bookmark,
} from 'lucide-react'
import StudioMark from '../components/StudioMark.jsx'
import { createJAlgorithm } from '../jalgorithm/index.js'
import { createAppointmentService } from '../services/appointments.js'
import { supabase } from '../lib/supabase.js'
import { useBusinessInfo } from '../lib/useBusinessInfo.js'
import { isTrashChatLog, isOwnerImportantLog } from '../lib/ownerInsights.js'
import {
  loadSessionsState,
  saveSessionsState,
  createNewSession,
  updateSessionTurn,
  renameSession,
  deleteSession,
  clearAllSessions,
  loadChatSettings,
  saveChatSettings,
  hasUserMessages,
  hasSavedSetup,
  groupSessionsByRecency,
  collectSavedReferences,
} from '../lib/chatSessions.js'
import {
  ChatBubble,
  FlowControls,
  BOOKING_STEPS,
  getBookingStepIndex,
} from '../components/ChatWidgets.jsx'

// JAlgorithm runs entirely in the browser; only appointment operations, chat logging and
// loading the owner's business info use Supabase.
const appointmentActions = createAppointmentService(supabase)

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sessionsState, setSessionsState] = useState(() => loadSessionsState())
  const [settings, setSettings] = useState(() => loadChatSettings())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [input, setInput] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [typingSessionId, setTypingSessionId] = useState(null)
  const [revealingMsgId, setRevealingMsgId] = useState(null)
  const [error, setError] = useState(null)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [showScrollDown, setShowScrollDown] = useState(false)

  const runTokenRef = useRef(0)
  const prefillServiceRef = useRef(null)
  const scrollAreaRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const activeSession = useMemo(
    () => sessionsState.sessions.find((s) => s.id === sessionsState.activeId) ?? sessionsState.sessions[0],
    [sessionsState]
  )
  const messages = activeSession?.messages ?? []
  const isBusy = typingSessionId !== null
  const isTypingActive = typingSessionId === activeSession?.id
  const groupedSessions = useMemo(() => groupSessionsByRecency(sessionsState.sessions), [sessionsState.sessions])

  // The bot is built from the owner's business info (or the cached/default copy when offline).
  const { catalog } = useBusinessInfo()
  const bot = useMemo(() => (catalog ? createJAlgorithm({ actions: appointmentActions, catalog }) : null), [catalog])
  const savedReferences = useMemo(
    () => collectSavedReferences(sessionsState.sessions, catalog),
    [sessionsState.sessions, catalog]
  )

  // Keep latest settings accessible inside async send handlers.
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    saveSessionsState(sessionsState)
  }, [sessionsState])

  useEffect(() => {
    saveChatSettings(settings)
  }, [settings])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, activeSession?.id, isTypingActive, revealingMsgId])

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  // Cancel in-flight typing animation timer if unmounted.
  useEffect(() => () => { runTokenRef.current += 1 }, [])

  const adjustTextareaHeight = useCallback((el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [])

  function handleMessagesScroll() {
    const el = scrollAreaRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollDown(distanceFromBottom > 120)
  }

  function handleNewChat() {
    runTokenRef.current += 1
    setTypingSessionId(null)
    setRevealingMsgId(null)
    setSessionsState((prev) => createNewSession(prev.sessions, prev.activeId))
    setError(null)
    setEditingId(null)
    setConfirmDeleteId(null)
    setReplyTarget(null)
    setMobileDrawerOpen(false)
    inputRef.current?.focus()
  }

  function handleSelectSession(id) {
    setRevealingMsgId(null)
    setSessionsState((prev) => ({ ...prev, activeId: id }))
    setError(null)
    setEditingId(null)
    setConfirmDeleteId(null)
    setReplyTarget(null)
    setMobileDrawerOpen(false)
    inputRef.current?.focus()
  }

  function startRename(e, session) {
    e.stopPropagation()
    setConfirmDeleteId(null)
    setEditingId(session.id)
    setEditingTitle(session.title)
  }

  function commitRename(sessionId) {
    setSessionsState((prev) => ({
      ...prev,
      sessions: renameSession(prev.sessions, sessionId, editingTitle),
    }))
    setEditingId(null)
    setEditingTitle('')
  }

  function handleDeleteSession(e, sessionId) {
    e.stopPropagation()
    const target = sessionsState.sessions.find((s) => s.id === sessionId)
    if (hasSavedSetup(target) && confirmDeleteId !== sessionId) {
      setConfirmDeleteId(sessionId)
      return
    }
    setConfirmDeleteId(null)
    if (typingSessionId === sessionId) {
      runTokenRef.current += 1
      setTypingSessionId(null)
    }
    setRevealingMsgId(null)
    setReplyTarget(null)
    setSessionsState((prev) => deleteSession(prev.sessions, prev.activeId, sessionId))
    if (editingId === sessionId) setEditingId(null)
    setError(null)
  }

  function handleClearAll() {
    if (!confirmClearAll) {
      setConfirmClearAll(true)
      return
    }
    runTokenRef.current += 1
    setTypingSessionId(null)
    setRevealingMsgId(null)
    const fresh = clearAllSessions()
    setSessionsState(fresh)
    setConfirmClearAll(false)
    setConfirmDeleteId(null)
    setReplyTarget(null)
    setSettingsOpen(false)
    setMobileDrawerOpen(false)
    setError(null)
    inputRef.current?.focus()
  }

  function handleJumpToMessage(msgId) {
    if (!msgId) return
    const el = document.getElementById(`msg-${msgId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function sendMessage(rawText, explicitReplyTarget) {
    const text = String(rawText ?? '').trim()
    if (!text || isBusy || !bot || !activeSession) return

    const token = ++runTokenRef.current
    const targetId = activeSession.id
    const prevMessages = activeSession.messages
    const prevBotState = activeSession.state
    const now = new Date()
    const activeReply = explicitReplyTarget !== undefined ? explicitReplyTarget : replyTarget
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
    const withUser = [...prevMessages, userMsg]

    setSessionsState((prev) => ({
      ...prev,
      sessions: updateSessionTurn(prev.sessions, targetId, { messages: withUser, state: prevBotState, catalog }, now),
    }))
    setInput('')
    setReplyTarget(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setTypingSessionId(targetId)
    setRevealingMsgId(null)
    setError(null)

    try {
      const result = await bot.processMessage(text, prevBotState, { replyContext })
      if (runTokenRef.current !== token) return

      const instant = settingsRef.current.instantReplies
      if (!instant) {
        const delayMs = Math.min(720, Math.max(380, Math.round((result.reply?.length || 40) * 3.2)))
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        if (runTokenRef.current !== token) return
      }

      const replyTime = new Date()
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.reply,
        intent: result.intent,
        serviceKey: result.nlu?.entities?.service ?? result.state?.flow?.slots?.service ?? null,
        replyTo: activeReply
          ? { id: userMsg.id, role: 'user', text: text.slice(0, 140) }
          : null,
        handoff: result.handoff ?? null,
        appointment: result.appointment ?? null,
        createdAt: replyTime.toISOString(),
      }

      setTypingSessionId(null)
      if (!instant && result.reply) {
        setRevealingMsgId(assistantMsg.id)
      }

      setSessionsState((prev) => ({
        ...prev,
        sessions: updateSessionTurn(
          prev.sessions,
          targetId,
          {
            messages: [...withUser, assistantMsg],
            state: result.state,
            catalog,
          },
          replyTime
        ),
      }))
      logTurn(text, result, targetId)
    } catch (err) {
      console.error('JAlgorithm error', err)
      if (runTokenRef.current !== token) return
      setTypingSessionId(null)
      setError('Something went wrong while processing your message. Please try again.')
      setSessionsState((prev) => ({
        ...prev,
        sessions: updateSessionTurn(prev.sessions, targetId, { messages: prevMessages, state: prevBotState, catalog }),
      }))
      setInput(text)
    } finally {
      if (runTokenRef.current === token) {
        inputRef.current?.focus()
      }
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault()
    sendMessage(input)
  }

  useEffect(() => {
    const svcParam = searchParams.get('service')
    if (!svcParam || !bot || !catalog || isBusy) return
    if (prefillServiceRef.current === svcParam) return

    const matchedSvc = (catalog.services || []).find((s) => s.key === svcParam)
    if (!matchedSvc) {
      prefillServiceRef.current = svcParam
      const next = new URLSearchParams(searchParams)
      next.delete('service')
      setSearchParams(next, { replace: true })
      return
    }

    if (hasUserMessages(activeSession)) {
      handleNewChat()
      return
    }

    prefillServiceRef.current = svcParam
    const next = new URLSearchParams(searchParams)
    next.delete('service')
    setSearchParams(next, { replace: true })
    sendMessage(`I want to book ${matchedSvc.name}`)
  })

  const bookingStepIdx = getBookingStepIndex(activeSession?.state?.flow)
  const isAnimatingCurrent = isTypingActive || revealingMsgId !== null

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#fdfcfa] border-r border-stone-200/80 w-72">
      {/* Sidebar top bar */}
      <div className="p-3 border-b border-stone-200/80 flex items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors px-2 min-h-9 rounded-lg hover:bg-stone-100"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Home
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-3 min-h-9 rounded-lg transition-colors"
          >
            <Plus size={14} strokeWidth={1.75} />
            New Chat
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false)
              setMobileDrawerOpen(false)
            }}
            title="Hide sidebar"
            className="p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <PanelLeftClose size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Grouped conversation list */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {groupedSessions.map((group) => (
          <div key={group.label}>
            <div className="px-2.5 mb-1.5 text-xs font-medium text-gray-500">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((session) => {
                const isActive = session.id === activeSession?.id
                const isEditing = editingId === session.id
                const inFlow = Boolean(session.state?.flow)

                return (
                  <div
                    key={session.id}
                    onClick={() => !isEditing && handleSelectSession(session.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        handleSelectSession(session.id)
                      }
                    }}
                    className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-pink-50 text-pink-700 border border-pink-200/80'
                        : 'text-gray-700 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <MessageSquare
                      size={14}
                      className={`flex-shrink-0 ${isActive ? 'text-pink-500' : 'text-gray-400'}`}
                    />
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(session.id)
                            if (e.key === 'Escape') {
                              setEditingId(null)
                              setEditingTitle('')
                            }
                          }}
                          autoFocus
                          maxLength={60}
                          className="w-full bg-white border border-pink-300 rounded-md px-2 py-0.5 text-xs text-gray-800 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(session.id)}
                          title="Save title"
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null)
                            setEditingTitle('')
                          }}
                          title="Cancel rename"
                          className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium text-[13px]">{session.title}</div>
                          {inFlow ? (
                            <div className="flex items-center gap-1.5 text-xs text-pink-700 font-medium mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-pink-600" />
                              In progress
                            </div>
                          ) : hasSavedSetup(session) ? (
                            <div className="flex items-center gap-1 text-xs text-amber-700 font-medium mt-0.5">
                              <Bookmark size={11} />
                              Saved setup
                            </div>
                          ) : null}
                        </div>
                        {confirmDeleteId === session.id ? (
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              className="px-2 py-0.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md"
                              title="Confirm delete saved setup"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfirmDeleteId(null)
                              }}
                              className="p-0.5 text-gray-400 hover:text-gray-700 rounded"
                              title="Cancel delete"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div
                            className={`flex items-center gap-0.5 flex-shrink-0 transition-opacity ${
                              isActive ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => startRename(e, session)}
                              title="Rename chat"
                              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-white rounded-md transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              title="Delete chat"
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-white rounded-md transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar footer */}
      <div className="p-3 border-t border-stone-200/80 space-y-2">
        <button
          type="button"
          onClick={() => {
            setConfirmClearAll(false)
            setSettingsOpen(true)
          }}
          className="w-full flex items-center justify-between px-3 min-h-9 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
        >
          <span className="inline-flex items-center gap-2.5">
            <Settings size={15} strokeWidth={1.75} className="text-stone-500" />
            Settings
          </span>
        </button>
        <div className="px-3 text-xs text-stone-500">
          Guest mode | Saved locally
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-[100dvh] w-full max-w-full bg-[#f8f6f2] flex overflow-hidden">
      {/* Desktop collapsible sidebar */}
      {sidebarOpen && <aside className="hidden md:flex flex-shrink-0 h-full">{sidebarContent}</aside>}

      {/* Mobile slide-over drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-stone-950/40 transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-50 h-full shadow-xl">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Header */}
        <header className="bg-[#fdfcfa] border-b border-stone-200/80 px-4 lg:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                title="Show conversations"
                className="hidden md:inline-flex p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <PanelLeftOpen size={18} strokeWidth={1.75} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              title="Show conversations"
              className="md:hidden p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <PanelLeftOpen size={18} strokeWidth={1.75} />
            </button>

            {!sidebarOpen && (
              <Link
                to="/"
                title="Back to home"
                className="hidden md:inline-flex p-1.5 text-stone-400 hover:text-stone-700 rounded-lg transition-colors"
              >
                <ArrowLeft size={18} strokeWidth={1.75} />
              </Link>
            )}

            <StudioMark size="sm" roundedFull />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-stone-900">JAL</span>
                {activeSession?.title && activeSession.title !== 'New Chat' && (
                  <span className="hidden sm:inline-block text-xs text-stone-500 truncate max-w-[240px] lg:max-w-[320px]">
                    / {activeSession.title}
                  </span>
                )}
              </div>
              {online
                ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <Wifi size={12} strokeWidth={1.75} /> Online{catalog?.business?.name ? ` | ${catalog.business.name}` : ''}
                  </div>
                )
                : <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium"><WifiOff size={12} strokeWidth={1.75} /> Offline, questions only</div>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleNewChat}
              title="Start a new chat"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 px-3 min-h-9 rounded-lg transition-colors"
            >
              <Plus size={15} strokeWidth={1.75} />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </header>

        {/* Live Booking Step Progress Bar */}
        {bookingStepIdx >= 0 && (
          <div className="bg-white border-b border-stone-200/80 px-3.5 sm:px-4 lg:px-6 py-2.5 flex-shrink-0 w-full min-w-0 overflow-hidden">
            <div className="max-w-3xl xl:max-w-4xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2 w-full">
              {BOOKING_STEPS.map((step, idx) => {
                const done = idx < bookingStepIdx
                const current = idx === bookingStepIdx
                return (
                  <div key={step.key} className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${idx < BOOKING_STEPS.length - 1 ? 'flex-1' : 'flex-shrink-0 sm:flex-1'}`}>
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-md text-xs font-medium tabular-nums flex items-center justify-center flex-shrink-0 transition-colors ${
                          done
                            ? 'bg-pink-600 text-white'
                            : current
                              ? 'bg-pink-50 text-pink-700 border border-pink-300'
                              : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {done ? <Check size={12} strokeWidth={2} /> : idx + 1}
                      </span>
                      <span
                        className={`text-xs truncate ${
                          current
                            ? 'inline font-medium text-pink-700'
                            : done
                              ? 'hidden sm:inline font-medium text-stone-800'
                              : 'hidden sm:inline text-stone-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < BOOKING_STEPS.length - 1 && (
                      <div className={`flex-1 h-px min-w-[8px] ${done ? 'bg-pink-300' : 'bg-stone-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Scrollable Messages + Interactive Controls */}
        <div
          ref={scrollAreaRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden px-3.5 sm:px-4 lg:px-8 py-5 sm:py-6"
        >
          <div className="max-w-3xl xl:max-w-4xl mx-auto w-full space-y-5">
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                catalog={catalog}
                isRevealing={revealingMsgId === msg.id}
                onRevealDone={() => setRevealingMsgId((cur) => (cur === msg.id ? null : cur))}
                onReply={(m) => {
                  setReplyTarget(m)
                  inputRef.current?.focus()
                }}
                onJumpToMessage={handleJumpToMessage}
              />
            ))}

            {(isTypingActive || !bot) && (
              <div className="flex gap-3 items-end animate-msg-in">
                <StudioMark size="xs" tone="soft" roundedFull />
                <div className="bg-white border border-gray-200/80 rounded-2xl rounded-bl-sm px-4 py-3 shadow-2xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-600 animate-typing-dot" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-600 animate-typing-dot" style={{ animationDelay: '180ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-600 animate-typing-dot" style={{ animationDelay: '360ms' }} />
                  <span className="ml-1.5 text-xs text-gray-500">JAL is typing...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl animate-msg-in">
                {error}
              </div>
            )}

            {/* Context-Aware Interactive Selection Controls */}
            {bot && !isAnimatingCurrent && (
              <FlowControls
                state={activeSession?.state}
                catalog={catalog}
                disabled={isBusy}
                showStarters={!hasUserMessages(activeSession)}
                savedReferences={savedReferences}
                onSelect={(value) => sendMessage(value, null)}
                onResumeDraft={() => sendMessage('resume', null)}
                onDiscardDraft={() => sendMessage('discard draft', null)}
              />
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Floating scroll-to-bottom button */}
        {showScrollDown && (
          <button
            type="button"
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            title="Jump to latest"
            className="absolute bottom-24 right-6 z-20 w-9 h-9 bg-white border border-gray-200 shadow-md rounded-full flex items-center justify-center text-gray-600 hover:text-pink-500 hover:border-pink-300 transition-colors"
          >
            <ArrowDown size={16} />
          </button>
        )}

        {/* Composer */}
        <div className="bg-[#fdfcfa] border-t border-stone-200/80 px-4 lg:px-8 py-3 flex-shrink-0">
          {replyTarget && (
            <div className="max-w-3xl xl:max-w-4xl mx-auto mb-2 flex items-center justify-between gap-2 bg-[#f8f6f2] border border-stone-200 rounded-lg px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Reply size={13} strokeWidth={1.75} className="text-pink-700 shrink-0" />
                <span className="font-medium text-pink-700 shrink-0">
                  Replying to {replyTarget.role === 'user' ? 'Client' : 'JAL'}:
                </span>
                <span className="text-stone-600 truncate">{replyTarget.content}</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                title="Cancel reply"
                className="p-0.5 text-stone-400 hover:text-stone-700 rounded shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <form onSubmit={handleFormSubmit} className="max-w-3xl xl:max-w-4xl mx-auto flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                adjustTextareaHeight(e.target)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleFormSubmit(e)
                }
              }}
              placeholder="Type a message"
              rows={1}
              className="flex-1 resize-none border border-stone-200 bg-white rounded-lg px-4 py-3 text-sm leading-5 max-h-[128px] overflow-y-auto focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-[border-color,box-shadow]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isBusy || !bot}
              className="btn-press bg-pink-600 hover:bg-pink-700 disabled:bg-pink-200 text-white p-3 rounded-lg flex-shrink-0"
            >
              <Send size={16} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => {
            setSettingsOpen(false)
            setConfirmClearAll(false)
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-5 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-pink-500" />
                <h2 className="font-semibold text-base text-gray-900">Chat Settings</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false)
                  setConfirmClearAll(false)
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Experience */}
            <div className="divide-y divide-gray-100 border-y border-gray-100">
              <SettingToggleRow
                label="Instant Replies (Skip Typing Animation)"
                description="Show replies immediately without the typing indicator pause or word animation."
                checked={settings.instantReplies}
                onToggle={() => setSettings((p) => ({ ...p, instantReplies: !p.instantReplies }))}
              />
            </div>

            {/* Clear all conversations */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Saved in this browser</span>
                <span className="font-medium text-gray-700">
                  {sessionsState.sessions.length} conversation{sessionsState.sessions.length === 1 ? '' : 's'}
                </span>
              </div>
              {confirmClearAll ? (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2.5">
                  <p className="text-xs text-red-700 font-medium">
                    Delete all cached chats in this browser? Saved setup drafts and booking reference codes in this browser will also be removed.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                    >
                      Confirm delete all
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 py-2.5 px-4 rounded-xl transition-colors"
                >
                  <Trash2 size={14} />
                  Clear all conversations
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingToggleRow({ label, description, checked, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-pink-600' : 'bg-stone-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

// Log every raw turn into dev_chat_logs (for developer NLU inspection) and log only
// actionable owner-relevant turns (bookings, reschedules, cancels, inquiries) into chat_logs.
// Fire-and-forget: a logging failure never blocks the chat.
function logTurn(userMessage, result, sessionId) {
  const nlu = result.nlu
  const entities = nlu
    ? {
        raw_intent: nlu.intent,
        ambiguous: nlu.ambiguous,
        candidates: nlu.candidates,
        date: nlu.entities.date,
        time: nlu.entities.time,
        service: nlu.entities.service,
        corrections: nlu.changes,
        action: result.action,
        elapsed_ms: result.elapsedMs,
      }
    : null

  const row = {
    session_id: sessionId,
    user_message: userMessage,
    bot_reply: result.reply,
    intent_classified: result.intent,
    confidence: nlu?.confidence ?? null,
    normalized_message: nlu?.normalized ?? null,
    language: nlu?.language ?? null,
    entities,
  }

  const trash = isTrashChatLog(row)
  const ownerImportant = isOwnerImportantLog(row)

  supabase
    .from('dev_chat_logs')
    .insert({
      ...row,
      is_trash: trash,
      owner_logged: ownerImportant,
      source: 'public',
    })
    .then(({ error }) => {
      if (error && !String(error.message || '').includes('dev_chat_logs')) {
        console.warn('dev chat log not saved:', error.message)
      }
    })

  if (!ownerImportant) {
    return
  }

  supabase
    .from('chat_logs')
    .insert(row)
    .then(({ error }) => {
      if (error) console.warn('chat log not saved:', error.message)
    })
}
