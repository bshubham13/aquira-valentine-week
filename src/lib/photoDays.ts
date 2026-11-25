/**
 * Days whose Creator offers photo slots + Test Play. Rose established the
 * pattern; Propose generalizes it. Later days add one entry each instead of
 * copy-pasting the Rose gates in the Creator.
 */
import type { DaySlug } from './giftCodec'

export const PHOTO_DAYS: ReadonlySet<DaySlug> = new Set(['rose', 'propose', 'chocolate'])
