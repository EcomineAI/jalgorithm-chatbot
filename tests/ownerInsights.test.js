import { describe, expect, it } from 'vitest'
import {
  splitDurationMinutes,
  formatDuration,
  formatServicePrice,
  checkSetupWarnings,
  categorizeChatLog,
  scoreChatLogImportance,
  filterAndSortChatLogs,
  groupChatLogsBySession,
  computeProfileCompletion,
  filterAppointments,
  isTrashChatLog,
  isOwnerImportantLog,
  shiftIsoDate,
  buildCalendarDateMap,
  buildDashboardMetrics,
  paginateItems,
} from '../src/lib/ownerInsights.js'

describe('ownerInsights duration formatting', () => {
  it('splits minutes into hours and remaining minutes', () => {
    expect(splitDurationMinutes(150)).toEqual({ hours: 2, minutes: 30 })
    expect(splitDurationMinutes(60)).toEqual({ hours: 1, minutes: 0 })
    expect(splitDurationMinutes(45)).toEqual({ hours: 0, minutes: 45 })
  })

  it('formats durations cleanly with hours and minutes', () => {
    expect(formatDuration(0)).toBe('Not set')
    expect(formatDuration(60)).toBe('1 hr')
    expect(formatDuration(120)).toBe('2 hrs')
    expect(formatDuration(150)).toBe('2 hrs 30 mins')
    expect(formatDuration(45)).toBe('45 mins')
  })
})

describe('ownerInsights flexible pricing formatting', () => {
  it('formats fixed, starting, range, and varies modes cleanly', () => {
    expect(formatServicePrice({ price: 3500, price_mode: 'fixed' })).toBe('PHP 3,500')
    expect(formatServicePrice({ price: 2000, price_mode: 'starting' })).toBe('From PHP 2,000')
    expect(formatServicePrice({ price: 2000, price_max: 3500, price_mode: 'range' })).toBe('PHP 2,000 - 3,500')
    expect(formatServicePrice({ price: 1500, price_mode: 'varies' })).toBe('Price varies (from PHP 1,500)')
    expect(formatServicePrice({ price: 0, price_mode: 'varies' })).toBe('Price varies')
  })

  it('includes optional price notes and bot template variants cleanly', () => {
    expect(
      formatServicePrice(
        { price: 2000, priceMax: 3500, priceMode: 'range', priceNote: 'Depends on hair length' },
        { includePrefix: false, withNote: true },
      ),
    ).toBe('2,000 - 3,500 (Depends on hair length)')

    expect(
      formatServicePrice({ price: 2500, priceMode: 'starting' }, { includePrefix: false }),
    ).toBe('2,500 (starting rate; final price may vary)')
  })
})

describe('checkSetupWarnings', () => {
  it('flags missing contact, placeholder URLs, blank bio, travel areas, and incomplete inclusions', () => {
    const warnings = checkSetupWarnings({
      profile: {
        name: "Vicky's Parlor",
        artist: 'Vicky',
        contact: '',
        messenger_url: 'https://m.me/',
        portfolio_url: 'https://www.facebook.com/',
        payment_methods: '',
        about_bio: '',
        free_travel_areas: [],
        travel_areas: [],
      },
      services: [
        { key: 'bridal', active: true, price: 2000, price_mode: 'range', price_max: 1500, inclusions: '' },
      ],
    })

    const ids = warnings.map((w) => w.id)
    expect(ids).toContain('missing_contact')
    expect(ids).toContain('missing_messenger')
    expect(ids).toContain('missing_portfolio')
    expect(ids).toContain('missing_payment_methods')
    expect(ids).toContain('missing_bio')
    expect(ids).toContain('missing_travel_areas')
    expect(ids).toContain('missing_inclusions')
    expect(ids).toContain('invalid_price_range')
    expect(ids).toContain('default_profile')
  })

  it('returns empty array when all essential business fields are configured', () => {
    const warnings = checkSetupWarnings({
      profile: {
        name: 'Makeup and Hair by Trev Luna',
        artist: 'Trev Luna',
        contact: '09171234567',
        messenger_url: 'https://m.me/trevlunamakeup',
        portfolio_url: 'https://www.facebook.com/trevlunamakeup',
        payment_methods: 'GCash, Bank Transfer',
        about_bio: 'Professional MUA in Olongapo City.',
        free_travel_areas: ['Olongapo City', 'Subic Bay'],
        travel_areas: ['Zambales'],
      },
      services: [
        { key: 'bridal', active: true, price: 3500, price_mode: 'fixed', inclusions: 'Full skin prep and lashes' },
      ],
    })

    expect(warnings).toEqual([])
  })
})

