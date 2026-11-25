import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { SplitText } from 'gsap/SplitText'
import { AnimatePresence, LazyMotion, domAnimation, m } from 'motion/react'
import confetti from 'canvas-confetti'
import type { Gift } from '../App'
import { canAdvancePropose, nextProposeStage, PROPOSE_FINALE_STAGE, PROPOSE_STAGE_TOTAL, dodgeNo, type ProposeStageState } from '../lib/proposeGating'
import { ambience } from '../lib/ambience'
import { photoSrc } from '../photos'
import { Icon, StageTop, Finale } from './shared'
import { usePhotoEnlarge, initialStage, prefersReducedMotion, vibrate } from './shared-hooks'
import '../propose.css'

gsap.registerPlugin(Draggable, DrawSVGPlugin, SplitText)

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
