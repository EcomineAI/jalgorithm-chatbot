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
  const base = `/no_think
You are JAL, an appointment assistant for a hair and makeup salon.

How to reply:
- Use plain text only. No headings, no tables, no bold, no asterisks, no markdown.
- Use simple everyday words. Short sentences. 1 to 3 sentences per reply.
- If listing things, use a plain dash or the word "and" instead of symbols.
- Ask one question at a time when collecting booking details.
- Never write placeholder text like [name] or [date]. Ask directly.
- Match the language of the client. English or Filipino.
- Only answer based on the knowledgebase below. Do not make up information.`

  if (_kb) return `${base}\n\nKNOWLEDGEBASE:\n${_kb}`
  return base
}

// ── send message ──────────────────────────────────────────────────────────────

// Keep only the last N messages to stay within context window.
// System prompt ~600 tokens + 10 messages * ~200 tokens = ~2600 tokens safe budget.
function trimHistory(messages, limit = 10) {
  if (messages.length <= limit) return messages
  return messages.slice(-limit)
}

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
        ...trimHistory(messages),
      ],
      temperature: 0.6,
      max_tokens: 250,
      top_p: 0.9,
      repeat_penalty: 1.0,
      stream: false,
    }),
  })

  if (!response.ok) throw new Error(`AI error: ${response.status}`)

  const data = await response.json()
  return stripMarkdown(data.choices[0].message.content)
}

function stripMarkdown(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')  // remove reasoning blocks
    .replace(/^#{1,6}\s+/gm, '')                 // remove headings
    .replace(/\|.*\|/g, '')                      // remove table rows
    .replace(/^[-|]+$/gm, '')                    // remove table dividers
    .replace(/\*\*(.*?)\*\*/g, '$1')             // remove bold
    .replace(/\*(.*?)\*/g, '$1')                 // remove italic
    .replace(/`(.*?)`/g, '$1')                   // remove inline code
    .replace(/^[-*]\s+/gm, '• ')                 // normalize bullets
    .replace(/\n{3,}/g, '\n\n')                  // collapse excess newlines
    .trim()
}

// ── classify intent ───────────────────────────────────────────────────────────

export async function classifyIntent(message) {
  if (!_tunnelUrl) return 'faq'

  const response = await fetch(`${_tunnelUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local-model',
      messages: [
        {
          role: 'system',
          // /no_think disables Qwen3 reasoning mode so it replies directly
          content: `/no_think
You are a classifier. Reply with ONE word only — no punctuation, no explanation, no thinking.

Intents:
book       = wants to make a new appointment
reschedule = wants to change an appointment date/time
cancel     = wants to cancel an appointment
faq        = asking about services, prices, location, hours, artist, or anything about the business
other      = completely unrelated to hair, makeup, beauty, or appointments

Examples:
"Book an appointment" -> book
"I want to book" -> book
"Gusto ko mag-book" -> book
"Reschedule" -> reschedule
"Pwede ba palitan yung schedule?" -> reschedule
"Cancel booking" -> cancel
"Cancel na" -> cancel
"What services do you offer?" -> faq
"Magkano bridal?" -> faq
"May available ba?" -> faq
"What's your location?" -> faq
"hi" -> faq
"hello" -> faq
"Kumain ka na ba?" -> other
"What's the weather?" -> other`,
        },
        { role: 'user', content: message },
      ],
      temperature: 0,
      max_tokens: 10,
      stream: false,
    }),
  })

  if (!response.ok) return 'faq'

  const data = await response.json()
  const raw = data.choices[0].message.content || ''

  // Strip <think>...</think> blocks that reasoning models emit
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim().toLowerCase()

  // Extract the last word in case the model still adds padding
  const words = stripped.split(/\s+/).filter(Boolean)
  const last = words[words.length - 1] || ''

  const valid = ['book', 'reschedule', 'cancel', 'faq', 'other']

  // Check full stripped text first, then last word
  if (valid.includes(stripped)) return stripped
  if (valid.includes(last)) return last

  // Keyword fallback so common phrases never get refused
  const lc = message.toLowerCase()
  if (/book|appointment|schedule|apoint/.test(lc)) return 'book'
  if (/reschedule|palitan|change|move/.test(lc)) return 'reschedule'
  if (/cancel|cancell/.test(lc)) return 'cancel'
  if (/service|price|magkano|available|location|hours|offer|bridal|hair|makeup|package|how|what|where|when|sino|ano|hello|hi|kumusta/.test(lc)) return 'faq'

  return 'faq'
}
