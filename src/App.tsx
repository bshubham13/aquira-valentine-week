import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  ChocolateExperience,
  HugExperience,
  KissExperience,
  PromiseExperience,
  ProposeExperience,
  RoseExperience,
  TeddyExperience,
  ValentineExperience,
} from './Experiences'
import './App.css'
import {
  applyGiftFallbacks,
  decodeGift,
  encodeGift,
  loadDraft,
  saveDraft,
  GIFT_LIMITS,
  SHARE_URL_WARN_LENGTH,
} from './lib/giftCodec'
import { ambience } from './lib/ambience'
import { PHOTO_DAYS } from './lib/photoDays'
import { compressPhoto, validateImageFile } from './utils/photoCompressor'
import { uploadPhotos } from './utils/photoUpload'
import type { RosePhoto } from './photos'

type DaySlug =
  | 'rose'
  | 'propose'
  | 'chocolate'
  | 'teddy'
  | 'promise'
  | 'hug'
  | 'kiss'
  | 'valentine'

export type Gift = {
  day: DaySlug
  to: string
  from: string
  message: string
  extras: Record<string, string>
  photos?: RosePhoto[]
  createdAt: number
}

type Day = {
  slug: DaySlug
  number: string
  date: string
  name: string
  eyebrow: string
  hook: string
  description: string
  accent: string
  soft: string
  symbol: string
}

const DAYS: Day[] = [
  { slug: 'rose', number: '01', date: '07 FEB', name: 'Rose Day', eyebrow: 'The Bloom Room', hook: 'Grow a bouquet from tiny memories.', description: 'A secret garden where every rose opens a personal little note.', accent: '#ff315f', soft: '#ffd3df', symbol: '❀' },
  { slug: 'propose', number: '02', date: '08 FEB', name: 'Propose Day', eyebrow: 'Written in the Stars', hook: 'Make the universe ask the big question.', description: 'Connect a private constellation before the sky reveals your proposal.', accent: '#a985ff', soft: '#ded2ff', symbol: '✦' },
  { slug: 'chocolate', number: '03', date: '09 FEB', name: 'Chocolate Day', eyebrow: 'The Sweet Heist', hook: 'Unbox flavours, flirting, and one golden secret.', description: 'A mischievous chocolate box where every bite has personality.', accent: '#e9954f', soft: '#f4d4b9', symbol: '🍫' },
  { slug: 'teddy', number: '04', date: '10 FEB', name: 'Teddy Day', eyebrow: 'Build-a-Bae', hook: 'Assemble a comfort creature, then hug it alive.', description: 'A cosy teddy lab made for bad days, soft hearts, and tight hugs.', accent: '#f3a5af', soft: '#f9dadd', symbol: '⌁' },
  { slug: 'promise', number: '05', date: '11 FEB', name: 'Promise Day', eyebrow: 'The Pinky Protocol', hook: 'Turn three promises into a constellation.', description: 'A quiet ritual where words only glow after the pinky seal.', accent: '#61c8b2', soft: '#cceee7', symbol: '∞' },
  { slug: 'hug', number: '06', date: '12 FEB', name: 'Hug Day', eyebrow: 'The Warmth Room', hook: 'Collect comfort, then hold to close the distance.', description: 'A tactile room that gets warmer, softer, and closer with every touch.', accent: '#ff9b6a', soft: '#ffe0d0', symbol: '◡' },
  { slug: 'kiss', number: '07', date: '13 FEB', name: 'Kiss Day', eyebrow: 'Kiss Courier', hook: 'Stamp, aim, and dispatch one dangerously cute kiss.', description: 'A playful intercity kiss delivery service with zero chill.', accent: '#ff477e', soft: '#ffc8d9', symbol: '◉' },
  { slug: 'valentine', number: '08', date: '14 FEB', name: "Valentine's Day", eyebrow: 'The Us Museum', hook: 'Walk through what was, what is, and what could be.', description: 'A cinematic three-room time capsule with a heart at the centre.', accent: '#ff244f', soft: '#ffc5d1', symbol: '♥' },
]

