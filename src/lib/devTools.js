import { isOwnerImportantLog, isTrashChatLog } from './ownerInsights.js'
import { SESSIONS_KEY, hasSavedSetup } from './chatSessions.js'

export const DEV_PRUNE_STORAGE_KEY = 'jal_dev_auto_prune_days_v1'
export const STARRED_STORAGE_KEY = 'jal_starred_chat_logs_v1'

export const PRUNE_INTERVAL_OPTIONS = [
  { days: 0, label: 'Off (Manual Only)' },
  { days: 1, label: '1 Day' },
  { days: 3, label: '3 Days (Default)' },
  { days: 7, label: '7 Days' },
  { days: 14, label: '14 Days' },
  { days: 30, label: '30 Days' },
]

export function normalizePruneDays(value, fallback = 3) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(90, Math.round(n)))
}

export function loadLocalPruneDays() {
  try {
    if (typeof localStorage === 'undefined') return 3
    const raw = localStorage.getItem(DEV_PRUNE_STORAGE_KEY)
    if (raw === null) return 3
    return normalizePruneDays(raw, 3)
  } catch {
    return 3
  }
}

export function saveLocalPruneDays(days) {
  const clean = normalizePruneDays(days, 3)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEV_PRUNE_STORAGE_KEY, String(clean))
    }
  } catch {
    // Ignore storage quota or restricted context errors.
  }
  return clean
}

