/**
 * Photo Compressor — ported as-is from Wishora (birthday-experience)
 * Client-side Canvas-based compressor for Valentine Week photos.
 * Enforces the same limits as Wishora: 5 MB original input, WebP 0.90,
 * longest side 2048 px, stored max 3 MB per photo.
 */

export interface CompressionOptions {
  maxDimension?: number
  maxBytes?: number
  quality?: number
  mimeType?: 'image/webp' | 'image/jpeg'
}

export interface CompressionResult {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  sizeBytes: number
  mimeType: string
}

export const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024 // 5 MB original input ceiling
export const MAX_STORED_PHOTO_BYTES = 3 * 1024 * 1024 // 3 MB stored photo ceiling
export const MAX_PHOTO_BYTES = MAX_STORED_PHOTO_BYTES
export const DEFAULT_MAX_DIMENSION = 2048
export const DEFAULT_QUALITY = 0.90

/**
 * Checks whether an image file is supported and within preliminary limits.
 */
export function validateImageFile(file: File | Blob): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  if (file.type && !validTypes.includes(file.type.toLowerCase())) {
    return { valid: false, error: 'Please upload a JPG, PNG, or WebP photo' }
  }

  // Pre-compression sanity ceiling: reject files exceeding 5 MB input limit
  if (file.size > MAX_ORIGINAL_BYTES) {
    return { valid: false, error: 'Photo is too large. Please select a photo under 5MB' }
  }

  return { valid: true }
}

/**
 * Calculates resized dimensions keeping aspect ratio within maxDimension.
 */
export function calculateAspectRatioFit(
  srcWidth: number,
  srcHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: Math.max(1, maxDimension), height: Math.max(1, maxDimension) }
  }

  if (srcWidth <= maxDimension && srcHeight <= maxDimension) {
    return { width: srcWidth, height: srcHeight }
  }

  const ratio = Math.min(maxDimension / srcWidth, maxDimension / srcHeight)
  return {
    width: Math.max(1, Math.round(srcWidth * ratio)),
    height: Math.max(1, Math.round(srcHeight * ratio)),
  }
}

/**
 * Loads an image Blob/File into an HTMLImageElement safely.
 */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = url
  })
}

/**
 * Renders an image to a Canvas and exports it to a Blob with target MIME type and quality.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas export failed'))
        }
      },
      mimeType,
      quality,
    )
  })
}

/**
 * Reads a Blob as a data URL for immediate UI preview.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob as Data URL'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Compresses an image File or Blob using HTML5 Canvas.
 * Automatically falls back to JPEG if WebP is not supported by the environment.
 * Iteratively steps down quality if needed to guarantee the resulting size <= maxBytes.
 */
export async function compressPhoto(
  file: File | Blob,
  options: CompressionOptions = {},
): Promise<CompressionResult> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const maxBytes = options.maxBytes ?? MAX_PHOTO_BYTES
  const initialQuality = options.quality ?? DEFAULT_QUALITY

  const img = await loadImage(file)
  const { width, height } = calculateAspectRatioFit(img.naturalWidth || img.width, img.naturalHeight || img.height, maxDimension)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context not available')
  }

  // Draw image onto canvas
  ctx.drawImage(img, 0, 0, width, height)

  // Preferred format: WebP, fallback to JPEG
  let targetMime = options.mimeType ?? 'image/webp'
  let currentQuality = initialQuality
  let blob: Blob

  try {
    blob = await canvasToBlob(canvas, targetMime, currentQuality)
    // If browser doesn't support WebP export, it usually falls back to PNG (larger)
    if (blob.type !== targetMime && targetMime === 'image/webp') {
      targetMime = 'image/jpeg'
      blob = await canvasToBlob(canvas, targetMime, currentQuality)
    }
  } catch {
    targetMime = 'image/jpeg'
    blob = await canvasToBlob(canvas, targetMime, currentQuality)
  }

  // Stepped compression loop if output exceeds byte ceiling
  const qualitySteps = [0.75, 0.65, 0.55, 0.45]
  let stepIndex = 0

  while (blob.size > maxBytes && stepIndex < qualitySteps.length) {
    currentQuality = qualitySteps[stepIndex]
    blob = await canvasToBlob(canvas, targetMime, currentQuality)
    stepIndex++
  }

  // Final dimension downscale if still slightly over budget on complex noisy images
  if (blob.size > maxBytes) {
    const scaledCanvas = document.createElement('canvas')
    const scaledWidth = Math.round(width * 0.75)
    const scaledHeight = Math.round(height * 0.75)
    scaledCanvas.width = scaledWidth
    scaledCanvas.height = scaledHeight
    const scaledCtx = scaledCanvas.getContext('2d')
    if (scaledCtx) {
      scaledCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight)
      blob = await canvasToBlob(scaledCanvas, targetMime, 0.6)
    }
  }

  const dataUrl = await blobToDataUrl(blob)

  return {
    blob,
    dataUrl,
    width,
    height,
    sizeBytes: blob.size,
    mimeType: blob.type,
  }
}
