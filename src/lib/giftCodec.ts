/**
 * Gift codec + validation for AquiraCraft Valentine Week.
 * Pure, dependency-free (except the photo-key format check) and safe to
 * import from Node tests — no DOM access except the draft helpers, which
 * no-op without window/localStorage.
 */
import { isValidPhotoKey } from '../worker/validation.ts'
import type { RosePhoto } from '../photos.ts'

export const DAY_SLUGS = ['rose', 'propose', 'chocolate', 'teddy', 'promise', 'hug', 'kiss', 'valentine'] as const
export type DaySlug = (typeof DAY_SLUGS)[number]

export interface Gift {
  day: DaySlug
  to: string
  from: string
  message: string
  extras: Record<string, string>
  photos?: RosePhoto[]
  createdAt: number
}

export const GIFT_LIMITS = {
  to: 40,
  from: 40,
  message: 280,
  extra: 200,
  caption: 80,
  photos: 4,
  roseColors: ['Wild cherry', 'Blush pink', 'Moonlight ivory', 'Sunset coral'],
} as const

export const FALLBACK_TO = 'My favourite human'
export const FALLBACK_FROM = 'Someone who adores you'
export const FALLBACK_MESSAGE = 'You make the ordinary feel special.'

/** Share URLs longer than this get a warning in the Creator (defence only). */
export const SHARE_URL_WARN_LENGTH = 2000

/** The exact values the old Creator prefilled — a draft holding exactly these
 *  three values is a factory prefill, not something the user typed. */
const FACTORY_TO = 'Aashi'
const FACTORY_FROM = 'Kabir'
const FACTORY_MESSAGE =
  'If I could turn the way you make me feel into a place, I think it would look a little like this.'

/**
 * Builds a shareable gift from raw Creator form values, applying the
 * per-field fallbacks so a gift always works with minimal input — without
 * ever prefilling the inputs themselves (see H3).
 */
export function applyGiftFallbacks(input: {
  day: DaySlug
  to: string
  from: string
  message: string
  extras: Record<string, string>
  photos?: RosePhoto[]
  defaults: Record<string, string>
  createdAt?: number
}): Gift {
  const extras: Record<string, string> = {}
  const allKeys = new Set([...Object.keys(input.defaults), ...Object.keys(input.extras)])
  for (const key of allKeys) {
    const typed = input.extras[key]?.trim()
    extras[key] = typed ? typed.slice(0, GIFT_LIMITS.extra) : (input.defaults[key] ?? '')
  }
  return {
    day: input.day,
    to: input.to.trim().slice(0, GIFT_LIMITS.to) || FALLBACK_TO,
    from: input.from.trim().slice(0, GIFT_LIMITS.from) || FALLBACK_FROM,
    message: input.message.trim().slice(0, GIFT_LIMITS.message) || FALLBACK_MESSAGE,
    extras,
    photos: input.photos && input.photos.length > 0 ? input.photos : undefined,
    createdAt: input.createdAt ?? Date.now(),
  }
}

export type GiftValidation =
  | { ok: true; gift: Gift }
  | { ok: false; error: string }

