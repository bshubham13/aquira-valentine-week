/**
 * Pure stage-gating rules for the Chocolate Day experience.
 * Mirror of src/lib/roseGating.ts / src/lib/proposeGating.ts — kept free of
 * React/DOM so the rules are unit-testable without a browser and shared
 * between the component and the test suite.
 */

export interface ChocolateStageState {
  /** Stage 1 "Lift the Shutter": the shop shutter is fully up. */
  shutterUp: boolean
  /** Stage 2 "Temper the Drama": cauldron temperature in °C (20–80). */
  temperature: number
  /** Stage 2: full circular stirs completed (0–6). */
  stirs: number
  /** Stage 3 "Pour the Mould": mould fill percentage (0–100). */
  mouldFilled: number
  /** Stage 4 "Dress the Bite": toppings placed on the chocolate (0–2). */
  toppingsPlaced: number
  /** Stage 5 "Photo Truffles": photos enlarged (0–4). */
  photosViewed: number
  photoCount: number
  /** Stage 6 "Unwrap Three Truths": pieces peeled open (0–6). */
  piecesPeeled: number
  /** Stage 7 "Bite the Golden Centre": hold-to-bite progress (0–100). */
  bite: number
}

export const CHOCOLATE_STAGE_TOTAL = 7
export const CHOCOLATE_FINALE_STAGE = 8

/** Temperature sweet spot for tempering: the chocolate only melts here. */
export const SWEET_SPOT_MIN = 47
export const SWEET_SPOT_MAX = 56
/** Full circular stirs needed before the chocolate is smooth. */
export const STIRS_NEEDED = 6
/** Toppings needed to dress the bite. */
export const TOPPINGS_NEEDED = 2
/** Pieces that must be peeled to read the truths inside. */
export const PIECES_NEEDED = 3

export const CHOCOLATE_STAGE_REQUIREMENTS: Record<number, string> = {
  1: 'shutterUp',
  2: 'temperature in 47–56° and stirs >= 6',
  3: 'mouldFilled >= 100',
  4: 'toppingsPlaced >= 2',
  5: 'photoCount === 0 || photosViewed >= 1',
  6: 'piecesPeeled >= 3',
  7: 'bite >= 100',
}

/** True when the temperature sits inside the sweet spot. */
export function isSweetSpotTemp(temperature: number): boolean {
  return temperature >= SWEET_SPOT_MIN && temperature <= SWEET_SPOT_MAX
}

/**
 * Full 360° turns completed from accumulated pointer angle.
 * Partial circles don't count — 5.9 turns is still 5 stirs.
 */
export function countStirCircles(totalAngleDegrees: number): number {
  return Math.max(0, Math.floor(Math.abs(totalAngleDegrees) / 360))
}

/**
 * Smallest signed step between two pointer angles (degrees), ignoring
 * jitter under 2° so a shaky hand doesn't rack up phantom stirring.
 */
export function angleStep(fromDegrees: number, toDegrees: number): number {
  let step = (toDegrees - fromDegrees) % 360
  if (step > 180) step -= 360
  if (step < -180) step += 360
  return Math.abs(step) < 2 ? 0 : step
}

/** True when the stage's interaction is complete and "next" may unlock. */
export function canAdvanceChocolate(stage: number, state: ChocolateStageState): boolean {
  switch (stage) {
    case 1:
      return state.shutterUp
    case 2:
      return isSweetSpotTemp(state.temperature) && state.stirs >= STIRS_NEEDED
    case 3:
      return state.mouldFilled >= 100
    case 4:
      return state.toppingsPlaced >= TOPPINGS_NEEDED
    case 5:
      return state.photoCount === 0 || state.photosViewed >= 1
    case 6:
      return state.piecesPeeled >= PIECES_NEEDED
    case 7:
      return state.bite >= 100
    default:
      return false
  }
}

export function nextChocolateStage(stage: number): number {
  return Math.min(stage + 1, CHOCOLATE_FINALE_STAGE)
}

export function emptyChocolateState(photoCount: number): ChocolateStageState {
  return {
    shutterUp: false,
    temperature: 30,
    stirs: 0,
    mouldFilled: 0,
    toppingsPlaced: 0,
    photosViewed: 0,
    photoCount,
    piecesPeeled: 0,
    bite: 0,
  }
}
