/**
 * Gift codec tests — encode/decode round-trip, validation caps, fallbacks,
 * draft save/restore (incl. the factory-prefill guard, H3).
 *
 * Runs in Node (type-stripped .ts imports). The codec is pure except the
 * draft helpers, which read window.localStorage only when it exists — the
 * tests inject a fake window where needed.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyGiftFallbacks,
  decodeGift,
  encodeGift,
  validateGift,
  loadDraft,
  saveDraft,
  DRAFT_KEY,
  GIFT_LIMITS,
  SHARE_URL_WARN_LENGTH,
  FALLBACK_TO,
  FALLBACK_FROM,
  FALLBACK_MESSAGE,
} from '../src/lib/giftCodec.ts'

const baseGift = () => ({
  day: 'rose',
  to: 'Maya',
  from: 'Arjun',
  message: 'Tumhari smile pe duniya fida hai, aur main bhi. ❀',
  extras: {
    roseColor: 'Wild cherry',
    memory: 'Woh baarish wali shaam',
    compliment: 'Tumhare bina ghar, ghar nahi lagta',
  },
  createdAt: 1795536000000,
})

const validPhoto = (suffix = 'a'.repeat(32)) => ({
  photoKey: `ph_${suffix}`,
  caption: 'Our favourite evening',
})

test('encode/decode round-trips a Rose gift, Unicode and Hinglish intact', () => {
  const gift = baseGift()
  const encoded = encodeGift(gift)
  assert.match(encoded, /^[A-Za-z0-9_-]+$/, 'base64url, no + / or =')
  const decoded = decodeGift(encoded)
  assert.ok(decoded)
  assert.equal(decoded.day, 'rose')
  assert.equal(decoded.to, 'Maya')
  assert.equal(decoded.from, 'Arjun')
  assert.equal(decoded.message, gift.message)
  assert.deepEqual(decoded.extras, gift.extras)
  assert.equal(decoded.createdAt, gift.createdAt)
})

test('encode/decode round-trips photos', () => {
  const gift = { ...baseGift(), photos: [validPhoto(), validPhoto('b'.repeat(32))] }
  const decoded = decodeGift(encodeGift(gift))
  assert.ok(decoded)
  assert.deepEqual(decoded.photos, gift.photos)
})

test('decode rejects garbage, bad day slugs and wrong types', () => {
  assert.equal(decodeGift(''), null)
  assert.equal(decodeGift('not-a-gift!!!'), null)
  assert.equal(decodeGift('@@@'), null)

  // Hand-built payloads bypassing encodeGift's own validation.
  const toB64 = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  assert.equal(decodeGift(toB64({ ...baseGift(), day: 'diwali' })), null, 'unknown day slug rejected')
  assert.equal(decodeGift(toB64({ ...baseGift(), to: 42 })), null, 'to must be a string')
  assert.equal(decodeGift(toB64({ ...baseGift(), createdAt: 'yesterday' })), null)
  assert.equal(decodeGift(toB64({ ...baseGift(), extras: ['not', 'an', 'object'] })), null)
  assert.equal(decodeGift(toB64([1, 2, 3])), null, 'gift must be an object')
})

test('validation caps every field (H4)', () => {
  assert.deepEqual(validateGift({ ...baseGift(), to: 'x'.repeat(41) }), {
    ok: false,
    error: 'Invalid recipient name',
  })
  assert.equal(validateGift({ ...baseGift(), from: 'x'.repeat(41) }).ok, false)
  assert.equal(validateGift({ ...baseGift(), message: 'x'.repeat(281) }).ok, false)
  assert.equal(validateGift({ ...baseGift(), extras: { memory: 'x'.repeat(201) } }).ok, false)
  assert.equal(validateGift({ ...baseGift(), to: '   ' }).ok, false, 'blank name rejected')
  assert.equal(validateGift({ ...baseGift(), message: '' }).ok, false, 'blank message rejected')
  assert.equal(validateGift({ ...baseGift(), extras: { roseColor: 'Hot pink' } }).ok, false, 'unknown rose colour rejected')
  assert.equal(validateGift({ ...baseGift(), day: 'propose', extras: { roseColor: 'Hot pink' } }).ok, true, 'rose colour only validated on Rose Day')

  // Photos.
  assert.equal(validateGift({ ...baseGift(), photos: [validPhoto(), validPhoto('b'.repeat(32)), validPhoto('c'.repeat(32)), validPhoto('d'.repeat(32)), validPhoto('e'.repeat(32))] }).ok, false, 'max 4 photos')
  assert.equal(validateGift({ ...baseGift(), photos: [{ photoKey: 'not-a-key', caption: '' }] }).ok, false, 'bad photo key rejected')
  assert.equal(validateGift({ ...baseGift(), photos: [{ ...validPhoto(), caption: 'x'.repeat(81) }] }).ok, false, 'caption capped at 80')
  assert.equal(validateGift({ ...baseGift(), photos: [validPhoto()] }).ok, true)

  // Exactly at the caps passes.
  assert.equal(validateGift({ ...baseGift(), to: 'x'.repeat(40), message: 'x'.repeat(280) }).ok, true)
})

test('encodeGift throws on a gift that fails validation', () => {
  assert.throws(() => encodeGift({ ...baseGift(), to: 'x'.repeat(41) }), /Invalid recipient name/)
})

test('applyGiftFallbacks fills empty fields without ever prefilling inputs (H3)', () => {
  const gift = applyGiftFallbacks({
    day: 'rose',
    to: '',
    from: '   ',
    message: '',
    extras: {},
    defaults: { roseColor: 'Blush pink', memory: 'A quiet default', compliment: '' },
  })
  assert.equal(gift.to, FALLBACK_TO)
  assert.equal(gift.from, FALLBACK_FROM)
  assert.equal(gift.message, FALLBACK_MESSAGE)
  assert.equal(gift.extras.roseColor, 'Blush pink', 'default rose colour used')
  assert.equal(gift.extras.memory, 'A quiet default')
  assert.notEqual(gift.to, 'Aashi', 'no factory names')
  assert.notEqual(gift.from, 'Kabir')

  const typed = applyGiftFallbacks({
    day: 'rose',
    to: '  Maya  ',
    from: 'Arjun',
    message: 'Hi',
    extras: { memory: 'x'.repeat(300) },
    defaults: { memory: 'default', roseColor: 'Wild cherry' },
  })
  assert.equal(typed.to, 'Maya', 'names are trimmed')
  assert.equal(typed.extras.memory.length, GIFT_LIMITS.extra, 'over-long extras are sliced, not rejected')
  assert.equal(typed.extras.roseColor, 'Wild cherry')
})

test('share URL warning length is 2,000 characters', () => {
  assert.equal(SHARE_URL_WARN_LENGTH, 2000)
})

// --- Drafts (localStorage is injected; the helpers no-op without it) ---

function fakeWindow() {
  const store = new Map()
  return {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)) },
      removeItem: (key) => { store.delete(key) },
    },
  }
}

const SAMPLE_MESSAGE =
  'If I could turn the way you make me feel into a place, I think it would look a little like this.'

test('drafts round-trip through localStorage', () => {
  globalThis.window = fakeWindow()
  try {
    const draft = { daySlug: 'rose', to: 'Maya', from: 'Arjun', message: 'Hello', extras: { roseColor: 'Wild cherry' } }
    saveDraft(draft)
    assert.deepEqual(loadDraft(), draft)
    assert.equal(globalThis.window.localStorage.getItem(DRAFT_KEY).includes('Maya'), true)
  } finally {
    delete globalThis.window
  }
})

test('drafts ignore the factory Aashi/Kabir prefill (H3)', () => {
  globalThis.window = fakeWindow()
  try {
    saveDraft({ daySlug: 'rose', to: 'Aashi', from: 'Kabir', message: SAMPLE_MESSAGE, extras: {} })
    assert.equal(loadDraft(), null, 'factory prefill is not a user draft')
  } finally {
    delete globalThis.window
  }
})

test('drafts ignore corrupt or wrongly-shaped data', () => {
  globalThis.window = fakeWindow()
  try {
    globalThis.window.localStorage.setItem(DRAFT_KEY, '{not json')
    assert.equal(loadDraft(), null)
    globalThis.window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ daySlug: 'rose', to: 'Maya' }))
    assert.equal(loadDraft(), null, 'missing fields')
    globalThis.window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ daySlug: 'diwali', to: 'M', from: 'A', message: 'x', extras: {} }))
    assert.equal(loadDraft(), null, 'unknown day')
    globalThis.window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ daySlug: 'rose', to: 'M', from: 'A', message: 'x', extras: [] }))
    assert.equal(loadDraft(), null, 'extras must be an object')
  } finally {
    delete globalThis.window
  }
})

test('draft helpers no-op without window/localStorage', () => {
  assert.equal(loadDraft(), null)
  assert.doesNotThrow(() => saveDraft({ daySlug: 'rose', to: 'M', from: 'A', message: 'x', extras: {} }))
})
