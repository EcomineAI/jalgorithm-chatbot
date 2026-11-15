import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ShieldAlert,
  Terminal,
  MessageSquare,
  Globe,
  Monitor,
  Trash2,
  FlaskConical,
  Layers,
  Activity,
} from 'lucide-react'
import { isLocalDevHost } from '../lib/mediaUpload.js'
import { useBusinessInfo } from '../lib/useBusinessInfo.js'
import { groupRawDevLogsBySession, loadStarredLogIds } from '../lib/devTools.js'
import { fetchDevLogOverview, pruneExpiredLogs } from '../services/devLogs.js'
import OwnerChatSandbox from './owner/OwnerChatSandbox.jsx'
import DevCleanupTab from './dev/DevCleanupTab.jsx'
import DevBatchTesterTab from './dev/DevBatchTesterTab.jsx'
import DevSystemMapTab from './dev/DevSystemMapTab.jsx'
import DevNluAnimationTab from './dev/DevNluAnimationTab.jsx'

const DESKTOP_MIN_WIDTH = 1024

export default function DevDebugPage() {
  const { catalog } = useBusinessInfo()
  const allowed = isLocalDevHost()
  const bizName = catalog?.business?.name || "Vicky's Parlor"

  const checkDesktopViewport = () => {
    if (typeof window === 'undefined') return true
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches
    }
    return window.innerWidth >= DESKTOP_MIN_WIDTH
  }

  const [isDesktop, setIsDesktop] = useState(checkDesktopViewport)
  const [activeTab, setActiveTab] = useState('runner')

  const [devLogs, setDevLogs] = useState([])
  const [ownerLogs, setOwnerLogs] = useState([])
  const [logStats, setLogStats] = useState({
    chatLogsCount: 0,
    devLogsCount: 0,
    maxRows: 1000,
    autoPruneDays: 3,
  })
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [autoPruneSummary, setAutoPruneSummary] = useState('')
  const autoPrunedOnceRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setIsDesktop(checkDesktopViewport())
    handleResize()
    window.addEventListener('resize', handleResize)
    let mql = null
    if (typeof window.matchMedia === 'function') {
      mql = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`)
      mql.addEventListener?.('change', handleResize)
    }
    return () => {
      window.removeEventListener('resize', handleResize)
      mql?.removeEventListener?.('change', handleResize)
    }
  }, [])

  const loadDevOverview = useCallback(async ({ runAutoPrune = false } = {}) => {
    setLogsLoading(true)
    setLogsError('')
    const overview = await fetchDevLogOverview()

    if (
      runAutoPrune &&
      !overview.migrationMissing &&
      overview.stats.autoPruneDays > 0 &&
      !autoPrunedOnceRef.current
    ) {
      autoPrunedOnceRef.current = true
      const pruneRes = await pruneExpiredLogs(overview.stats.autoPruneDays, {
        ownerLogs: overview.ownerLogs,
        devLogs: overview.devLogs,
      })
      if (pruneRes.ok && !pruneRes.skipped && (pruneRes.deletedDev > 0 || pruneRes.deletedOwnerTrash > 0)) {
        setAutoPruneSummary(
          `Auto-clean removed ${pruneRes.deletedDev} expired dev turn(s) and ${pruneRes.deletedOwnerTrash} owner trash turn(s) older than ${pruneRes.autoPruneDays} day(s).`,
        )
        const refreshed = await fetchDevLogOverview()
        setDevLogs(refreshed.devLogs)
        setOwnerLogs(refreshed.ownerLogs)
        setLogStats(refreshed.stats)
        setMigrationMissing(refreshed.migrationMissing)
        setLogsError(refreshed.devError || refreshed.ownerError || '')
        setLogsLoading(false)
        return
      }
    }

    setDevLogs(overview.devLogs)
    setOwnerLogs(overview.ownerLogs)
    setLogStats(overview.stats)
    setMigrationMissing(overview.migrationMissing)
    setLogsError(overview.devError || overview.ownerError || '')
    setLogsLoading(false)
  }, [])

  useEffect(() => {
    if (allowed && isDesktop) {
      loadDevOverview({ runAutoPrune: true })
    }
  }, [allowed, isDesktop, loadDevOverview])

  const trashSessionCount = useMemo(() => {
    const starred = loadStarredLogIds()
    const grouped = groupRawDevLogsBySession(devLogs, ownerLogs, {
      pruneDays: logStats.autoPruneDays,
      starredIds: starred,
    })
    return grouped.filter((s) => s.isTrashSession).length
  }, [devLogs, ownerLogs, logStats.autoPruneDays])

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#f8f6f2] flex items-center justify-center p-6">
        <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs max-w-md w-full p-7 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert size={22} />
          </div>
          <h1 className="text-lg font-semibold text-stone-900">Local Development Only</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            The JAlgorithm Dev Studio is locked on deployed hosts and only opens from localhost or Vite development mode for an authenticated owner account.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Link
              to="/owner"
              className="inline-flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium px-4 min-h-10 rounded-lg transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Owner Studio
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium px-4 min-h-10 rounded-lg transition-colors"
            >
              Public Site
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-[#f8f6f2] flex items-center justify-center p-6">
        <div className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 max-w-md w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-stone-900 text-pink-300 flex items-center justify-center mx-auto">
            <Monitor size={22} />
          </div>
          <h1 className="font-display text-xl font-medium text-stone-900">Desktop Browser Required</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            The JAlgorithm Dev Studio has been streamlined for wide desktop screens (1024px or wider) to display full NLU traces, session cleanup tables, and the visual system map clearly. Please open <span className="font-mono text-stone-700">/dev</span> on a desktop or laptop browser.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              to="/owner"
              className="w-full inline-flex items-center justify-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium px-4 min-h-11 rounded-lg transition-colors"
            >
              <ArrowLeft size={14} />
              Open Owner Studio
            </Link>
            <Link
              to="/"
              className="w-full inline-flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium px-4 min-h-11 rounded-lg transition-colors"
            >
              Public Site
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'runner', label: 'Dev Runner', icon: Terminal },
    {
      id: 'cleanup',
      label: 'Trash & Cleanup',
      icon: Trash2,
      badge: trashSessionCount > 0 ? trashSessionCount : null,
    },
    { id: 'batch', label: 'Batch NLU Tester', icon: FlaskConical },
    { id: 'map', label: 'System Map (Paper IPO)', icon: Layers },
    { id: 'nlu_flow', label: 'Animated NLU Flow', icon: Activity },
  ]

  return (
    <div className="min-h-screen bg-[#f8f6f2] flex flex-col">
      <header className="sticky top-0 z-20 bg-[#fdfcfa]/95 backdrop-blur-md border-b border-stone-200/80 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-stone-900 text-pink-300 flex items-center justify-center shrink-0">
            <Terminal size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-stone-900 text-base truncate">
                JAlgorithm Dev Studio
              </h1>
              <span className="text-xs font-mono bg-stone-900 text-pink-300 px-2 py-0.5 rounded-md">
                Localhost desktop
              </span>
            </div>
            <p className="text-xs text-stone-500 truncate">
              {bizName} | NLU Trace Runner, Session Trash Cleanup, Batch Tester &amp; Visual System Map
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/owner"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 hover:text-pink-700 bg-[#fdfcfa] border border-stone-200/80 hover:bg-stone-100 px-3 min-h-8 rounded-lg transition-colors"
          >
            <ArrowLeft size={13} />
            Owner Studio
          </Link>
          <Link
            to="/chat"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 hover:text-pink-700 bg-[#fdfcfa] border border-stone-200/80 hover:bg-stone-100 px-3 min-h-8 rounded-lg transition-colors"
          >
            <MessageSquare size={13} />
            Public Chat
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 hover:text-pink-700 bg-[#fdfcfa] border border-stone-200/80 hover:bg-stone-100 px-3 min-h-8 rounded-lg transition-colors"
          >
            <Globe size={13} />
            Website
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-5 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center bg-[#fdfcfa] border border-stone-200/80 rounded-xl p-1 shadow-xs gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 text-xs font-medium px-3.5 min-h-9 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-pink-600 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  <span>{tab.label}</span>
                  {tab.badge !== null && tab.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-xs font-medium tabular-nums ${
                        isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="text-xs text-stone-500 tabular-nums">
            Auto-clean:{' '}
            <strong className="font-medium text-stone-800">
              {logStats.autoPruneDays === 0 ? 'Off' : `Past ${logStats.autoPruneDays}d`}
            </strong>{' '}
            · Cap: <strong className="font-medium text-stone-800">1,000 rows/table</strong>
          </div>
        </div>

        {activeTab === 'runner' && <OwnerChatSandbox mode="dev" />}

        {activeTab === 'cleanup' && (
          <DevCleanupTab
            devLogs={devLogs}
            ownerLogs={ownerLogs}
            stats={logStats}
            loading={logsLoading}
            error={logsError}
            migrationMissing={migrationMissing}
            autoPruneSummary={autoPruneSummary}
            onReload={() => loadDevOverview({ runAutoPrune: false })}
            onPruneDaysChanged={(nextDays) =>
              setLogStats((prev) => ({ ...prev, autoPruneDays: nextDays }))
            }
          />
        )}

        {activeTab === 'batch' && <DevBatchTesterTab />}

        {activeTab === 'map' && <DevSystemMapTab />}

        {activeTab === 'nlu_flow' && <DevNluAnimationTab />}
      </main>
    </div>
  )
}
