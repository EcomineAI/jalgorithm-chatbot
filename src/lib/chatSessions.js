import { initialState } from '../jalgorithm/index.js'

export const SESSIONS_KEY = 'jal_sessions_v1'
export const SETTINGS_KEY = 'jal_chat_settings_v1'
export const LEGACY_CONVERSATION_KEY = 'jal_conversation'
export const LEGACY_SESSION_ID_KEY = 'chat_session'
export const MAX_SESSIONS = 30

export const DEFAULT_CHAT_SETTINGS = {
  instantReplies: false,
}

const WELCOME_CONTENT =
  `Hi! I'm JAL, your appointment chatbot.\n\n` +
  `I can help you:\n` +
  `• Book a new appointment\n` +
  `• Check available slots\n` +
  `• Reschedule or cancel a booking\n` +
  `• Answer questions about services, prices, location, and hours\n\n` +
  `English, Tagalog, or Taglish is fine! What can I do for you today?`

const FALLBACK_SERVICE_LABELS = {
  bridal: 'Bridal Makeup (full)',
  event_makeup: 'Event / Debut Makeup',
  personal_makeup: 'Personal Makeup',
  hair_styling: 'Hair Styling',
  hair_makeup: 'Hair + Makeup Package',
  wedding_package: 'Wedding Package (bride + entourage)',
}

const INTENT_PRIORITY = {
  BOOK_APPOINTMENT: 4,
  RESCHEDULE_APPOINTMENT: 4,
  CANCEL_APPOINTMENT: 4,
  VIEW_APPOINTMENT: 4,
  CHECK_AVAILABILITY: 3,
  CANNOT_ATTEND: 3,
  ASK_PRICE: 2,
  ASK_SERVICES: 2,
  ASK_LOCATION: 2,
  ASK_OPERATING_HOURS: 2,
  ASK_BOOKING_POLICY: 2,
  GENERAL_INQUIRY: 2,
  GREETING: 1,
  THANKS: 1,
  UNKNOWN_INTENT: 1,
  RESET: 1,
}

function toDate(now) {
  return now instanceof Date ? now : new Date(now || Date.now())
}

function toIso(now) {
  return toDate(now).toISOString()
}

function defaultLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function defaultSessionStorage() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

export function lookupServiceName(serviceKey, catalog = null) {
  if (!serviceKey) return null
  const fromCatalog = catalog?.services?.find((s) => s.key === serviceKey)?.name
  if (fromCatalog) return fromCatalog
  if (FALLBACK_SERVICE_LABELS[serviceKey]) return FALLBACK_SERVICE_LABELS[serviceKey]
  return String(serviceKey)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function createWelcomeMessage(now = new Date()) {
  return {
    id: 'welcome',
    role: 'assistant',
    content: WELCOME_CONTENT,
    createdAt: toIso(now),
  }
}

export function makeSessionId(now = new Date()) {
  return `session_${toDate(now).getTime()}_${Math.random().toString(36).slice(2, 8)}`
}

export function deriveTitleFromMessage(text, maxLen = 36) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'New Chat'
  if (clean.length <= maxLen) return clean
  return `${clean.slice(0, maxLen - 1).trimEnd()}...`
}

export function hasUserMessages(session) {
  return Boolean(session?.messages?.some((m) => m.role === 'user'))
}

function mergeActivityMeta(prevMeta = {}, state = null, debug = null) {
  const slots = state?.flow?.slots || state?.pending?.slots || {}
  const entities = debug?.entities || {}
  return {
    service: slots.service || entities.service || prevMeta.service || null,
    date: slots.date || entities.date || prevMeta.date || null,
    reference: slots.reference || entities.reference || prevMeta.reference || null,
  }
}

/**
 * Derives a clean, human-readable sidebar title from what the user actually did
 * (completed booking/reschedule/cancel, active flow, or domain inquiry), never
 * from raw off-topic first messages such as "pagod na ako".
 */
