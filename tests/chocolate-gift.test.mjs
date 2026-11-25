/**
 * Chocolate gift codec tests — encode/decode round-trip, validation caps,
 * Chocolate fallbacks (H3), draft save/restore, and the PHOTO_DAYS set.
 * The codec itself is day-agnostic (Rose's H2/H3/H5 fixes apply already);
 * these tests verify Chocolate's extras and the photo-day generalization.
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
  FALLBACK_TO,
  FALLBACK_FROM,
  FALLBACK_MESSAGE,
} from '../src/lib/giftCodec.ts'
import { PHOTO_DAYS } from '../src/lib/photoDays.ts'

const baseGift = () => ({
  day: 'chocolate',
  to: 'Maya',
  from: 'Arjun',
  message: 'Tumhari smile pe duniya fida hai, aur main bhi. 🍫',
  extras: {
    flavour: 'Dark chocolate drama',
    tease: 'Sweet ho, par meri fries phir bhi churaate ho.',
    reward: 'One dessert date — no sharing required.',
  },
  createdAt: 1795536000000,
})

const validPhoto = (suffix = 'a'.repeat(32)) => ({
  photoKey: `ph_${suffix}`,
  caption: 'Our favourite evening',
})

test('encode/decode round-trips a Chocolate gift, Unicode and Hinglish intact', () => {
  const gift = baseGift()
  const encoded = encodeGift(gift)
  assert.match(encoded, /^[A-Za-z0-9_-]+$/, 'base64url, no + / or =')
  const decoded = decodeGift(encoded)
  assert.ok(decoded)
  assert.equal(decoded.day, 'chocolate')
  assert.equal(decoded.to, 'Maya')
  assert.equal(decoded.from, 'Arjun')
  assert.equal(decoded.message, gift.message)
  assert.deepEqual(decoded.extras, gift.extras)
  assert.equal(decoded.createdAt, gift.createdAt)
})

test('encode/decode round-trips photos for a Chocolate gift', () => {
  const gift = { ...baseGift(), photos: [validPhoto(), validPhoto('b'.repeat(32))] }
  const decoded = decodeGift(encodeGift(gift))
  assert.ok(decoded)
  assert.deepEqual(decoded.photos, gift.photos)
})

test('decode rejects garbage, bad day slugs and wrong types', () => {
  assert.equal(decodeGift(''), null)
  assert.equal(decodeGift('not-a-gift!!!'), null)
  const toB64 = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  assert.equal(decodeGift(toB64({ ...baseGift(), day: 'diwali' })), null, 'unknown day slug rejected')
  assert.equal(decodeGift(toB64({ ...baseGift(), to: 42 })), null, 'to must be a string')
  assert.equal(decodeGift(toB64({ ...baseGift(), extras: ['not', 'an', 'object'] })), null)
})

test('validation caps Chocolate extras at 200 characters (H5)', () => {
  for (const key of ['flavour', 'tease', 'reward']) {
    assert.equal(
      validateGift({ ...baseGift(), extras: { ...baseGift().extras, [key]: 'x'.repeat(201) } }).ok,
      false,
      `${key} over 200 rejected`,
    )
    assert.equal(
      validateGift({ ...baseGift(), extras: { ...baseGift().extras, [key]: 'x'.repeat(200) } }).ok,
      true,
      `${key} at 200 passes`,
    )
  }
  assert.equal(validateGift({ ...baseGift(), to: 'x'.repeat(41) }).ok, false)
  assert.equal(validateGift({ ...baseGift(), message: 'x'.repeat(281) }).ok, false)
  assert.equal(validateGift({ ...baseGift(), photos: [validPhoto(), validPhoto('b'.repeat(32)), validPhoto('c'.repeat(32)), validPhoto('d'.repeat(32)), validPhoto('e'.repeat(32))] }).ok, false, 'max 4 photos')
})

test('applyGiftFallbacks fills empty Chocolate fields from DEFAULT_EXTRAS.chocolate (H3)', () => {
  const gift = applyGiftFallbacks({
    day: 'chocolate',
    to: '',
    from: '   ',
    message: '',
    extras: {},
    defaults: {
      flavour: 'Hazelnut chaos',
      tease: 'You are very sweet. Suspiciously sweet. Almost as if you want my fries.',
      reward: 'One dessert date with unlimited stealing from my plate.',
    },
  })
  assert.equal(gift.to, FALLBACK_TO)
  assert.equal(gift.from, FALLBACK_FROM)
  assert.equal(gift.message, FALLBACK_MESSAGE)
  assert.equal(gift.extras.flavour, 'Hazelnut chaos', 'default flavour used')
  assert.equal(gift.extras.tease, 'You are very sweet. Suspiciously sweet. Almost as if you want my fries.')
  assert.equal(gift.extras.reward, 'One dessert date with unlimited stealing from my plate.')
  assert.notEqual(gift.to, 'Aashi', 'no factory names')
  assert.notEqual(gift.from, 'Kabir')

  const typed = applyGiftFallbacks({
    day: 'chocolate',
    to: '  Maya  ',
    from: 'Arjun',
    message: 'Hi',
    extras: { tease: 'x'.repeat(300) },
    defaults: { flavour: 'Hazelnut chaos', tease: 'default?', reward: 'One date' },
  })
  assert.equal(typed.to, 'Maya', 'names are trimmed')
  assert.equal(typed.extras.tease.length, GIFT_LIMITS.extra, 'over-long extras are sliced, not rejected')
  assert.equal(typed.extras.flavour, 'Hazelnut chaos')
})

test('PHOTO_DAYS includes chocolate (and still includes rose and propose)', () => {
  assert.equal(PHOTO_DAYS.has('chocolate'), true, 'Chocolate gets photo slots + Test Play')
  assert.equal(PHOTO_DAYS.has('rose'), true, 'Rose keeps photo slots + Test Play')
  assert.equal(PHOTO_DAYS.has('propose'), true, 'Propose keeps photo slots + Test Play')
  assert.equal(PHOTO_DAYS.has('teddy'), false, 'other days are not photo days yet')
  assert.equal(PHOTO_DAYS.size, 3)
})

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

test('drafts round-trip for a Chocolate draft', () => {
  globalThis.window = fakeWindow()
  try {
    const draft = { daySlug: 'chocolate', to: 'Maya', from: 'Arjun', message: 'Hello', extras: { flavour: 'Dark chocolate drama' } }
    saveDraft(draft)
    assert.deepEqual(loadDraft(), draft)
    assert.equal(globalThis.window.localStorage.getItem(DRAFT_KEY).includes('chocolate'), true)
  } finally {
    delete globalThis.window
  }
})
