/**
 * Chocolate Day — "The Sweet Heist" (9 Feb). 7 stages + finale.
 *
 * A love letter you can eat: lift the shop shutter, temper the chocolate
 * by turning the dial and stirring in real circles, pour it into a mould,
 * dress it with toppings, unwrap photo truffles, peel three pieces open to
 * read the opinions inside, and hold to bite the golden centre.
 *
 * Every drag/hold/peel has a button alternative and a keyboard path.
 * The kitchen cat is original CSS artwork made for this project — no
 * downloaded GIFs or memes (plan §5A).
 */
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { Flip } from 'gsap/Flip'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { AnimatePresence, LazyMotion, domAnimation, m } from 'motion/react'
import confetti from 'canvas-confetti'
import type { Gift } from '../App'
import {
  canAdvanceChocolate,
  nextChocolateStage,
  CHOCOLATE_FINALE_STAGE,
  CHOCOLATE_STAGE_TOTAL,
  STIRS_NEEDED,
  TOPPINGS_NEEDED,
  PIECES_NEEDED,
  isSweetSpotTemp,
  countStirCircles,
  angleStep,
  type ChocolateStageState,
} from '../lib/chocolateGating'
import { ambience } from '../lib/ambience'
import { photoSrc } from '../photos'
import { Icon, StageTop, Finale, SoftParticles } from './shared'
import { useHoldProgress, usePhotoEnlarge, initialStage, prefersReducedMotion, vibrate } from './shared-hooks'
import '../chocolate.css'

gsap.registerPlugin(Draggable, MorphSVGPlugin, Flip, MotionPathPlugin)

/** How far (px) the shutter travels from closed to fully open. */
const SHUTTER_LIFT = 190
/** How far (deg) the cauldron tilts from upright to full pour. */
const POUR_TILT_MAX = 70
/** Tilt (deg) at which the chocolate starts flowing. */
const POUR_TILT_MIN = 45
/** How far (px) a wrapper corner must be dragged to count as a peel. */
const PEEL_DISTANCE = 70

const FLAVOURS = ['softie detected', 'high cocoa, higher standards', 'chaos but cute', 'certified snack thief', 'sweet with plot twists', 'secret centre']
const TOPPINGS = [
  { key: 'crunch', glyph: '◆', label: 'crunch' },
  { key: 'berries', glyph: '●', label: 'berries' },
  { key: 'sparkle', glyph: '✦', label: 'sparkle' },
]
const MOULDS = ['heart', 'moon', 'chaos'] as const

/** The solid chocolate bar, before the melt (MorphSVG source shape). */
const MELT_SOLID_D = 'M40 92 L40 46 Q40 36 50 36 L150 36 Q160 36 160 46 L160 92 Q160 102 150 102 L50 102 Q40 102 40 92 Z'
/** The glossy puddle it melts into (MorphSVG target shape). */
const MELT_LIQUID_D = 'M24 88 Q58 68 100 82 Q142 96 176 80 Q186 77 179 92 Q162 110 100 110 Q38 110 21 96 Q17 90 24 88 Z'

/** Original CSS kitchen cat — quality control, peeking over the cauldron. */
function KitchenCat({ small = false }: { small?: boolean }) {
  return (
    <div className={`kitchen-cat ${small ? 'cat-small' : ''}`} aria-hidden="true">
      <i className="cat-ear left" />
      <i className="cat-ear right" />
      <span className="cat-face"><b className="cat-eye left" /><b className="cat-eye right" /><em>•ᴗ•</em></span>
      <small>meow. quality control.</small>
    </div>
  )
}