export function deriveSessionTitle(session, catalog = null) {
  if (!session || !hasUserMessages(session)) return 'New Chat'

  const messages = Array.isArray(session.messages) ? session.messages : []
  const assistantMsgs = messages.filter((m) => m.role === 'assistant' && m.id !== 'welcome')
  const meta = session.activityMeta || {}

  // Gather any known service, date, or reference from state, message debug snapshots, and text.
  let serviceKey = session.state?.flow?.slots?.service || session.state?.pending?.slots?.service || meta.service || null
  let dateVal = session.state?.flow?.slots?.date || session.state?.pending?.slots?.date || meta.date || null
  let refCode = session.state?.flow?.slots?.reference || meta.reference || null

  for (let i = assistantMsgs.length - 1; i >= 0; i -= 1) {
    const m = assistantMsgs[i]
    const entities = m.debug?.entities
    if (!serviceKey && entities?.service) serviceKey = entities.service
    if (!dateVal && entities?.date) dateVal = entities.date
    if (!refCode) {
      refCode = entities?.reference || extractReferenceCodes(m.content)[0] || null
    }
  }
  if (!serviceKey && session.lastDebug?.entities?.service) serviceKey = session.lastDebug.entities.service
  if (!dateVal && session.lastDebug?.entities?.date) dateVal = session.lastDebug.entities.date
  if (!refCode && session.lastDebug?.entities?.reference) refCode = session.lastDebug.entities.reference

  const serviceLabel = lookupServiceName(serviceKey, catalog)

  // 1. Completed transactional action takes top priority.
  for (let i = assistantMsgs.length - 1; i >= 0; i -= 1) {
    const m = assistantMsgs[i]
    const action = m.debug?.action
    const codes = extractReferenceCodes(m.content)
    const msgRef = codes[0] || refCode

    if (
      (action?.name === 'bookAppointment' && action?.ok) ||
      (m.intent === 'BOOK_APPOINTMENT' && codes.length > 0)
    ) {
      if (serviceLabel && msgRef) return `Booked: ${serviceLabel} (${msgRef})`
      if (msgRef) return `Booked: ${msgRef}`
      return serviceLabel ? `Booked: ${serviceLabel}` : 'Appointment Booked'
    }

    if (
      (action?.name === 'rescheduleAppointment' && action?.ok) ||
      (m.intent === 'RESCHEDULE_APPOINTMENT' && /now on|nasa .* na/i.test(m.content || ''))
    ) {
      return msgRef ? `Rescheduled: ${msgRef}` : 'Rescheduled Appointment'
    }

    if (
      (action?.name === 'cancelAppointment' && action?.ok) ||
      (m.intent === 'CANCEL_APPOINTMENT' && /has been cancelled|na-cancel na/i.test(m.content || ''))
    ) {
      return msgRef ? `Cancelled: ${msgRef}` : 'Cancelled Appointment'
    }
  }

  // Also check top-level lastDebug action when callers construct partial message lists in tests.
  const topAction = session.lastDebug?.action
  if (topAction?.name === 'bookAppointment' && topAction?.ok) {
    if (serviceLabel && refCode) return `Booked: ${serviceLabel} (${refCode})`
    if (refCode) return `Booked: ${refCode}`
    return serviceLabel ? `Booked: ${serviceLabel}` : 'Appointment Booked'
  }
  if (topAction?.name === 'rescheduleAppointment' && topAction?.ok) {
    return refCode ? `Rescheduled: ${refCode}` : 'Rescheduled Appointment'
  }
  if (topAction?.name === 'cancelAppointment' && topAction?.ok) {
    return refCode ? `Cancelled: ${refCode}` : 'Cancelled Appointment'
  }

  // 2. Active multi-turn flow.
  const flow = session.state?.flow
  if (flow?.intent) {
    const flowService = lookupServiceName(flow.slots?.service || serviceKey, catalog)
    const flowDate = flow.slots?.date || dateVal
    const flowRef = flow.slots?.reference || refCode
    switch (flow.intent) {
      case 'BOOK_APPOINTMENT':
        return flowService ? `Booking: ${flowService}` : 'Appointment Booking'
      case 'CHECK_AVAILABILITY':
        if (flowDate) return `Availability: ${flowDate}`
        return flowService ? `Availability: ${flowService}` : 'Availability Check'
      case 'RESCHEDULE_APPOINTMENT':
        return flowRef ? `Reschedule: ${flowRef}` : 'Reschedule Appointment'
      case 'CANCEL_APPOINTMENT':
        return flowRef ? `Cancel: ${flowRef}` : 'Cancel Appointment'
      case 'VIEW_APPOINTMENT':
        return flowRef ? `View Booking: ${flowRef}` : 'Appointment Lookup'
    }
  }

  // 3. Pending confirmation/clarification.
  if (session.state?.pending?.type === 'offer_book') {
    const offerService = lookupServiceName(session.state.pending.slots?.service || serviceKey, catalog)
    return offerService ? `Booking: ${offerService}` : 'Appointment Booking'
  }

  // 4. Highest-priority resolved domain intent across the conversation.
  let bestIntent = null
  let bestRank = 0
  for (const m of assistantMsgs) {
    const rank = INTENT_PRIORITY[m.intent] ?? 0
    if (rank >= bestRank && rank > 0) {
      bestRank = rank
      bestIntent = m.intent
    }
  }
  if (!bestIntent && session.lastDebug?.intent) {
    bestIntent = session.lastDebug.intent
  }

  switch (bestIntent) {
    case 'BOOK_APPOINTMENT':
      return serviceLabel ? `Booking: ${serviceLabel}` : 'Appointment Booking'
    case 'RESCHEDULE_APPOINTMENT':
      return refCode ? `Reschedule: ${refCode}` : 'Reschedule Appointment'
    case 'CANCEL_APPOINTMENT':
      return refCode ? `Cancel: ${refCode}` : 'Cancel Appointment'
    case 'VIEW_APPOINTMENT':
      return refCode ? `View Booking: ${refCode}` : 'Appointment Lookup'
    case 'CHECK_AVAILABILITY':
      if (dateVal) return `Availability: ${dateVal}`
      return serviceLabel ? `Availability: ${serviceLabel}` : 'Availability Check'
    case 'CANNOT_ATTEND':
      return 'Reschedule / Cancel Inquiry'
    case 'ASK_PRICE':
      return serviceLabel ? `Price Inquiry: ${serviceLabel}` : 'Price & Rates Inquiry'
    case 'ASK_SERVICES':
      return 'Service Catalog Inquiry'
    case 'ASK_LOCATION':
      return 'Location & Travel Inquiry'
    case 'ASK_OPERATING_HOURS':
      return 'Working Hours Inquiry'
    case 'ASK_BOOKING_POLICY':
      return 'Booking Rules Inquiry'
    case 'GENERAL_INQUIRY':
      return 'Salon Inquiry'
    default:
      return 'General Chat'
  }
}

