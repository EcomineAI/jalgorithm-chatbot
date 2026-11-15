// Helpers for showing owner/auto reminders inside a client's saved chat session.
// Pure functions only: no Supabase or browser APIs, so they can be unit-tested in Node.

import { extractReferenceCodes } from './chatSessions.js'

/** Normalizes a Philippine mobile number to 09XXXXXXXXX, or returns null. */
export function normalizeMobile(text) {
  const digits = String(text ?? '').replace(/\D/g, '')
  if (/^09\d{9}$/.test(digits)) return digits
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`
  return null
}

/** The first mobile number the client typed in this session, or null. */
export function findSessionContact(session) {
  const msgs = Array.isArray(session?.messages) ? session.messages : []
  for (const m of msgs) {
    if (m?.role !== 'user') continue
    for (const token of String(m.content ?? '').split(/[\s,;]+/)) {
      const mobile = normalizeMobile(token)
      if (mobile) return mobile
    }
  }
  return null
}

/**
 * Pairs each booking reference in a session with the mobile number the client typed there.
 * The server checks the pair against the booking, so a wrong pair simply matches nothing.
 */
export function collectReferenceContacts(sessions, limit = 4) {
  const results = []
  const seen = new Set()

  for (const session of Array.isArray(sessions) ? sessions : []) {
    const contact = findSessionContact(session)
    if (!contact) continue

    const refs = []
    const addRefs = (text) => {
      for (const code of extractReferenceCodes(text)) {
        if (!refs.includes(code)) refs.push(code)
      }
    }
    addRefs(session?.activityMeta?.reference)
    addRefs(session?.state?.flow?.slots?.reference)
    for (const m of Array.isArray(session.messages) ? session.messages : []) {
      addRefs(m?.content)
    }

    for (const reference of refs) {
      const key = `${reference}|${contact}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push({ reference, contact, sessionId: session.id })
      if (results.length >= limit) return results
    }
  }

  return results
}

/**
 * Adds delivered reminders to one session as assistant messages.
 * Items already present (matched by reminder id) are skipped, so polling is safe to repeat.
 */
export function appendReminderMessages(sessions, sessionId, items, now = new Date()) {
  const list = Array.isArray(sessions) ? sessions : []
  if (!Array.isArray(items) || items.length === 0) return list

  return list.map((session) => {
    if (session.id !== sessionId) return session

    const existing = new Set(
      (Array.isArray(session.messages) ? session.messages : []).map((m) => m?.reminderId).filter(Boolean),
    )
    const fresh = items
      .filter((item) => item?.id && !existing.has(item.id) && item.body)
      .map((item) => ({
        id: `reminder-${item.id}`,
        role: 'assistant',
        content: String(item.body),
        kind: 'reminder',
        reminderId: item.id,
        createdAt: item.createdAt || now.toISOString(),
      }))

    if (fresh.length === 0) return session
    return {
      ...session,
      messages: [...(session.messages || []), ...fresh],
      updatedAt: now.toISOString(),
    }
  })
}
