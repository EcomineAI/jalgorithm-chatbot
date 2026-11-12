import { describe, it, expect, vi } from 'vitest'
import { createAppointmentService } from '../src/services/appointments.js'

const clientReturning = (response) => ({ rpc: vi.fn(async () => response) })

describe('appointment service (Supabase RPC adapter)', () => {
  it('passes parameters to the right functions', async () => {
    const client = clientReturning({ data: { ok: true, slots: ['09:00'] }, error: null })
    const svc = createAppointmentService(client)
    await svc.getAvailableSlots({ date: '2026-11-20', serviceKey: 'bridal' })
    expect(client.rpc).toHaveBeenCalledWith('jal_available_slots', { p_date: '2026-11-20', p_service_key: 'bridal' })
    await svc.bookAppointment({ serviceKey: 'bridal', date: '2026-11-20', time: '10:00', name: 'Ana', contact: '09171234567' })
    expect(client.rpc).toHaveBeenLastCalledWith('jal_book', {
      p_service_key: 'bridal', p_date: '2026-11-20', p_time: '10:00', p_name: 'Ana', p_contact: '09171234567', p_location: null,
    })
    await svc.findAppointment({ reference: 'JAL-7K3QX', contact: '09171234567' })
    expect(client.rpc).toHaveBeenLastCalledWith('jal_find', { p_reference: 'JAL-7K3QX', p_contact: '09171234567' })
    await svc.rescheduleAppointment({ reference: 'JAL-7K3QX', contact: '0917', date: '2026-11-21', time: '14:00' })
    expect(client.rpc).toHaveBeenLastCalledWith('jal_reschedule', { p_reference: 'JAL-7K3QX', p_contact: '0917', p_date: '2026-11-21', p_time: '14:00' })
    await svc.cancelAppointment({ reference: 'JAL-7K3QX', contact: '0917' })
    expect(client.rpc).toHaveBeenLastCalledWith('jal_cancel', { p_reference: 'JAL-7K3QX', p_contact: '0917' })
  })

  it('unwraps successful results', async () => {
    const svc = createAppointmentService(clientReturning({ data: { ok: true, slots: ['09:00', '10:00'], date: '2026-11-20' }, error: null }))
    expect(await svc.getAvailableSlots({ date: '2026-11-20' })).toEqual({ ok: true, data: { slots: ['09:00', '10:00'], date: '2026-11-20' } })
  })

  it('passes business-rule rejections through as reason codes', async () => {
    const svc = createAppointmentService(clientReturning({ data: { ok: false, reason: 'too_soon', min_date: '2026-11-15' }, error: null }))
    expect(await svc.getAvailableSlots({ date: '2026-11-13' })).toEqual({ ok: false, reason: 'too_soon', data: { min_date: '2026-11-15' } })
  })

  it('maps network failures and a missing migration to "unreachable"', async () => {
    const thrower = { rpc: vi.fn(async () => { throw new TypeError('Failed to fetch') }) }
    expect(await createAppointmentService(thrower).findAppointment({})).toMatchObject({ ok: false, reason: 'unreachable' })
    const fetchErr = clientReturning({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } })
    expect(await createAppointmentService(fetchErr).cancelAppointment({})).toMatchObject({ ok: false, reason: 'unreachable' })
    const missing = clientReturning({ data: null, error: { message: 'Could not find the function', code: 'PGRST202' } })
    expect(await createAppointmentService(missing).cancelAppointment({})).toMatchObject({ ok: false, reason: 'unreachable' })
    expect(await createAppointmentService(null).cancelAppointment({})).toMatchObject({ ok: false, reason: 'unreachable' })
  })

  it('maps database errors to "error" and never to success', async () => {
    const svc = createAppointmentService(clientReturning({ data: null, error: { message: 'permission denied', code: '42501' } }))
    expect(await svc.bookAppointment({})).toMatchObject({ ok: false, reason: 'error' })
    const empty = createAppointmentService(clientReturning({ data: null, error: null }))
    expect(await empty.bookAppointment({})).toEqual({ ok: false, reason: 'error' })
  })
})
