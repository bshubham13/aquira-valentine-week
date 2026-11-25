import { useState } from 'react'
import type { Gift } from '../App'
import { Icon, StageTop, Finale } from './shared'
import { useHoldProgress, initialStage } from './shared-hooks'

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
