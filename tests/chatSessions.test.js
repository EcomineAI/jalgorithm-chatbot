import { describe, it, expect } from 'vitest'
import {
  SESSIONS_KEY,
  LEGACY_CONVERSATION_KEY,
  LEGACY_SESSION_ID_KEY,
  createWelcomeMessage,
  loadSessionsState,
  saveSessionsState,
  createNewSession,
  updateSessionTurn,
  renameSession,
  deleteSession,
  clearAllSessions,
  loadChatSettings,
  saveChatSettings,
  extractReferenceCodes,
  groupSessionsByRecency,
  deriveSessionTitle,
  collectSavedReferences,
  hasSavedSetup,
} from '../src/lib/chatSessions.js'
import { initialState } from '../src/jalgorithm/index.js'

const NOW = new Date('2026-11-14T12:00:00Z')

function memoryStorage(seed = {}) {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

describe('welcome copy & hygiene', () => {
  it('keeps the welcome message free of emojis and em-dashes', () => {
    const msg = createWelcomeMessage(NOW)
    expect(msg.content).not.toMatch(/—/)
    expect(msg.content).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })
})

describe('loadSessionsState & legacy migration', () => {
  it('seeds one fresh New Chat session when storage is empty', () => {
    const local = memoryStorage()
    const legacy = memoryStorage()
    const { sessions, activeId } = loadSessionsState(local, legacy, NOW)

    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe(activeId)
    expect(sessions[0].title).toBe('New Chat')
    expect(sessions[0].messages).toHaveLength(1)
    expect(sessions[0].state).toEqual(initialState())
    expect(JSON.parse(local.getItem(SESSIONS_KEY)).sessions).toHaveLength(1)
  })

  it('migrates legacy sessionStorage conversation with action-based title', () => {
    const legacyState = { ...initialState(), turn: 1 }
    const legacyMessages = [
      { id: 'welcome', role: 'assistant', content: 'Hi!' },
      { id: 1, role: 'user', content: 'Magkano bridal makeup?' },
      { id: 2, role: 'assistant', content: 'Bridal Makeup (full) is PHP 3,500.', intent: 'ASK_PRICE', debug: { entities: { service: 'bridal' } } },
    ]
    const local = memoryStorage()
    const legacy = memoryStorage({
      [LEGACY_CONVERSATION_KEY]: JSON.stringify({ messages: legacyMessages, state: legacyState }),
      [LEGACY_SESSION_ID_KEY]: 'session_legacy_123',
    })

    const { sessions, activeId } = loadSessionsState(local, legacy, NOW)
    expect(activeId).toBe('session_legacy_123')
    expect(sessions[0].title).toBe('Price Inquiry: Bridal Makeup (full)')
    expect(sessions[0].state).toEqual(legacyState)
    expect(legacy.getItem(LEGACY_CONVERSATION_KEY)).toBeNull()
  })

  it('upgrades stale raw-text session titles loaded from storage unless customTitle is true', () => {
    const staleRawSession = {
      id: 's_old',
      title: 'pagod na ako',
      customTitle: false,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      messages: [
        { id: 'welcome', role: 'assistant', content: 'Hi!' },
        { id: 1, role: 'user', content: 'pagod na ako' },
        { id: 2, role: 'assistant', content: 'Sorry, I can only help with appointments.', intent: 'UNKNOWN_INTENT' },
      ],
      state: initialState(),
    }
    const local = memoryStorage({
      [SESSIONS_KEY]: JSON.stringify({ sessions: [staleRawSession], activeId: 's_old' }),
    })

    const loaded = loadSessionsState(local, memoryStorage(), NOW)
    expect(loaded.sessions[0].title).toBe('General Chat')
  })

  it('recovers cleanly from corrupted storage JSON', () => {
    const local = memoryStorage({ [SESSIONS_KEY]: '{not-valid-json' })
    const { sessions, activeId } = loadSessionsState(local, memoryStorage(), NOW)
    expect(sessions).toHaveLength(1)
    expect(activeId).toBe(sessions[0].id)
  })
})

describe('smart action/entity naming & turn updates', () => {
  it('names off-topic conversations "General Chat" instead of raw first-message text', () => {
    const local = memoryStorage()
    const base = loadSessionsState(local, memoryStorage(), NOW)
    const id = base.activeId

    const next = updateSessionTurn(
      base.sessions,
      id,
      {
        messages: [
          ...base.sessions[0].messages,
          { id: 1, role: 'user', content: 'pagod na ako' },
          { id: 2, role: 'assistant', content: 'Pasensya na po...', intent: 'UNKNOWN_INTENT' },
        ],
        state: initialState(),
        lastDebug: { intent: 'UNKNOWN_INTENT', entities: {} },
      },
      NOW
    )

    expect(next[0].title).toBe('General Chat')
  })

  it('names active booking, completed booking, availability, reschedule, and price inquiries', () => {
    expect(
      deriveSessionTitle({
        messages: [
          { id: 'welcome', role: 'assistant', content: 'Hi!' },
          { id: 1, role: 'user', content: 'book bridal' },
          { id: 2, role: 'assistant', content: 'What date?', intent: 'BOOK_APPOINTMENT' },
        ],
        state: { ...initialState(), flow: { intent: 'BOOK_APPOINTMENT', slots: { service: 'bridal' } } },
      })
    ).toBe('Booking: Bridal Makeup (full)')

    expect(
      deriveSessionTitle({
        messages: [
          { id: 'welcome', role: 'assistant', content: 'Hi!' },
          { id: 1, role: 'user', content: 'oo' },
          {
            id: 2,
            role: 'assistant',
            content: 'Booked! Reference code is JAL-7K3QX.',
            intent: 'BOOK_APPOINTMENT',
            debug: { action: { name: 'bookAppointment', ok: true }, entities: { service: 'bridal' } },
          },
        ],
        state: initialState(),
      })
    ).toBe('Booked: Bridal Makeup (full) (JAL-7K3QX)')

    expect(
      deriveSessionTitle({
        messages: [
          { id: 'welcome', role: 'assistant', content: 'Hi!' },
          { id: 1, role: 'user', content: 'may slot sa nov 20?' },
          {
            id: 2,
            role: 'assistant',
            content: 'Available slots on Nov 20: 9:00 AM',
            intent: 'CHECK_AVAILABILITY',
            debug: { entities: { date: '2026-11-20' } },
          },
        ],
        state: initialState(),
      })
    ).toBe('Availability: 2026-11-20')

    expect(
      deriveSessionTitle({
        messages: [
          { id: 'welcome', role: 'assistant', content: 'Hi!' },
          { id: 1, role: 'user', content: 'oo' },
          {
            id: 2,
            role: 'assistant',
            content: 'Done! Appointment JAL-7K3QX is now on Nov 21.',
            intent: 'RESCHEDULE_APPOINTMENT',
            debug: { action: { name: 'rescheduleAppointment', ok: true } },
          },
        ],
        state: initialState(),
      })
    ).toBe('Rescheduled: JAL-7K3QX')
  })

  it('reuses an empty New Chat instead of spawning duplicate blank tabs', () => {
    const local = memoryStorage()
    const initial = loadSessionsState(local, memoryStorage(), NOW)
    const retry = createNewSession(initial.sessions, initial.activeId, NOW)

    expect(retry.created).toBe(false)
    expect(retry.sessions).toHaveLength(1)
    expect(retry.activeId).toBe(initial.activeId)
  })

  it('creates a new session after user messages exist and preserves custom rename', () => {
    const local = memoryStorage()
    const base = loadSessionsState(local, memoryStorage(), NOW)
    const firstId = base.activeId

    const stateA = { ...initialState(), turn: 2, flow: { intent: 'BOOK_APPOINTMENT', awaiting: 'date', slots: { service: 'bridal' } } }
    const msgsA = [
      ...base.sessions[0].messages,
      { id: 1, role: 'user', content: 'Pa book po ng bridal makeup' },
      { id: 2, role: 'assistant', content: 'Anong date po?', intent: 'BOOK_APPOINTMENT' },
    ]
    const afterTurnA = updateSessionTurn(base.sessions, firstId, { messages: msgsA, state: stateA }, NOW)
    expect(afterTurnA[0].title).toBe('Booking: Bridal Makeup (full)')

    const next = createNewSession(afterTurnA, firstId, new Date('2026-11-14T12:05:00Z'))
    expect(next.created).toBe(true)
    expect(next.sessions).toHaveLength(2)

    const renamed = renameSession(next.sessions, firstId, 'Wedding Trial')
    const msgsAfterRename = [...renamed[1].messages, { id: 3, role: 'user', content: 'how much?' }]
    const updated = updateSessionTurn(renamed, firstId, { messages: msgsAfterRename, state: stateA }, NOW)
    expect(updated[0].title).toBe('Wedding Trial')
    expect(updated[0].customTitle).toBe(true)
  })
})

describe('deleteSession & clearAllSessions', () => {
  it('ignores blank renames', () => {
    const { sessions } = loadSessionsState(memoryStorage(), memoryStorage(), NOW)
    const untouched = renameSession(sessions, sessions[0].id, '   ')
    expect(untouched[0].title).toBe('New Chat')
    expect(untouched[0].customTitle).toBe(false)
  })

  it('switches activeId when deleting the active thread, or seeds a fresh thread when last', () => {
    const local = memoryStorage()
    const s1 = { id: 's1', title: 'First', customTitle: true, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), messages: [], state: initialState() }
    const s2 = { id: 's2', title: 'Second', customTitle: true, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), messages: [], state: initialState() }
    saveSessionsState({ sessions: [s1, s2], activeId: 's1' }, local)

    const afterDeleteActive = deleteSession([s1, s2], 's1', 's1', NOW)
    expect(afterDeleteActive.sessions.map((s) => s.id)).toEqual(['s2'])
    expect(afterDeleteActive.activeId).toBe('s2')

    const afterDeleteLast = deleteSession(afterDeleteActive.sessions, 's2', 's2', NOW)
    expect(afterDeleteLast.sessions).toHaveLength(1)
    expect(afterDeleteLast.sessions[0].title).toBe('New Chat')
    expect(afterDeleteLast.activeId).toBe(afterDeleteLast.sessions[0].id)
  })

  it('clears all stored sessions back to a single New Chat', () => {
    const local = memoryStorage()
    const reset = clearAllSessions(local, NOW)
    expect(reset.sessions).toHaveLength(1)
    expect(reset.sessions[0].title).toBe('New Chat')
    expect(JSON.parse(local.getItem(SESSIONS_KEY)).sessions).toHaveLength(1)
  })
})

