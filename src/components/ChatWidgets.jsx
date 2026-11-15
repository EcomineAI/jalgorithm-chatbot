import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Sparkles,
  Check,
  Copy,
  Calendar,
  Clock,
  Tag,
  MapPin,
  CalendarPlus,
  CalendarCog,
  ExternalLink,
  MessageCircle,
  Bookmark,
  Phone,
  User,
  Reply,
  Pause,
  Play,
  Trash2,
  Filter,
  Building2,
} from 'lucide-react'
import { formatServicePrice, formatDuration } from '../lib/ownerInsights.js'
import { computeOwnerPrepSummary } from '../lib/calendarLinks.js'
import { copyText } from '../lib/nluDebug.js'
import { manilaToday, addDays, parseIso, dayOfWeek, formatTime } from '../jalgorithm/entities/calendar.js'
import { extractReferenceCodes } from '../lib/chatSessions.js'

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const STARTER_CARDS = [
  {
    title: 'Book an appointment',
    desc: 'Choose a service, date, and available time slot',
    prompt: 'I want to book an appointment',
    icon: CalendarPlus,
  },
  {
    title: 'Services and rates',
    desc: 'View hair and makeup packages and pricing',
    prompt: 'What services and prices do you offer?',
    icon: Tag,
  },
  {
    title: 'Check availability',
    desc: 'See open dates and time slots before booking',
    prompt: 'Check available slots',
    icon: Clock,
  },
  {
    title: 'Manage existing booking',
    desc: 'View, reschedule, or cancel with your code',
    prompt: 'Reschedule my appointment',
    icon: CalendarCog,
  },
]

const INFO_FOLLOWUP_INTENTS = new Set([
  'ASK_SERVICES',
  'ASK_PRICE',
  'ASK_LOCATION',
  'ASK_OPERATING_HOURS',
  'ASK_BOOKING_POLICY',
  'GENERAL_INQUIRY',
])

const INTENT_OPTION_LABELS = {
  BOOK_APPOINTMENT: 'Book a new appointment',
  CHECK_AVAILABILITY: 'Check available slots',
  RESCHEDULE_APPOINTMENT: 'Reschedule existing appointment',
  CANCEL_APPOINTMENT: 'Cancel existing appointment',
  VIEW_APPOINTMENT: 'View my appointment',
  ASK_PRICE: 'Ask about prices',
  ASK_SERVICES: 'See offered services',
  ASK_OPERATING_HOURS: 'Check working hours',
}

export const BOOKING_STEPS = [
  { key: 'service', label: 'Service' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'details', label: 'Details' },
  { key: 'confirm', label: 'Confirm' },
]

export function formatMsgTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function formatDateChipLabel(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || ''
  const { m, d } = parseIso(iso)
  const day = SHORT_DAYS[dayOfWeek(iso)]
  return `${day}, ${SHORT_MONTHS[m - 1]} ${d}`
}

export function formatDateForNlu(iso) {
  const { y, m, d } = parseIso(iso)
  return `${SHORT_MONTHS[m - 1]} ${d}, ${y}`
}

export function getBookingStepIndex(flow) {
  if (!flow || flow.intent !== 'BOOK_APPOINTMENT') return -1
  if (flow.confirming) return 4
  const s = flow.slots || {}
  if (!s.service) return 0
  if (!s.date) return 1
  if (!s.time) return 2
  return 3
}

function summarizeDraftSlots(flow, services = []) {
  if (!flow) return []
  const s = flow.slots || {}
  const parts = []
  if (s.service) {
    const svc = services.find((item) => item.key === s.service)
    parts.push(svc?.name || s.service)
  }
  if (s.date) parts.push(formatDateChipLabel(s.date))
  if (s.time) parts.push(formatTime(s.time))
  if (s.name) parts.push(s.name)
  if (s.location) parts.push(s.location)
  if (s.reference) parts.push(`Ref ${s.reference}`)
  return parts
}

