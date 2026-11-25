/**
 * Pure stage-gating rules for the Propose Day experience.
 * Mirror of src/lib/roseGating.ts — kept free of React/DOM so the rules are
 * unit-testable without a browser and shared between the component and the
 * test suite.
 */

export interface ProposeStageState {
  /** Stage 1 "Raise the Moon": the moon is placed at the top of the sky. */
  moonRaised: boolean
  /** Stage 2 "Cosmic Background Check": answers given (0–3). */
  answersGiven: number
  /** Stage 3 "Draw the Constellation": stars connected in order (0–5). */
  starsConnected: number
  /** Stage 4 "Pop the Nerves": nervous thoughts popped (0–3). */
  nervesPopped: number
  /** Stage 5 "Photo Stars": photos enlarged (0–4). */
  photosViewed: number
  photoCount: number
  /** Stage 6 "The Sky Votes": verdict stars aligned (0–3). */
  verdictsAligned: number
  /** Stage 7 "The Big Question": Yes tapped. */
  yesTapped: boolean
}

export const PROPOSE_STAGE_TOTAL = 7
export const PROPOSE_FINALE_STAGE = 8

export const PROPOSE_STAGE_REQUIREMENTS: Record<number, string> = {
  1: 'moonRaised',
  2: 'answersGiven >= 3',
  3: 'starsConnected >= 5',
  4: 'nervesPopped >= 3',
  5: 'photoCount === 0 || photosViewed >= 1',
  6: 'verdictsAligned >= 3',
  7: 'yesTapped',
}

/** True when the stage's interaction is complete and "next" may unlock. */
export function canAdvancePropose(stage: number, state: ProposeStageState): boolean {
  switch (stage) {
    case 1:
      return state.moonRaised
    case 2:
      return state.answersGiven >= 3
    case 3:
      return state.starsConnected >= 5
    case 4:
      return state.nervesPopped >= 3
    case 5:
      return state.photoCount === 0 || state.photosViewed >= 1
    case 6:
      return state.verdictsAligned >= 3
    case 7:
      return state.yesTapped
    default:
      return false
  }
}

export function nextProposeStage(stage: number): number {
  return Math.min(stage + 1, PROPOSE_FINALE_STAGE)
}

export function emptyProposeState(photoCount: number): ProposeStageState {
  return {
    moonRaised: false,
    answersGiven: 0,
    starsConnected: 0,
    nervesPopped: 0,
    photosViewed: 0,
    photoCount,
    verdictsAligned: 0,
    yesTapped: false,
  }
}

/**
 * The dodging "No" — H6, the fairness cap. The No button may dodge at most
 * NO_DODGE_LIMIT times; after that it surrenders and stops dodging, so the
 * recipient is never trapped chasing it on touch or keyboard.
 */
export const NO_DODGE_LIMIT = 3

export function dodgeNo(dodges: number): { count: number; surrendered: boolean } {
  const count = Math.min(Math.max(0, dodges) + 1, NO_DODGE_LIMIT)
  return { count, surrendered: count >= NO_DODGE_LIMIT }
}
