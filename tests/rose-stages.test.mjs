/**
 * Rose stage-gating tests — pure rules from src/lib/roseGating.ts.
 * Every stage's unlock condition, the zero-photo honest path (stage 6),
 * and the stage-advance clamp at the finale.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canAdvanceRose,
  nextRoseStage,
  emptyRoseState,
  ROSE_STAGE_TOTAL,
  ROSE_FINALE_STAGE,
  ROSE_STAGE_REQUIREMENTS,
} from '../src/lib/roseGating.ts'

test('Rose has 7 stages plus a finale (stage 8)', () => {
  assert.equal(ROSE_STAGE_TOTAL, 7)
  assert.equal(ROSE_FINALE_STAGE, 8)
  assert.deepEqual(Object.keys(ROSE_STAGE_REQUIREMENTS).map(Number), [1, 2, 3, 4, 5, 6, 7])
})

test('an empty state cannot advance any stage', () => {
  const state = emptyRoseState(4)
  for (let stage = 1; stage <= 7; stage++) {
    assert.equal(canAdvanceRose(stage, state), false, `stage ${stage} must stay locked`)
  }
  assert.equal(canAdvanceRose(8, state), false, 'finale is not a gate')
  assert.equal(canAdvanceRose(0, state), false)
  assert.equal(canAdvanceRose(99, state), false)
})

test('stage 1 opens only when the gate is open', () => {
  const state = emptyRoseState(0)
  assert.equal(canAdvanceRose(1, state), false)
  assert.equal(canAdvanceRose(1, { ...state, gateOpen: true }), true)
})

test('stage 2 needs all 4 thorns removed', () => {
  const state = emptyRoseState(0)
  assert.equal(canAdvanceRose(2, { ...state, thornsRemoved: 3 }), false)
  assert.equal(canAdvanceRose(2, { ...state, thornsRemoved: 4 }), true)
})

test('stage 3 needs 5 of 7 roses bloomed', () => {
  const state = emptyRoseState(0)
  assert.equal(canAdvanceRose(3, { ...state, rosesBloomed: 4 }), false)
  assert.equal(canAdvanceRose(3, { ...state, rosesBloomed: 5 }), true)
  assert.equal(canAdvanceRose(3, { ...state, rosesBloomed: 7 }), true)
})

test('stage 4 needs all 3 moments tucked', () => {
  const state = emptyRoseState(0)
  assert.equal(canAdvanceRose(4, { ...state, momentsTucked: 2 }), false)
  assert.equal(canAdvanceRose(4, { ...state, momentsTucked: 3 }), true)
})

test('stage 5 needs the ribbon tied (wind at 100%)', () => {
  const state = emptyRoseState(0)
  assert.equal(canAdvanceRose(5, state), false)
  assert.equal(canAdvanceRose(5, { ...state, ribbonTied: true }), true)
})

test('stage 6: zero-photo gifts advance immediately; with photos one must be viewed', () => {
  assert.equal(canAdvanceRose(6, emptyRoseState(0)), true, 'no photos — the words carry it')
  const withPhotos = emptyRoseState(4)
  assert.equal(canAdvanceRose(6, withPhotos), false, 'photos present, none viewed')
  assert.equal(canAdvanceRose(6, { ...withPhotos, photosViewed: 1 }), true)
  assert.equal(canAdvanceRose(6, { ...withPhotos, photosViewed: 4 }), true)
})

test('stage 7 needs delivery held to 100% — releasing early resets', () => {
  const state = emptyRoseState(0)
  assert.equal(canAdvanceRose(7, { ...state, delivery: 99 }), false)
  assert.equal(canAdvanceRose(7, { ...state, delivery: 100 }), true)
})

test('nextRoseStage walks 1 → 8 and clamps at the finale', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(nextRoseStage), [2, 3, 4, 5, 6, 7, 8])
  assert.equal(nextRoseStage(8), 8)
  assert.equal(nextRoseStage(99), 8)
})
