import { describe, it, expect, vi } from 'vitest'
import { createBusinessInfoService, toCatalog, serviceKeyFromName } from '../src/services/businessInfo.js'
import { BENEFICIARY_PRESET_TREV_LUNA } from '../src/jalgorithm/config/business.js'
import { createJAlgorithm } from '../src/jalgorithm/index.js'

const NOW = new Date('2026-11-12T02:00:00Z')

const ROWS = {
  profile: {
    name: 'Glow Studio', artist: 'Ana', location: 'Subic, Zambales', contact: '0917 555 0000', portfolio_url: null,
    payment_methods: 'GCash, cash', consultation_fee: '300.00', travel_areas: ['Olongapo'], reservation_fee: '500.00',
    reservation_fee_services: ['bridal'],
  },
  services: [
    { key: 'bridal', name: 'Bridal Glam', price: '4200.00', duration_minutes: 180, aliases: ['bridal', 'kasal', 'bride'], description: 'Wedding day', sort_order: 1, show_on_landing: true, active: true },
    { key: 'kiddie', name: 'Kiddie Makeup', price: '300.00', duration_minutes: 30, aliases: ['bata', 'kids'], description: null, sort_order: 2, show_on_landing: false, active: true },
    { key: 'old', name: 'Old Service', price: '100.00', duration_minutes: 60, aliases: [], description: null, sort_order: 3, show_on_landing: false, active: false },
  ],
  settings: { open_time: '09:00:00', close_time: '18:00:00', min_advance_days: 2, cutoff_hours: 48, slot_interval_minutes: 60, default_duration_minutes: 60 },
}

// Minimal fake of the supabase-js query builder used by the service.
function fakeClient({ tables = {}, fail = null, writeResult } = {}) {
  const builder = (table) => {
    const q = {
      _single: false,
      select: () => q,
      eq: () => q,
      order: () => q,
      maybeSingle: () => ({ ...q, _single: true }),
      update: () => q,
      insert: () => q,
      then: (resolve) => {
        if (fail) return resolve({ data: null, error: fail })
        if (writeResult) return resolve(writeResult)
        const rows = tables[table]
        return resolve({ data: q._single ? rows : rows, error: null })
      },
    }
    q.maybeSingle = () => {
      const single = { ...q, then: (resolve) => (fail ? resolve({ data: null, error: fail }) : resolve({ data: tables[table], error: null })) }
      return single
    }
    return q
  }
  return { from: vi.fn(builder), rpc: vi.fn(async () => ({ data: true, error: null })) }
}

const memoryStorage = () => {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }
}

const liveTables = { business_profile: ROWS.profile, services: ROWS.services.filter((s) => s.active), booking_settings: ROWS.settings }

describe('toCatalog', () => {
  it('maps database rows to the engine catalog', () => {
    const c = toCatalog(ROWS)
    expect(c.business).toMatchObject({
      name: 'Glow Studio', artist: 'Ana', contact: '0917 555 0000', paymentMethods: 'GCash, cash', consultationFee: 300,
      hours: { open: '09:00', close: '18:00', days: 'daily' },
      rules: { minAdvanceDays: 2, reservationFee: 500, reservationFeeServices: ['bridal'], cancelCutoffHours: 48 },
    })
    expect(c.services.map((s) => s.key)).toEqual(['bridal', 'kiddie']) // inactive hidden
    expect(c.services[0].price).toBe(4200)
  })
})