describe('settings, reference extraction & recency grouping', () => {
  it('defaults chat settings and persists instantReplies updates without legacy debug flags', () => {
    const local = memoryStorage()
    expect(loadChatSettings(local)).toEqual({
      instantReplies: false,
    })

    saveChatSettings(
      {
        showIntentDebug: true,
        showTurnBreakdown: true,
        showInspectorPanel: true,
        instantReplies: true,
      },
      local
    )
    expect(loadChatSettings(local)).toEqual({
      instantReplies: true,
    })
  })

  it('extracts unique JAL reference codes from replies', () => {
    expect(extractReferenceCodes('Booked! Reference code: JAL-7K3QX (save JAL-7K3QX or jal-abc12).')).toEqual([
      'JAL-7K3QX',
      'JAL-ABC12',
    ])
    expect(extractReferenceCodes('No code here')).toEqual([])
  })

  it('groups sessions into Today, Yesterday, and Earlier', () => {
    const refNow = new Date(2026, 10, 14, 15, 0, 0)
    const todayIso = new Date(2026, 10, 14, 10, 0, 0).toISOString()
    const yesterdayIso = new Date(2026, 10, 13, 18, 0, 0).toISOString()
    const earlierIso = new Date(2026, 10, 10, 9, 0, 0).toISOString()

    const groups = groupSessionsByRecency(
      [
        { id: '1', updatedAt: todayIso },
        { id: '2', updatedAt: yesterdayIso },
        { id: '3', updatedAt: earlierIso },
      ],
      refNow
    )

    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Earlier'])
    expect(groups[0].items.map((s) => s.id)).toEqual(['1'])
    expect(groups[1].items.map((s) => s.id)).toEqual(['2'])
    expect(groups[2].items.map((s) => s.id)).toEqual(['3'])
  })

  it('collects unique recent JAL-XXXXX references across saved sessions', () => {
    const catalog = {
      services: [
        { key: 'bridal', name: 'Bridal Makeup (full)' },
        { key: 'event_makeup', name: 'Event / Debut Makeup' },
      ],
    }
    const sessions = [
      {
        id: 's-old',
        updatedAt: '2026-11-10T10:00:00Z',
        activityMeta: { service: 'event_makeup', date: '2026-11-22', reference: 'JAL-111AA' },
        messages: [],
      },
      {
        id: 's-dup',
        updatedAt: '2026-11-12T10:00:00Z',
        messages: [
          { id: 'm1', role: 'assistant', content: 'Repeat code: JAL-444DD and JAL-111AA' },
          { id: 'm2', role: 'assistant', content: 'Also noted JAL-222BB.', debug: { entities: { service: 'bridal', date: '2026-11-28' } } },
        ],
      },
      {
        id: 's-new',
        updatedAt: '2026-11-14T10:00:00Z',
        activityMeta: { service: 'bridal', date: '2026-11-30', reference: 'JAL-444DD' },
        messages: [{ id: 'm3', role: 'assistant', content: 'Backup code: JAL-555EE' }],
      },
    ]

    const refs = collectSavedReferences(sessions, catalog)
    expect(refs).toHaveLength(4)
    expect(refs.map((r) => r.reference)).toEqual(['JAL-444DD', 'JAL-555EE', 'JAL-222BB', 'JAL-111AA'])
    expect(refs[0]).toEqual({
      reference: 'JAL-444DD',
      serviceName: 'Bridal Makeup (full)',
      date: '2026-11-30',
      sessionId: 's-new',
    })
  })

  it('detects whether a chat session holds saved setup details or confirmed booking codes', () => {
    expect(hasSavedSetup(null)).toBe(false)
    expect(hasSavedSetup({ state: initialState(), messages: [createWelcomeMessage(NOW)] })).toBe(false)

    expect(
      hasSavedSetup({
        state: { ...initialState(), flow: { intent: 'BOOK_APPOINTMENT', slots: { service: 'bridal' } } },
        messages: [],
      })
    ).toBe(true)

    expect(
      hasSavedSetup({
        state: { ...initialState(), pausedFlow: { intent: 'BOOK_APPOINTMENT', slots: { date: '2026-11-22' } } },
        messages: [],
      })
    ).toBe(true)

    expect(
      hasSavedSetup({
        state: initialState(),
        messages: [{ id: 'm1', role: 'assistant', content: 'Booked! Reference: JAL-999ZZ' }],
      })
    ).toBe(true)

    expect(extractReferenceCodes('Please send your booking reference code (e.g. JAL-7K3QX).')).toEqual([])
    expect(extractReferenceCodes('Pakisend po ang booking reference code mo (hal. JAL-7K3QX).')).toEqual([])
    expect(extractReferenceCodes('Confirmed booking JAL-43LE2 (e.g. JAL-7K3QX)')).toEqual(['JAL-43LE2'])
  })
})
