import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ShieldAlert,
  Clock,
  WifiOff,
  Copy,
  Check,
  RefreshCw,
  Ticket,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { businessInfo } from '../lib/useBusinessInfo.js'
import setupAllSql from '../../supabase/setup_all.sql?raw'

async function copyText(value) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    /* fallback below */
  }
  try {
    const el = document.createElement('textarea')
    el.value = value
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

function buildGrantOwnerSql(userId) {
  return `insert into public.app_owners (user_id)\nvalues ('${userId}')\non conflict do nothing;`
}

function formatManilaTimestamp(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return date.toISOString()
  }
}

function buildSupportTicket({ statusCode, userEmail, userId, summary, checkedAt, isNotSetUp }) {
  const grantSql = buildGrantOwnerSql(userId)
  const devSteps = isNotSetUp
    ? [
        'Developer steps (Supabase Dashboard -> SQL Editor):',
        '1. Run app/supabase/setup_all.sql in SQL Editor.',
        '2. Run:',
        grantSql,
      ]
    : [
        'Developer step (Supabase Dashboard -> SQL Editor):',
        grantSql,
      ]

  return [
    'JALgorithm Owner Access Ticket',
    `Status: ${statusCode}`,
    `Account: ${userEmail}`,
    `Account ID: ${userId}`,
    `Checked: ${checkedAt}`,
    `Summary: ${summary}`,
    '',
    ...devSteps,
  ].join('\n')
}

