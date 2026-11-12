import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Send, Sparkles, ArrowLeft, Loader2, Wifi, WifiOff, RotateCcw } from 'lucide-react'
import { createJAlgorithm, initialState } from '../jalgorithm/index.js'
import { createAppointmentService } from '../services/appointments.js'
import { supabase } from '../lib/supabase.js'
import { useBusinessInfo } from '../lib/useBusinessInfo.js'

// JAlgorithm runs entirely in the browser; only appointment operations, chat logging and
// loading the owner's business info use Supabase.
const appointmentActions = createAppointmentService(supabase)

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content: `Hi! I'm JAL, your appointment assistant. 👋\n\nI can help you:\n• Book a new appointment\n• Check available slots\n• Reschedule or cancel a booking\n• Answer questions about services, prices, location, and hours\n\nEnglish, Tagalog, or Taglish is fine! What can I do for you today?`,
}

const STORAGE_KEY = 'jal_conversation'

function loadConversation() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    if (saved?.messages?.length && saved.state) return saved
  } catch {
    /* storage unavailable or corrupted: start fresh */
  }
  return { messages: [WELCOME], state: initialState() }
}

function saveConversation(messages, state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, state }))
  } catch {
    /* ignore: the conversation simply won't survive a refresh */
  }
}

export default function ChatPage() {
  const [initial] = useState(loadConversation)
  const [messages, setMessages] = useState(initial.messages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const stateRef = useRef(initial.state)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // The bot is built from the owner's business info (or the cached/default copy when offline).
  const { catalog } = useBusinessInfo()
  const bot = useMemo(() => (catalog ? createJAlgorithm({ actions: appointmentActions, catalog }) : null), [catalog])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    saveConversation(messages, stateRef.current)
  }, [messages])

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

  function handleReset() {
    stateRef.current = initialState()
    setMessages([WELCOME])
    setError(null)
    inputRef.current?.focus()
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading || !bot) return

    const userMsg = { id: Date.now(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const result = await bot.processMessage(text, stateRef.current)
      stateRef.current = result.state
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.reply,
        intent: result.intent,
        confidence: result.nlu?.confidence,
      }
      setMessages((prev) => [...prev, assistantMsg])
      logTurn(text, result)
    } catch (err) {
      console.error('JAlgorithm error', err)
      setError('Something went wrong while processing your message. Please try again.')
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      setInput(text)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors p-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm text-gray-900">JAL</div>
            {online
              ? <div className="flex items-center gap-1 text-xs text-green-500 font-medium"><Wifi size={10} /> Online</div>
              : <div className="flex items-center gap-1 text-xs text-amber-500 font-medium"><WifiOff size={10} /> Offline · questions only, booking unavailable</div>}
          </div>
        </div>
        <button
          onClick={handleReset}
          title="Start a new conversation"
          className="ml-auto text-gray-400 hover:text-pink-500 transition-colors p-1"
        >
          <RotateCcw size={18} />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {(loading || !bot) && (
          <div className="flex gap-3 items-end">
            <div className="w-7 h-7 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles size={12} className="text-pink-500" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <Loader2 size={16} className="text-pink-400 animate-spin" />
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div className="max-w-2xl mx-auto w-full px-4 pb-2 flex gap-2 flex-wrap">
        {['Book an appointment', 'What services do you offer?', 'How much is bridal makeup?', 'Do you do home service?'].map((q) => (
          <button
            key={q}
            onClick={() => setInput(q)}
            className="text-xs bg-white border border-gray-200 hover:border-pink-300 hover:text-pink-500 text-gray-500 px-3 py-1.5 rounded-full transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) handleSend(e)
            }}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || !bot}
            className="bg-pink-500 hover:bg-pink-600 disabled:bg-pink-200 text-white p-3 rounded-xl transition-colors flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}

function ChatBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 items-end ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Sparkles size={12} className="text-pink-500" />
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
          isUser
            ? 'bg-pink-500 text-white rounded-br-sm'
            : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
        }`}
      >
        {message.content}
        {message.intent && !isUser && (
          <div className="mt-1.5 text-xs opacity-50">
            Intent: {message.intent.toLowerCase().replace(/_/g, ' ')}
            {typeof message.confidence === 'number' && ` · ${Math.round(message.confidence * 100)}%`}
          </div>
        )}
      </div>
    </div>
  )
}

// Research log of each turn. Fire-and-forget: a logging failure never blocks the chat.
function logTurn(userMessage, result) {
  const nlu = result.nlu
  supabase
    .from('chat_logs')
    .insert({
      session_id: getSessionId(),
      user_message: userMessage,
      bot_reply: result.reply,
      intent_classified: result.intent,
      confidence: nlu?.confidence ?? null,
      normalized_message: nlu?.normalized ?? null,
      language: nlu?.language ?? null,
      entities: nlu
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
        : null,
    })
    .then(({ error }) => {
      if (error) console.warn('chat log not saved:', error.message)
    })
}

function getSessionId() {
  let id = sessionStorage.getItem('chat_session')
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem('chat_session', id)
  }
  return id
}