describe('loadCatalog', () => {
  it('loads from Supabase and caches a copy', async () => {
    const storage = memoryStorage()
    const svc = createBusinessInfoService(fakeClient({ tables: liveTables }), storage)
    const c = await svc.loadCatalog()
    expect(c.source).toBe('supabase')
    expect(c.business.name).toBe('Glow Studio')
    expect(JSON.parse(storage.getItem('jal_catalog_v1')).business.name).toBe('Glow Studio')
  })

  it('falls back to the cached copy when offline, then to the defaults', async () => {
    const storage = memoryStorage()
    await createBusinessInfoService(fakeClient({ tables: liveTables }), storage).loadCatalog()
    const offline = fakeClient({ fail: { message: 'TypeError: Failed to fetch', code: '' } })
    const cached = await createBusinessInfoService(offline, storage).loadCatalog()
    expect(cached.source).toBe('cache')
    expect(cached.business.name).toBe('Glow Studio')

    const fresh = await createBusinessInfoService(offline, memoryStorage()).loadCatalog()
    expect(fresh.source).toBe('default')
    expect(fresh.business.name).toBe("Vicky's Parlor")
    expect(fresh.error).toBe('unreachable')
  })
})

describe('owner saves', () => {
  it('reports success only when a row actually changed', async () => {
    const ok = createBusinessInfoService(fakeClient({ writeResult: { data: [{ id: 1 }], error: null } }))
    expect(await ok.saveProfile({ name: 'X' })).toMatchObject({ ok: true })
    // row-level security blocks the update: no error, but zero rows come back
    const blocked = createBusinessInfoService(fakeClient({ writeResult: { data: [], error: null } }))
    expect(await blocked.saveProfile({ name: 'X' })).toEqual({ ok: false, error: 'not_authorized' })
  })
  it('maps database errors to friendly codes', async () => {
    const svc = (error) => createBusinessInfoService(fakeClient({ writeResult: { data: null, error } }))
    expect(await svc({ code: '23514', message: 'check' }).saveSettings({})).toEqual({ ok: false, error: 'invalid' })
    expect(await svc({ code: '23505', message: 'dup' }).addService({})).toEqual({ ok: false, error: 'duplicate' })
    expect(await svc({ code: '42501', message: 'permission denied' }).saveService('x', {})).toEqual({ ok: false, error: 'not_authorized' })
    expect(await createBusinessInfoService(null).saveProfile({})).toEqual({ ok: false, error: 'unreachable' })
  })
  it('builds safe service keys from names', () => {
    expect(serviceKeyFromName('Kiddie Makeup!')).toBe('kiddie_makeup')
    expect(serviceKeyFromName('  Hair & Make-up  ')).toBe('hair_make_up')
  })
})

