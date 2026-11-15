// Utilities for Google Maps links, Google Calendar exports, and owner/client reminders.
// Pure browser/Node JavaScript with zero external dependencies.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Converts a UTC/offset ISO timestamp into Manila local { date: 'YYYY-MM-DD', time: 'HH:MM' }. */
export function toManilaDateTime(timestampIso) {
  if (!timestampIso) return null
  const ms = Date.parse(timestampIso)
  if (Number.isNaN(ms)) return null
  const local = new Date(ms + MANILA_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = pad2(local.getUTCMonth() + 1)
  const d = pad2(local.getUTCDate())
  const hh = pad2(local.getUTCHours())
  const mm = pad2(local.getUTCMinutes())
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` }
}

/** Returns Manila today's date as 'YYYY-MM-DD'. */
export function manilaTodayIso(now = new Date()) {
  const local = new Date(now.getTime() + MANILA_OFFSET_MS)
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`
}

/** Formats 'YYYY-MM-DD' into 'Nov 20, 2026'. */
export function formatDisplayDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || ''
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${SHORT_MONTHS[m - 1]} ${d}, ${y}`
}

/** Formats 'HH:MM' into '2:00 PM'. */
export function formatDisplayTime(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}/.test(hhmm)) return hhmm || ''
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${pad2(m)} ${ampm}`
}

/** Shifts a Manila { date, time } by deltaMinutes and returns { date, time }. */
export function shiftManilaDateTime(dateIso, timeHhmm, deltaMinutes) {
  if (!dateIso || !timeHhmm) return null
  const [y, mo, d] = dateIso.split('-').map(Number)
  const [hh, mm] = timeHhmm.slice(0, 5).split(':').map(Number)
  if ([y, mo, d, hh, mm].some(Number.isNaN)) return null
  const utcMs = Date.UTC(y, mo - 1, d, hh, mm) + deltaMinutes * 60 * 1000
  const shifted = new Date(utcMs)
  return {
    date: `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`,
    time: `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`,
  }
}