export function createSessionObject(now = new Date(), overrides = {}) {
  const iso = toIso(now)
  return {
    id: overrides.id || makeSessionId(now),
    title: overrides.title || 'New Chat',
    customTitle: Boolean(overrides.customTitle),
    createdAt: overrides.createdAt || iso,
    updatedAt: overrides.updatedAt || iso,
    messages: overrides.messages?.length ? overrides.messages : [createWelcomeMessage(now)],
    state: overrides.state || initialState(),
    lastDebug: overrides.lastDebug ?? null,
    activityMeta: overrides.activityMeta ?? { service: null, date: null, reference: null },
  }
}

function normalizeLoadedSession(raw, now) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.messages) || !raw.messages.length) {
    return null
  }
  const iso = toIso(now)
  const session = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeSessionId(now),
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'New Chat',
    customTitle: Boolean(raw.customTitle),
    createdAt: raw.createdAt || iso,
    updatedAt: raw.updatedAt || raw.createdAt || iso,
    messages: raw.messages,
    state: raw.state || initialState(),
    lastDebug: raw.lastDebug ?? null,
    activityMeta: raw.activityMeta ?? { service: null, date: null, reference: null },
  }

  // Upgrade any non-custom title from older builds to action/entity-based naming.
  if (!session.customTitle) {
    session.title = deriveSessionTitle(session)
  }
  return session
}

export function saveSessionsState({ sessions, activeId }, storage = defaultLocalStorage()) {
  if (!storage) return
  try {
    const trimmed = (sessions || []).slice(0, MAX_SESSIONS)
    storage.setItem(SESSIONS_KEY, JSON.stringify({ sessions: trimmed, activeId }))
  } catch {
    /* ignore quota / privacy mode failures */
  }
}

