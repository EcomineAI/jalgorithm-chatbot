import { describe, it, expect } from 'vitest'
import { isLocalDevHost, sanitizeImageUrl } from '../src/lib/mediaUpload.js'

describe('isLocalDevHost', () => {
  it('allows localhost and loopback hosts in non-dev builds', () => {
    expect(isLocalDevHost({ dev: false, hostname: 'localhost' })).toBe(true)
    expect(isLocalDevHost({ dev: false, hostname: '127.0.0.1' })).toBe(true)
    expect(isLocalDevHost({ dev: false, hostname: '::1' })).toBe(true)
    expect(isLocalDevHost({ dev: false, hostname: 'LOCALHOST' })).toBe(true)
  })

  it('blocks public domains in non-dev builds', () => {
    expect(isLocalDevHost({ dev: false, hostname: 'vickys-parlor.vercel.app' })).toBe(false)
    expect(isLocalDevHost({ dev: false, hostname: 'trevlunamakeup.com' })).toBe(false)
    expect(isLocalDevHost({ dev: false, hostname: '' })).toBe(false)
  })

  it('allows any hostname when Vite dev mode is active', () => {
    expect(isLocalDevHost({ dev: true, hostname: 'example.com' })).toBe(true)
  })
})

describe('sanitizeImageUrl', () => {
  it('accepts safe http/https URLs and raster data URLs', () => {
    expect(sanitizeImageUrl('  https://images.unsplash.com/photo-123.jpg  ')).toBe(
      'https://images.unsplash.com/photo-123.jpg'
    )
    expect(sanitizeImageUrl('http://localhost:5173/hero.png')).toBe('http://localhost:5173/hero.png')
    expect(sanitizeImageUrl('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA')
    expect(sanitizeImageUrl('data:image/webp;base64,BBBB')).toBe('data:image/webp;base64,BBBB')
  })

  it('rejects empty values and unsafe schemes such as javascript or svg', () => {
    expect(sanitizeImageUrl('')).toBe('')
    expect(sanitizeImageUrl(null)).toBe('')
    expect(sanitizeImageUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeImageUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe('')
  })
})
