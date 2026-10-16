import { describe, expect, it } from 'vitest'
import { DOUBLE_CHANCE, DOUBLE_FROM_DAY } from '../game/assets/logic/customer'
import { earlyShiftPolicyForDay } from '../game/assets/logic/difficulty'
import { GAMEPLAY_RULES, gameplayDeliveryEnabled, gameplayShiftConfig } from '../game/assets/logic/gameplay'
import { createKitchen, interact } from '../game/assets/logic/kitchen'
import { dayFlow, newProgress } from '../game/assets/logic/progress'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'
import { DRINK_CHANCE, flowFactor, FRIES_CHANCE } from '../game/assets/logic/shop'
import { createSimState, defaultSimConfig, runDay, stepSim } from '../game/assets/logic/sim'
import type { Ingredient, Station } from '../game/assets/logic/types'

const params = { arrivalSec: 30, arrivalJitter: .5, customersPerShift: 10, patienceScale: 1.5,
  lateLeaveSec: 20, orderPatienceSec: 25, walkInSec: 5.6 }

describe('current gameplay policy', () => {
  it.each([[], ['fridge-1', 'shelf-1'], ['fryer', 'drinks', 'fast-grill', 'fast-wash', 'big-tray']].map(owned => ({ owned })))('preserves runtime rules across days and purchases: $owned', ({ owned }) => {
    const progress = { ...newProgress(), owned }
    for (let day = 1; day <= 25; day++) {
      const d = dayFlow(day, params.arrivalSec), early = earlyShiftPolicyForDay(day)
      expect(gameplayShiftConfig(day, 123, progress, params)).toEqual({
        seed: 123, customers: early?.customers ?? params.customersPerShift,
        flow: { ...d.flow,
          intervalSec: (early?.intervalSec ?? d.flow.intervalSec) * flowFactor(progress),
          intervalJitter: early?.intervalJitter ?? params.arrivalJitter,
          maxConcurrent: early?.maxConcurrent ?? d.flow.maxConcurrent,
          patienceSec: d.flow.patienceSec * params.patienceScale,
          lateLeaveSec: params.lateLeaveSec * params.patienceScale,
          takeOrder: { walkInSec: params.walkInSec, patienceSec: params.orderPatienceSec * params.patienceScale } },
        orders: { ...d.orders, bannedChance: early?.bannedChance ?? d.orders.bannedChance,
          friesChance: owned.includes('fryer') ? FRIES_CHANCE : 0, drinkChance: owned.includes('drinks') ? DRINK_CHANCE : 0,
          doubleChance: early?.doubleChance ?? (day >= DOUBLE_FROM_DAY ? DOUBLE_CHANCE : 0) },
      })
      expect(gameplayDeliveryEnabled(day)).toBe(day >= 4)
    }
  })

  it('uses the configured scene values after the introductory days', () => {
    const p = { ...params, customersPerShift: 13, arrivalSec: 41, patienceScale: 2, walkInSec: 8 }
    const cfg = gameplayShiftConfig(6, 7, newProgress(), p)
    expect(cfg.customers).toBe(13)
    expect(cfg.flow.intervalSec).toBe(dayFlow(6, 41).flow.intervalSec)
    expect(cfg.flow.takeOrder).toEqual({ walkInSec: 8, patienceSec: 50 })
  })
})

describe('single-item regression', () => {
  const ingredients: Ingredient[] = ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon']
  it.each(ingredients)('does not consume a second item while holding %s', first => {
    const fridge: Station = { id: 'f', kind: 'fridge', pos: { x: 0, z: 0 }, box: { center: { x: 0, z: 0 }, halfX: .5, halfZ: .5 }, triggerRange: 1 }
    const k = createKitchen({ ...GAMEPLAY_RULES, stations: [fridge], cook: DEFAULT_COOK, grillSlots: 2, fridgeCap: 4 })
    expect(interact(k, fridge.pos, fridge, { ingredient: first }).kind).toBe('take-ingredient')
    for (const second of ingredients) {
      const stock = [...k.stock], carry = { ...k.carry }
      expect(interact(k, fridge.pos, fridge, { ingredient: second }).reason).toBe('hands-full')
      expect(k.stock).toEqual(stock); expect(k.carry).toEqual(carry)
    }
  })

  it('charges the additional fridge round trips instead of retaining the two-hand throughput', () => {
    const cfg = { ...defaultSimConfig(), durationSec: 90,
      flow: { intervalSec: 999, intervalJitter: 0, maxConcurrent: 1, patienceSec: 180 },
      orders: { extraMin: 2, extraMax: 2, bannedChance: 0 } }
    expect(cfg.singleItem).toBe(GAMEPLAY_RULES.singleItem)
    const single = runDay(cfg), legacy = runDay({ ...cfg, singleItem: false })
    expect(single.served).toBe(1); expect(legacy.served).toBe(1)
    expect(single.wrong).toBe(0)
    expect(legacy.idleSec - single.idleSec).toBeGreaterThan(2)
    const state = createSimState({ ...cfg, singleItem: false })
    for (let i = 0; i < 150; i++) stepSim(state, 1 / 30)
    state.reset(cfg)
    while (!state.done) stepSim(state, 1 / 30)
    expect(state.result).toEqual(single)
  })
})
