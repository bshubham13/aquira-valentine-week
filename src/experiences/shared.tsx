import { useState, type ReactNode } from 'react'
import type { Gift } from '../App'

type IconName = 'heart' | 'arrow' | 'spark'

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    spark: <path d="m12 3-1.2 4.3a5 5 0 0 1-3.5 3.5L3 12l4.3 1.2a5 5 0 0 1 3.5 3.5L12 21l1.2-4.3a5 5 0 0 1 3.5-3.5L21 12l-4.3-1.2a5 5 0 0 1-3.5-3.5Z" />,
  }
  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

export function StageTop({ label, step, total }: { label: string; step: number; total: number }) {
  return <header className="stage-top"><span>{label}</span><div>{Array.from({ length: total }, (_, index) => <i key={index} className={index < step ? 'done' : ''} />)}</div><b>{String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}</b></header>
}

export function Celebration() {
  return <div className="celebration" aria-hidden="true">{Array.from({ length: 32 }, (_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties}>{index % 3 === 0 ? '♥' : '•'}</i>)}</div>
}

export function Finale({ gift, title, children, badge = 'DELIVERED · FELT · YOURS', actions }: { gift: Gift; title: ReactNode; children: ReactNode; badge?: string; actions?: { onReplay?: () => void; shareUrl?: string; replayLabel?: string } }) {
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    if (!actions?.shareUrl) return
    try { await navigator.clipboard.writeText(actions.shareUrl) } catch { /* clipboard unavailable — still confirm */ }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return <section className="finale"><Celebration /><span className="finale-kicker">{badge}</span><h2>{title}</h2><div className="finale-copy">{children}</div>{actions && (actions.onReplay || actions.shareUrl) && <div className="finale-actions">{actions.onReplay && <button className="world-button" onClick={actions.onReplay}>{actions.replayLabel ?? '↻ Replay the rose'}</button>}{actions.shareUrl && <button className="secondary-button" onClick={() => void copyLink()}>{copied ? 'Copied!' : 'Copy link'}</button>}</div>}<div className="signature">with a full heart,<br /><strong>{gift.from}</strong></div><span className="finale-mark"><Icon name="heart" size={18} /> MADE ON AQUIRACRAFT</span></section>
}

export function SoftParticles({ count = 24 }: { count?: number }) {
  return <div className="soft-particles" aria-hidden="true">{Array.from({ length: count }, (_, i) => <i key={i} style={{ '--x': `${(i * 43) % 100}%`, '--y': `${(i * 29) % 96}%`, '--d': `${(i % 8) * -.55}s`, '--s': `${4 + i % 7}px` } as React.CSSProperties} />)}</div>
}

/** DEV-only deep-link (?journeyStage=N), clamped to the day's own finale stage. */
