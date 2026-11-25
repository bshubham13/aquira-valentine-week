/**
 * AquiraCraft Valentine Week Photo Edge Worker
 * Handles bounded 14-day photo uploads and retrieval backed by Cloudflare Workers KV.
 * Falls back to Cloudflare Static Assets for all application routes.
 * Ported as-is from Wishora (birthday-experience) — only the KV binding name
 * (WISHORA_PHOTOS → VALENTINE_PHOTOS) and the expiry header changed.
 */

import {
  MAX_PAYLOAD_BYTES,
  PHOTO_RETENTION_SECONDS,
  validateImageMagicBytes,
  validateUploadOrigin,
  generatePhotoKey,
  isValidPhotoKey,
  calculateCacheControl,
  checkInMemoryRateLimit,
} from './validation'

export interface PhotoMetadata {
  uploadedAt: number
  expiresAt: number
  mimeType: string
  sizeBytes: number
  [key: string]: unknown
}

export interface Env {
  VALENTINE_PHOTOS?: {
    put(
      key: string,
      value: ArrayBuffer | ReadableStream | string,
      options?: { expirationTtl?: number; metadata?: Record<string, unknown> },
    ): Promise<void>
    getWithMetadata<T = Record<string, unknown>>(
      key: string,
      type: 'arrayBuffer',
    ): Promise<{ value: ArrayBuffer | null; metadata: T | null }>
    delete(key: string): Promise<void>
  }
  ASSETS?: {
    fetch(request: Request): Promise<Response>
  }
}

/**
 * Handles binary and multipart photo uploads.
 */
async function handlePhotoUpload(request: Request, env: Env): Promise<Response> {
  if (!env.VALENTINE_PHOTOS) {
    return new Response(JSON.stringify({ ok: false, error: 'KV storage binding not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 1. Origin verification
  const originCheck = validateUploadOrigin({
    requestUrl: request.url,
    headers: request.headers,
  })
  if (!originCheck.valid) {
    return new Response(JSON.stringify({ ok: false, error: originCheck.error }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. In-memory IP burst rate limit (Zero KV operations)
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown'
  const rateLimit = checkInMemoryRateLimit(clientIp, 8, 300000) // 8 uploads / 5 min
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Upload rate limit reached. Please wait a few minutes' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '300',
      },
    })
  }

  // 3. Payload size check
  const contentLengthHeader = request.headers.get('content-length')
  if (contentLengthHeader) {
    const declaredLength = parseInt(contentLengthHeader, 10)
    if (!isNaN(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ ok: false, error: `Photo exceeds ${MAX_PAYLOAD_BYTES / 1024} KB limit` }),
        { status: 413, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  // 4. Extract binary data (supports both multipart and raw binary octet-stream)
  let rawBuffer: ArrayBuffer
  const contentType = request.headers.get('content-type') || ''

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const fileEntry = formData.get('photo') || formData.get('file')
      if (!fileEntry || !(fileEntry instanceof Blob)) {
        return new Response(JSON.stringify({ ok: false, error: 'No photo file attached in form data' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      rawBuffer = await fileEntry.arrayBuffer()
    } else {
      rawBuffer = await request.arrayBuffer()
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Failed to read upload body stream' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 5. Enforce hard binary ceiling
  if (rawBuffer.byteLength > MAX_PAYLOAD_BYTES) {
    return new Response(
      JSON.stringify({ ok: false, error: `Photo exceeds ${MAX_PAYLOAD_BYTES / 1024} KB limit` }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 6. Magic bytes verification
  const magicCheck = validateImageMagicBytes(rawBuffer)
  if (!magicCheck.valid || !magicCheck.mimeType) {
    return new Response(JSON.stringify({ ok: false, error: magicCheck.error }), {
      status: 415,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 7. Store in KV with 14-day TTL
  const photoKey = generatePhotoKey()
  const now = Date.now()
  const expiresAt = now + PHOTO_RETENTION_SECONDS * 1000

  const metadata: PhotoMetadata = {
    uploadedAt: now,
    expiresAt,
    mimeType: magicCheck.mimeType,
    sizeBytes: rawBuffer.byteLength,
  }

  try {
    await env.VALENTINE_PHOTOS.put(photoKey, rawBuffer, {
      expirationTtl: PHOTO_RETENTION_SECONDS,
      metadata,
    })
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Storage operation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      ok: true,
      photoKey,
      mimeType: magicCheck.mimeType,
      sizeBytes: rawBuffer.byteLength,
      expiresAt,
    }),
    {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  )
}

/**
 * Handles photo retrieval with TTL-bounded caching.
 */
async function handlePhotoGet(_request: Request, env: Env, key: string): Promise<Response> {
  if (!env.VALENTINE_PHOTOS) {
    return new Response('KV storage binding not configured', { status: 503 })
  }

  if (!isValidPhotoKey(key)) {
    return new Response('Invalid photo identifier', { status: 400 })
  }

  let entry
  try {
    entry = await env.VALENTINE_PHOTOS.getWithMetadata<PhotoMetadata>(key, 'arrayBuffer')
  } catch {
    return new Response('Storage retrieval error', { status: 500 })
  }

  const { value, metadata } = entry

  if (!value || !metadata) {
    return new Response('Photo not found or expired', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Calculate dynamic TTL-aligned cache control
  const cacheInfo = calculateCacheControl(metadata.expiresAt)

  if (cacheInfo.expired) {
    return new Response('Photo has expired', {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return new Response(value, {
    status: 200,
    headers: {
      'Content-Type': metadata.mimeType || 'image/webp',
      'Content-Length': value.byteLength.toString(),
      'Cache-Control': cacheInfo.cacheControl,
      'X-Aquira-Expires-At': new Date(metadata.expiresAt).toISOString(),
    },
  })
}

export {
  MAX_PAYLOAD_BYTES,
  PHOTO_RETENTION_SECONDS,
  MAX_BROWSER_CACHE_SECONDS,
  validateImageMagicBytes,
  validateUploadOrigin,
  generatePhotoKey,
  isValidPhotoKey,
  calculateCacheControl,
  checkInMemoryRateLimit,
  resetInMemoryRateLimits,
} from './validation'

export async function handleFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Route: POST /api/photos/upload
  if (pathname === '/api/photos/upload' && request.method === 'POST') {
    return handlePhotoUpload(request, env)
  }

  // Route: GET /api/photos/:key
  if (pathname.startsWith('/api/photos/') && request.method === 'GET') {
    const key = pathname.replace('/api/photos/', '').trim()
    return handlePhotoGet(request, env, key)
  }

  // Method not allowed on API endpoints
  if (pathname.startsWith('/api/photos/')) {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Static assets fallback (SPA routing)
  if (env.ASSETS) {
    return env.ASSETS.fetch(request)
  }

  return new Response('Not Found', { status: 404 })
}

export default {
  fetch: handleFetch,
}
