// CSV export, template and import helpers for owner-side tables.
// Files are UTF-8 with a BOM so Excel shows Filipino/Taglish text correctly.
// Column headers are human-readable labels; the import maps them back to fields.

const CSV_BOM = '﻿'
export const APPOINTMENT_STATUSES = ['confirmed', 'rescheduled', 'cancelled', 'no_show']
const MANILA_OFFSET = '+08:00'

export const APPOINTMENT_COLUMNS = [
  { key: 'id', label: 'Record ID' },
  { key: 'reference_code', label: 'Reference Code' },
  { key: 'client_name', label: 'Client Name' },
  { key: 'client_contact', label: 'Client Contact' },
  { key: 'service_type', label: 'Service' },
  { key: 'appointment_date', label: 'Appointment Date & Time' },
  { key: 'event_location', label: 'Venue' },
  { key: 'status', label: 'Status' },
  { key: 'booking_method', label: 'Booking Method' },
  { key: 'reminder_sent', label: 'Reminder Sent' },
  { key: 'reminder_sent_at', label: 'Reminder Sent At' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Created At' },
]

export const CHAT_LOG_COLUMNS = [
  { key: 'id', label: 'Record ID' },
  { key: 'session_id', label: 'Session ID' },
  { key: 'user_message', label: 'Client Message' },
  { key: 'bot_reply', label: 'Bot Reply' },
  { key: 'intent_classified', label: 'Detected Intent' },
  { key: 'created_at', label: 'Created At' },
]

// Columns the import needs. Record ID and Created At are system fields and are ignored on import.
const REQUIRED_IMPORT_KEYS = ['client_name', 'service_type', 'appointment_date']

function escapeCsvCell(value) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/**
 * Build CSV text. `columns` is [{ key, label }]; the header row uses the labels.
 */
export function buildCsv(rows = [], columns = []) {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(',')
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvCell(row?.[c.key])).join(','),
  )
  return [header, ...body].join('\r\n')
}

