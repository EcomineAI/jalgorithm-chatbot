import { describe, it, expect } from 'vitest'
import { createJAlgorithm } from '../src/jalgorithm/index.js'
import { SESSIONS_KEY } from '../src/lib/chatSessions.js'
import { deleteSessionLogs } from '../src/services/devLogs.js'
import {
  BATCH_TEST_SUITES,
  STARRED_STORAGE_KEY,
  clearLocalTrashDrafts,
  groupRawDevLogsBySession,
  identifyOwnerTrashLogIds,
  inspectLocalBrowserCache,
  normalizePruneDays,
  parseBatchInput,
  runBatchNluEvaluation,
} from '../src/lib/devTools.js'

function createMemoryStorage(initial = {}) {
  const store = { ...initial }
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    },
  }
}

describe('devTools helpers', () => {
  it('normalizes and clamps prune interval days safely', () => {
    expect(normalizePruneDays(undefined, 3)).toBe(3)
    expect(normalizePruneDays(0, 3)).toBe(0)
    expect(normalizePruneDays(-5, 3)).toBe(0)
    expect(normalizePruneDays(365, 3)).toBe(90)
    expect(normalizePruneDays('7', 3)).toBe(7)
  })

  it('groups dev and owner logs by session, flags trash & expired sessions, and protects real leads', () => {
    const now = new Date('2026-11-15T12:00:00Z')
    const oldTs = '2026-11-10T12:00:00Z' // 5 days old -> past 3-day threshold
    const freshTs = '2026-11-15T10:00:00Z'

    const devLogs = [
      {
        id: 'd1',
        session_id: 'sess-trash',
        user_message: 'asdfghjkl',
        bot_reply: 'Sorry...',
        intent_classified: 'UNKNOWN_INTENT',
        confidence: 0.1,
        is_trash: true,
        owner_logged: false,
        created_at: oldTs,
      },
      {
        id: 'd2',
        session_id: 'sess-trash',
        user_message: '???',
        bot_reply: 'Sorry...',
        intent_classified: 'UNKNOWN_INTENT',
        confidence: 0.05,
        is_trash: true,
        owner_logged: false,
        created_at: oldTs,
      },
      {
        id: 'd3',
        session_id: 'sess-lead',
        user_message: 'Magkano bridal makeup?',
        bot_reply: 'Here are our rates...',
        intent_classified: 'ASK_PRICE',
        confidence: 0.91,
        is_trash: false,
        owner_logged: true,
        created_at: oldTs,
      },
      {
        id: 'd4',
        session_id: 'sess-fresh-trash',
        user_message: 'hi',
        bot_reply: 'Hello!',
        intent_classified: 'GREETING',
        confidence: 0.95,
        is_trash: true,
        owner_logged: false,
        created_at: freshTs,
      },
    ]

    const ownerLogs = [
      {
        id: 'o1',
        session_id: 'sess-lead',
        user_message: 'Magkano bridal makeup?',
        bot_reply: 'Here are our rates...',
        intent_classified: 'ASK_PRICE',
        confidence: 0.91,
        created_at: oldTs,
      },
      {
        id: 'o2',
        session_id: 'sess-starred',
        user_message: 'asdfghjkl',
        bot_reply: 'Sorry...',
        intent_classified: 'UNKNOWN_INTENT',
        confidence: 0.1,
        created_at: oldTs,
      },
    ]

    const sessions = groupRawDevLogsBySession(devLogs, ownerLogs, {
      pruneDays: 3,
      starredIds: new Set(['o2']),
      now,
    })

    const trashSess = sessions.find((s) => s.sessionId === 'sess-trash')
    const leadSess = sessions.find((s) => s.sessionId === 'sess-lead')
    const freshGreet = sessions.find((s) => s.sessionId === 'sess-fresh-trash')
    const starredSess = sessions.find((s) => s.sessionId === 'sess-starred')

    expect(trashSess.isTrashSession).toBe(true)
    expect(trashSess.isExpired).toBe(true)
    expect(trashSess.devIds).toEqual(['d1', 'd2'])

    expect(leadSess.isTrashSession).toBe(false)
    expect(leadSess.hasImportantLead).toBe(true)
    expect(leadSess.ownerTrashIds).toEqual([])

    expect(freshGreet.isTrashSession).toBe(true)
    expect(freshGreet.isExpired).toBe(false)

    expect(starredSess.hasStarred).toBe(true)
    expect(starredSess.isTrashSession).toBe(false)
    expect(starredSess.ownerTrashIds).toEqual([])

    expect(identifyOwnerTrashLogIds(ownerLogs, new Set(['o2']))).toEqual([])
  })

  it('handles null catalog gracefully in createJAlgorithm without throwing', () => {
    const bot = createJAlgorithm({ catalog: null })
    expect(bot.stats.intentsCount).toBeGreaterThan(5)
    expect(bot.analyze('Magkano bridal makeup?').intent).toBe('ASK_PRICE')
  })

  it('evaluates batch phrases via JAlgorithm without DB writes', () => {
    const bot = createJAlgorithm()
    expect(bot.stats.intentsCount).toBeGreaterThan(5)
    expect(bot.stats.trainingSize).toBeGreaterThan(50)

    const phrases = parseBatchInput([
      ...BATCH_TEST_SUITES[0].phrases.slice(0, 2),
      ...BATCH_TEST_SUITES[2].phrases.slice(0, 2),
    ].join('\n'))

    const report = runBatchNluEvaluation(bot, phrases)
    expect(report.summary.total).toBe(4)
    expect(report.summary.trashCount).toBeGreaterThanOrEqual(2)
    expect(report.rows[0].intent).toBe('ASK_PRICE')
    expect(report.rows[0].isTrash).toBe(false)
    expect(report.rows[2].isTrash).toBe(true)
  })

  it('clears empty local test drafts while preserving booked or saved setups', () => {
    const storage = createMemoryStorage({
      [SESSIONS_KEY]: JSON.stringify([
        { id: 'draft-1', messages: [{ role: 'user', content: 'hi' }], state: {} },
        {
          id: 'booked-1',
          messages: [{ role: 'assistant', content: 'Confirmed REF JAL-ABC12' }],
          state: { flow: { slots: { service: 'bridal' } } },
        },
      ]),
      [STARRED_STORAGE_KEY]: JSON.stringify(['log-1']),
    })

    const before = inspectLocalBrowserCache(storage)
    expect(before.totalSessions).toBe(2)
    expect(before.draftSessions).toBe(1)
    expect(before.savedSessions).toBe(1)
    expect(before.starredCount).toBe(1)

    const res = clearLocalTrashDrafts(storage)
    expect(res).toEqual({ removedCount: 1, keptCount: 1 })

    const after = inspectLocalBrowserCache(storage)
    expect(after.totalSessions).toBe(1)
    expect(after.savedSessions).toBe(1)
    expect(after.draftSessions).toBe(0)
  })

  it('deleteSessionLogs skips dev_chat_logs when devIds is empty and deletes chat_logs cleanly', async () => {
    const queriedTables = []
    const mockClient = {
      rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'not found' } }),
      from: (table) => {
        queriedTables.push(table)
        return {
          delete: () => ({
            in: () => ({
              select: async () => ({ data: [{ id: 'owner-1' }], error: null }),
            }),
          }),
        }
      },
    }

    const res = await deleteSessionLogs(
      { sessionId: 'sess-123', devIds: [], ownerTrashIds: ['owner-1'] },
      { client: mockClient },
    )
    expect(res).toEqual({ ok: true, deletedDev: 0, deletedOwnerTrash: 1 })
    expect(queriedTables).toEqual(['chat_logs'])
  })

  it('exposes full pipeline trace fields on bot.analyze for Animated NLU Flow', () => {
    const bot = createJAlgorithm()
    const nlu = bot.analyze('hm bridal makeup?')
    expect(nlu.tokens.length).toBeGreaterThan(0)
    expect(nlu.changes.length).toBeGreaterThan(0)
    expect(nlu.ranked.length).toBeGreaterThan(0)
    expect(nlu.components.rules).toBeTruthy()
    expect(nlu.components.naiveBayes).toBeTruthy()
    expect(nlu.components.tfidf).toBeTruthy()
    expect(nlu.intent).toBe('ASK_PRICE')
  })
})
