/**
 * Real Web Audio ambience for Valentine Week — the honest replacement for the
 * old fake "Toggle ambience" button (H1). A tiny synthesized loop: soft
 * filtered noise + sparse pentatonic chimes, no audio files.
 *
 * One engine, per-day profiles. Rose keeps its exact "night garden" loop as
 * the `nightGarden` profile (byte-identical sound); Propose gets `starChoir`
 * — quieter, more spacious: the same filtered-noise bed at lower gain,
 * sparser and higher pentatonic chimes, longer gaps. A proposal deserves
 * silence between notes.
 *
 * - The AudioContext is created lazily, only from a user gesture (toggle
 *   click / door open). Nothing plays before that.
 * - Mute is real: it suspends the AudioContext.
 * - One-shot sounds (snip / chime / twinkle / pop / launch) work even when
 *   the loop is off — they are themselves user gestures.
 * - Safe in Node tests: with no AudioContext available every method is a
 *   no-op. Tests can inject a mock via `globalThis.AudioContext` before
 *   calling `createAmbience()` — the constructor is read lazily, never cached
 *   at import time.
 */

export type AmbienceProfile = 'nightGarden' | 'starChoir'

export interface AmbienceHandle {
  /** Starts the loop for the current profile. Returns false when audio is unavailable. */
  start(): boolean
  /** Stops the loop and suspends the context. */
  stop(): void
  /** Toggles the loop. Returns the new playing state. */
  toggle(): boolean
  setMuted(muted: boolean): void
  isMuted(): boolean
  isPlaying(): boolean
  /** Switches the loop's profile. If the loop is playing it restarts in the new profile. */
  setProfile(profile: AmbienceProfile): void
  getProfile(): AmbienceProfile
  /** Short snip. No-op without audio. (Kept for tests; no stage uses it.) */
  playSnip(): void
  /** Soft chime (delivery complete). No-op without audio. */
  playChime(): void
  /** High twinkle (a star connects). No-op without audio. */
  playTwinkle(): void
  /** Soft pop (a nerve pops). No-op without audio. */
  playPop(): void
  /** Rising arpeggio (the shooting star launches). No-op without audio. */
  playLaunch(): void
}

type AudioContextCtor = new () => AudioContext

function audioContextCtor(): AudioContextCtor | null {
  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return g.AudioContext ?? g.webkitAudioContext ?? null
}

interface ProfileParams {
  /** Master gain of the loop. */
  masterGain: number
  /** Gain of the filtered-noise bed. */
  noiseGain: number
  /** Lowpass frequency of the noise bed. */
  noiseFilter: number
  /** Milliseconds between chimes. */
  chimeInterval: number
  /** Pentatonic notes the chimes draw from. */
  chimeNotes: number[]
  /** Peak gain of a loop chime. */
  chimeGain: number
  /** Seconds a loop chime rings out. */
  chimeDecay: number
}

const PROFILES: Record<AmbienceProfile, ProfileParams> = {
  /** Rose's night garden — the original loop, unchanged. */
  nightGarden: {
    masterGain: 0.14,
    noiseGain: 0.05,
    noiseFilter: 320,
    chimeInterval: 3400,
    chimeNotes: [523.25, 587.33, 659.25, 783.99, 880.0],
    chimeGain: 0.1,
    chimeDecay: 2.4,
  },
  /** Propose's star choir — quieter, spacier, higher. */
  starChoir: {
    masterGain: 0.1,
    noiseGain: 0.03,
    noiseFilter: 260,
    chimeInterval: 6000,
    chimeNotes: [1046.5, 1174.66, 1318.5, 1567.98, 1760.0],
    chimeGain: 0.07,
    chimeDecay: 3.2,
  },
}

/** Rising arpeggio for the shooting-star launch. */
const LAUNCH_NOTES = [880, 1174.66, 1567.98]