// Lets a page through only for a signed-in account listed in the app_owners table.
// Shows an owner-friendly support ticket when database setup or approval is pending.
export default function ProtectedRoute({ children, loginPath = '/owner/login' }) {
  const [session, setSession] = useState(undefined)
  const [accessState, setAccessState] = useState({ status: 'checking', checkedAt: '' })
  const [recheckNonce, setRecheckNonce] = useState(0)
  const [copiedKey, setCopiedKey] = useState(null)
  const [showDevTools, setShowDevTools] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession((prev) => {
        const prevId = prev?.user?.id ?? null
        const nextId = nextSession?.user?.id ?? null
        if (prev !== undefined && prevId === nextId && prev?.user?.email === nextSession?.user?.email) {
          return prev
        }
        return nextSession ?? null
      })
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id ?? null
  const userEmail = session?.user?.email ?? 'Signed-in account'

  useEffect(() => {
    if (!userId) return
    let alive = true
    setAccessState({ status: 'checking', checkedAt: '' })
    businessInfo.checkOwnerAccess().then((res) => {
      if (alive) {
        setAccessState({ ...res, checkedAt: formatManilaTimestamp() })
      }
    })
    return () => {
      alive = false
    }
  }, [userId, recheckNonce])

  async function handleCopy(key, text) {
    const ok = await copyText(text)
    if (!ok) return
    setCopiedKey(key)
    setTimeout(() => {
      setCopiedKey((cur) => (cur === key ? null : cur))
    }, 2000)
  }

  if (session === undefined || (userId && accessState.status === 'checking')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!userId) return <Navigate to={loginPath} replace />

  if (accessState.status === 'owner') return children

  const isNotSetUp = accessState.status === 'not_set_up'
  const isUnreachable = accessState.status === 'unreachable'
  const statusCode = isNotSetUp
    ? 'JAL-SETUP-PENDING'
    : isUnreachable
      ? 'JAL-OFFLINE'
      : 'JAL-ACCESS-PENDING'

  const Icon = isNotSetUp ? Clock : isUnreachable ? WifiOff : ShieldAlert
  const iconTone = isNotSetUp ? 'text-pink-500' : isUnreachable ? 'text-gray-500' : 'text-amber-500'
  const iconBg = isNotSetUp ? 'bg-pink-50' : isUnreachable ? 'bg-gray-100' : 'bg-amber-50'
  const badgeTone = isNotSetUp
    ? 'bg-pink-50 text-pink-700 border-pink-200'
    : isUnreachable
      ? 'bg-gray-100 text-gray-700 border-gray-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'

  const heading = isNotSetUp
    ? 'Owner Panel setup needed'
    : isUnreachable
      ? 'Connection check needed'
      : 'Owner access pending approval'

  const description = isNotSetUp
    ? `Your account (${userEmail}) is signed in, but your developer still needs to finish the initial database setup. Please copy this ticket and send it to your developer.`
    : isUnreachable
      ? `We could not verify your account (${userEmail}) right now. Please check your internet connection and tap Check Again.`
      : `Your account (${userEmail}) is signed in, but it has not been approved as an owner yet. Please copy this ticket and send it to your developer.`

  const issueSummary = isNotSetUp
    ? 'Initial Owner Panel database setup is not completed yet.'
    : 'Account is signed in but needs owner approval to open the dashboard.'

  const grantSql = buildGrantOwnerSql(userId)
  const completeSetupSql = `${setupAllSql.trim()}\n\n${grantSql}\n`
  const supportTicket = buildSupportTicket({
    statusCode,
    userEmail,
    userId,
    summary: issueSummary,
    checkedAt: accessState.checkedAt || formatManilaTimestamp(),
    isNotSetUp,
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 max-w-lg w-full shadow-sm">
        <div className="text-center">
          <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center mx-auto mb-3`}>
            <Icon size={24} className={iconTone} />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">{heading}</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">{description}</p>
        </div>

        {!isUnreachable && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 space-y-3 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200/80">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700">
                <Ticket size={14} className="text-pink-500" />
                Support Ticket
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeTone}`}>
                {statusCode}
              </span>
            </div>

            <dl className="space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4">
                <dt className="text-gray-500 shrink-0">Account</dt>
                <dd className="font-medium text-gray-900 break-all sm:text-right">{userEmail}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4">
                <dt className="text-gray-500 shrink-0">Issue</dt>
                <dd className="text-gray-700 sm:text-right">{issueSummary}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4">
                <dt className="text-gray-500 shrink-0">Account ID</dt>
                <dd className="font-mono text-[11px] text-gray-700 break-all sm:text-right">{userId}</dd>
              </div>
              {accessState.checkedAt && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4">
                  <dt className="text-gray-500 shrink-0">Checked</dt>
                  <dd className="text-gray-600 sm:text-right">{accessState.checkedAt}</dd>
                </div>
              )}
            </dl>

            <button
              type="button"
              onClick={() => handleCopy('ticket', supportTicket)}
              className="w-full inline-flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              {copiedKey === 'ticket' ? <Check size={16} /> : <Copy size={16} />}
              {copiedKey === 'ticket' ? 'Ticket copied! Send it to your developer' : 'Copy Ticket for Developer'}
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setRecheckNonce((n) => n + 1)}
            className="inline-flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <RefreshCw size={15} />
            Check Again
          </button>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2"
          >
            Sign Out
          </button>
        </div>

        {!isUnreachable && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowDevTools((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span>For Developers (SQL Setup Tools)</span>
              {showDevTools ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showDevTools && (
              <div className="mt-3 bg-gray-900 text-gray-100 rounded-xl p-4 space-y-3 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs text-gray-300 leading-snug">
                    {isNotSetUp
                      ? 'Run in Supabase Dashboard -> SQL Editor'
                      : 'Add owner UID in Supabase Dashboard -> SQL Editor'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('sql', isNotSetUp ? completeSetupSql : grantSql)}
                    className="inline-flex items-center justify-center gap-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    {copiedKey === 'sql' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === 'sql'
                      ? 'Copied SQL'
                      : isNotSetUp
                        ? 'Copy Complete Setup SQL'
                        : 'Copy Grant SQL'}
                  </button>
                </div>

                <pre className="text-[11px] font-mono text-pink-200 whitespace-pre-wrap break-all leading-relaxed bg-gray-950/60 rounded-lg p-3">
                  {isNotSetUp
                    ? `-- Copies full app/supabase/setup_all.sql plus:\n${grantSql}`
                    : grantSql}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
