// Browser helpers for salon photo compression/uploads and local-only Dev Studio checks.

export function isLocalDevHost({ dev, hostname } = {}) {
  const isDev =
    typeof dev === 'boolean'
      ? dev
      : Boolean(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV)
  const host =
    typeof hostname === 'string'
      ? hostname
      : typeof window !== 'undefined' && window.location
        ? window.location.hostname
        : ''
  const normalized = host.trim().toLowerCase()
  const isLoopback = normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]'
  return Boolean(isDev || isLoopback)
}

export function sanitizeImageUrl(url) {
  const clean = String(url ?? '').trim()
  if (!clean) return ''
  if (/^https?:\/\//i.test(clean) || /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(clean)) {
    return clean
  }
  return ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the selected image file.'))
    reader.readAsDataURL(file)
  })
}

export async function compressImageFile(file, { maxWidth = 1200, quality = 0.8 } = {}) {
  if (!file || typeof file !== 'object') throw new Error('No file selected.')
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Please choose a JPG, PNG, or WebP image file.')
  }

  const rawDataUrl = await readFileAsDataUrl(file)
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { dataUrl: rawDataUrl, blob: file }
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve({ dataUrl: rawDataUrl, blob: file })
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      canvas.toBlob(
        (blob) => resolve({ dataUrl, blob: blob || file }),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => resolve({ dataUrl: rawDataUrl, blob: file })
    img.src = rawDataUrl
  })
}

export async function uploadSalonImage(client, file, folder = 'gallery') {
  const { dataUrl, blob } = await compressImageFile(file)
  const cleanFolder = String(folder || 'gallery').replace(/[^a-z0-9_-]/gi, '') || 'gallery'
  const filePath = `${cleanFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`

  if (!client?.storage?.from) {
    return { ok: true, url: dataUrl, fallback: true }
  }

  try {
    const bucket = client.storage.from('salon-media')
    const { error } = await bucket.upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })
    if (error) {
      return { ok: true, url: dataUrl, fallback: true, warning: error.message }
    }
    const { data } = bucket.getPublicUrl(filePath)
    return {
      ok: true,
      url: data?.publicUrl || dataUrl,
      fallback: !data?.publicUrl,
    }
  } catch (e) {
    return { ok: true, url: dataUrl, fallback: true, warning: e?.message || 'Storage offline' }
  }
}
