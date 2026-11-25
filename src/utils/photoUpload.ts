/**
 * Sequential photo upload helper — Wishora's Creator call-site pattern.
 * Uploads one photo at a time so a failure aborts cleanly with a clear
 * error and the creator's draft stays intact.
 */
import type { RosePhoto } from '../photos'

export interface UploadProgress {
  done: number
  total: number
}

export async function uploadPhotos(
  items: Array<{ blob: Blob; caption: string }>,
  onProgress?: (progress: UploadProgress) => void,
): Promise<RosePhoto[]> {
  const uploaded: RosePhoto[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const response = await fetch('/api/photos/upload', {
      method: 'POST',
      headers: { 'Content-Type': item.blob.type || 'image/webp' },
      body: item.blob,
    })
    if (!response.ok) {
      let detail = ''
      try {
        const data = (await response.json()) as { error?: string }
        detail = data.error ?? ''
      } catch {
        // ignore JSON parse errors; fall back to the HTTP status below
      }
      throw new Error(detail || `Photo ${i + 1} upload failed (HTTP ${response.status})`)
    }
    const data = (await response.json()) as { photoKey?: string }
    if (!data.photoKey) {
      throw new Error(`Photo ${i + 1} upload failed: no photo key returned`)
    }
    uploaded.push({ photoKey: data.photoKey, caption: item.caption })
    onProgress?.({ done: i + 1, total: items.length })
  }
  return uploaded
}
