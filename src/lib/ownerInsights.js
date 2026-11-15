// Pure helpers for the Owner's panel, pricing/duration formatting, setup warnings,
// profile completion tracking, appointment filtering, and Chat Logs insights.
import { formatDisplayDate, manilaTodayIso, toManilaDateTime } from './calendarLinks.js'

export const PRICE_MODE_OPTIONS = [
  { value: 'fixed', label: 'Fixed price' },
  { value: 'starting', label: 'Starting from (minimum rate)' },
  { value: 'range', label: 'Price range (min to max)' },
  { value: 'varies', label: 'Price may vary (quote on inquiry)' },
]

export function splitDurationMinutes(totalMinutes) {
  const safe = Math.max(0, Math.round(Number(totalMinutes) || 0))
  return {
    hours: Math.floor(safe / 60),
    minutes: safe % 60,
  }
}

export function formatDuration(totalMinutes) {
  const safe = Math.max(0, Math.round(Number(totalMinutes) || 0))
  if (safe === 0) return 'Not set'
  const { hours, minutes } = splitDurationMinutes(safe)
  const parts = []
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hr' : 'hrs'}`)
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'min' : 'mins'}`)
  return parts.join(' ')
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-PH')
}

export function formatServicePrice(service, { includePrefix = true, withNote = false } = {}) {
  if (!service) return includePrefix ? 'PHP 0' : '0'
  const mode = service.priceMode || service.price_mode || 'fixed'
  const min = Math.max(0, Number(service.price) || 0)
  const rawMax = service.priceMax ?? service.price_max
  const max = rawMax !== null && rawMax !== undefined && rawMax !== '' ? Number(rawMax) : null
  const note = String(service.priceNote ?? service.price_note ?? '').trim()

  let base
  if (mode === 'range' && max != null && max > min) {
    base = includePrefix ? `PHP ${fmtNum(min)} - ${fmtNum(max)}` : `${fmtNum(min)} - ${fmtNum(max)}`
  } else if (mode === 'starting') {
    base = includePrefix
      ? `From PHP ${fmtNum(min)}`
      : `${fmtNum(min)} (starting rate; final price may vary)`
  } else if (mode === 'varies') {
    if (includePrefix) {
      base = min > 0 ? `Price varies (from PHP ${fmtNum(min)})` : 'Price varies'
    } else {
      base = min > 0
        ? `${fmtNum(min)} (price may vary depending on details)`
        : 'varies depending on details (please inquire for a quote)'
    }
  } else {
    base = includePrefix ? `PHP ${fmtNum(min)}` : fmtNum(min)
  }

  return withNote && note ? `${base} (${note})` : base
}

function isPlaceholderLink(url, bareHosts) {
  const trimmed = String(url ?? '').trim()
  if (!trimmed) return true
  const normalized = trimmed.toLowerCase().replace(/\/+$/, '')
  return bareHosts.includes(normalized)
}

export function checkSetupWarnings(data) {
  if (!data?.profile) return []
  const profile = data.profile
  const services = data.services ?? []
  const warnings = []

  if (!String(profile.contact ?? '').trim()) {
    warnings.push({
      id: 'missing_contact',
      tab: 'contact',
      severity: 'warning',
      title: 'Missing contact number or handle',
      detail: 'Clients cannot see how to reach you directly when asking for contact details.',
    })
  }

  if (
    isPlaceholderLink(profile.messenger_url, [
      'https://m.me',
      'http://m.me',
      'https://facebook.com',
      'https://www.facebook.com',
    ])
  ) {
    warnings.push({
      id: 'missing_messenger',
      tab: 'contact',
      severity: 'warning',
      title: 'Messenger / Page URL is incomplete',
      detail: 'Add your real Facebook or m.me link so the chatbot handoff button opens your Page.',
    })
  }

  if (
    isPlaceholderLink(profile.portfolio_url, [
      'https://facebook.com',
      'https://www.facebook.com',
      'https://instagram.com',
      'https://www.instagram.com',
    ])
  ) {
    warnings.push({
      id: 'missing_portfolio',
      tab: 'contact',
      severity: 'warning',
      title: 'Portfolio link is missing or placeholder',
      detail: 'Add your real Facebook, Instagram, or portfolio URL so clients can view your work.',
    })
  }

  if (!String(profile.payment_methods ?? '').trim()) {
    warnings.push({
      id: 'missing_payment_methods',
      tab: 'contact',
      severity: 'warning',
      title: 'Accepted payment methods not set',
      detail: 'Select GCash, bank transfer, or cash so clients know how to pay their reservation fee.',
    })
  }

  if (!String(profile.about_bio ?? '').trim()) {
    warnings.push({
      id: 'missing_bio',
      tab: 'branding',
      severity: 'info',
      title: 'About bio is blank',
      detail: 'Add a short artist bio for the website About section.',
    })
  }

  const hasFreeAreas = (profile.free_travel_areas ?? []).length > 0
  const hasTravelAreas = (profile.travel_areas ?? []).length > 0
  if (!hasFreeAreas && !hasTravelAreas) {
    warnings.push({
      id: 'missing_travel_areas',
      tab: 'travel',
      severity: 'warning',
      title: 'Service travel areas are empty',
      detail: 'Pick which locations have free travel vs. out-of-town fees.',
    })
  }

  const activeServices = services.filter((s) => s.active !== false)
  const missingInclusions = activeServices.filter((s) => !String(s.inclusions ?? '').trim())
  if (missingInclusions.length > 0) {
    warnings.push({
      id: 'missing_inclusions',
      tab: 'services',
      severity: 'info',
      title: `${missingInclusions.length} service${missingInclusions.length === 1 ? '' : 's'} missing package inclusions`,
      detail: 'Add inclusions so JAL can answer "ano kasama?" questions accurately.',
    })
  }

  const invalidRanges = activeServices.filter(
    (s) => s.price_mode === 'range' && !(Number(s.price_max) > Number(s.price)),
  )
  if (invalidRanges.length > 0) {
    warnings.push({
      id: 'invalid_price_range',
      tab: 'services',
      severity: 'warning',
      title: 'Incomplete price range on a service',
      detail: 'Set a maximum price higher than the starting price for range-priced services.',
    })
  }

  if (profile.name === "Vicky's Parlor" && profile.artist === 'Vicky') {
    warnings.push({
      id: 'default_profile',
      tab: 'overview',
      severity: 'info',
      title: 'Starter sample salon profile is active',
      detail: 'Load the Makeup and Hair by Trev Luna preset or customize your own salon details.',
    })
  }

  return warnings
}

export const CHAT_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'starred', label: 'Starred' },
  { id: 'bookings', label: 'Bookings & Availability' },
  { id: 'changes', label: 'Changes & Cancels' },
  { id: 'inquiries', label: 'Pricing & Inquiries' },
  { id: 'attention', label: 'Needs Attention' },
  { id: 'greetings', label: 'Greetings' },
]

const URGENT_PATTERN = /\b(urgent|rush|asap|complaint|reklamo|refund|problem|issue|human|owner|manager|today|tonight|ngayon|mamaya|bukas|tomorrow)\b/i

const FILLER_SPAM_TOKEN =
  /^(?:test(?:ing)?|tst|ha(?:ha)+|he(?:he)+|hi(?:hi)+|hu(?:hu)+|lo+l+|lmao+|lmfao+|rofl+|x+d+|bruh|hakdog|charot|char|eme|echos|trippings?|waley|ebarg|skibidi|sigma|rizz|gyatt|uwu|owo|meow|woof|asdf+|qwer+|zxcv+|jkl+|ok+|k+|kk+|y+a+w+n+)$/i

const KEYBOARD_MASH_SUBSTRING =
  /(?:asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm)/i

const PROFANITY_PATTERN =
  /\b(?:putang\s*ina|tang\s*ina|gago|tanga|bobo|ulol|pakyu|tarantado|kupal|fuck(?:ing)?|shit(?:ty)?|bitch(?:es)?|asshole|dick|pussy|cock)\b/i

/**
 * Identifies low-value spam, gibberish, test messages, profanity trolls, and
 * off-topic chatter so the Owner Panel keeps focus on real client inquiries.
 * Always preserves starred entries, active booking turns, and urgent complaints.
 */
export function isTrashChatLog(log, starredIds = new Set()) {
  const isStarred = starredIds instanceof Set ? starredIds.has(log?.id) : Boolean(starredIds?.[log?.id])
  if (isStarred) return false

  const rawMsg = String(log?.user_message ?? '').trim()
  const intent = String(log?.intent_classified ?? '').toUpperCase()
  const action = String(log?.entities?.action ?? '').toLowerCase()
  const hasDomainEntity = Boolean(
    log?.entities?.service ||
      log?.entities?.date ||
      log?.entities?.time ||
      (action && !['none', 'error'].includes(action)),
  )
  if (hasDomainEntity) return false

  const alnum = rawMsg.replace(/[^a-z0-9]/gi, '')
  if (!alnum) return true

  // Inside active transactional flows or real complaints, allow short replies like "3", "Ana", or "issue".
  const isUnknownOrOod = intent === 'OUT_OF_SCOPE' || intent === 'UNKNOWN_INTENT' || intent === ''
  if (URGENT_PATTERN.test(rawMsg)) return false

  const words = rawMsg
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  // Pure filler / laugh / test spam regardless of noisy classifier guess.
  if (words.length > 0 && words.every((w) => FILLER_SPAM_TOKEN.test(w) || /^\d+$/.test(w)) && !/^\d{10,12}$/.test(alnum)) {
    // Allow normal "ok" if part of a booking confirmation; block outside or in UNKNOWN/OOD.
    const onlySimpleAck = words.every((w) => /^(?:ok+|k+|kk+)$/i.test(w))
    if (!onlySimpleAck || isUnknownOrOod) return true
  }

  // Only repeated identical character (e.g. "aaaa", "zzzzz", "11111").
  if (/^(.)\1{2,}$/i.test(alnum)) return true

  if (!isUnknownOrOod) return false

  // Explicit out-of-domain chatter with no urgency or domain entity.
  if (intent === 'OUT_OF_SCOPE') return true

  // Fewer than 2 alphanumeric chars ("?", "a", "..").
  if (alnum.length < 2) return true

  // Numbers only outside a booking/lookup flow (e.g. "12345").
  if (/^\d+$/.test(alnum)) return true

  // Profanity / troll messages with no real booking intent.
  if (PROFANITY_PATTERN.test(rawMsg)) return true

  // Keyboard mash sequences or consonant-only gibberish tokens (>= 5 letters, 0 vowels).
  if (words.some((w) => KEYBOARD_MASH_SUBSTRING.test(w))) return true
  if (
    words.length <= 2 &&
    words.some((w) => /^[a-z]{5,}$/i.test(w) && !/[aeiouy]/i.test(w))
  ) {
    return true
  }

  return false
}

export function categorizeChatLog(log) {
  const intent = String(log?.intent_classified ?? '').toUpperCase()
  const conf = typeof log?.confidence === 'number' ? log.confidence : null
  const ambiguous = Boolean(log?.entities?.ambiguous)
  const urgentText = URGENT_PATTERN.test(String(log?.user_message ?? ''))

  let category = 'inquiries'
  if (intent === 'BOOK_APPOINTMENT' || intent === 'CHECK_AVAILABILITY') category = 'bookings'
  else if (
    intent === 'RESCHEDULE_APPOINTMENT' ||
    intent === 'CANCEL_APPOINTMENT' ||
    intent === 'VIEW_APPOINTMENT' ||
    intent === 'CANNOT_ATTEND'
  ) {
    category = 'changes'
  } else if (intent === 'GREETING' || intent === 'THANKS') {
    category = 'greetings'
  } else if (intent === 'UNKNOWN_INTENT' || intent === 'OUT_OF_SCOPE') {
    category = 'attention'
  }

  const lowConfidence = conf !== null && conf < 0.65 && category !== 'greetings'
  const needsAttention = category === 'attention' || ambiguous || lowConfidence || urgentText

  return { category, needsAttention, lowConfidence, urgentText }
}

/**
 * Owner Chat Logs store actionable client turns only (bookings, reschedules,
 * cancels, price/FAQ inquiries, and valid needs-attention leads). Pure greetings,
 * thanks, resets, and trash chatter stay in dev_chat_logs only.
 */
export function isOwnerImportantLog(log) {
  if (isTrashChatLog(log)) return false
  const intent = String(log?.intent_classified ?? '').toUpperCase()
  if (['GREETING', 'THANKS', 'THANK_YOU', 'GOODBYE', 'RESET'].includes(intent)) return false
  const { category } = categorizeChatLog(log)
  if (category === 'greetings') return false
  return true
}

export function scoreChatLogImportance(log, starredIds = new Set()) {
  const intent = String(log?.intent_classified ?? '').toUpperCase()
  const { category, lowConfidence, urgentText } = categorizeChatLog(log)
  const action = String(log?.entities?.action ?? '').toLowerCase()
  const isStarred = starredIds instanceof Set ? starredIds.has(log?.id) : Boolean(starredIds?.[log?.id])

  let score = 15
  const reasons = []

  if (isStarred) {
    score += 100
    reasons.push('Pinned')
  }
  if (intent === 'BOOK_APPOINTMENT') {
    score += 50
    reasons.push('Booking lead')
  } else if (intent === 'CANCEL_APPOINTMENT' || intent === 'RESCHEDULE_APPOINTMENT' || intent === 'CANNOT_ATTEND') {
    score += 55
    reasons.push('Booking change')
  } else if (intent === 'CHECK_AVAILABILITY' || intent === 'VIEW_APPOINTMENT') {
    score += 35
    reasons.push('Schedule check')
  } else if (category === 'greetings') {
    score = isStarred ? 105 : 5
  }

  if (action && !['none', 'error'].includes(action)) {
    score += 25
    reasons.push(`Action: ${action}`)
  }

  if (category === 'attention' || lowConfidence || log?.entities?.ambiguous) {
    score += 45
    reasons.push('Needs review')
  }

  if (urgentText) {
    score += 20
    reasons.push('Time-sensitive')
  }

  const level = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low'
  return { score, level, reasons, isStarred }
}

export function filterAndSortChatLogs(logs, { category = 'all', sortBy = 'newest', query = '', starredIds = new Set(), hideTrash = false } = {}) {
  const needle = String(query ?? '').trim().toLowerCase()

  const pool = hideTrash ? (logs ?? []).filter((log) => !isTrashChatLog(log, starredIds)) : (logs ?? [])

  const enriched = pool.map((log) => {
    const cat = categorizeChatLog(log)
    const importance = scoreChatLogImportance(log, starredIds)
    return { ...log, _cat: cat, _importance: importance }
  })

  const filtered = enriched.filter((item) => {
    if (category === 'starred' && !item._importance.isStarred) return false
    else if (category === 'attention' && !item._cat.needsAttention) return false
    else if (category !== 'all' && category !== 'starred' && category !== 'attention' && item._cat.category !== category) {
      return false
    }

    if (!needle) return true
    const haystack = [
      item.user_message,
      item.bot_reply,
      item.intent_classified,
      item.session_id,
      item.entities?.service,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })

  filtered.sort((a, b) => {
    const tA = new Date(a.created_at || 0).getTime()
    const tB = new Date(b.created_at || 0).getTime()
    if (sortBy === 'oldest') return tA - tB
    if (sortBy === 'important') {
      if (b._importance.score !== a._importance.score) return b._importance.score - a._importance.score
      return tB - tA
    }
    if (sortBy === 'review') {
      const aAtt = a._cat.needsAttention ? 1 : 0
      const bAtt = b._cat.needsAttention ? 1 : 0
      if (bAtt !== aAtt) return bAtt - aAtt
      const cA = typeof a.confidence === 'number' ? a.confidence : 1
      const cB = typeof b.confidence === 'number' ? b.confidence : 1
      if (cA !== cB) return cA - cB
      return tB - tA
    }
    return tB - tA
  })

  return filtered
}

export function groupChatLogsBySession(enrichedLogs, { sortBy = 'newest' } = {}) {
  const map = new Map()
  for (const log of enrichedLogs ?? []) {
    const key = log.session_id || `single-${log.id}`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(log)
  }

  const sessions = []
  for (const [sessionId, turns] of map.entries()) {
    const chronological = [...turns].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
    )
    const first = chronological[0]
    const latest = chronological[chronological.length - 1]
    const maxScore = Math.max(...chronological.map((t) => t._importance?.score ?? 0))
    const needsAttention = chronological.some((t) => t._cat?.needsAttention)
    const hasStarred = chronological.some((t) => t._importance?.isStarred)

    let service = null
    let date = null
    let time = null
    let outcomeAction = null
    let referenceCode = null
    let sessionCategory = 'inquiries'
    let hasChanges = false
    let hasBookings = false
    let hasInquiries = false
    let hasGreetingsOnly = true

    for (const turn of chronological) {
      const cat = turn._cat?.category || categorizeChatLog(turn).category
      if (cat !== 'greetings') hasGreetingsOnly = false
      if (cat === 'changes') hasChanges = true
      if (cat === 'bookings') hasBookings = true
      if (cat === 'inquiries') hasInquiries = true

      if (turn.entities?.service && !service) service = turn.entities.service
      if (turn.entities?.date) date = turn.entities.date
      if (turn.entities?.time) time = turn.entities.time
      const act = String(turn.entities?.action || '').toLowerCase()
      if (act && !['none', 'error'].includes(act)) {
        outcomeAction = act
      }
      if (!referenceCode) {
        const refMatch = /\b(JAL-[A-Z0-9]+|DRY-[A-Z0-9]+)\b/i.exec(
          `${turn.bot_reply || ''} ${turn.user_message || ''}`,
        )
        if (refMatch) referenceCode = refMatch[1].toUpperCase()
      }
    }

    if (outcomeAction === 'rescheduled' || outcomeAction === 'cancelled' || (hasChanges && !hasBookings)) {
      sessionCategory = 'changes'
    } else if (hasBookings || ['booked', 'checked_slots'].includes(outcomeAction)) {
      sessionCategory = 'bookings'
    } else if (hasInquiries) {
      sessionCategory = 'inquiries'
    } else if (hasGreetingsOnly) {
      sessionCategory = 'greetings'
    } else if (needsAttention) {
      sessionCategory = 'attention'
    }

    const resolvedCleanly = ['booked', 'rescheduled', 'cancelled'].includes(outcomeAction)
    const hasRealReviewTurn = chronological.some((t) => {
      const cat = t._cat || categorizeChatLog(t)
      return cat.category === 'attention' || cat.urgentText || Boolean(t.entities?.ambiguous)
    })
    const needsReview = resolvedCleanly
      ? chronological.some((t) => (t._cat || categorizeChatLog(t)).urgentText)
      : hasRealReviewTurn

    const opener =
      chronological.find((t) => String(t.user_message || '').trim().length > 2)?.user_message ||
      first?.user_message ||
      sessionId

    sessions.push({
      sessionId,
      turns: chronological,
      first,
      latest,
      turnCount: chronological.length,
      maxScore,
      needsAttention,
      needsReview,
      resolvedCleanly,
      hasStarred,
      category: sessionCategory,
      service,
      date,
      time,
      outcomeAction,
      referenceCode,
      title: opener,
      startedAt: new Date(first?.created_at || 0).getTime(),
      latestAt: new Date(latest?.created_at || 0).getTime(),
    })
  }

  sessions.sort((a, b) => {
    if (sortBy === 'oldest') return a.latestAt - b.latestAt
    if (sortBy === 'important') {
      if (b.maxScore !== a.maxScore) return b.maxScore - a.maxScore
      return b.latestAt - a.latestAt
    }
    if (sortBy === 'review') {
      if (Number(b.needsReview) !== Number(a.needsReview)) return Number(b.needsReview) - Number(a.needsReview)
      return b.latestAt - a.latestAt
    }
    return b.latestAt - a.latestAt
  })

  return sessions
}

function addOneDayIso(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

export function computeProfileCompletion(data) {
  const profile = data?.profile ?? {}
  const activeServices = (data?.services ?? []).filter((s) => s.active !== false)

  const milestones = [
    {
      id: 'branding',
      label: 'Salon name, artist & bio',
      tab: 'branding',
      done: Boolean(
        String(profile.name ?? '').trim() &&
          String(profile.artist ?? '').trim() &&
          String(profile.about_bio ?? '').trim(),
      ),
    },
    {
      id: 'contact',
      label: 'Direct contact number',
      tab: 'contact',
      done: Boolean(String(profile.contact ?? '').trim()),
    },
    {
      id: 'messenger',
      label: 'Messenger / Page URL',
      tab: 'contact',
      done: !isPlaceholderLink(profile.messenger_url, [
        'https://m.me',
        'http://m.me',
        'https://facebook.com',
        'https://www.facebook.com',
      ]),
    },
    {
      id: 'portfolio',
      label: 'Portfolio link',
      tab: 'contact',
      done: !isPlaceholderLink(profile.portfolio_url, [
        'https://facebook.com',
        'https://www.facebook.com',
        'https://instagram.com',
        'https://www.instagram.com',
      ]),
    },
    {
      id: 'payments',
      label: 'Accepted payment methods',
      tab: 'contact',
      done: Boolean(String(profile.payment_methods ?? '').trim()),
    },
    {
      id: 'travel',
      label: 'Travel & coverage areas',
      tab: 'travel',
      done: (profile.free_travel_areas ?? []).length > 0 || (profile.travel_areas ?? []).length > 0,
    },
    {
      id: 'inclusions',
      label: 'Active services & inclusions',
      tab: 'services',
      done:
        activeServices.length > 0 &&
        activeServices.every((s) => Boolean(String(s.inclusions ?? '').trim())),
    },
  ]

  const completed = milestones.filter((m) => m.done).length
  const total = milestones.length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
  return { percentage, completed, total, milestones }
}

export function filterAppointments(
  appointments,
  { filter = 'all', query = '', todayIso } = {},
) {
  const today = todayIso || manilaTodayIso()
  const tomorrow = addOneDayIso(today)
  const needle = String(query ?? '').trim().toLowerCase()

  return (appointments ?? []).filter((appt) => {
    const manila = toManilaDateTime(appt?.appointment_date)
    const date = manila?.date || ''
    const isActiveStatus = appt?.status === 'confirmed' || appt?.status === 'rescheduled'

    if (filter === 'upcoming') {
      if (!isActiveStatus || (date && date < today)) return false
    } else if (filter === 'soon') {
      if (!isActiveStatus || (date !== today && date !== tomorrow)) return false
    } else if (filter === 'closed') {
      const isClosedStatus = appt?.status === 'cancelled' || appt?.status === 'no_show'
      const isPast = Boolean(date) && date < today
      if (!isClosedStatus && !isPast) return false
    }

    if (!needle) return true
    const haystack = [
      appt?.reference_code,
      appt?.client_name,
      appt?.client_contact,
      appt?.service_type,
      appt?.event_location,
      appt?.status,
      date,
      date ? formatDisplayDate(date) : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}

export function shiftIsoDate(iso, deltaDays) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m) return iso
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

export function buildCalendarDateMap(appointments) {
  const map = {}
  for (const appt of appointments ?? []) {
    if (!['confirmed', 'rescheduled'].includes(appt?.status)) continue
    const manila = toManilaDateTime(appt?.appointment_date)
    if (!manila?.date) continue
    if (!map[manila.date]) map[manila.date] = []
    map[manila.date].push(appt)
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
  }
  return map
}

export function buildDashboardMetrics(appointments, chatLogs, todayIso) {
  const today = todayIso || manilaTodayIso()
  const dates = Array.from({ length: 7 }, (_, i) => shiftIsoDate(today, i - 6))
  const dateIndex = new Map(dates.map((d, i) => [d, i]))

  const totalSeries = [0, 0, 0, 0, 0, 0, 0]
  const confirmedSeries = [0, 0, 0, 0, 0, 0, 0]
  const reminderSeries = [0, 0, 0, 0, 0, 0, 0]
  const leadSeries = [0, 0, 0, 0, 0, 0, 0]

  const allAppts = appointments ?? []
  let confirmedTotal = 0
  let noShowTotal = 0
  let remindersDueTotal = 0
  const soonCutoff = shiftIsoDate(today, 3)

  for (const appt of allAppts) {
    const isConfirmedLike = appt?.status === 'confirmed' || appt?.status === 'rescheduled'
    if (appt?.status === 'confirmed') confirmedTotal += 1
    if (appt?.status === 'no_show') noShowTotal += 1

    const apptDate = toManilaDateTime(appt?.appointment_date)?.date
    if (isConfirmedLike && apptDate && apptDate >= today && apptDate <= soonCutoff && !appt?.reminder_sent) {
      remindersDueTotal += 1
    }

    const idx = apptDate ? dateIndex.get(apptDate) : undefined
    if (idx != null) {
      totalSeries[idx] += 1
      if (isConfirmedLike) confirmedSeries[idx] += 1
      if (isConfirmedLike && !appt?.reminder_sent) reminderSeries[idx] += 1
    }
  }

  let attentionLeads = 0
  let importantLeads = 0
  for (const log of chatLogs ?? []) {
    if (isTrashChatLog(log)) continue
    const cat = categorizeChatLog(log)
    if (cat.needsAttention) attentionLeads += 1
    if (isOwnerImportantLog(log)) importantLeads += 1

    const logDate = toManilaDateTime(log?.created_at)?.date
    const idx = logDate ? dateIndex.get(logDate) : undefined
    if (idx != null && isOwnerImportantLog(log)) {
      leadSeries[idx] += 1
    }
  }

  const totalBookings = allAppts.length
  const completedCount = allAppts.filter((a) => ['confirmed', 'rescheduled'].includes(a?.status)).length
  const completionRate = totalBookings ? Math.round((completedCount / totalBookings) * 100) : 0

  return {
    totalBookings,
    confirmedTotal,
    noShowTotal,
    completionRate,
    remindersDueTotal,
    attentionLeads,
    importantLeads,
    series: {
      totalBookings: totalSeries,
      confirmed: confirmedSeries,
      remindersDue: reminderSeries,
      leads: leadSeries,
    },
  }
}

export function paginateItems(items, page = 1, pageSize = 10) {
  const list = Array.isArray(items) ? items : []
  const size = Math.max(1, Number(pageSize) || 10)
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const safePage = Math.min(totalPages, Math.max(1, Number(page) || 1))
  const start = (safePage - 1) * size
  const slice = list.slice(start, start + size)
  return {
    items: slice,
    page: safePage,
    pageSize: size,
    total,
    totalPages,
    startIndex: total === 0 ? 0 : start,
    endIndex: total === 0 ? 0 : start + slice.length,
  }
}
