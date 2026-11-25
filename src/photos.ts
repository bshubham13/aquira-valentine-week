/**
 * Shared photo model for Valentine Week.
 * Photos live in Cloudflare KV (binding VALENTINE_PHOTOS) for 14 days;
 * only short photoKeys travel inside the share link. Mirrors Wishora's
 * Antique Locket photo shape ({ photoKey, caption }) — no yearOrTag here.
 */

export interface RosePhoto {
  photoKey: string
  caption: string
}

export const MAX_ROSE_PHOTOS = 4
export const MAX_PHOTO_CAPTION = 80

export function resolvePhotoUrl(photoKey: string): string {
  return `/api/photos/${photoKey}`
}

/** Preview (creator-side object URL) wins; otherwise the KV-backed URL. */
export function photoSrc(photo: RosePhoto, previewUrl?: string): string {
  return previewUrl ?? resolvePhotoUrl(photo.photoKey)
}
