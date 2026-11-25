import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type DaySlug =
  | 'rose'
  | 'propose'
  | 'chocolate'
  | 'teddy'
  | 'promise'
  | 'hug'
  | 'kiss'
  | 'valentine'

type Gift = {
  day: DaySlug
  to: string
  from: string
  message: string
  extras: Record<string, string>
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
  { slug: 'chocolate', number: '03', date: '09 FEB', name: 'Chocolate Day', eyebrow: 'The Sweet Heist', hook: 'Unbox flavours, flirting, and one golden secret.', description: 'A mischievous chocolate box where every bite has personality.', accent: '#e9954f', soft: '#f4d4b9', symbol: '◆' },
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

function encodeGift(gift: Gift) {
  const bytes = new TextEncoder().encode(JSON.stringify(gift))
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodeGift(value: string): Gift | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Gift
    return DAYS.some((day) => day.slug === parsed.day) ? parsed : null
  } catch {
    return null
  }
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
      <div className="nav-side"><span className="nav-note">8 days · 8 different ways to say it</span><button className={`round-button ${sound ? 'active' : ''}`} onClick={() => setSound(!sound)} aria-label="Toggle ambience"><Icon name="sound" size={17} /></button></div>
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
  const [daySlug, setDaySlug] = useState(initialDay)
  const [to, setTo] = useState('Aashi')
  const [from, setFrom] = useState('Kabir')
  const [message, setMessage] = useState('If I could turn the way you make me feel into a place, I think it would look a little like this.')
  const [extras, setExtras] = useState<Record<string, string>>({ ...DEFAULT_EXTRAS[initialDay] })
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const day = DAYS.find((item) => item.slug === daySlug)!
  useEffect(() => {
    window.localStorage.setItem('aquira-valentine-draft', JSON.stringify({ daySlug, to, from, message, extras }))
  }, [daySlug, to, from, message, extras])
  const changeDay = (slug: DaySlug) => { setDaySlug(slug); setExtras({ ...DEFAULT_EXTRAS[slug] }); setShareUrl('') }
  const buildGift = (): Gift => ({ day: daySlug, to: to.trim() || 'My favourite human', from: from.trim() || 'Someone who adores you', message: message.trim() || 'You make the ordinary feel special.', extras, createdAt: Date.now() })
  const createLink = () => { const gift = buildGift(); setShareUrl(`${window.location.origin}${window.location.pathname}#gift=${encodeGift(gift)}`); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const copy = async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }

  if (shareUrl) {
    const gift = decodeGift(shareUrl.split('#gift=')[1])!
    return <main className="complete-screen" style={{ '--accent': day.accent, '--soft': day.soft } as React.CSSProperties}><Ambient dense /><div className="complete-burst"><i /><i /><i /><i /><i /><i /></div><section className="complete-card"><div className="complete-seal"><Icon name="check" size={34} /></div><span className="kicker">YOUR SECRET DOOR IS READY</span><h1>Okay, this is going to make<br /><em>{to || 'them'} feel things.</em></h1><p>Your {day.name} experience is wrapped, sealed, and carrying an unreasonable amount of butterflies.</p><div className="link-box"><Icon name="lock" size={17} /><span>{shareUrl}</span><button onClick={copy}>{copied ? 'Copied!' : <><Icon name="copy" size={17} /> Copy</>}</button></div><div className="complete-actions"><button className="primary-button" onClick={() => { window.location.hash = `gift=${encodeGift(gift)}`; onOpenGift(gift) }}>Open their experience <Icon name="arrow" /></button><button className="text-button" onClick={() => setShareUrl('')}><Icon name="back" size={17} /> Make a tiny edit</button></div><small>Anyone with this link can open the experience. No account needed.</small></section></main>
  }

  return <main className="creator-shell" style={{ '--accent': day.accent, '--soft': day.soft } as React.CSSProperties}><Ambient /><nav className="creator-nav wrap"><button className="text-button" onClick={onBack}><Icon name="back" size={18} /> Back to the arcade</button><div className="brand"><span className="brand-mark"><Icon name="heart" size={15} /></span><span>Aquira<span>Craft</span></span></div><span className="autosave"><i /> Your magic is saved locally</span></nav><div className="creator-layout wrap"><section className="creator-form"><span className="kicker">CRAFTING · {day.eyebrow.toUpperCase()}</span><h1>Let’s make this feel<br /><em>exactly like you two.</em></h1><p className="form-intro">Little details make the magic hit different. Fill what feels right — we’ve already made the rest beautiful.</p><label className="field-label">Choose the experience</label><div className="day-picker">{DAYS.map((item) => <button className={item.slug === daySlug ? 'selected' : ''} title={item.name} onClick={() => changeDay(item.slug)} key={item.slug}>{item.number}<span>{item.symbol}</span></button>)}</div><div className="field-row"><label><span>Their name</span><input value={to} onChange={(event) => setTo(event.target.value)} placeholder="The lucky human" /></label><label><span>Your name</span><input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="The romantic mastermind" /></label></div><label><span>Your opening note</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} /></label><div className="form-divider"><span>{day.symbol}</span><i /></div>{EXTRA_FIELDS[daySlug].map((field) => <label key={field.key}><span>{field.label}</span>{field.type === 'textarea' ? <textarea rows={3} value={extras[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => setExtras({ ...extras, [field.key]: event.target.value })} /> : field.type === 'select' ? <select value={extras[field.key] ?? field.options?.[0]} onChange={(event) => setExtras({ ...extras, [field.key]: event.target.value })}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input value={extras[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => setExtras({ ...extras, [field.key]: event.target.value })} />}</label>)}<button className="primary-button create-button" onClick={createLink}>Wrap it & create the link <Icon name="spark" /></button><p className="form-footnote"><Icon name="lock" size={14} /> Your words stay inside the link. Nothing is uploaded.</p></section><aside className="preview-side"><div className="preview-label"><span>LIVE PEEK</span><i>Recipient view</i></div><div className={`phone-preview preview-${daySlug}`}><div className="phone-bar"><i /><span>AQUIRA · PRIVATE</span><b>•••</b></div><div className="phone-content"><span className="preview-date">{day.date}</span><DayMiniArt day={daySlug} symbol={day.symbol} /><small>A little something for</small><h3>{to || 'your favourite human'}</h3><p>{message}</p><button>Begin the magic <Icon name="arrow" size={15} /></button></div><div className="phone-home" /></div><p className="preview-whisper">Psst — this is only the doorway.<br />The real experience has surprises inside.</p></aside></div></main>
}

function Recipient({ gift, onLeave }: { gift: Gift; onLeave: () => void }) {
  const [opened, setOpened] = useState(false)
  const day = DAYS.find((item) => item.slug === gift.day)!
  if (!opened) return <main className={`gift-door gift-door-${gift.day}`} style={{ '--accent': day.accent, '--soft': day.soft } as React.CSSProperties}><Ambient dense /><button className="gift-brand brand" onClick={onLeave}><span className="brand-mark"><Icon name="heart" size={15} /></span><span>Aquira<span>Craft</span></span></button><div className="door-orbit orbit-a" /><div className="door-orbit orbit-b" /><section className="door-card"><div className="door-date"><span>{day.date}</span><i>{day.symbol}</i></div><div className="wax-seal"><Icon name="heart" size={28} /></div><span className="kicker">A PRIVATE {day.name.toUpperCase()} EXPERIENCE</span><p className="door-for">A little universe was made for</p><h1>{gift.to}</h1><blockquote>“{gift.message}”</blockquote><button className="primary-button" onClick={() => setOpened(true)}>Open the secret door <Icon name="spark" /></button><small>Best experienced with sound on & guard down</small></section><p className="door-from">thoughtfully made by <strong>{gift.from}</strong></p></main>
  return <div className={`experience experience-${gift.day}`} style={{ '--accent': day.accent, '--soft': day.soft } as React.CSSProperties}>{gift.day === 'rose' && <RoseExperience gift={gift} />}{gift.day === 'propose' && <ProposeExperience gift={gift} />}{gift.day === 'chocolate' && <ChocolateExperience gift={gift} />}{gift.day === 'teddy' && <TeddyExperience gift={gift} />}{gift.day === 'promise' && <PromiseExperience gift={gift} />}{gift.day === 'hug' && <HugExperience gift={gift} />}{gift.day === 'kiss' && <KissExperience gift={gift} />}{gift.day === 'valentine' && <ValentineExperience gift={gift} />}<button className="experience-exit" onClick={onLeave}>AquiraCraft <span>×</span></button></div>
}

function StageTop({ label, step, total }: { label: string; step: number; total: number }) {
  return <header className="stage-top"><span>{label}</span><div>{Array.from({ length: total }, (_, index) => <i key={index} className={index < step ? 'done' : ''} />)}</div><b>{String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}</b></header>
}

function Finale({ gift, title, children }: { gift: Gift; title: React.ReactNode; children: React.ReactNode }) {
  return <section className="finale"><Celebration /><span className="finale-kicker">DELIVERED · FELT · YOURS</span><h2>{title}</h2><div className="finale-copy">{children}</div><div className="signature">with a full heart,<br /><strong>{gift.from}</strong></div><span className="finale-mark"><Icon name="heart" size={18} /> MADE ON AQUIRACRAFT</span></section>
}

function Celebration() { return <div className="celebration" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties}>{index % 3 === 0 ? '♥' : '•'}</i>)}</div> }

function RoseExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(1); const [roses, setRoses] = useState<number[]>([]); const spots = Array.from({ length: 7 }, (_, index) => index)
  if (stage === 3) return <Finale gift={gift} title={<>A bouquet that only<br /><em>blooms for {gift.to}.</em></>}><p>{gift.extras.compliment}</p><blockquote>“{gift.extras.memory}”</blockquote></Finale>
  return <main className="rose-world"><Ambient /><StageTop label="THE BLOOM ROOM" step={stage} total={3} />{stage === 1 ? <section className="experience-intro rose-intro"><span className="kicker">SOME FEELINGS NEED ROOTS</span><h1>A garden has been<br />waiting for <em>{gift.to}.</em></h1><p>Har phool ke andar ek chhoti si baat chhupi hai. Wake them gently.</p><button className="world-button" onClick={() => setStage(2)}>Step into the garden <Icon name="arrow" /></button><div className="rose-silhouette"><i /><i /><i /><b /></div></section> : <section className="garden-stage"><div className="moon">for<br /><strong>{gift.to}</strong></div><div className="garden-copy"><span>TAP THE SLEEPING BUDS</span><h2>Make five feelings bloom.</h2><p>{roses.length < 5 ? `${5 - roses.length} little ${5 - roses.length === 1 ? 'feeling' : 'feelings'} still hiding…` : 'Okay wow. Full filmy garden unlocked.'}</p></div><div className="garden-bed">{spots.map((spot) => <button aria-label="Grow a rose" key={spot} className={roses.includes(spot) ? 'bloomed' : ''} onClick={() => !roses.includes(spot) && setRoses([...roses, spot])} style={{ '--x': `${8 + (spot * 14) % 86}%`, '--h': `${70 + (spot % 3) * 24}px`, '--d': `${spot * .08}s` } as React.CSSProperties}><i className="stem" /><i className="leaf" /><span className="flower"><b /><b /><b /><b /><em>♥</em></span></button>)}</div>{roses.length >= 5 && <button className="world-button floating-next" onClick={() => setStage(3)}>Gather the bouquet <Icon name="spark" /></button>}</section>}</main>
}

function ProposeExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(1); const [stars, setStars] = useState<number[]>([]); const [noPos, setNoPos] = useState({ x: 0, y: 0 })
  if (stage === 3) return <Finale gift={gift} title={<>Plot twist:<br /><em>the universe said yes too.</em></>}><p>Dear {gift.extras.nickname || gift.to}, you just made one dramatic human extremely happy.</p><blockquote>“{gift.message}”</blockquote></Finale>
  return <main className="sky-world"><div className="star-field">{Array.from({ length: 50 }, (_, i) => <i key={i} style={{ '--x': `${(i * 47) % 100}%`, '--y': `${(i * 31) % 92}%`, '--d': `${i % 7}s` } as React.CSSProperties} />)}</div><StageTop label="WRITTEN IN THE STARS" step={stage} total={3} />{stage === 1 ? <section className="experience-intro sky-intro"><span className="kicker">TRANSMISSION FROM SOMEONE OBSESSED</span><h1>{gift.to}, the sky has<br /><em>something to ask.</em></h1><p>But pehle thodi mehnat. Four lost stars need you.</p><button className="world-button" onClick={() => setStage(2)}>Enter the night sky <Icon name="spark" /></button></section> : <section className="constellation-stage"><div className="sky-instruction"><span>CONNECT THE BUTTERFLY CONSTELLATION</span><h2>Tap the stars in your orbit.</h2><p>{stars.length}/4 aligned · destiny buffering…</p></div><svg className="constellation-lines" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="20,64 40,30 58,62 78,25" /></svg>{[[20,64],[40,30],[58,62],[78,25]].map((pos, i) => <button aria-label={`Star ${i + 1}`} key={i} className={`big-star ${stars.includes(i) ? 'lit' : ''}`} style={{ left: `${pos[0]}%`, top: `${pos[1]}%` }} onClick={() => !stars.includes(i) && setStars([...stars, i])}>✦<small>{stars.includes(i) ? ['the day', 'you smiled', 'I knew', 'it was you'][i] : i + 1}</small></button>)}{stars.length === 4 && <div className="proposal-card"><span>{gift.from.toUpperCase()} IS TRYING TO ACT NORMAL</span><h2>{gift.extras.question}</h2><div><button className="yes-button" onClick={() => setStage(3)}>{gift.extras.yesLabel || 'Yes, obviously'}</button><button className="no-button" style={{ transform: `translate(${noPos.x}px, ${noPos.y}px)` }} onMouseEnter={() => setNoPos({ x: Math.round(Math.random() * 120 - 60), y: Math.round(Math.random() * 70 - 35) })} onClick={() => setNoPos({ x: Math.round(Math.random() * 120 - 60), y: Math.round(Math.random() * 70 - 35) })}>Let me pretend to think</button></div></div>}</section>}</main>
}

function ChocolateExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(1); const [opened, setOpened] = useState<number[]>([]); const [ticket, setTicket] = useState(false); const flavours = ['softie detected', 'main character energy', 'chaos, but cute', 'certified snack thief', 'too sweet, suspicious', 'secret centre']
  if (stage === 3) return <Finale gift={gift} title={<>Golden ticket<br /><em>officially redeemed.</em></>}><p>{gift.extras.reward}</p><blockquote>“{gift.extras.tease}”</blockquote></Finale>
  return <main className="chocolate-world"><StageTop label="THE SWEET HEIST" step={stage} total={3} />{stage === 1 ? <section className="experience-intro chocolate-intro"><div className="choco-logo"><span>THE</span><b>SWEET<br />HEIST</b><small>for {gift.to}</small></div><h1>Six chocolates.<br /><em>One golden secret.</em></h1><p>Flavour profile: {gift.extras.flavour}. Risk level: deliciously high.</p><button className="world-button" onClick={() => setStage(2)}>Unbox the evidence <Icon name="arrow" /></button></section> : <section className="chocolate-stage"><div className="chocolate-copy"><span>CASE FILE: {gift.to.toUpperCase()}</span><h2>Pick your suspects.</h2><p>Open any three. The box knows your type.</p></div><div className="chocolate-box">{flavours.map((flavour, i) => <button key={flavour} className={`chocolate-piece piece-${i} ${opened.includes(i) ? 'unwrapped' : ''}`} onClick={() => { if (!opened.includes(i)) { const next = [...opened, i]; setOpened(next); if (next.length >= 3) window.setTimeout(() => setTicket(true), 450) } }}><span className="wrapper">{['◆','●','♥','✦','■','?'][i]}</span><span className="choco-reveal">{flavour}</span></button>)}</div><div className="taste-meter"><span>Your official taste</span><b>{opened.length === 0 ? 'mysterious' : opened.length < 3 ? 'cute with questionable choices' : 'excellent. obviously.'}</b><i><em style={{ width: `${Math.min(opened.length / 3 * 100, 100)}%` }} /></i></div>{ticket && <div className="golden-ticket"><span>✦ GOLDEN TICKET ✦</span><h3>{gift.extras.reward}</h3><button onClick={() => setStage(3)}>Claim this sweetness <Icon name="arrow" size={17} /></button></div>}</section>}</main>
}

function TeddyExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(1); const [mood, setMood] = useState('soft'); const [hug, setHug] = useState(0); const timer = useRef<number | null>(null)
  const startHug = () => { if (timer.current) return; timer.current = window.setInterval(() => setHug(value => { const next = Math.min(100, value + 2); if (next >= 100 && timer.current) { clearInterval(timer.current); timer.current = null } return next }), 35) }; const stopHug = () => { if (timer.current) clearInterval(timer.current); timer.current = null }
  useEffect(() => () => stopHug(), [])
  if (stage === 3) return <Finale gift={gift} title={<>Comfort creature<br /><em>successfully activated.</em></>}><p>{gift.extras.comfort}</p><blockquote>{gift.extras.teddyName} now comes with: {gift.extras.trait}, no expiry, and hugs from {gift.from}.</blockquote></Finale>
  return <main className="teddy-world"><StageTop label="BUILD-A-BAE LAB" step={stage} total={3} />{stage === 1 ? <section className="experience-intro teddy-intro"><div className="lab-tag">SOFTNESS LAB · UNIT 10</div><h1>Emergency comfort<br /><em>is under construction.</em></h1><p>{gift.from} ordered one custom cuddle specialist for {gift.to}.</p><button className="world-button" onClick={() => setStage(2)}>Enter the soft lab <Icon name="arrow" /></button><div className="teddy-parts"><i>●</i><i>⌒</i><i>♡</i></div></section> : <section className="teddy-stage"><div className="teddy-panel"><span>CUSTOMISE THE VIBE</span><h2>Meet {gift.extras.teddyName}.</h2><p>Special power: <strong>{gift.extras.trait}</strong></p><div className="mood-options">{[['soft','softie'],['cool','too cool'],['chaos','chaos baby']].map(([key,label]) => <button className={mood === key ? 'chosen' : ''} onClick={() => setMood(key)} key={key}>{label}</button>)}</div><div className="hug-meter"><span>HUG CHARGE</span><b>{hug}%</b><i><em style={{ width: `${hug}%` }} /></i><small>{hug < 35 ? 'Hold the paw. Don’t be shy.' : hug < 75 ? 'A little tighter… haan, like that.' : hug < 100 ? 'Almost maximum pyaar!' : 'MAXIMUM SQUISH ACHIEVED'}</small></div></div><div className={`big-teddy teddy-${mood} ${hug >= 100 ? 'fully-hugged' : ''}`}><i className="ear left" /><i className="ear right" /><div className="teddy-head"><i className="eye left" /><i className="eye right" /><b>ᴗ</b></div><div className="teddy-body"><span>for<br /><strong>{gift.to}</strong></span></div><button className="teddy-paw left" onPointerDown={startHug} onPointerUp={stopHug} onPointerLeave={stopHug} aria-label="Hold teddy paw" /><i className="teddy-paw right" /></div>{hug >= 100 && <button className="world-button floating-next" onClick={() => setStage(3)}>Read the comfort note <Icon name="heart" /></button>}</section>}</main>
}

function PromiseExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(1); const [lit, setLit] = useState<number[]>([]); const [seal, setSeal] = useState(0); const timer = useRef<number | null>(null)
  const start = () => { if (timer.current) return; timer.current = window.setInterval(() => setSeal(v => { const n = Math.min(100, v + 2); if (n >= 100 && timer.current) { clearInterval(timer.current); timer.current = null } return n }), 35) }; const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null }
  if (stage === 3) return <Finale gift={gift} title={<>Three promises.<br /><em>One very real us.</em></>}><p>Not perfect. Not performative. Just honest, held, and yours.</p><blockquote>Sealed by {gift.to} + {gift.from}, somewhere on the internet ✦</blockquote></Finale>
  const promises = [gift.extras.promise1, gift.extras.promise2, gift.extras.promise3]
  return <main className="promise-world"><div className="promise-stars" /><StageTop label="THE PINKY PROTOCOL" step={stage} total={3} />{stage === 1 ? <section className="experience-intro promise-intro"><span className="kicker">WORDS THAT PLAN TO STAY</span><h1>Some promises deserve<br /><em>their own sky.</em></h1><p>{gift.from} left three here. They only shine when you truly see them.</p><button className="world-button" onClick={() => setStage(2)}>Look up <Icon name="spark" /></button></section> : <section className="promise-stage"><div className="promise-copy"><span>TOUCH EACH PROMISE TO KEEP IT</span><h2>A constellation for {gift.to}.</h2></div><div className="promise-orbit">{promises.map((promise, i) => <button className={lit.includes(i) ? 'lit' : ''} key={i} onClick={() => !lit.includes(i) && setLit([...lit, i])}><i>{i + 1}</i><p>{promise}</p><span>✦</span></button>)}<svg viewBox="0 0 100 100"><path d="M20 70 Q50 5 80 70" /></svg></div>{lit.length === 3 && <div className="pinky-seal"><div className="pinky-hands"><span>☝</span><i style={{ opacity: seal / 100 }} /><span>☝</span></div><p>Hold to seal the pinky promise</p><button onPointerDown={start} onPointerUp={stop} onPointerLeave={stop}><i><em style={{ width: `${seal}%` }} /></i>{seal < 100 ? 'HOLD THE PROMISE' : 'SEALED FOREVER-ISH'}</button>{seal >= 100 && <button className="world-button" onClick={() => setStage(3)}>See our constellation <Icon name="spark" /></button>}</div>}</section>}</main>
}

function HugExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(1); const [notes, setNotes] = useState<number[]>([]); const [warmth, setWarmth] = useState(0); const timer = useRef<number | null>(null)
  const start = () => { if (timer.current) return; timer.current = window.setInterval(() => setWarmth(v => { const n = Math.min(100, v + 1); if (n >= 100 && timer.current) { clearInterval(timer.current); timer.current = null } return n }), 28) }; const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null }
  if (stage === 3) return <Finale gift={gift} title={<>Distance: temporarily<br /><em>cancelled.</em></>}><p>{gift.extras.whisper}</p><blockquote>Hug style selected: {gift.extras.hugStyle}. Duration: jitni der chahiye.</blockquote></Finale>
  return <main className="hug-world" style={{ '--warmth': warmth / 100 } as React.CSSProperties}><StageTop label="THE WARMTH ROOM" step={stage} total={3} />{stage === 1 ? <section className="experience-intro hug-intro"><span className="kicker">A SMALL ROOM WITH BIG COMFORT</span><h1>This space gets warmer<br /><em>when you stay.</em></h1><p>{gift.extras.distance}</p><button className="world-button" onClick={() => setStage(2)}>Come inside <Icon name="arrow" /></button><div className="window-scene"><i /><i /><b /></div></section> : <section className="hug-stage"><div className="room-window"><i /><span>outside: too much<br /><strong>inside: us</strong></span></div><div className="sofa"><button className={notes.includes(0) ? 'found' : ''} onClick={() => setNotes([...new Set([...notes, 0])])}><i /><span>you can exhale here</span></button><button className={notes.includes(1) ? 'found' : ''} onClick={() => setNotes([...new Set([...notes, 1])])}><i /><span>no fixing, just holding</span></button><button className={notes.includes(2) ? 'found' : ''} onClick={() => setNotes([...new Set([...notes, 2])])}><i /><span>I’ve got you</span></button></div><div className="room-copy"><span>FIND THE THREE COMFORT NOTES</span><h2>{notes.length < 3 ? `${3 - notes.length} soft places left.` : 'The room is ready for the hug.'}</h2></div>{notes.length === 3 && <div className="warmth-control"><div className="warmth-ring" style={{ '--p': `${warmth * 3.6}deg` } as React.CSSProperties}><button onPointerDown={start} onPointerUp={stop} onPointerLeave={stop}><Icon name="heart" size={34} /><span>{warmth < 100 ? 'HOLD TO HUG' : 'HELD.'}</span></button></div><p>{warmth < 100 ? `${warmth}% closer` : gift.extras.whisper}</p>{warmth >= 100 && <button className="world-button" onClick={() => setStage(3)}>Stay here a moment <Icon name="heart" /></button>}</div>}</section>}</main>
}

function KissExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(1); const [stamp, setStamp] = useState('MUAH'); const [power, setPower] = useState(15); const [sent, setSent] = useState(false)
  if (stage === 3) return <Finale gift={gift} title={<>Special delivery:<br /><em>right on target.</em></>}><p>{gift.extras.after}</p><blockquote>{gift.extras.kissType} delivered to “{gift.extras.destination}” with zero customs duty.</blockquote></Finale>
  return <main className="kiss-world"><StageTop label="KISS COURIER · EXPRESS" step={stage} total={3} />{stage === 1 ? <section className="experience-intro kiss-intro"><div className="courier-stamp">FRAGILE<br /><b>♥</b><small>HANDLE WITH FEELINGS</small></div><h1>One kiss is awaiting<br /><em>international dispatch.</em></h1><p>Sender: {gift.from}. Recipient: the suspiciously cute {gift.to}.</p><button className="world-button" onClick={() => setStage(2)}>Prepare shipment <Icon name="arrow" /></button></section> : <section className="kiss-stage"><div className="kiss-form"><span>AQUIRA EXPRESS · PRIORITY FEELINGS</span><h2>Customise the kiss.</h2><label>CHOOSE A STAMP<div>{['MUAH','XO','♥','UMM…'].map(item => <button className={stamp === item ? 'selected' : ''} onClick={() => setStamp(item)} key={item}>{item}</button>)}</div></label><label>KISS VELOCITY <input type="range" min="10" max="100" value={power} onChange={e => setPower(Number(e.target.value))} /><span>{power < 40 ? 'sweet & shy' : power < 75 ? 'butterfly speed' : 'dangerously filmy'}</span></label><button className="dispatch" onClick={() => { setSent(true); window.setTimeout(() => setStage(3), 2400) }} disabled={sent}>{sent ? 'IN TRANSIT…' : 'DISPATCH THE KISS'} <Icon name="arrow" /></button></div><div className="kiss-route"><div className="city sender"><i>{gift.from.charAt(0)}</i><span>{gift.from}<small>kiss dispatched</small></span></div><div className="route-line"><i /><b className={sent ? 'fly' : ''} style={{ '--speed': `${2.5 - power / 70}s` } as React.CSSProperties}>{stamp}</b></div><div className="city receiver"><i>{gift.to.charAt(0)}</i><span>{gift.to}<small>{gift.extras.destination}</small></span></div>{sent && <p>Package is crossing the “we should meet soon” zone…</p>}</div></section>}</main>
}

function ValentineExperience({ gift }: { gift: Gift }) {
  const [stage, setStage] = useState(1); const [rooms, setRooms] = useState<number[]>([]); const stories = [{ label: 'THEN', title: 'Where it quietly began', text: gift.extras.memory }, { label: 'NOW', title: 'Why the ordinary glows', text: gift.extras.reason }, { label: 'NEXT', title: 'A future worth leaning into', text: gift.extras.future }]
  if (stage === 3) return <Finale gift={gift} title={<>My favourite place<br /><em>is wherever “us” is.</em></>}><p>{gift.message}</p><blockquote>Happy Valentine’s Day, {gift.to}. Today, tomorrow, and on all the very normal days in between.</blockquote></Finale>
  return <main className="valentine-world"><StageTop label="THE US MUSEUM" step={stage} total={3} />{stage === 1 ? <section className="experience-intro valentine-intro"><span className="museum-ticket">ADMIT ONE · {gift.to.toUpperCase()} · FOREVER VALID</span><h1>Welcome to a museum<br /><em>where every room is us.</em></h1><p>Three rooms. One timeline. Please keep your heart inside the experience at all times.</p><button className="world-button" onClick={() => setStage(2)}>Enter the museum <Icon name="arrow" /></button><div className="museum-arches"><i /><i /><i /></div></section> : <section className="museum-stage"><div className="museum-heading"><span>PRIVATE COLLECTION · CURATED BY {gift.from.toUpperCase()}</span><h2>Walk through our time.</h2><p>Open each room. Take your time.</p></div><div className="museum-rooms">{stories.map((story, i) => <button className={rooms.includes(i) ? 'open' : ''} onClick={() => setRooms([...new Set([...rooms, i])])} key={story.label}><span className="room-number">0{i + 1}</span><div className="room-door"><i /><b>{story.label}</b></div><article><span>{story.label}</span><h3>{story.title}</h3><p>{story.text}</p></article></button>)}</div>{rooms.length === 3 && <div className="museum-centre"><i><Icon name="heart" size={40} /></i><span>THE CENTREPIECE</span><h3>The part where {gift.to}<br />realises they are deeply loved.</h3><button className="world-button" onClick={() => setStage(3)}>Touch the heart <Icon name="heart" /></button></div>}</section>}</main>
}

export default App