const EXTRA_FIELDS: Record<DaySlug, Array<{ key: string; label: string; placeholder: string; type?: 'textarea' | 'select'; options?: string[] }>> = {
  rose: [
    { key: 'memory', label: 'A tiny shared memory', placeholder: 'That chai walk where it suddenly started raining…', type: 'textarea' },
    { key: 'compliment', label: 'What makes them bloom?', placeholder: 'Your laugh fixes the whole vibe.' },
    { key: 'roseColor', label: 'Their rose energy', placeholder: '', type: 'select', options: ['Wild cherry', 'Blush pink', 'Moonlight ivory', 'Sunset coral'] },
  ],
  propose: [
    { key: 'nickname', label: 'Your name for them', placeholder: 'sunshine / pagal / meri jaan' },
    { key: 'question', label: 'The big question', placeholder: 'Will you be my favourite notification forever?', type: 'textarea' },
    { key: 'yesLabel', label: 'Their “yes” button', placeholder: 'Obviously, you filmy human' },
  ],
  chocolate: [
    { key: 'flavour', label: 'Their flavour', placeholder: '', type: 'select', options: ['Hazelnut chaos', 'Dark chocolate drama', 'Strawberry softie', 'Caramel flirt'] },
    { key: 'tease', label: 'A sweet roast', placeholder: 'Sweet ho, par meri fries phir bhi churaate ho.' },
    { key: 'reward', label: 'Golden ticket reward', placeholder: 'One dessert date — no sharing required.' },
  ],
  teddy: [
    { key: 'teddyName', label: 'Name the teddy', placeholder: 'Golu 2.0' },
    { key: 'comfort', label: 'Emergency comfort line', placeholder: 'Bad day ho toh mere paas aa jaana.', type: 'textarea' },
    { key: 'trait', label: 'Its special power', placeholder: '', type: 'select', options: ['Overthinking shield', 'Unlimited cuddles', 'Instant mood repair', 'Midnight listener'] },
  ],
  promise: [
    { key: 'promise1', label: 'Promise one', placeholder: 'I’ll always save you the last bite.' },
    { key: 'promise2', label: 'Promise two', placeholder: 'I’ll listen, even when words are messy.' },
    { key: 'promise3', label: 'Promise three', placeholder: 'I’ll keep choosing us.' },
  ],
  hug: [
    { key: 'distance', label: 'When they need this hug', placeholder: 'For the days when everything feels too loud.' },
    { key: 'whisper', label: 'Whisper during the hug', placeholder: 'Bas. I’m here. Breathe.', type: 'textarea' },
    { key: 'hugStyle', label: 'Hug style', placeholder: '', type: 'select', options: ['Tight & filmy', 'Soft & sleepy', 'Spin-you-around', 'Never letting go'] },
  ],
  kiss: [
    { key: 'kissType', label: 'Choose the shipment', placeholder: '', type: 'select', options: ['Forehead kiss', 'Nose boop + kiss', 'Cheek attack', 'Main nahi bataunga 😌'] },
    { key: 'destination', label: 'Delivery destination', placeholder: 'Right where you’re smiling right now' },
    { key: 'after', label: 'After-kiss note', placeholder: 'Side effects may include butterflies.', type: 'textarea' },
  ],
  valentine: [
    { key: 'memory', label: 'A favourite “then”', placeholder: 'The first time I realised this was different…', type: 'textarea' },
    { key: 'reason', label: 'Why “now” feels special', placeholder: 'Normal days feel cinematic with you.', type: 'textarea' },
    { key: 'future', label: 'A tiny future dream', placeholder: 'More sunsets, stupid jokes, and us.', type: 'textarea' },
  ],
}

