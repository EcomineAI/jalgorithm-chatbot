// Date helpers pinned to Asia/Manila (UTC+8, no daylight saving) so results do not depend on
// the visitor's computer timezone. Dates are plain 'YYYY-MM-DD' strings; times are 'HH:MM'.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export function manilaToday(now = new Date()) {
  const d = new Date(now.getTime() + MANILA_OFFSET_MS)
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function toIso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

export function addDays(iso, n) {
  const { y, m, d } = parseIso(iso)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(iso) {
  const { y, m, d } = parseIso(iso)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function isValidDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return false
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function compareIso(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_FIL = ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(iso, lang = 'en') {
  const { y, m, d } = parseIso(iso)
  const names = lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_FIL
  return `${names[dayOfWeek(iso)]}, ${MONTHS[m - 1]} ${d}, ${y}`
}

export function formatTime(hhmm) {
  const [h, min] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(min).padStart(2, '0')} ${suffix}`
}
