/**
 * Chocolate stage-gating tests — pure rules from src/lib/chocolateGating.ts.
 * Every stage's unlock condition, the zero-photo honest path (stage 5),
 * the temperature sweet spot, the circular-stir counter (partial circles
 * don't count), and the stage-advance clamp at the finale.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canAdvanceChocolate,
  nextChocolateStage,
  emptyChocolateState,
  CHOCOLATE_STAGE_TOTAL,
  CHOCOLATE_FINALE_STAGE,
  CHOCOLATE_STAGE_REQUIREMENTS,
  SWEET_SPOT_MIN,
  SWEET_SPOT_MAX,
  STIRS_NEEDED,
  TOPPINGS_NEEDED,
  PIECES_NEEDED,
  isSweetSpotTemp,
  countStirCircles,
  angleStep,
} from '../src/lib/chocolateGating.ts'

test('Chocolate has 7 stages plus a finale (stage 8)', () => {
  assert.equal(CHOCOLATE_STAGE_TOTAL, 7)
  assert.equal(CHOCOLATE_FINALE_STAGE, 8)
  assert.deepEqual(Object.keys(CHOCOLATE_STAGE_REQUIREMENTS).map(Number), [1, 2, 3, 4, 5, 6, 7])
})

test('an empty state cannot advance any stage', () => {
  const state = emptyChocolateState(4)
  for (let stage = 1; stage <= 7; stage++) {
    assert.equal(canAdvanceChocolate(stage, state), false, `stage ${stage} must stay locked`)
  }
  assert.equal(canAdvanceChocolate(8, state), false, 'finale is not a gate')
  assert.equal(canAdvanceChocolate(0, state), false)
  assert.equal(canAdvanceChocolate(99, state), false)
})

test('stage 1 opens only when the shutter is fully up', () => {
  const state = emptyChocolateState(0)
  assert.equal(canAdvanceChocolate(1, state), false)
  assert.equal(canAdvanceChocolate(1, { ...state, shutterUp: true }), true)
})

test('stage 2 needs the temperature in the sweet spot AND 6 stirs', () => {
  assert.equal(SWEET_SPOT_MIN, 47)
  assert.equal(SWEET_SPOT_MAX, 56)
  assert.equal(STIRS_NEEDED, 6)
  const state = emptyChocolateState(0)
  assert.equal(canAdvanceChocolate(2, { ...state, temperature: 52, stirs: 6 }), true)
  assert.equal(canAdvanceChocolate(2, { ...state, temperature: 47, stirs: 6 }), true, '47° is in the spot')
  assert.equal(canAdvanceChocolate(2, { ...state, temperature: 56, stirs: 6 }), true, '56° is in the spot')
  assert.equal(canAdvanceChocolate(2, { ...state, temperature: 46, stirs: 6 }), false, '46° is too cold even with 6 stirs')
  assert.equal(canAdvanceChocolate(2, { ...state, temperature: 57, stirs: 6 }), false, '57° is too hot even with 6 stirs')
  assert.equal(canAdvanceChocolate(2, { ...state, temperature: 30, stirs: 6 }), false, 'cold chocolate never tempers')
  assert.equal(canAdvanceChocolate(2, { ...state, temperature: 52, stirs: 5 }), false, '5 stirs is not smooth yet')
  assert.equal(canAdvanceChocolate(2, { ...state, temperature: 52, stirs: 0 }), false)
})

test('isSweetSpotTemp matches the gate exactly', () => {
  assert.equal(isSweetSpotTemp(46), false)
  assert.equal(isSweetSpotTemp(47), true)
  assert.equal(isSweetSpotTemp(51), true)
  assert.equal(isSweetSpotTemp(56), true)
  assert.equal(isSweetSpotTemp(57), false)
})

test('countStirCircles counts only full 360° turns', () => {
  assert.equal(countStirCircles(0), 0)
  assert.equal(countStirCircles(359), 0, 'almost a circle is not a stir')
  assert.equal(countStirCircles(360), 1)
  assert.equal(countStirCircles(719), 1)
  assert.equal(countStirCircles(720), 2)
  assert.equal(countStirCircles(2160), 6, '6 full circles = 6 stirs')
  assert.equal(countStirCircles(2500), 6, '6.9 circles is still 6 stirs')
  assert.equal(countStirCircles(-1080), 3, 'counter-clockwise stirring counts too')
  assert.equal(countStirCircles(-100), 0, 'negative partial circles do not count')
})

test('angleStep takes the shortest way round and ignores jitter', () => {
  assert.equal(angleStep(10, 15), 5)
  assert.equal(angleStep(350, 10), 20, 'wraps across 0°')
  assert.equal(angleStep(10, 350), -20, 'wraps the other way')
  assert.equal(angleStep(0, 180), 180)
  assert.equal(angleStep(0, 181), -179, 'past halfway goes the short way')
  assert.equal(angleStep(30, 31), 0, '1° of wobble is jitter, not stirring')
  assert.equal(angleStep(30, 28.5), 0, 'sub-2° wobble ignored')
  assert.equal(angleStep(30, 33), 3)
})

test('stage 3 needs the mould filled to 100%', () => {
  const state = emptyChocolateState(0)
  assert.equal(canAdvanceChocolate(3, { ...state, mouldFilled: 99 }), false)
  assert.equal(canAdvanceChocolate(3, { ...state, mouldFilled: 100 }), true)
})

test('stage 4 needs any 2 toppings placed', () => {
  assert.equal(TOPPINGS_NEEDED, 2)
  const state = emptyChocolateState(0)
  assert.equal(canAdvanceChocolate(4, { ...state, toppingsPlaced: 1 }), false)
  assert.equal(canAdvanceChocolate(4, { ...state, toppingsPlaced: 2 }), true)
})

test('stage 5: zero-photo gifts advance immediately; with photos one must be viewed', () => {
  assert.equal(canAdvanceChocolate(5, emptyChocolateState(0)), true, 'no photos — the chocolate carries it')
  const withPhotos = emptyChocolateState(4)
  assert.equal(canAdvanceChocolate(5, withPhotos), false, 'photos present, none viewed')
  assert.equal(canAdvanceChocolate(5, { ...withPhotos, photosViewed: 1 }), true)
  assert.equal(canAdvanceChocolate(5, { ...withPhotos, photosViewed: 4 }), true)
})

test('stage 6 needs 3 pieces peeled', () => {
  assert.equal(PIECES_NEEDED, 3)
  const state = emptyChocolateState(0)
  assert.equal(canAdvanceChocolate(6, { ...state, piecesPeeled: 2 }), false)
  assert.equal(canAdvanceChocolate(6, { ...state, piecesPeeled: 3 }), true)
  assert.equal(canAdvanceChocolate(6, { ...state, piecesPeeled: 6 }), true, 'peeling more is fine')
})

test('stage 7 needs the bite held to 100%', () => {
  const state = emptyChocolateState(0)
  assert.equal(canAdvanceChocolate(7, { ...state, bite: 99 }), false)
  assert.equal(canAdvanceChocolate(7, { ...state, bite: 100 }), true)
})

test('nextChocolateStage walks 1 → 8 and clamps at the finale', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(nextChocolateStage), [2, 3, 4, 5, 6, 7, 8])
  assert.equal(nextChocolateStage(8), 8)
  assert.equal(nextChocolateStage(99), 8)
})
