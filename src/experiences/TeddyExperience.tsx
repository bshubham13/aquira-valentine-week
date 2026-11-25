import { useState } from 'react'
import type { Gift } from '../App'
import { Icon, StageTop, Finale } from './shared'
import { useHoldProgress, initialStage } from './shared-hooks'

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