describe('chat log categorization, importance ranking, and session grouping', () => {
  const sampleLogs = [
    {
      id: '1',
      session_id: 'sess-a',
      user_message: 'hi',
      bot_reply: 'Hi!',
      intent_classified: 'GREETING',
      confidence: 0.99,
      created_at: '2026-11-14T10:00:00Z',
    },
    {
      id: '2',
      session_id: 'sess-b',
      user_message: 'Need rush bridal makeup tomorrow!',
      bot_reply: 'Let me check...',
      intent_classified: 'BOOK_APPOINTMENT',
      confidence: 0.91,
      entities: { action: 'booked', service: 'bridal' },
      created_at: '2026-11-14T09:00:00Z',
    },
    {
      id: '3',
      session_id: 'sess-c',
      user_message: 'asdfghjkl',
      bot_reply: 'Sorry...',
      intent_classified: 'UNKNOWN_INTENT',
      confidence: 0.25,
      created_at: '2026-11-14T08:00:00Z',
    },
  ]

  it('categorizes logs and scores booking/attention/starred entries higher than greetings', () => {
    expect(categorizeChatLog(sampleLogs[0]).category).toBe('greetings')
    expect(categorizeChatLog(sampleLogs[1]).category).toBe('bookings')
    expect(categorizeChatLog(sampleLogs[2]).needsAttention).toBe(true)

    const starred = new Set(['1'])
    expect(scoreChatLogImportance(sampleLogs[0], starred).level).toBe('high')
    expect(scoreChatLogImportance(sampleLogs[1]).level).toBe('high')
    expect(scoreChatLogImportance(sampleLogs[0]).level).toBe('low')
  })

  it('filters by category and sorts by newest, oldest, important, and needs review', () => {
    const byImportant = filterAndSortChatLogs(sampleLogs, { sortBy: 'important' })
    expect(byImportant[0].id).toBe('2')
    expect(byImportant[byImportant.length - 1].id).toBe('1')

    const byOldest = filterAndSortChatLogs(sampleLogs, { sortBy: 'oldest' })
    expect(byOldest.map((l) => l.id)).toEqual(['3', '2', '1'])

    const byReview = filterAndSortChatLogs(sampleLogs, { sortBy: 'review' })
    expect(byReview[0].id).toBe('3')

    const onlyAttention = filterAndSortChatLogs(sampleLogs, { category: 'attention' })
    expect(onlyAttention.map((l) => l.id)).toEqual(['2', '3'])
  })

  it('groups enriched logs by session and orders conversations', () => {
    const enriched = filterAndSortChatLogs([
      ...sampleLogs,
      {
        id: '4',
        session_id: 'sess-a',
        user_message: 'magkano bridal',
        bot_reply: 'PHP 3,500',
        intent_classified: 'ASK_PRICE',
        confidence: 0.95,
        created_at: '2026-11-14T10:05:00Z',
      },
    ])
    const sessions = groupChatLogsBySession(enriched, { sortBy: 'important' })
    expect(sessions[0].sessionId).toBe('sess-b')
    expect(sessions.find((s) => s.sessionId === 'sess-a')?.turnCount).toBe(2)
  })
})

