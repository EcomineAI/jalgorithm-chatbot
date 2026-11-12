// Response selection: chooses a template and fills placeholders with validated values.
// No text is generated; unknown placeholders are left visible so template mistakes show up in tests.
// Salon facts come from the catalog (owner-edited in Supabase, or the built-in defaults).

import { RESPONSES } from './config/responses.js'
import { formatDate, formatTime } from './entities/calendar.js'

const peso = (n) => Number(n).toLocaleString('en-PH')

export function createResponder(catalog) {
  const { business, services } = catalog

  const baseVars = {
    business: business.name,
    artist: business.artist,
    location: business.location,
    city: business.location.split(',')[0],
    areas: business.travelAreas.length ? business.travelAreas.join(', ') : business.location.split(',')[0],
    open: formatTime(business.hours.open),
    close: formatTime(business.hours.close),
    days: business.hours.days,
    minDays: business.rules.minAdvanceDays,
    fee: peso(business.rules.reservationFee),
    feeServices:
      business.rules.reservationFeeServices
        .map((k) => services.find((s) => s.key === k)?.name)
        .filter(Boolean)
        .join(', ') || 'none',
    cutoff: business.rules.cancelCutoffHours,
    contact: business.contact,
    portfolio: business.portfolio,
    paymentMethods: business.paymentMethods,
    consultationFee: business.consultationFee != null ? peso(business.consultationFee) : null,
  }

  function t(key, vars = {}, { lang = 'fil', turn = 0 } = {}) {
    const table = RESPONSES[lang] ?? RESPONSES.en
    let template = table[key] ?? RESPONSES.en[key]
    if (template === undefined) throw new Error(`Missing response template: ${key}`)
    if (Array.isArray(template)) template = template[turn % template.length]
    const all = { ...baseVars, ...vars }
    return template.replace(/\{(\w+)\}/g, (m, name) => (all[name] !== undefined && all[name] !== null ? String(all[name]) : m))
  }

  const serviceName = (key) => services.find((s) => s.key === key)?.name ?? key
  const serviceList = ({ withPrices = true } = {}) =>
    services.map((s) => (withPrices ? `• ${s.name}: PHP ${peso(s.price)}` : `• ${s.name}`)).join('\n')

  /** Formatting helpers that respect the reply language. */
  const fmt = {
    date: (iso, lang) => formatDate(iso, lang),
    time: (hhmm) => formatTime(hhmm),
    slots: (list, max = 10) => {
      const shown = list.slice(0, max).map(formatTime).join(', ')
      return list.length > max ? `${shown}, …` : shown
    },
    price: peso,
  }

  return { t, fmt, serviceName, serviceList }
}
