// Booking completion stats (thesis objective 3.2), computed from chat_logs rows.
// Same definitions as supabase/reports/booking_completion.sql:
//   started   = a session with a BOOK_APPOINTMENT turn, or a turn logged inside a booking flow
//   completed = a successful bookAppointment action, or (older logs without actions)
//               a BOOK_APPOINTMENT reply that contains a JAL-XXXXX code

export const FUNNEL_STEPS = ['service', 'date', 'time', 'name', 'contact', 'location', 'confirm', 'booked']

const REF_RE = /JAL-[A-Z0-9]{5}/

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function isBookAction(action) {
  return action && action.name === 'bookAppointment'
}

/**
 * @param {Array} rows chat_logs rows: { session_id, intent_classified, bot_reply, entities, created_at }
 * @param {{ since?: string }} options  ISO date; sessions that started before it are ignored
 */
export function computeBookingCompletion(rows, { since } = {}) {
  const sinceMs = since ? Date.parse(since) : null
  const sessions = new Map()

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.session_id) continue
    let s = sessions.get(row.session_id)
    if (!s) {
      s = { started: false, booked: false, firstMs: Infinity, lastMs: -Infinity, turns: 0, furthest: 0 }
      sessions.set(row.session_id, s)
    }
    const e = row.entities || {}
    const ms = Date.parse(row.created_at)
    if (!Number.isNaN(ms)) {
      s.firstMs = Math.min(s.firstMs, ms)
      s.lastMs = Math.max(s.lastMs, ms)
    }
    s.turns += 1

    const inBookingFlow = row.intent_classified === 'BOOK_APPOINTMENT' || e.flow_intent === 'BOOK_APPOINTMENT'
    if (inBookingFlow) s.started = true

    if (isBookAction(e.action)) {
      if (e.action.ok) s.booked = true
      else (s.failures ||= []).push(e.action.reason || 'unknown')
    } else if (row.intent_classified === 'BOOK_APPOINTMENT' && REF_RE.test(row.bot_reply || '')) {
      s.booked = true
    }

    if (e.flow_intent === 'BOOK_APPOINTMENT') {
      const idx = FUNNEL_STEPS.indexOf(e.flow_step)
      if (idx >= 0) s.furthest = Math.max(s.furthest, idx + 1)
    }
  }

  const included = [...sessions.values()].filter(
    (s) => s.started && (sinceMs == null || s.firstMs >= sinceMs),
  )
  const completed = included.filter((s) => s.booked)

  const failures = {}
  for (const s of included) {
    for (const reason of s.failures || []) failures[reason] = (failures[reason] || 0) + 1
  }

  // Funnel only uses sessions that have step logging; a completed booking counts as the last step.
  const withSteps = included.filter((s) => s.furthest > 0)
  const funnel = FUNNEL_STEPS.map((step, i) => ({
    step,
    count: withSteps.filter((s) => (s.booked ? FUNNEL_STEPS.length : s.furthest) >= i + 1).length,
  }))

  return {
    started: included.length,
    completed: completed.length,
    rate: included.length ? Math.round((1000 * completed.length) / included.length) / 10 : null,
    failures,
    funnel,
    funnelSessions: withSteps.length,
    medianTurns: median(completed.map((s) => s.turns)),
    medianMinutes:
      completed.length > 0
        ? Math.round(median(completed.map((s) => (s.lastMs - s.firstMs) / 60000)) * 10) / 10
        : null,
  }
}