export function loadSessionsState(
  storage = defaultLocalStorage(),
  legacyStorage = defaultSessionStorage(),
  now = new Date()
) {
  if (storage) {
    try {
      const parsed = JSON.parse(storage.getItem(SESSIONS_KEY))
      if (Array.isArray(parsed?.sessions) && parsed.sessions.length) {
        const sessions = parsed.sessions.map((s) => normalizeLoadedSession(s, now)).filter(Boolean)
        if (sessions.length) {
          const activeExists = sessions.some((s) => s.id === parsed.activeId)
          return {
            sessions: sessions.slice(0, MAX_SESSIONS),
            activeId: activeExists ? parsed.activeId : sessions[0].id,
          }
        }
      }
    } catch {
      /* ignore corrupted localStorage data and recover below */
    }
  }

  // Migrate any pre-existing single-tab sessionStorage conversation on first load.
  if (legacyStorage) {
    try {
      const legacyConv = JSON.parse(legacyStorage.getItem(LEGACY_CONVERSATION_KEY))
      const legacyId = legacyStorage.getItem(LEGACY_SESSION_ID_KEY)
      if (Array.isArray(legacyConv?.messages) && legacyConv.messages.length && legacyConv.state) {
        const migratedBase = createSessionObject(now, {
          id: legacyId || makeSessionId(now),
          messages: legacyConv.messages,
          state: legacyConv.state,
        })
        migratedBase.title = deriveSessionTitle(migratedBase)
        const next = { sessions: [migratedBase], activeId: migratedBase.id }
        saveSessionsState(next, storage)
        legacyStorage.removeItem?.(LEGACY_CONVERSATION_KEY)
        return next
      }
    } catch {
      /* ignore corrupted legacy sessionStorage */
    }
  }

  const fresh = createSessionObject(now)
  const next = { sessions: [fresh], activeId: fresh.id }
  saveSessionsState(next, storage)
  return next
}

export function createNewSession(sessions, activeId, now = new Date()) {
  const list = Array.isArray(sessions) ? sessions : []
  const current = list.find((s) => s.id === activeId)
  if (current && !hasUserMessages(current)) {
    return { sessions: list, activeId: current.id, created: false }
  }
  const existingEmpty = list.find((s) => !hasUserMessages(s))
  if (existingEmpty) {
    return { sessions: list, activeId: existingEmpty.id, created: false }
  }
  const fresh = createSessionObject(now)
  return {
    sessions: [fresh, ...list].slice(0, MAX_SESSIONS),
    activeId: fresh.id,
    created: true,
  }
}

export function updateSessionTurn(sessions, sessionId, { messages, state, lastDebug, catalog }, now = new Date()) {
  const list = Array.isArray(sessions) ? sessions : []
  const iso = toIso(now)
  let updatedTarget = null
  const others = []

  for (const s of list) {
    if (s.id !== sessionId) {
      others.push(s)
      continue
    }
    const nextDebug = lastDebug !== undefined ? lastDebug : (s.lastDebug ?? null)
    const nextMeta = mergeActivityMeta(s.activityMeta, state, nextDebug)
    const candidate = {
      ...s,
      updatedAt: iso,
      messages,
      state,
      lastDebug: nextDebug,
      activityMeta: nextMeta,
    }
    const title = !s.customTitle ? deriveSessionTitle(candidate, catalog) : s.title
    updatedTarget = {
      ...candidate,
      title,
    }
  }

  if (!updatedTarget) return list
  return [updatedTarget, ...others].slice(0, MAX_SESSIONS)
}

export function renameSession(sessions, sessionId, newTitle) {
  const clean = String(newTitle ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return sessions
  const clipped = clean.slice(0, 60)
  return (sessions || []).map((s) => (
    s.id === sessionId
      ? { ...s, title: clipped, customTitle: true }
      : s
  ))
}

export function deleteSession(sessions, activeId, sessionId, now = new Date()) {
  const remaining = (sessions || []).filter((s) => s.id !== sessionId)
  if (!remaining.length) {
    const fresh = createSessionObject(now)
    return { sessions: [fresh], activeId: fresh.id }
  }
  const nextActive = activeId === sessionId || !remaining.some((s) => s.id === activeId)
    ? remaining[0].id
    : activeId
  return { sessions: remaining, activeId: nextActive }
}

export function clearAllSessions(storage = defaultLocalStorage(), now = new Date()) {
  const fresh = createSessionObject(now)
  const next = { sessions: [fresh], activeId: fresh.id }
  saveSessionsState(next, storage)
  return next
}

export function loadChatSettings(storage = defaultLocalStorage()) {
  if (!storage) return { ...DEFAULT_CHAT_SETTINGS }
  try {
    const parsed = JSON.parse(storage.getItem(SETTINGS_KEY))
    return {
      instantReplies: Boolean(parsed?.instantReplies),
    }
  } catch {
    return { ...DEFAULT_CHAT_SETTINGS }
  }
}

export function saveChatSettings(settings, storage = defaultLocalStorage()) {
  const clean = {
    instantReplies: Boolean(settings?.instantReplies),
  }
  if (!storage) return clean
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(clean))
  } catch {
    /* ignore quota / privacy mode failures */
  }
  return clean
}

