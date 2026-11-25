/**
 * Photo compressor tests — the pure, DOM-free parts of
 * src/utils/photoCompressor.ts (ported as-is from Wishora).
 *
 * `compressPhoto` itself needs document/canvas, so it cannot run in Node:
 * the last test asserts exactly that (it rejects without a DOM) instead of
 * pretending the compression path is covered here.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_ORIGINAL_BYTES,
  MAX_STORED_PHOTO_BYTES,
  MAX_PHOTO_BYTES,
  DEFAULT_MAX_DIMENSION,
  DEFAULT_QUALITY,
  validateImageFile,
  calculateAspectRatioFit,
  compressPhoto,
} from '../src/utils/photoCompressor.ts'

test('Wishora limits are intact: 5 MB in, 3 MB stored, 2048 px, WebP 0.90', () => {
  assert.equal(MAX_ORIGINAL_BYTES, 5 * 1024 * 1024)
  assert.equal(MAX_STORED_PHOTO_BYTES, 3 * 1024 * 1024)
  assert.equal(MAX_PHOTO_BYTES, MAX_STORED_PHOTO_BYTES)
  assert.equal(DEFAULT_MAX_DIMENSION, 2048)
  assert.equal(DEFAULT_QUALITY, 0.9)
})

test('validateImageFile accepts JPG/PNG/WebP and rejects the rest', () => {
  const ok = (type) => validateImageFile(new File([], 'photo', { type }))
  assert.deepEqual(ok('image/jpeg'), { valid: true })
  assert.deepEqual(ok('image/png'), { valid: true })
  assert.deepEqual(ok('image/webp'), { valid: true })
  assert.equal(ok('image/gif').valid, false, 'GIF is not a supported upload')
  assert.equal(ok('image/svg+xml').valid, false, 'SVG is never a photo')
  assert.equal(ok('application/pdf').valid, false)
  assert.match(ok('image/gif').error ?? '', /JPG, PNG, or WebP/)

  // No MIME type at all (some browsers omit it) is not a rejection reason.
  assert.equal(validateImageFile(new Blob([])).valid, true)
  assert.deepEqual(validateImageFile(null), { valid: false, error: 'No file provided' })
})

test('validateImageFile rejects files over the 5 MB original ceiling', () => {
  const tooBig = new Blob([new Uint8Array(MAX_ORIGINAL_BYTES + 1)], { type: 'image/jpeg' })
  const result = validateImageFile(tooBig)
  assert.equal(result.valid, false)
  assert.match(result.error ?? '', /5MB/)
  const atLimit = new Blob([new Uint8Array(MAX_ORIGINAL_BYTES)], { type: 'image/jpeg' })
  assert.equal(validateImageFile(atLimit).valid, true)
})

test('calculateAspectRatioFit keeps aspect ratio within the max side', () => {
  assert.deepEqual(calculateAspectRatioFit(800, 600, 2048), { width: 800, height: 600 }, 'small images are untouched')
  assert.deepEqual(calculateAspectRatioFit(4000, 2000, 2048), { width: 2048, height: 1024 }, 'landscape scales by width')
  assert.deepEqual(calculateAspectRatioFit(1000, 3000, 2048), { width: 683, height: 2048 }, 'portrait scales by height')
  assert.deepEqual(calculateAspectRatioFit(2048, 2048, 2048), { width: 2048, height: 2048 }, 'exactly at the cap is unchanged')
  assert.deepEqual(calculateAspectRatioFit(1, 1, 2048), { width: 1, height: 1 })
  assert.deepEqual(calculateAspectRatioFit(0, 0, 2048), { width: 2048, height: 2048 }, 'degenerate input falls back to the cap')
  assert.deepEqual(calculateAspectRatioFit(-5, 100, 2048), { width: 2048, height: 2048 })
})

test('compressPhoto needs a browser: it rejects in Node (no document/canvas)', async () => {
  const file = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' })
  await assert.rejects(() => compressPhoto(file), 'compression requires Image/canvas, unavailable in Node')
})
