import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Upload,
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
import {
  downloadChatLogTemplate,
  exportChatLogsCsv,
  parseChatLogsCsv,
} from '../../lib/csvExport.js'
import { supabase } from '../../lib/supabase.js'

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
      tone: 'bg-amber-50 text-amber-800 border-amber-200',
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
      tone: 'bg-stone-100 text-stone-600 border-stone-200/80',
    }
  }
  return {
    label: 'Inquiry',
    tone: 'bg-pink-50 text-pink-700 border-pink-200',
  }
}

export default function ChatLogsTab({ chatLogs, onImported }) {
  const importInputRef = useRef(null)
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

  async function handleChatLogImport(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    const { rows, errors } = parseChatLogsCsv(text)
    if (errors.length > 0) {
      const preview = errors
        .slice(0, 5)
        .map((e) => `Line ${e.line}: ${e.message}`)
        .join('\n')
      const more = errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''
      window.alert(`Nothing was imported. Fix these rows and try again:\n\n${preview}${more}`)
      return
    }
    if (rows.length === 0) {
      window.alert('The file has no chat rows to import.')
      return
    }
    const count = rows.length
    if (!window.confirm(`Import ${count} chat message${count === 1 ? '' : 's'} into the live database?`)) {
      return
    }
    const { error } = await supabase.from('chat_logs').insert(rows)
    if (error) {
      window.alert(`Import failed: ${error.message}`)
      return
    }
    window.alert(`Imported ${count} chat message${count === 1 ? '' : 's'}.`)
    onImported?.()
  }

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
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => downloadChatLogTemplate()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <FileText size={16} strokeWidth={1.75} />
          Blank Template
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <Upload size={16} strokeWidth={1.75} />
          Import CSV
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleChatLogImport}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => exportChatLogsCsv(chatLogs ?? [])}
          disabled={!chatLogs || chatLogs.length === 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} strokeWidth={1.75} />
          Export CSV
        </button>
      </div>

      {/* Compact 3-Card Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="col-span-2 sm:col-span-1">
          <StatKpiCard
            label={viewMode === 'sessions' ? 'Total Conversations' : 'Total Messages'}
            value={counts.all}
            sublabel={
              viewMode === 'sessions'
                ? `${allBaseLogs.length} client turns grouped`
                : 'Individual client turns'
            }
            active={category === 'all'}
            onClick={() => setCategory('all')}
          />
        </div>
        <StatKpiCard
          label="Bookings & Leads"
          value={counts.leads}
          sublabel="Booking, reschedule & cancel chats"
          active={category === 'bookings'}
          onClick={() => setCategory('bookings')}
        />
        <StatKpiCard
          label="Needs Review"
          value={counts.attention}
          sublabel="Unresolved or urgent chats"
          active={category === 'attention'}
          onClick={() => setCategory('attention')}
        />
      </div>

      {/* Calm Filter & Search Toolbar */}
      <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs p-3.5 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex overflow-x-auto sm:flex-wrap gap-2 pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
            {filterChips.map((chip) => {
              const isSelected = category === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setCategory(chip.id)}
                  className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap px-3 sm:px-3.5 min-h-9 rounded-lg text-xs font-medium transition-colors border ${
                    isSelected
                      ? 'bg-pink-600 text-white border-pink-600'
                      : 'bg-[#fdfcfa] text-stone-600 border-stone-200/80 hover:bg-stone-100'
                  }`}
                >
                  <span>{chip.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-xs font-medium tabular-nums ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
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
                className="inline-flex items-center gap-1 text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors"
                title={hideTrash ? 'Show filtered spam/test turns' : 'Hide spam/test turns'}
              >
                <Trash2 size={12} />
                <span className="tabular-nums">{hideTrash ? `${trashCount} noise hidden` : 'Hide noise'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'sessions' ? 'turns' : 'sessions'))}
              className="text-xs font-medium text-pink-700 hover:text-pink-800 underline-offset-2 hover:underline transition-colors"
            >
              {viewMode === 'sessions' ? 'Show individual turns' : 'Back to conversations'}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search logs"
              className="w-full min-h-10 border border-stone-200/80 bg-[#f8f6f2] focus:bg-[#fdfcfa] rounded-lg pl-10 pr-9 py-2 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear chat log search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="min-h-10 border border-stone-200/80 rounded-lg px-3.5 py-2 text-xs font-medium text-stone-700 bg-[#fdfcfa] focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
          >
            <option value="important">Sort: Most Important</option>
            <option value="newest">Sort: Newest First</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        {viewMode === 'sessions' ? (
          pagedSessions.items.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <p className="text-sm text-stone-400">
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200/80 text-xs font-medium text-pink-700 hover:bg-stone-100 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-stone-200/60">
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
                          : 'hover:bg-stone-100/50'
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
                      className="px-3.5 sm:px-5 py-3 sm:py-4 cursor-pointer space-y-2"
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
                                : 'text-stone-300 hover:text-amber-500'
                            }`}
                          >
                            <Star size={14} fill={session.hasStarred ? 'currentColor' : 'none'} />
                          </button>

                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${badge.tone}`}
                          >
                            {badge.label}
                          </span>

                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-600 tabular-nums">
                            {msgLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-xs text-stone-400 tabular-nums">
                          <span>{formatLogTime(session.latest?.created_at)}</span>
                          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </div>
                      </div>

                      {/* Row 2: Clean 1-line client topic + 1-line latest reply */}
                      <div className="pl-7 space-y-0.5">
                        <p className="text-sm font-semibold text-stone-900 truncate">
                          {session.title || 'Client inquiry'}
                        </p>
                        <p className="text-xs text-stone-500 truncate">
                          Latest JAL reply: {collapseToSingleLine(session.latest?.bot_reply)}
                        </p>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-3 border-t border-stone-200/80 bg-[#f8f6f2] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                          <div className="flex flex-wrap items-center gap-3">
                            {session.service && (
                              <span>
                                Service: <strong className="font-medium text-stone-800">{session.service}</strong>
                              </span>
                            )}
                            {session.referenceCode && (
                              <span>
                                Ref: <strong className="font-medium text-pink-700 tabular-nums">{session.referenceCode}</strong>
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-stone-400">Session: {session.sessionId}</span>
                        </div>

                        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                          {session.turns.map((turn, idx) => (
                            <div
                              key={turn.id || `${session.sessionId}-${idx}`}
                              className="rounded-xl border border-stone-200/80 bg-[#fdfcfa] p-3.5 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2 text-xs text-stone-400 tabular-nums">
                                <span className="font-medium text-stone-600">
                                  Turn {idx + 1} · {turn.intent_classified || 'UNKNOWN'}
                                </span>
                                <span>{formatLogTime(turn.created_at)}</span>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-pink-700">
                                  Client
                                </span>
                                <p className="text-stone-800 whitespace-pre-wrap mt-0.5">
                                  {turn.user_message}
                                </p>
                              </div>
                              <div className="pt-1 border-t border-stone-200/60">
                                <span className="text-xs font-medium text-stone-500">
                                  JAL Reply
                                </span>
                                <p className="text-stone-600 whitespace-pre-wrap mt-0.5">
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
            <p className="text-sm text-stone-400">
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200/80 text-xs font-medium text-pink-700 hover:bg-stone-100 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-200/60">
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
                      : { label: 'Inquiry', tone: 'bg-stone-100 text-stone-700 border-stone-200' }

              return (
                <div
                  key={log.id}
                  onClick={() => setExpandedId(isOpen ? null : log.id)}
                  className="px-5 py-4 cursor-pointer hover:bg-stone-100/50 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => toggleStar(log.id, e)}
                        aria-label={isStarred ? 'Unstar message' : 'Star message'}
                        className={`p-1 rounded-lg transition-colors shrink-0 ${
                          isStarred ? 'text-amber-500 bg-amber-50' : 'text-stone-300 hover:text-amber-500'
                        }`}
                      >
                        <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
                      </button>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${catBadge.tone}`}
                      >
                        {catBadge.label}
                      </span>

                      {typeof log.confidence === 'number' && (
                        <span className="text-xs text-stone-400 tabular-nums">
                          {Math.round(log.confidence * 100)}% match
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-xs text-stone-400 tabular-nums">
                      <span>{formatLogTime(log.created_at)}</span>
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>

                  <div className="pl-7 space-y-0.5">
                    <p
                      className={`text-sm font-semibold text-stone-900 ${
                        isOpen ? 'whitespace-pre-wrap' : 'truncate'
                      }`}
                    >
                      {log.user_message}
                    </p>
                    <p
                      className={`text-xs text-stone-500 ${
                        isOpen ? 'whitespace-pre-wrap' : 'truncate'
                      }`}
                    >
                      JAL: {isOpen ? log.bot_reply || '-' : collapseToSingleLine(log.bot_reply)}
                    </p>
                  </div>

                  {isOpen && (
                    <div className="pl-7 pt-2 flex flex-wrap gap-3 text-xs text-stone-500">
                      {log.language && (
                        <span>
                          Language:{' '}
                          <strong className="font-medium text-stone-800">
                            {log.language === 'fil' ? 'Filipino / Taglish' : 'English'}
                          </strong>
                        </span>
                      )}
                      {log.entities?.service && (
                        <span>
                          Service: <strong className="font-medium text-stone-800">{log.entities.service}</strong>
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