describe('ownerInsights profile completion & appointment filtering', () => {
  it('computes milestone completion percentage accurately', () => {
    const partial = computeProfileCompletion({
      profile: {
        name: 'Studio Glow',
        artist: 'Mia',
        about_bio: '',
        contact: '09171234567',
        messenger_url: 'https://m.me',
        portfolio_url: 'https://instagram.com/studioglow',
        payment_methods: 'GCash',
        free_travel_areas: ['Olongapo City'],
        travel_areas: [],
      },
      services: [
        { key: 'bridal', active: true, inclusions: 'Lashes and hairstyling' },
      ],
    })
    expect(partial.completed).toBe(5)
    expect(partial.total).toBe(7)
    expect(partial.percentage).toBe(71)

    const complete = computeProfileCompletion({
      profile: {
        name: 'Studio Glow',
        artist: 'Mia',
        about_bio: 'Olongapo bridal artist.',
        contact: '09171234567',
        messenger_url: 'https://m.me/studioglow',
        portfolio_url: 'https://instagram.com/studioglow',
        payment_methods: 'GCash, Cash',
        free_travel_areas: ['Olongapo City'],
      },
      services: [
        { key: 'bridal', active: true, inclusions: 'Airbrush makeup + hair' },
        { key: 'old', active: false, inclusions: '' },
      ],
    })
    expect(complete.completed).toBe(7)
    expect(complete.percentage).toBe(100)
  })

  it('filters appointments by status bucket and search query in Manila time', () => {
    const appts = [
      {
        id: '1',
        reference_code: 'JAL-TODAY',
        client_name: 'Ana Cruz',
        client_contact: '09171112222',
        service_type: 'Bridal Makeup',
        event_location: 'Subic Bay Yacht Club',
        appointment_date: '2026-11-15T06:00:00Z', // Nov 15 2:00 PM Manila
        status: 'confirmed',
      },
      {
        id: '2',
        reference_code: 'JAL-TOMRW',
        client_name: 'Bea Santos',
        client_contact: '09183334444',
        service_type: 'Debut Makeup',
        event_location: 'Olongapo City',
        appointment_date: '2026-11-16T01:00:00Z', // Nov 16 9:00 AM Manila
        status: 'rescheduled',
      },
      {
        id: '3',
        reference_code: 'JAL-FUTUR',
        client_name: 'Carla Reyes',
        client_contact: '09195556666',
        service_type: 'Personal Makeup',
        event_location: '',
        appointment_date: '2026-11-25T05:00:00Z',
        status: 'confirmed',
      },
      {
        id: '4',
        reference_code: 'JAL-CANCL',
        client_name: 'Dina Lopez',
        client_contact: '09179990000',
        service_type: 'Hair Styling',
        event_location: 'Subic',
        appointment_date: '2026-11-20T05:00:00Z',
        status: 'cancelled',
      },
      {
        id: '5',
        reference_code: 'JAL-OLD01',
        client_name: 'Elena Go',
        client_contact: '09170001111',
        service_type: 'Event Makeup',
        event_location: 'Bataan',
        appointment_date: '2026-11-10T05:00:00Z',
        status: 'confirmed',
      },
    ]

    expect(filterAppointments(appts, { filter: 'all', todayIso: '2026-11-15' })).toHaveLength(5)
    expect(filterAppointments(appts, { filter: 'upcoming', todayIso: '2026-11-15' }).map((a) => a.id)).toEqual(['1', '2', '3'])
    expect(filterAppointments(appts, { filter: 'soon', todayIso: '2026-11-15' }).map((a) => a.id)).toEqual(['1', '2'])
    expect(filterAppointments(appts, { filter: 'closed', todayIso: '2026-11-15' }).map((a) => a.id)).toEqual(['4', '5'])
    expect(filterAppointments(appts, { filter: 'all', query: '0918333', todayIso: '2026-11-15' }).map((a) => a.id)).toEqual(['2'])
    expect(filterAppointments(appts, { filter: 'all', query: 'yacht club', todayIso: '2026-11-15' }).map((a) => a.id)).toEqual(['1'])
    expect(filterAppointments(appts, { filter: 'all', query: '2026-11-15', todayIso: '2026-11-15' }).map((a) => a.id)).toEqual(['1'])
    expect(filterAppointments(appts, { filter: 'all', query: 'Nov 16, 2026', todayIso: '2026-11-15' }).map((a) => a.id)).toEqual(['2'])
  })

  it('filters spam, gibberish, and off-topic trash while preserving real inquiries and urgent messages', () => {
    expect(isTrashChatLog({ id: 't1', user_message: 'asdfghjkl', intent_classified: 'UNKNOWN_INTENT' })).toBe(true)
    expect(isTrashChatLog({ id: 't2', user_message: '???', intent_classified: 'UNKNOWN_INTENT' })).toBe(true)
    expect(isTrashChatLog({ id: 't3', user_message: 'hahahaha lol', intent_classified: 'GREETING' })).toBe(true)
    expect(isTrashChatLog({ id: 't4', user_message: 'pagod na ako', intent_classified: 'OUT_OF_SCOPE' })).toBe(true)
    expect(isTrashChatLog({ id: 't5', user_message: 'test', intent_classified: 'UNKNOWN_INTENT' })).toBe(true)

    expect(isTrashChatLog({ id: 'r1', user_message: 'do you do eyebrow threading?', intent_classified: 'UNKNOWN_INTENT' })).toBe(false)
    expect(isTrashChatLog({ id: 'r2', user_message: 'gusto ko kausapin owner urgent', intent_classified: 'OUT_OF_SCOPE' })).toBe(false)
    expect(isTrashChatLog({ id: 'r3', user_message: 'Ana', intent_classified: 'BOOK_APPOINTMENT' })).toBe(false)
    expect(isTrashChatLog({ id: 'r4', user_message: 'hi', intent_classified: 'GREETING' })).toBe(false)
    expect(
      isTrashChatLog({ id: 't1', user_message: 'asdfghjkl', intent_classified: 'UNKNOWN_INTENT' }, new Set(['t1'])),
    ).toBe(false)

    const mixed = [
      { id: '1', user_message: 'asdfghjkl', intent_classified: 'UNKNOWN_INTENT', created_at: '2026-11-14T10:00:00Z' },
      { id: '2', user_message: 'pagod na ako', intent_classified: 'OUT_OF_SCOPE', created_at: '2026-11-14T10:01:00Z' },
      { id: '3', user_message: 'do you have lash lift?', intent_classified: 'UNKNOWN_INTENT', created_at: '2026-11-14T10:02:00Z' },
    ]
    expect(filterAndSortChatLogs(mixed, { hideTrash: true }).map((l) => l.id)).toEqual(['3'])
    expect(filterAndSortChatLogs(mixed, { hideTrash: false })).toHaveLength(3)
  })

  it('filters owner chat logs strictly to actionable transactions, inquiries, and real needs-attention messages', () => {
    expect(isOwnerImportantLog({ user_message: 'hi', intent_classified: 'GREETING' })).toBe(false)
    expect(isOwnerImportantLog({ user_message: 'thanks!', intent_classified: 'THANKS' })).toBe(false)
    expect(isOwnerImportantLog({ user_message: 'bye', intent_classified: 'GOODBYE' })).toBe(false)
    expect(isOwnerImportantLog({ user_message: 'asdfghjkl', intent_classified: 'UNKNOWN_INTENT' })).toBe(false)
    expect(isOwnerImportantLog({ user_message: 'pagod na ako', intent_classified: 'OUT_OF_SCOPE' })).toBe(false)

    expect(isOwnerImportantLog({ user_message: 'book bridal', intent_classified: 'BOOK_APPOINTMENT' })).toBe(true)
    expect(isOwnerImportantLog({ user_message: 'how much', intent_classified: 'ASK_PRICE' })).toBe(true)
    expect(isOwnerImportantLog({ user_message: 'reschedule JAL-12345', intent_classified: 'RESCHEDULE_APPOINTMENT' })).toBe(true)
    expect(isOwnerImportantLog({ user_message: 'do you have lash lift?', intent_classified: 'UNKNOWN_INTENT' })).toBe(true)
  })
})

