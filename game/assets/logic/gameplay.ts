import { DOUBLE_CHANCE, DOUBLE_FROM_DAY } from './customer'
import { earlyShiftPolicyForDay } from './difficulty'
import { dayFlow } from './progress'
import type { Progress } from './progress'
import { DRINK_CHANCE, flowFactor, FRIES_CHANCE, owns } from './shop'
import type { ShiftConfig } from './shift'

export const GAMEPLAY_RULES = { singleItem: true, doublePatty: true } as const

export interface GameplayParams {
  arrivalSec: number
  arrivalJitter: number
  customersPerShift: number
  patienceScale: number
  lateLeaveSec: number
  orderPatienceSec: number
  walkInSec: number
}

export function gameplayShiftConfig(day: number, seed: number, progress: Progress, p: GameplayParams): ShiftConfig {
  const d = dayFlow(day, p.arrivalSec), early = earlyShiftPolicyForDay(day)
  return {
    seed, customers: early?.customers ?? p.customersPerShift,
    flow: {
      ...d.flow,
      intervalSec: (early?.intervalSec ?? d.flow.intervalSec) * flowFactor(progress),
      intervalJitter: early?.intervalJitter ?? p.arrivalJitter,
      maxConcurrent: early?.maxConcurrent ?? d.flow.maxConcurrent,
      patienceSec: d.flow.patienceSec * p.patienceScale,
      lateLeaveSec: p.lateLeaveSec * p.patienceScale,
      takeOrder: { walkInSec: p.walkInSec, patienceSec: p.orderPatienceSec * p.patienceScale },
    },
    orders: {
      ...d.orders, bannedChance: early?.bannedChance ?? d.orders.bannedChance,
      friesChance: owns(progress, 'fryer') ? FRIES_CHANCE : 0,
      drinkChance: owns(progress, 'drinks') ? DRINK_CHANCE : 0,
      doubleChance: early?.doubleChance ?? (day >= DOUBLE_FROM_DAY ? DOUBLE_CHANCE : 0),
    },
  }
}

export function gameplayDeliveryEnabled(day: number): boolean { return earlyShiftPolicyForDay(day)?.delivery ?? true }
