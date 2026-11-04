import { supabase } from './supabase.js'

// Current tunnel URL - updated live via Supabase Realtime
let _tunnelUrl = null
let _status = 'connecting' // 'connecting' | 'online' | 'offline'
const _listeners = new Set()

// Knowledgebase cache - loaded once on startup
let _kb = null

function notify() {
  _listeners.forEach((fn) => fn(_status, _tunnelUrl))
}

// Load knowledgebase.md from /public
async function loadKnowledgebase() {
  try {
    const res = await fetch('/knowledgebase.md')
    if (res.ok) _kb = await res.text()
  } catch {
    _kb = null
  }
}

// Fetch the current tunnel URL from Supabase on startup
async function fetchTunnelUrl() {
  const { data } = await supabase
    .from('tunnel_config')
    .select('lm_studio_url')
    .eq('id', 1)
    .single()

  _tunnelUrl = data?.lm_studio_url || null
  _status = _tunnelUrl ? 'online' : 'offline'
  notify()
}

// Subscribe to realtime changes
supabase
  .channel('tunnel_config_changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'tunnel_config' },
    (payload) => {
      _tunnelUrl = payload.new?.lm_studio_url || null
      _status = _tunnelUrl ? 'online' : 'offline'
      notify()
    }
  )
  .subscribe()

fetchTunnelUrl()
loadKnowledgebase()

export function onTunnelStatus(fn) {
  _listeners.add(fn)
  fn(_status, _tunnelUrl)
  return () => _listeners.delete(fn)
}

export function getTunnelStatus() {
  return _status
}

// Reload KB - called by admin dashboard after updating knowledgebase.md
export async function reloadKnowledgebase() {
  await loadKnowledgebase()
}

// ── system prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt() {
  const base = `You are JAL, the appointment assistant for a freelance hair and makeup artist.
Reply in 1-3 short sentences only. Be friendly but concise.
Never make up info not in the knowledgebase.
For bookings, collect: client name, service, date/time, location, contact number.
Reply in English or Filipino based on the client's language.`

  if (_kb) return `${base}\n\n--- KNOWLEDGEBASE (source of truth) ---\n${_kb}\n--- END KNOWLEDGEBASE ---`
  return base
}

// ── send message ──────────────────────────────────────────────────────────────

export async function sendMessage(messages) {
  if (!_tunnelUrl) {
    throw new Error('AI is currently offline. Please try again later.')
  }

  const response = await fetch(`${_tunnelUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local-model',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        ...messages,
      ],
      temperature: 0.5,
      max_tokens: 256,
      stream: false,
    }),
  })

  if (!response.ok) throw new Error(`AI error: ${response.status}`)

  const data = await response.json()
  return data.choices[0].message.content
}

// ── classify intent ───────────────────────────────────────────────────────────

export async function classifyIntent(message) {
  if (!_tunnelUrl) return 'other'

  const response = await fetch(`${_tunnelUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local-model',
      messages: [
        {
          role: 'system',
          content: `Classify the message into one of: book, reschedule, cancel, faq, other. Reply with the single word only.`,
        },
        { role: 'user', content: message },
      ],
      temperature: 0,
      max_tokens: 5,
      stream: false,
    }),
  })

  if (!response.ok) return 'other'

  const data = await response.json()
  const raw = data.choices[0].message.content.trim().toLowerCase()
  const valid = ['book', 'reschedule', 'cancel', 'faq', 'other']
  return valid.includes(raw) ? raw : 'other'
}
