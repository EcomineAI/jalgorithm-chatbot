import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { computeBookingCompletion, FUNNEL_STEPS } from '../../lib/bookingFunnel.js'

// Owner Studio card for thesis objective 3.2 (successful completion of bookings).
// Default start date: the day the JAlgorithm engine went live, so older sample data is left out.
const DEFAULT_SINCE = '2026-11-12'

const STEP_LABELS = {
  service: 'Service',
  date: 'Date',
  time: 'Time',
  name: 'Name',
  contact: 'Mobile',
  location: 'Venue',
  confirm: 'Confirm',
  booked: 'Booked',
}

const REASON_LABELS = {
  slot_taken: 'Time slot already taken',
  outside_hours: 'Outside working hours',
  min_date: 'Too soon (advance notice rule)',
  past_date: 'Date already passed',
  unreachable: 'Booking system unreachable',
}

export default function BookingCompletionCard() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [since, setSince] = useState(DEFAULT_SINCE)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('chat_logs')
      .select('session_id, intent_classified, bot_reply, entities, created_at')
      .order('created_at', { ascending: true })
      .limit(5000)
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else setRows(data || [])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => (rows ? computeBookingCompletion(rows, { since }) : null), [rows, since])
  const top = stats?.funnel[0]?.count || 0

  return (
    <section className="bg-[#fdfcfa] rounded-2xl border border-stone-200/80 shadow-xs p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm sm:text-base text-stone-900 flex items-center gap-2">
            <CheckCircle2 size={18} strokeWidth={1.75} className="text-stone-500 shrink-0" />
            Booking completion
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            How many chats that started a booking ended with a confirmed appointment.
          </p>
        </div>
        <label className="text-xs text-stone-600 flex items-center gap-2">
          Count chats from
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="border border-stone-200 rounded-lg px-2 min-h-9 text-xs bg-white"
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">Could not load chat logs: {error}</p>}
      {!error && !stats && <p className="text-xs text-stone-500">Loading...</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Completion rate" value={stats.rate == null ? '-' : `${stats.rate}%`} strong />
            <Stat label="Started a booking" value={stats.started} />
            <Stat label="Completed" value={stats.completed} />
            <Stat
              label="Typical booking"
              value={stats.medianTurns == null ? '-' : `${stats.medianTurns} msgs · ${stats.medianMinutes} min`}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-700">Where clients stop</p>
            {stats.funnelSessions === 0 ? (
              <p className="text-xs text-stone-500">
                No step data yet. It fills in as new clients book through the chat.
              </p>
            ) : (
              FUNNEL_STEPS.map((step, i) => {
                const count = stats.funnel[i].count
                const pct = top ? Math.round((100 * count) / top) : 0
                return (
                  <div key={step} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-stone-500 shrink-0">{STEP_LABELS[step]}</span>
                    <div className="flex-1 bg-stone-100 rounded-md h-4 overflow-hidden">
                      <div className="bg-pink-500 h-full rounded-md" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right tabular-nums text-stone-700">{count}</span>
                  </div>
                )
              })
            )}
          </div>

          {Object.keys(stats.failures).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-stone-700">Why bookings failed</p>
              {Object.entries(stats.failures).map(([reason, n]) => (
                <p key={reason} className="text-xs text-stone-600">
                  {REASON_LABELS[reason] || reason}: <span className="tabular-nums">{n}</span>
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Stat({ label, value, strong = false }) {
  return (
    <div className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`tabular-nums ${strong ? 'text-xl font-semibold text-pink-700' : 'text-base font-semibold text-stone-900'}`}>
        {value}
      </p>
    </div>
  )
}
