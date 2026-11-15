// Sends queued 3-day client reminders (see supabase/migrations/20261117_auto_reminders.sql).
//
// Called once a day by pg_cron through pg_net. Requests must carry
//   Authorization: Bearer <CRON_SECRET>
//
// Secrets to set (supabase secrets set ...):
//   CRON_SECRET        must match the reminder_cron_secret in Vault
//   SMS_GATEWAY_URL    HTTPS endpoint of the SMS provider you choose
//   SMS_GATEWAY_KEY    API key for that provider
//   SMS_SENDER_NAME    optional sender ID shown to the client
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// The gateway request below is a generic JSON POST: { to, message, sender }.
// Edit sendSms() to match the provider's real API before going live.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MAX_ATTEMPTS = 3
const BATCH_SIZE = 100

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function sendSms(to: string, message: string): Promise<void> {
  const url = Deno.env.get('SMS_GATEWAY_URL')
  const key = Deno.env.get('SMS_GATEWAY_KEY')
  if (!url || !key) throw new Error('SMS gateway is not configured')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      to,
      message,
      sender: Deno.env.get('SMS_SENDER_NAME') || undefined,
    }),
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200)
    throw new Error(`gateway ${res.status}: ${detail}`)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const expected = Deno.env.get('CRON_SECRET')
  if (!expected || req.headers.get('Authorization') !== `Bearer ${expected}`) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: rows, error } = await supabase
    .from('reminder_queue')
    .select('id, recipient, message, attempts, scheduled_for, appointment_id, appointments(status, reminder_sent, appointment_date, reference_code)')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('queued_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) return json({ error: error.message }, 500)

  const counts = { sent: 0, skipped: 0, failed: 0 }

  for (const row of rows ?? []) {
    const appt = row.appointments as {
      status: string
      reminder_sent: boolean
      appointment_date: string
      reference_code: string | null
    } | null

    // Skip if the booking changed, was cancelled, or the owner already marked it sent.
    const stillValid =
      appt &&
      ['confirmed', 'rescheduled'].includes(appt.status) &&
      !appt.reminder_sent &&
      new Date(appt.appointment_date).getTime() === new Date(row.scheduled_for).getTime()

    if (!stillValid || !row.recipient) {
      await supabase
        .from('reminder_queue')
        .update({
          status: 'skipped',
          last_error: !row.recipient ? 'no valid mobile number' : 'booking changed or already handled',
        })
        .eq('id', row.id)
      counts.skipped += 1
      continue
    }

    try {
      await sendSms(row.recipient, row.message)
      const now = new Date().toISOString()
      await supabase
        .from('reminder_queue')
        .update({ status: 'sent', sent_at: now, attempts: row.attempts + 1, last_error: null })
        .eq('id', row.id)
      await supabase
        .from('appointments')
        .update({ reminder_sent: true, reminder_sent_at: now })
        .eq('id', row.appointment_id)
      // Also post the same reminder into the client's chat session (this fires the push trigger).
      if (appt?.reference_code) {
        await supabase.from('client_messages').insert({
          appointment_id: row.appointment_id,
          reference_code: appt.reference_code,
          body: row.message,
        })
      }
      counts.sent += 1
    } catch (err) {
      const attempts = row.attempts + 1
      await supabase
        .from('reminder_queue')
        .update({
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          last_error: String((err as Error).message ?? err).slice(0, 300),
        })
        .eq('id', row.id)
      counts.failed += 1
    }
  }

  return json({ processed: (rows ?? []).length, ...counts })
})