export function ChocolateExperience({ gift, previewPhotos, testPlay = false }: { gift: Gift; previewPhotos?: readonly string[]; testPlay?: boolean }) {
  const photos = gift.photos ?? []
  const [stage, setStage] = useState(() => initialStage(CHOCOLATE_FINALE_STAGE))
  const [shutterProgress, setShutterProgress] = useState(0)
  const [shutterUp, setShutterUp] = useState(false)
  const [temperature, setTemperature] = useState(30)
  const [stirs, setStirs] = useState(0)
  const [circleProgress, setCircleProgress] = useState(0)
  const [mould, setMould] = useState('')
  const [mouldFilled, setMouldFilled] = useState(0)
  const [tilt, setTilt] = useState(0)
  const [toppings, setToppings] = useState<string[]>([])
  const [selectedTopping, setSelectedTopping] = useState<string | null>(null)
  const [photosViewed, setPhotosViewed] = useState<number[]>([])
  const [failedPhotos, setFailedPhotos] = useState<number[]>([])
  const [peeled, setPeeled] = useState<number[]>([])
  const [bite, setBite] = useState(0)
  const enlarge = usePhotoEnlarge('A truffle from the box.')
  const biteHold = useHoldProgress(setBite, 2, 32)
  const [reducedMotion] = useState(() => prefersReducedMotion())

  // Refs for effect-driven mutations (avoid stale closures in GSAP callbacks).
  const stirsRef = useRef(0)
  const peeledRef = useRef<number[]>([])
  const tiltRef = useRef(0)
  const pouredRef = useRef(false)
  const bittenRef = useRef(false)
  const shutterHandleRef = useRef<HTMLDivElement | null>(null)
  const dialRef = useRef<HTMLDivElement | null>(null)
  const meltSolidRef = useRef<SVGPathElement | null>(null)
  const meltLiquidRef = useRef<SVGPathElement | null>(null)
  const meltOriginalRef = useRef<string | null>(null)
  const stirZoneRef = useRef<HTMLDivElement | null>(null)
  const stirringRef = useRef(false)
  const lastAngleRef = useRef(0)
  const totalAngleRef = useRef(0)
  const stirIntervalRef = useRef<number | null>(null)
  const cauldronRef = useRef<HTMLDivElement | null>(null)
  const pourDropRef = useRef<HTMLDivElement | null>(null)
  const pourPathRef = useRef<SVGPathElement | null>(null)
  const mouldRef = useRef<HTMLDivElement | null>(null)
  const toppingRefs = useRef<Array<HTMLButtonElement | null>>([])
  const truffleWrapRef = useRef<HTMLDivElement | null>(null)
  const peelTabRefs = useRef<Array<HTMLSpanElement | null>>([])
  const peelDraggedRef = useRef(false)
  const biteShellRef = useRef<HTMLDivElement | null>(null)
  const ticketRef = useRef<HTMLDivElement | null>(null)

  const inSweetSpot = isSweetSpotTemp(temperature)
  const pouring = stage === 3 && mould !== '' && tilt >= POUR_TILT_MIN && mouldFilled < 100

  const chocolateState: ChocolateStageState = {
    shutterUp,
    temperature,
    stirs,
    mouldFilled,
    toppingsPlaced: toppings.length,
    photosViewed: photosViewed.length,
    photoCount: photos.length,
    piecesPeeled: peeled.length,
    bite,
  }

  const advance = () => { if (canAdvanceChocolate(stage, chocolateState)) setStage(nextChocolateStage(stage)) }

  const reset = () => {
    stirsRef.current = 0
    peeledRef.current = []
    tiltRef.current = 0
    pouredRef.current = false
    bittenRef.current = false
    totalAngleRef.current = 0
    if (stirIntervalRef.current !== null) {
      window.clearInterval(stirIntervalRef.current)
      stirIntervalRef.current = null
    }
    setStage(1)
    setShutterProgress(0)
    setShutterUp(false)
    setTemperature(30)
    setStirs(0)
    setCircleProgress(0)
    setMould('')
    setMouldFilled(0)
    setTilt(0)
    setToppings([])
    setSelectedTopping(null)
    setPhotosViewed([])
    setFailedPhotos([])
    setPeeled([])
    setBite(0)
  }

  // The cocoa-night loop belongs to this kitchen: switch to it on mount,
  // restore the default night-garden loop when the experience unmounts.
  useEffect(() => {
    ambience.setProfile('cocoaNight')
    return () => { ambience.setProfile('nightGarden') }
  }, [])

  useEffect(() => () => {
    if (stirIntervalRef.current !== null) window.clearInterval(stirIntervalRef.current)
  }, [])

  const photoSrcAt = (index: number): string => previewPhotos?.[index] ?? photoSrc(photos[index])

  const viewPhoto = (index: number, src: string, caption: string, trigger: HTMLElement) => {
    setPhotosViewed((prev) => (prev.includes(index) ? prev : [...prev, index]))
    enlarge.open(src, caption, `Photo ${index + 1}`, trigger)
  }

  // --- Stage 1: Lift the Shutter (GSAP Draggable, vertical) ---
  const liftShutter = () => {
    const handle = shutterHandleRef.current
    if (handle && !reducedMotion) {
      gsap.to(handle, { y: -SHUTTER_LIFT, duration: 0.6, ease: 'power3.out' })
    }
    setShutterProgress(100)
    setShutterUp(true)
    ambience.playChime()
  }

  useEffect(() => {
    if (stage !== 1 || reducedMotion) return
    const handle = shutterHandleRef.current
    if (!handle) return
    const drag = Draggable.create(handle, {
      type: 'y',
      bounds: { minY: -SHUTTER_LIFT, maxY: 0 },
      onDrag(this: Draggable) {
        setShutterProgress(Math.round((-this.y / SHUTTER_LIFT) * 100))
      },
      onDragEnd(this: Draggable) {
        const progress = -this.y / SHUTTER_LIFT
        if (progress >= 0.6) liftShutter()
        else {
          gsap.to(handle, { y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
          setShutterProgress(0)
        }
      },
    })[0]
    return () => { drag.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // --- Stage 2: Temper the Drama (dial + circular stir + MorphSVG melt) ---
  const tempFromRotation = (rotation: number): number =>
    Math.max(20, Math.min(80, Math.round(50 + (rotation / 135) * 30)))

  const rotationFromTemp = (temp: number): number => ((temp - 50) / 30) * 135

  const setTemp = (next: number) => {
    const clamped = Math.max(20, Math.min(80, Math.round(next)))
    setTemperature(clamped)
    const dial = dialRef.current
    if (dial && !reducedMotion) gsap.set(dial, { rotation: rotationFromTemp(clamped) })
  }

  const stirOnce = () => {
    if (stirsRef.current >= STIRS_NEEDED) return
    stirsRef.current += 1
    setStirs(stirsRef.current)
    ambience.playStir()
    vibrate(10)
  }

  const startStirHold = () => {
    if (stirIntervalRef.current !== null) return
    stirOnce()
    stirIntervalRef.current = window.setInterval(stirOnce, 260)
  }

  const stopStirHold = () => {
    if (stirIntervalRef.current !== null) {
      window.clearInterval(stirIntervalRef.current)
      stirIntervalRef.current = null
    }
  }

  const stirForMe = () => {
    const obj = { v: stirsRef.current }
    gsap.to(obj, {
      v: STIRS_NEEDED, duration: 1.4, ease: 'power1.inOut',
      onUpdate: () => {
        const next = Math.round(obj.v)
        if (next > stirsRef.current) {
          stirsRef.current = next
          setStirs(next)
          ambience.playStir()
        }
      },
    })
  }

  const angleFromEvent = (event: React.PointerEvent): number => {
    const zone = stirZoneRef.current
    if (!zone) return 0
    const rect = zone.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI
  }

  const onStirDown = (event: React.PointerEvent<HTMLDivElement>) => {
    stirringRef.current = true
    lastAngleRef.current = angleFromEvent(event)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onStirMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!stirringRef.current) return
    const angle = angleFromEvent(event)
    const step = angleStep(lastAngleRef.current, angle)
    lastAngleRef.current = angle
    if (step === 0) return
    totalAngleRef.current += step
    const completed = countStirCircles(totalAngleRef.current)
    while (stirsRef.current < completed && stirsRef.current < STIRS_NEEDED) stirOnce()
    setCircleProgress(Math.round(((Math.abs(totalAngleRef.current) % 360) / 360) * 100))
  }

  const onStirUp = () => { stirringRef.current = false }

  useEffect(() => {
    if (stage !== 2) return
    const dial = dialRef.current
    if (!dial) return
    gsap.set(dial, { rotation: rotationFromTemp(temperature) })
    if (reducedMotion) return
    const drag = Draggable.create(dial, {
      type: 'rotation',
      bounds: { minRotation: -135, maxRotation: 135 },
      inertia: true,
      onDrag(this: Draggable) { setTemperature(tempFromRotation(this.rotation)) },
      onThrowComplete(this: Draggable) { setTemperature(tempFromRotation(this.rotation)) },
    })[0]
    return () => { drag.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // The melt: the solid bar morphs into a glossy puddle when the
  // temperature enters the sweet spot, and back when it leaves it.
  useEffect(() => {
    if (stage !== 2) return
    const solid = meltSolidRef.current
    const liquid = meltLiquidRef.current
    if (!solid || !liquid) return
    if (meltOriginalRef.current === null) meltOriginalRef.current = MELT_SOLID_D
    if (reducedMotion) {
      gsap.set(solid, { attr: { d: inSweetSpot ? MELT_LIQUID_D : MELT_SOLID_D } })
      return
    }
    if (inSweetSpot) {
      gsap.to(solid, { morphSVG: liquid, duration: 0.9, ease: 'power2.inOut' })
    } else {
      gsap.to(solid, { morphSVG: meltOriginalRef.current, duration: 0.7, ease: 'power2.inOut' })
    }
  }, [inSweetSpot, stage, reducedMotion])

  useEffect(() => {
    if (inSweetSpot && stage === 2) ambience.playChime()
  }, [inSweetSpot, stage])

  // --- Stage 3: Pour the Mould (tilt to pour, MotionPath stream) ---
  const setTiltValue = (next: number) => {
    const clamped = Math.max(0, Math.min(POUR_TILT_MAX, Math.round(next)))
    tiltRef.current = clamped
    setTilt(clamped)
  }

  const pourForMe = () => {
    if (mould === '') return
    const obj = { v: tiltRef.current }
    gsap.to(obj, {
      v: POUR_TILT_MAX, duration: 1.2, ease: 'power1.inOut',
      onUpdate: () => setTiltValue(obj.v),
    })
  }

  // While the cauldron is tilted past the pour angle, the mould fills.
  useEffect(() => {
    if (stage !== 3) return
    const timer = window.setInterval(() => {
      if (tiltRef.current >= POUR_TILT_MIN) {
        setMouldFilled((value) => Math.min(100, value + 2))
      }
    }, 60)
    return () => window.clearInterval(timer)
  }, [stage])

  useEffect(() => {
    if (mouldFilled >= 100 && !pouredRef.current) {
      pouredRef.current = true
      ambience.playPour()
      ambience.playChime()
      vibrate(40)
    }
    if (mouldFilled < 100) pouredRef.current = false
  }, [mouldFilled])

  useEffect(() => {
    if (stage !== 3) return
    const pot = cauldronRef.current
    if (!pot) return
    gsap.set(pot, { rotation: tiltRef.current })
    if (reducedMotion) return
    const drag = Draggable.create(pot, {
      type: 'rotation',
      bounds: { minRotation: 0, maxRotation: POUR_TILT_MAX },
      onDrag(this: Draggable) { setTiltValue(this.rotation) },
    })[0]
    return () => { drag.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, mould])

  // The pour stream: a droplet rides the motion path while pouring.
  useEffect(() => {
    const drop = pourDropRef.current
    const path = pourPathRef.current
    if (!drop || !path) return
    if (!pouring || reducedMotion) {
      gsap.set(drop, { opacity: 0 })
      return
    }
    gsap.set(drop, { opacity: 1 })
    const tween = gsap.to(drop, {
      motionPath: { path, align: path, alignOrigin: [0.5, 0.5], start: 0, end: 1 },
      duration: 0.9, repeat: -1, ease: 'none',
    })
    return () => { tween.kill() }
  }, [pouring, stage, reducedMotion])

  // --- Stage 4: Dress the Bite (drag-drop toppings + Flip) ---
  const placeTopping = (key: string) => {
    if (toppings.includes(key) || toppings.length >= TOPPINGS_NEEDED) return
    setToppings((prev) => [...prev, key])
    setSelectedTopping(null)
    ambience.playPop()
    vibrate(10)
  }

  useEffect(() => {
    if (stage !== 4 || reducedMotion) return
    const draggables = toppingRefs.current.map((el, index) => {
      if (!el) return null
      const key = TOPPINGS[index].key
      return Draggable.create(el, {
        type: 'x,y',
        onDrag(this: Draggable) {
          if (mouldRef.current) {
            mouldRef.current.classList.toggle('drop-hot', this.hitTest(mouldRef.current, '40%'))
          }
        },
        onDragEnd(this: Draggable) {
          mouldRef.current?.classList.remove('drop-hot')
          if (mouldRef.current && this.hitTest(mouldRef.current, '40%')) {
            // Flip the topping from the tray into its place on the mould:
            // capture the tray position, place it, then animate the new
            // chip on the mould from where the tray button was.
            const state = Flip.getState(el)
            placeTopping(key)
            gsap.set(el, { x: 0, y: 0 })
            requestAnimationFrame(() => {
              try {
                const chip = mouldRef.current?.querySelector(`[data-topping="${key}"]`)
                if (chip) Flip.from(state, { targets: chip, duration: 0.5, ease: 'power2.in', scale: true })
              } catch {
                // The topping is placed either way — the flight is garnish.
              }
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

  // --- Stage 5: Photo Truffles (fan-in) ---
  useEffect(() => {
    if (stage !== 5 || reducedMotion) return
    const wrap = truffleWrapRef.current
    if (!wrap) return
    const cards = wrap.querySelectorAll('.choco-truffle')
    if (cards.length === 0) return
    gsap.from(cards, { y: 30, opacity: 0, rotation: (i: number) => -6 + i * 4, stagger: 0.1, duration: 0.5, ease: 'back.out(1.6)' })
  }, [stage, reducedMotion])

  // --- Stage 6: Unwrap Three Truths (peel-drag) ---
  const peelPiece = (index: number) => {
    if (peeledRef.current.includes(index)) return
    peeledRef.current = [...peeledRef.current, index]
    setPeeled(peeledRef.current)
    ambience.playPeel()
    if (peeledRef.current.length === PIECES_NEEDED) {
      confetti({
        particleCount: 26, spread: 55, startVelocity: 16, ticks: 160, scalar: 0.8,
        origin: { y: 0.6 }, colors: ['#e9954f', '#f2c14e', '#fff6ec', '#a8324e'],
        disableForReducedMotion: true,
      })
    }
  }

  useEffect(() => {
    if (stage !== 6 || reducedMotion) return
    const draggables = peelTabRefs.current.map((el, index) => {
      if (!el) return null
      return Draggable.create(el, {
        type: 'x,y',
        onDrag(this: Draggable) {
          if (Math.hypot(this.x, this.y) > 12) peelDraggedRef.current = true
        },
        onDragEnd(this: Draggable) {
          if (Math.hypot(this.x, this.y) > PEEL_DISTANCE) peelPiece(index)
          else gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
          // The click that follows a drag must not also peel (tap is the
          // fallback, not a double). Clear the flag after the click lands.
          window.setTimeout(() => { peelDraggedRef.current = false }, 80)
        },
      })[0]
    })
    return () => { draggables.forEach((d) => d?.kill()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // --- Stage 7: Bite the Golden Centre (hold to crack) ---
  const crackForMe = () => {
    const obj = { v: bite }
    gsap.to(obj, { v: 100, duration: 1.2, ease: 'power1.inOut', onUpdate: () => setBite(Math.round(obj.v)) })
  }

  const releaseBite = () => {
    biteHold.stop()
    if (bite < 100) {
      setBite(0)
      if (biteShellRef.current && !reducedMotion) {
        gsap.fromTo(biteShellRef.current, { scale: 0.94 }, { scale: 1, duration: 0.5, ease: 'bounce.out' })
      }
    }
  }

  useEffect(() => {
    if (bite >= 100 && !bittenRef.current) {
      bittenRef.current = true
      ambience.playCrack()
      vibrate([15, 40, 15])
      if (!reducedMotion) {
        if (biteShellRef.current) {
          gsap.to(biteShellRef.current, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.inOut' })
        }
        if (ticketRef.current) {
          gsap.from(ticketRef.current, { y: 40, opacity: 0, duration: 0.7, ease: 'back.out(1.5)' })
        }
      }
    }
    if (bite < 100) bittenRef.current = false
  }, [bite, reducedMotion])

  // --- Finale: cocoa-and-gold confetti ---
  useEffect(() => {
    if (stage !== CHOCOLATE_FINALE_STAGE || reducedMotion) return
    confetti({
      particleCount: 80, spread: 75, origin: { y: 0.6 }, scalar: 0.9, ticks: 220,
      colors: ['#e9954f', '#f2c14e', '#fff6ec', '#a8324e'], disableForReducedMotion: true,
    })
  }, [stage, reducedMotion])

  const dialKeys = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); setTemp(temperature + 2) }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); setTemp(temperature - 2) }
    else if (event.key === 'Home') { event.preventDefault(); setTemp(20) }
    else if (event.key === 'End') { event.preventDefault(); setTemp(80) }
  }

  const pourKeys = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setTiltValue(tilt + 5) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setTiltValue(tilt - 5) }
  }

  const tapTopping = (key: string) => {
    if (toppings.includes(key)) return
    if (selectedTopping === key) placeTopping(key)
    else setSelectedTopping(key)
  }

  const stirRingC = 2 * Math.PI * 46

  return (
    <LazyMotion features={domAnimation}>
      <main className="chocolate-world expanded-world">
        <SoftParticles />
        {stage < CHOCOLATE_FINALE_STAGE && <StageTop label="THE SWEET HEIST" step={stage} total={CHOCOLATE_STAGE_TOTAL} />}
        <AnimatePresence mode="wait">
          <m.div
            key={stage}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="chocolate-stage-wrap"
          >
            {stage === 1 && (
              <section className="experience-intro chocolate-intro">
                <div className="choco-logo"><span>THE</span><b>SWEET<br />HEIST</b><small>for {gift.to}</small></div>
                <h1>We’re making a chocolate<br /><em>with your exact energy.</em></h1>
                <p>Flavour file: {gift.extras.flavour}. Warning: tasting may cause smiling at the screen.</p>
                <div className="shutter-shop">
                  <div className="shutter-light" style={{ opacity: shutterProgress / 100 }} aria-hidden="true" />
                  <div className="shutter-panel" ref={shutterHandleRef} aria-hidden="true">
                    {Array.from({ length: 6 }, (_, i) => <i key={i} />)}
                    <span>drag ↑</span>
                  </div>
                </div>
                <p className="shutter-hint">{shutterUp ? `Kitchen’s open, ${gift.to}. Apron on. Smells like ${gift.extras.flavour} already.` : 'Drag the shutter up — or unlock the kitchen.'}</p>
                {!shutterUp && <button className="secondary-button" onClick={liftShutter}>Unlock the kitchen</button>}
                {canAdvanceChocolate(1, chocolateState) && <button className="world-button" onClick={advance}>Step into the secret kitchen <Icon name="arrow" /></button>}
              </section>
            )}

            {stage === 2 && (
              <section className="temper-lab scene-panel">
                <div
                  className="temper-visual"
                  ref={stirZoneRef}
                  onPointerDown={onStirDown}
                  onPointerMove={onStirMove}
                  onPointerUp={onStirUp}
                  onPointerLeave={onStirUp}
                >
                  <div className="chocolate-cauldron" style={{ '--stir': `${stirs * 36}deg`, '--heat': temperature / 100 } as React.CSSProperties}>
                    <div className="chocolate-liquid"><i /><i /><i /></div>
                    <button onClick={stirOnce} aria-label="Stir once"><span>↻</span> STIR</button>
                  </div>
                  <svg className="stir-ring" viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r="46" className="stir-track" />
                    <circle cx="60" cy="60" r="46" className="stir-progress" style={{ strokeDasharray: stirRingC, strokeDashoffset: stirRingC * (1 - circleProgress / 100) }} transform="rotate(-90 60 60)" />
                  </svg>
                  <svg className="melt-svg" viewBox="0 0 200 120" aria-hidden="true">
                    <path ref={meltLiquidRef} d={MELT_LIQUID_D} fill="#7a3f1e" opacity={0} />
                    <path ref={meltSolidRef} d={MELT_SOLID_D} fill="#5a2c14" />
                  </svg>
                  {inSweetSpot && !reducedMotion && (
                    <div className="melt-bubbles" aria-hidden="true"><i>•</i><i>•</i><i>•</i></div>
                  )}
                  <KitchenCat />
                  <p className="stir-guide">Stir in circles — round and round</p>
                </div>
                <div className="temper-controls">
                  <span>CHOCOLATE PHYSICS · BUT ROMANTIC</span>
                  <h2>Temper the drama.</h2>
                  <p>Turn the dial into the sweet spot, then stir in circles six times. Bilkul relationship jaisa: warmth + effort.</p>
                  <label>STOVE TEMPERATURE</label>
                  <div className="stove-dial-wrap">
                    <div
                      className="stove-dial"
                      ref={dialRef}
                      role="slider"
                      tabIndex={0}
                      aria-label="Stove temperature"
                      aria-valuemin={20}
                      aria-valuemax={80}
                      aria-valuenow={temperature}
                      onKeyDown={dialKeys}
                    ><i /><b>{temperature}°</b></div>
                    <span>sweet spot 47–56° · {inSweetSpot ? 'melting beautifully' : temperature < 47 ? 'too cold — turn it up' : 'too hot — cool it down'}</span>
                  </div>
                  <div className="stir-count">{Array.from({ length: 6 }, (_, i) => <i className={i < stirs ? 'done' : ''} key={i} />)}<small>{stirs < 6 ? `${6 - stirs} stirs बाकी` : 'smooth enough to flirt'}</small></div>
                  <div className="wind-row">
                    <button
                      className="choco-hold-button"
                      onPointerDown={startStirHold}
                      onPointerUp={stopStirHold}
                      onPointerLeave={stopStirHold}
                      onKeyDown={(event) => { if (event.key === ' ' && !event.repeat) { event.preventDefault(); startStirHold() } }}
                      onKeyUp={stopStirHold}
                    ><i style={{ width: `${(stirs / STIRS_NEEDED) * 100}%` }} /><span>{stirs < 6 ? `HOLD TO STIR · ${stirs}/6` : 'SMOOTH ENOUGH TO FLIRT'}</span></button>
                    {stirs < 6 && <button className="secondary-button" onClick={stirForMe}>Stir it for me</button>}
                  </div>
                  <p className="choco-hint">Drag around the cauldron to stir in circles — or hold the button, or tap STIR.</p>
                  {canAdvanceChocolate(2, chocolateState) && <button className="world-button" onClick={advance}>Pour the good stuff <Icon name="spark" /></button>}
                </div>
              </section>
            )}

            {stage === 3 && (
              <section className="pour-stage scene-panel">
                <div className="pour-visual">
                  <div
                    className="pour-cauldron"
                    ref={cauldronRef}
                    role="slider"
                    tabIndex={0}
                    aria-label="Tilt the cauldron to pour"
                    aria-valuemin={0}
                    aria-valuemax={POUR_TILT_MAX}
                    aria-valuenow={tilt}
                    onKeyDown={pourKeys}
                  >
                    <div className="pour-pot"><span>🍫</span><i className="pour-spout" /></div>
                    <small>{mould === '' ? 'pick a mould first' : 'drag to tilt ↓'}</small>
                  </div>
                  <svg className="pour-stream-svg" viewBox="0 0 200 160" aria-hidden="true">
                    <path ref={pourPathRef} d="M150 4 C 150 55, 150 105, 150 156" fill="none" />
                  </svg>
                  <div className="pour-drop" ref={pourDropRef} aria-hidden="true" />
                  <div className={`choco-mould mould-${mould || 'blank'}`} ref={mouldRef}>
                    <div className="mould-fill" style={{ height: `${mouldFilled}%` }} />
                    <div className="mould-glyphs">{Array.from({ length: 6 }, (_, i) => <i key={i}>{mould === 'heart' ? '♥' : mould === 'moon' ? '◐' : mould === 'chaos' ? ['★', '♥', '?', '✦', '☺', '!'][i] : ''}</i>)}</div>
                    <span className="mould-for">for {gift.to}</span>
                  </div>
                </div>
                <div className="pour-controls">
                  <span>POUR IT LIKE YOU MEAN IT</span>
                  <h2>Pour the mould.</h2>
                  <p>Pick a mould, then tilt the cauldron — slow and steady. The chocolate knows when you’re nervous.</p>
                  <label>MOULD ENERGY</label>
                  <div className="mould-options">{MOULDS.map((item) => <button className={mould === item ? 'selected' : ''} onClick={() => setMould(item)} key={item}>{item}</button>)}</div>
                  <div className="pour-meter"><span>MOULD FILL</span><b>{mouldFilled}%</b><i><em style={{ width: `${mouldFilled}%` }} /></i><small>{mouldFilled < 100 ? (mould === '' ? 'Choose a mould, then tilt.' : tilt < POUR_TILT_MIN ? 'Tilt the cauldron further to pour.' : 'Pouring… hold the tilt.') : 'Full to the brim. Chef’s kiss.'}</small></div>
                  {mould !== '' && mouldFilled < 100 && <button className="secondary-button" onClick={pourForMe}>Pour it for me</button>}
                  <p className="choco-hint">Drag the cauldron down to tilt — or focus it and use ↓ ↑ keys.</p>
                  {canAdvanceChocolate(3, chocolateState) && <button className="world-button" onClick={advance}>Dress the bite <Icon name="arrow" /></button>}
                </div>
              </section>
            )}

            {stage === 4 && (
              <section className="choco-atelier scene-panel">
                <div
                  className={`choco-mould mould-${mould || 'blank'}`}
                  ref={mouldRef}
                  onClick={() => { if (selectedTopping) placeTopping(selectedTopping) }}
                >
                  <div className="mould-fill" style={{ height: '100%' }} />
                  <div className="mould-glyphs">{Array.from({ length: 6 }, (_, i) => <i key={i}>{mould === 'heart' ? '♥' : mould === 'moon' ? '◐' : mould === 'chaos' ? ['★', '♥', '?', '✦', '☺', '!'][i] : ''}</i>)}</div>
                  {toppings.map((item, i) => {
                    const topping = TOPPINGS.find((t) => t.key === item)!
                    return <span key={item} className="placed-topping" data-topping={item} style={{ '--i': i } as React.CSSProperties}>{topping.glyph}</span>
                  })}
                  <span className="mould-for">for {gift.to}</span>
                </div>
                <div className="atelier-controls">
                  <span>DESIGN THE BITE</span>
                  <h2>Dress the bite.</h2>
                  <p className="stage-hint">Drag a topping onto the chocolate — or tap a topping, then tap the mould.</p>
                  <label>CHOOSE ANY TWO TOPPINGS</label>
                  <div className="topping-tray">
                    {TOPPINGS.map((topping, i) => (
                      <button
                        key={topping.key}
                        className={`${toppings.includes(topping.key) ? 'placed' : ''} ${selectedTopping === topping.key ? 'selected' : ''}`}
                        ref={(el) => { toppingRefs.current[i] = el }}
                        onClick={() => tapTopping(topping.key)}
                        aria-label={`Place the ${topping.label} topping`}
                      ><i>{topping.glyph}</i><span>{topping.label}</span></button>
                    ))}
                  </div>
                  {selectedTopping !== null && !toppings.includes(selectedTopping) && (
                    <button className="world-button" onClick={() => placeTopping(selectedTopping)}>Place it on the mould <Icon name="arrow" /></button>
                  )}
                  <p>{toppings.length === 2 ? `Chef’s note: ${gift.to} has elite taste. Annoying, but true.` : 'The chocolate is judging your indecision respectfully.'}</p>
                  {canAdvanceChocolate(4, chocolateState) && <button className="world-button" onClick={advance}>Seal the custom box <Icon name="arrow" /></button>}
                </div>
              </section>
            )}

            {stage === 5 && (
              <section className="photo-truffles-stage scene-panel">
                <div className="photo-stage-copy">
                  <span>TRUFFLES, WITH PROOF</span>
                  <h2>Photo truffles, unwrapped.</h2>
                  <p>{photos.length === 0 ? 'No photos tucked in this time — the chocolate carries it.' : 'Tap a foil truffle to unwrap it. Open at least one to continue.'}</p>
                </div>
                {photos.length === 0 ? (
                  <div className="photo-empty choco-photo-empty">
                    <div className="choco-truffle-empty" aria-hidden="true">🍫</div>
                    <p>The box is all words today — and the words are enough.</p>
                  </div>
                ) : (
                  <div className="truffle-box" ref={truffleWrapRef}>
                    {photos.map((photo, index) => (
                      failedPhotos.includes(index) ? (
                        <div className="choco-truffle photo-failed" key={photo.photoKey || index}>
                          <span className="photo-placeholder">🍫</span>
                          <span>{photo.caption || 'A truffle that could not load.'}</span>
                        </div>
                      ) : (
                        <button
                          className={`choco-truffle ${photosViewed.includes(index) ? 'viewed' : ''}`}
                          key={photo.photoKey || index}
                          style={{ '--tilt': `${-6 + index * 4}deg` } as React.CSSProperties}
                          onClick={(event) => viewPhoto(index, photoSrcAt(index), photo.caption, event.currentTarget)}
                          aria-label={`Unwrap photo truffle ${index + 1}`}
                        >
                          <img src={photoSrcAt(index)} alt={photo.caption || `Photo ${index + 1}`} onError={() => setFailedPhotos((prev) => (prev.includes(index) ? prev : [...prev, index]))} />
                          <span>{photo.caption || 'a favourite moment'}</span>
                          <b className="enlarge-badge" aria-hidden="true">⤢</b>
                        </button>
                      )
                    ))}
                  </div>
                )}
                {canAdvanceChocolate(5, chocolateState) && <button className="world-button" onClick={advance}>Peel the truths <Icon name="arrow" /></button>}
              </section>
            )}

            {stage === 6 && (
              <section className="chocolate-stage expanded-box">
                <div className="chocolate-copy"><span>CASE FILE: {gift.to.toUpperCase()}</span><h2>Unwrap three truths.</h2><p>Peel a wrapper back — drag its corner, or just tap. Har piece ke andar ek highly confidential opinion hai.</p></div>
                <div className="chocolate-box">
                  {FLAVOURS.map((flavour, i) => (
                    <button
                      key={flavour}
                      className={`chocolate-piece piece-${i} ${peeled.includes(i) ? 'unwrapped' : ''}`}
                      onClick={() => { if (!peelDraggedRef.current) peelPiece(i) }}
                      aria-label={`Peel piece ${i + 1} to reveal the opinion inside`}
                    >
                      <span className="wrapper">{['◆', '●', '♥', '✦', '■', '?'][i]}<i className="peel-tab" ref={(el) => { peelTabRefs.current[i] = el }} aria-hidden="true">⌜</i></span>
                      <span className="choco-reveal">{flavour}</span>
                    </button>
                  ))}
                </div>
                <div className="taste-meter"><span>Your official taste</span><b>{peeled.length < 3 ? `${3 - peeled.length} more very scientific samples` : 'excellent. obviously.'}</b><i><em style={{ width: `${Math.min((peeled.length / PIECES_NEEDED) * 100, 100)}%` }} /></i></div>
                {peeled.length >= 3 && <button className="world-button floating-next" onClick={advance}>Bite the golden centre <Icon name="arrow" /></button>}
              </section>
            )}

            {stage === 7 && (
              <section className="bite-stage scene-panel">
                <div className="bite-copy">
                  <span>THE MOMENT OF TRUTH</span>
                  <h2>Bite the golden centre.</h2>
                  <p>{bite < 100 ? 'Hold the golden piece — the shell cracks, the gold leaks out.' : `Golden centre, ${gift.to}. The real gift was never the chocolate.`}</p>
                </div>
                <div className="bite-area">
                  <div className={`bite-shell cracks-${bite >= 66 ? 2 : bite >= 33 ? 1 : 0}`} ref={biteShellRef} aria-hidden="true">
                    <i className="bite-crack crack-a" />
                    <i className="bite-crack crack-b" />
                    <span className="bite-gold" style={{ opacity: bite / 100 }} />
                    <b>◆</b>
                  </div>
                  {bite >= 100 && (
                    <div className="golden-ticket choco-ticket" ref={ticketRef}>
                      <span>✦ GOLDEN TICKET ✦</span>
                      <h3>{gift.extras.reward}</h3>
                    </div>
                  )}
                  <div className="bite-hold">
                    <button
                      className="choco-hold-button bite-button"
                      onPointerDown={biteHold.start}
                      onPointerUp={releaseBite}
                      onPointerLeave={releaseBite}
                      onKeyDown={(event) => {
                        if (event.key === ' ' && !event.repeat) { event.preventDefault(); biteHold.start() }
                        if (event.key === 'Enter') { event.preventDefault(); crackForMe() }
                      }}
                      onKeyUp={releaseBite}
                    ><i style={{ width: `${bite}%` }} /><Icon name="heart" /><span>{bite < 100 ? `HOLD TO BITE · ${bite}%` : 'GOLDEN CENTRE CRACKED'}</span></button>
                    {bite < 100 && <button className="secondary-button" onClick={crackForMe}>Crack it for me</button>}
                  </div>
                  {bite >= 100 && <button className="world-button" onClick={advance}>See the sweetness report <Icon name="spark" /></button>}
                </div>
              </section>
            )}

            {stage === CHOCOLATE_FINALE_STAGE && (
              <Finale
                gift={gift}
                badge="🍫 GOLDEN TICKET · FULLY EDIBLE FEELINGS"
                title={<>Sweetness report:<br /><em>{gift.to} wins the whole box.</em></>}
                actions={testPlay ? { onReplay: reset, replayLabel: '↻ Replay the heist' } : { onReplay: reset, shareUrl: window.location.href, replayLabel: '↻ Replay the heist' }}
              >
                <p>{gift.extras.reward}</p>
                <blockquote>“{gift.extras.tease}”</blockquote>
                <p className="finale-hinglish">Sharing optional hai. Mere saath share karna morally correct hai, bas keh raha hoon.</p>
                <KitchenCat small />
                {photos.length > 0 && (
                  <div className="finale-photo-fan">
                    {photos.map((photo, index) => (
                      failedPhotos.includes(index) ? null : (
                        <button
                          key={photo.photoKey || index}
                          className="finale-fan-photo choco-fan-photo"
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
