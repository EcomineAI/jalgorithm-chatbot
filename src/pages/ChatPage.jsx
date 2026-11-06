import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Send, Sparkles, ArrowLeft, Loader2, Wifi, WifiOff } from 'lucide-react'
import { sendMessage, classifyIntent, onTunnelStatus } from '../lib/lmstudio.js'
import { supabase } from '../lib/supabase.js'

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content: `Hi! I'm JAL, your appointment assistant. 👋\n\nI can help you:\n• Book a new appointment\n• Reschedule an existing one\n• Cancel a booking\n• Answer questions about services\n\nWhat can I do for you today?`,
}

export default function ChatPage() {
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tunnelStatus, setTunnelStatus] = useState('connecting')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return onTunnelStatus((status) => setTunnelStatus(status))
  }, [])

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { id: Date.now(), role: 'user', content: text }
    const history = [...messages.filter((m) => m.id !== 'welcome'), userMsg]

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const intent = await classifyIntent(text)

      // Refuse off-topic messages without calling the LLM
      if (intent === 'other') {
        const refusal = "I can only help with appointment bookings and service inquiries. Would you like to book, reschedule, or cancel an appointment?"
        const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: refusal, intent }
        setMessages((prev) => [...prev, assistantMsg])
        await supabase.from('chat_logs').insert({
          user_message: text,
          bot_reply: refusal,
          intent_classified: intent,
          session_id: getSessionId(),
        }).then(() => {})
        return
      }

      const reply = await sendMessage(history.map(({ role, content }) => ({ role, content })))
      const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: reply, intent }
      setMessages((prev) => [...prev, assistantMsg])

      await supabase.from('chat_logs').insert({
        user_message: text,
        bot_reply: reply,
        intent_classified: intent,
        session_id: getSessionId(),
      }).then(() => {})

    } catch (err) {
      setError('Could not connect to the chatbot. Make sure LM Studio is running.')
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
            {tunnelStatus === 'online' && <div className="flex items-center gap-1 text-xs text-green-500 font-medium"><Wifi size={10} /> Online</div>}
            {tunnelStatus === 'offline' && <div className="flex items-center gap-1 text-xs text-red-400 font-medium"><WifiOff size={10} /> Offline</div>}
            {tunnelStatus === 'connecting' && <div className="text-xs text-gray-400">Connecting...</div>}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {loading && (
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
            disabled={!input.trim() || loading}
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
          <div className="mt-1.5 text-xs opacity-50 capitalize">
            Intent: {message.intent}
          </div>
        )}
      </div>
    </div>
  )
}

function getSessionId() {
  let id = sessionStorage.getItem('chat_session')
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem('chat_session', id)
  }
  return id
}