describe('the chatbot uses the owner\'s info', () => {
  const bot = createJAlgorithm({ catalog: toCatalog(ROWS), now: () => NOW })
  const ask = async (text) => (await bot.processMessage(text, bot.initialState())).reply

  it('quotes the owner\'s prices and recognizes the owner\'s keywords', async () => {
    expect(await ask('magkano kasal?')).toMatch(/Bridal Glam ay PHP 4,200/)
    expect(await ask('magkano pag bata?')).toMatch(/Kiddie Makeup ay PHP 300/)
    expect(await ask('what services do you offer?')).not.toMatch(/Old Service/)
  })
  it('uses the owner\'s hours, location, rules and contact details', async () => {
    expect(await ask('what are your hours?')).toMatch(/9:00 AM to 6:00 PM/)
    expect(await ask('where are you located?')).toMatch(/Glow Studio is based in Subic, Zambales/)
    expect(await ask('do you require a deposit?')).toMatch(/at least 2 days in advance[\s\S]*PHP 500[\s\S]*48 hours/)
    expect(await ask('what is your contact number?')).toMatch(/0917 555 0000/)
    expect(await ask('how do i pay?')).toMatch(/GCash, cash/)
    expect(await ask('how much is the consultation fee?')).toMatch(/consultation fee is PHP 300/)
  })
  it('falls back to "not set up yet" answers when a field is empty', async () => {
    expect(await ask('do you have a portfolio?')).toMatch(/portfolio link isn't set up/)
  })
})

describe('beneficiary interview extensions & preset switching', () => {
  it('maps extended branding, inclusions, travel areas, additional heads, and tiered rules', () => {
    const c = toCatalog({
      profile: BENEFICIARY_PRESET_TREV_LUNA.profile,
      services: BENEFICIARY_PRESET_TREV_LUNA.services,
      settings: BENEFICIARY_PRESET_TREV_LUNA.settings,
    })
    expect(c.business.name).toBe('Makeup and Hair by Trev Luna')
    expect(c.business.artist).toBe('Trev Luna')
    expect(c.business.freeTravelAreas).toEqual(['Olongapo City', 'Subic Bay'])
    expect(c.business.additionalHeadPrice).toBe(1000)
    expect(c.business.rules.weddingDownpaymentPercent).toBe(40)
    expect(c.business.rules.weddingCancelCutoffDays).toBe(30)
    expect(c.business.rules.eventDownpaymentPercent).toBe('10% to 20%')
    expect(c.business.rules.eventCancelCutoffDays).toBe(3)
    expect(c.services.find((s) => s.key === 'personal_makeup')?.name).toBe('Everyday Glam')
    expect(c.services.find((s) => s.key === 'bridal')?.inclusions).toMatch(/Full skin prep/)
  })

  it('caches extended columns locally when Supabase returns PGRST204 for un-migrated columns', async () => {
    const storage = memoryStorage()
    const baseProfile = { ...ROWS.profile }
    const fakeWithPreMigrationSchema = {
      from: vi.fn((table) => {
        const q = {
          _payload: null,
          select: () => q,
          eq: () => q,
          order: () => q,
          maybeSingle: () => ({
            ...q,
            then: (resolve) => resolve({
              data: table === 'business_profile' ? baseProfile : table === 'services' ? ROWS.services : ROWS.settings,
              error: null,
            }),
          }),
          update: (payload) => {
            q._payload = payload
            return q
          },
          insert: (payload) => {
            q._payload = payload
            return q
          },
          then: (resolve) => {
            if (q._payload && 'about_bio' in q._payload) {
              return resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'about_bio' column" } })
            }
            if (q._payload && table === 'business_profile') Object.assign(baseProfile, q._payload)
            return resolve({ data: [table === 'business_profile' ? baseProfile : ROWS.services[0]], error: null })
          },
        }
        return q
      }),
      rpc: vi.fn(async () => ({ data: true, error: null })),
    }

    const svc = createBusinessInfoService(fakeWithPreMigrationSchema, storage)
    const saved = await svc.saveProfile({ name: 'Makeup and Hair by Trev Luna', about_bio: 'Custom Bio Text' })
    expect(saved).toMatchObject({ ok: true, localExtended: true })

    const loaded = await svc.loadOwnerData()
    expect(loaded.profile.name).toBe('Makeup and Hair by Trev Luna')
    expect(loaded.profile.about_bio).toBe('Custom Bio Text')
  })

  it('distinguishes owner, not_authorized, not_set_up, and unreachable in checkOwnerAccess()', async () => {
    const storage = memoryStorage()
    expect(await createBusinessInfoService(null, storage).checkOwnerAccess()).toEqual({ status: 'unreachable' })

    const ownerClient = { rpc: vi.fn(async () => ({ data: true, error: null })) }
    const ownerSvc = createBusinessInfoService(ownerClient, storage)
    expect(await ownerSvc.checkOwnerAccess()).toEqual({ status: 'owner' })
    expect(await ownerSvc.isOwner()).toBe(true)

    const guestClient = { rpc: vi.fn(async () => ({ data: false, error: null })) }
    const guestSvc = createBusinessInfoService(guestClient, storage)
    expect(await guestSvc.checkOwnerAccess()).toEqual({ status: 'not_authorized' })
    expect(await guestSvc.isOwner()).toBe(false)

    const missingFnClient = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.is_owner without parameters' },
      })),
    }
    const missingFnSvc = createBusinessInfoService(missingFnClient, storage)
    expect(await missingFnSvc.checkOwnerAccess()).toMatchObject({ status: 'not_set_up' })
    expect(await missingFnSvc.isOwner()).toBe(false)

    const netErrClient = { rpc: vi.fn(async () => ({ data: null, error: { message: 'Failed to fetch' } })) }
    expect(await createBusinessInfoService(netErrClient, storage).checkOwnerAccess()).toMatchObject({
      status: 'unreachable',
    })
  })

  it('maps and caches service pricing modes (range, starting, varies) locally on pre-migration PGRST204', async () => {
    const storage = memoryStorage()
    const svcRows = [{ ...ROWS.services[0] }]
    const fakeClient = {
      from: vi.fn((table) => {
        const q = {
          _payload: null,
          select: () => q,
          eq: () => q,
          order: () => q,
          maybeSingle: () => ({
            ...q,
            then: (resolve) =>
              resolve({
                data: table === 'business_profile' ? ROWS.profile : table === 'services' ? svcRows : ROWS.settings,
                error: null,
              }),
          }),
          update: (payload) => {
            q._payload = payload
            return q
          },
          then: (resolve) => {
            if (q._payload && 'price_mode' in q._payload) {
              return resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'price_mode' column" } })
            }
            if (q._payload && table === 'services') Object.assign(svcRows[0], q._payload)
            return resolve({ data: [svcRows[0]], error: null })
          },
        }
        return q
      }),
    }

    const svc = createBusinessInfoService(fakeClient, storage)
    const saved = await svc.saveService('bridal', {
      name: 'Bridal Makeup (full)',
      price: 3500,
      price_mode: 'range',
      price_max: 5500,
      price_note: 'Depending on look',
      duration_minutes: 180,
    })
    expect(saved).toMatchObject({ ok: true, localExtended: true })

    const catalog = await svc.loadCatalog()
    const bridal = catalog.services.find((s) => s.key === 'bridal')
    expect(bridal.priceMode).toBe('range')
    expect(bridal.priceMax).toBe(5500)
    expect(bridal.priceNote).toBe('Depending on look')
  })

  it('maps salon media defaults when omitted and uses custom photo URLs when set', () => {
    const fallbackCatalog = toCatalog(ROWS)
    expect(fallbackCatalog.business.heroPhotoUrl).toMatch(/^https:\/\//)
    expect(fallbackCatalog.business.artistPhotoUrl).toMatch(/^https:\/\//)
    expect(fallbackCatalog.business.galleryUrls.length).toBeGreaterThanOrEqual(4)
    expect(fallbackCatalog.services[0].imageUrl).toMatch(/^https:\/\//)

    const customRows = {
      ...ROWS,
      profile: {
        ...ROWS.profile,
        hero_photo_url: 'https://example.com/custom-hero.jpg',
        artist_photo_url: 'https://example.com/custom-artist.jpg',
        gallery_urls: ['https://example.com/look-1.jpg', 'https://example.com/look-2.jpg'],
      },
      services: [
        { ...ROWS.services[0], image_url: 'https://example.com/custom-bridal.jpg' },
        ROWS.services[1],
      ],
    }

    const customCatalog = toCatalog(customRows)
    expect(customCatalog.business.heroPhotoUrl).toBe('https://example.com/custom-hero.jpg')
    expect(customCatalog.business.artistPhotoUrl).toBe('https://example.com/custom-artist.jpg')
    expect(customCatalog.business.galleryUrls).toEqual([
      'https://example.com/look-1.jpg',
      'https://example.com/look-2.jpg',
    ])
    expect(customCatalog.services[0].imageUrl).toBe('https://example.com/custom-bridal.jpg')

    const staleRows = {
      ...ROWS,
      services: [
        { ...ROWS.services[0], image_url: 'https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?w=800' },
        ROWS.services[1],
      ],
    }
    const healedCatalog = toCatalog(staleRows)
    expect(healedCatalog.services[0].imageUrl).not.toContain('photo-1512207736890-6ffed8a84e8d')
  })
})