describe('ownerInsights dashboard calendar, metrics & pagination', () => {
  it('shifts ISO calendar dates across month boundaries', () => {
    expect(shiftIsoDate('2026-11-29', 3)).toBe('2026-12-02')
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('groups only active bookings by Manila calendar date sorted ascending', () => {
    const appts = [
      { id: '1', status: 'confirmed', appointment_date: '2026-11-22T06:00:00Z' },
      { id: '2', status: 'rescheduled', appointment_date: '2026-11-22T01:00:00Z' },
      { id: '3', status: 'cancelled', appointment_date: '2026-11-22T03:00:00Z' },
    ]
    const map = buildCalendarDateMap(appts)
    expect(Object.keys(map)).toEqual(['2026-11-22'])
    expect(map['2026-11-22'].map((a) => a.id)).toEqual(['2', '1'])
  })

  it('computes 7-day dashboard KPI totals, due reminders, and actionable leads', () => {
    const appts = [
      { id: 'a1', status: 'confirmed', appointment_date: '2026-11-15T02:00:00Z', reminder_sent: false },
      { id: 'a2', status: 'rescheduled', appointment_date: '2026-11-16T02:00:00Z', reminder_sent: true },
      { id: 'a3', status: 'no_show', appointment_date: '2026-11-14T02:00:00Z', reminder_sent: false },
    ]
    const logs = [
      { id: 'l1', user_message: 'book bridal', intent_classified: 'BOOK_APPOINTMENT', created_at: '2026-11-15T01:00:00Z' },
      { id: 'l2', user_message: 'asdfghjkl', intent_classified: 'UNKNOWN_INTENT', created_at: '2026-11-15T02:00:00Z' },
      { id: 'l3', user_message: 'do you have lash lift?', intent_classified: 'UNKNOWN_INTENT', created_at: '2026-11-15T03:00:00Z' },
    ]
    const metrics = buildDashboardMetrics(appts, logs, '2026-11-15')
    expect(metrics.totalBookings).toBe(3)
    expect(metrics.confirmedTotal).toBe(1)
    expect(metrics.noShowTotal).toBe(1)
    expect(metrics.completionRate).toBe(67)
    expect(metrics.remindersDueTotal).toBe(1)
    expect(metrics.importantLeads).toBe(2)
    expect(metrics.attentionLeads).toBe(1)
    expect(metrics.series.totalBookings).toHaveLength(7)
    expect(metrics.series.leads[6]).toBe(2)
  })

  it('paginates lists with clamped pages and 0-based startIndex', () => {
    const items = Array.from({ length: 15 }, (_, i) => i + 1)
    const p1 = paginateItems(items, 1, 10)
    expect(p1.items).toHaveLength(10)
    expect(p1.totalPages).toBe(2)
    expect(p1.startIndex).toBe(0)
    expect(p1.endIndex).toBe(10)

    const p2 = paginateItems(items, 99, 10)
    expect(p2.page).toBe(2)
    expect(p2.items).toEqual([11, 12, 13, 14, 15])
    expect(p2.startIndex).toBe(10)
    expect(p2.endIndex).toBe(15)

    const empty = paginateItems([], 1, 10)
    expect(empty.total).toBe(0)
    expect(empty.totalPages).toBe(1)
    expect(empty.startIndex).toBe(0)
    expect(empty.endIndex).toBe(0)
  })

  it('aggregates a multi-turn booking session cleanly with reference code and outcome', () => {
    const bookingTurns = filterAndSortChatLogs([
      {
        id: 'b1',
        session_id: 'sess-book-1',
        user_message: 'bridal makeup',
        bot_reply: 'What date would you like?',
        intent_classified: 'BOOK_APPOINTMENT',
        confidence: 0.55,
        entities: { service: 'bridal' },
        created_at: '2026-11-15T01:00:00Z',
      },
      {
        id: 'b2',
        session_id: 'sess-book-1',
        user_message: 'june vic',
        bot_reply: 'What is your mobile number?',
        intent_classified: 'BOOK_APPOINTMENT',
        confidence: 0.08,
        created_at: '2026-11-15T01:01:00Z',
      },
      {
        id: 'b3',
        session_id: 'sess-book-1',
        user_message: '09851835247',
        bot_reply: 'Is this correct?',
        intent_classified: 'BOOK_APPOINTMENT',
        confidence: 0.08,
        created_at: '2026-11-15T01:02:00Z',
      },
      {
        id: 'b4',
        session_id: 'sess-book-1',
        user_message: 'Yes, confirm',
        bot_reply: 'Booked! Reference code JAL-MYRA7.',
        intent_classified: 'BOOK_APPOINTMENT',
        confidence: 0.08,
        entities: { action: 'booked', service: 'bridal', date: '2026-11-22' },
        created_at: '2026-11-15T01:03:00Z',
      },
    ])

    const grouped = groupChatLogsBySession(bookingTurns)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].turnCount).toBe(4)
    expect(grouped[0].category).toBe('bookings')
    expect(grouped[0].outcomeAction).toBe('booked')
    expect(grouped[0].referenceCode).toBe('JAL-MYRA7')
    expect(grouped[0].resolvedCleanly).toBe(true)
    expect(grouped[0].needsReview).toBe(false)
    expect(grouped[0].title).toBe('bridal makeup')
  })
})