export function FlowControls({
  state,
  catalog,
  disabled = false,
  onSelect,
  savedReferences = [],
  showStarters = false,
  onResumeDraft,
  onDiscardDraft,
}) {
  const [pickedDate, setPickedDate] = useState('')
  const [customVenue, setCustomVenue] = useState('')

  const flow = state?.flow
  const pausedFlow = state?.pausedFlow
  const pending = state?.pending
  const services = catalog?.services ?? []
  const minDays = catalog?.business?.rules?.minAdvanceDays ?? 3

  const earliestDate = useMemo(() => addDays(manilaToday(), minDays), [minDays])
  const quickDates = useMemo(
    () => [0, 1, 2, 3].map((offset) => addDays(earliestDate, offset)),
    [earliestDate]
  )

  useEffect(() => {
    setPickedDate('')
    setCustomVenue('')
  }, [flow?.awaiting, flow?.intent])

  // 1. Empty starter screen: 2-column action cards.
  if (showStarters && !flow && !pending && !pausedFlow) {
    return (
      <div className="pt-2 animate-controls-in">
        <div className="text-xs font-medium text-gray-400 mb-2.5">Quick actions</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {STARTER_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <button
                key={card.title}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(card.prompt)}
                className="text-left bg-white hover:bg-pink-50/60 border border-gray-200 hover:border-pink-300 rounded-xl p-3.5 transition-all group shadow-2xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-50 group-hover:bg-pink-100 text-pink-500 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800 group-hover:text-pink-600 transition-colors">
                      {card.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-snug">{card.desc}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // 1b. Paused setup draft recovery card when outside an active flow.
  if (!flow && !pending && pausedFlow) {
    const summaryParts = summarizeDraftSlots(pausedFlow, services)
    return (
      <div className="animate-controls-in pl-10">
        <div className="bg-gradient-to-br from-amber-50/80 via-white to-pink-50/60 border border-amber-200/90 rounded-2xl p-3.5 max-w-md space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              <Pause size={12} />
              Saved Setup Draft
            </span>
            <span className="text-[10px] font-medium text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
              Paused
            </span>
          </div>
          {summaryParts.length > 0 && (
            <div className="text-xs text-gray-700 leading-relaxed">
              {summaryParts.join(' | ')}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => (onResumeDraft ? onResumeDraft() : onSelect('resume'))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-3.5 py-1.5 rounded-xl transition-colors"
            >
              <Play size={12} />
              Resume Setup
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => (onDiscardDraft ? onDiscardDraft() : onSelect('discard draft'))}
              className="inline-flex items-center gap-1 text-xs font-medium bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Trash2 size={12} />
              Discard Draft
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 2. Pending confirmation / clarification choices.
  if (pending?.type === 'offer_book') {
    return (
      <div className="animate-controls-in flex flex-wrap gap-2 pl-10">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('yes')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl transition-colors shadow-xs"
        >
          <Check size={14} />
          Yes, book this slot
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('no')}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-xl transition-colors"
        >
          No, thanks
        </button>
      </div>
    )
  }

  if (pending?.type === 'cancel_or_abort') {
    return (
      <div className="animate-controls-in flex flex-wrap gap-2 pl-10">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('1')}
          className="text-xs font-medium bg-white hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 text-gray-700 border border-gray-200 px-3.5 py-2 rounded-xl transition-colors"
        >
          1. Pause current booking setup
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('2')}
          className="text-xs font-medium bg-white hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 text-gray-700 border border-gray-200 px-3.5 py-2 rounded-xl transition-colors"
        >
          2. Cancel existing appointment
        </button>
      </div>
    )
  }

  if (pending?.type === 'clarify' && Array.isArray(pending.options)) {
    return (
      <div className="animate-controls-in flex flex-wrap gap-2 pl-10">
        {pending.options.map((intentOpt, idx) => (
          <button
            key={intentOpt}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(String(idx + 1))}
            className="text-xs font-medium bg-white hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 text-gray-700 border border-gray-200 px-3.5 py-2 rounded-xl transition-colors"
          >
            {idx + 1}. {INTENT_OPTION_LABELS[intentOpt] || intentOpt}
          </button>
        ))}
      </div>
    )
  }

  // 3. Flow confirmation step with visual summary card.
  if (flow?.confirming) {
    const slots = flow.slots ?? {}
    const svc = services.find((s) => s.key === slots.service)
    const isBooking = flow.intent === 'BOOK_APPOINTMENT'
    const isReschedule = flow.intent === 'RESCHEDULE_APPOINTMENT'
    const dateLabel = slots.date && /^\d{4}-\d{2}-\d{2}$/.test(slots.date) ? formatDateChipLabel(slots.date) : slots.date
    const timeLabel = slots.time ? formatTime(slots.time) : null

    return (
      <div className="animate-controls-in pl-10 space-y-2.5">
        <div className="bg-gradient-to-br from-rose-50/80 via-white to-pink-50/70 border border-pink-200/80 rounded-2xl p-4 shadow-xs max-w-md space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-pink-600">
                {isBooking ? 'Booking Summary' : isReschedule ? 'Reschedule Summary' : 'Confirm Request'}
              </div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">
                {svc?.name || (slots.reference ? `Reference: ${slots.reference}` : 'Please review your details')}
              </div>
              {svc?.durationMinutes && (
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Estimated session: {formatDuration(svc.durationMinutes)}
                </div>
              )}
            </div>
            {svc && (
              <span className="text-xs font-semibold bg-white border border-pink-200 text-pink-600 px-2.5 py-1 rounded-full shrink-0">
                {formatServicePrice(svc)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-pink-100/80">
            {(dateLabel || timeLabel) && (
              <div className="flex items-center gap-1.5 text-gray-700">
                <Calendar size={13} className="text-pink-500 shrink-0" />
                <span>{[dateLabel, timeLabel].filter(Boolean).join(' at ')}</span>
              </div>
            )}
            {slots.name && (
              <div className="flex items-center gap-1.5 text-gray-700">
                <User size={13} className="text-pink-500 shrink-0" />
                <span className="truncate">{slots.name}</span>
              </div>
            )}
            {slots.contact && (
              <div className="flex items-center gap-1.5 text-gray-700">
                <Phone size={13} className="text-pink-500 shrink-0" />
                <span className="font-mono">{slots.contact}</span>
              </div>
            )}
            {isBooking && (
              <div className="flex items-center gap-1.5 text-gray-700">
                <MapPin size={13} className="text-pink-500 shrink-0" />
                <span className="truncate">{slots.location || 'Not specified'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect('Yes, confirm')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl transition-colors shadow-xs"
          >
            <Check size={14} />
            Confirm
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect('No, change something')}
            className="text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3.5 py-2 rounded-xl transition-colors"
          >
            Change a detail
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect('pause')}
            className="inline-flex items-center gap-1 text-xs font-medium bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 text-gray-600 border border-gray-200 px-3.5 py-2 rounded-xl transition-colors"
          >
            <Pause size={12} />
            Pause &amp; Save
          </button>
        </div>
      </div>
    )
  }

  // 3b. Saved recent booking reference pills when JAL asks for a code.
  if (flow?.awaiting === 'reference' && savedReferences.length > 0) {
    return (
      <div className="animate-controls-in pl-10 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Your recent booking codes on this device
        </div>
        <div className="flex flex-wrap gap-2">
          {savedReferences.map((item) => {
            const dateChip =
              item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? formatDateChipLabel(item.date) : item.date
            const details = [item.serviceName, dateChip].filter(Boolean).join(', ')
            return (
              <button
                key={item.reference}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(item.reference)}
                className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-pink-50 hover:border-pink-300 border border-pink-100 rounded-xl px-3 py-2 transition-colors shadow-xs"
              >
                <Bookmark size={12} className="text-pink-500 shrink-0" />
                <span className="font-mono font-semibold text-pink-600">{item.reference}</span>
                {details && <span className="text-gray-500">({details})</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // 4. Service picker cards.
  if (flow?.awaiting === 'service' && services.length > 0) {
    return (
      <div className="animate-controls-in pl-10">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Select a service
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {services.map((svc) => (
            <button
              key={svc.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(svc.aliases?.[0] || svc.name)}
              className="flex items-start justify-between gap-2 text-left bg-white hover:bg-pink-50 border border-gray-200 hover:border-pink-300 rounded-xl px-3.5 py-2.5 transition-all group"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-800 group-hover:text-pink-600 truncate">
                  {svc.name}
                </div>
                {svc.durationMinutes && (
                  <div className="text-[11px] text-gray-400">{formatDuration(svc.durationMinutes)}</div>
                )}
                {svc.inclusions && (
                  <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                    Includes: {svc.inclusions}
                  </div>
                )}
                {svc.priceNote && (
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{svc.priceNote}</div>
                )}
              </div>
              <span className="text-xs font-semibold text-pink-600 flex-shrink-0 text-right">
                {formatServicePrice(svc)}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // 5. Date selection: quick upcoming dates + inline date picker.
  if (flow?.awaiting === 'date') {
    return (
      <div className="animate-controls-in pl-10 space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Choose a date (earliest: {formatDateChipLabel(earliestDate)})
        </div>
        <div className="flex flex-wrap gap-2">
          {quickDates.map((iso) => (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(formatDateForNlu(iso))}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 text-gray-700 border border-gray-200 px-3 py-2 rounded-xl transition-colors"
            >
              <Calendar size={12} className="text-pink-500" />
              {formatDateChipLabel(iso)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            min={earliestDate}
            value={pickedDate}
            onChange={(e) => setPickedDate(e.target.value)}
            className="text-xs bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 focus:outline-none focus:border-pink-300"
          />
          <button
            type="button"
            disabled={disabled || !pickedDate}
            onClick={() => pickedDate && onSelect(formatDateForNlu(pickedDate))}
            className="text-xs font-semibold bg-pink-500 hover:bg-pink-600 disabled:bg-pink-200 text-white px-3.5 py-1.5 rounded-xl transition-colors"
          >
            Select Date
          </button>
        </div>
      </div>
    )
  }

  // 6. Time slot grid.
  if (flow?.awaiting === 'time') {
    const slots = flow.checked?.slots ?? []
    if (slots.length > 0) {
      return (
        <div className="animate-controls-in pl-10">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Available time slots
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {slots.map((hhmm) => (
              <button
                key={hhmm}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(formatTime(hhmm))}
                className="text-xs font-medium bg-white hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 text-gray-700 border border-gray-200 py-2 px-2 rounded-xl transition-colors text-center"
              >
                {formatTime(hhmm)}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="animate-controls-in flex flex-wrap gap-2 pl-10">
        {['Morning', 'Afternoon', 'Evening'].map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(p)}
            className="text-xs font-medium bg-white hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    )
  }

  // 7. Interactive Location Selector: Studio vs Custom Venue input vs Free/Out-of-town area chips.
  if (flow?.awaiting === 'location') {
    const studioAddress = catalog?.business?.location || 'Olongapo City'
    const homeArea = studioAddress.split(',')[0]?.trim() || 'Olongapo City'
    const freeSet = new Set(
      [homeArea, ...(catalog?.business?.freeTravelAreas ?? [])]
        .map((a) => String(a || '').trim().toLowerCase())
        .filter(Boolean)
    )
    const uniqueAreas = []
    const seen = new Set()
    for (const raw of [
      homeArea,
      ...(catalog?.business?.freeTravelAreas ?? []),
      ...(catalog?.business?.travelAreas ?? []),
    ]) {
      const label = String(raw || '').trim()
      const key = label.toLowerCase()
      if (!label || seen.has(key)) continue
      seen.add(key)
      uniqueAreas.push({ label, isFree: freeSet.has(key) })
    }

    return (
      <div className="animate-controls-in pl-10">
        <div className="bg-white border border-pink-100 rounded-2xl p-3.5 max-w-lg space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Select Service Location
            </span>
            <span className="text-[11px] text-gray-500 truncate max-w-[220px]">
              Studio: {studioAddress}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect('At Artist Studio')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-3.5 py-2 rounded-xl transition-colors shadow-xs"
            >
              <Building2 size={13} />
              At Artist Studio
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(`Home / Event Venue (${homeArea})`)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 px-3 py-2 rounded-xl transition-colors"
            >
              <MapPin size={13} className="text-pink-500" />
              My Event Venue ({homeArea})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customVenue}
              disabled={disabled}
              onChange={(e) => setCustomVenue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customVenue.trim()) {
                  e.preventDefault()
                  onSelect(customVenue.trim())
                }
              }}
              placeholder="Or type venue / hotel / barangay..."
              className="flex-1 min-w-0 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-pink-300 rounded-xl px-3 py-2 text-gray-700 focus:outline-none"
            />
            <button
              type="button"
              disabled={disabled || !customVenue.trim()}
              onClick={() => customVenue.trim() && onSelect(customVenue.trim())}
              className="text-xs font-semibold bg-gray-900 hover:bg-pink-600 disabled:bg-gray-200 text-white px-3.5 py-2 rounded-xl transition-colors shrink-0"
            >
              Use Venue
            </button>
          </div>

          {uniqueAreas.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-gray-100">
              <div className="text-[11px] font-medium text-gray-400">Quick service areas</div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueAreas.slice(0, 8).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(item.label)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-pink-50 hover:border-pink-300 text-gray-700 border border-gray-200 px-2.5 py-1.5 rounded-xl transition-colors"
                  >
                    <MapPin size={11} className="text-pink-500 shrink-0" />
                    <span>{item.label}</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        item.isFree ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {item.isFree ? 'Free travel' : 'Out-of-town fee'}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect('skip')}
                  className="text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 8. Change field selection.
  if (flow?.awaiting === 'change') {
    const fields = flow.intent === 'RESCHEDULE_APPOINTMENT'
      ? ['Date', 'Time']
      : ['Service', 'Date', 'Time', 'Name', 'Number', 'Location']
    return (
      <div className="animate-controls-in flex flex-wrap gap-2 pl-10">
        {fields.map((field) => (
          <button
            key={field}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(field)}
            className="text-xs font-medium bg-white hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors"
          >
            {field}
          </button>
        ))}
      </div>
    )
  }

  // 9. Post-info follow-up chips outside an active flow.
  if (!flow && INFO_FOLLOWUP_INTENTS.has(state?.lastIntent)) {
    return (
      <div className="animate-controls-in flex flex-wrap gap-2 pl-10">
        {['Book an appointment', 'What is included in bridal makeup?', 'Check available slots', 'How much additional heads?'].map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(q)}
            className="text-xs font-medium bg-white hover:bg-pink-50 hover:text-pink-600 hover:border-pink-300 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    )
  }

  return null
}

export function ChatBubble({
  message,
  catalog,
  isRevealing = false,
  onRevealDone,
  onReply,
  onJumpToMessage,
  showDevMeta = false,
}) {
  const isUser = message.role === 'user'
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [copiedCode, setCopiedCode] = useState(null)
  const [copiedHandoff, setCopiedHandoff] = useState(false)
  const [handoffDraft, setHandoffDraft] = useState(() => message.handoff?.draft ?? '')
  const [visibleChars, setVisibleChars] = useState(() => (
    isRevealing ? 0 : (message.content?.length ?? 0)
  ))

  useEffect(() => {
    setHandoffDraft(message.handoff?.draft ?? '')
  }, [message.handoff?.draft])

  const onRevealDoneRef = useRef(onRevealDone)
  onRevealDoneRef.current = onRevealDone

  useEffect(() => {
    const full = message.content || ''
    if (!isRevealing) {
      setVisibleChars(full.length)
      return
    }
    const tokens = full.match(/\S+\s*/g) || [full]
    const totalTokens = tokens.length
    const stepTokens = Math.max(1, Math.ceil(totalTokens / 28))
    let idx = 0

    const timer = setInterval(() => {
      idx = Math.min(totalTokens, idx + stepTokens)
      const shownLen = tokens.slice(0, idx).join('').length
      setVisibleChars(shownLen)
      if (idx >= totalTokens) {
        clearInterval(timer)
        onRevealDoneRef.current?.()
      }
    }, 24)

    return () => clearInterval(timer)
  }, [isRevealing, message.content])

  const shownContent = isRevealing ? (message.content || '').slice(0, visibleChars) : message.content
  const referenceCodes = useMemo(
    () => (isUser || isRevealing ? [] : extractReferenceCodes(message.content)),
    [isUser, isRevealing, message.content]
  )
  const appointmentLinks = useMemo(() => {
    if (isUser || isRevealing || !message.appointment) return null
    return computeOwnerPrepSummary(message.appointment, {
      freeTravelAreas: catalog?.business?.freeTravelAreas ?? [],
      businessName: catalog?.business?.name ?? '',
    })
  }, [isUser, isRevealing, message.appointment, catalog])
  const timeLabel = formatMsgTime(message.createdAt)

  const appt = !isUser && !isRevealing ? message.appointment : null
  const primaryCode = appt?.reference_code || referenceCodes[0] || null
  const matchedService = useMemo(() => {
    if (!appt?.service_key && !appt?.service_name) return null
    return (catalog?.services ?? []).find(
      (s) => s.key === appt.service_key || s.name === appt.service_name
    ) || null
  }, [appt, catalog])

  async function handleCopyMessage() {
    const ok = await copyText(message.content)
    if (!ok) return
    setCopiedMsg(true)
    setTimeout(() => setCopiedMsg(false), 1800)
  }

  async function handleCopyCode(code) {
    const ok = await copyText(code)
    if (!ok) return
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 1800)
  }

  async function handleCopyHandoff() {
    const ok = await copyText(handoffDraft)
    if (!ok) return
    setCopiedHandoff(true)
    setTimeout(() => setCopiedHandoff(false), 1800)
  }

  const pageUrl =
    message.handoff?.messengerUrl ||
    catalog?.business?.messengerUrl ||
    message.handoff?.portfolioUrl ||
    catalog?.business?.portfolio ||
    null
  const ownerContact = message.handoff?.contact || catalog?.business?.contact || null

  const replyQuoteEl = message.replyTo?.text ? (
    <button
      type="button"
      onClick={() => message.replyTo?.id && onJumpToMessage?.(message.replyTo.id)}
      className={`w-full text-left border-l-2 rounded-lg px-2.5 py-1.5 mb-2 text-[11px] transition-colors ${
        isUser
          ? 'border-white/80 bg-pink-600/50 text-pink-50 hover:bg-pink-600/70'
          : 'border-pink-400 bg-pink-50/70 text-gray-600 hover:bg-pink-100/60'
      }`}
    >
      <div className="font-semibold inline-flex items-center gap-1">
        <Reply size={10} />
        Replying to {message.replyTo.role === 'user' ? 'Client' : 'JAL'}
      </div>
      <div className="truncate opacity-90 mt-0.5">{message.replyTo.text}</div>
    </button>
  ) : null

  return (
    <div
      id={message.id ? `msg-${message.id}` : undefined}
      className={`flex gap-3 items-end animate-msg-in ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {!isUser && (
        <div className="w-7 h-7 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Sparkles size={12} className="text-pink-500" />
        </div>
      )}
      <div className={`max-w-[85%] md:max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {appt ? (
          <div className="bg-white border-2 border-pink-200 rounded-2xl rounded-bl-sm shadow-md overflow-hidden w-full">
            {/* Highlighted Ref Code & Status Banner */}
            <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50 border-b border-pink-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {primaryCode && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider bg-pink-500 text-white px-2.5 py-1 rounded-lg shadow-2xs">
                    <Bookmark size={11} />
                    REF: {primaryCode}
                  </span>
                )}
                <span className="text-[11px] font-medium text-pink-700">
                  Save this code
                </span>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  appt.status === 'rescheduled'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {appt.status === 'rescheduled' ? 'Rescheduled' : 'Confirmed'}
              </span>
            </div>

            <div className="p-4 space-y-3.5 text-sm leading-relaxed text-gray-800">
              {replyQuoteEl}
              <div className="whitespace-pre-wrap">{shownContent}</div>

              {/* Embedded Booking Summary Box */}
              <div className="bg-gradient-to-br from-rose-50/70 via-white to-pink-50/60 border border-pink-200/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-pink-600">
                      Booking Summary
                    </div>
                    <div className="text-sm font-bold text-gray-900 mt-0.5">
                      {appt.service_name || matchedService?.name || 'Scheduled Service'}
                    </div>
                    {appt.duration_minutes && (
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Estimated session: {formatDuration(appt.duration_minutes)}
                      </div>
                    )}
                  </div>
                  {matchedService && (
                    <span className="text-xs font-semibold bg-white border border-pink-200 text-pink-600 px-2.5 py-1 rounded-full shrink-0">
                      {formatServicePrice(matchedService)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-pink-100">
                  {(appt.date || appt.time) && (
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Calendar size={13} className="text-pink-500 shrink-0" />
                      <span>
                        {[appt.date ? formatDateChipLabel(appt.date) : null, appt.time ? formatTime(appt.time) : null]
                          .filter(Boolean)
                          .join(' at ')}
                      </span>
                    </div>
                  )}
                  {appt.client_name && (
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <User size={13} className="text-pink-500 shrink-0" />
                      <span className="truncate">{appt.client_name}</span>
                    </div>
                  )}
                  {appt.client_contact && (
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Phone size={13} className="text-pink-500 shrink-0" />
                      <span className="font-mono">{appt.client_contact}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <MapPin size={13} className="text-pink-500 shrink-0" />
                    <span className="truncate">{appt.location || 'Studio / To be confirmed'}</span>
                  </div>
                </div>
              </div>

              {(referenceCodes.length > 0 || primaryCode || appointmentLinks) && (
                <div className="flex flex-wrap gap-1.5">
                  {(referenceCodes.length > 0 ? referenceCodes : [primaryCode]).filter(Boolean).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleCopyCode(code)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      {copiedCode === code ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                      {copiedCode === code ? `Copied ${code}` : `Copy Code: ${code}`}
                    </button>
                  ))}
                  {appointmentLinks?.calendarUrl && (
                    <a
                      href={appointmentLinks.calendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-pink-50 text-pink-600 border border-pink-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <CalendarPlus size={12} />
                      Add to Google Calendar
                      <ExternalLink size={10} />
                    </a>
                  )}
                  {appointmentLinks?.mapsUrl && (
                    <a
                      href={appointmentLinks.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <MapPin size={12} className="text-pink-500" />
                      View Venue in Google Maps
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}

              {message.handoff && (
                <div className="bg-pink-50/70 border border-pink-100 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-800 inline-flex items-center gap-1.5">
                      <MessageCircle size={13} className="text-pink-500" />
                      {message.handoff.topic || `Message ${message.handoff.artist || 'Owner'} on Page`}
                    </span>
                    {ownerContact && (
                      <span className="text-[11px] text-gray-500 truncate max-w-[180px]">{ownerContact}</span>
                    )}
                  </div>
                  <textarea
                    value={handoffDraft}
                    onChange={(e) => setHandoffDraft(e.target.value)}
                    rows={3}
                    aria-label="Ready-to-send message"
                    className="w-full bg-white border border-pink-200/80 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 leading-relaxed focus:outline-none focus:border-pink-400"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyHandoff}
                      className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copiedHandoff ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                      {copiedHandoff ? 'Copied Message' : 'Copy Message'}
                    </button>
                    {pageUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          await copyText(handoffDraft)
                          setCopiedHandoff(true)
                          setTimeout(() => setCopiedHandoff(false), 1800)
                          window.open(pageUrl, '_blank', 'noopener,noreferrer')
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Copy &amp; Message Page
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {showDevMeta && message.meta && (
                <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                    {message.meta.intent}
                  </span>
                  <span className="text-[10px] font-semibold bg-pink-50 text-pink-600 px-2 py-0.5 rounded-md">
                    {Math.round((message.meta.confidence ?? 0) * 100)}%
                  </span>
                  <span className="text-[10px] text-gray-400">{message.meta.elapsedMs ?? 0}ms</span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${
                      message.meta.isTrash ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <Filter size={9} />
                    {message.meta.isTrash ? 'Dev Only' : 'Owner Logged'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
              isUser
                ? 'bg-pink-500 text-white rounded-br-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
            }`}
          >
            {replyQuoteEl}

            {!isUser && !isRevealing && referenceCodes.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {referenceCodes.map((code) => (
                  <span
                    key={`badge-${code}`}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold tracking-wider bg-pink-500 text-white px-2.5 py-0.5 rounded-md"
                  >
                    <Bookmark size={10} />
                    REF: {code}
                  </span>
                ))}
              </div>
            )}

            {shownContent}

            {referenceCodes.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {referenceCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleCopyCode(code)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    {copiedCode === code ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    {copiedCode === code ? `Copied ${code}` : `Copy Code: ${code}`}
                  </button>
                ))}
              </div>
            )}

            {!isUser && !isRevealing && message.handoff && (
              <div className="mt-3 bg-pink-50/70 border border-pink-100 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-800 inline-flex items-center gap-1.5">
                    <MessageCircle size={13} className="text-pink-500" />
                    {message.handoff.topic || `Message ${message.handoff.artist || 'Owner'} on Page`}
                  </span>
                  {ownerContact && (
                    <span className="text-[11px] text-gray-500 truncate max-w-[180px]">{ownerContact}</span>
                  )}
                </div>
                <textarea
                  value={handoffDraft}
                  onChange={(e) => setHandoffDraft(e.target.value)}
                  rows={3}
                  aria-label="Ready-to-send message"
                  className="w-full bg-white border border-pink-200/80 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 leading-relaxed focus:outline-none focus:border-pink-400"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyHandoff}
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {copiedHandoff ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    {copiedHandoff ? 'Copied Message' : 'Copy Message'}
                  </button>
                  {pageUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        await copyText(handoffDraft)
                        setCopiedHandoff(true)
                        setTimeout(() => setCopiedHandoff(false), 1800)
                        window.open(pageUrl, '_blank', 'noopener,noreferrer')
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Copy &amp; Message Page
                      <ExternalLink size={11} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {showDevMeta && !isUser && message.meta && (
              <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                  {message.meta.intent}
                </span>
                <span className="text-[10px] font-semibold bg-pink-50 text-pink-600 px-2 py-0.5 rounded-md">
                  {Math.round((message.meta.confidence ?? 0) * 100)}%
                </span>
                <span className="text-[10px] text-gray-400">{message.meta.elapsedMs ?? 0}ms</span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${
                    message.meta.isTrash ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <Filter size={9} />
                  {message.meta.isTrash ? 'Dev Only' : 'Owner Logged'}
                </span>
              </div>
            )}
          </div>
        )}

        {(timeLabel || (!isRevealing && (!isUser || onReply))) && (
          <div className="mt-1 px-1 flex items-center gap-2.5 text-[11px] text-gray-400">
            {timeLabel && <span>{timeLabel}</span>}
            {!isUser && !isRevealing && (
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1 hover:text-gray-600 transition-colors"
                title="Copy reply"
              >
                {copiedMsg ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                {copiedMsg ? 'Copied' : 'Copy'}
              </button>
            )}
            {!isRevealing && onReply && (
              <button
                type="button"
                onClick={() => onReply(message)}
                className="inline-flex items-center gap-1 hover:text-pink-600 transition-colors"
                title="Reply to this message"
              >
                <Reply size={11} />
                Reply
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
