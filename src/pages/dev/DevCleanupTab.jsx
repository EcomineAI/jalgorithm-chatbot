import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  HardDrive,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  PRUNE_INTERVAL_OPTIONS,
  clearLocalTrashDrafts,
  groupRawDevLogsBySession,
  inspectLocalBrowserCache,
  loadStarredLogIds,
} from '../../lib/devTools.js'
import {
  deleteSessionLogs,
  emptyAllTrashSessions,
  pruneExpiredLogs,
  updateDevAutoPruneDays,
} from '../../services/devLogs.js'

function formatTime(ts) {
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

export default function DevCleanupTab({
  devLogs,
  ownerLogs,
  stats,
  loading,
  error,
  migrationMissing,
  autoPruneSummary,
  onReload,
  onPruneDaysChanged,
}) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [expandedKey, setExpandedKey] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [localCache, setLocalCache] = useState(() => inspectLocalBrowserCache())

  const starredIds = useMemo(() => loadStarredLogIds(), [])
  const pruneDays = stats?.autoPruneDays ?? 3

  const sessions = useMemo(
    () => groupRawDevLogsBySession(devLogs, ownerLogs, { pruneDays, starredIds }),
    [devLogs, ownerLogs, pruneDays, starredIds],
  )

  const counts = useMemo(() => {
    let trash = 0
    let leads = 0
    let expired = 0
    for (const s of sessions) {
      if (s.isTrashSession) trash += 1
      if (s.hasImportantLead) leads += 1
      if (s.isExpired) expired += 1
    }
    return { all: sessions.length, trash, leads, expired }
  }, [sessions])

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessions.filter((s) => {
      if (filter === 'trash' && !s.isTrashSession) return false
      if (filter === 'leads' && !s.hasImportantLead) return false
      if (filter === 'expired' && !s.isExpired) return false
      if (!q) return true
      const hay = [
        s.sessionId,
        s.firstMessage,
        s.latestMessage,
        s.latestReply,
        ...s.intents,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [sessions, filter, query])

  async function handleIntervalChange(nextDays) {
    setBusyAction('interval')
    setFeedback(null)
    const res = await updateDevAutoPruneDays(nextDays)
    if (onPruneDaysChanged) onPruneDaysChanged(res.autoPruneDays)
    setFeedback({
      tone: res.ok ? 'success' : 'warning',
      message: res.localOnly
        ? `Saved ${res.autoPruneDays === 0 ? 'Off' : `${res.autoPruneDays}-day`} rule locally (run migration 20261116 to sync in Supabase).`
        : `Auto-clean rule updated to ${res.autoPruneDays === 0 ? 'Off (Manual Only)' : `${res.autoPruneDays} day(s)`}.`,
    })
    setBusyAction('')
  }

  async function handleRunPruneNow() {
    setBusyAction('prune')
    setFeedback(null)
    const res = await pruneExpiredLogs(pruneDays, { ownerLogs, devLogs })
    if (!res.ok) {
      setFeedback({ tone: 'error', message: res.error || 'Unable to prune expired sessions.' })
    } else if (res.skipped) {
      setFeedback({ tone: 'warning', message: 'Auto-clean interval is currently Off. Choose 1, 3, 7, 14, or 30 days first.' })
    } else {
      setFeedback({
        tone: 'success',
        message: `Cleaned ${res.deletedDev} raw dev turn(s) and ${res.deletedOwnerTrash} owner trash turn(s) older than ${res.autoPruneDays} day(s).`,
      })
      await onReload()
    }
    setBusyAction('')
  }

  async function handleDeleteSingleSession(session) {
    if (busyAction) return
    setBusyAction(`del:${session.sessionKey}`)
    setFeedback(null)
    const res = await deleteSessionLogs({
      sessionId: session.sessionId,
      devIds: session.devIds,
      ownerTrashIds: session.ownerTrashIds,
    })
    if (!res.ok) {
      setFeedback({ tone: 'error', message: res.error || 'Failed to delete session.' })
    } else {
      setFeedback({
        tone: 'success',
        message: `Deleted session (${res.deletedDev} dev row(s), ${res.deletedOwnerTrash} owner trash row(s)).`,
      })
      await onReload()
    }
    setBusyAction('')
  }

  async function handleEmptyAllTrash() {
    setConfirmEmptyTrash(false)
    setBusyAction('empty_trash')
    setFeedback(null)
    const res = await emptyAllTrashSessions(sessions)
    if (!res.ok) {
      setFeedback({ tone: 'error', message: res.error || 'Failed to empty trash sessions.' })
    } else {
      setFeedback({
        tone: 'success',
        message: `Emptied ${res.deletedSessions} trash session(s) (${res.deletedDev} dev row(s), ${res.deletedOwnerTrash} owner trash row(s)). Real client leads stay untouched.`,
      })
      await onReload()
    }
    setBusyAction('')
  }

  function handleClearLocalDrafts() {
    const res = clearLocalTrashDrafts()
    setLocalCache(inspectLocalBrowserCache())
    setFeedback({
      tone: 'success',
      message: `Cleared ${res.removedCount} empty/unbooked local draft(s) from this browser (${res.keptCount} active/booked saved).`,
    })
  }

  const maxRows = stats?.maxRows || 1000
  const devPct = Math.min(100, Math.round(((stats?.devLogsCount ?? 0) / maxRows) * 100))
  const chatPct = Math.min(100, Math.round(((stats?.chatLogsCount ?? 0) / maxRows) * 100))

  return (
    <div className="space-y-5">
      {migrationMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
          <div className="space-y-1">
            <div className="font-bold">Supabase cleanup migration needed for database deletes</div>
            <p className="text-amber-800">
              Run <span className="font-mono font-semibold">20261115_dev_logs_and_cap.sql</span> + <span className="font-mono font-semibold">20261116_dev_cleanup_and_retention.sql</span> (or <span className="font-mono font-semibold">setup_all.sql</span>) in your Supabase SQL Editor so Dev Studio can read raw dev logs, delete trash sessions, and enforce the 3-day auto-clean rule.
            </p>
          </div>
        </div>
      )}

      {autoPruneSummary && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <span>{autoPruneSummary}</span>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
            feedback.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : feedback.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-semibold underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Row: DB Meters + Auto-Cleanup Control + Local Browser Cache */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gray-900 text-pink-300 flex items-center justify-center">
                <Database size={15} />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900">Supabase Log Capacity</div>
                <div className="text-[11px] text-gray-500">Auto-capped at {maxRows} rows per table</div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-gray-700 mb-1">
                <span>Raw Dev Logs (dev_chat_logs)</span>
                <span>{stats?.devLogsCount ?? devLogs.length} / {maxRows}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${devPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold text-gray-700 mb-1">
                <span>Owner Leads & Logs (chat_logs)</span>
                <span>{stats?.chatLogsCount ?? ownerLogs.length} / {maxRows}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${chatPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
              <Clock size={15} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">Auto-Trash Past Interval</div>
              <div className="text-[11px] text-gray-500">Runs automatically when /dev opens</div>
            </div>
          </div>

          <div className="space-y-2">
            <select
              value={pruneDays}
              disabled={Boolean(busyAction)}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="w-full min-h-[38px] border border-pink-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white focus:outline-none focus:border-pink-400"
            >
              {PRUNE_INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.days} value={opt.days}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] text-gray-500">
                Real client leads &amp; bookings stay protected.
              </span>
              <button
                type="button"
                disabled={Boolean(busyAction) || pruneDays === 0}
                onClick={handleRunPruneNow}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-[11px] font-semibold disabled:opacity-50 shrink-0 transition-colors"
              >
                <Sparkles size={12} />
                {busyAction === 'prune' ? 'Cleaning...' : 'Clean Expired Now'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <HardDrive size={15} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">This Browser Cache (PC Local)</div>
              <div className="text-[11px] text-gray-500">Saved public chat drafts on this device</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center bg-rose-50/40 rounded-xl p-2.5 border border-pink-100">
            <div>
              <div className="text-sm font-bold text-gray-900">{localCache.draftSessions}</div>
              <div className="text-[10px] text-gray-500">Empty Drafts</div>
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-700">{localCache.savedSessions}</div>
              <div className="text-[10px] text-gray-500">Booked / Saved</div>
            </div>
            <div>
              <div className="text-sm font-bold text-amber-600">{localCache.starredCount}</div>
              <div className="text-[10px] text-gray-500">Starred Logs</div>
            </div>
          </div>

          <button
            type="button"
            disabled={localCache.draftSessions === 0}
            onClick={handleClearLocalDrafts}
            className="w-full inline-flex items-center justify-center gap-1.5 min-h-[34px] rounded-xl border border-pink-200 text-xs font-semibold text-pink-600 hover:bg-pink-50 disabled:opacity-45 transition-colors"
          >
            <Trash2 size={13} />
            Clear {localCache.draftSessions} Local Test Draft(s)
          </button>
        </div>
      </div>

      {/* Session List Card */}
      <section className="bg-white rounded-2xl border border-pink-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-pink-100 bg-rose-50/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: `All Sessions (${counts.all})` },
              { id: 'trash', label: `Trash / Noise (${counts.trash})` },
              { id: 'leads', label: `Real Leads (${counts.leads})` },
              { id: 'expired', label: `Past ${pruneDays || 3}d (${counts.expired})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                  filter === tab.id
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'bg-white text-gray-600 border-pink-100 hover:bg-pink-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search size={13} className="text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search session ID, intent, text..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-pink-100 rounded-xl focus:outline-none focus:border-pink-400"
              />
            </div>

            {confirmEmptyTrash ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={handleEmptyAllTrash}
                  className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors"
                >
                  Confirm Delete ({counts.trash})
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEmptyTrash(false)}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={counts.trash === 0 || Boolean(busyAction)}
                onClick={() => setConfirmEmptyTrash(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-45"
              >
                <Trash2 size={13} />
                Empty All Trash ({counts.trash})
              </button>
            )}

            <button
              type="button"
              onClick={onReload}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-pink-50 text-gray-700 hover:text-pink-600 border border-pink-100 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            Error loading logs: {error}
          </div>
        )}

        <div className="divide-y divide-pink-50 max-h-[60vh] overflow-y-auto">
          {!loading && filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">
              No sessions match your current filter.
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isOpen = expandedKey === session.sessionKey
              const isDeleting = busyAction === `del:${session.sessionKey}`
              const turnsToRender = session.devTurns.length > 0 ? session.devTurns : session.ownerTurns

              return (
                <div key={session.sessionKey} className="hover:bg-rose-50/20 transition-colors">
                  <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isOpen ? null : session.sessionKey)}
                      className="flex-1 text-left min-w-0 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            session.isTrashSession
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {session.isTrashSession ? 'Trash / Noise' : 'Important Lead'}
                        </span>

                        {session.isExpired && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Past {pruneDays}d
                          </span>
                        )}

                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                          {session.turnCount} {session.turnCount === 1 ? 'turn' : 'turns'}
                        </span>

                        {session.intents.slice(0, 2).map((intent) => (
                          <span
                            key={intent}
                            className="font-mono text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600"
                          >
                            {intent}
                          </span>
                        ))}
                      </div>

                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {session.firstMessage}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono truncate">
                        Session: {session.sessionId || 'single-turn'} · Last active {formatTime(session.lastActivityAt)}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {session.devIds.length > 0 || session.ownerTrashIds.length > 0 ? (
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() => handleDeleteSingleSession(session)}
                          title={
                            session.isTrashSession
                              ? 'Delete this entire trash session'
                              : 'Delete raw dev turns for this session (starred/owner leads stay safe)'
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-45 transition-colors"
                        >
                          <Trash2 size={13} />
                          {isDeleting ? 'Deleting...' : session.isTrashSession ? 'Delete Session' : 'Clean Dev Copy'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                          Protected Lead
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedKey(isOpen ? null : session.sessionKey)}
                        aria-label="Toggle session details"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-pink-50"
                      >
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-4 pt-2 border-t border-pink-100/60 bg-rose-50/15 space-y-2">
                      {turnsToRender.map((turn, idx) => (
                        <div
                          key={turn.id || idx}
                          className="rounded-xl bg-white border border-pink-100 p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px] text-gray-400">
                            <span className="font-mono font-semibold text-gray-600">
                              Turn {idx + 1} · {turn.intent_classified || 'UNKNOWN'}
                              {typeof turn.confidence === 'number' ? ` (${Math.round(turn.confidence * 100)}%)` : ''}
                            </span>
                            <span>{formatTime(turn.created_at)}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-pink-600">Client: </span>
                            <span className="text-gray-800">{turn.user_message}</span>
                          </div>
                          {turn.bot_reply && (
                            <div className="text-gray-600 whitespace-pre-wrap">
                              <span className="font-semibold text-gray-500">JAL: </span>
                              {turn.bot_reply}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
