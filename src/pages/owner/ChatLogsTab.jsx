import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import {
  categorizeChatLog,
  filterAndSortChatLogs,
  groupChatLogsBySession,
  isTrashChatLog,
  paginateItems,
} from '../../lib/ownerInsights.js'
import { PaginationBar, StatKpiCard } from '../../components/owner/OwnerPrimitives.jsx'

const STARRED_STORAGE_KEY = 'jal_starred_chat_logs_v1'

function loadStarredIds() {
  try {
    const raw = localStorage.getItem(STARRED_STORAGE_KEY)
    const parsed = JSON.parse(raw || '[]')
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveStarredIds(idsSet) {
  try {
    localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify([...idsSet]))
  } catch {
    // Ignore storage quota errors in restricted browsers.
  }
}

function formatLogTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })
}

function collapseToSingleLine(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  return clean || '-'
}

function getSessionPrimaryBadge(session) {
  const refSuffix = session.referenceCode ? ` · ${session.referenceCode}` : ''

  if (session.outcomeAction === 'created') {
    return {
      label: `Booked${refSuffix}`,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }
  if (session.outcomeAction === 'rescheduled') {
    return {
      label: `Rescheduled${refSuffix}`,
      tone: 'bg-sky-50 text-sky-700 border-sky-200',
    }
  }
  if (session.outcomeAction === 'cancelled') {
    return {
      label: `Cancelled${refSuffix}`,
      tone: 'bg-rose-50 text-rose-700 border-rose-200',
    }
  }
  if (session.needsReview && !session.resolvedCleanly) {
    return {
      label: 'Needs Review',
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
    }
  }
  if (session.category === 'bookings') {
    return {
      label: 'Booking Lead',
      tone: 'bg-pink-50 text-pink-700 border-pink-200',
    }
  }
  if (session.category === 'changes') {
    return {
      label: 'Change Request',
      tone: 'bg-rose-50 text-rose-700 border-rose-200',
    }
  }
  if (session.category === 'greetings') {
    return {
      label: 'Greeting',
      tone: 'bg-gray-50 text-gray-600 border-gray-200',
    }
  }
  return {
    label: 'Inquiry',
    tone: 'bg-purple-50 text-purple-700 border-purple-200',
  }
}

export default function ChatLogsTab({ chatLogs }) {
  const [viewMode, setViewMode] = useState('sessions')
  const [category, setCategory] = useState('all')
  const [sortBy, setSortBy] = useState('important')
  const [query, setQuery] = useState('')
  const [hideTrash, setHideTrash] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [starredIds, setStarredIds] = useState(() => loadStarredIds())
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
    setExpandedId(null)
  }, [viewMode, category, sortBy, query, hideTrash, chatLogs?.length])

  const toggleStar = (id, event) => {
    event?.stopPropagation()
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveStarredIds(next)
      return next
    })
  }

  const toggleSessionStar = (session, event) => {
    event?.stopPropagation()
    const ids = session.turns.map((t) => t.id).filter(Boolean)
    if (ids.length === 0) return
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (session.hasStarred) {
        ids.forEach((id) => next.delete(id))
      } else {
        next.add(session.latest?.id || ids[0])
      }
      saveStarredIds(next)
      return next
    })
  }

  const trashCount = useMemo(
    () => (chatLogs ?? []).filter((log) => isTrashChatLog(log, starredIds)).length,
    [chatLogs, starredIds],
  )

  const allBaseLogs = useMemo(
    () =>
      filterAndSortChatLogs(chatLogs ?? [], {
        category: 'all',
        sortBy,
        query: '',
        starredIds,
        hideTrash,
      }),
    [chatLogs, sortBy, starredIds, hideTrash],
  )

  const sessions = useMemo(
    () => groupChatLogsBySession(allBaseLogs, { sortBy }),
    [allBaseLogs, sortBy],
  )

  const filteredSessions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase()
    return sessions.filter((session) => {
      if (category === 'starred' && !session.hasStarred) return false
      if (category === 'bookings' && session.category !== 'bookings' && session.category !== 'changes') {
        return false
      }
      if (category === 'attention' && !session.needsReview) return false
      if (!cleanQuery) return true
      const haystack = [
        session.sessionId,
        session.service,
        session.referenceCode,
        ...session.turns.flatMap((t) => [t.user_message, t.bot_reply, t.entities?.service, t.entities?.date]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(cleanQuery)
    })
  }, [sessions, category, query])

  const filteredLogs = useMemo(() => {
    if (category === 'bookings') {
      const bookingLogs = filterAndSortChatLogs(chatLogs ?? [], {
        category: 'bookings',
        sortBy,
        query,
        starredIds,
        hideTrash,
      })
      const changeLogs = filterAndSortChatLogs(chatLogs ?? [], {
        category: 'changes',
        sortBy,
        query,
        starredIds,
        hideTrash,
      })
      const seen = new Set()
      return [...bookingLogs, ...changeLogs].filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
    }
    return filterAndSortChatLogs(chatLogs ?? [], {
      category,
      sortBy,
      query,
      starredIds,
      hideTrash,
    })
  }, [chatLogs, category, sortBy, query, starredIds, hideTrash])

  const counts = useMemo(() => {
    const out = { all: 0, leads: 0, attention: 0, starred: 0 }
    if (viewMode === 'sessions') {
      out.all = sessions.length
      for (const session of sessions) {
        if (session.category === 'bookings' || session.category === 'changes') out.leads += 1
        if (session.needsReview) out.attention += 1
        if (session.hasStarred) out.starred += 1
      }
      return out
    }
    out.all = allBaseLogs.length
    for (const log of allBaseLogs) {
      const cat = categorizeChatLog(log)
      if (cat === 'bookings' || cat === 'changes') out.leads += 1
      if (cat === 'attention') out.attention += 1
      if (starredIds.has(log.id)) out.starred += 1
    }
    return out
  }, [viewMode, sessions, allBaseLogs, starredIds])

  const pagedSessions = useMemo(
    () => paginateItems(filteredSessions, page, 10),
    [filteredSessions, page],
  )

  const pagedLogs = useMemo(
    () => paginateItems(filteredLogs, page, 10),
    [filteredLogs, page],
  )

  const filterChips = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'bookings', label: 'Bookings & Leads', count: counts.leads },
    { id: 'attention', label: 'Needs Review', count: counts.attention },
    { id: 'starred', label: 'Starred', count: counts.starred },
  ]

  const hasActiveFilter = category !== 'all' || Boolean(query.trim())

  return (
    <div className="space-y-5">
      {/* Compact 3-Card Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatKpiCard
          label={viewMode === 'sessions' ? 'Total Conversations' : 'Total Messages'}
          value={counts.all}
          sublabel={
            viewMode === 'sessions'
              ? `${allBaseLogs.length} client turns grouped`
              : 'Individual client turns'
          }
          icon={MessageSquare}
          tone="charcoal"
          active={category === 'all'}
          onClick={() => setCategory('all')}
        />
        <StatKpiCard
          label="Bookings & Leads"
          value={counts.leads}
          sublabel="Booking, reschedule & cancel chats"
          icon={CalendarCheck}
          tone="emerald"
          active={category === 'bookings'}
          onClick={() => setCategory('bookings')}
        />
        <StatKpiCard
          label="Needs Review"
          value={counts.attention}
          sublabel="Unresolved or urgent chats"
          icon={AlertTriangle}
          tone="amber"
          active={category === 'attention'}
          onClick={() => setCategory('attention')}
        />
      </div>

      {/* Calm Filter & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => {
              const isSelected = category === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setCategory(chip.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-xl text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'bg-pink-500 text-white border-pink-500 shadow-xs'
                      : 'bg-white text-gray-600 border-pink-100 hover:bg-pink-50/70'
                  }`}
                >
                  <span>{chip.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            {trashCount > 0 && (
              <button
                type="button"
                onClick={() => setHideTrash((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                title={hideTrash ? 'Show filtered spam/test turns' : 'Hide spam/test turns'}
              >
                <Trash2 size={12} />
                <span>{hideTrash ? `${trashCount} noise hidden` : 'Hide noise'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'sessions' ? 'turns' : 'sessions'))}
              className="text-xs font-semibold text-pink-600 hover:text-pink-700 underline-offset-2 hover:underline transition-colors"
            >
              {viewMode === 'sessions' ? 'Show individual turns' : 'Back to conversations'}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client message, booking ref, or service..."
              className="w-full min-h-[42px] border border-pink-100 rounded-xl pl-10 pr-9 py-2 text-xs text-gray-800 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear chat log search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-pink-50"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="min-h-[42px] border border-pink-100 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
          >
            <option value="important">Sort: Most Important</option>
            <option value="newest">Sort: Newest First</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-xs overflow-hidden">
        {viewMode === 'sessions' ? (
          pagedSessions.items.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <p className="text-sm text-gray-400">
                {(chatLogs ?? []).length === 0
                  ? 'No client chat logs recorded yet.'
                  : 'No conversations match your current filter.'}
              </p>
              {hasActiveFilter && (chatLogs ?? []).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCategory('all')
                    setQuery('')
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-pink-200 text-xs font-semibold text-pink-600 hover:bg-pink-50 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-pink-50">
              {pagedSessions.items.map((session) => {
                const isOpen = expandedId === session.sessionId
                const badge = getSessionPrimaryBadge(session)
                const msgLabel = session.turnCount === 1 ? '1 msg' : `${session.turnCount} msgs`

                return (
                  <div
                    key={session.sessionId}
                    className={`transition-colors ${
                      session.hasStarred
                        ? 'bg-amber-50/25'
                        : session.needsReview && !session.resolvedCleanly
                          ? 'bg-amber-50/15'
                          : 'hover:bg-rose-50/20'
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(isOpen ? null : session.sessionId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setExpandedId(isOpen ? null : session.sessionId)
                        }
                      }}
                      className="px-5 py-4 cursor-pointer space-y-2"
                    >
                      {/* Row 1: Max 2 concise badges + time + expand */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => toggleSessionStar(session, e)}
                            aria-label={session.hasStarred ? 'Unstar conversation' : 'Star conversation'}
                            className={`p-1 rounded-lg transition-colors shrink-0 ${
                              session.hasStarred
                                ? 'text-amber-500 bg-amber-50'
                                : 'text-gray-300 hover:text-amber-500'
                            }`}
                          >
                            <Star size={14} fill={session.hasStarred ? 'currentColor' : 'none'} />
                          </button>

                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.tone}`}
                          >
                            {badge.label}
                          </span>

                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
                            {msgLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                          <span>{formatLogTime(session.latest?.created_at)}</span>
                          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </div>
                      </div>

                      {/* Row 2: Clean 1-line client topic + 1-line latest reply */}
                      <div className="pl-7 space-y-0.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {session.title || 'Client inquiry'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Latest JAL reply: {collapseToSingleLine(session.latest?.bot_reply)}
                        </p>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-3 border-t border-pink-100/70 bg-rose-50/15 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                          <div className="flex flex-wrap items-center gap-3">
                            {session.service && (
                              <span>
                                Service: <strong className="text-gray-700">{session.service}</strong>
                              </span>
                            )}
                            {session.referenceCode && (
                              <span>
                                Ref: <strong className="text-pink-600">{session.referenceCode}</strong>
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-gray-400">Session: {session.sessionId}</span>
                        </div>

                        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                          {session.turns.map((turn, idx) => (
                            <div
                              key={turn.id || `${session.sessionId}-${idx}`}
                              className="rounded-xl border border-pink-100 bg-white p-3.5 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
                                <span className="font-semibold text-gray-500">
                                  Turn {idx + 1} · {turn.intent_classified || 'UNKNOWN'}
                                </span>
                                <span>{formatLogTime(turn.created_at)}</span>
                              </div>
                              <div>
                                <span className="text-[11px] font-semibold text-pink-600 uppercase tracking-wide">
                                  Client
                                </span>
                                <p className="text-gray-800 whitespace-pre-wrap mt-0.5">
                                  {turn.user_message}
                                </p>
                              </div>
                              <div className="pt-1 border-t border-pink-50">
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                  JAL Reply
                                </span>
                                <p className="text-gray-600 whitespace-pre-wrap mt-0.5">
                                  {turn.bot_reply || '-'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        ) : pagedLogs.items.length === 0 ? (
          <div className="px-6 py-12 text-center space-y-3">
            <p className="text-sm text-gray-400">
              {(chatLogs ?? []).length === 0
                ? 'No client chat logs recorded yet.'
                : 'No messages match your current filter.'}
            </p>
            {hasActiveFilter && (chatLogs ?? []).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCategory('all')
                  setQuery('')
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-pink-200 text-xs font-semibold text-pink-600 hover:bg-pink-50 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-pink-50">
            {pagedLogs.items.map((log) => {
              const isOpen = expandedId === log.id
              const isStarred = starredIds.has(log.id)
              const cat = log._cat || categorizeChatLog(log)
              const catBadge =
                cat === 'attention'
                  ? { label: 'Needs Review', tone: 'bg-amber-50 text-amber-700 border-amber-200' }
                  : cat === 'bookings'
                    ? { label: 'Booking Lead', tone: 'bg-pink-50 text-pink-700 border-pink-200' }
                    : cat === 'changes'
                      ? { label: 'Change Request', tone: 'bg-rose-50 text-rose-700 border-rose-200' }
                      : { label: 'Inquiry', tone: 'bg-purple-50 text-purple-700 border-purple-200' }

              return (
                <div
                  key={log.id}
                  onClick={() => setExpandedId(isOpen ? null : log.id)}
                  className="px-5 py-4 cursor-pointer hover:bg-rose-50/20 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => toggleStar(log.id, e)}
                        aria-label={isStarred ? 'Unstar message' : 'Star message'}
                        className={`p-1 rounded-lg transition-colors shrink-0 ${
                          isStarred ? 'text-amber-500 bg-amber-50' : 'text-gray-300 hover:text-amber-500'
                        }`}
                      >
                        <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
                      </button>

                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catBadge.tone}`}
                      >
                        {catBadge.label}
                      </span>

                      {typeof log.confidence === 'number' && (
                        <span className="text-[11px] text-gray-400">
                          {Math.round(log.confidence * 100)}% match
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                      <span>{formatLogTime(log.created_at)}</span>
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>

                  <div className="pl-7 space-y-0.5">
                    <p
                      className={`text-sm font-semibold text-gray-900 ${
                        isOpen ? 'whitespace-pre-wrap' : 'truncate'
                      }`}
                    >
                      {log.user_message}
                    </p>
                    <p
                      className={`text-xs text-gray-500 ${
                        isOpen ? 'whitespace-pre-wrap' : 'truncate'
                      }`}
                    >
                      JAL: {isOpen ? log.bot_reply || '-' : collapseToSingleLine(log.bot_reply)}
                    </p>
                  </div>

                  {isOpen && (
                    <div className="pl-7 pt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
                      {log.language && (
                        <span>
                          Language:{' '}
                          <strong className="text-gray-700">
                            {log.language === 'fil' ? 'Filipino / Taglish' : 'English'}
                          </strong>
                        </span>
                      )}
                      {log.entities?.service && (
                        <span>
                          Service: <strong className="text-gray-700">{log.entities.service}</strong>
                        </span>
                      )}
                      {log.entities?.date && (
                        <span>
                          Date: <strong className="text-gray-700">{log.entities.date}</strong>
                        </span>
                      )}
                      {log.entities?.time && (
                        <span>
                          Time: <strong className="text-gray-700">{log.entities.time}</strong>
                        </span>
                      )}
                      {log.session_id && (
                        <span className="font-mono text-gray-400">Session: {log.session_id}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <PaginationBar
          page={viewMode === 'sessions' ? pagedSessions.page : pagedLogs.page}
          totalPages={viewMode === 'sessions' ? pagedSessions.totalPages : pagedLogs.totalPages}
          totalItems={viewMode === 'sessions' ? pagedSessions.totalItems : pagedLogs.totalItems}
          startIndex={viewMode === 'sessions' ? pagedSessions.startIndex : pagedLogs.startIndex}
          endIndex={viewMode === 'sessions' ? pagedSessions.endIndex : pagedLogs.endIndex}
          onPageChange={setPage}
          itemLabel={viewMode === 'sessions' ? 'conversations' : 'messages'}
        />
      </div>
    </div>
  )
}
