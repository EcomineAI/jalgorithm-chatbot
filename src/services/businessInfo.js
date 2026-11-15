// Business info service: the salon details the owner edits in the Owner's panel.
//
// Public side (chatbot, navbar, landing page):
//   loadCatalog() -> { business, services, faqTopics, source }
//   source = 'supabase' (live) | 'cache' (last good copy in this browser) | 'default' (built-in)
//   so the chatbot keeps answering when there is no internet.
//
// Owner side (Owner's panel): loadOwnerData(), save*(), and applyPreset(), which write to Supabase.
// Row-level security only lets accounts listed in app_owners write; a refused write comes back
// as { ok: false, error: 'not_authorized' } instead of silently doing nothing.

import {
  defaultCatalog,
  SHOWCASE_SERVICE_IMAGES,
  SHOWCASE_GALLERY_URLS,
  DEFAULT_HERO_PHOTO_URL,
  DEFAULT_ARTIST_PHOTO_URL,
} from '../jalgorithm/config/business.js'

const CACHE_KEY = 'jal_catalog_v1'
const OVERRIDES_KEY = 'jal_owner_overrides_v1'

const PROFILE_BASE_KEYS = new Set([
  'name',
  'artist',
  'location',
  'contact',
  'portfolio_url',
  'payment_methods',
  'consultation_fee',
  'travel_areas',
  'reservation_fee',
  'reservation_fee_services',
])

const SERVICE_BASE_KEYS = new Set([
  'key',
  'name',
  'price',
  'duration_minutes',
  'aliases',
  'description',
  'sort_order',
  'show_on_landing',
  'active',
])

const safeStorage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const hhmm = (t) => (typeof t === 'string' ? t.slice(0, 5) : t)
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

function pickKeys(obj, allowed) {
  const base = {}
  const ext = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (allowed.has(k)) base[k] = v
    else ext[k] = v
  }
  return { base, ext }
}

