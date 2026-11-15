import { describe, it, expect } from 'vitest'
import {
  buildGoogleMapsUrl,
  buildGoogleCalendarUrl,
  computeOwnerPrepSummary,
  buildClientReminderText,
  daysUntilManila,
  toManilaDateTime,
} from '../src/lib/calendarLinks.js'

describe('buildGoogleMapsUrl', () => {
  it('encodes venue addresses into a Google Maps search URL', () => {
    expect(buildGoogleMapsUrl('Subic Bay Yacht Club, Olongapo')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Subic%20Bay%20Yacht%20Club%2C%20Olongapo'
    )
  })

  it('returns null for blank venues', () => {
    expect(buildGoogleMapsUrl('')).toBeNull()
    expect(buildGoogleMapsUrl('   ')).toBeNull()
    expect(buildGoogleMapsUrl(null)).toBeNull()
  })
})

describe('buildGoogleCalendarUrl', () => {
  it('builds a Manila-timezone event template URL from date and time', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Bridal Makeup - Maria (JAL-7K3QX)',
      startIsoDate: '2026-11-20',
      startTime: '10:00',
      durationMinutes: 180,
      location: 'Olongapo City',
      description: 'Ref: JAL-7K3QX',
    })
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE')
    expect(parsed.searchParams.get('dates')).toBe('20261120T100000/20261120T130000')
    expect(parsed.searchParams.get('ctz')).toBe('Asia/Manila')
    expect(parsed.searchParams.get('location')).toBe('Olongapo City')
  })

  it('converts UTC timestampIso values into Asia/Manila time', () => {
    // 2026-11-20 02:00Z == 2026-11-20 10:00 Manila
    expect(toManilaDateTime('2026-11-20T02:00:00Z')).toEqual({ date: '2026-11-20', time: '10:00' })
    const url = buildGoogleCalendarUrl({
      title: 'Hairstyling',
      timestampIso: '2026-11-20T02:00:00Z',
      durationMinutes: 60,
    })
    expect(new URL(url).searchParams.get('dates')).toBe('20261120T100000/20261120T110000')
  })
})

describe('computeOwnerPrepSummary', () => {
  it('assigns 1 hr buffer for inclusive local Subic Bay / Olongapo venues and 2 hrs for Clark', () => {
    const localPrep = computeOwnerPrepSummary({
      service_type: 'Bridal Makeup (Full Package)',
      client_name: 'Ana Cruz',
      reference_code: 'JAL-11111',
      date: '2026-11-20',
      time: '08:00',
      duration_minutes: 180,
      event_location: 'Subic Bay Harbor Hotel',
    })
    expect(localPrep.callTimeFormatted).toBe('8:00 AM')
    expect(localPrep.leaveTimeFormatted).toBe('7:00 AM')
    expect(localPrep.mapsUrl).toContain('Subic%20Bay%20Harbor%20Hotel')
    expect(localPrep.calendarUrl).toContain('calendar.google.com/calendar/render')

    const clarkPrep = computeOwnerPrepSummary({
      service_type: 'Event / Debut Makeup',
      client_name: 'Bea Reyes',
      date: '2026-11-22',
      time: '09:00',
      event_location: 'Clark Marriott Hotel, Pampanga',
    })
    expect(clarkPrep.callTimeFormatted).toBe('9:00 AM')
    expect(clarkPrep.leaveTimeFormatted).toBe('7:00 AM')
    expect(clarkPrep.prepLabel).toMatch(/2 hrs out-of-town/)
  })
})

describe('buildClientReminderText & daysUntilManila', () => {
  it('formats a confirmation reminder message with ref code and venue', () => {
    const text = buildClientReminderText(
      {
        client_name: 'Maria Santos',
        service_type: 'Bridal Makeup (Full Package)',
        date: '2026-11-20',
        time: '10:00',
        event_location: 'Olongapo City',
        reference_code: 'JAL-7K3QX',
      },
      'Makeup and Hair by Trev Luna'
    )
    expect(text).toContain('Maria Santos')
    expect(text).toContain('Makeup and Hair by Trev Luna')
    expect(text).toContain('Bridal Makeup (Full Package)')
    expect(text).toContain('Nov 20, 2026')
    expect(text).toContain('10:00 AM')
    expect(text).toContain('Olongapo City')
    expect(text).toContain('JAL-7K3QX')
  })

  it('computes Manila day offsets accurately', () => {
    const now = new Date('2026-11-19T17:00:00Z') // Nov 20 01:00 Manila
    expect(daysUntilManila('2026-11-20', now)).toBe(0)
    expect(daysUntilManila('2026-11-21', now)).toBe(1)
    expect(daysUntilManila('2026-11-22', now)).toBe(2)
  })
})
