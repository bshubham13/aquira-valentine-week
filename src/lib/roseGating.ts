/**
 * Pure stage-gating rules for the Rose Day experience.
 * Kept free of React/DOM so the rules are unit-testable without a browser
 * and shared between the component and the test suite.
 */

export interface RoseStageState {
  gateOpen: boolean
  thornsRemoved: number
  rosesBloomed: number
  momentsTucked: number
  ribbonTied: boolean
  photosViewed: number
  photoCount: number
  delivery: number
}

export const ROSE_STAGE_TOTAL = 7
export const ROSE_FINALE_STAGE = 8

export const ROSE_STAGE_REQUIREMENTS: Record<number, string> = {
  1: 'gateOpen',
  2: 'thornsRemoved >= 4',
  3: 'rosesBloomed >= 5',
  4: 'momentsTucked >= 3',
  5: 'ribbonTied',
  6: 'photoCount === 0 || photosViewed >= 1',
  7: 'delivery >= 100',
}

/** True when the stage's interaction is complete and "next" may unlock. */
export function canAdvanceRose(stage: number, state: RoseStageState): boolean {
  switch (stage) {
    case 1:
      return state.gateOpen
    case 2:
      return state.thornsRemoved >= 4
    case 3:
      return state.rosesBloomed >= 5
    case 4:
      return state.momentsTucked >= 3
    case 5:
      return state.ribbonTied
    case 6:
      return state.photoCount === 0 || state.photosViewed >= 1
    case 7:
      return state.delivery >= 100
    default:
      return false
  }
}

export function nextRoseStage(stage: number): number {
  return Math.min(stage + 1, ROSE_FINALE_STAGE)
}

export function emptyRoseState(photoCount: number): RoseStageState {
  return {
    gateOpen: false,
    thornsRemoved: 0,
    rosesBloomed: 0,
    momentsTucked: 0,
    ribbonTied: false,
    photosViewed: 0,
    photoCount,
    delivery: 0,
  }
}