export function extractReferenceCodes(text) {
  const matches = String(text ?? '').match(/\bJAL-[A-Z0-9]{5}\b/gi)
  if (!matches) return []
  return [...new Set(matches.map((code) => code.toUpperCase()))]
}

export function hasSavedSetup(session) {
  if (!session) return false
  if (session.state?.pausedFlow) return true
  const slots = session.state?.flow?.slots || {}
  if (Object.values(slots).some(Boolean)) return true
  const msgs = Array.isArray(session.messages) ? session.messages : []
  return msgs.some(
    (m) => m?.appointment || (m?.role === 'assistant' && extractReferenceCodes(m.content).length > 0),
  )
}

/**
 * Collects up to 4 unique recent JAL-XXXXX booking references found across
 * saved browser chat sessions so returning clients can pick them in one tap.
 */
export function collectSavedReferences(sessions, catalog = null, limit = 4) {
  const ordered = [...(sessions || [])].sort(
    (a, b) => toDate(b?.updatedAt || b?.createdAt).getTime() - toDate(a?.updatedAt || a?.createdAt).getTime(),
  )
  const seen = new Set()
  const results = []

  for (const s of ordered) {
    const msgs = Array.isArray(s?.messages) ? s.messages : []
    const assistantMsgs = msgs.filter((m) => m?.role === 'assistant')
    const meta = s?.activityMeta || {}

    let serviceKey = s?.state?.flow?.slots?.service || meta.service || s?.lastDebug?.entities?.service || null
    let date = s?.state?.flow?.slots?.date || meta.date || s?.lastDebug?.entities?.date || null
    const refs = []

    const pushRef = (val) => {
      for (const code of extractReferenceCodes(val)) {
        if (!refs.includes(code)) refs.push(code)
      }
    }

    pushRef(meta.reference)
    pushRef(s?.state?.flow?.slots?.reference)
    pushRef(s?.lastDebug?.entities?.reference)

    for (let i = assistantMsgs.length - 1; i >= 0; i -= 1) {
      const m = assistantMsgs[i]
      const entities = m?.debug?.entities
      if (!serviceKey && entities?.service) serviceKey = entities.service
      if (!date && entities?.date) date = entities.date
      pushRef(entities?.reference)
      pushRef(m?.content)
    }

    const serviceName = lookupServiceName(serviceKey, catalog)
    for (const reference of refs) {
      if (seen.has(reference)) continue
      seen.add(reference)
      results.push({
        reference,
        serviceName: serviceName || null,
        date: date || null,
        sessionId: s?.id || null,
      })
      if (results.length >= limit) return results
    }
  }

  return results
}

function dayStartEpoch(dateLike) {
  const d = toDate(dateLike)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function groupSessionsByRecency(sessions, now = new Date()) {
  const todayStart = dayStartEpoch(now)
  const msPerDay = 86_400_000
  const buckets = { Today: [], Yesterday: [], Earlier: [] }

  for (const s of sessions || []) {
    const diffDays = Math.floor((todayStart - dayStartEpoch(s.updatedAt || s.createdAt || now)) / msPerDay)
    if (diffDays <= 0) buckets.Today.push(s)
    else if (diffDays === 1) buckets.Yesterday.push(s)
    else buckets.Earlier.push(s)
  }

  return ['Today', 'Yesterday', 'Earlier']
    .map((label) => ({ label, items: buckets[label] }))
    .filter((g) => g.items.length > 0)
}