/** Trigger a browser download of CSV text. Returns false if it could not start. */
export function downloadCsv(filename, csvText) {
  try {
    const blob = new Blob([CSV_BOM + csvText], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}

function dateStamp(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function exportAppointmentsCsv(appointments = [], now = new Date()) {
  return downloadCsv(
    `appointments-${dateStamp(now)}.csv`,
    buildCsv(appointments, APPOINTMENT_COLUMNS),
  )
}

export function exportChatLogsCsv(chatLogs = [], now = new Date()) {
  return downloadCsv(
    `chat-logs-${dateStamp(now)}.csv`,
    buildCsv(chatLogs, CHAT_LOG_COLUMNS),
  )
}

/** Header-only file with the same labels as the export, ready to fill in. */
export function downloadAppointmentTemplate() {
  return downloadCsv(
    'appointments-template.csv',
    buildCsv([], APPOINTMENT_COLUMNS),
  )
}

/** RFC 4180 style parser: quoted cells, doubled quotes, CRLF or LF line breaks. */
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '')
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\r') {
      // ignored; the following \n ends the row
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/**
 * Turn a date-time cell into an ISO string.
 * Accepts "YYYY-MM-DD HH:MM" (read as Manila time) or any value with a timezone offset.
 */
export function toIsoFromCell(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const plain = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/)
  if (plain) {
    const parsed = new Date(`${plain[1]}T${plain[2]}:00${MANILA_OFFSET}`)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }
  return null
}

/**
 * Parse an appointments CSV made from the export or the template.
 * Returns { rows, errors } where rows are ready for insert and errors name the line.
 */
export function parseAppointmentsCsv(text) {
  const [headerRow = [], ...dataRows] = parseCsv(text)
  const labelToKey = new Map(APPOINTMENT_COLUMNS.map((c) => [c.label.toLowerCase(), c.key]))
  const indexByKey = {}
  headerRow.forEach((label, idx) => {
    const key = labelToKey.get(label.trim().toLowerCase())
    if (key && indexByKey[key] === undefined) indexByKey[key] = idx
  })

  const missing = REQUIRED_IMPORT_KEYS.filter((k) => indexByKey[k] === undefined)
  if (missing.length > 0) {
    const names = missing.map((k) => APPOINTMENT_COLUMNS.find((c) => c.key === k).label)
    return {
      rows: [],
      errors: [{ line: 1, message: `Missing column(s): ${names.join(', ')}` }],
    }
  }

  const rows = []
  const errors = []
  dataRows.forEach((cells, i) => {
    const line = i + 2
    const get = (key) => (indexByKey[key] === undefined ? '' : (cells[indexByKey[key]] ?? '').trim())
    const problems = []

    const clientName = get('client_name')
    const service = get('service_type')
    if (!clientName) problems.push('Client Name is required')
    if (!service) problems.push('Service is required')

    const appointmentIso = toIsoFromCell(get('appointment_date'))
    if (!appointmentIso) problems.push('Appointment Date & Time must look like 2026-11-08 14:00')

    const status = get('status') || 'confirmed'
    if (!APPOINTMENT_STATUSES.includes(status)) {
      problems.push(`Status must be one of ${APPOINTMENT_STATUSES.join(', ')}`)
    }

    const reminderSentAt = get('reminder_sent_at')
    const reminderSentAtIso = reminderSentAt ? toIsoFromCell(reminderSentAt) : null
    if (reminderSentAt && !reminderSentAtIso) {
      problems.push('Reminder Sent At must look like 2026-11-07 09:00')
    }

    if (problems.length > 0) {
      errors.push({ line, message: problems.join('; ') })
      return
    }

    rows.push({
      reference_code: get('reference_code') || null,
      client_name: clientName,
      client_contact: get('client_contact') || null,
      service_type: service,
      appointment_date: appointmentIso,
      event_location: get('event_location') || null,
      status,
      booking_method: get('booking_method') || 'import',
      reminder_sent: /^(yes|true|1)$/i.test(get('reminder_sent')),
      reminder_sent_at: reminderSentAtIso,
      notes: get('notes') || null,
    })
  })

  return { rows, errors }
}

/** Header-only file with the chat log labels, ready to fill in. */
export function downloadChatLogTemplate() {
  return downloadCsv('chat-logs-template.csv', buildCsv([], CHAT_LOG_COLUMNS))
}

/**
 * Parse a chat logs CSV made from the export or the template.
 * Only "Client Message" is required. Created At is optional (defaults to the time of import).
 */
export function parseChatLogsCsv(text) {
  const [headerRow = [], ...dataRows] = parseCsv(text)
  const labelToKey = new Map(CHAT_LOG_COLUMNS.map((c) => [c.label.toLowerCase(), c.key]))
  const indexByKey = {}
  headerRow.forEach((label, idx) => {
    const key = labelToKey.get(label.trim().toLowerCase())
    if (key && indexByKey[key] === undefined) indexByKey[key] = idx
  })

  if (indexByKey.user_message === undefined) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'Missing column(s): Client Message' }],
    }
  }

  const rows = []
  const errors = []
  dataRows.forEach((cells, i) => {
    const line = i + 2
    const get = (key) => (indexByKey[key] === undefined ? '' : (cells[indexByKey[key]] ?? '').trim())
    const message = get('user_message')
    const createdRaw = get('created_at')
    const createdIso = createdRaw ? toIsoFromCell(createdRaw) : null

    if (!message) {
      errors.push({ line, message: 'Client Message is required' })
      return
    }
    if (createdRaw && !createdIso) {
      errors.push({ line, message: 'Created At must look like 2026-11-05 14:00 or include a timezone' })
      return
    }

    const row = {
      session_id: get('session_id') || null,
      user_message: message,
      bot_reply: get('bot_reply') || null,
      intent_classified: get('intent_classified') || null,
    }
    if (createdIso) row.created_at = createdIso
    rows.push(row)
  })

  return { rows, errors }
}
