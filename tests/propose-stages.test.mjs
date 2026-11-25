/**
 * Propose stage-gating tests — pure rules from src/lib/proposeGating.ts.
 * Every stage's unlock condition, the zero-photo honest path (stage 5),
 * the No-dodge fairness cap (H6), and the stage-advance clamp at the finale.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canAdvancePropose,
  nextProposeStage,
  emptyProposeState,
  PROPOSE_STAGE_TOTAL,
  PROPOSE_FINALE_STAGE,
  PROPOSE_STAGE_REQUIREMENTS,
  NO_DODGE_LIMIT,
  dodgeNo,
} from '../src/lib/proposeGating.ts'

test('Propose has 7 stages plus a finale (stage 8)', () => {
  assert.equal(PROPOSE_STAGE_TOTAL, 7)
  assert.equal(PROPOSE_FINALE_STAGE, 8)
  assert.deepEqual(Object.keys(PROPOSE_STAGE_REQUIREMENTS).map(Number), [1, 2, 3, 4, 5, 6, 7])
})

test('an empty state cannot advance any stage', () => {
  const state = emptyProposeState(4)
  for (let stage = 1; stage <= 7; stage++) {
    assert.equal(canAdvancePropose(stage, state), false, `stage ${stage} must stay locked`)
  }
  assert.equal(canAdvancePropose(8, state), false, 'finale is not a gate')
  assert.equal(canAdvancePropose(0, state), false)
  assert.equal(canAdvancePropose(99, state), false)
})

test('stage 1 opens only when the moon is raised', () => {
  const state = emptyProposeState(0)
  assert.equal(canAdvancePropose(1, state), false)
  assert.equal(canAdvancePropose(1, { ...state, moonRaised: true }), true)
})

test('stage 2 needs all 3 background-check answers', () => {
  const state = emptyProposeState(0)
  assert.equal(canAdvancePropose(2, { ...state, answersGiven: 2 }), false)
  assert.equal(canAdvancePropose(2, { ...state, answersGiven: 3 }), true)
})

test('stage 3 needs all 5 constellation stars connected in order', () => {
  const state = emptyProposeState(0)
  assert.equal(canAdvancePropose(3, { ...state, starsConnected: 4 }), false)
  assert.equal(canAdvancePropose(3, { ...state, starsConnected: 5 }), true)
})

test('stage 4 needs all 3 nerves popped', () => {
  const state = emptyProposeState(0)
  assert.equal(canAdvancePropose(4, { ...state, nervesPopped: 2 }), false)
  assert.equal(canAdvancePropose(4, { ...state, nervesPopped: 3 }), true)
})

test('stage 5: zero-photo gifts advance immediately; with photos one must be viewed', () => {
  assert.equal(canAdvancePropose(5, emptyProposeState(0)), true, 'no photos — the stars carry it')
  const withPhotos = emptyProposeState(4)
  assert.equal(canAdvancePropose(5, withPhotos), false, 'photos present, none viewed')
  assert.equal(canAdvancePropose(5, { ...withPhotos, photosViewed: 1 }), true)
  assert.equal(canAdvancePropose(5, { ...withPhotos, photosViewed: 4 }), true)
})

test('stage 6 needs all 3 verdict stars aligned', () => {
  const state = emptyProposeState(0)
  assert.equal(canAdvancePropose(6, { ...state, verdictsAligned: 2 }), false)
  assert.equal(canAdvancePropose(6, { ...state, verdictsAligned: 3 }), true)
})

test('stage 7 needs Yes tapped', () => {
  const state = emptyProposeState(0)
  assert.equal(canAdvancePropose(7, state), false)
  assert.equal(canAdvancePropose(7, { ...state, yesTapped: true }), true)
})

test('nextProposeStage walks 1 → 8 and clamps at the finale', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(nextProposeStage), [2, 3, 4, 5, 6, 7, 8])
  assert.equal(nextProposeStage(8), 8)
  assert.equal(nextProposeStage(99), 8)
})

test('the No button dodges at most 3 times, then surrenders (H6)', () => {
  assert.equal(NO_DODGE_LIMIT, 3)
  assert.deepEqual(dodgeNo(0), { count: 1, surrendered: false })
  assert.deepEqual(dodgeNo(1), { count: 2, surrendered: false })
  assert.deepEqual(dodgeNo(2), { count: 3, surrendered: true }, 'third dodge surrenders')
  assert.deepEqual(dodgeNo(3), { count: 3, surrendered: true }, 'already surrendered stays surrendered')
  assert.deepEqual(dodgeNo(99), { count: 3, surrendered: true }, 'cannot dodge past the cap')
  assert.deepEqual(dodgeNo(-1), { count: 1, surrendered: false }, 'negative counts clamp to 0 first')
})