export function loadStarredLogIds() {
  try {
    if (typeof localStorage === 'undefined') return new Set()
    const raw = localStorage.getItem(STARRED_STORAGE_KEY)
    const parsed = JSON.parse(raw || '[]')
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

/**
 * Identifies owner `chat_logs` IDs that are safe to treat as low-value trash/noise
 * (starred logs and active leads/inquiries are never included).
 */
export function identifyOwnerTrashLogIds(ownerLogs = [], starredIds = new Set()) {
  const trashIds = []
  for (const log of ownerLogs ?? []) {
    if (!log?.id) continue
    if (starredIds instanceof Set && starredIds.has(log.id)) continue
    if (isTrashChatLog(log, starredIds) || !isOwnerImportantLog(log)) {
      trashIds.push(log.id)
    }
  }
  return trashIds
}

/**
 * Groups `dev_chat_logs` and `chat_logs` rows by `session_id` so the Dev Cleanup tab
 * can inspect complete conversations, tag trash/expired sessions, and delete cleanly.
 */
export function groupRawDevLogsBySession(
  devLogs = [],
  ownerLogs = [],
  { pruneDays = 3, starredIds = new Set(), now = new Date() } = {},
) {
  const days = normalizePruneDays(pruneDays, 3)
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const cutoffMs = days > 0 ? nowMs - days * 86_400_000 : null

  const groups = new Map()

  const getGroup = (sessionKey, fallbackRowId) => {
    const key = sessionKey || `orphan:${fallbackRowId}`
    if (!groups.has(key)) {
      groups.set(key, {
        sessionKey: key,
        sessionId: sessionKey || null,
        devTurns: [],
        ownerTurns: [],
      })
    }
    return groups.get(key)
  }

  for (const row of devLogs ?? []) {
    if (!row) continue
    getGroup(row.session_id, row.id).devTurns.push(row)
  }

  for (const row of ownerLogs ?? []) {
    if (!row) continue
    getGroup(row.session_id, row.id).ownerTurns.push(row)
  }

  const sessions = []
  for (const group of groups.values()) {
    const sortAsc = (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    const devTurns = [...group.devTurns].sort(sortAsc)
    const ownerTurns = [...group.ownerTurns].sort(sortAsc)
    const allTurns = [...devTurns, ...ownerTurns].sort(sortAsc)
    const latest = allTurns[allTurns.length - 1] || null
    const earliest = allTurns[0] || null

    const latestMs = latest?.created_at ? new Date(latest.created_at).getTime() : 0
    const isExpired = Boolean(cutoffMs && latestMs > 0 && latestMs < cutoffMs)

    const hasStarred = ownerTurns.some((t) => t.id && starredIds instanceof Set && starredIds.has(t.id))

    const hasImportantOwnerTurn = ownerTurns.some((t) => {
      if (starredIds instanceof Set && starredIds.has(t.id)) return true
      return isOwnerImportantLog(t)
    })

    const hasImportantDevTurn = devTurns.some((t) => {
      if (t.owner_logged && !t.is_trash) return true
      const fakeLog = {
        user_message: t.user_message,
        intent_classified: t.intent_classified,
        confidence: t.confidence,
        entities: t.entities,
      }
      return isOwnerImportantLog(fakeLog) && !isTrashChatLog(fakeLog)
    })

    // Pure trash/noise session: no starred turn, no important owner lead, and only trash/dev noise.
    const isTrashSession = !hasStarred && !hasImportantOwnerTurn && !hasImportantDevTurn

    const devIds = devTurns.map((t) => t.id).filter(Boolean)
    const ownerTrashIds = ownerTurns
      .filter((t) => {
        if (!t?.id) return false
        if (starredIds instanceof Set && starredIds.has(t.id)) return false
        if (isTrashSession) return true
        return isTrashChatLog(t, starredIds)
      })
      .map((t) => t.id)

    const previewTurn = devTurns[0] || ownerTurns[0] || null
    const intents = Array.from(
      new Set(allTurns.map((t) => t.intent_classified).filter(Boolean)),
    )

    sessions.push({
      sessionKey: group.sessionKey,
      sessionId: group.sessionId,
      devTurns,
      ownerTurns,
      turnCount: devTurns.length || ownerTurns.length,
      totalRows: devTurns.length + ownerTurns.length,
      devIds,
      ownerTrashIds,
      hasStarred,
      hasImportantLead: hasImportantOwnerTurn || hasImportantDevTurn,
      isTrashSession,
      isExpired,
      canDeleteFromCleanup: isTrashSession || devIds.length > 0 || ownerTrashIds.length > 0,
      firstMessage: previewTurn?.user_message || '-',
      latestMessage: latest?.user_message || '-',
      latestReply: latest?.bot_reply || '',
      intents,
      startedAt: earliest?.created_at || null,
      lastActivityAt: latest?.created_at || null,
    })
  }

  sessions.sort(
    (a, b) => new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime(),
  )

  return sessions
}

export const BATCH_TEST_SUITES = [
  {
    id: 'booking',
    label: 'Booking & Pricing',
    description: 'Core booking, pricing, availability, and reschedule phrases',
    phrases: [
      'Magkano bridal makeup?',
      'Book glam makeup next Saturday 10am',
      'Are you open this Sunday?',
      'Change location of my booking',
      'I want to reschedule my appointment',
      'Check booking JAL-DRY01',
    ],
  },
  {
    id: 'taglish',
    label: 'Taglish & Shortcuts',
    description: 'Casual Filipino/English texting shortcuts and typos',
    phrases: [
      'hm po debut makeup',
      'pwede ba bukas ng 9am',
      'san loc nyo sa olongapo',
      'anu payment methods nyo',
      'pa cancel po ng booking',
      'available b kau sa nov 28',
    ],
  },
  {
    id: 'trash',
    label: 'Trash & Spam Guard',
    description: 'Gibberish, short filler, and off-topic messages JAL should keep out of Owner Logs',
    phrases: [
      'asdfghjkl',
      '???',
      'test',
      '1',
      'hahahaha lol',
      'pagod na ako sa school',
    ],
  },
]

export function parseBatchInput(rawText) {
  return String(rawText ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 60)
}

export function runBatchNluEvaluation(bot, phrases = []) {
  if (!bot || typeof bot.analyze !== 'function') {
    return {
      rows: [],
      summary: { total: 0, matched: 0, unknown: 0, trashCount: 0, avgMs: 0, maxMs: 0 },
    }
  }

  const rows = []
  let unknown = 0
  let trashCount = 0
  let totalMs = 0
  let maxMs = 0

  for (const phrase of phrases) {
    const clean = String(phrase ?? '').trim()
    if (!clean) continue

    const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const nlu = bot.analyze(clean)
    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const elapsedMs = Number(Math.max(0.01, ended - started).toFixed(2))

    const isUnknown = !nlu?.intent || nlu.intent === 'UNKNOWN_INTENT' || nlu.intent === 'OUT_OF_SCOPE'
    const isTrash = isTrashChatLog({
      user_message: clean,
      intent_classified: nlu?.intent,
      confidence: nlu?.confidence,
      entities: nlu?.entities,
    })

    if (isUnknown) unknown += 1
    if (isTrash) trashCount += 1
    totalMs += elapsedMs
    if (elapsedMs > maxMs) maxMs = elapsedMs

    rows.push({
      phrase: clean,
      normalized: nlu?.normalized || clean,
      intent: nlu?.intent || 'UNKNOWN_INTENT',
      confidence: typeof nlu?.confidence === 'number' ? nlu.confidence : 0,
      language: nlu?.language || 'en',
      entities: nlu?.entities || {},
      elapsedMs,
      isUnknown,
      isTrash,
      reason: nlu?.reason || null,
    })
  }

  const total = rows.length
  return {
    rows,
    summary: {
      total,
      matched: total - unknown,
      unknown,
      trashCount,
      avgMs: total > 0 ? Number((totalMs / total).toFixed(2)) : 0,
      maxMs: Number(maxMs.toFixed(2)),
    },
  }
}

function getStorageSafe(explicitStorage) {
  if (explicitStorage) return explicitStorage
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function inspectLocalBrowserCache(explicitStorage = null) {
  const storage = getStorageSafe(explicitStorage)
  if (!storage) {
    return { totalSessions: 0, savedSessions: 0, draftSessions: 0, starredCount: 0 }
  }

  let sessions = []
  try {
    const raw = storage.getItem(SESSIONS_KEY)
    const parsed = JSON.parse(raw || '[]')
    if (Array.isArray(parsed)) sessions = parsed
  } catch {
    sessions = []
  }

  let starredCount = 0
  try {
    const rawStars = storage.getItem(STARRED_STORAGE_KEY)
    const parsedStars = JSON.parse(rawStars || '[]')
    if (Array.isArray(parsedStars)) starredCount = parsedStars.length
  } catch {
    starredCount = 0
  }

  let savedSessions = 0
  let draftSessions = 0
  for (const s of sessions) {
    if (hasSavedSetup(s)) savedSessions += 1
    else draftSessions += 1
  }

  return {
    totalSessions: sessions.length,
    savedSessions,
    draftSessions,
    starredCount,
  }
}

/**
 * Deletes only unbooked/empty local chat drafts on this browser (`jal_sessions_v1`),
 * keeping any session with a saved booking or confirmed flow setup intact.
 */
export function clearLocalTrashDrafts(explicitStorage = null) {
  const storage = getStorageSafe(explicitStorage)
  if (!storage) return { removedCount: 0, keptCount: 0 }

  let sessions = []
  try {
    const raw = storage.getItem(SESSIONS_KEY)
    const parsed = JSON.parse(raw || '[]')
    if (Array.isArray(parsed)) sessions = parsed
  } catch {
    return { removedCount: 0, keptCount: 0 }
  }

  const kept = sessions.filter((s) => hasSavedSetup(s))
  const removedCount = sessions.length - kept.length

  try {
    storage.setItem(SESSIONS_KEY, JSON.stringify(kept))
  } catch {
    // Ignore quota errors.
  }

  return { removedCount, keptCount: kept.length }
}
