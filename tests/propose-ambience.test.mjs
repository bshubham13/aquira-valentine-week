/**
 * Propose ambience tests — src/lib/ambience.ts, starChoir profile (H1).
 * The AudioContext is mocked; created oscillators are recorded so the
 * one-shot frequencies are asserted, not just "does not throw".
 *
 * Also carries the nightGarden regression guard for the roseAmbience →
 * ambience rename: Rose's loop must behave identically in the new module.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

function mockAudioParam() {
  return {
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
  }
}

function mockAudioNode() {
  return { connect() {}, disconnect() {}, start() {}, stop() {} }
}

const createdContexts = []
const createdOscillators = []
const createdBufferSources = []

class MockAudioContext {
  constructor() {
    this.state = 'running'
    this.currentTime = 0
    this.sampleRate = 44100
    this.destination = {}
    this.resumeCalls = 0
    this.suspendCalls = 0
    createdContexts.push(this)
  }

  resume() {
    this.resumeCalls++
    this.state = 'running'
    return Promise.resolve()
  }

  suspend() {
    this.suspendCalls++
    this.state = 'suspended'
    return Promise.resolve()
  }

  createGain() {
    return { ...mockAudioNode(), gain: mockAudioParam() }
  }

  createOscillator() {
    const osc = { ...mockAudioNode(), type: 'sine', frequency: mockAudioParam() }
    createdOscillators.push(osc)
    return osc
  }

  createBufferSource() {
    const node = mockAudioNode()
    node.buffer = null
    node.loop = false
    createdBufferSources.push(node)
    return node
  }

  createBiquadFilter() {
    return { ...mockAudioNode(), type: 'lowpass', frequency: mockAudioParam() }
  }

  createBuffer(_channels, length) {
    return { getChannelData: () => new Float32Array(length) }
  }
}

globalThis.AudioContext = MockAudioContext
const { createAmbience, ambience } = await import('../src/lib/ambience.ts')

test('creating a handle plays nothing before a user gesture', () => {
  const before = createdContexts.length
  const handle = createAmbience('starChoir')
  assert.equal(handle.isPlaying(), false)
  assert.equal(handle.getProfile(), 'starChoir')
  assert.equal(createdContexts.length, before, 'no AudioContext before start')
  handle.stop()
})

test('starChoir starts the loop and reports playing; stop suspends it', () => {
  const handle = createAmbience('starChoir')
  try {
    assert.equal(handle.start(), true)
    assert.equal(handle.isPlaying(), true)
    assert.equal(handle.getProfile(), 'starChoir')
    const ctx = createdContexts[createdContexts.length - 1]
    assert.ok(ctx.resumeCalls >= 1, 'context resumed on start')

    assert.equal(handle.start(), true, 'starting twice is a no-op success')

    handle.stop()
    assert.equal(handle.isPlaying(), false)
    assert.ok(ctx.suspendCalls >= 1, 'stop suspends the context (real mute)')
  } finally {
    handle.stop()
  }
})

test('toggle and setMuted work on the starChoir profile', () => {
  const handle = createAmbience('starChoir')
  try {
    assert.equal(handle.toggle(), true)
    assert.equal(handle.isPlaying(), true)
    const ctx = createdContexts[createdContexts.length - 1]
    const suspendsBefore = ctx.suspendCalls
    handle.setMuted(true)
    assert.equal(handle.isMuted(), true)
    assert.ok(ctx.suspendCalls > suspendsBefore, 'mute really suspends the context')
    handle.setMuted(false)
    assert.equal(handle.isMuted(), false)
    assert.equal(handle.toggle(), false)
    assert.equal(handle.isPlaying(), false)
  } finally {
    handle.stop()
  }
})

test('setProfile switches the loop while playing without a new context', () => {
  const handle = createAmbience('nightGarden')
  try {
    assert.equal(handle.start(), true)
    const contextsBefore = createdContexts.length
    handle.setProfile('starChoir')
    assert.equal(handle.getProfile(), 'starChoir')
    assert.equal(handle.isPlaying(), true, 'loop keeps playing after the switch')
    assert.equal(createdContexts.length, contextsBefore, 'no new AudioContext on profile switch')
    handle.setProfile('nightGarden')
    assert.equal(handle.getProfile(), 'nightGarden')
    assert.equal(handle.isPlaying(), true)
  } finally {
    handle.stop()
  }
})

test('setProfile before start just records the profile', () => {
  const handle = createAmbience('nightGarden')
  try {
    handle.setProfile('starChoir')
    assert.equal(handle.getProfile(), 'starChoir')
    assert.equal(handle.isPlaying(), false)
    assert.equal(handle.start(), true)
  } finally {
    handle.stop()
  }
})

test('one-shots play their notes even when the loop is off, and never start it', () => {
  const handle = createAmbience('starChoir')
  assert.equal(handle.isPlaying(), false)

  const oscBefore = createdOscillators.length
  assert.doesNotThrow(() => handle.playTwinkle())
  assert.equal(createdOscillators.length, oscBefore + 1, 'twinkle is one oscillator')
  assert.equal(createdOscillators[createdOscillators.length - 1].frequency.value, 1567.98, 'twinkle is a high star note')

  assert.doesNotThrow(() => handle.playPop())
  const popOsc = createdOscillators[createdOscillators.length - 1]
  assert.equal(popOsc.frequency.value, 160, 'pop ends in a low thud')
  assert.ok(createdBufferSources.length > 0, 'pop has a noise burst')

  assert.doesNotThrow(() => handle.playLaunch())
  const launchOscs = createdOscillators.slice(-3)
  assert.deepEqual(
    launchOscs.map((osc) => osc.frequency.value),
    [880, 1174.66, 1567.98],
    'launch is a rising arpeggio',
  )

  assert.equal(handle.isPlaying(), false, 'one-shots do not start the loop')
  handle.stop()
})

test('nightGarden regression guard: Rose loop behaves identically in the new module', () => {
  const handle = createAmbience('nightGarden')
  try {
    assert.equal(handle.getProfile(), 'nightGarden')
    assert.equal(handle.start(), true)
    assert.equal(handle.isPlaying(), true)

    const oscBefore = createdOscillators.length
    assert.doesNotThrow(() => handle.playChime())
    const chimeOscs = createdOscillators.slice(oscBefore)
    assert.deepEqual(
      chimeOscs.map((osc) => osc.frequency.value),
      [880, 1318.5],
      'Rose chime is the same two notes',
    )

    // The app singleton is the nightGarden loop by default.
    assert.equal(ambience.getProfile(), 'nightGarden')
  } finally {
    handle.stop()
  }
})

test('without any AudioContext every method is a safe no-op (H1)', async () => {
  delete globalThis.AudioContext
  try {
    const silent = createAmbience('starChoir')
    assert.equal(silent.start(), false, 'no audio available')
    assert.equal(silent.isPlaying(), false)
    assert.equal(silent.toggle(), false)
    assert.doesNotThrow(() => silent.stop())
    assert.doesNotThrow(() => silent.setMuted(true))
    assert.doesNotThrow(() => silent.setProfile('nightGarden'))
    assert.doesNotThrow(() => silent.playTwinkle())
    assert.doesNotThrow(() => silent.playPop())
    assert.doesNotThrow(() => silent.playLaunch())
    assert.doesNotThrow(() => silent.playChime())
    assert.doesNotThrow(() => silent.playSnip())

    assert.equal(ambience.start(), false)
    assert.equal(ambience.isPlaying(), false)
  } finally {
    globalThis.AudioContext = MockAudioContext
  }
})
