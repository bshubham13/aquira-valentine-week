import { lazy, Suspense, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { SplitText } from 'gsap/SplitText'
import { AnimatePresence, LazyMotion, domAnimation, m } from 'motion/react'
import confetti from 'canvas-confetti'
import type { Gift } from './App'
import { canAdvanceRose, nextRoseStage, ROSE_FINALE_STAGE, ROSE_STAGE_TOTAL, type RoseStageState } from './lib/roseGating'
import { canAdvancePropose, nextProposeStage, PROPOSE_FINALE_STAGE, PROPOSE_STAGE_TOTAL, dodgeNo, type ProposeStageState } from './lib/proposeGating'
import { ambience } from './lib/ambience'
import { photoSrc } from './photos'
import './rose.css'
import './propose.css'

gsap.registerPlugin(Draggable, InertiaPlugin, MotionPathPlugin, DrawSVGPlugin, SplitText)

const RoseScene = lazy(() => import('./RoseScene'))

type IconName = 'heart' | 'arrow' | 'spark'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    spark: <path d="m12 3-1.2 4.3a5 5 0 0 1-3.5 3.5L3 12l4.3 1.2a5 5 0 0 1 3.5 3.5L12 21l1.2-4.3a5 5 0 0 1 3.5-3.5L21 12l-4.3-1.2a5 5 0 0 1-3.5-3.5Z" />,
  }
  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function StageTop({ label, step, total }: { label: string; step: number; total: number }) {
  return <header className="stage-top"><span>{label}</span><div>{Array.from({ length: total }, (_, index) => <i key={index} className={index < step ? 'done' : ''} />)}</div><b>{String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}</b></header>
}

function Celebration() {
  return <div className="celebration" aria-hidden="true">{Array.from({ length: 32 }, (_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties}>{index % 3 === 0 ? '♥' : '•'}</i>)}</div>
}

function Finale({ gift, title, children, badge = 'DELIVERED · FELT · YOURS', actions }: { gift: Gift; title: ReactNode; children: ReactNode; badge?: string; actions?: { onReplay?: () => void; shareUrl?: string; replayLabel?: string } }) {
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    if (!actions?.shareUrl) return
    try { await navigator.clipboard.writeText(actions.shareUrl) } catch { /* clipboard unavailable — still confirm */ }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return <section className="finale"><Celebration /><span className="finale-kicker">{badge}</span><h2>{title}</h2><div className="finale-copy">{children}</div>{actions && (actions.onReplay || actions.shareUrl) && <div className="finale-actions">{actions.onReplay && <button className="world-button" onClick={actions.onReplay}>{actions.replayLabel ?? '↻ Replay the rose'}</button>}{actions.shareUrl && <button className="secondary-button" onClick={() => void copyLink()}>{copied ? 'Copied!' : 'Copy link'}</button>}</div>}<div className="signature">with a full heart,<br /><strong>{gift.from}</strong></div><span className="finale-mark"><Icon name="heart" size={18} /> MADE ON AQUIRACRAFT</span></section>
}

function useHoldProgress(setValue: Dispatch<SetStateAction<number>>, amount = 2, delay = 32) {
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

function SoftParticles({ count = 24 }: { count?: number }) {
  return <div className="soft-particles" aria-hidden="true">{Array.from({ length: count }, (_, i) => <i key={i} style={{ '--x': `${(i * 43) % 100}%`, '--y': `${(i * 29) % 96}%`, '--d': `${(i % 8) * -.55}s`, '--s': `${4 + i % 7}px` } as React.CSSProperties} />)}</div>
}

/** DEV-only deep-link (?journeyStage=N), clamped to the day's own finale stage. */
function initialStage(maxStage: number = ROSE_FINALE_STAGE) {
  if (!import.meta.env.DEV) return 1
  const requested = Number(new URLSearchParams(window.location.search).get('journeyStage'))
  return Number.isInteger(requested) && requested >= 1 && requested <= maxStage ? requested : 1
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    // haptics are best-effort
  }
}

/** Shared photo-enlarge dialog (Locket pattern): native <dialog>, Escape /
 *  backdrop close, focus returns to the photo button that opened it.
 *  `emptyCaption` is the line shown when a photo has no caption. */