/** Builds a Google Maps search link for a venue or event location. */
export function buildGoogleMapsUrl(location) {
  const clean = String(location ?? '').trim()
  if (!clean) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`
}

/** Builds an "Add to Google Calendar" URL pinned to Asia/Manila time. */
export function buildGoogleCalendarUrl({
  title,
  startIsoDate,
  startTime,
  timestampIso,
  durationMinutes = 120,
  location = '',
  description = '',
} = {}) {
  const resolved = startIsoDate && startTime
    ? { date: startIsoDate, time: startTime.slice(0, 5) }
    : toManilaDateTime(timestampIso)
  if (!resolved) return null

  const end = shiftManilaDateTime(resolved.date, resolved.time, Math.max(15, Number(durationMinutes) || 120))
  if (!end) return null

  const toStamp = (d, t) => `${d.replace(/-/g, '')}T${t.replace(':', '')}00`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Hair & Makeup Appointment',
    dates: `${toStamp(resolved.date, resolved.time)}/${toStamp(end.date, end.time)}`,
    ctz: 'Asia/Manila',
  })
  if (location && String(location).trim()) params.set('location', String(location).trim())
  if (description && String(description).trim()) params.set('details', String(description).trim())
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Whole-day difference from today (Manila) to target 'YYYY-MM-DD'. */
export function daysUntilManila(targetIsoDate, now = new Date()) {
  if (!targetIsoDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetIsoDate)) return null
  const todayIso = manilaTodayIso(now)
  const t0 = Date.parse(`${todayIso}T00:00:00Z`)
  const t1 = Date.parse(`${targetIsoDate}T00:00:00Z`)
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null
  return Math.round((t1 - t0) / (24 * 60 * 60 * 1000))
}

/** Computes call time, suggested leave/travel time, Maps link, and Calendar URL for an appointment. */
export function computeOwnerPrepSummary(appointment, { freeTravelAreas = ['Olongapo City', 'Subic Bay'], businessName = '' } = {}) {
  if (!appointment) return null
  const dt = appointment.date && appointment.time
    ? { date: appointment.date, time: appointment.time.slice(0, 5) }
    : toManilaDateTime(appointment.appointment_date)
  if (!dt) return null

  const venue = String(appointment.event_location ?? appointment.location ?? '').trim()
  const lowerVenue = venue.toLowerCase()
  const normalizedFree = freeTravelAreas.map((a) => String(a).toLowerCase())

  let leadMinutes = 60
  let prepLabel = '1 hr local prep / travel buffer'
  if (venue) {
    if (/(clark|pampanga|iba|botolan|subic|zambales|castillejos|san antonio|san marcelino|san felipe|angeles)/i.test(lowerVenue)) {
      const isFreeSubicOrOlongapo = normalizedFree.some((area) => area && lowerVenue.includes(area.toLowerCase()))
      if (/(clark|pampanga|iba|botolan|angeles)/i.test(lowerVenue)) {
        leadMinutes = 120
        prepLabel = '2 hrs out-of-town travel buffer (toll / long drive)'
      } else if (isFreeSubicOrOlongapo) {
        leadMinutes = 60
        prepLabel = '1 hr local Olongapo / Subic Bay travel buffer'
      } else {
        leadMinutes = 90
        prepLabel = '1.5 hrs Zambales travel buffer'
      }
    } else if (!normalizedFree.some((area) => area && lowerVenue.includes(area.toLowerCase())) && !lowerVenue.includes('studio')) {
      leadMinutes = 90
      prepLabel = '1.5 hrs venue travel buffer'
    }
  } else {
    prepLabel = '1 hr studio / kit prep buffer (venue not specified)'
  }

  const leave = shiftManilaDateTime(dt.date, dt.time, -leadMinutes)
  const serviceLabel = appointment.service_name || appointment.service_type || 'Hair & Makeup Appointment'
  const ref = appointment.reference_code ? ` (${appointment.reference_code})` : ''
  const clientPart = appointment.client_name ? ` - ${appointment.client_name}` : ''
  const title = `${serviceLabel}${clientPart}${ref}${businessName ? ` | ${businessName}` : ''}`
  const description = [
    appointment.reference_code ? `Reference: ${appointment.reference_code}` : null,
    appointment.client_name ? `Client: ${appointment.client_name}` : null,
    appointment.client_contact ? `Contact: ${appointment.client_contact}` : null,
    venue ? `Venue: ${venue}` : null,
    `Suggested leave/prep: ${leave ? formatDisplayTime(leave.time) : ''} (${prepLabel})`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    date: dt.date,
    time: dt.time,
    displayDate: formatDisplayDate(dt.date),
    callTimeFormatted: formatDisplayTime(dt.time),
    leaveTimeFormatted: leave ? formatDisplayTime(leave.time) : null,
    leaveDateChanged: Boolean(leave && leave.date !== dt.date),
    prepLabel,
    venue: venue || null,
    mapsUrl: buildGoogleMapsUrl(venue),
    calendarUrl: buildGoogleCalendarUrl({
      title,
      startIsoDate: dt.date,
      startTime: dt.time,
      durationMinutes: appointment.duration_minutes ?? 120,
      location: venue,
      description,
    }),
  }
}

/** Formats a ready-to-send client reminder message (sent 3 days before the appointment). */
export function buildClientReminderText(appointment, businessName = 'our studio') {
  const dt = appointment?.date && appointment?.time
    ? { date: appointment.date, time: appointment.time.slice(0, 5) }
    : toManilaDateTime(appointment?.appointment_date)
  const name = appointment?.client_name || 'there'
  const service = appointment?.service_name || appointment?.service_type || 'hair & makeup'
  const dateLabel = dt ? formatDisplayDate(dt.date) : 'your scheduled date'
  const timeLabel = dt ? formatDisplayTime(dt.time) : 'your scheduled time'
  const venue = String(appointment?.event_location ?? appointment?.location ?? '').trim()
  const venuePart = venue ? ` at ${venue}` : ''
  const refPart = appointment?.reference_code ? ` (Ref: ${appointment.reference_code})` : ''
  return `Hello ${name}! This is a reminder from ${businessName} for your ${service} appointment on ${dateLabel} at ${timeLabel}${venuePart}${refPart}. Kindly reply to confirm your appointment. Thank you!`
}
