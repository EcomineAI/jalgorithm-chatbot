// Web Push sender (see supabase/migrations/20261118_session_messages_and_push.sql).
//
// Called by database triggers through pg_net. Requests must carry
//   Authorization: Bearer <CRON_SECRET>
//
// Body shapes:
//   { "type": "client_message", "message_id": "<uuid>" }    -> push to that booking's client devices
//   { "type": "owner_event", "event": "booked" | "cancelled" | "rescheduled", "appointment_id": "<uuid>" }
//                                                            -> push to owner devices
//
// Secrets to set (supabase secrets set ...):
//   CRON_SECRET          must match reminder_cron_secret in Vault
//   VAPID_PUBLIC_KEY     same value as VITE_VAPID_PUBLIC_KEY in the web app
//   VAPID_PRIVATE_KEY    generated with: npx web-push generate-vapid-keys
//   VAPID_SUBJECT        mailto: contact address for the push service, e.g. mailto:you@example.com
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Sub = { id: string; endpoint: string; p256dh: string; auth: string }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const expected = Deno.env.get('CRON_SECRET')
  if (!expected || req.headers.get('Authorization') !== `Bearer ${expected}`) {
    return json({ error: 'unauthorized' }, 401)
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!publicKey || !privateKey || !subject) return json({ error: 'push is not configured' }, 500)
  webpush.setVapidDetails(subject, publicKey, privateKey)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const payload = await req.json().catch(() => null)
  if (!payload || typeof payload.type !== 'string') return json({ error: 'bad request' }, 400)

  let audience: 'owner' | 'client'
  let referenceCode: string | null = null
  let notification: { title: string; body: string; url: string; tag: string }

  if (payload.type === 'client_message') {
    const { data: msg, error } = await supabase
      .from('client_messages')
      .select('id, body, reference_code')
      .eq('id', payload.message_id)
      .maybeSingle()
    if (error || !msg) return json({ error: 'message not found' }, 404)
    audience = 'client'
    referenceCode = msg.reference_code
    notification = {
      title: 'New reminder',
      body: String(msg.body).slice(0, 160),
      url: '/chat',
      tag: `msg-${msg.id}`,
    }
  } else if (payload.type === 'owner_event') {
    const { data: appt, error } = await supabase
      .from('appointments')
      .select('id, client_name, service_type, appointment_date, reference_code')
      .eq('id', payload.appointment_id)
      .maybeSingle()
    if (error || !appt) return json({ error: 'appointment not found' }, 404)
    const when = new Date(appt.appointment_date).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    const titles: Record<string, string> = {
      booked: 'New booking',
      cancelled: 'Booking cancelled',
      rescheduled: 'Booking rescheduled',
    }
    audience = 'owner'
    notification = {
      title: titles[payload.event] ?? 'Booking update',
      body: `${appt.client_name} · ${appt.service_type} · ${when}`,
      url: '/owner',
      tag: `appt-${appt.id}-${payload.event}`,
    }
  } else {
    return json({ error: 'unknown type' }, 400)
  }

  let query = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('audience', audience)
  if (audience === 'client') query = query.eq('reference_code', referenceCode)
  const { data: subs, error: subsError } = await query
  if (subsError) return json({ error: subsError.message }, 500)

  let sent = 0
  let removed = 0
  for (const sub of (subs ?? []) as Sub[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(notification),
      )
      sent += 1
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // The browser revoked or expired this subscription.
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        removed += 1
      } else {
        await supabase
          .from('push_subscriptions')
          .update({ last_error: String((err as Error).message ?? err).slice(0, 300) })
          .eq('id', sub.id)
      }
    }
  }

  return json({ devices: (subs ?? []).length, sent, removed })
})
