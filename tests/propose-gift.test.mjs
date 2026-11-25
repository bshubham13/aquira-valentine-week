/**
 * Propose gift codec tests — encode/decode round-trip, validation caps,
 * Propose fallbacks (H3), draft save/restore, and the PHOTO_DAYS set.
 * The codec itself is day-agnostic (Rose's H2/H3/H5 fixes apply already);
 * these tests verify Propose's extras and the photo-day generalization.
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
  day: 'propose',
  to: 'Maya',
  from: 'Arjun',
  message: 'Tumhari smile pe duniya fida hai, aur main bhi. 💍',
  extras: {
    nickname: 'sunshine',
    question: 'Will you be my favourite person — officially, dramatically, and for a very long time?',
    yesLabel: 'Obviously. Come here.',
  },
  createdAt: 1795536000000,
})

const validPhoto = (suffix = 'a'.repeat(32)) => ({
  photoKey: `ph_${suffix}`,
  caption: 'Our favourite evening',
})

test('encode/decode round-trips a Propose gift, Unicode and Hinglish intact', () => {
  const gift = baseGift()
  const encoded = encodeGift(gift)
  assert.match(encoded, /^[A-Za-z0-9_-]+$/, 'base64url, no + / or =')
  const decoded = decodeGift(encoded)
  assert.ok(decoded)
  assert.equal(decoded.day, 'propose')
  assert.equal(decoded.to, 'Maya')
  assert.equal(decoded.from, 'Arjun')
  assert.equal(decoded.message, gift.message)
  assert.deepEqual(decoded.extras, gift.extras)
  assert.equal(decoded.createdAt, gift.createdAt)
})

test('encode/decode round-trips photos for a Propose gift', () => {
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

test('validation caps Propose extras at 200 characters (H5)', () => {
  for (const key of ['nickname', 'question', 'yesLabel']) {
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

test('applyGiftFallbacks fills empty Propose fields from DEFAULT_EXTRAS.propose (H3)', () => {
  const gift = applyGiftFallbacks({
    day: 'propose',
    to: '',
    from: '   ',
    message: '',
    extras: {},
    defaults: {
      nickname: 'sunshine',
      question: 'Will you be my favourite person — officially, dramatically, and for a very long time?',
      yesLabel: 'Obviously. Come here.',
    },
  })
  assert.equal(gift.to, FALLBACK_TO)
  assert.equal(gift.from, FALLBACK_FROM)
  assert.equal(gift.message, FALLBACK_MESSAGE)
  assert.equal(gift.extras.nickname, 'sunshine', 'default nickname used')
  assert.equal(gift.extras.question, 'Will you be my favourite person — officially, dramatically, and for a very long time?')
  assert.equal(gift.extras.yesLabel, 'Obviously. Come here.')
  assert.notEqual(gift.to, 'Aashi', 'no factory names')
  assert.notEqual(gift.from, 'Kabir')

  const typed = applyGiftFallbacks({
    day: 'propose',
    to: '  Maya  ',
    from: 'Arjun',
    message: 'Hi',
    extras: { question: 'x'.repeat(300) },
    defaults: { nickname: 'sunshine', question: 'default?', yesLabel: 'Yes' },
  })
  assert.equal(typed.to, 'Maya', 'names are trimmed')
  assert.equal(typed.extras.question.length, GIFT_LIMITS.extra, 'over-long extras are sliced, not rejected')
  assert.equal(typed.extras.nickname, 'sunshine')
})

test('PHOTO_DAYS includes propose (and still includes rose)', () => {
  assert.equal(PHOTO_DAYS.has('propose'), true, 'Propose gets photo slots + Test Play')
  assert.equal(PHOTO_DAYS.has('rose'), true, 'Rose keeps photo slots + Test Play')
  assert.equal(PHOTO_DAYS.has('chocolate'), false, 'other days are not photo days yet')
  assert.equal(PHOTO_DAYS.size, 2)
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

test('drafts round-trip for a Propose draft', () => {
  globalThis.window = fakeWindow()
  try {
    const draft = { daySlug: 'propose', to: 'Maya', from: 'Arjun', message: 'Hello', extras: { nickname: 'sunshine' } }
    saveDraft(draft)
    assert.deepEqual(loadDraft(), draft)
    assert.equal(globalThis.window.localStorage.getItem(DRAFT_KEY).includes('propose'), true)
  } finally {
    delete globalThis.window
  }
})
