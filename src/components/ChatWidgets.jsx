import { useState, useRef, useEffect, useMemo } from 'react'
import {
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
import StudioMark from './StudioMark.jsx'
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
        <div className="text-xs font-medium text-stone-500 mb-2.5">Quick actions</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {STARTER_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <button
                key={card.title}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(card.prompt)}
                className="text-left bg-white hover:bg-[#fdfcfa] border border-stone-200/80 hover:border-pink-300 rounded-xl p-3.5 transition-[background-color,border-color] group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-pink-600 text-stone-700 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <Icon size={16} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-stone-900 group-hover:text-pink-700 transition-colors">
                      {card.title}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5 leading-snug">{card.desc}</div>
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
      <div className="animate-controls-in pl-0 sm:pl-10">
        <div className="bg-[#fdfcfa] border border-amber-200 rounded-xl p-4 max-w-md space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <Pause size={12} strokeWidth={1.75} />
              Saved setup draft
            </span>
            <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
              Paused
            </span>
          </div>
          {summaryParts.length > 0 && (
            <div className="text-xs text-stone-700 leading-relaxed">
              {summaryParts.join(' | ')}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => (onResumeDraft ? onResumeDraft() : onSelect('resume'))}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-3.5 min-h-9 rounded-lg transition-colors"
            >
              <Play size={12} strokeWidth={1.75} />
              Resume Setup
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => (onDiscardDraft ? onDiscardDraft() : onSelect('discard draft'))}
              className="inline-flex items-center gap-1 text-xs font-medium bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-stone-600 border border-stone-200 px-3 min-h-9 rounded-lg transition-colors"
            >
              <Trash2 size={12} strokeWidth={1.75} />
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
      <div className="animate-controls-in flex flex-wrap gap-2 pl-0 sm:pl-10">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('yes')}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-4 min-h-9 rounded-lg transition-colors"
        >
          <Check size={14} strokeWidth={1.75} />
          Yes, book this slot
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('no')}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 px-4 min-h-9 rounded-lg transition-colors"
        >
          No, thanks
        </button>
      </div>
    )
  }

  if (pending?.type === 'cancel_or_abort') {
    return (
      <div className="animate-controls-in flex flex-wrap gap-2 pl-0 sm:pl-10">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('1')}
          className="text-xs font-medium bg-white hover:bg-stone-50 hover:text-pink-700 hover:border-pink-300 text-stone-700 border border-stone-200 px-3.5 min-h-9 rounded-lg transition-colors"
        >
          1. Pause current booking setup
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect('2')}
          className="text-xs font-medium bg-white hover:bg-stone-50 hover:text-pink-700 hover:border-pink-300 text-stone-700 border border-stone-200 px-3.5 min-h-9 rounded-lg transition-colors"
        >
          2. Cancel existing appointment
        </button>
      </div>
    )
  }

  if (pending?.type === 'clarify' && Array.isArray(pending.options)) {
    return (
      <div className="animate-controls-in flex flex-wrap gap-2 pl-0 sm:pl-10">
        {pending.options.map((intentOpt, idx) => (
          <button
            key={intentOpt}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(String(idx + 1))}
            className="text-xs font-medium bg-white hover:bg-stone-50 hover:text-pink-700 hover:border-pink-300 text-stone-700 border border-stone-200 px-3.5 min-h-9 rounded-lg transition-colors"
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
      <div className="animate-controls-in pl-0 sm:pl-10 space-y-2.5">
        <div className="bg-[#fdfcfa] border border-stone-200 rounded-xl p-4 max-w-md space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-pink-700">
                {isBooking ? 'Booking summary' : isReschedule ? 'Reschedule summary' : 'Confirm request'}
              </div>
              <div className="text-sm font-medium text-stone-900 mt-0.5">
                {svc?.name || (slots.reference ? `Reference: ${slots.reference}` : 'Please review your details')}
              </div>
              {svc?.durationMinutes && (
                <div className="text-xs text-stone-500 mt-0.5 tabular-nums">
                  Estimated session: {formatDuration(svc.durationMinutes)}
                </div>
              )}
            </div>
            {svc && (
              <span className="text-xs font-medium bg-white border border-stone-200 text-pink-700 px-2.5 py-1 rounded-md shrink-0 tabular-nums">
                {formatServicePrice(svc)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-stone-200/80">
            {(dateLabel || timeLabel) && (
              <div className="flex items-center gap-1.5 text-stone-700 tabular-nums">
                <Calendar size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
                <span>{[dateLabel, timeLabel].filter(Boolean).join(' at ')}</span>
              </div>
            )}
            {slots.name && (
              <div className="flex items-center gap-1.5 text-stone-700">
                <User size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
                <span className="truncate">{slots.name}</span>
              </div>
            )}
            {slots.contact && (
              <div className="flex items-center gap-1.5 text-stone-700">
                <Phone size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
                <span className="font-mono tabular-nums">{slots.contact}</span>
              </div>
            )}
            {isBooking && (
              <div className="flex items-center gap-1.5 text-stone-700">
                <MapPin size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
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
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-4 min-h-9 rounded-lg transition-colors"
          >
            <Check size={14} strokeWidth={1.75} />
            Confirm
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect('No, change something')}
            className="text-xs font-medium bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 px-3.5 min-h-9 rounded-lg transition-colors"
          >
            Change a detail
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect('pause')}
            className="inline-flex items-center gap-1 text-xs font-medium bg-white hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 text-stone-600 border border-stone-200 px-3.5 min-h-9 rounded-lg transition-colors"
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
      <div className="animate-controls-in pl-0 sm:pl-10 space-y-2">
        <div className="text-xs font-medium text-gray-500">
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
                className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-[#fdfcfa] hover:border-pink-300 border border-stone-200 rounded-lg px-3 min-h-9 transition-colors"
              >
                <Bookmark size={13} strokeWidth={1.75} className="text-pink-600 shrink-0" />
                <span className="font-mono font-medium text-pink-700">{item.reference}</span>
                {details && <span className="text-stone-500">({details})</span>}
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
      <div className="animate-controls-in pl-0 sm:pl-10">
        <div className="text-xs font-medium text-stone-500 mb-2">
          Select a service
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {services.map((svc) => (
            <button
              key={svc.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(svc.aliases?.[0] || svc.name)}
              className="flex items-start justify-between gap-2 text-left bg-white hover:bg-[#fdfcfa] border border-stone-200/80 hover:border-pink-300 rounded-xl px-3.5 py-2.5 transition-[background-color,border-color] group"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium text-stone-900 group-hover:text-pink-700 truncate">
                  {svc.name}
                </div>
                {svc.durationMinutes && (
                  <div className="text-xs text-stone-500 tabular-nums">{formatDuration(svc.durationMinutes)}</div>
                )}
                {svc.inclusions && (
                  <div className="text-xs text-stone-500 mt-0.5 line-clamp-2 leading-snug">
                    Includes: {svc.inclusions}
                  </div>
                )}
                {svc.priceNote && (
                  <div className="text-xs text-stone-400 mt-0.5 leading-snug">{svc.priceNote}</div>
                )}
              </div>
              <span className="text-xs font-medium text-pink-700 tabular-nums flex-shrink-0 text-right">
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
      <div className="animate-controls-in pl-0 sm:pl-10 space-y-2.5">
        <div className="text-xs font-medium text-stone-500 tabular-nums">
          Choose a date (earliest: {formatDateChipLabel(earliestDate)})
        </div>
        <div className="flex flex-wrap gap-2">
          {quickDates.map((iso) => (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(formatDateForNlu(iso))}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-[#fdfcfa] hover:text-pink-700 hover:border-pink-300 text-stone-700 border border-stone-200 px-3 min-h-9 rounded-lg transition-colors"
            >
              <Calendar size={13} strokeWidth={1.75} className="text-stone-400" />
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
            className="text-xs bg-white border border-stone-200 rounded-lg px-3 min-h-9 text-stone-700 focus:outline-none focus:border-pink-400"
          />
          <button
            type="button"
            disabled={disabled || !pickedDate}
            onClick={() => pickedDate && onSelect(formatDateForNlu(pickedDate))}
            className="text-xs font-medium bg-pink-600 hover:bg-pink-700 disabled:bg-pink-200 text-white px-3.5 min-h-9 rounded-lg transition-colors"
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
        <div className="animate-controls-in pl-0 sm:pl-10">
          <div className="text-xs font-medium text-stone-500 mb-2">
            Available time slots
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {slots.map((hhmm) => (
              <button
                key={hhmm}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(formatTime(hhmm))}
                className="text-xs font-medium tabular-nums bg-white hover:bg-[#fdfcfa] hover:text-pink-700 hover:border-pink-300 text-stone-700 border border-stone-200 min-h-9 px-2 rounded-lg transition-colors text-center"
              >
                {formatTime(hhmm)}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="animate-controls-in flex flex-wrap gap-2 pl-0 sm:pl-10">
        {['Morning', 'Afternoon', 'Evening'].map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(p)}
            className="text-xs font-medium bg-white hover:bg-[#fdfcfa] hover:text-pink-700 hover:border-pink-300 text-stone-700 border border-stone-200 px-3 min-h-9 rounded-lg transition-colors"
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
      <div className="animate-controls-in pl-0 sm:pl-10">
        <div className="bg-white border border-stone-200/80 rounded-xl p-4 max-w-lg space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-stone-600">
              Select service location
            </span>
            <span className="text-xs text-stone-500 truncate max-w-[220px]">
              Studio: {studioAddress}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect('At Artist Studio')}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-3.5 min-h-9 rounded-lg transition-colors"
            >
              <Building2 size={14} strokeWidth={1.75} />
              At Artist Studio
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(`Home / Event Venue (${homeArea})`)}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 px-3 min-h-9 rounded-lg transition-colors"
            >
              <MapPin size={14} strokeWidth={1.75} className="text-pink-700" />
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
              placeholder="Venue or barangay"
              className="flex-1 min-w-0 text-xs bg-[#fdfcfa] focus:bg-white border border-stone-200 focus:border-pink-400 rounded-lg px-3 min-h-9 text-stone-800 focus:outline-none"
            />
            <button
              type="button"
              disabled={disabled || !customVenue.trim()}
              onClick={() => customVenue.trim() && onSelect(customVenue.trim())}
              className="text-xs font-medium bg-stone-900 hover:bg-pink-600 disabled:bg-stone-200 text-white px-3.5 min-h-9 rounded-lg transition-colors shrink-0"
            >
              Use Venue
            </button>
          </div>

          {uniqueAreas.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-stone-100">
              <div className="text-xs font-medium text-stone-500">Quick service areas</div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueAreas.slice(0, 8).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(item.label)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-stone-50 hover:border-stone-300 text-stone-700 border border-stone-200 px-2.5 min-h-8 rounded-lg transition-colors"
                  >
                    <MapPin size={12} strokeWidth={1.75} className="text-stone-400 shrink-0" />
                    <span>{item.label}</span>
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
                        item.isFree ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
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
                  className="text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 min-h-8 rounded-lg transition-colors"
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
      <div className="animate-controls-in flex flex-wrap gap-2 pl-0 sm:pl-10">
        {fields.map((field) => (
          <button
            key={field}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(field)}
            className="text-xs font-medium bg-white hover:bg-[#fdfcfa] hover:text-pink-700 hover:border-pink-300 text-stone-700 border border-stone-200 px-3 min-h-9 rounded-lg transition-colors"
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
      <div className="animate-controls-in flex flex-wrap gap-2 pl-0 sm:pl-10">
        {['Book an appointment', 'What is included in bridal makeup?', 'Check available slots', 'How much additional heads?'].map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(q)}
            className="text-xs font-medium bg-white hover:bg-[#fdfcfa] hover:text-pink-700 hover:border-pink-300 text-stone-600 border border-stone-200 px-3 min-h-9 rounded-lg transition-colors"
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
      className={`w-full text-left border-l-2 rounded-lg px-2.5 py-1.5 mb-2 text-xs transition-colors ${
        isUser
          ? 'border-white/80 bg-pink-700/40 text-pink-50 hover:bg-pink-700/60'
          : 'border-pink-500 bg-[#f8f6f2] text-stone-600 hover:bg-stone-100'
      }`}
    >
      <div className="font-medium inline-flex items-center gap-1">
        <Reply size={11} strokeWidth={1.75} />
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
      {!isUser && <StudioMark size="xs" tone="soft" roundedFull />}
      <div className={`max-w-[85%] md:max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {appt ? (
          <div className="bg-white border border-stone-200 rounded-xl rounded-bl-sm shadow-2xs overflow-hidden w-full">
            {/* Highlighted Ref Code & Status Banner */}
            <div className="bg-[#fdfcfa] border-b border-stone-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {primaryCode && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium bg-pink-600 text-white px-2.5 py-1 rounded-md tabular-nums">
                    <Bookmark size={12} strokeWidth={1.75} />
                    Ref: {primaryCode}
                  </span>
                )}
                <span className="text-xs font-medium text-stone-600">
                  Save this code
                </span>
              </div>
              <span
                className={`text-xs font-medium px-2.5 py-0.5 rounded-md border ${
                  appt.status === 'rescheduled'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {appt.status === 'rescheduled' ? 'Rescheduled' : 'Confirmed'}
              </span>
            </div>

            <div className="p-4 space-y-3.5 text-sm leading-relaxed text-stone-800">
              {replyQuoteEl}
              <div className="whitespace-pre-wrap">{shownContent}</div>

              {/* Embedded Booking Summary Box */}
              <div className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-pink-700">
                      Booking summary
                    </div>
                    <div className="text-sm font-medium text-stone-900 mt-0.5">
                      {appt.service_name || matchedService?.name || 'Scheduled Service'}
                    </div>
                    {appt.duration_minutes && (
                      <div className="text-xs text-stone-500 mt-0.5 tabular-nums">
                        Estimated session: {formatDuration(appt.duration_minutes)}
                      </div>
                    )}
                  </div>
                  {matchedService && (
                    <span className="text-xs font-medium bg-white border border-stone-200 text-pink-700 px-2.5 py-1 rounded-md shrink-0 tabular-nums">
                      {formatServicePrice(matchedService)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-stone-200/80">
                  {(appt.date || appt.time) && (
                    <div className="flex items-center gap-1.5 text-stone-700 tabular-nums">
                      <Calendar size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
                      <span>
                        {[appt.date ? formatDateChipLabel(appt.date) : null, appt.time ? formatTime(appt.time) : null]
                          .filter(Boolean)
                          .join(' at ')}
                      </span>
                    </div>
                  )}
                  {appt.client_name && (
                    <div className="flex items-center gap-1.5 text-stone-700">
                      <User size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
                      <span className="truncate">{appt.client_name}</span>
                    </div>
                  )}
                  {appt.client_contact && (
                    <div className="flex items-center gap-1.5 text-stone-700">
                      <Phone size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
                      <span className="font-mono tabular-nums">{appt.client_contact}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-stone-700">
                    <MapPin size={14} strokeWidth={1.75} className="text-stone-400 shrink-0" />
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
                      className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#fdfcfa] hover:bg-stone-100 text-stone-800 border border-stone-200 px-2.5 min-h-8 rounded-lg transition-colors"
                    >
                      {copiedCode === code ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copiedCode === code ? `Copied ${code}` : `Copy Code: ${code}`}
                    </button>
                  ))}
                  {appointmentLinks?.calendarUrl && (
                    <a
                      href={appointmentLinks.calendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-stone-50 text-pink-700 border border-stone-200 px-2.5 min-h-8 rounded-lg transition-colors"
                    >
                      <CalendarPlus size={12} strokeWidth={1.75} />
                      Add to Google Calendar
                      <ExternalLink size={11} />
                    </a>
                  )}
                  {appointmentLinks?.mapsUrl && (
                    <a
                      href={appointmentLinks.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 px-2.5 min-h-8 rounded-lg transition-colors"
                    >
                      <MapPin size={12} strokeWidth={1.75} className="text-stone-500" />
                      View Venue in Google Maps
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}

              {message.handoff && (
                <div className="bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-stone-900 inline-flex items-center gap-1.5">
                      <MessageCircle size={14} strokeWidth={1.75} className="text-pink-700" />
                      {message.handoff.topic || `Message ${message.handoff.artist || 'Owner'} on Page`}
                    </span>
                    {ownerContact && (
                      <span className="text-xs text-stone-500 truncate max-w-[180px] tabular-nums">{ownerContact}</span>
                    )}
                  </div>
                  <textarea
                    value={handoffDraft}
                    onChange={(e) => setHandoffDraft(e.target.value)}
                    rows={3}
                    aria-label="Ready-to-send message"
                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 leading-relaxed focus:outline-none focus:border-pink-400"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyHandoff}
                      className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 px-3 min-h-8 rounded-lg transition-colors"
                    >
                      {copiedHandoff ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
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
                        className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-3 min-h-8 rounded-lg transition-colors"
                      >
                        Copy &amp; Message Page
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {showDevMeta && message.meta && (
                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-1.5 tabular-nums">
                  <span className="text-xs font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md">
                    {message.meta.intent}
                  </span>
                  <span className="text-xs font-medium bg-pink-50 text-pink-700 px-2 py-0.5 rounded-md">
                    {Math.round((message.meta.confidence ?? 0) * 100)}%
                  </span>
                  <span className="text-xs text-stone-500">{message.meta.elapsedMs ?? 0}ms</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${
                      message.meta.isTrash ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <Filter size={11} />
                    {message.meta.isTrash ? 'Dev only' : 'Owner logged'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
              isUser
                ? 'bg-pink-600 text-white rounded-br-sm'
                : 'bg-white border border-stone-200/80 text-stone-800 rounded-bl-sm'
            }`}
          >
            {replyQuoteEl}

            {!isUser && !isRevealing && referenceCodes.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {referenceCodes.map((code) => (
                  <span
                    key={`badge-${code}`}
                    className="inline-flex items-center gap-1 font-mono text-xs font-medium bg-pink-600 text-white px-2.5 py-0.5 rounded-md tabular-nums"
                  >
                    <Bookmark size={11} />
                    Ref: {code}
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
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#fdfcfa] hover:bg-stone-100 text-stone-800 border border-stone-200 px-2.5 min-h-8 rounded-lg transition-colors"
                  >
                    {copiedCode === code ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copiedCode === code ? `Copied ${code}` : `Copy Code: ${code}`}
                  </button>
                ))}
              </div>
            )}

            {!isUser && !isRevealing && message.handoff && (
              <div className="mt-3 bg-[#f8f6f2] border border-stone-200/80 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-stone-900 inline-flex items-center gap-1.5">
                    <MessageCircle size={14} strokeWidth={1.75} className="text-pink-700" />
                    {message.handoff.topic || `Message ${message.handoff.artist || 'Owner'} on Page`}
                  </span>
                  {ownerContact && (
                    <span className="text-xs text-stone-500 truncate max-w-[180px] tabular-nums">{ownerContact}</span>
                  )}
                </div>
                <textarea
                  value={handoffDraft}
                  onChange={(e) => setHandoffDraft(e.target.value)}
                  rows={3}
                  aria-label="Ready-to-send message"
                  className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 leading-relaxed focus:outline-none focus:border-pink-400"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyHandoff}
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 px-3 min-h-8 rounded-lg transition-colors"
                  >
                    {copiedHandoff ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
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
                      className="inline-flex items-center gap-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-700 text-white px-3 min-h-8 rounded-lg transition-colors"
                    >
                      Copy &amp; Message Page
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {showDevMeta && !isUser && message.meta && (
              <div className="mt-2.5 pt-2 border-t border-stone-100 flex flex-wrap items-center gap-1.5 tabular-nums">
                <span className="text-xs font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md">
                  {message.meta.intent}
                </span>
                <span className="text-xs font-medium bg-pink-50 text-pink-700 px-2 py-0.5 rounded-md">
                  {Math.round((message.meta.confidence ?? 0) * 100)}%
                </span>
                <span className="text-xs text-stone-500">{message.meta.elapsedMs ?? 0}ms</span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${
                    message.meta.isTrash ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <Filter size={11} />
                  {message.meta.isTrash ? 'Dev only' : 'Owner logged'}
                </span>
              </div>
            )}
          </div>
        )}

        {(timeLabel || (!isRevealing && (!isUser || onReply))) && (
          <div className="mt-1 px-1 flex items-center gap-2.5 text-xs text-gray-400 tabular-nums">
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