function usePhotoEnlarge(emptyCaption = 'A petal from the bouquet.') {
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

export function RoseExperience({ gift, previewPhotos, testPlay = false }: { gift: Gift; previewPhotos?: readonly string[]; testPlay?: boolean }) {
  const photos = gift.photos ?? []
  const [stage, setStage] = useState(initialStage)
  const [water, setWater] = useState(0)
  const [watering, setWatering] = useState(false)
  const [rosesBloomed, setRosesBloomed] = useState<number[]>([])
  const [momentsTucked, setMomentsTucked] = useState<number[]>([])
  const [ribbon, setRibbon] = useState('')
  const [wind, setWind] = useState(0)
  const [delivery, setDelivery] = useState(0)
  const [gateProgress, setGateProgress] = useState(0)
  const [knocks, setKnocks] = useState(0)
  const [selectedMoment, setSelectedMoment] = useState<number | null>(null)
  const [photosViewed, setPhotosViewed] = useState<number[]>([])
  const [failedPhotos, setFailedPhotos] = useState<number[]>([])
  const enlarge = usePhotoEnlarge()
  const waterHold = useHoldProgress(setWater, 2, 30)
  const windHold = useHoldProgress(setWind, 3, 32)
  const deliveryHold = useHoldProgress(setDelivery, 2, 28)

  // Refs for effect-driven mutations (avoid stale closures in GSAP callbacks).
  const rosesBloomedRef = useRef<number[]>([])
  const momentsTuckedRef = useRef<number[]>([])
  const bowPoppedRef = useRef(false)
  const chimedRef = useRef(false)
  const wateredRef = useRef(false)
  const gateRef = useRef<HTMLDivElement | null>(null)
  const gateLeftRef = useRef<HTMLDivElement | null>(null)
  const gateRightRef = useRef<HTMLDivElement | null>(null)
  const gateHandleRef = useRef<HTMLDivElement | null>(null)
  const bedRef = useRef<HTMLDivElement | null>(null)
  const beamRef = useRef<HTMLDivElement | null>(null)
  const spotRefs = useRef<Array<HTMLButtonElement | null>>([])
  const momentCardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const bouquetDropRef = useRef<HTMLDivElement | null>(null)
  const bowRef = useRef<HTMLDivElement | null>(null)
  const deliveryPathRef = useRef<SVGPathElement | null>(null)
  const deliveryBouquetRef = useRef<HTMLDivElement | null>(null)
  const polaroidWrapRef = useRef<HTMLDivElement | null>(null)

  const [webglOK] = useState(() => isWebGLAvailable())
  const [reducedMotion] = useState(() => prefersReducedMotion())

  const roseState: RoseStageState = {
    gateOpen: gateProgress >= 100,
    watered: water,
    rosesBloomed: rosesBloomed.length,
    momentsTucked: momentsTucked.length,
    ribbonTied: wind >= 100,
    photosViewed: photosViewed.length,
    photoCount: photos.length,
    delivery,
  }

  const advance = () => { if (canAdvanceRose(stage, roseState)) setStage(nextRoseStage(stage)) }

  const reset = () => {
    rosesBloomedRef.current = []
    momentsTuckedRef.current = []
    bowPoppedRef.current = false
    chimedRef.current = false
    wateredRef.current = false
    setStage(1)
    setWater(0)
    setWatering(false)
    setRosesBloomed([])
    setMomentsTucked([])
    setRibbon('')
    setWind(0)
    setDelivery(0)
    setGateProgress(0)
    setKnocks(0)
    setSelectedMoment(null)
    setPhotosViewed([])
    setFailedPhotos([])
  }

  const moments = [gift.extras.memory, gift.extras.compliment, gift.message]
  const waterBubble = water >= 100
    ? 'Aah! Fresh ho gayi. Ab main moonlight ke liye ready hoon.'
    : water >= 70
      ? 'Bas thoda aur… main almost bloom karne wali hoon.'
      : water >= 30
        ? 'Haan, haan, aur thoda! Feel ho raha hai, petals jaag rahe hain.'
        : 'Paani! Itni lambi journey ke baad main literally murjha gayi hoon.'

  // --- Stage 1: Garden Gate (GSAP Draggable) ---
  useEffect(() => {
    if (stage !== 1 || prefersReducedMotion()) return
    const handle = gateHandleRef.current
    const left = gateLeftRef.current
    const right = gateRightRef.current
    if (!handle || !left || !right) return
    gsap.set([left, right], { transformPerspective: 900 })
    const applyProgress = (p: number) => {
      gsap.set(left, { rotationY: -p * 105 })
      gsap.set(right, { rotationY: p * 105 })
      setGateProgress(Math.round(p * 100))
    }
    const finish = (p: number) => {
      if (p >= 0.6) {
        gsap.to(handle, { x: 160, duration: 0.5, ease: 'power3.out' })
        gsap.to(left, { rotationY: -105, duration: 0.5, ease: 'power3.out' })
        gsap.to(right, { rotationY: 105, duration: 0.5, ease: 'power3.out' })
        setGateProgress(100)
      } else {
        gsap.to(handle, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
        gsap.to([left, right], { rotationY: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
        setGateProgress(0)
      }
    }
    const drag = Draggable.create(handle, {
      type: 'x',
      bounds: { minX: 0, maxX: 160 },
      inertia: true,
      onDrag(this: Draggable) { applyProgress(this.x / 160) },
      onDragEnd(this: Draggable) { finish(this.x / 160) },
      onThrowComplete(this: Draggable) { finish(this.x / 160) },
    })[0]
    return () => { drag.kill() }
  }, [stage])

  const knock = () => {
    const next = knocks + 1
    setKnocks(next)
    if (gateRef.current && !prefersReducedMotion()) {
      gsap.fromTo(gateRef.current, { x: -3 }, { x: 3, duration: 0.08, repeat: 3, yoyo: true, clearProps: 'x' })
    }
    if (next >= 2) {
      if (!prefersReducedMotion()) {
        gsap.to(gateLeftRef.current, { rotationY: -105, duration: 0.7, ease: 'power3.inOut' })
        gsap.to(gateRightRef.current, { rotationY: 105, duration: 0.7, ease: 'power3.inOut' })
      }
      setGateProgress(100)
    }
  }

  // --- Stage 2: Water the Rose (hold-to-water) ---
  const startWatering = () => {
    setWatering(true)
    waterHold.start()
  }

  const stopWatering = () => {
    setWatering(false)
    waterHold.stop()
  }

  const waterForMe = () => {
    const obj = { v: water }
    gsap.to(obj, { v: 100, duration: 1.2, ease: 'power1.inOut', onUpdate: () => setWater(Math.round(obj.v)) })
  }

  useEffect(() => {
    if (water >= 100 && !wateredRef.current) {
      wateredRef.current = true
      ambience.playChime()
      vibrate(40)
    }
    if (water < 100) wateredRef.current = false
  }, [water])

  // --- Stage 3: Wake the Bouquet (moonbeam bloom) ---
  const bloomSpot = (spot: number) => {
    if (rosesBloomedRef.current.includes(spot)) return
    rosesBloomedRef.current = [...rosesBloomedRef.current, spot]
    setRosesBloomed(rosesBloomedRef.current)
    const target = spotRefs.current[spot]
    if (target) {
      if (!prefersReducedMotion()) {
        gsap.fromTo(target.querySelector('.flower'), { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(2.5)' })
      }
      const rect = target.getBoundingClientRect()
      confetti({
        particleCount: 12, spread: 45, startVelocity: 14, ticks: 120, scalar: 0.7,
        origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
        colors: ['#ff315f', '#ff6b8c', '#ffd3df'], disableForReducedMotion: true,
      })
    }
  }

  const bloomAt = (clientX: number, clientY: number) => {
    spotRefs.current.forEach((el, spot) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      if (Math.hypot(clientX - cx, clientY - cy) < 70) bloomSpot(spot)
    })
  }

  useEffect(() => {
    if (stage !== 3 || prefersReducedMotion()) return
    const beam = beamRef.current
    const bed = bedRef.current
    if (!beam || !bed) return
    const xTo = gsap.quickTo(beam, 'x', { duration: 0.3, ease: 'power3' })
    const yTo = gsap.quickTo(beam, 'y', { duration: 0.3, ease: 'power3' })
    const move = (event: PointerEvent) => {
      const rect = bed.getBoundingClientRect()
      gsap.set(beam, { opacity: 1 })
      xTo(event.clientX - rect.left - 24)
      yTo(event.clientY - rect.top - 24)
    }
    bed.addEventListener('pointermove', move)
    return () => bed.removeEventListener('pointermove', move)
  }, [stage])

  // --- Stage 4: Press the Moments (drag-drop tuck) ---
  const tuckMoment = (index: number) => {
    if (momentsTuckedRef.current.includes(index)) return
    momentsTuckedRef.current = [...momentsTuckedRef.current, index]
    setMomentsTucked(momentsTuckedRef.current)
    setSelectedMoment(null)
    const card = momentCardRefs.current[index]
    const zone = bouquetDropRef.current
    if (card && zone && !prefersReducedMotion()) {
      const cr = card.getBoundingClientRect()
      const zr = zone.getBoundingClientRect()
      const dx = zr.left + zr.width / 2 - (cr.left + cr.width / 2)
      const dy = zr.top + zr.height / 2 - (cr.top + cr.height / 2)
      gsap.to(card, { x: dx, y: dy, scale: 0.5, rotation: 12, opacity: 0, duration: 0.55, ease: 'power2.in', onComplete: () => gsap.set(card, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }) })
    }
  }

  useEffect(() => {
    if (stage !== 4 || prefersReducedMotion()) return
    const draggables = momentCardRefs.current.map((el, index) => {
      if (!el) return null
      return Draggable.create(el, {
        type: 'x,y',
        onDrag(this: Draggable) {
          if (bouquetDropRef.current) {
            bouquetDropRef.current.classList.toggle('drop-hot', this.hitTest(bouquetDropRef.current, '40%'))
          }
        },
        onDragEnd(this: Draggable) {
          bouquetDropRef.current?.classList.remove('drop-hot')
          if (bouquetDropRef.current && this.hitTest(bouquetDropRef.current, '40%')) tuckMoment(index)
          else gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
        },
      })[0]
    })
    return () => { draggables.forEach((d) => d?.kill()) }
  }, [stage])

  // --- Stage 5: Tie the Ribbon (hold-to-wind) ---
  const RING_C = 2 * Math.PI * 70

  useEffect(() => {
    if (wind >= 100 && !bowPoppedRef.current) {
      bowPoppedRef.current = true
      if (bowRef.current && !prefersReducedMotion()) {
        gsap.fromTo(bowRef.current, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
      }
    }
  }, [wind])

  const tieForMe = () => {
    const obj = { v: wind }
    gsap.to(obj, { v: 100, duration: 1.1, ease: 'power1.inOut', onUpdate: () => setWind(Math.round(obj.v)) })
  }

  const releaseWind = () => { windHold.stop() }

  // --- Stage 6: Photo Petals (fan-in) ---
  useEffect(() => {
    if (stage !== 6 || prefersReducedMotion()) return
    const wrap = polaroidWrapRef.current
    if (!wrap) return
    const cards = wrap.querySelectorAll('.rose-polaroid')
    if (cards.length === 0) return
    gsap.from(cards, { y: 40, opacity: 0, rotation: (i: number) => -8 + i * 5, stagger: 0.12, duration: 0.6, ease: 'back.out(1.6)' })
  }, [stage])

  const viewPhoto = (index: number, src: string, caption: string, trigger: HTMLElement) => {
    setPhotosViewed((prev) => (prev.includes(index) ? prev : [...prev, index]))
    enlarge.open(src, caption, `Photo ${index + 1}`, trigger)
  }

  // --- Stage 7: Hold to Deliver (MotionPath) ---
  useEffect(() => {
    if (stage !== 7) return
    const path = deliveryPathRef.current
    const bouquet = deliveryBouquetRef.current
    if (!path || !bouquet) return
    if (prefersReducedMotion()) { gsap.set(bouquet, { x: 0, y: 0, opacity: 1 }); return }
    gsap.set(bouquet, { motionPath: { path, align: path, alignOrigin: [0.5, 0.5], start: 0, end: delivery / 100 } })
  }, [delivery, stage])

  const releaseDelivery = () => {
    deliveryHold.stop()
    if (delivery < 100) {
      setDelivery(0)
      if (deliveryBouquetRef.current && !prefersReducedMotion()) {
        gsap.fromTo(deliveryBouquetRef.current, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: 'bounce.out' })
      }
    }
  }

  useEffect(() => {
    if (delivery >= 100 && !chimedRef.current) {
      chimedRef.current = true
      ambience.playChime()
      vibrate(40)
    }
    if (delivery < 100) chimedRef.current = false
  }, [delivery])

  // --- Finale: confetti ---
  useEffect(() => {
    if (stage !== ROSE_FINALE_STAGE || prefersReducedMotion()) return
    const colors = ['#ff315f', '#ff6b8c', '#ffd3df', '#fff6e8']
    confetti({ particleCount: 80, spread: 75, origin: { y: 0.6 }, colors, scalar: 0.9, ticks: 220, disableForReducedMotion: true })
    const timer = window.setTimeout(() => {
      confetti({ particleCount: 40, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, scalar: 0.8, ticks: 180, disableForReducedMotion: true })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [stage])

  const photoSrcAt = (index: number): string => previewPhotos?.[index] ?? photoSrc(photos[index])

  return (
    <LazyMotion features={domAnimation}>
      <main className="rose-world expanded-world">
        <SoftParticles />
        {stage < ROSE_FINALE_STAGE && <StageTop label="THE BLOOM ROOM" step={stage} total={ROSE_STAGE_TOTAL} />}
        <AnimatePresence mode="wait">
          <m.div
            key={stage}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rose-stage-wrap"
          >
            {stage === 1 && (
              <section className="experience-intro rose-intro rose-gate-stage">
                <span className="kicker">A PRIVATE FLORAL DELIVERY</span>
                <h1>A rose chose<br /><em>{gift.to}.</em></h1>
                <p>Normal bouquet nahi hai. Thoda nakhre wala, kaafi pretty, aur suspiciously personal.</p>
                <div className="garden-gate" ref={gateRef}>
                  <div className="gate-frame">
                    <div className="gate-panel gate-left" ref={gateLeftRef}><span>❀</span></div>
                    <div className="gate-panel gate-right" ref={gateRightRef}><span>❀</span></div>
                    <div className="gate-glow" aria-hidden="true" />
                  </div>
                  <div className="gate-handle" ref={gateHandleRef} aria-hidden="true"><span>drag →</span></div>
                </div>
                <p className="gate-hint">{gateProgress >= 100 ? 'The garden is open. 🌹' : 'Drag the gate open — or knock twice.'}</p>
                {gateProgress < 100 && <button className="secondary-button" onClick={knock}>Knock twice</button>}
                {canAdvanceRose(1, roseState) && <button className="world-button" onClick={advance}>Step into the garden <Icon name="arrow" /></button>}
                <span className="rose-tag">{gift.extras.roseColor}<br /><strong>one of one</strong></span>
              </section>
            )}

            {stage === 2 && (
              <section
                className="rose-inspection scene-panel water-stage"
                style={{ '--droop': `${((100 - water) / 100) * 12}deg`, '--bloom-life': `${0.55 + (water / 100) * 0.45}` } as React.CSSProperties}
              >
                <div className="scene-copy">
                  <span>STEP 01 · HANDLE WITH FEELINGS</span>
                  <h2>She’s thirsty.</h2>
                  <p>Rosie gate se hokar aayi hai — long journey, zero paani. Hold the button and water her till she perks up.</p>
                  <div className="character-bubble"><b>ROSIE</b>{waterBubble}</div>
                  <div className="wind-row">
                    <button
                      className="wind-button"
                      onPointerDown={startWatering}
                      onPointerUp={stopWatering}
                      onPointerLeave={stopWatering}
                      onKeyDown={(event) => { if (event.key === ' ' && !event.repeat) { event.preventDefault(); startWatering() } }}
                      onKeyUp={stopWatering}
                    ><i style={{ width: `${water}%` }} /><span>{water < 100 ? `HOLD TO WATER · ${water}%` : 'ROSIE IS FRESH'}</span></button>
                    {water < 100 && <button className="secondary-button" onClick={waterForMe}>Water it for me</button>}
                  </div>
                  {canAdvanceRose(2, roseState) && <button className="world-button" onClick={advance}>Take Rosie to the moonlight <Icon name="spark" /></button>}
                </div>
                <div className="hero-rose-object">
                  <div className="rose-bloom-3d"><i /><i /><i /><i /><i /><b>♥</b></div>
                  <div className="rose-stem-3d" />
                  {watering && !reducedMotion && (
                    <div className="water-drops" aria-hidden="true"><i>💧</i><i>💧</i><i>💧</i><i>💧</i><i>💧</i></div>
                  )}
                  <span className="rose-tag">{gift.extras.roseColor}<br /><strong>one of one</strong></span>
                </div>
              </section>
            )}

            {stage === 3 && (
              <section className="garden-stage">
                <div className="moon">for<br /><strong>{gift.to}</strong></div>
                <div className="garden-copy">
                  <span>THE ROSE REMEMBERS</span>
                  <h2>Wake the rest of the bouquet.</h2>
                  <p>{rosesBloomed.length < 5 ? `${5 - rosesBloomed.length} feelings abhi bhi shy ban rahe hain…` : 'Full filmy garden unlocked. Zero regrets.'}</p>
                </div>
                <div
                  className="garden-bed"
                  ref={bedRef}
                  onPointerDown={(event) => bloomAt(event.clientX, event.clientY)}
                  onPointerMove={(event) => { if (event.buttons === 1) bloomAt(event.clientX, event.clientY) }}
                >
                  <div className="moonbeam" ref={beamRef} aria-hidden="true" />
                  {Array.from({ length: 7 }, (_, spot) => (
                    <button
                      aria-label="Grow a rose"
                      key={spot}
                      className={rosesBloomed.includes(spot) ? 'bloomed' : ''}
                      ref={(el) => { spotRefs.current[spot] = el }}
                      onClick={() => bloomSpot(spot)}
                      style={{ '--x': `${8 + (spot * 14) % 86}%`, '--h': `${70 + (spot % 3) * 24}px`, '--d': `${spot * .08}s` } as React.CSSProperties}
                    ><i className="stem" /><i className="leaf" /><span className="flower"><b /><b /><b /><b /><em>♥</em></span></button>
                  ))}
                </div>
                {rosesBloomed.length >= 5 && <button className="world-button floating-next" onClick={advance}>Bring them to the wrapping table <Icon name="arrow" /></button>}
              </section>
            )}

            {stage === 4 && (
              <section className="bouquet-studio scene-panel">
                <div className="bouquet-table">
                  <div ref={bouquetDropRef} className={`finished-bouquet ribbon-${ribbon || 'none'}`}>
                    {Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--r': `${-42 + i * 14}deg`, '--c': i % 2 ? '#ff6b8c' : '#d92d58' } as React.CSSProperties}><b /><span /></i>)}
                    <div className="bouquet-wrap" />
                    <strong>{ribbon ? `${ribbon} ribbon` : 'choose a ribbon'}</strong>
                  </div>
                  <div className="tucked-lines">
                    {momentsTucked.map((index) => <p key={index}>❀ {moments[index]}</p>)}
                  </div>
                </div>
                <div className="bouquet-controls">
                  <span>THE FINAL ARRANGEMENT</span>
                  <h2>Make the bouquet feel like “us.”</h2>
                  <p className="stage-hint">Drag each note onto the bouquet — or tap a note, then tap the bouquet.</p>
                  <label>CHOOSE THE RIBBON</label>
                  <div className="ribbon-options">{['velvet', 'satin', 'chaos'].map((item) => <button className={ribbon === item ? 'selected' : ''} onClick={() => setRibbon(item)} key={item}>{item === 'chaos' ? 'cute chaos' : item}</button>)}</div>
                  <label>TUCK THREE MOMENTS BETWEEN THE PETALS</label>
                  <div className="petal-notes">
                    {moments.map((moment, i) => (
                      <button
                        className={`${momentsTucked.includes(i) ? 'tucked' : ''} ${selectedMoment === i ? 'selected' : ''}`}
                        key={i}
                        ref={(el) => { momentCardRefs.current[i] = el }}
                        onClick={() => {
                          if (momentsTucked.includes(i)) return
                          if (selectedMoment === i) { setSelectedMoment(null); return }
                          setSelectedMoment(i)
                        }}
                      ><i>❀</i><span>{momentsTucked.includes(i) ? moment : ['a memory', 'a truth', 'a feeling'][i]}</span></button>
                    ))}
                  </div>
                  {selectedMoment !== null && !momentsTucked.includes(selectedMoment) && (
                    <button className="world-button" onClick={() => tuckMoment(selectedMoment)}>Tuck it into the bouquet <Icon name="arrow" /></button>
                  )}
                  {canAdvanceRose(4, roseState) && <button className="world-button" onClick={advance}>Tie the ribbon <Icon name="arrow" /></button>}
                </div>
              </section>
            )}

            {stage === 5 && (
              <section className="ribbon-stage scene-panel">
                <div className="ribbon-visual">
                  <div className="finished-bouquet ribbon-wind">
                    {Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--r': `${-42 + i * 14}deg`, '--c': i % 2 ? '#ff6b8c' : '#d92d58' } as React.CSSProperties}><b /><span /></i>)}
                    <div className="bouquet-wrap" />
                    <strong>{ribbon ? `${ribbon} ribbon` : 'a ribbon'}</strong>
                  </div>
                  <svg className="ribbon-ring" viewBox="0 0 180 180" aria-hidden="true">
                    <circle cx="90" cy="90" r="70" className="ribbon-track" />
                    <circle cx="90" cy="90" r="70" className="ribbon-progress" style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - wind / 100) }} transform="rotate(-90 90 90)" />
                  </svg>
                  {wind >= 100 && <div className="ribbon-bow" ref={bowRef} aria-hidden="true">🎀</div>}
                </div>
                <div className="ribbon-controls">
                  <span>WIND IT TIGHT, WITH FEELING</span>
                  <h2>Tie the ribbon.</h2>
                  <p>{wind < 100 ? 'Hold the button and wind the ribbon around the bouquet.' : `Beautiful. The ${ribbon || 'velvet'} ribbon is tied — Rosie approves.`}</p>
                  <label>CHOOSE THE RIBBON</label>
                  <div className="ribbon-options">{['velvet', 'satin', 'chaos'].map((item) => <button className={ribbon === item ? 'selected' : ''} onClick={() => setRibbon(item)} key={item}>{item === 'chaos' ? 'cute chaos' : item}</button>)}</div>
                  <div className="wind-row">
                    <button
                      className="wind-button"
                      onPointerDown={windHold.start}
                      onPointerUp={releaseWind}
                      onPointerLeave={releaseWind}
                      onKeyDown={(event) => { if (event.key === ' ' && !event.repeat) { event.preventDefault(); windHold.start() } }}
                      onKeyUp={windHold.stop}
                    ><i style={{ width: `${wind}%` }} /><span>{wind < 100 ? `HOLD TO WIND · ${wind}%` : 'RIBBON TIED'}</span></button>
                    {wind < 100 && <button className="secondary-button" onClick={tieForMe}>Tie it for me</button>}
                  </div>
                  {canAdvanceRose(5, roseState) && <button className="world-button" onClick={advance}>Show them the photos <Icon name="arrow" /></button>}
                </div>
              </section>
            )}

            {stage === 6 && (
              <section className="photo-petals-stage scene-panel">
                <div className="photo-stage-copy">
                  <span>PETALS, WITH PROOF</span>
                  <h2>Photos tucked in the bouquet.</h2>
                  <p>{photos.length === 0 ? 'No photos tucked in this time — the words carry it.' : 'Tap a photo to see it big. Open at least one to continue.'}</p>
                </div>
                {photos.length === 0 ? (
                  <div className="photo-empty">
                    <div className="rose-bloom-3d"><i /><i /><i /><i /><i /><b>♥</b></div>
                    <p>The bouquet is all words today — and the words are enough.</p>
                  </div>
                ) : (
                  <div className="photo-petals-wrap">
                    <div className="rose-3d-backdrop">
                      {webglOK && !reducedMotion ? (
                        <Suspense fallback={<div className="rose-bloom-3d"><i /><i /><i /><i /><i /><b>♥</b></div>}>
                          <RoseScene bloom={photosViewed.length / photos.length} />
                        </Suspense>
                      ) : (
                        <div className="rose-bloom-3d"><i /><i /><i /><i /><i /><b>♥</b></div>
                      )}
                    </div>
                    <div className="rose-polaroids" ref={polaroidWrapRef}>
                      {photos.map((photo, index) => (
                        failedPhotos.includes(index) ? (
                          <div className="rose-polaroid photo-failed" key={photo.photoKey || index}>
                            <span className="photo-placeholder">❀</span>
                            <span>{photo.caption || 'A petal that could not load.'}</span>
                          </div>
                        ) : (
                          <button
                            className={`rose-polaroid ${photosViewed.includes(index) ? 'viewed' : ''}`}
                            key={photo.photoKey || index}
                            style={{ '--tilt': `${-6 + index * 4}deg` } as React.CSSProperties}
                            onClick={(event) => viewPhoto(index, photoSrcAt(index), photo.caption, event.currentTarget)}
                            aria-label={`Enlarge photo ${index + 1}`}
                          >
                            <img src={photoSrcAt(index)} alt={photo.caption || `Photo ${index + 1}`} onError={() => setFailedPhotos((prev) => (prev.includes(index) ? prev : [...prev, index]))} />
                            <span>{photo.caption || 'a favourite moment'}</span>
                            <b className="enlarge-badge" aria-hidden="true">⤢</b>
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                )}
                {canAdvanceRose(6, roseState) && <button className="world-button" onClick={advance}>Deliver it <Icon name="arrow" /></button>}
              </section>
            )}

            {stage === 7 && (
              <section className="delivery-stage scene-panel">
                <div className="delivery-copy">
                  <span>THE LAST LITTLE JOURNEY</span>
                  <h2>Hold to deliver.</h2>
                  <p>{delivery < 100 ? 'Hold the button — the bouquet floats along the moonlit path to them.' : `Delivered to ${gift.to}. Rosie is blushing.`}</p>
                </div>
                <div className="delivery-path-wrap">
                  <svg className="delivery-path" viewBox="0 0 320 120" aria-hidden="true">
                    <path ref={deliveryPathRef} d="M20 100 C 90 20, 230 20, 300 55" fill="none" />
                    <circle cx="300" cy="55" r="5" className="delivery-dot" />
                  </svg>
                  <div className="delivery-bouquet" ref={deliveryBouquetRef} aria-hidden="true">🌹</div>
                  <div className="delivery-destination"><span>for</span><strong>{gift.to}</strong></div>
                </div>
                <div className="delivery-hold">
                  <button
                    className="wind-button delivery-button"
                    onPointerDown={deliveryHold.start}
                    onPointerUp={releaseDelivery}
                    onPointerLeave={releaseDelivery}
                    onKeyDown={(event) => { if (event.key === ' ' && !event.repeat) { event.preventDefault(); deliveryHold.start() } }}
                    onKeyUp={releaseDelivery}
                  ><i style={{ width: `${delivery}%` }} /><Icon name="heart" /><span>{delivery < 100 ? 'HOLD TO DELIVER' : 'ROSE RECEIVED'}</span></button>
                  {delivery >= 100 && <button className="world-button" onClick={advance}>See what the rose was carrying <Icon name="spark" /></button>}
                </div>
              </section>
            )}

            {stage === ROSE_FINALE_STAGE && (
              <Finale
                gift={gift}
                badge="🌹 HAND-DELIVERED · ONE OF ONE"
                title={<>Not just a rose.<br /><em>A whole “I noticed you.”</em></>}
                actions={testPlay ? { onReplay: reset } : { onReplay: reset, shareUrl: window.location.href }}
              >
                <p>{gift.extras.compliment}</p>
                <blockquote>“{gift.extras.memory}”</blockquote>
                <p className="finale-hinglish">Phool eventually dry ho jaate hain. Yeh feeling save kar lena.</p>
                {photos.length > 0 && (
                  <div className="finale-photo-fan">
                    {photos.map((photo, index) => (
                      failedPhotos.includes(index) ? null : (
                        <button
                          key={photo.photoKey || index}
                          className="finale-fan-photo"
                          style={{ '--tilt': `${-10 + index * 7}deg` } as React.CSSProperties}
                          onClick={(event) => viewPhoto(index, photoSrcAt(index), photo.caption, event.currentTarget)}
                          aria-label={`Enlarge photo ${index + 1}`}
                        >
                          <img src={photoSrcAt(index)} alt={photo.caption || `Photo ${index + 1}`} onError={() => setFailedPhotos((prev) => (prev.includes(index) ? prev : [...prev, index]))} />
                        </button>
                      )
                    ))}
                  </div>
                )}
              </Finale>
            )}
          </m.div>
        </AnimatePresence>
        {enlarge.dialog}
      </main>
    </LazyMotion>
  )
}

const STAR_POINTS: Array<[number, number]> = [[15, 68], [32, 28], [50, 58], [68, 25], [84, 66]]
const STAR_LABELS = ['hello', 'late nights', 'that smile', 'the butterflies', 'this moment']
const NERVES = ['what if I fumble?', 'act casual bro', 'heartbeat too loud']
const VERDICT_LINES = ['The moon votes yes. Obviously.', 'The stars have already decided.', 'Even the clouds are blushing.']
const MOON_STARS: Array<[number, number]> = [[12, 22], [28, 12], [44, 28], [60, 10], [74, 24], [86, 14], [20, 42], [68, 44]]
/** How far (px) the moon travels from the horizon to the top of the sky. */
const MOON_RISE = 240

/** Fraction of the constellation path covered once `connectedCount` stars are connected. */
function constellationFraction(connectedCount: number): number {
  let total = 0
  const lengths: number[] = []
  for (let i = 1; i < STAR_POINTS.length; i++) {
    const len = Math.hypot(STAR_POINTS[i][0] - STAR_POINTS[i - 1][0], STAR_POINTS[i][1] - STAR_POINTS[i - 1][1])
    lengths.push(len)
    total += len
  }
  let covered = 0
  for (let i = 0; i < Math.min(connectedCount - 1, lengths.length); i++) covered += lengths[i]
  return total === 0 ? 0 : covered / total
}

export function ProposeExperience({ gift, previewPhotos, testPlay = false }: { gift: Gift; previewPhotos?: readonly string[]; testPlay?: boolean }) {
  const photos = gift.photos ?? []
  const [stage, setStage] = useState(() => initialStage(PROPOSE_FINALE_STAGE))
  const [moonPlaced, setMoonPlaced] = useState(false)
  const [moonProgress, setMoonProgress] = useState(0)
  const [checkpoint, setCheckpoint] = useState(0)
  const [reaction, setReaction] = useState('The universe needs three very serious answers.')
  const [connected, setConnected] = useState<number[]>([])
  const [nerves, setNerves] = useState<number[]>([])
  const [photosViewed, setPhotosViewed] = useState<number[]>([])
  const [failedPhotos, setFailedPhotos] = useState<number[]>([])
  const [verdicts, setVerdicts] = useState<number[]>([])
  const [surrendered, setSurrendered] = useState(false)
  const [noTease, setNoTease] = useState(false)
  const [yesTapped, setYesTapped] = useState(false)
  const [launching, setLaunching] = useState(false)
  const enlarge = usePhotoEnlarge('A star from the sky.')
  const [reducedMotion] = useState(() => prefersReducedMotion())

  // Refs for effect-driven mutations (avoid stale closures in GSAP callbacks).
  const connectedRef = useRef<number[]>([])
  const nervesRef = useRef<number[]>([])
  const dodgesRef = useRef(0)
  const checkpointRef = useRef(0)
  const verdictsRef = useRef<number[]>([])
  const moonRef = useRef<HTMLDivElement | null>(null)
  const moonSkyRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const orbRef = useRef<HTMLDivElement | null>(null)
  const starRefs = useRef<Array<HTMLButtonElement | null>>([])
  const drawPathRef = useRef<SVGPathElement | null>(null)
  const draggingConstellationRef = useRef(false)
  const nerveRefs = useRef<Array<HTMLButtonElement | null>>([])
  const photoWrapRef = useRef<HTMLDivElement | null>(null)
  const verdictStarRefs = useRef<Array<HTMLButtonElement | null>>([])
  const verdictSlotRefs = useRef<Array<HTMLDivElement | null>>([])
  const verdictLineRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const revealedVerdictsRef = useRef<Set<number>>(new Set())
  const yesRef = useRef<HTMLButtonElement | null>(null)
  const noRef = useRef<HTMLButtonElement | null>(null)
  const streakPathRef = useRef<SVGPathElement | null>(null)
  const lastDodgeRef = useRef(0)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const yesXToRef = useRef<((value: number) => void) | null>(null)
  const yesYToRef = useRef<((value: number) => void) | null>(null)
  const noXToRef = useRef<((value: number) => void) | null>(null)
  const noYToRef = useRef<((value: number) => void) | null>(null)

  const proposeState: ProposeStageState = {
    moonRaised: moonPlaced,
    answersGiven: checkpoint,
    starsConnected: connected.length,
    nervesPopped: nerves.length,
    photosViewed: photosViewed.length,
    photoCount: photos.length,
    verdictsAligned: verdicts.length,
    yesTapped,
  }

  const advance = () => { if (canAdvancePropose(stage, proposeState)) setStage(nextProposeStage(stage)) }

  const reset = () => {
    connectedRef.current = []
    nervesRef.current = []
    dodgesRef.current = 0
    checkpointRef.current = 0
    verdictsRef.current = []
    revealedVerdictsRef.current = new Set()
    setStage(1)
    setMoonPlaced(false)
    setMoonProgress(0)
    setCheckpoint(0)
    setReaction('The universe needs three very serious answers.')
    setConnected([])
    setNerves([])
    setPhotosViewed([])
    setFailedPhotos([])
    setVerdicts([])
    setSurrendered(false)
    setNoTease(false)
    setYesTapped(false)
    setLaunching(false)
  }

  const questions = [
    { q: `${gift.from} steals your fries. Legal response?`, a: ['fake gussa, then share', 'steal dessert back'], r: 'Healthy conflict resolution. Court approves.' },
    { q: 'Ideal date duration?', a: ['2 hours, civilized', 'accidentally till 2 AM'], r: '“Accidentally.” Sure. Bilkul believable.' },
    { q: `When ${gift.extras.nickname || gift.to} smiles, system status?`, a: ['normal-ish', 'brain.exe has stopped'], r: 'Diagnostic complete: butterflies, chronic.' },
  ]

  const photoSrcAt = (index: number): string => previewPhotos?.[index] ?? photoSrc(photos[index])

  const viewPhoto = (index: number, src: string, caption: string, trigger: HTMLElement) => {
    setPhotosViewed((prev) => (prev.includes(index) ? prev : [...prev, index]))
    enlarge.open(src, caption, `Photo ${index + 1}`, trigger)
  }

  // The moon's travel is the sky's height minus the moon and a top margin,
  // so it lands at the top of the sky on any screen size.
  const moonRise = () => {
    const sky = moonSkyRef.current
    const moon = moonRef.current
    if (!sky || !moon) return MOON_RISE
    return Math.max(120, sky.clientHeight - moon.clientHeight - 30)
  }

  // --- Stage 1: Raise the Moon (GSAP Draggable, vertical) ---
  const completeMoon = () => {
    const moon = moonRef.current
    if (moon) {
      if (reducedMotion) gsap.set(moon, { y: -moonRise() })
      else gsap.to(moon, { y: -moonRise(), duration: 0.6, ease: 'power3.out' })
    }
    setMoonProgress(100)
    setMoonPlaced(true)
    ambience.playChime()
  }

  useEffect(() => {
    if (stage !== 1 || reducedMotion) return
    const moon = moonRef.current
    if (!moon) return
    const rise = moonRise()
    const drag = Draggable.create(moon, {
      type: 'y',
      bounds: { minY: -rise, maxY: 0 },
      onDrag(this: Draggable) {
        setMoonProgress(Math.round((-this.y / rise) * 100))
      },
      onDragEnd(this: Draggable) {
        const progress = -this.y / rise
        if (progress >= 0.6) {
          completeMoon()
        } else {
          gsap.to(moon, { y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
          setMoonProgress(0)
        }
      },
    })[0]
    return () => { drag.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // --- Stage 2: Cosmic Background Check (swipe the question card) ---
  const flyCardToOrb = (onDone: () => void) => {
    const card = cardRef.current
    const orb = orbRef.current
    if (!card || !orb || reducedMotion) { onDone(); return }
    const cr = card.getBoundingClientRect()
    const or = orb.getBoundingClientRect()
    const dx = or.left + or.width / 2 - (cr.left + cr.width / 2)
    const dy = or.top + or.height / 2 - (cr.top + cr.height / 2)
    gsap.to(card, {
      x: dx, y: dy, scale: 0.15, opacity: 0, rotation: 8, duration: 0.45, ease: 'power2.in',
      onComplete: () => {
        gsap.set(card, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 0 })
        onDone()
        requestAnimationFrame(() => { gsap.to(card, { opacity: 1, duration: 0.25 }) })
      },
    })
  }

  const chooseAnswer = (index: number) => {
    const current = checkpointRef.current
    if (current >= questions.length) return
    setReaction(`${questions[current].a[index]} — ${questions[current].r}`)
    flyCardToOrb(() => {
      checkpointRef.current = current + 1
      setCheckpoint(current + 1)
    })
  }

  useEffect(() => {
    if (stage !== 2 || reducedMotion) return
    const card = cardRef.current
    if (!card) return
    const drag = Draggable.create(card, {
      type: 'x',
      bounds: { minX: -200, maxX: 200 },
      onDragEnd(this: Draggable) {
        if (this.x > 90) chooseAnswer(1)
        else if (this.x < -90) chooseAnswer(0)
        else gsap.to(card, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
      },
    })[0]
    return () => { drag.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // --- Stage 3: Draw the Constellation (DrawSVG) ---
  const connectStar = (index: number) => {
    if (index !== connectedRef.current.length || connectedRef.current.includes(index)) return
    connectedRef.current = [...connectedRef.current, index]
    setConnected(connectedRef.current)
    ambience.playTwinkle()
    const target = starRefs.current[index]
    if (target && !reducedMotion) {
      gsap.fromTo(target, { scale: 0.7 }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' })
    }
    if (index === STAR_POINTS.length - 1 && target) {
      const rect = target.getBoundingClientRect()
      confetti({
        particleCount: 26, spread: 60, startVelocity: 18, ticks: 160, scalar: 0.9,
        shapes: ['star'],
        origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
        colors: ['#ffd97a', '#a985ff', '#ffffff'], disableForReducedMotion: true,
      })
    }
  }

  const connectNext = () => {
    if (connectedRef.current.length < STAR_POINTS.length) connectStar(connectedRef.current.length)
  }

  const connectNearestStar = (clientX: number, clientY: number) => {
    let nearest = -1
    let nearestDistance = 70
    starRefs.current.forEach((el, index) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const distance = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2))
      if (distance < nearestDistance) { nearestDistance = distance; nearest = index }
    })
    if (nearest >= 0) connectStar(nearest)
  }

  useEffect(() => {
    if (stage !== 3) return
    const path = drawPathRef.current
    if (!path) return
    // The path starts fully hidden; the reveal below animates it per star.
    gsap.set(path, { drawSVG: '0% 0%' })
  }, [stage])

  useEffect(() => {
    if (stage !== 3 || connected.length === 0) return
    const path = drawPathRef.current
    if (!path) return
    const fraction = constellationFraction(connected.length)
    if (reducedMotion) gsap.set(path, { drawSVG: `0% ${fraction * 100}%` })
    else gsap.to(path, { drawSVG: `0% ${fraction * 100}%`, duration: 0.45, ease: 'power2.out' })
  }, [connected, stage, reducedMotion])

  // --- Stage 4: Pop the Nerves (fling off the orbit) ---
  const popNerve = (index: number) => {
    if (nervesRef.current.includes(index)) return
    nervesRef.current = [...nervesRef.current, index]
    setNerves(nervesRef.current)
    ambience.playPop()
  }

  useEffect(() => {
    if (stage !== 4 || reducedMotion) return
    const draggables = nerveRefs.current.map((el, index) => {
      if (!el) return null
      return Draggable.create(el, {
        type: 'x,y',
        onDragEnd(this: Draggable) {
          if (Math.hypot(this.x, this.y) > 110) {
            gsap.to(el, {
              x: this.x * 3, y: this.y * 3 - 100, rotation: 30, opacity: 0,
              duration: 0.45, ease: 'power2.in', onComplete: () => popNerve(index),
            })
          } else {
            gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
          }
        },
      })[0]
    })
    return () => { draggables.forEach((d) => d?.kill()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // --- Stage 5: Photo Stars (fan-in) ---
  useEffect(() => {
    if (stage !== 5 || reducedMotion) return
    const wrap = photoWrapRef.current
    if (!wrap) return
    const cards = wrap.querySelectorAll('.photo-star')
    if (cards.length === 0) return
    gsap.from(cards, { y: 30, opacity: 0, rotation: (i: number) => -6 + i * 4, stagger: 0.1, duration: 0.5, ease: 'back.out(1.6)' })
  }, [stage, reducedMotion])

  // --- Stage 6: The Sky Votes (drag verdict stars into alignment) ---
  const alignStar = (index: number) => {
    if (verdictsRef.current.includes(index)) return
    const star = verdictStarRefs.current[index]
    const slot = verdictSlotRefs.current[index]
    if (star && slot && !reducedMotion) {
      const sr = star.getBoundingClientRect()
      const lr = slot.getBoundingClientRect()
      const dx = lr.left + lr.width / 2 - (sr.left + sr.width / 2)
      const dy = lr.top + lr.height / 2 - (sr.top + sr.height / 2)
      gsap.to(star, { x: dx, y: dy, duration: 0.5, ease: 'back.out(1.5)' })
    }
    verdictsRef.current = [...verdictsRef.current, index]
    setVerdicts(verdictsRef.current)
    ambience.playTwinkle()
  }

  useEffect(() => {
    if (stage !== 6 || reducedMotion) return
    const draggables = verdictStarRefs.current.map((el, index) => {
      if (!el) return null
      return Draggable.create(el, {
        type: 'x,y',
        onDragEnd(this: Draggable) {
          const slot = verdictSlotRefs.current[index]
          if (slot && this.hitTest(slot, '50%')) alignStar(index)
          else gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
        },
      })[0]
    })
    return () => { draggables.forEach((d) => d?.kill()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // SplitText reveal for each verdict line as its star aligns.
  useEffect(() => {
    if (stage !== 6 || reducedMotion) return
    verdicts.forEach((index) => {
      if (revealedVerdictsRef.current.has(index)) return
      revealedVerdictsRef.current.add(index)
      const el = verdictLineRefs.current[index]
      if (!el) return
      const split = new SplitText(el, { type: 'chars' })
      gsap.from(split.chars, {
        opacity: 0, y: 10, stagger: 0.02, duration: 0.4, ease: 'power2.out',
        onComplete: () => split.revert(),
      })
    })
  }, [verdicts, stage, reducedMotion])

  // --- Stage 7: The Big Question (magnetic Yes, fair-dodging No) ---
  const dodge = (clientX: number, clientY: number) => {
    if (surrendered) return
    const no = noRef.current
    if (!no) return
    const next = dodgeNo(dodgesRef.current)
    dodgesRef.current = next.count
    if (next.surrendered) {
      setSurrendered(true)
      if (!reducedMotion) gsap.to(no, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
      return
    }
    if (reducedMotion) return
    const rect = no.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = cx - clientX
    let dy = cy - clientY
    const len = Math.hypot(dx, dy) || 1
    dx = (dx / len) * 90
    dy = (dy / len) * 60
    const xTo = noXToRef.current
    const yTo = noYToRef.current
    if (xTo && yTo) {
      xTo(Math.max(-110, Math.min(110, dx)))
      yTo(Math.max(-60, Math.min(60, dy)))
    } else {
      gsap.to(no, { x: Math.max(-110, Math.min(110, dx)), y: Math.max(-60, Math.min(60, dy)), duration: 0.3, ease: 'power3.out' })
    }
  }

  const handleNoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (surrendered) {
      setNoTease(true)
      const yes = yesRef.current
      if (yes && !reducedMotion) gsap.fromTo(yes, { scale: 1 }, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 3, ease: 'power1.inOut' })
      return
    }
    dodge(event.clientX, event.clientY)
  }

  const handleQuestionPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    const yes = yesRef.current
    const no = noRef.current
    if (!yes || !no || reducedMotion) return
    const yesRect = yes.getBoundingClientRect()
    const yesCx = yesRect.left + yesRect.width / 2
    const yesCy = yesRect.top + yesRect.height / 2
    const yesDistance = Math.hypot(event.clientX - yesCx, event.clientY - yesCy)
    if (yesDistance < 130) {
      const xTo = yesXToRef.current
      const yTo = yesYToRef.current
      const pullX = Math.max(-14, Math.min(14, (event.clientX - yesCx) * 0.25))
      const pullY = Math.max(-14, Math.min(14, (event.clientY - yesCy) * 0.25))
      if (xTo && yTo) { xTo(pullX); yTo(pullY) }
    } else {
      yesXToRef.current?.(0)
      yesYToRef.current?.(0)
    }
    const noRect = no.getBoundingClientRect()
    const noCx = noRect.left + noRect.width / 2
    const noCy = noRect.top + noRect.height / 2
    if (!surrendered && Math.hypot(event.clientX - noCx, event.clientY - noCy) < 90 && Date.now() - lastDodgeRef.current > 400) {
      lastDodgeRef.current = Date.now()
      dodge(event.clientX, event.clientY)
    }
  }

  useEffect(() => {
    if (stage !== 7) return
    const yes = yesRef.current
    const no = noRef.current
    const streak = streakPathRef.current
    if (streak) gsap.set(streak, { drawSVG: '0% 0%' })
    if (!yes || !no || reducedMotion) return
    yesXToRef.current = gsap.quickTo(yes, 'x', { duration: 0.3, ease: 'power3' })
    yesYToRef.current = gsap.quickTo(yes, 'y', { duration: 0.3, ease: 'power3' })
    noXToRef.current = gsap.quickTo(no, 'x', { duration: 0.3, ease: 'power3' })
    noYToRef.current = gsap.quickTo(no, 'y', { duration: 0.3, ease: 'power3' })
    return () => {
      yesXToRef.current = null
      yesYToRef.current = null
      noXToRef.current = null
      noYToRef.current = null
    }
  }, [stage, reducedMotion])

  const sayYes = () => {
    if (launching) return
    setLaunching(true)
    setYesTapped(true)
    ambience.playLaunch()
    vibrate([15, 40, 15])
    const streak = streakPathRef.current
    if (streak && !reducedMotion) {
      gsap.to(streak, { drawSVG: '0% 100%', duration: 0.6, ease: 'power2.in' })
      window.setTimeout(() => setStage(PROPOSE_FINALE_STAGE), 650)
    } else {
      setStage(PROPOSE_FINALE_STAGE)
    }
  }

  // --- Finale: star-burst confetti ---
  useEffect(() => {
    if (stage !== PROPOSE_FINALE_STAGE || reducedMotion) return
    confetti({
      particleCount: 70, spread: 80, origin: { y: 0.6 }, scalar: 1, ticks: 220,
      shapes: ['star'], colors: ['#ffd97a', '#a985ff', '#ffffff'], disableForReducedMotion: true,
    })
  }, [stage, reducedMotion])

  return (
    <LazyMotion features={domAnimation}>
      <main className="sky-world expanded-world propose-world">
        <div className="star-field">{Array.from({ length: 64 }, (_, i) => <i key={i} style={{ '--x': `${(i * 47) % 100}%`, '--y': `${(i * 31) % 92}%`, '--d': `${i % 7}s` } as React.CSSProperties} />)}</div>
        <div className="shooting-star" aria-hidden="true" />
        {stage < PROPOSE_FINALE_STAGE && <StageTop label="WRITTEN IN THE STARS" step={stage} total={PROPOSE_STAGE_TOTAL} />}
        <AnimatePresence mode="wait">
          <m.div
            key={stage}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="propose-stage-wrap"
          >
            {stage === 1 && (
              <section className="experience-intro sky-intro propose-moon-stage">
                <span className="kicker">TRANSMISSION FROM SOMEONE ACTING NORMAL</span>
                <h1>{gift.to}, the sky has<br /><em>a suspicious agenda.</em></h1>
                <p>Big question abhi nahi. Universe pehle vibe check karega. Very professional setup.</p>
                <div className="moon-sky" ref={moonSkyRef}>
                  {MOON_STARS.map(([x, y], i) => (
                    <i key={i} className={moonProgress >= (i + 1) * 12.5 ? 'lit' : ''} style={{ left: `${x}%`, top: `${y}%` }} />
                  ))}
                  <div className="moon-drag" ref={moonRef} aria-hidden="true"><span>☾</span><b>for {gift.to}</b></div>
                </div>
                <p className="moon-hint">{moonPlaced ? `The moon is up. ${gift.to}, the sky is ready.` : 'Drag the moon up into the sky — or light it for me.'}</p>
                {!moonPlaced && <button className="secondary-button" onClick={completeMoon}>Light the moon</button>}
                {canAdvancePropose(1, proposeState) && <button className="world-button" onClick={advance}>Begin the cosmic background check <Icon name="spark" /></button>}
              </section>
            )}

            {stage === 2 && (
              <section className="cosmic-checkpoint scene-panel">
                <div className="checkpoint-orb" ref={orbRef}><div className="orb-core">{checkpoint < 3 ? checkpoint + 1 : '✓'}</div>{Array.from({ length: 3 }, (_, i) => <i className={i < checkpoint ? 'lit' : ''} key={i} />)}</div>
                <div className="checkpoint-card" ref={cardRef}><span>COMPATIBILITY CHECK · DEFINITELY SCIENTIFIC</span>{checkpoint < questions.length ? <><h2>{questions[checkpoint].q}</h2><div>{questions[checkpoint].a.map((item, i) => <button key={item} onClick={() => chooseAnswer(i)}>{item}</button>)}</div><p className="stage-hint">Swipe the card left or right to answer — or just tap.</p></> : <><h2>Result: suspiciously adorable.</h2><p>No red flags detected. Bas thoda overthinking aur bohot saara pyaar.</p><button className="world-button" onClick={advance}>Unlock the hidden constellation <Icon name="arrow" /></button></>}<blockquote>{reaction}</blockquote></div>
              </section>
            )}

            {stage === 3 && (
              <section
                className="constellation-stage"
                onPointerDown={(event) => { draggingConstellationRef.current = true; connectNearestStar(event.clientX, event.clientY) }}
                onPointerMove={(event) => { if (event.buttons === 1 && draggingConstellationRef.current) connectNearestStar(event.clientX, event.clientY) }}
                onPointerUp={() => { draggingConstellationRef.current = false }}
                onPointerLeave={() => { draggingConstellationRef.current = false }}
              >
                <div className="sky-instruction"><span>CONNECT WHAT WAS ALWAYS THERE</span><h2>Draw the line between the stars.</h2><p>{connected.length}/5 aligned · destiny dramatic mode mein hai…</p></div>
                <svg className="constellation-lines expanded propose-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline points="15,68 32,28 50,58 68,25 84,66" />
                  <path ref={drawPathRef} className="drawn-line" d="M15,68 L32,28 L50,58 L68,25 L84,66" fill="none" />
                </svg>
                {STAR_POINTS.map((pos, i) => (
                  <button
                    aria-label={`Star ${i + 1}: ${STAR_LABELS[i]}`}
                    key={i}
                    className={`big-star ${connected.includes(i) ? 'lit' : ''}`}
                    style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }}
                    ref={(el) => { starRefs.current[i] = el }}
                    onClick={connectNext}
                  >✦<small>{connected.includes(i) ? STAR_LABELS[i] : i + 1}</small></button>
                ))}
                <p className="stage-hint constellation-hint">Tap the stars in order, or drag across them.</p>
                {connected.length === 5 && <button className="world-button floating-next" onClick={advance}>Follow the constellation <Icon name="spark" /></button>}
              </section>
            )}

            {stage === 4 && (
              <section className="proposal-chamber scene-panel propose-nerves">
                <div className="nervous-orbit">
                  {NERVES.map((thought, i) => (
                    <button
                      className={nerves.includes(i) ? 'popped' : ''}
                      onClick={() => popNerve(i)}
                      key={thought}
                      style={{ '--n': i } as React.CSSProperties}
                      ref={(el) => { nerveRefs.current[i] = el }}
                      aria-label={`Pop the nervous thought: ${thought}`}
                    >{thought}</button>
                  ))}
                  <div className={`proposal-heart ${nerves.length === 3 ? 'steady' : ''}`}><Icon name="heart" size={60} /><span>{nerves.length === 3 ? 'ready' : `${3 - nerves.length} nervous thoughts`}</span></div>
                </div>
                <p className="stage-hint nerves-hint">Fling each nervous thought off the orbit — or tap it to pop.</p>
                {canAdvancePropose(4, proposeState) && <button className="world-button floating-next" onClick={advance}>The heart is steady — see the sky vote <Icon name="arrow" /></button>}
              </section>
            )}

            {stage === 5 && (
              <section className="photo-stars-stage scene-panel">
                <div className="photo-stage-copy">
                  <span>PHOTOS, WRITTEN IN THE STARS</span>
                  <h2>Photos tucked among the stars.</h2>
                  <p>{photos.length === 0 ? 'No photos tucked in this time — the stars carry it.' : 'Tap a photo-star to see it big. Open at least one to continue.'}</p>
                </div>
                {photos.length === 0 ? (
                  <div className="photo-empty propose-photo-empty">
                    <div className="empty-stars" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i></div>
                    <p>The sky is all words today — and the words are enough.</p>
                  </div>
                ) : (
                  <div className="photo-stars-wrap" ref={photoWrapRef}>
                    {photos.map((photo, index) => (
                      failedPhotos.includes(index) ? (
                        <div className="photo-star photo-failed" key={photo.photoKey || index}>
                          <span className="photo-placeholder">✦</span>
                          <span>{photo.caption || 'A star that could not load.'}</span>
                        </div>
                      ) : (
                        <button
                          className={`photo-star ${photosViewed.includes(index) ? 'viewed' : ''}`}
                          key={photo.photoKey || index}
                          style={{ '--tilt': `${-6 + index * 4}deg` } as React.CSSProperties}
                          onClick={(event) => viewPhoto(index, photoSrcAt(index), photo.caption, event.currentTarget)}
                          aria-label={`Enlarge photo ${index + 1}`}
                        >
                          <img src={photoSrcAt(index)} alt={photo.caption || `Photo ${index + 1}`} onError={() => setFailedPhotos((prev) => (prev.includes(index) ? prev : [...prev, index]))} />
                          <span>{photo.caption || 'a favourite moment'}</span>
                          <b className="enlarge-badge" aria-hidden="true">⤢</b>
                        </button>
                      )
                    ))}
                  </div>
                )}
                {canAdvancePropose(5, proposeState) && <button className="world-button" onClick={advance}>Hear what the sky says <Icon name="arrow" /></button>}
              </section>
            )}

            {stage === 6 && (
              <section className="sky-votes-stage scene-panel">
                <div className="sky-votes-copy">
                  <span>THE SKY HAS AN OPINION</span>
                  <h2>The sky votes.</h2>
                  <p>Drag each verdict star into the row — or tap a star, then tap its place.</p>
                </div>
                <div className="verdict-field">
                  {VERDICT_LINES.map((_, i) => (
                    <button
                      key={i}
                      className={`verdict-star ${verdicts.includes(i) ? 'aligned' : ''}`}
                      style={{ left: `${[12, 46, 80][i]}%`, top: `${[18, 62, 26][i]}%` }}
                      ref={(el) => { verdictStarRefs.current[i] = el }}
                      onClick={() => alignStar(i)}
                      aria-label={`Align verdict star ${i + 1}`}
                    >✦</button>
                  ))}
                </div>
                <div className="verdict-slots">
                  {VERDICT_LINES.map((_, i) => (
                    <div
                      key={i}
                      className={`verdict-slot ${verdicts.includes(i) ? 'filled' : ''}`}
                      ref={(el) => { verdictSlotRefs.current[i] = el }}
                      onClick={() => alignStar(i)}
                      aria-label={`Place for verdict star ${i + 1}`}
                    >{verdicts.includes(i) ? '✦' : '·'}</div>
                  ))}
                </div>
                <div className="verdict-lines">
                  {VERDICT_LINES.map((line, i) => (
                    verdicts.includes(i) ? (
                      <p key={i} ref={(el) => { verdictLineRefs.current[i] = el }}>{line}</p>
                    ) : null
                  ))}
                </div>
                {verdicts.length === 3 && (
                  <>
                    <p className="verdict-unanimous">Unanimous. The sky has spoken.</p>
                    <button className="world-button" onClick={advance}>Ask the big question <Icon name="arrow" /></button>
                  </>
                )}
              </section>
            )}

            {stage === 7 && (
              <section
                className="proposal-chamber scene-panel propose-question"
                onPointerMove={handleQuestionPointerMove}
                onPointerLeave={() => { yesXToRef.current?.(0); yesYToRef.current?.(0) }}
              >
                <svg className="shooting-streak" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path ref={streakPathRef} d="M2,12 L98,88" fill="none" />
                </svg>
                <div className="proposal-card">
                  <span>{gift.from.toUpperCase()} HAS STOPPED PRETENDING TO BE CHILL</span>
                  <h2>{gift.extras.question}</h2>
                  <p>Take your time. But also the “no” button has hired a lawyer.</p>
                  <div>
                    <button className="yes-button" ref={yesRef} onClick={sayYes} disabled={launching}>{gift.extras.yesLabel || 'Yes, obviously'}</button>
                    <button className="no-button" ref={noRef} onMouseEnter={(event) => dodge(event.clientX, event.clientY)} onClick={handleNoClick} disabled={launching}>Let me act expensive</button>
                  </div>
                  {noTease && <p className="no-tease" role="status">Okay okay — the universe has decided for you.</p>}
                  {surrendered && !noTease && <p className="no-tease" role="status">The “no” button has officially given up.</p>}
                </div>
              </section>
            )}

            {stage === PROPOSE_FINALE_STAGE && (
              <Finale
                gift={gift}
                badge="💍 COSMICALLY CONFIRMED · NO TAKEBACKS"
                title={<>Plot twist:<br /><em>the universe ships you two.</em></>}
                actions={testPlay ? { onReplay: reset, replayLabel: '↻ Replay the proposal' } : { onReplay: reset, shareUrl: window.location.href, replayLabel: '↻ Replay the proposal' }}
              >
                <p>Dear {gift.extras.nickname || gift.to}, you just made one dramatic human extremely happy.</p>
                <blockquote>“{gift.message}”</blockquote>
                <p className="finale-hinglish">Screenshot le lo. Kal ko bole “maine कब haan bola?” toh evidence ready hai.</p>
                {photos.length > 0 && (
                  <div className="finale-photo-fan">
                    {photos.map((photo, index) => (
                      failedPhotos.includes(index) ? null : (
                        <button
                          key={photo.photoKey || index}
                          className="finale-fan-photo propose-fan-photo"
                          style={{ '--tilt': `${-10 + index * 7}deg` } as React.CSSProperties}
                          onClick={(event) => viewPhoto(index, photoSrcAt(index), photo.caption, event.currentTarget)}
                          aria-label={`Enlarge photo ${index + 1}`}
                        >
                          <img src={photoSrcAt(index)} alt={photo.caption || `Photo ${index + 1}`} onError={() => setFailedPhotos((prev) => (prev.includes(index) ? prev : [...prev, index]))} />
                        </button>
                      )
                    ))}
                  </div>
                )}
              </Finale>
            )}
          </m.div>
        </AnimatePresence>
        {enlarge.dialog}
      </main>
    </LazyMotion>
  )
}

export function ChocolateExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(initialStage)
  const [temperature, setTemperature] = useState(30)
  const [stirs, setStirs] = useState(0)
  const [mould, setMould] = useState('')
  const [toppings, setToppings] = useState<string[]>([])
  const [opened, setOpened] = useState<number[]>([])
  const flavours = ['softie detected', 'high cocoa, higher standards', 'chaos but cute', 'certified snack thief', 'sweet with plot twists', 'secret centre']
  const tempered = temperature >= 47 && temperature <= 56 && stirs >= 6

  if (stage === 5) return <Finale gift={gift} badge="GOLDEN TICKET · FULLY EDIBLE FEELINGS" title={<>Sweetness report:<br /><em>{gift.to} wins the whole box.</em></>}><p>{gift.extras.reward}</p><blockquote>“{gift.extras.tease}”</blockquote><p className="finale-hinglish">Sharing optional hai. Mere saath share karna morally correct hai, bas keh raha hoon.</p></Finale>

  return <main className="chocolate-world expanded-world"><StageTop label="THE SWEET HEIST" step={stage} total={5} />
    {stage === 1 && <section className="experience-intro chocolate-intro"><div className="choco-logo"><span>THE</span><b>SWEET<br />HEIST</b><small>for {gift.to}</small></div><h1>We’re making a chocolate<br /><em>with your exact energy.</em></h1><p>Flavour file: {gift.extras.flavour}. Warning: tasting may cause smiling at the screen.</p><button className="world-button" onClick={() => setStage(2)}>Enter the secret kitchen <Icon name="arrow" /></button></section>}
    {stage === 2 && <section className="temper-lab scene-panel"><div className="chocolate-cauldron" style={{ '--stir': `${stirs * 36}deg`, '--heat': temperature / 100 } as React.CSSProperties}><div className="chocolate-liquid"><i /><i /><i /></div><button onClick={() => setStirs((value) => Math.min(10, value + 1))}><span>↻</span> STIR</button></div><div className="temper-controls"><span>CHOCOLATE PHYSICS · BUT ROMANTIC</span><h2>Temper the drama.</h2><p>Temperature sweet spot mein lao, then stir six times. Bilkul relationship jaisa: warmth + effort.</p><label><b>{temperature}°</b><input type="range" min="20" max="80" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /><span><i style={{ left: '45%' }} />sweet spot 47–56°</span></label><div className="stir-count">{Array.from({ length: 6 }, (_, i) => <i className={i < stirs ? 'done' : ''} key={i} />)}<small>{stirs < 6 ? `${6 - stirs} stirs बाकी` : 'smooth enough to flirt'}</small></div>{tempered && <button className="world-button" onClick={() => setStage(3)}>Pour the good stuff <Icon name="spark" /></button>}</div></section>}
    {stage === 3 && <section className="choco-atelier scene-panel"><div className={`choco-mould mould-${mould || 'blank'}`}><div>{Array.from({ length: 6 }, (_, i) => <i key={i}>{mould === 'heart' ? '♥' : mould === 'moon' ? '◐' : mould === 'chaos' ? ['★','♥','?','✦','☺','!'][i] : ''}</i>)}</div>{toppings.map((item, i) => <span key={item} style={{ '--i': i } as React.CSSProperties}>{item === 'crunch' ? '◆' : item === 'berries' ? '●' : '✦'}</span>)}</div><div className="atelier-controls"><span>DESIGN THE BITE</span><h2>Pick a shape. Add personality.</h2><label>MOULD ENERGY</label><div className="mould-options">{['heart','moon','chaos'].map((item) => <button className={mould === item ? 'selected' : ''} onClick={() => setMould(item)} key={item}>{item}</button>)}</div><label>CHOOSE ANY TWO TOPPINGS</label><div className="topping-options">{['crunch','berries','sparkle'].map((item) => <button className={toppings.includes(item) ? 'selected' : ''} onClick={() => setToppings((items) => items.includes(item) ? items.filter((value) => value !== item) : items.length < 2 ? [...items, item] : items)} key={item}>{item}</button>)}</div><p>{mould && toppings.length === 2 ? `Chef’s note: ${gift.to} has elite taste. Annoying, but true.` : 'The chocolate is judging your indecision respectfully.'}</p>{mould && toppings.length === 2 && <button className="world-button" onClick={() => setStage(4)}>Seal the custom box <Icon name="arrow" /></button>}</div></section>}
    {stage === 4 && <section className="chocolate-stage expanded-box"><div className="chocolate-copy"><span>CASE FILE: {gift.to.toUpperCase()}</span><h2>Find the golden centre.</h2><p>Open any three. Har piece ke andar ek highly confidential opinion hai.</p></div><div className="chocolate-box">{flavours.map((flavour, i) => <button key={flavour} className={`chocolate-piece piece-${i} ${opened.includes(i) ? 'unwrapped' : ''}`} onClick={() => !opened.includes(i) && setOpened([...opened, i])}><span className="wrapper">{['◆','●','♥','✦','■','?'][i]}</span><span className="choco-reveal">{flavour}</span></button>)}</div><div className="taste-meter"><span>Your official taste</span><b>{opened.length < 3 ? `${3 - opened.length} more very scientific samples` : 'excellent. obviously.'}</b><i><em style={{ width: `${Math.min(opened.length / 3 * 100, 100)}%` }} /></i></div>{opened.length >= 3 && <div className="golden-ticket"><span>✦ GOLDEN TICKET ✦</span><h3>{gift.extras.reward}</h3><button onClick={() => setStage(5)}>Bite into the surprise <Icon name="arrow" size={17} /></button></div>}</section>}
  </main>
}

function TeddyCharacter({ mood, accessory, hug = 0, speaking = false }: { mood: string; accessory: string; hug?: number; speaking?: boolean }) {
  return <div className={`big-teddy teddy-${mood} accessory-${accessory || 'none'} ${hug >= 100 ? 'fully-hugged' : ''} ${speaking ? 'speaking' : ''}`}><i className="ear left" /><i className="ear right" /><div className="teddy-head"><i className="eye left" /><i className="eye right" /><b>ᴗ</b><span className="teddy-accessory">{accessory === 'bow' ? ' bow ' : accessory === 'hoodie' ? 'hoodie' : accessory === 'glasses' ? '⌐■-■' : ''}</span></div><div className="teddy-body"><span>comfort<br /><strong>department</strong></span></div><i className="teddy-paw left" /><i className="teddy-paw right" /></div>
}

export function TeddyExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(initialStage)
  const [mood, setMood] = useState('soft')
  const [accessory, setAccessory] = useState('')
  const [patch, setPatch] = useState('')
  const [actions, setActions] = useState<string[]>([])
  const [speech, setSpeech] = useState('Hello. Main emotional support mein fresher hoon.')
  const [hug, setHug] = useState(0)
  const hold = useHoldProgress(setHug, 2, 34)
  const react = (action: string) => {
    if (!actions.includes(action)) setActions([...actions, action])
    setSpeech({ boop: 'Nose boop registered. Ab legally tum meri favourite ho.', tickle: 'HAHA— dignity gayi, friendship pakki.', secret: `Secret mode: ${gift.from} talks about you like you invented happiness.` }[action] || '')
  }

  if (stage === 5) return <Finale gift={gift} badge="COMFORT CREATURE · BONDED FOR LIFE" title={<>Emergency softness<br /><em>successfully activated.</em></>}><p>{gift.extras.comfort}</p><blockquote>{gift.extras.teddyName} comes with {gift.extras.trait}, {patch}, no expiry, and hugs from {gift.from}.</blockquote><p className="finale-hinglish">Bad day ho toh is page pe wapas aa jaana. Teddy attendance nahi lagata.</p></Finale>

  return <main className="teddy-world expanded-world"><StageTop label="BUILD-A-BAE LAB" step={stage} total={5} />
    {stage === 1 && <section className="experience-intro teddy-intro"><div className="lab-tag">SOFTNESS LAB · UNIT 10</div><h1>A tiny comfort employee<br /><em>is waiting to meet you.</em></h1><p>{gift.from} placed a custom order for {gift.to}. Priority shipping because apparently you’re “very precious.”</p><button className="world-button" onClick={() => setStage(2)}>Open the cuddle lab <Icon name="arrow" /></button><div className="teddy-parts"><i>●</i><i>⌒</i><i>♡</i></div></section>}
    {stage === 2 && <section className="teddy-builder scene-panel"><div className="teddy-pedestal"><TeddyCharacter mood={mood} accessory={accessory} /><span>{gift.extras.teddyName || 'Golu 2.0'}</span></div><div className="builder-controls"><span>PERSONALITY ASSEMBLY · NO BATTERIES</span><h2>Build their cuddle specialist.</h2><label>FACE ENERGY</label><div className="mood-options">{[['soft','softie'],['cool','too cool'],['chaos','chaos baby']].map(([key,label]) => <button className={mood === key ? 'chosen' : ''} onClick={() => setMood(key)} key={key}>{label}</button>)}</div><label>ACCESSORY WITH UNNECESSARY ATTITUDE</label><div className="mood-options">{['bow','hoodie','glasses'].map((item) => <button className={accessory === item ? 'chosen' : ''} onClick={() => setAccessory(item)} key={item}>{item}</button>)}</div><label>HEART PATCH</label><div className="patch-options">{['overthink shield','professional listener','snack guardian'].map((item) => <button className={patch === item ? 'chosen' : ''} onClick={() => setPatch(item)} key={item}>♥ {item}</button>)}</div>{accessory && patch && <button className="world-button" onClick={() => setStage(3)}>Wake up {gift.extras.teddyName || 'the teddy'} <Icon name="spark" /></button>}</div></section>}
    {stage === 3 && <section className="teddy-playroom scene-panel"><div className="teddy-chat"><div className="teddy-speech">{speech}</div><TeddyCharacter mood={mood} accessory={accessory} speaking={actions.length > 0} /></div><div className="play-controls"><span>SOCIALISATION TEST</span><h2>Teach the teddy your love language.</h2><p>Try all three. It has opinions. Bohot saare.</p><div>{[['boop','Boop the nose'],['tickle','Emergency tickle'],['secret','Ask for a secret']].map(([key,label]) => <button className={actions.includes(key) ? 'done' : ''} onClick={() => react(key)} key={key}><i>{actions.includes(key) ? '✓' : '+'}</i>{label}</button>)}</div>{actions.length === 3 && <button className="world-button" onClick={() => setStage(4)}>Run the final hug test <Icon name="heart" /></button>}</div></section>}
    {stage === 4 && <section className="teddy-hug-stage scene-panel"><div className="teddy-panel"><span>FINAL QUALITY CHECK</span><h2>Charge the cuddle core.</h2><p>Special power: <strong>{gift.extras.trait}</strong></p><div className="hug-meter"><span>HUG CHARGE</span><b>{hug}%</b><i><em style={{ width: `${hug}%` }} /></i><small>{hug < 35 ? 'Hold both paws. Sharam baad mein.' : hug < 75 ? 'A little tighter… haan, like that.' : hug < 100 ? 'Almost maximum pyaar!' : 'MAXIMUM SQUISH ACHIEVED'}</small></div>{hug >= 100 && <button className="world-button" onClick={() => setStage(5)}>Open the comfort pocket <Icon name="heart" /></button>}</div><div className="hug-teddy-wrap"><TeddyCharacter mood={mood} accessory={accessory} hug={hug} /><button className="hug-paw-zone" onPointerDown={hold.start} onPointerUp={hold.stop} onPointerLeave={hold.stop}>HOLD BOTH PAWS</button></div></section>}
  </main>
}

export function PromiseExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(initialStage)
  const [scan, setScan] = useState(0)
  const [verdict, setVerdict] = useState('Scanner online. Cringe filter: ruthless.')
  const [lit, setLit] = useState<number[]>([])
  const [seal, setSeal] = useState(0)
  const hold = useHoldProgress(setSeal, 2, 34)
  const cards = [
    'I promise to reply in 0.4 seconds, even during shampoo.',
    'I promise to say what I feel, even when it comes out clumsy.',
    'I promise I will never steal your fries. Ever.',
    gift.extras.promise1,
  ]
  const promises = [gift.extras.promise1, gift.extras.promise2, gift.extras.promise3]
  const judge = (keep: boolean) => {
    const responses = [
      keep ? 'Rejected by reality. Shampoo has entered the chat.' : 'Correct. Unrealistic SLA detected.',
      keep ? 'Approved. Honest > perfectly worded.' : 'Scanner disagrees. Vulnerability is actually hot.',
      keep ? 'Liar detected. Fries require a separate treaty.' : 'Correct. Protect yourself legally.',
      keep ? 'Approved. Creator-provided, dil-certified.' : 'Ouch. Personal promise ko reject kar diya? Bold.',
    ]
    setVerdict(responses[scan])
    setScan((value) => value + 1)
  }

  if (stage === 5) return <Finale gift={gift} badge="PINKY-SEALED · CRINGE-SCANNED · REAL" title={<>Not perfect promises.<br /><em>Present ones.</em></>}><p>Big dramatic claims nahi. Bas the kind of choosing that happens again and again.</p><blockquote>Sealed by {gift.to} + {gift.from}, somewhere on the internet ✦</blockquote><p className="finale-hinglish">Terms apply: sulking allowed, disappearing without “reached?” text not allowed.</p></Finale>

  return <main className="promise-world expanded-world"><div className="promise-stars" /><StageTop label="THE PINKY PROTOCOL" step={stage} total={5} />
    {stage === 1 && <section className="experience-intro promise-intro"><span className="kicker">WORDS THAT PLAN TO SHOW UP</span><h1>Promises, but without<br /><em>the copy-paste filmy nonsense.</em></h1><p>{gift.from} left three real ones here. First, our scanner must remove unrealistic boyfriend-girlfriend propaganda.</p><button className="world-button" onClick={() => setStage(2)}>Activate the cringe scanner <Icon name="spark" /></button></section>}
    {stage === 2 && <section className="promise-scanner scene-panel"><div className="scanner-machine"><div className="scanner-beam" /><span>TRUTH-O-METER</span><b>{scan < cards.length ? `${Math.round(scan / cards.length * 100)}%` : '100%'}</b><i><em style={{ height: `${Math.max(12, scan / cards.length * 100)}%` }} /></i></div><div className="scanner-card"><span>REAL PROMISE OR FULL FILMY?</span>{scan < cards.length ? <><h2>“{cards[scan]}”</h2><div><button onClick={() => judge(true)}>keep it</button><button onClick={() => judge(false)}>too filmy</button></div></> : <><h2>Calibration complete.</h2><p>Result: humour intact, sincerity unlocked, trust issues respectfully acknowledged.</p><button className="world-button" onClick={() => setStage(3)}>Receive the real promises <Icon name="arrow" /></button></>}<blockquote>{verdict}</blockquote></div></section>}
    {stage === 3 && <section className="promise-stage"><div className="promise-copy"><span>TOUCH EACH ONE TO KEEP IT</span><h2>A constellation for {gift.to}.</h2><p>Inko read nahi, receive karna hai.</p></div><div className="promise-orbit">{promises.map((promise, i) => <button className={lit.includes(i) ? 'lit' : ''} key={i} onClick={() => !lit.includes(i) && setLit([...lit, i])}><i>{i + 1}</i><p>{promise}</p><span>✦</span></button>)}<svg viewBox="0 0 100 100"><path d="M20 70 Q50 5 80 70" /></svg></div>{lit.length === 3 && <button className="world-button floating-next" onClick={() => setStage(4)}>Take them to the pinky chamber <Icon name="spark" /></button>}</section>}
    {stage === 4 && <section className="pinky-chamber scene-panel"><div className="pinky-ritual"><div className="pinky-hands expanded"><span>☝</span><i style={{ opacity: seal / 100, transform: `scale(${.3 + seal / 100})` }} /><span>☝</span></div><h2>{seal < 100 ? 'Hold the promise steady.' : 'Pinky protocol accepted.'}</h2><p>{seal < 35 ? 'Commitment loading… no pressure, बस hold.' : seal < 75 ? 'Words are becoming weight.' : seal < 100 ? 'Almost sealed. Don’t ghost the button.' : 'Universe witnessed it. Wi-Fi bhi stable tha.'}</p><button className="seal-button" onPointerDown={hold.start} onPointerUp={hold.stop} onPointerLeave={hold.stop}><i><em style={{ width: `${seal}%` }} /></i>{seal < 100 ? 'HOLD BOTH PINKIES TOGETHER' : 'SEALED · NO BORING LEGAL FONT'}</button>{seal >= 100 && <button className="world-button" onClick={() => setStage(5)}>Open the promise vault <Icon name="heart" /></button>}</div></section>}
  </main>
}

export function HugExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(initialStage)
  const [notes, setNotes] = useState<number[]>([])
  const [inhale, setInhale] = useState(false)
  const [breaths, setBreaths] = useState(0)
  const [warmth, setWarmth] = useState(0)
  const hold = useHoldProgress(setWarmth, 1, 25)
  const breathe = () => {
    if (inhale) setBreaths((value) => Math.min(3, value + 1))
    setInhale(!inhale)
  }

  if (stage === 5) return <Finale gift={gift} badge="DISTANCE · TEMPORARILY CANCELLED" title={<>You have been held.<br /><em>No explanation required.</em></>}><p>{gift.extras.whisper}</p><blockquote>Hug style: {gift.extras.hugStyle}. Duration: jitni der chahiye. Awkward back-pat: disabled.</blockquote><p className="finale-hinglish">Ab thoda paani piyo. Emotional scenes dehydrating hote hain.</p></Finale>

  return <main className="hug-world expanded-world" style={{ '--warmth': warmth / 100 } as React.CSSProperties}><StageTop label="THE WARMTH ROOM" step={stage} total={5} />
    {stage === 1 && <section className="experience-intro hug-intro"><span className="kicker">A ROOM THAT ASKS NOTHING FROM YOU</span><h1>You don’t have to<br /><em>be okay in here.</em></h1><p>{gift.extras.distance}</p><button className="world-button" onClick={() => setStage(2)}>Come inside, shoes optional <Icon name="arrow" /></button><div className="window-scene"><i /><i /><b /></div></section>}
    {stage === 2 && <section className="hug-stage comfort-search"><div className="room-window"><i /><span>outside: too much<br /><strong>inside: softer</strong></span></div><div className="sofa">{['you can exhale here','no fixing, just holding','I’ve got you'].map((note, i) => <button className={notes.includes(i) ? 'found' : ''} onClick={() => setNotes([...new Set([...notes, i])])} key={note}><i /><span>{note}</span></button>)}</div><div className="room-copy"><span>THE ROOM HID THREE SOFT PLACES</span><h2>{notes.length < 3 ? `${3 - notes.length} comfort notes still tucked away.` : 'Okay. The room trusts you now.'}</h2><p>Tap the cushions. Haan, digital sofa pe bhi treasure milta hai.</p></div>{notes.length === 3 && <button className="world-button floating-next" onClick={() => setStage(3)}>Sit down for a second <Icon name="arrow" /></button>}</section>}
    {stage === 3 && <section className="breathing-room scene-panel"><div className={`breath-orb ${inhale ? 'inhale' : ''}`}><i /><span>{inhale ? 'hold…' : breaths >= 3 ? 'softer.' : 'breathe in'}</span><b>{breaths}/3</b></div><div className="breath-copy"><span>SYNC BEFORE THE HUG</span><h2>Match the room’s breathing.</h2><p>No wellness lecture. Bas teen slow breaths so the hug lands where it needs to.</p><button onClick={breathe}>{breaths >= 3 ? 'breathing synced' : inhale ? 'now breathe out' : 'tap to breathe in'}</button>{breaths >= 3 && !inhale && <button className="world-button" onClick={() => setStage(4)}>Let the distance close <Icon name="heart" /></button>}</div></section>}
    {stage === 4 && <section className="embrace-stage"><div className={`embrace-arm arm-left ${warmth >= 100 ? 'closed' : ''}`}><i /></div><div className={`embrace-arm arm-right ${warmth >= 100 ? 'closed' : ''}`}><i /></div><div className="warmth-control expanded"><span>DIGITAL HUG · ACTUAL INTENTION</span><h2>{warmth < 100 ? 'Hold until the arms meet.' : 'There. Don’t rush away.'}</h2><div className="warmth-ring" style={{ '--p': `${warmth * 3.6}deg` } as React.CSSProperties}><button onPointerDown={hold.start} onPointerUp={hold.stop} onPointerLeave={hold.stop}><Icon name="heart" size={34} /><span>{warmth < 100 ? 'HOLD TO HUG' : 'HELD.'}</span></button></div><p>{warmth < 100 ? `${warmth}% closer · ${warmth < 50 ? 'thoda aur' : 'bas aa gaye'}` : gift.extras.whisper}</p>{warmth >= 100 && <button className="world-button" onClick={() => setStage(5)}>Keep this warmth <Icon name="heart" /></button>}</div></section>}
  </main>
}

export function KissExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(initialStage)
  const [stamp, setStamp] = useState('MUAH')
  const [power, setPower] = useState(35)
  const [hits, setHits] = useState(0)
  const [clouds, setClouds] = useState<number[]>([])
  const [sent, setSent] = useState(false)
  const targetPositions = [[24,32],[67,27],[54,68]]
  const dispatch = () => {
    setSent(true)
    window.setTimeout(() => setStage(5), 2600)
  }

  if (stage === 5) return <Finale gift={gift} badge="SIGNED · SEALED · BLUSHING" title={<>Special delivery:<br /><em>right on target.</em></>}><p>{gift.extras.after}</p><blockquote>{gift.extras.kissType} delivered to “{gift.extras.destination}” with zero customs duty.</blockquote><p className="finale-hinglish">Recipient reaction may include: screen ko dekh ke stupid smile. Courier not responsible.</p></Finale>

  return <main className="kiss-world expanded-world"><StageTop label="KISS COURIER · EXPRESS" step={stage} total={5} />
    {stage === 1 && <section className="experience-intro kiss-intro"><div className="courier-stamp">FRAGILE<br /><b>♥</b><small>HANDLE WITH FEELINGS</small></div><h1>One kiss is stuck<br /><em>at romantic customs.</em></h1><p>Sender: {gift.from}. Recipient: the suspiciously cute {gift.to}. Paperwork: unnecessarily flirty.</p><button className="world-button" onClick={() => setStage(2)}>Claim the private shipment <Icon name="arrow" /></button></section>}
    {stage === 2 && <section className="kiss-customs scene-panel"><div className="kiss-form"><span>AQUIRA EXPRESS · PRIORITY FEELINGS</span><h2>Prepare the kiss passport.</h2><label>CHOOSE A STAMP<div>{['MUAH','XO','♥','UMM…'].map((item) => <button className={stamp === item ? 'selected' : ''} onClick={() => setStamp(item)} key={item}>{item}</button>)}</div></label><label>KISS VELOCITY <input type="range" min="10" max="100" value={power} onChange={(event) => setPower(Number(event.target.value))} /><span>{power < 40 ? 'sweet & shy' : power < 75 ? 'butterfly speed' : 'dangerously filmy'}</span></label><div className="passport-details"><i>{stamp}</i><span><b>TYPE</b>{gift.extras.kissType}</span><span><b>DESTINATION</b>{gift.extras.destination}</span></div><button className="dispatch" onClick={() => setStage(3)}>STAMP & CONTINUE <Icon name="arrow" /></button></div><div className="lipstick-card"><span>OFFICIAL SAMPLE</span><div className="lip-print"><i /><i /></div><p>Quality check: cute, tasteful, and 73% likely to cause butterflies.</p></div></section>}
    {stage === 3 && <section className="kiss-aim-stage"><div className="aim-copy"><span>CALIBRATE THE KISS</span><h2>Tap the moving heart three times.</h2><p>Aim carefully. Forehead pe jaana tha, neighbour ke Wi-Fi pe nahi.</p></div><div className="kiss-scope">{Array.from({ length: hits }, (_, i) => <i className="kiss-mark" key={i} style={{ left: `${targetPositions[i][0]}%`, top: `${targetPositions[i][1]}%` }}>MUAH</i>)}{hits < 3 && <button className="moving-heart" onClick={() => setHits((value) => value + 1)} style={{ left: `${targetPositions[hits][0]}%`, top: `${targetPositions[hits][1]}%` }}><Icon name="heart" size={28} /><span>tap me</span></button>}<div className="scope-lines" /></div>{hits >= 3 && <button className="world-button floating-next" onClick={() => setStage(4)}>Route locked · start delivery <Icon name="arrow" /></button>}</section>}
    {stage === 4 && <section className="kiss-route-stage"><div className="route-map"><div className="city sender"><i>{gift.from.charAt(0)}</i><span>{gift.from}<small>dangerously ready</small></span></div><div className="kiss-flight-path"><b className={sent ? 'fly' : ''} style={{ '--speed': `${2.8 - power / 65}s` } as React.CSSProperties}>{stamp}</b>{[0,1,2].map((cloud) => <button className={clouds.includes(cloud) ? 'cleared' : ''} onClick={() => !clouds.includes(cloud) && setClouds([...clouds, cloud])} key={cloud} style={{ '--c': cloud } as React.CSSProperties}>☁<span>{['overthinking cloud','log kya kahenge zone','bad network'][cloud]}</span></button>)}</div><div className="city receiver"><i>{gift.to.charAt(0)}</i><span>{gift.to}<small>{gift.extras.destination}</small></span></div></div><div className="route-status"><span>CLEAR THE THREE DELIVERY OBSTACLES</span><h2>{clouds.length < 3 ? `${3 - clouds.length} interruptions between you and the “mwah.”` : 'Airspace clear. Feelings have priority.'}</h2>{clouds.length === 3 && <button className="world-button" disabled={sent} onClick={dispatch}>{sent ? 'KISS IN FLIGHT…' : 'Dispatch immediately'} <Icon name="heart" /></button>}</div></section>}
  </main>
}

export function ValentineExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(initialStage)
  const [rooms, setRooms] = useState<number[]>([])
  const [reel, setReel] = useState(0)
  const [pieces, setPieces] = useState<number[]>([])
  const stories = [
    { label: 'THEN', title: 'Where it quietly began', text: gift.extras.memory },
    { label: 'NOW', title: 'Why the ordinary glows', text: gift.extras.reason },
    { label: 'NEXT', title: 'A future worth leaning into', text: gift.extras.future },
  ]
  const reelText = reel < 25 ? 'The “who is this person?” era.' : reel < 55 ? 'The “why am I smiling at my phone?” incident.' : reel < 85 ? 'The comfortable silence plot twist.' : 'The part where ordinary life started feeling like ours.'

  if (stage === 5) return <Finale gift={gift} badge="THE CENTREPIECE · ALWAYS WAS YOU" title={<>My favourite place<br /><em>is wherever “us” is.</em></>}><p>{gift.message}</p><blockquote>Happy Valentine’s Day, {gift.to}. Today, tomorrow, and on all the deeply normal days in between.</blockquote><p className="finale-hinglish">Museum closes never. Entry fee: one honest smile and maybe a hug pending offline.</p></Finale>

  return <main className="valentine-world expanded-world"><StageTop label="THE US MUSEUM" step={stage} total={5} />
    {stage === 1 && <section className="experience-intro valentine-intro"><span className="museum-ticket">ADMIT ONE · {gift.to.toUpperCase()} · FOREVER VALID</span><h1>Tonight, “us” has<br /><em>its own impossible museum.</em></h1><p>Memories move here. Futures leave voice notes. Please keep your heart inside the experience at all times.</p><button className="world-button" onClick={() => setStage(2)}>Enter after hours <Icon name="arrow" /></button><div className="museum-arches"><i /><i /><i /></div></section>}
    {stage === 2 && <section className="museum-stage"><div className="museum-heading"><span>PRIVATE COLLECTION · CURATED BY {gift.from.toUpperCase()}</span><h2>Three rooms. One timeline.</h2><p>Open each door. Nothing here was mass-produced.</p></div><div className="museum-rooms">{stories.map((story, i) => <button className={rooms.includes(i) ? 'open' : ''} onClick={() => setRooms([...new Set([...rooms, i])])} key={story.label}><span className="room-number">0{i + 1}</span><div className="room-door"><i /><b>{story.label}</b></div><article><span>{story.label}</span><h3>{story.title}</h3><p>{story.text}</p></article></button>)}</div>{rooms.length === 3 && <button className="world-button floating-next" onClick={() => setStage(3)}>The projection room just opened <Icon name="spark" /></button>}</section>}
    {stage === 3 && <section className="projection-room scene-panel"><div className="film-projector"><div className="projector-lens"><i /></div><div className="film-beam" /><span>OUR VERY UNOFFICIAL DOCUMENTARY</span></div><div className="memory-screen"><div className="film-grain" /><div className="film-frames">{['first look','long talks','inside joke','comfortable us'].map((item, i) => <i className={reel >= i * 26 ? 'visible' : ''} key={item}>{item}</i>)}</div><blockquote>{reelText}</blockquote><small>{gift.to} + {gift.from} · a film still in production</small></div><div className="reel-control"><span>DRAG THROUGH THE TIMELINE</span><input type="range" min="0" max="100" value={reel} onChange={(event) => setReel(Number(event.target.value))} /><b>{reel}% watched</b>{reel >= 95 && <button className="world-button" onClick={() => setStage(4)}>Find the missing centrepiece <Icon name="arrow" /></button>}</div></section>}
    {stage === 4 && <section className="heart-archive scene-panel"><div className="archive-copy"><span>FINAL EXHIBIT · ASSEMBLY REQUIRED</span><h2>The heart arrived in pieces.</h2><p>Not broken. Bas har piece ek alag reason carry kar raha hai. Tap to bring them home.</p><div className="heart-reasons">{['the laughs','the safety','the chaos','the choosing'].map((item, i) => <button className={pieces.includes(i) ? 'placed' : ''} onClick={() => !pieces.includes(i) && setPieces([...pieces, i])} key={item}><i>{i + 1}</i>{item}</button>)}</div>{pieces.length === 4 && <button className="world-button" onClick={() => setStage(5)}>Reveal the centrepiece <Icon name="heart" /></button>}</div><div className={`archive-heart pieces-${pieces.length}`}>{[0,1,2,3].map((piece) => <i className={pieces.includes(piece) ? 'placed' : ''} key={piece} style={{ '--p': piece } as React.CSSProperties}><Icon name="heart" size={90} /></i>)}<span>{pieces.length === 4 ? gift.to : `${4 - pieces.length} pieces missing`}</span></div></section>}
  </main>
}
