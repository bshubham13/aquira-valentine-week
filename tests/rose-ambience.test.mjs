/**
 * Rose ambience tests — src/lib/roseAmbience.ts (H1: real Web Audio, not a
 * fake CSS toggle). The AudioContext is mocked: the implementation reads the
 * constructor lazily from globalThis, so the mock is installed before the
 * module is imported, and removed again for the no-audio tests.
 *
 * Note: this tests the loop/mute/one-shot wiring. Whether the night-garden
 * loop actually sounds pleasant still needs a human ear — no test can hear.
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
    return { ...mockAudioNode(), type: 'sine', frequency: mockAudioParam() }
  }

  createBufferSource() {
    const node = mockAudioNode()
    node.buffer = null
    node.loop = false
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
const { createAmbience, roseAmbience } = await import('../src/lib/roseAmbience.ts')

test('start builds the loop once and reports playing; stop suspends it', () => {
  const ambience = createAmbience()
  try {
    assert.equal(ambience.isPlaying(), false)
    assert.equal(ambience.start(), true)
    assert.equal(ambience.isPlaying(), true)
    assert.equal(createdContexts.length, 1, 'one context per handle')
    const ctx = createdContexts[0]
    assert.ok(ctx.resumeCalls >= 1, 'context resumed on start')

    assert.equal(ambience.start(), true, 'starting twice is a no-op success')
    assert.equal(createdContexts.length, 1, 'no second context on re-start')

    ambience.stop()
    assert.equal(ambience.isPlaying(), false)
    assert.ok(ctx.suspendCalls >= 1, 'stop suspends the context (real mute)')
  } finally {
    ambience.stop()
  }
})

test('toggle flips the loop and returns the new state', () => {
  const ambience = createAmbience()
  try {
    assert.equal(ambience.toggle(), true)
    assert.equal(ambience.isPlaying(), true)
    assert.equal(ambience.toggle(), false)
    assert.equal(ambience.isPlaying(), false)
  } finally {
    ambience.stop()
  }
})

test('setMuted suspends while playing and resumes on unmute', () => {
  const ambience = createAmbience()
  try {
    ambience.start()
    const ctx = createdContexts[createdContexts.length - 1]
    const suspendsBefore = ctx.suspendCalls
    ambience.setMuted(true)
    assert.equal(ambience.isMuted(), true)
    assert.ok(ctx.suspendCalls > suspendsBefore, 'mute really suspends the context')

    const resumesBefore = ctx.resumeCalls
    ambience.setMuted(false)
    assert.equal(ambience.isMuted(), false)
    assert.ok(ctx.resumeCalls > resumesBefore, 'unmute resumes while playing')
  } finally {
    ambience.stop()
  }
})

test('one-shots work even when the loop is off', () => {
  const ambience = createAmbience()
  assert.equal(ambience.isPlaying(), false)
  assert.doesNotThrow(() => ambience.playSnip(), 'thorn snip needs no loop')
  assert.doesNotThrow(() => ambience.playChime(), 'delivery chime needs no loop')
  assert.equal(ambience.isPlaying(), false, 'one-shots do not start the loop')
  ambience.stop()
})

test('without any AudioContext every method is a safe no-op (H1)', async () => {
  delete globalThis.AudioContext
  try {
    const silent = createAmbience()
    assert.equal(silent.start(), false, 'no audio available')
    assert.equal(silent.isPlaying(), false)
    assert.equal(silent.toggle(), false)
    assert.doesNotThrow(() => silent.stop())
    assert.doesNotThrow(() => silent.setMuted(true))
    assert.doesNotThrow(() => silent.playSnip())
    assert.doesNotThrow(() => silent.playChime())

    // The app singleton behaves the same way without audio.
    assert.equal(roseAmbience.start(), false)
    assert.equal(roseAmbience.isPlaying(), false)
  } finally {
    globalThis.AudioContext = MockAudioContext
  }
})
