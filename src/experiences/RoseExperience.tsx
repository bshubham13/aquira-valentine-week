import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { AnimatePresence, LazyMotion, domAnimation, m } from 'motion/react'
import confetti from 'canvas-confetti'
import type { Gift } from '../App'
import { canAdvanceRose, nextRoseStage, ROSE_FINALE_STAGE, ROSE_STAGE_TOTAL, type RoseStageState } from '../lib/roseGating'
import { ambience } from '../lib/ambience'
import { photoSrc } from '../photos'
import { Icon, StageTop, Finale, SoftParticles } from './shared'
import { useHoldProgress, usePhotoEnlarge, initialStage, prefersReducedMotion, isWebGLAvailable, vibrate } from './shared-hooks'
import '../rose.css'

gsap.registerPlugin(Draggable, InertiaPlugin, MotionPathPlugin)

const RoseScene = lazy(() => import('../RoseScene'))

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
