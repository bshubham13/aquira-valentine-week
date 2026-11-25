import { useState } from 'react'
import type { Gift } from '../App'
import { Icon, StageTop, Finale } from './shared'
import { initialStage } from './shared-hooks'

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