const DEFAULT_EXTRAS: Record<DaySlug, Record<string, string>> = {
  rose: { memory: 'That one chai walk that accidentally became my favourite memory.', compliment: 'You make ordinary days feel beautifully alive.', roseColor: 'Wild cherry' },
  propose: { nickname: 'sunshine', question: 'Will you be my favourite person — officially, dramatically, and for a very long time?', yesLabel: 'Obviously. Come here.' },
  chocolate: { flavour: 'Hazelnut chaos', tease: 'You are very sweet. Suspiciously sweet. Almost as if you want my fries.', reward: 'One dessert date with unlimited stealing from my plate.' },
  teddy: { teddyName: 'Golu 2.0', comfort: 'Bad day ho, good day ho — come here. I have room for all of it.', trait: 'Overthinking shield' },
  promise: { promise1: 'I’ll always save you the last bite.', promise2: 'I’ll listen, even when the words come out messy.', promise3: 'I’ll keep choosing us, especially on ordinary days.' },
  hug: { distance: 'For the days when everything feels a little too loud.', whisper: 'Bas. I’m here. You don’t have to carry it alone.', hugStyle: 'Tight & filmy' },
  kiss: { kissType: 'Forehead kiss', destination: 'Right where you’re smiling right now', after: 'Delivery successful. Side effects may include unreasonable butterflies.' },
  valentine: { memory: 'Somewhere between the first long conversation and the first comfortable silence, you became home.', reason: 'You make normal Tuesdays feel worth remembering.', future: 'More sunsets, stupid jokes, brave plans, and a ridiculous amount of us.' },
}

/**
 * Test Play preview per photo day (Rose's pattern, generalized). Day 4 adds
 * one entry here instead of another nested ternary. Days without an entry
 * get no Test Play preview — the overlay only renders for PHOTO_DAYS.
 */
const TEST_PLAY_EXPERIENCES: Record<DaySlug, ComponentType<{ gift: Gift; previewPhotos?: readonly string[]; testPlay?: boolean }> | null> = {
  rose: RoseExperience,
  propose: ProposeExperience,
  chocolate: ChocolateExperience,
  teddy: null,
  promise: null,
  hug: null,
  kiss: null,
  valentine: null,
}

