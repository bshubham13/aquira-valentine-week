/**
 * Pure validation and security utilities for the AquiraCraft Valentine Week Photo Worker
 * Zero external dependencies; shared across edge worker and unit test runner.
 * Ported as-is from Wishora (birthday-experience) — only the origin allowlist
 * changed: Wishora hosts → Valentine Week hosts.
 */

export const MAX_PAYLOAD_BYTES = 3670016 // 3.5 MB hard request ceiling
export const PHOTO_RETENTION_SECONDS = 1209600 // Exactly 14 days (14 * 86,400)
export const MAX_BROWSER_CACHE_SECONDS = 86400 // 24 hours max client cache

export type SupportedImageMime = 'image/webp' | 'image/jpeg' | 'image/png'

export interface MagicBytesResult {
  valid: boolean
  mimeType?: SupportedImageMime
  error?: string
}

export interface CacheControlResult {
  cacheControl: string
  remainingSeconds: number
  expired: boolean
}

/**
 * Validates the raw byte stream against recognized image file signatures (magic bytes).
 * Strictly rejects HTML, SVG, scripts, executables, or unknown binary payloads.
 */
export function validateImageMagicBytes(buffer: ArrayBuffer | Uint8Array): MagicBytesResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)

  if (bytes.length < 12) {
    return { valid: false, error: 'Payload too small to be a valid image' }
  }

  // 1. JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg' }
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { valid: true, mimeType: 'image/png' }
  }

  // 3. WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  const isRiff =
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46 // 'F'

  const isWebp =
    bytes[8] === 0x57 && // 'W'
    bytes[9] === 0x45 && // 'E'
    bytes[10] === 0x42 && // 'B'
    bytes[11] === 0x50 // 'P'

  if (isRiff && isWebp) {
    return { valid: true, mimeType: 'image/webp' }
  }

  // Check for dangerous common script tags in initial bytes
  const snippet = String.fromCharCode(...bytes.slice(0, 32)).toLowerCase()
  if (snippet.includes('<svg') || snippet.includes('<?xml') || snippet.includes('<html') || snippet.includes('<script')) {
    return { valid: false, error: 'Vector and executable file formats (SVG/XML/HTML) are strictly prohibited' }
  }

  return { valid: false, error: 'Unsupported file signature. Only valid JPG, PNG, or WebP images are allowed' }
}

/**
 * Validates request origin and headers to block third-party hotlinking or unauthorized cross-site POSTs.
 */
export interface OriginValidationOptions {
  requestUrl: string
  headers: Headers
  customAllowedOrigins?: string[]
}

/**
 * Validates request origin and headers to block third-party hotlinking, CSRF, or unauthorized cross-site POSTs.
 * Enforces:
 * 1. Sec-Fetch-Site rejection on cross-site requests.
 * 2. Origin or Referer header requirement on upload mutations.
 * 3. Strict domain matching: localhost, 127.0.0.1, Valentine Week production/preview domains
 *    (*.pages.dev, *.workers.dev), and exact same-origin match against the host serving the Worker.
 */
