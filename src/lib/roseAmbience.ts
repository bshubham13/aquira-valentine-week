/**
 * Real Web Audio ambience for Rose Day — the honest replacement for the old
 * fake "Toggle ambience" button (H1). A tiny synthesized "night garden" loop:
 * soft filtered noise + sparse pentatonic chimes, no audio files.
 *
 * - The AudioContext is created lazily, only from a user gesture (toggle
 *   click / door open). Nothing plays before that.
 * - Mute is real: it suspends the AudioContext.
 * - One-shot sounds (snip / chime) work even when the loop is off — they are
 *   themselves user gestures.
 * - Safe in Node tests: with no AudioContext available every method is a
 *   no-op. Tests can inject a mock via `globalThis.AudioContext` before
 *   calling `createAmbience()` — the constructor is read lazily, never cached
 *   at import time.
 */

export interface AmbienceHandle {
  /** Starts the night-garden loop. Returns false when audio is unavailable. */
  start(): boolean
  /** Stops the loop and suspends the context. */
  stop(): void
  /** Toggles the loop. Returns the new playing state. */
  toggle(): boolean
  setMuted(muted: boolean): void
  isMuted(): boolean
  isPlaying(): boolean
  /** Short snip (thorn removal). No-op without audio. */
  playSnip(): void
  /** Soft chime (delivery complete). No-op without audio. */
  playChime(): void
}

type AudioContextCtor = new () => AudioContext

function audioContextCtor(): AudioContextCtor | null {
  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return g.AudioContext ?? g.webkitAudioContext ?? null
}

/** Pentatonic shimmer — C major pentatonic, one octave up. */
const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0]

export function createAmbience(): AmbienceHandle {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noiseSource: AudioBufferSourceNode | null = null
  let chimeTimer: ReturnType<typeof setInterval> | null = null
  let muted = false
  let playing = false

  function getCtx(): AudioContext | null {
    if (ctx) return ctx
    const Ctor = audioContextCtor()
    if (!Ctor) return null
    try {
      ctx = new Ctor()
    } catch {
      ctx = null
    }
    return ctx
  }

  function buildNoiseLoop(context: AudioContext): void {
    const length = Math.floor(context.sampleRate * 2)
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      // Soft pink-ish noise: heavily smoothed white noise.
      const white = Math.random() * 2 - 1
      last = last * 0.97 + white * 0.03
      data[i] = last * 3.2
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 320
    const noiseGain = context.createGain()
    noiseGain.gain.value = 0.05
    source.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(master!)
    source.start()
    noiseSource = source
  }

  function scheduleChime(context: AudioContext): void {
    const note = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)]
    const now = context.currentTime
    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = note
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4)
    osc.connect(gain)
    gain.connect(master!)
    osc.start(now)
    osc.stop(now + 2.6)
  }

  function start(): boolean {
    if (playing) return true
    const context = getCtx()
    if (!context) return false
    try {
      void context.resume()
      if (!master) {
        master = context.createGain()
        master.gain.value = muted ? 0 : 0.14
        master.connect(context.destination)
      } else {
        master.gain.value = muted ? 0 : 0.14
      }
      if (!noiseSource) buildNoiseLoop(context)
      if (!chimeTimer) {
        chimeTimer = setInterval(() => {
          if (playing && !muted) scheduleChime(context)
        }, 3400)
      }
      playing = true
      return true
    } catch {
      return false
    }
  }

  function stop(): void {
    if (!playing && !ctx) return
    playing = false
    if (chimeTimer !== null) {
      clearInterval(chimeTimer)
      chimeTimer = null
    }
    try {
      if (noiseSource) {
        noiseSource.stop()
        noiseSource.disconnect()
        noiseSource = null
      }
      if (ctx) void ctx.suspend()
    } catch {
      // ignore — stopping must never throw
    }
  }

  function toggle(): boolean {
    if (playing) {
      stop()
      return false
    }
    return start()
  }

  function setMuted(next: boolean): void {
    muted = next
    if (!ctx) return
    try {
      if (muted) {
        void ctx.suspend()
      } else if (playing) {
        void ctx.resume()
      }
    } catch {
      // ignore
    }
  }

  function playSnip(): void {
    const context = getCtx()
    if (!context) return
    try {
      void context.resume()
      const now = context.currentTime
      // Short filtered noise burst + a tiny high blip.
      const length = Math.floor(context.sampleRate * 0.07)
      const buffer = context.createBuffer(1, length, context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
      const source = context.createBufferSource()
      source.buffer = buffer
      const filter = context.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2600
      const gain = context.createGain()
      gain.gain.value = 0.25
      source.connect(filter)
      filter.connect(gain)
      gain.connect(context.destination)
      source.start(now)
      const blip = context.createOscillator()
      blip.type = 'sine'
      blip.frequency.value = 1250
      const blipGain = context.createGain()
      blipGain.gain.setValueAtTime(0.08, now)
      blipGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
      blip.connect(blipGain)
      blipGain.connect(context.destination)
      blip.start(now)
      blip.stop(now + 0.1)
    } catch {
      // ignore
    }
  }

  function playChime(): void {
    const context = getCtx()
    if (!context) return
    try {
      void context.resume()
      const now = context.currentTime
      for (const [index, freq] of [880, 1318.5].entries()) {
        const osc = context.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        const gain = context.createGain()
        const startAt = now + index * 0.12
        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.14 : 0.07, startAt + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.4)
        osc.connect(gain)
        gain.connect(context.destination)
        osc.start(startAt)
        osc.stop(startAt + 1.5)
      }
    } catch {
      // ignore
    }
  }

  return {
    start,
    stop,
    toggle,
    setMuted,
    isMuted: () => muted,
    isPlaying: () => playing,
    playSnip,
    playChime,
  }
}

/** App-wide singleton — Home toggle, recipient door and Rose stages share it. */
export const roseAmbience = createAmbience()
