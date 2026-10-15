import type { CookLevel } from '../logic/types'

export interface CookAppearance {
  rgb: readonly [number, number, number]
  char: number
  smoke: boolean
}

// Shared absolute colours, never multiplied by the raw-meat texture.
export const COOK_APPEARANCE: Readonly<Record<CookLevel, CookAppearance>> = {
  raw: { rgb: [224, 101, 115], char: 0, smoke: false },
  rare: { rgb: [185, 111, 81], char: .18, smoke: false },
  medium: { rgb: [142, 83, 42], char: .4, smoke: false },
  well: { rgb: [91, 49, 26], char: .7, smoke: false },
  burnt: { rgb: [30, 26, 24], char: 1, smoke: true },
}