function giftFromHash() {
  const match = window.location.hash.match(/^#gift=(.+)$/)
  return match ? decodeGift(match[1]) : null
}

function Icon({ name, size = 20 }: { name: 'heart' | 'arrow' | 'spark' | 'copy' | 'sound' | 'back' | 'lock' | 'check'; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    spark: <path d="m12 3-1.2 4.3a5 5 0 0 1-3.5 3.5L3 12l4.3 1.2a5 5 0 0 1 3.5 3.5L12 21l1.2-4.3a5 5 0 0 1 3.5-3.5L21 12l-4.3-1.2a5 5 0 0 1-3.5-3.5Z" />,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    sound: <><path d="M11 5 6 9H2v6h4l5 4Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>,
    back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h12" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function Ambient({ dense = false }: { dense?: boolean }) {
  const pieces = useMemo(() => Array.from({ length: dense ? 18 : 10 }, (_, index) => ({
    left: `${(index * 37 + 9) % 98}%`, delay: `${-(index * 1.7) % 9}s`, duration: `${8 + index % 6}s`, size: `${5 + index % 5}px`,
  })), [dense])
  return <div className="ambient" aria-hidden="true">{pieces.map((piece, index) => <i key={index} style={{ left: piece.left, animationDelay: piece.delay, animationDuration: piece.duration, width: piece.size, height: piece.size }} />)}</div>
}

function App() {
  const [gift, setGift] = useState<Gift | null>(() => giftFromHash())
  const [view, setView] = useState<'home' | 'creator'>('home')
  const [selected, setSelected] = useState<DaySlug>('rose')

  useEffect(() => {
    const sync = () => setGift(giftFromHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const openCreator = (day: DaySlug) => { setSelected(day); setView('creator'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const leaveGift = () => { window.history.replaceState(null, '', window.location.pathname + window.location.search); setGift(null); setView('home') }

  if (gift) return <Recipient gift={gift} onLeave={leaveGift} />
  if (view === 'creator') return <Creator initialDay={selected} onBack={() => setView('home')} onOpenGift={setGift} />
  return <Home onCreate={openCreator} />
}

function Home({ onCreate }: { onCreate: (day: DaySlug) => void }) {
  const [sound, setSound] = useState(false)
  return <main className="home-shell">
    <Ambient dense />
    <nav className="nav wrap">
      <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="AquiraCraft home"><span className="brand-mark"><Icon name="heart" size={15} /></span><span>Aquira<span>Craft</span></span></button>
      <div className="nav-side"><span className="nav-note">8 days · 8 different ways to say it</span><button className={`round-button ${sound ? 'active' : ''}`} onClick={() => setSound(ambience.toggle())} aria-label="Toggle ambience" aria-pressed={sound}><Icon name="sound" size={17} /></button></div>
    </nav>
    <section className="hero wrap">
      <div className="hero-copy"><div className="pill"><span /> Valentine week, but make it personal</div><h1>Don’t just send a<br />message.<br /><em>Make them feel it.</em></h1><p>Eight tiny romantic universes — crafted by you, experienced by them. Thoda filmy, kaafi personal, absolutely unforgettable.</p><button className="primary-button" onClick={() => document.querySelector('#days')?.scrollIntoView({ behavior: 'smooth' })}>Pick your moment <Icon name="arrow" /></button><div className="tiny-proof"><span className="avatar-stack"><i>♡</i><i>✦</i><i>☺</i></span><span>No login. No cringe templates.<br />Just your story, beautifully told.</span></div></div>
      <div className="hero-art" aria-label="An animated love letter orbiting in a romantic universe"><div className="orbit orbit-one"><i>07</i><i>14</i></div><div className="orbit orbit-two"><i>∞</i><i>✦</i></div><div className="hero-card card-back"><span>PRIVATE<br />& PERSONAL</span></div><div className="hero-card card-main"><div className="stamp">A+C</div><span className="hand-line">to my favourite human,</span><strong>you make<br />my heart do<br /><em>that thing.</em></strong><div className="scribble-heart"><Icon name="heart" size={52} /></div><span className="signed">made with butterflies</span></div><div className="floating-tag tag-one">not a boring e-card</div><div className="floating-tag tag-two">100% dil se</div></div>
    </section>
    <section id="days" className="days-section wrap">
      <div className="section-heading"><div><span className="kicker">THE LOVE ARCADE</span><h2>Choose your <em>kind of magic.</em></h2></div><p>Every day is a completely different experience. Same person in your head while reading all eight? Haan, hum samajh gaye.</p></div>
      <div className="day-grid">{DAYS.map((day) => <DayCard key={day.slug} day={day} onCreate={onCreate} />)}</div>
    </section>
    <section className="how-section wrap"><div className="how-card"><span className="kicker">HOW THE MAGIC TRAVELS</span><h2>Made by you.<br /><em>Felt by them.</em></h2><div className="steps"><div><b>01</b><span><strong>Pick a world</strong><small>Choose the day that matches your mood.</small></span></div><div><b>02</b><span><strong>Add your “us”</strong><small>Names, inside jokes, memories. The good stuff.</small></span></div><div><b>03</b><span><strong>Send the secret door</strong><small>They open a link. The world unfolds.</small></span></div></div><div className="how-seal"><Icon name="heart" size={32} /><span>handcrafted<br />on the internet</span></div></div></section>
    <footer className="footer wrap"><div className="brand"><span className="brand-mark"><Icon name="heart" size={15} /></span><span>Aquira<span>Craft</span></span></div><p>Made for people who feel things deeply<br />and text “reached?” immediately.</p><span>© 2026 · LOVE, DIGITALLY CRAFTED</span></footer>
  </main>
}

function DayCard({ day, onCreate }: { day: Day; onCreate: (day: DaySlug) => void }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  return <article className={`day-card day-${day.slug}`} style={{ '--accent': day.accent, '--soft': day.soft, '--rx': `${tilt.y}deg`, '--ry': `${tilt.x}deg` } as React.CSSProperties} onMouseMove={(event) => { const box = event.currentTarget.getBoundingClientRect(); setTilt({ x: ((event.clientX - box.left) / box.width - .5) * 4, y: -((event.clientY - box.top) / box.height - .5) * 4 }) }} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
    <div className="day-top"><span>{day.date}</span><b>{day.number}</b></div><div className="day-visual"><DayMiniArt day={day.slug} symbol={day.symbol} /></div><span className="day-eyebrow">{day.eyebrow}</span><h3>{day.name}</h3><p>{day.description}</p><button onClick={() => onCreate(day.slug)}>Craft this experience <Icon name="arrow" size={18} /></button>
  </article>
}

function DayMiniArt({ day, symbol }: { day: DaySlug; symbol: string }) {
  if (day === 'rose') return <div className="mini-rose"><i /><i /><i /><span>{symbol}</span></div>
  if (day === 'propose') return <div className="mini-sky"><i /><i /><i /><i /><span>say yes?</span></div>
  if (day === 'chocolate') return <div className="mini-choco"><i>?</i><i>♥</i><i>!</i><i>✦</i></div>
  if (day === 'teddy') return <div className="mini-teddy"><i /><b>•ᴗ•</b><span>soft launch</span></div>
  if (day === 'promise') return <div className="mini-promise"><i>you</i><b>∞</b><i>me</i></div>
  if (day === 'hug') return <div className="mini-hug"><i /><i /><span>warmth<br />loading…</span></div>
  if (day === 'kiss') return <div className="mini-kiss"><span>sealed</span><b>mwah!</b><i>♥</i></div>
  return <div className="mini-valentine"><i>then</i><b>US</b><i>always</i></div>
}

function Creator({ initialDay, onBack, onOpenGift }: { initialDay: DaySlug; onBack: () => void; onOpenGift: (gift: Gift) => void }) {
  const [draft] = useState(() => loadDraft())
  const [daySlug, setDaySlug] = useState<DaySlug>(draft?.daySlug ?? initialDay)
  const [to, setTo] = useState(draft?.to ?? '')
  const [from, setFrom] = useState(draft?.from ?? '')
  const [message, setMessage] = useState(draft?.message ?? '')
  const [extras, setExtras] = useState<Record<string, string>>(draft?.extras ?? {})
  const [dayPhotos, setRosePhotos] = useState<Array<{ id: string; blob: Blob; dataUrl: string; caption: string }>>([])
  const [photoError, setPhotoError] = useState('')
  const [formError, setFormError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [urlTooLong, setUrlTooLong] = useState(false)
  const [copied, setCopied] = useState(false)
  const [testPlayOpen, setTestPlayOpen] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const testPlayButtonRef = useRef<HTMLButtonElement | null>(null)
  const testPlayDialogRef = useRef<HTMLDivElement | null>(null)
  const day = DAYS.find((item) => item.slug === daySlug)!
  const PreviewExperience = TEST_PLAY_EXPERIENCES[daySlug]

  useEffect(() => {
    saveDraft({ daySlug, to, from, message, extras })
  }, [daySlug, to, from, message, extras])

  const changeDay = (slug: DaySlug) => { setDaySlug(slug); setExtras({}); setShareUrl(''); setFormError(''); setUrlTooLong(false) }

  const buildDraftGift = (photos?: RosePhoto[]): Gift =>
    applyGiftFallbacks({ day: daySlug, to, from, message, extras, photos: PHOTO_DAYS.has(daySlug) ? photos : undefined, defaults: DEFAULT_EXTRAS[daySlug] })

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setPhotoError('')
    const remaining = GIFT_LIMITS.photos - dayPhotos.length
    if (remaining <= 0) { setPhotoError('Only 4 photos fit.'); return }
    const picked = Array.from(files).slice(0, remaining)
    if (files.length > remaining) setPhotoError(`Only 4 photos fit — taking the first ${remaining}.`)
    for (const file of picked) {
      const checked = validateImageFile(file)
      if (!checked.valid) { setPhotoError(checked.error ?? 'That photo could not be used.'); continue }
      try {
        const compressed = await compressPhoto(file)
        setRosePhotos((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, blob: compressed.blob, dataUrl: compressed.dataUrl, caption: '' }])
      } catch {
        setPhotoError('That photo could not be compressed. Try a different one.')
      }
    }
  }

  const createLink = async () => {
    setFormError('')
    setUrlTooLong(false)
    setCreating(true)
    try {
      let photos: RosePhoto[] | undefined
      if (PHOTO_DAYS.has(daySlug) && dayPhotos.length > 0) {
        setUploadStatus(`Uploading photo 1 of ${dayPhotos.length}…`)
        photos = await uploadPhotos(
          dayPhotos.map((p) => ({ blob: p.blob, caption: p.caption.trim().slice(0, GIFT_LIMITS.caption) })),
          ({ done, total }) => setUploadStatus(`Uploading photo ${done} of ${total}…`),
        )
        setUploadStatus('')
      }
      const gift = buildDraftGift(photos)
      const url = `${window.location.origin}${window.location.pathname}#gift=${encodeGift(gift)}`
      if (url.length > SHARE_URL_WARN_LENGTH) setUrlTooLong(true)
      setShareUrl(url)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setUploadStatus('')
      setFormError(error instanceof Error ? error.message : 'Something went wrong while creating the link. Your draft is safe — try again.')
    } finally {
      setCreating(false)
    }
  }

  const copy = async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }

  const openTestPlay = () => { setPreviewKey((key) => key + 1); setTestPlayOpen(true) }
  const closeTestPlay = () => { setTestPlayOpen(false); testPlayButtonRef.current?.focus() }

  useEffect(() => {
    if (!testPlayOpen) return
    testPlayDialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setTestPlayOpen(false); testPlayButtonRef.current?.focus(); return }
      if (event.key !== 'Tab' || !testPlayDialogRef.current) return
      const focusables = Array.from(testPlayDialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'))
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [testPlayOpen])

  if (shareUrl) {
    const gift = decodeGift(shareUrl.split('#gift=')[1])!
    return <main className="complete-screen" style={{ '--accent': day.accent, '--soft': day.soft } as React.CSSProperties}><Ambient dense /><div className="complete-burst"><i /><i /><i /><i /><i /><i /></div><section className="complete-card"><div className="complete-seal"><Icon name="check" size={34} /></div><span className="kicker">YOUR SECRET DOOR IS READY</span><h1>Okay, this is going to make<br /><em>{to || 'them'} feel things.</em></h1><p>Your {day.name} experience is wrapped, sealed, and carrying an unreasonable amount of butterflies.</p><div className="link-box"><Icon name="lock" size={17} /><span>{shareUrl}</span><button onClick={copy}>{copied ? 'Copied!' : <><Icon name="copy" size={17} /> Copy</>}</button></div>{urlTooLong && <p className="form-error" role="alert">This link is unusually long — some apps may cut it off. Try a shorter note.</p>}<div className="complete-actions"><button className="primary-button" onClick={() => { window.location.hash = `gift=${encodeGift(gift)}`; onOpenGift(gift) }}>Open their experience <Icon name="arrow" /></button><button className="text-button" onClick={() => setShareUrl('')}><Icon name="back" size={17} /> Make a tiny edit</button></div><small>Anyone with this link can open the experience. No account needed.</small></section></main>
  }

  return <main className="creator-shell" style={{ '--accent': day.accent, '--soft': day.soft } as React.CSSProperties}><Ambient /><nav className="creator-nav wrap"><button className="text-button" onClick={onBack}><Icon name="back" size={18} /> Back to the arcade</button><div className="brand"><span className="brand-mark"><Icon name="heart" size={15} /></span><span>Aquira<span>Craft</span></span></div><span className="autosave"><i /> Your magic is saved locally — and restored when you return</span></nav><div className="creator-layout wrap"><section className="creator-form"><span className="kicker">CRAFTING · {day.eyebrow.toUpperCase()}</span><h1>Let’s make this feel<br /><em>exactly like you two.</em></h1><p className="form-intro">Little details make the magic hit different. Fill what feels right — we’ve already made the rest beautiful.</p><label className="field-label">Choose the experience</label><div className="day-picker">{DAYS.map((item) => <button className={item.slug === daySlug ? 'selected' : ''} title={item.name} onClick={() => changeDay(item.slug)} key={item.slug}>{item.number}<span>{item.symbol}</span></button>)}</div><div className="field-row"><label><span>Their name</span><input value={to} onChange={(event) => setTo(event.target.value)} placeholder="The lucky human" maxLength={GIFT_LIMITS.to} /></label><label><span>Your name</span><input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="The romantic mastermind" maxLength={GIFT_LIMITS.from} /></label></div><label><span>Your opening note</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={GIFT_LIMITS.message} /></label><div className="form-divider"><span>{day.symbol}</span><i /></div>{EXTRA_FIELDS[daySlug].map((field) => <label key={field.key}><span>{field.label}</span>{field.type === 'textarea' ? <textarea rows={3} value={extras[field.key] ?? ''} placeholder={field.placeholder} maxLength={GIFT_LIMITS.extra} onChange={(event) => setExtras({ ...extras, [field.key]: event.target.value })} /> : field.type === 'select' ? <select value={extras[field.key] ?? field.options?.[0]} onChange={(event) => setExtras({ ...extras, [field.key]: event.target.value })}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input value={extras[field.key] ?? ''} placeholder={field.placeholder} maxLength={GIFT_LIMITS.extra} onChange={(event) => setExtras({ ...extras, [field.key]: event.target.value })} />}</label>)}{PHOTO_DAYS.has(daySlug) && <div className="photo-upload"><span className="field-label">Tuck in photos <i>(optional · up to 4)</i></span><p className="photo-hint">Photos are compressed on your device, stored privately for 14 days, then deleted.</p><div className="photo-slots">{dayPhotos.map((photo, index) => <div className="photo-slot" key={photo.id}><img src={photo.dataUrl} alt={`${day.name} photo ${index + 1}`} /><input value={photo.caption} maxLength={GIFT_LIMITS.caption} placeholder="A tiny caption…" aria-label={`Caption for photo ${index + 1}`} onChange={(event) => setRosePhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, caption: event.target.value } : p)))} /><button type="button" className="photo-remove" aria-label={`Remove photo ${index + 1}`} onClick={() => setRosePhotos((prev) => prev.filter((p) => p.id !== photo.id))}>×</button></div>)}{dayPhotos.length < GIFT_LIMITS.photos && <label className="photo-add"><span>+ Add a photo</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => { void addPhotos(event.target.files); event.target.value = '' }} /></label>}</div>{photoError && <p className="form-error" role="alert">{photoError}</p>}{uploadStatus && <p className="upload-status" role="status">{uploadStatus}</p>}</div>}<div className="creator-actions">{PHOTO_DAYS.has(daySlug) && <button className="secondary-button test-play-button" ref={testPlayButtonRef} onClick={openTestPlay}>{day.symbol} Test Play — see it as they will</button>}<button className="primary-button create-button" onClick={() => void createLink()} disabled={creating}>{creating ? 'Wrapping…' : <>Wrap it & create the link <Icon name="spark" /></>}</button></div>{formError && <p className="form-error" role="alert">{formError}</p>}<p className="form-footnote"><Icon name="lock" size={14} /> {PHOTO_DAYS.has(daySlug) ? 'Your words stay inside the link. Photos are stored privately for 14 days, then deleted.' : 'Your words stay inside the link. Nothing is uploaded.'}</p></section><aside className="preview-side"><div className="preview-label"><span>LIVE PEEK</span><i>Recipient view</i></div><div className={`phone-preview preview-${daySlug}`}><div className="phone-bar"><i /><span>AQUIRA · PRIVATE</span><b>•••</b></div><div className="phone-content"><span className="preview-date">{day.date}</span><DayMiniArt day={daySlug} symbol={day.symbol} /><small>A little something for</small><h3>{to || 'your favourite human'}</h3><p>{message}</p><button>Begin the magic <Icon name="arrow" size={15} /></button></div><div className="phone-home" /></div><p className="preview-whisper">Psst — this is only the doorway.<br />The real experience has surprises inside.</p></aside></div>{testPlayOpen && PHOTO_DAYS.has(daySlug) && <div className="test-play-overlay" role="dialog" aria-modal="true" aria-label={`Live preview: ${day.name}`} ref={testPlayDialogRef} tabIndex={-1}><div className="test-play-hud"><span>{day.symbol} Live Preview: {day.name}</span><div className="test-play-hud-actions"><button className="test-play-restart" onClick={() => setPreviewKey((key) => key + 1)}>Start over</button><button className="test-play-exit" onClick={closeTestPlay} aria-label="Close preview">×</button></div></div><div className="test-play-stage">{PreviewExperience && <PreviewExperience key={previewKey} gift={buildDraftGift(dayPhotos.map((p) => ({ photoKey: '', caption: p.caption })))} previewPhotos={dayPhotos.map((p) => p.dataUrl)} />}</div></div>}</main>
}

function Recipient({ gift, onLeave }: { gift: Gift; onLeave: () => void }) {
  const [opened, setOpened] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).get('previewGift') === '1')
  const [muted, setMuted] = useState(false)
  const day = DAYS.find((item) => item.slug === gift.day)!
  useEffect(() => () => { ambience.stop() }, [])
  const leave = () => { ambience.stop(); onLeave() }
  const toggleMute = () => { const next = !muted; setMuted(next); ambience.setMuted(next) }
  if (!opened) return <main className={`gift-door gift-door-${gift.day}`} style={{ '--accent': day.accent, '--soft': day.soft } as React.CSSProperties}><Ambient dense /><button className="gift-brand brand" onClick={leave}><span className="brand-mark"><Icon name="heart" size={15} /></span><span>Aquira<span>Craft</span></span></button><div className="door-orbit orbit-a" /><div className="door-orbit orbit-b" /><section className="door-card"><div className="door-date"><span>{day.date}</span><i>{day.symbol}</i></div><div className="wax-seal"><Icon name="heart" size={28} /></div><span className="kicker">A PRIVATE {day.name.toUpperCase()} EXPERIENCE</span><p className="door-for">A little universe was made for</p><h1>{gift.to}</h1><blockquote>“{gift.message}”</blockquote><button className="primary-button" onClick={() => { ambience.start(); setOpened(true) }}>Open the secret door <Icon name="spark" /></button><small>Best experienced with sound on & guard down</small></section><p className="door-from">thoughtfully made by <strong>{gift.from}</strong></p></main>
  return <div className={`experience experience-${gift.day}`} style={{ '--accent': day.accent, '--soft': day.soft } as React.CSSProperties}>{gift.day === 'rose' && <RoseExperience gift={gift} />}{gift.day === 'propose' && <ProposeExperience gift={gift} />}{gift.day === 'chocolate' && <ChocolateExperience gift={gift} />}{gift.day === 'teddy' && <TeddyExperience gift={gift} />}{gift.day === 'promise' && <PromiseExperience gift={gift} />}{gift.day === 'hug' && <HugExperience gift={gift} />}{gift.day === 'kiss' && <KissExperience gift={gift} />}{gift.day === 'valentine' && <ValentineExperience gift={gift} />}<div className="experience-controls"><button className={`experience-sound ${muted ? 'muted' : ''}`} onClick={toggleMute} aria-label={muted ? 'Unmute ambience' : 'Mute ambience'} aria-pressed={!muted}>♪</button><button className="experience-exit" onClick={leave}>AquiraCraft <span>×</span></button></div></div>
}

export default App
