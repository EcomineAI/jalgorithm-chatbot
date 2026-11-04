import { supabase } from './supabase.js'

// Current tunnel URL — updated live via Supabase Realtime
let _tunnelUrl = null
let _status = 'connecting' // 'connecting' | 'online' | 'offline'
const _listeners = new Set()

function notify() {
  _listeners.forEach((fn) => fn(_status, _tunnelUrl))
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

// Subscribe to realtime changes so the URL updates the moment
// tunnel_bridge.py pushes a new URL or clears it on shutdown
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

// Subscribe to tunnel status changes (used by ChatPage to show online/offline)
export function onTunnelStatus(fn) {
  _listeners.add(fn)
  // fire immediately with current state
  fn(_status, _tunnelUrl)
  return () => _listeners.delete(fn)
}

export function getTunnelStatus() {
  return _status
}

// ── system prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are JAL, a friendly and professional appointment assistant for a freelance hair and makeup artist based in Olongapo City.

You help clients with:
- Booking new appointments (services: bridal makeup, hair styling, personal makeup, event packages)
- Rescheduling existing appointments
- Cancelling appointments
- Answering FAQs about services and availability

For every booking request, collect:
1. Client name
2. Service type
3. Event date and time
4. Event location
5. Contact number

Respond warmly but concisely. If a request is unclear, ask for clarification. Always confirm booking details before finalizing.
Reply in English or Filipino depending on the client's language.`

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
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 512,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`AI error: ${response.status}`)
  }

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
          content: `Classify the following client message into exactly one of these intents: book, reschedule, cancel, faq, other.
Reply with only the intent word, nothing else.`,
        },
        { role: 'user', content: message },
      ],
      temperature: 0,
      max_tokens: 10,
      stream: false,
    }),
  })

  if (!response.ok) return 'other'

  const data = await response.json()
  const raw = data.choices[0].message.content.trim().toLowerCase()
  const valid = ['book', 'reschedule', 'cancel', 'faq', 'other']
  return valid.includes(raw) ? raw : 'other'
}