/** Strict validation for anything decoded from a share link. Returns null-safe. */
export function validateGift(value: unknown): GiftValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Gift must be an object' }
  }
  const v = value as Record<string, unknown>
  if (typeof v.day !== 'string' || !(DAY_SLUGS as readonly string[]).includes(v.day)) {
    return { ok: false, error: 'Unknown day' }
  }
  const day = v.day as DaySlug
  if (typeof v.to !== 'string' || v.to.trim().length === 0 || v.to.length > GIFT_LIMITS.to) {
    return { ok: false, error: 'Invalid recipient name' }
  }
  if (typeof v.from !== 'string' || v.from.trim().length === 0 || v.from.length > GIFT_LIMITS.from) {
    return { ok: false, error: 'Invalid sender name' }
  }
  if (typeof v.message !== 'string' || v.message.trim().length === 0 || v.message.length > GIFT_LIMITS.message) {
    return { ok: false, error: 'Invalid message' }
  }
  if (!v.extras || typeof v.extras !== 'object' || Array.isArray(v.extras)) {
    return { ok: false, error: 'Invalid extras' }
  }
  const extras: Record<string, string> = {}
  for (const [key, val] of Object.entries(v.extras as Record<string, unknown>)) {
    if (typeof val !== 'string' || val.length > GIFT_LIMITS.extra) {
      return { ok: false, error: `Invalid extra field: ${key}` }
    }
    extras[key] = val
  }
  if (
    day === 'rose' &&
    typeof extras.roseColor === 'string' &&
    !(GIFT_LIMITS.roseColors as readonly string[]).includes(extras.roseColor)
  ) {
    return { ok: false, error: 'Invalid rose colour' }
  }
  let photos: RosePhoto[] | undefined
  if (v.photos !== undefined) {
    if (!Array.isArray(v.photos) || v.photos.length > GIFT_LIMITS.photos) {
      return { ok: false, error: 'Too many photos' }
    }
    photos = []
    for (const p of v.photos) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        return { ok: false, error: 'Invalid photo' }
      }
      const photo = p as Record<string, unknown>
      if (typeof photo.photoKey !== 'string' || !isValidPhotoKey(photo.photoKey)) {
        return { ok: false, error: 'Invalid photo key' }
      }
      if (typeof photo.caption !== 'string' || photo.caption.length > GIFT_LIMITS.caption) {
        return { ok: false, error: 'Invalid photo caption' }
      }
      photos.push({ photoKey: photo.photoKey, caption: photo.caption })
    }
  }
  if (typeof v.createdAt !== 'number' || !Number.isFinite(v.createdAt) || v.createdAt <= 0) {
    return { ok: false, error: 'Invalid createdAt' }
  }
  return {
    ok: true,
    gift: {
      day,
      to: v.to as string,
      from: v.from as string,
      message: v.message as string,
      extras,
      photos,
      createdAt: v.createdAt as number,
    },
  }
}

export function encodeGift(gift: Gift): string {
  const checked = validateGift(gift)
  if (!checked.ok) throw new Error(`Cannot share this gift: ${checked.error}`)
  const bytes = new TextEncoder().encode(JSON.stringify(checked.gift))
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function decodeGift(value: string): Gift | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    const checked = validateGift(parsed)
    return checked.ok ? checked.gift : null
  } catch {
    return null
  }
}

export const DRAFT_KEY = 'aquira-valentine-draft'

export interface DraftShape {
  daySlug: DaySlug
  to: string
  from: string
  message: string
  extras: Record<string, string>
}

/** Reads the saved Creator draft. Shape-checked; corrupt, stale or factory-prefill
 *  drafts are ignored (returns null) instead of crashing or resurrecting sample names. */
export function loadDraft(): DraftShape | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const d = parsed as Record<string, unknown>
    if (typeof d.daySlug !== 'string' || !(DAY_SLUGS as readonly string[]).includes(d.daySlug)) return null
    if (typeof d.to !== 'string' || typeof d.from !== 'string' || typeof d.message !== 'string') return null
    if (!d.extras || typeof d.extras !== 'object' || Array.isArray(d.extras)) return null
    const extras: Record<string, string> = {}
    for (const [key, val] of Object.entries(d.extras as Record<string, unknown>)) {
      if (typeof val !== 'string') return null
      extras[key] = val
    }
    // The old Creator prefilled Aashi/Kabir + the sample message. A draft holding
    // exactly those three values is a factory prefill, not user input — ignore it.
    if (d.to === FACTORY_TO && d.from === FACTORY_FROM && d.message === FACTORY_MESSAGE) return null
    return { daySlug: d.daySlug as DaySlug, to: d.to, from: d.from, message: d.message, extras }
  } catch {
    return null
  }
}

/** Autosaves the Creator draft. Best-effort: storage may be unavailable. */
export function saveDraft(draft: DraftShape): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // ignore — drafts are best-effort
  }
}
