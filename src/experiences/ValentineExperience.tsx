import { useState } from 'react'
import type { Gift } from '../App'
import { Icon, StageTop, Finale } from './shared'
import { initialStage } from './shared-hooks'

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
