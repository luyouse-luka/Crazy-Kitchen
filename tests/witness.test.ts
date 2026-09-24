import { describe, expect, it } from 'vitest'
import { createCustomerFlow, moodTier, patienceRatio, stepCustomerFlow } from '../game/assets/logic/customer'
import type { FlowParams } from '../game/assets/logic/customer'
import { createKitchen, stepKitchen } from '../game/assets/logic/kitchen'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'
import { createRng } from '../game/assets/logic/rng'
import { canWitness, witnessMishap } from '../game/assets/logic/witness'

const FLOW: FlowParams = {
  intervalSec: 999,
  intervalJitter: 0,
  maxConcurrent: 4,
  patienceSec: 20,
  takeOrder: { walkInSec: 4, patienceSec: 8 },
}
const ORDERS = { extraMin: 0, extraMax: 1, bannedChance: 0 }

/** 三位：c0 已接单满耐心 / c1 已接单剩一半 / c2 还在门口走 */
const scene = () => {
  const st = createCustomerFlow(FLOW, ORDERS, createRng(7))
  for (let i = 0; i < 3; i++) {
    st.nextArrivalAt = 0
    stepCustomerFlow(st, 0, 0)
  }
  const [c0, c1, c2] = st.customers.filter((c) => c.active)
  c0!.ordered = true
  c0!.patienceMax = c0!.patienceLeft = 20
  c1!.ordered = true
  c1!.patienceMax = 20
  c1!.patienceLeft = 10
  c2!.orderWait = 1
  return { st, c0: c0!, c1: c1!, c2: c2! }
}

describe('witnessMishap', () => {
  it('看得见的每位掉一档，门口那位不受影响', () => {
    const { st, c0, c1, c2 } = scene()
    expect([c0, c1, c2].map((c) => canWitness(st, c))).toEqual([true, true, false])
    const before = [c0, c1].map((c) => moodTier(st, c))
    witnessMishap(st, 'burnt')
    expect([c0, c1].map((c) => moodTier(st, c))).toEqual(before.map((t) => t + 1))
    expect(c2.orderWait).toBe(1)
  })

  it('开口的是扣之前最满意的那位', () => {
    const { st, c0 } = scene()
    expect(witnessMishap(st, 'burnt')).toBe(c0)
  })

  it('等接单的也会被扣（扣在 orderWait 上），扣到见底不越界', () => {
    const { st, c2 } = scene()
    c2.orderWait = 5
    const r = patienceRatio(st, c2)
    witnessMishap(st, 'burnt')
    expect(patienceRatio(st, c2)).toBeCloseTo(r - 0.25)
    for (let i = 0; i < 10; i++) witnessMishap(st, 'burnt')
    expect(patienceRatio(st, c2)).toBe(0)
  })

  it('没人看见返回 null，也不碰 RNG', () => {
    const st = createCustomerFlow(FLOW, ORDERS, createRng(7))
    const rng = st.rng.s
    expect(witnessMishap(st, 'burnt')).toBeNull()
    expect(st.rng.s).toBe(rng)
  })
})

describe('kitchen.burnt 事件计数', () => {
  it('跨过 burntAt 那一帧记一次，之后一直糊着也不再记', () => {
    const k = createKitchen({ stations: [], cook: { ...DEFAULT_COOK }, grillSlots: 2 })
    k.grill[0]!.busy = true
    for (let t = 0; t < 30; t += 1 / 30) stepKitchen(k, 1 / 30)
    expect(k.burnt).toBe(1)
  })
})
