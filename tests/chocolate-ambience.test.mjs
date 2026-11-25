/**
 * Chocolate ambience tests — src/lib/ambience.ts, cocoaNight profile (H1).
 * The AudioContext is mocked; created oscillators are recorded so the
 * one-shot frequencies are asserted, not just "does not throw".
 *
 * Also carries regression guards for the other two profiles: Rose's
 * nightGarden and Propose's starChoir loops must behave identically after
 * the cocoaNight addition.
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
  const handle = createAmbience('cocoaNight')
  assert.equal(handle.isPlaying(), false)
  assert.equal(handle.getProfile(), 'cocoaNight')
  assert.equal(createdContexts.length, before, 'no AudioContext before start')
  handle.stop()
})

test('cocoaNight starts the loop and reports playing; stop suspends it', () => {
  const handle = createAmbience('cocoaNight')
  try {
    assert.equal(handle.start(), true)
    assert.equal(handle.isPlaying(), true)
    assert.equal(handle.getProfile(), 'cocoaNight')
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

test('toggle and setMuted work on the cocoaNight profile', () => {
  const handle = createAmbience('cocoaNight')
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
    handle.setProfile('cocoaNight')
    assert.equal(handle.getProfile(), 'cocoaNight')
    assert.equal(handle.isPlaying(), true, 'loop keeps playing after the switch')
    assert.equal(createdContexts.length, contextsBefore, 'no new AudioContext on profile switch')
    handle.setProfile('nightGarden')
    assert.equal(handle.getProfile(), 'nightGarden')
    assert.equal(handle.isPlaying(), true)
  } finally {
    handle.stop()
  }
})

test('chocolate one-shots play their notes even when the loop is off, and never start it', () => {
  const handle = createAmbience('cocoaNight')
  assert.equal(handle.isPlaying(), false)

  const oscBefore = createdOscillators.length
  assert.doesNotThrow(() => handle.playStir())
  assert.equal(createdOscillators.length, oscBefore + 1, 'stir is one oscillator')
  assert.equal(createdOscillators[createdOscillators.length - 1].frequency.value, 293.66, 'stir is a low bubble-blip')

  const buffersBefore = createdBufferSources.length
  assert.doesNotThrow(() => handle.playPeel())
  assert.ok(createdBufferSources.length > buffersBefore, 'peel has a foil-crinkle noise burst')

  assert.doesNotThrow(() => handle.playPour())
  const pourOscs = createdOscillators.slice(-2)
  assert.deepEqual(
    pourOscs.map((osc) => osc.frequency.value),
    [220, 164.81],
    'pour steps down like a glug',
  )

  assert.doesNotThrow(() => handle.playCrack())
  const crackOscs = createdOscillators.slice(-2)
  assert.deepEqual(
    crackOscs.map((osc) => osc.frequency.value),
    [659.25, 987.77],
    'crack ends in a rising chime',
  )
  assert.ok(createdBufferSources.length > buffersBefore, 'crack has a snap noise burst')

  assert.equal(handle.isPlaying(), false, 'one-shots do not start the loop')
  handle.stop()
})

test('nightGarden and starChoir regression guards: the older loops are untouched', () => {
  const rose = createAmbience('nightGarden')
  try {
    assert.equal(rose.getProfile(), 'nightGarden')
    assert.equal(rose.start(), true)
    assert.equal(rose.isPlaying(), true)
    const oscBefore = createdOscillators.length
    assert.doesNotThrow(() => rose.playChime())
    assert.deepEqual(
      createdOscillators.slice(oscBefore).map((osc) => osc.frequency.value),
      [880, 1318.5],
      'Rose chime is the same two notes',
    )
  } finally {
    rose.stop()
  }

  const propose = createAmbience('starChoir')
  try {
    assert.equal(propose.start(), true)
    const oscBefore = createdOscillators.length
    assert.doesNotThrow(() => propose.playTwinkle())
    assert.equal(createdOscillators[createdOscillators.length - 1].frequency.value, 1567.98, 'Propose twinkle is the same high note')
    assert.equal(createdOscillators.length, oscBefore + 1)
  } finally {
    propose.stop()
  }

  // The app singleton is still the nightGarden loop by default.
  assert.equal(ambience.getProfile(), 'nightGarden')
})

test('without any AudioContext every method is a safe no-op (H1)', async () => {
  delete globalThis.AudioContext
  try {
    const silent = createAmbience('cocoaNight')
    assert.equal(silent.start(), false, 'no audio available')
    assert.equal(silent.isPlaying(), false)
    assert.equal(silent.toggle(), false)
    assert.doesNotThrow(() => silent.stop())
    assert.doesNotThrow(() => silent.setMuted(true))
    assert.doesNotThrow(() => silent.setProfile('nightGarden'))
    assert.doesNotThrow(() => silent.playStir())
    assert.doesNotThrow(() => silent.playPeel())
    assert.doesNotThrow(() => silent.playCrack())
    assert.doesNotThrow(() => silent.playPour())
    assert.doesNotThrow(() => silent.playChime())
    assert.doesNotThrow(() => silent.playSnip())

    assert.equal(ambience.start(), false)
    assert.equal(ambience.isPlaying(), false)
  } finally {
    globalThis.AudioContext = MockAudioContext
  }
})
