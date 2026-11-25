import { useState } from 'react'
import type { Gift } from '../App'
import { Icon, StageTop, Finale } from './shared'
import { useHoldProgress, initialStage } from './shared-hooks'

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
