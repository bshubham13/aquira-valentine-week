import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ROSE_FINALE_STAGE } from '../lib/roseGating'

export function useHoldProgress(setValue: Dispatch<SetStateAction<number>>, amount = 2, delay = 32) {
  const timer = useRef<number | null>(null)
  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
  }
  const start = () => {
    if (timer.current !== null) return
    timer.current = window.setInterval(() => {
      setValue((value) => {
        const next = Math.min(100, value + amount)
        if (next >= 100) stop()
        return next
      })
    }, delay)
  }
  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current)
  }, [])
  return { start, stop }
}

export function usePhotoEnlarge(emptyCaption = 'A petal from the bouquet.') {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const lastTriggerRef = useRef<HTMLElement | null>(null)
  const [photo, setPhoto] = useState<{ src: string; caption: string; alt: string } | null>(null)

  useEffect(() => {
    if (photo && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
  }, [photo])

  const close = () => {
    setPhoto(null)
    if (dialogRef.current?.open) dialogRef.current.close()
    lastTriggerRef.current?.focus()
  }

  const open = (src: string, caption: string, alt: string, trigger: HTMLElement) => {
    lastTriggerRef.current = trigger
    setPhoto({ src, caption, alt })
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      className="rose-photo-dialog"
      onClose={close}
      onClick={(event) => { if (event.target === dialogRef.current) close() }}
    >
      {photo && (
        <>
          <img src={photo.src} alt={photo.alt} />
          <p>{photo.caption || emptyCaption}</p>
          <button className="secondary-button" onClick={close}>Close</button>
        </>
      )}
    </dialog>
  )
  return { open, dialog }
}

export function initialStage(maxStage: number = ROSE_FINALE_STAGE) {
  if (!import.meta.env.DEV) return 1
  const requested = Number(new URLSearchParams(window.location.search).get('journeyStage'))
  return Number.isInteger(requested) && requested >= 1 && requested <= maxStage ? requested : 1
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    // haptics are best-effort
  }
}

/** Shared photo-enlarge dialog (Locket pattern): native <dialog>, Escape /
 *  backdrop close, focus returns to the photo button that opened it.
 *  `emptyCaption` is the line shown when a photo has no caption. */