export function createAmbience(initialProfile: AmbienceProfile = 'nightGarden'): AmbienceHandle {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noiseSource: AudioBufferSourceNode | null = null
  let chimeTimer: ReturnType<typeof setInterval> | null = null
  let muted = false
  let playing = false
  let profile: AmbienceProfile = initialProfile

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
    const params = PROFILES[profile]
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
    filter.frequency.value = params.noiseFilter
    const noiseGain = context.createGain()
    noiseGain.gain.value = params.noiseGain
    source.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(master!)
    source.start()
    noiseSource = source
  }

  function scheduleChime(context: AudioContext): void {
    const params = PROFILES[profile]
    const note = params.chimeNotes[Math.floor(Math.random() * params.chimeNotes.length)]
    const now = context.currentTime
    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = note
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(params.chimeGain, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + params.chimeDecay)
    osc.connect(gain)
    gain.connect(master!)
    osc.start(now)
    osc.stop(now + params.chimeDecay + 0.2)
  }

  function startLoop(context: AudioContext): void {
    const params = PROFILES[profile]
    if (!master) {
      master = context.createGain()
      master.gain.value = muted ? 0 : params.masterGain
      master.connect(context.destination)
    } else {
      master.gain.value = muted ? 0 : params.masterGain
    }
    if (!noiseSource) buildNoiseLoop(context)
    if (!chimeTimer) {
      chimeTimer = setInterval(() => {
        if (playing && !muted) scheduleChime(context)
      }, params.chimeInterval)
    }
  }

  function stopLoop(): void {
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
    } catch {
      // ignore — stopping must never throw
    }
  }

  function start(): boolean {
    if (playing) return true
    const context = getCtx()
    if (!context) return false
    try {
      void context.resume()
      startLoop(context)
      playing = true
      return true
    } catch {
      return false
    }
  }

  function stop(): void {
    if (!playing && !ctx) return
    playing = false
    stopLoop()
    try {
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

  function setProfile(next: AmbienceProfile): void {
    if (next === profile) return
    profile = next
    if (!playing) return
    // Restart the loop in the new profile so the sound actually changes.
    const context = ctx
    stopLoop()
    if (context) {
      try {
        startLoop(context)
      } catch {
        // ignore — a failed restart leaves the loop stopped, never crashing
      }
    }
  }

  function playTone(freq: number, gainValue: number, decay: number, delay = 0): void {
    const context = getCtx()
    if (!context) return
    try {
      void context.resume()
      const now = context.currentTime
      const startAt = now + delay
      const osc = context.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const gain = context.createGain()
      gain.gain.setValueAtTime(0.0001, startAt)
      gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + decay)
      osc.connect(gain)
      gain.connect(context.destination)
      osc.start(startAt)
      osc.stop(startAt + decay + 0.1)
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

  function playTwinkle(): void {
    playTone(1567.98, 0.12, 0.9)
  }

  function playPop(): void {
    const context = getCtx()
    if (!context) return
    try {
      void context.resume()
      const now = context.currentTime
      // Short low noise burst + a soft thud.
      const length = Math.floor(context.sampleRate * 0.1)
      const buffer = context.createBuffer(1, length, context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
      const source = context.createBufferSource()
      source.buffer = buffer
      const filter = context.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 900
      const gain = context.createGain()
      gain.gain.value = 0.2
      source.connect(filter)
      filter.connect(gain)
      gain.connect(context.destination)
      source.start(now)
      playTone(160, 0.14, 0.18)
    } catch {
      // ignore
    }
  }

  function playLaunch(): void {
    for (const [index, freq] of LAUNCH_NOTES.entries()) {
      playTone(freq, index === 2 ? 0.1 : 0.13, 1.2, index * 0.12)
    }
  }

  return {
    start,
    stop,
    toggle,
    setMuted,
    isMuted: () => muted,
    isPlaying: () => playing,
    setProfile,
    getProfile: () => profile,
    playSnip,
    playChime,
    playTwinkle,
    playPop,
    playLaunch,
  }
}

/** App-wide singleton — Home toggle, recipient door and the experiences share it. */
export const ambience = createAmbience()