function readOverrides(storage) {
  try {
    const raw = storage?.getItem(OVERRIDES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeOverrides(storage, updater) {
  if (!storage) return
  try {
    const cur = readOverrides(storage) || {}
    const next = updater(cur)
    storage.setItem(OVERRIDES_KEY, JSON.stringify(next))
  } catch {
    /* storage quota or blocked */
  }
}

function mergeRowOverrides(rows, storage) {
  const ov = readOverrides(storage)
  if (!ov || !rows) return rows
  const profile = { ...rows.profile }
  if (ov.profile && typeof ov.profile === 'object') {
    for (const [k, v] of Object.entries(ov.profile)) {
      if (profile[k] === undefined) profile[k] = v
    }
  }
  const services = (rows.services ?? []).map((svc) => {
    const svcOv = ov.services?.[svc.key]
    if (!svcOv || typeof svcOv !== 'object') return svc
    const merged = { ...svc }
    for (const [k, v] of Object.entries(svcOv)) {
      if (merged[k] === undefined) merged[k] = v
    }
    return merged
  })
  return { ...rows, profile, services }
}

const STALE_STOCK_PHOTO_REPLACEMENTS = [
  ['photo-1512207736890-6ffed8a84e8d', SHOWCASE_SERVICE_IMAGES.personal_makeup],
  ['photo-1457972729786-0411a3b2b626', SHOWCASE_SERVICE_IMAGES.hair_makeup],
  ['photo-1620331311520-246422fd82f9', SHOWCASE_SERVICE_IMAGES.hair_styling],
  ['photo-1519415510236-718bdfcd89c8', SHOWCASE_SERVICE_IMAGES.event_makeup],
]

function normalizePhotoUrl(url, fallback) {
  const clean = String(url ?? '').trim()
  if (!clean) return fallback
  for (const [badId, replacement] of STALE_STOCK_PHOTO_REPLACEMENTS) {
    if (clean.includes(badId)) return replacement
  }
  return clean
}

/** Maps Supabase rows to the catalog shape JAlgorithm uses (see config/business.js). */
export function toCatalog({ profile, services, settings }) {
  const defaults = defaultCatalog()
  const specialtyTags = Array.isArray(profile.specialty_tags) && profile.specialty_tags.length
    ? profile.specialty_tags
    : defaults.business.specialtyTags
  const freeTravelAreas = Array.isArray(profile.free_travel_areas) ? profile.free_travel_areas : []
  const rawGallery = Array.isArray(profile.gallery_urls)
    ? profile.gallery_urls.map((u) => normalizePhotoUrl(u, '')).filter(Boolean)
    : []
  const galleryUrls = rawGallery.length ? rawGallery : [...SHOWCASE_GALLERY_URLS]

  return {
    business: {
      name: profile.name,
      artist: profile.artist,
      location: profile.location,
      experienceYears: profile.experience_years || defaults.business.experienceYears,
      aboutBio: profile.about_bio || null,
      specialtyTags,
      heroPhotoUrl: normalizePhotoUrl(profile.hero_photo_url, DEFAULT_HERO_PHOTO_URL),
      artistPhotoUrl: normalizePhotoUrl(profile.artist_photo_url, DEFAULT_ARTIST_PHOTO_URL),
      galleryUrls,
      contact: profile.contact || null,
      portfolio: profile.portfolio_url || null,
      messengerUrl: profile.messenger_url || null,
      paymentMethods: profile.payment_methods || null,
      consultationFee: num(profile.consultation_fee),
      travelAreas: profile.travel_areas ?? [],
      freeTravelAreas,
      travelFeeNote: profile.travel_fee_note || null,
      additionalHeadPrice: num(profile.additional_head_price),
      additionalHeadNote: profile.additional_head_note || null,
      hours: { open: hhmm(settings.open_time), close: hhmm(settings.close_time), days: 'daily' },
      rules: {
        minAdvanceDays: settings.min_advance_days,
        reservationFee: num(profile.reservation_fee) ?? 0,
        reservationFeeServices: profile.reservation_fee_services ?? [],
        cancelCutoffHours: settings.cutoff_hours,
        rescheduleCutoffHours: settings.cutoff_hours,
        weddingDownpaymentPercent: num(profile.wedding_downpayment_percent),
        weddingCancelCutoffDays: num(profile.wedding_cancel_cutoff_days),
        eventDownpaymentPercent: profile.event_downpayment_percent || null,
        eventCancelCutoffDays: num(profile.event_cancel_cutoff_days),
        sameDayRushNote: profile.same_day_rush_note || null,
      },
    },
    services: services
      .filter((s) => s.active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
      .map((s) => ({
        key: s.key,
        name: s.name,
        price: Number(s.price),
        priceMode: s.price_mode || 'fixed',
        priceMax: num(s.price_max),
        priceNote: s.price_note || '',
        aliases: s.aliases ?? [],
        description: s.description ?? '',
        inclusions: s.inclusions ?? '',
        imageUrl: normalizePhotoUrl(s.image_url, SHOWCASE_SERVICE_IMAGES[s.key] || DEFAULT_ARTIST_PHOTO_URL),
        durationMinutes: s.duration_minutes,
        showOnLanding: Boolean(s.show_on_landing),
      })),
    faqTopics: defaults.faqTopics,
  }
}

function isMissingColumnError(error) {
  const code = `${error?.code ?? ''}`
  const msg = `${error?.message ?? ''}`
  return code === 'PGRST204' || code === '42703' || /could not find the .* column|column .* does not exist/i.test(msg)
}

function isMissingSetupError(error) {
  const code = `${error?.code ?? ''}`
  const msg = `${error?.message ?? ''}`
  return (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    code === '42883' ||
    code === '42P01' ||
    /could not find the function|function .* does not exist|relation .* does not exist/i.test(msg)
  )
}

function isNetworkError(error) {
  const msg = `${error?.message ?? ''}`
  return /fetch|network|failed to|load failed|timeout/i.test(msg) || !error?.code
}

function describeError(error) {
  const msg = `${error?.message ?? ''}`
  if (isNetworkError(error)) return 'unreachable'
  if (error.code === '42501' || /row-level security|permission/i.test(msg)) return 'not_authorized'
  if (error.code === '23514' || error.code === '23502') return 'invalid'
  if (error.code === '23505') return 'duplicate'
  if (isMissingSetupError(error)) return 'not_set_up'
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
      return mergeRowOverrides({ profile: p.data, services: s.data ?? [], settings: b.data }, storage)
    } catch (e) {
      return { error: describeError(e) }
    }
  }

  async function refreshCacheFromLive() {
    const rows = await fetchRows()
    if (!rows.error && rows.services.length) {
      const catalog = toCatalog(rows)
      try {
        storage?.setItem(CACHE_KEY, JSON.stringify(catalog))
      } catch {
        /* ignore */
      }
      return catalog
    }
    return null
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
      if (error) return { ok: false, error: describeError(error), rawError: error }
      if (!data || data.length === 0) return { ok: false, error: 'not_authorized' }
      return { ok: true, data: data[0] }
    } catch (e) {
      return { ok: false, error: describeError(e) }
    }
  }

  async function saveProfile(patch) {
    if (!client) return { ok: false, error: 'unreachable' }
    const direct = await write(client.from('business_profile').update(patch).eq('id', 1))
    if (direct.ok) {
      writeOverrides(storage, (cur) => ({ ...cur, profile: undefined }))
      await refreshCacheFromLive()
      return { ok: true, data: direct.data }
    }
    if (direct.rawError && isMissingColumnError(direct.rawError)) {
      const { base, ext } = pickKeys(patch, PROFILE_BASE_KEYS)
      const fallback = Object.keys(base).length
        ? await write(client.from('business_profile').update(base).eq('id', 1))
        : { ok: true, data: {} }
      if (!fallback.ok) return { ok: false, error: fallback.error }
      writeOverrides(storage, (cur) => ({ ...cur, profile: { ...(cur.profile || {}), ...ext } }))
      await refreshCacheFromLive()
      return { ok: true, data: { ...fallback.data, ...ext }, localExtended: true }
    }
    return { ok: false, error: direct.error }
  }

  async function saveSettings(patch) {
    if (!client) return { ok: false, error: 'unreachable' }
    const direct = await write(client.from('booking_settings').update(patch).eq('id', 1))
    if (!direct.ok) return { ok: false, error: direct.error }
    await refreshCacheFromLive()
    return { ok: true, data: direct.data }
  }

  async function saveService(key, patch) {
    if (!client) return { ok: false, error: 'unreachable' }
    const direct = await write(client.from('services').update(patch).eq('key', key))
    if (direct.ok) {
      writeOverrides(storage, (cur) => {
        if (!cur.services?.[key]) return cur
        const nextSvcs = { ...cur.services }
        delete nextSvcs[key]
        return { ...cur, services: nextSvcs }
      })
      await refreshCacheFromLive()
      return { ok: true, data: direct.data }
    }
    if (direct.rawError && isMissingColumnError(direct.rawError)) {
      const { base, ext } = pickKeys(patch, SERVICE_BASE_KEYS)
      const fallback = Object.keys(base).length
        ? await write(client.from('services').update(base).eq('key', key))
        : { ok: true, data: {} }
      if (!fallback.ok) return { ok: false, error: fallback.error }
      writeOverrides(storage, (cur) => ({
        ...cur,
        services: { ...(cur.services || {}), [key]: { ...(cur.services?.[key] || {}), ...ext } },
      }))
      await refreshCacheFromLive()
      return { ok: true, data: { ...fallback.data, ...ext }, localExtended: true }
    }
    return { ok: false, error: direct.error }
  }

  async function addService(row) {
    if (!client) return { ok: false, error: 'unreachable' }
    const direct = await write(client.from('services').insert(row))
    if (direct.ok) {
      await refreshCacheFromLive()
      return { ok: true, data: direct.data }
    }
    if (direct.rawError && isMissingColumnError(direct.rawError)) {
      const { base, ext } = pickKeys(row, SERVICE_BASE_KEYS)
      const fallback = await write(client.from('services').insert(base))
      if (!fallback.ok) return { ok: false, error: fallback.error }
      if (Object.keys(ext).length && row.key) {
        writeOverrides(storage, (cur) => ({
          ...cur,
          services: { ...(cur.services || {}), [row.key]: ext },
        }))
      }
      await refreshCacheFromLive()
      return { ok: true, data: { ...fallback.data, ...ext }, localExtended: true }
    }
    return { ok: false, error: direct.error }
  }

  async function applyPreset(preset, existingServices = []) {
    if (!preset) return { ok: false, error: 'invalid' }
    const pRes = await saveProfile(preset.profile)
    if (!pRes.ok) return pRes
    const sRes = await saveSettings(preset.settings)
    if (!sRes.ok) return sRes

    const existingKeys = new Set((existingServices ?? []).map((s) => s.key))
    let usedLocalExtended = Boolean(pRes.localExtended)
    for (let idx = 0; idx < (preset.services ?? []).length; idx++) {
      const svc = preset.services[idx]
      const patch = {
        name: svc.name,
        price: svc.price,
        price_mode: svc.price_mode ?? svc.priceMode ?? 'fixed',
        price_max: svc.price_max ?? svc.priceMax ?? null,
        price_note: svc.price_note ?? svc.priceNote ?? null,
        duration_minutes: svc.duration_minutes,
        aliases: svc.aliases,
        description: svc.description,
        inclusions: svc.inclusions ?? null,
        image_url: svc.image_url ?? svc.imageUrl ?? null,
        show_on_landing: Boolean(svc.show_on_landing),
        active: svc.active ?? true,
        sort_order: idx + 1,
      }
      const res = existingKeys.has(svc.key)
        ? await saveService(svc.key, patch)
        : await addService({ key: svc.key, ...patch })
      if (!res.ok) return res
      if (res.localExtended) usedLocalExtended = true
    }
    return { ok: true, localExtended: usedLocalExtended }
  }

  async function checkOwnerAccess() {
    if (!client) return { status: 'unreachable' }
    try {
      const { data, error } = await client.rpc('is_owner')
      if (error) {
        if (isMissingSetupError(error)) return { status: 'not_set_up', detail: error.message }
        if (isNetworkError(error)) return { status: 'unreachable', detail: error.message }
        return { status: 'not_authorized', detail: error.message }
      }
      return { status: data === true ? 'owner' : 'not_authorized' }
    } catch (e) {
      const msg = `${e?.message ?? ''}`
      if (/fetch|network|failed to|load failed|timeout/i.test(msg)) return { status: 'unreachable', detail: msg }
      return { status: 'not_authorized', detail: msg }
    }
  }

  return {
    loadCatalog,
    loadOwnerData,
    saveProfile,
    saveSettings,
    saveService,
    addService,
    applyPreset,
    checkOwnerAccess,
    isOwner: async () => (await checkOwnerAccess()).status === 'owner',
  }
}

/** Turns a service name into a stable key: "Kiddie Makeup!" -> "kiddie_makeup". */
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
