// Appointment service: the application layer JAlgorithm's dialogue manager calls.
// All business rules (working hours, 3-day advance notice, overlaps, 24-hour cutoff,
// reference + mobile ownership check) are enforced by the Supabase functions in
// supabase/migrations/20261112_jalgorithm.sql. This module only calls them and
// normalizes every outcome to { ok, reason?, data? } so the bot never reports a
// success that did not happen.
//
// Requires an internet connection to Supabase. When it is unreachable every call
// resolves to { ok: false, reason: 'unreachable' } instead of throwing.

const NETWORK_ERROR = /fetch|network|failed to|load failed|timeout|ECONN|ENOTFOUND/i

export function createAppointmentService(client) {
  async function rpc(fn, params) {
    if (!client) return { ok: false, reason: 'unreachable' }
    let response
    try {
      response = await client.rpc(fn, params)
    } catch (err) {
      return { ok: false, reason: NETWORK_ERROR.test(String(err?.message ?? err)) ? 'unreachable' : 'error' }
    }
    const { data, error } = response ?? {}
    if (error) {
      const msg = `${error.message ?? ''} ${error.details ?? ''}`
      // PGRST202 = function not found (migration not applied yet)
      if (NETWORK_ERROR.test(msg) || error.code === 'PGRST202' || !error.code) return { ok: false, reason: 'unreachable', error: msg.trim() }
      return { ok: false, reason: 'error', error: msg.trim() }
    }
    if (!data || typeof data !== 'object') return { ok: false, reason: 'error' }
    const { ok, reason, ...rest } = data
    return ok ? { ok: true, data: rest } : { ok: false, reason: reason ?? 'error', data: rest }
  }

  return {
    getAvailableSlots: ({ date, serviceKey = null }) =>
      rpc('jal_available_slots', { p_date: date, p_service_key: serviceKey }),

    bookAppointment: ({ serviceKey, date, time, name, contact, location = null }) =>
      rpc('jal_book', {
        p_service_key: serviceKey, p_date: date, p_time: time, p_name: name, p_contact: contact, p_location: location,
      }),

    findAppointment: ({ reference, contact }) =>
      rpc('jal_find', { p_reference: reference, p_contact: contact }),

    rescheduleAppointment: ({ reference, contact, date, time }) =>
      rpc('jal_reschedule', { p_reference: reference, p_contact: contact, p_date: date, p_time: time }),

    cancelAppointment: ({ reference, contact }) =>
      rpc('jal_cancel', { p_reference: reference, p_contact: contact }),
  }
}
