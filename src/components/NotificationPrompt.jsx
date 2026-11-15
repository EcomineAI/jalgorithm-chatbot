import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { pushSupported, pushConfigured, currentPermission } from '../lib/push.js'

// Pops up on its own to ask for notification permission. Browsers only show their real
// permission prompt after a tap, so the "Allow" button here is what triggers it.
// "Not now" hides the card for 7 days on this device.

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

function snoozedUntil(storageKey) {
  try {
    return Number(localStorage.getItem(storageKey)) || 0
  } catch {
    return 0
  }
}

export default function NotificationPrompt({ storageKey, title, body, onEnable, show = true }) {
  const [hidden, setHidden] = useState(() => snoozedUntil(storageKey) > Date.now())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [permission, setPermission] = useState(() => currentPermission())

  if (!show || hidden || !pushSupported() || !pushConfigured() || permission !== 'default') return null

  function snooze() {
    try {
      localStorage.setItem(storageKey, String(Date.now() + SNOOZE_MS))
    } catch {
      // Storage blocked: the card simply comes back next visit.
    }
    setHidden(true)
  }

  async function allow() {
    setBusy(true)
    setMessage(null)
    try {
      await onEnable()
      setHidden(true)
    } catch (err) {
      setMessage(err.message)
    }
    setBusy(false)
    setPermission(currentPermission())
  }

  return (
    <div className="fixed inset-x-0 bottom-0 sm:bottom-6 sm:right-6 sm:left-auto z-50 px-4 pb-4 sm:p-0 sm:w-96 animate-msg-in">
      <div className="bg-white border border-pink-200 rounded-2xl shadow-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
            <Bell size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-stone-900">{title}</p>
            <p className="text-xs text-stone-500 mt-0.5">{body}</p>
          </div>
          <button type="button" onClick={snooze} aria-label="Close" className="text-stone-400 hover:text-stone-600">
            <X size={16} />
          </button>
        </div>
        {message && <p className="text-xs text-red-600">{message}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={snooze}
            className="flex-1 text-xs font-medium border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-lg min-h-9"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={allow}
            disabled={busy}
            className="flex-1 text-xs font-medium bg-pink-600 hover:bg-pink-700 disabled:bg-stone-300 text-white rounded-lg min-h-9"
          >
            {busy ? 'Turning on...' : 'Allow'}
          </button>
        </div>
      </div>
    </div>
  )
}
