import { describe, it, expect, vi } from 'vitest'
import { createBusinessInfoService, toCatalog, serviceKeyFromName } from '../src/services/businessInfo.js'
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
