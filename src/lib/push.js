// Browser side of Web Push: asks for notification permission, registers /sw.js,
// and saves this device's subscription in Supabase so the notify function can reach it.
//
// Requires VITE_VAPID_PUBLIC_KEY (the public half of the VAPID key pair).
// Browsers only allow the permission prompt after a tap, so call these from a button.
// iPhone: web push works only after the site is added to the Home Screen (iOS 16.4+).

import { supabase } from './supabase.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function pushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY)
}

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export function currentPermission() {
  return pushSupported() ? Notification.permission : 'unsupported'
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function subscribeThisDevice() {
  if (!pushSupported()) {
    throw new Error(
      'Notifications are not supported in this browser. On iPhone, add this site to your Home Screen first.',
    )
  }
  if (!pushConfigured()) {
    throw new Error('Notifications are not set up for this site yet.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted. You can allow it in the browser settings.')
  }

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    })
  }

  const json = subscription.toJSON()
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }
}

/** Owner: this device gets a notification for every new, cancelled or rescheduled booking. */
export async function enableOwnerAlerts() {
  const sub = await subscribeThisDevice()
  const { error } = await supabase.rpc('jal_register_owner_push', {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
  })
  if (error) throw new Error(error.message)
  return true
}

/**
 * Client: this device gets a notification when the studio posts a reminder for the bookings
 * in `pairs` ([{ reference, contact }]). Each pair is checked on the server.
 */
export async function enableClientAlerts(pairs) {
  if (!pairs.length) {
    throw new Error('Start a booking chat first, so there is a booking code and mobile number to link.')
  }

  const sub = await subscribeThisDevice()
  let linked = 0
  for (const { reference, contact } of pairs) {
    const { data, error } = await supabase.rpc('jal_register_client_push', {
      p_endpoint: sub.endpoint,
      p_p256dh: sub.p256dh,
      p_auth: sub.auth,
      p_ref: reference,
      p_contact: contact,
    })
    if (!error && data) linked += 1
  }

  if (!linked) throw new Error('This device could not be linked to your booking. Check the code and mobile number.')
  return linked
}