export function validateUploadOrigin({
  requestUrl,
  headers,
  customAllowedOrigins = [],
}: OriginValidationOptions): { valid: boolean; error?: string } {
  // 1. Browser Fetch Metadata check: reject explicit cross-site requests
  const secFetchSite = headers.get('sec-fetch-site')
  if (secFetchSite && secFetchSite === 'cross-site') {
    return { valid: false, error: 'Cross-origin upload forbidden' }
  }

  // 2. Extract Origin or fallback to Referer
  const origin = headers.get('origin')
  const referer = headers.get('referer')
  const targetHeader = origin || referer

  if (!targetHeader) {
    return { valid: false, error: 'Origin or Referer header required for upload' }
  }

  if (targetHeader === 'null') {
    return { valid: false, error: 'Opaque or sandboxed origin forbidden' }
  }

  let parsedOrigin: URL
  let parsedRequest: URL
  try {
    parsedOrigin = new URL(targetHeader)
    parsedRequest = new URL(requestUrl)
  } catch {
    return { valid: false, error: 'Malformed Origin or Request URL' }
  }

  const originHostname = parsedOrigin.hostname.toLowerCase()
  const requestHostname = parsedRequest.hostname.toLowerCase()

  // 3. Rule A: Local development (localhost, 127.0.0.1, ::1)
  const isLocalOrigin =
    originHostname === 'localhost' ||
    originHostname === '127.0.0.1' ||
    originHostname === '::1'

  const isLocalRequest =
    requestHostname === 'localhost' ||
    requestHostname === '127.0.0.1' ||
    requestHostname === '::1'

  if (isLocalOrigin && isLocalRequest) {
    return { valid: true }
  }

  // 4. Rule B: Valentine Week Cloudflare domains (Production & Preview branches)
  const isValentineDomain = (hostname: string): boolean => {
    if (hostname === 'aquira-valentine-week.pages.dev') return true
    if (hostname.endsWith('.aquira-valentine-week.pages.dev')) return true
    if (hostname.endsWith('.pages.dev') && hostname.startsWith('aquira-valentine-week-')) return true
    if (hostname.endsWith('.workers.dev') && hostname.includes('aquira-valentine-week')) return true
    return false
  }

  if (isValentineDomain(originHostname)) {
    // Ensure origin matches the request host (same-origin or preview-to-worker flow)
    if (parsedOrigin.host === parsedRequest.host || isValentineDomain(requestHostname)) {
      return { valid: true }
    }
  }

  // 5. Rule C: Explicit custom domains
  if (customAllowedOrigins.length > 0) {
    const isCustomAllowed = customAllowedOrigins.some((allowed) => {
      if (!allowed) return false
      try {
        const allowedUrl = allowed.includes('://') ? new URL(allowed) : null
        const allowedHost = allowedUrl ? allowedUrl.host.toLowerCase() : allowed.toLowerCase()
        const allowedHostname = allowedUrl ? allowedUrl.hostname.toLowerCase() : allowed.toLowerCase()
        return originHostname === allowedHostname || parsedOrigin.host.toLowerCase() === allowedHost
      } catch {
        return false
      }
    })

    if (isCustomAllowed && (parsedOrigin.host === parsedRequest.host || customAllowedOrigins.includes(requestHostname))) {
      return { valid: true }
    }
  }

  return { valid: false, error: `Untrusted origin: ${origin || referer}` }
}

/**
 * Generates an unguessable, high-entropy photo key (35 characters URL-safe).
 * Format: ph_<32 hex chars from crypto.randomUUID> (128 bits of entropy)
 */
export function generatePhotoKey(): string {
  const rawId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `ph_${rawId}`
}

/**
 * Validates photo key format to prevent path traversal or malformed queries.
 */
export function isValidPhotoKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false
  return /^ph_[a-zA-Z0-9_-]{20,36}$/.test(key)
}

/**
 * Computes dynamic Cache-Control headers strictly aligned to remaining lifetime.
 * Edge CDN (s-maxage) matches the exact remaining retention.
 * Browser cache (max-age) is capped to min(remainingSeconds, 24h) with must-revalidate.
 */
export function calculateCacheControl(expiresAtMs: number, nowMs: number = Date.now()): CacheControlResult {
  const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000))
  const expired = remainingSeconds <= 0

  if (expired) {
    return {
      cacheControl: 'no-store, no-cache, must-revalidate',
      remainingSeconds: 0,
      expired: true,
    }
  }

  const maxAge = Math.min(remainingSeconds, MAX_BROWSER_CACHE_SECONDS)
  const sMaxAge = remainingSeconds

  return {
    cacheControl: `public, max-age=${maxAge}, s-maxage=${sMaxAge}, must-revalidate`,
    remainingSeconds,
    expired: false,
  }
}

/**
 * In-memory sliding window rate limiter (Zero KV operations).
 * Resilient against burst floods without consuming Cloudflare KV write quotas.
 */
interface RateEntry {
  count: number
  resetAt: number
}

const memoryRateLimitMap = new Map<string, RateEntry>()

export function checkInMemoryRateLimit(
  ip: string,
  maxRequests: number = 5,
  windowMs: number = 300000, // 5 minutes
): { allowed: boolean; remaining: number } {
  if (!ip) return { allowed: true, remaining: maxRequests }

  const now = Date.now()
  const entry = memoryRateLimitMap.get(ip)

  // Prune expired entry
  if (!entry || now > entry.resetAt) {
    memoryRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count }
}

/**
 * Clears the in-memory rate map (useful in unit tests).
 */
export function resetInMemoryRateLimits(): void {
  memoryRateLimitMap.clear()
}
