/**
 * Photo Worker validation tests — src/worker/validation.ts (ported as-is
 * from Wishora; only the origin allowlist changed for Valentine Week).
 * Covers magic bytes, size ceilings, the 14-day retention constant, photo
 * keys, cache control, origin rules and the in-memory rate limiter.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
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
} from '../src/worker/validation.ts'

const bytes = (arr) => new Uint8Array(arr)

test('retention and size ceilings match the Wishora contract', () => {
  assert.equal(MAX_PAYLOAD_BYTES, 3670016, '3.5 MB hard request ceiling')
  assert.equal(PHOTO_RETENTION_SECONDS, 14 * 86400, 'photos live exactly 14 days')
  assert.equal(MAX_BROWSER_CACHE_SECONDS, 86400, 'browser cache capped at 24h')
})

test('magic bytes accept JPG, PNG and WebP — and nothing else', () => {
  const jpeg = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
  assert.deepEqual(validateImageMagicBytes(jpeg), { valid: true, mimeType: 'image/jpeg' })

  const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  assert.deepEqual(validateImageMagicBytes(png), { valid: true, mimeType: 'image/png' })

  const webp = bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
  assert.deepEqual(validateImageMagicBytes(webp), { valid: true, mimeType: 'image/webp' })

  // ArrayBuffer input works too.
  assert.equal(validateImageMagicBytes(jpeg.buffer).valid, true)

  assert.deepEqual(validateImageMagicBytes(bytes([1, 2, 3])), {
    valid: false,
    error: 'Payload too small to be a valid image',
  })
  const random = validateImageMagicBytes(bytes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))
  assert.equal(random.valid, false)
  assert.match(random.error ?? '', /Only valid JPG, PNG, or WebP/)
})

test('magic bytes reject SVG/HTML/script payloads outright', () => {
  const svg = bytes([...'<svg xmlns="http://www.w3.org/2000/svg">'.split('').map((c) => c.charCodeAt(0))].slice(0, 32))
  const result = validateImageMagicBytes(svg)
  assert.equal(result.valid, false)
  assert.match(result.error ?? '', /strictly prohibited/)

  const html = bytes([...'<html><script>alert(1)</script>'.split('').map((c) => c.charCodeAt(0))].slice(0, 32))
  assert.equal(validateImageMagicBytes(html).valid, false)
})

test('photo keys are unguessable, URL-safe, and traversal-proof', () => {
  const key = generatePhotoKey()
  assert.match(key, /^ph_[0-9a-f]{32}$/)
  assert.equal(isValidPhotoKey(key), true)

  const another = generatePhotoKey()
  assert.notEqual(another, key, 'keys are random per call')

  assert.equal(isValidPhotoKey('ph_' + 'a'.repeat(20)), true, '20-char suffix is the minimum')
  assert.equal(isValidPhotoKey('ph_' + 'a'.repeat(19)), false)
  assert.equal(isValidPhotoKey('ph_' + 'a'.repeat(37)), false)
  assert.equal(isValidPhotoKey(''), false)
  assert.equal(isValidPhotoKey('../../etc/passwd'), false)
  assert.equal(isValidPhotoKey('ph_abc def'), false, 'no spaces')
  assert.equal(isValidPhotoKey('photo_12345678901234567890'), false, 'must start with ph_')
})

test('cache control tracks the 14-day lifetime and expires cleanly', () => {
  const now = 1_800_000_000_000
  const sevenDays = calculateCacheControl(now + 7 * 86400 * 1000, now)
  assert.equal(sevenDays.expired, false)
  assert.equal(sevenDays.remainingSeconds, 7 * 86400)
  assert.match(sevenDays.cacheControl, /max-age=86400/, 'browser cache capped at 24h')
  assert.match(sevenDays.cacheControl, /s-maxage=604800/, 'CDN cache matches remaining life')

  const oneHour = calculateCacheControl(now + 3600 * 1000, now)
  assert.match(oneHour.cacheControl, /max-age=3600/, 'short remaining life shortens browser cache too')

  const expired = calculateCacheControl(now - 1000, now)
  assert.deepEqual(expired, {
    cacheControl: 'no-store, no-cache, must-revalidate',
    remainingSeconds: 0,
    expired: true,
  })
})

test('upload origin: localhost and Valentine domains pass, strangers fail', () => {
  const headers = (entries) => new Headers(entries)
  const check = (requestUrl, origin, extra = {}) =>
    validateUploadOrigin({ requestUrl, headers: headers(origin ? { origin } : {}), ...extra })

  assert.deepEqual(check('http://localhost:8787/api/photos', 'http://localhost:5173'), { valid: true })
  assert.deepEqual(check('http://127.0.0.1:8787/api/photos', 'http://127.0.0.1:5173'), { valid: true })
  assert.deepEqual(
    check('https://aquira-valentine-week.pages.dev/api/photos', 'https://aquira-valentine-week.pages.dev'),
    { valid: true },
  )
  assert.deepEqual(
    check('https://rose-abc.aquira-valentine-week.pages.dev/api/photos', 'https://rose-abc.aquira-valentine-week.pages.dev'),
    { valid: true },
  )

  assert.equal(check('https://aquira-valentine-week.pages.dev/api/photos', 'https://evil.example.com').valid, false)
  assert.equal(check('https://aquira-valentine-week.pages.dev/api/photos', null).valid, false, 'origin header required')
  assert.equal(check('https://aquira-valentine-week.pages.dev/api/photos', 'null').valid, false, 'opaque origin forbidden')
  assert.equal(check('https://aquira-valentine-week.pages.dev/api/photos', 'not a url').valid, false, 'malformed origin')

  const crossSite = validateUploadOrigin({
    requestUrl: 'https://aquira-valentine-week.pages.dev/api/photos',
    headers: headers({ origin: 'https://aquira-valentine-week.pages.dev', 'sec-fetch-site': 'cross-site' }),
  })
  assert.equal(crossSite.valid, false, 'Sec-Fetch-Site cross-site is rejected even for a good origin')
})

test('in-memory rate limit allows a burst, then blocks', () => {
  resetInMemoryRateLimits()
  const ip = '203.0.113.7'
  for (let i = 0; i < 5; i++) {
    const result = checkInMemoryRateLimit(ip)
    assert.equal(result.allowed, true)
    assert.equal(result.remaining, 4 - i)
  }
  assert.deepEqual(checkInMemoryRateLimit(ip), { allowed: false, remaining: 0 })
  assert.equal(checkInMemoryRateLimit('198.51.100.9').allowed, true, 'limits are per IP')
  assert.deepEqual(checkInMemoryRateLimit(''), { allowed: true, remaining: 5 }, 'empty IP is not limited')
  resetInMemoryRateLimits()
})
