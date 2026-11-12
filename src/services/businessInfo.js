// Business info service: the salon details the owner edits in the Owner's panel.
//
// Public side (chatbot, navbar, landing page):
//   loadCatalog() → { business, services, faqTopics, source }
//   source = 'supabase' (live) | 'cache' (last good copy in this browser) | 'default' (built-in)
//   so the chatbot keeps answering when there is no internet.
//
// Owner side (Owner's panel): loadOwnerData() and save*() functions, which write to Supabase.
// Row-level security only lets accounts listed in app_owners write; a refused write comes back
// as { ok: false, error: 'not_authorized' } instead of silently doing nothing.

import { defaultCatalog } from '../jalgorithm/config/business.js'

const CACHE_KEY = 'jal_catalog_v1'

const safeStorage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const hhmm = (t) => (typeof t === 'string' ? t.slice(0, 5) : t)
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

/** Maps Supabase rows to the catalog shape JAlgorithm uses (see config/business.js). */
export function toCatalog({ profile, services, settings }) {
  const defaults = defaultCatalog()
  return {
    business: {
      name: profile.name,
      artist: profile.artist,
      location: profile.location,
      contact: profile.contact || null,
      portfolio: profile.portfolio_url || null,
      paymentMethods: profile.payment_methods || null,
      consultationFee: num(profile.consultation_fee),
      travelAreas: profile.travel_areas ?? [],
      hours: { open: hhmm(settings.open_time), close: hhmm(settings.close_time), days: 'daily' },
      rules: {
        minAdvanceDays: settings.min_advance_days,
        reservationFee: num(profile.reservation_fee) ?? 0,
        reservationFeeServices: profile.reservation_fee_services ?? [],
        cancelCutoffHours: settings.cutoff_hours,
        rescheduleCutoffHours: settings.cutoff_hours,
      },
    },
    services: services
      .filter((s) => s.active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
      .map((s) => ({
        key: s.key,
        name: s.name,
        price: Number(s.price),
        aliases: s.aliases ?? [],
        description: s.description ?? '',
        durationMinutes: s.duration_minutes,
        showOnLanding: Boolean(s.show_on_landing),
      })),
    faqTopics: defaults.faqTopics,
  }
}

function describeError(error) {
  const msg = `${error?.message ?? ''}`
  if (/fetch|network|failed to|load failed|timeout/i.test(msg) || !error?.code) return 'unreachable'
  if (error.code === '42501' || /row-level security|permission/i.test(msg)) return 'not_authorized'
  if (error.code === '23514' || error.code === '23502') return 'invalid'
  if (error.code === '23505') return 'duplicate'
  if (error.code === '42P01' || error.code === 'PGRST205') return 'not_set_up'
  return msg || 'error'
}

export function createBusinessInfoService(client, storage = safeStorage()) {
  async function fetchRows({ includeInactive = false } = {}) {
    if (!client) return { error: 'unreachable' }
    try {
      let servicesQuery = client.from('services').select('*').order('sort_order', { ascending: true })
      if (!includeInactive) servicesQuery = servicesQuery.eq('active', true)
      const [p, s, b] = await Promise.all([
        client.from('business_profile').select('*').eq('id', 1).maybeSingle(),
        servicesQuery,
        client.from('booking_settings').select('*').eq('id', 1).maybeSingle(),
      ])
      const err = p.error || s.error || b.error
      if (err) return { error: describeError(err) }
      if (!p.data || !b.data) return { error: 'not_set_up' }
      return { profile: p.data, services: s.data ?? [], settings: b.data }
    } catch (e) {
      return { error: describeError(e) }
    }
  }

  async function loadCatalog() {
    const rows = await fetchRows()
    if (!rows.error && rows.services.length) {
      const catalog = toCatalog(rows)
      try {
        storage?.setItem(CACHE_KEY, JSON.stringify(catalog))
      } catch {
        /* storage full or blocked: still fine, just no offline copy */
      }
      return { ...catalog, source: 'supabase' }
    }
    try {
      const cached = JSON.parse(storage?.getItem(CACHE_KEY) ?? 'null')
      if (cached?.business && cached?.services?.length) return { ...cached, source: 'cache' }
    } catch {
      /* corrupted cache: ignore */
    }
    return { ...defaultCatalog(), source: 'default', error: rows.error ?? 'empty' }
  }

  /** Raw rows for the Owner's panel, including inactive services. */
  async function loadOwnerData() {
    return fetchRows({ includeInactive: true })
  }

  // An update blocked by row-level security returns no error but changes 0 rows,
  // so every write asks for the changed row back and checks it arrived.
  async function write(query) {
    if (!client) return { ok: false, error: 'unreachable' }
    try {
      const { data, error } = await query.select()
      if (error) return { ok: false, error: describeError(error) }
      if (!data || data.length === 0) return { ok: false, error: 'not_authorized' }
      return { ok: true, data: data[0] }
    } catch (e) {
      return { ok: false, error: describeError(e) }
    }
  }

  return {
    loadCatalog,
    loadOwnerData,
    saveProfile: (patch) => write(client?.from('business_profile').update(patch).eq('id', 1)),
    saveSettings: (patch) => write(client?.from('booking_settings').update(patch).eq('id', 1)),
    saveService: (key, patch) => write(client?.from('services').update(patch).eq('key', key)),
    addService: (row) => write(client?.from('services').insert(row)),
    isOwner: async () => {
      if (!client) return false
      try {
        const { data, error } = await client.rpc('is_owner')
        return !error && data === true
      } catch {
        return false
      }
    },
  }
}

/** Turns a service name into a stable key: "Kiddie Makeup!" → "kiddie_makeup". */
export function serviceKeyFromName(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

/** Friendly messages for the Owner's panel. */
export const SAVE_ERRORS = {
  unreachable: "Can't reach the database. Check your internet connection and try again.",
  not_authorized: "This account isn't allowed to edit business info. Ask the developer to add it as an owner.",
  invalid: 'Some values are not allowed (for example, opening time must be before closing time).',
  duplicate: 'A service with that name already exists.',
  not_set_up: 'The database is not set up yet. Run the Supabase migrations first.',
}
