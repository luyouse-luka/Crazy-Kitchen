import { describe, expect, it } from 'vitest'
import {
  angriest,
  createCustomerFlow,
  GIFT_PATIENCE,
  giftCustomer,
  giftTarget,
  moodTier,
  PROVOKE_TIER,
  stepCustomerFlow,
  stormOff,
} from '../game/assets/logic/customer'
import type { FlowParams } from '../game/assets/logic/customer'
import { serveReview } from '../game/assets/logic/reviews'
import { createRng } from '../game/assets/logic/rng'
import { createVent, rantStars, startRant, stepVent, throwAt, vent } from '../game/assets/logic/vent'
import type { Rant } from '../game/assets/logic/vent'

const FLOW: FlowParams = { intervalSec: 999, intervalJitter: 0, maxConcurrent: 4, patienceSec: 20, stayWhenLate: true }
const ORDERS = { extraMin: 0, extraMax: 1, bannedChance: 0 }

/** Three diners, all ordered: calm (20s left), 😡 (4s left), late (-3s) */
const scene = () => {
  const st = createCustomerFlow(FLOW, ORDERS, createRng(7))
  for (let i = 0; i < 3; i++) {
    st.nextArrivalAt = 0
    stepCustomerFlow(st, 0, 0)
  }
  const [calm, angry, late] = st.customers.filter((c) => c.active)
  angry!.patienceLeft = 4
  late!.patienceLeft = -3
  late!.late = true
  return { st, calm: calm!, angry: angry!, late: late! }
}

describe('骂走等餐的 😡 顾客', () => {
  it('只挑 😡 及以上，最急的先；没人生气返回 null', () => {
    const { st, calm, angry, late } = scene()
    expect(moodTier(st, angry)).toBeGreaterThanOrEqual(PROVOKE_TIER)
    expect(angriest(st)).toBe(late)
    stormOff(st, late)
    expect(angriest(st)).toBe(angry)
    stormOff(st, angry)
    expect(angriest(st)).toBeNull()
    expect(calm.active).toBe(true)
  })

  it('骂走记 provoked、释放槽位，只记一次', () => {
    const { st, angry } = scene()
    stormOff(st, angry)
    stormOff(st, angry)
    expect(st.provoked).toBe(1)
    expect(angry.active).toBe(false)
    expect(st.activeCount).toBe(2)
  })
})

describe('扔食物砸发火的顾客', () => {
  it('当场走人、扣一星、给加速；没人发火或正在对骂时扔不出去', () => {
    const st = createVent()
    expect(throwAt(st)).toBeNull()
    startRant(st, 5, 2)
    startRant(st, 6, 1)
    vent(st, 'register')
    expect(throwAt(st)).toBeNull()
    const done: Rant[] = []
    const st2 = createVent()
    startRant(st2, 5, 2)
    const r = throwAt(st2)!
    expect(r.id).toBe(5)
    expect(st2.throws).toBe(1)
    expect(st2.vents).toBe(1)
    expect(st2.boostLeft).toBeGreaterThan(0)
    stepVent(st2, 0.01, (x) => done.push({ ...x }))
    expect(done.map((x) => [x.id, rantStars(x), x.thrown])).toEqual([[5, 1, true]])
    expect(throwAt(st2)).toBeNull()
  })
})

describe('赠品', () => {
  it('送给最急且没送过的；超时的拉回准时；每位只送一次', () => {
    const { st, calm, angry, late } = scene()
    expect(giftTarget(st)).toBe(late)
    giftCustomer(late)
    expect(late.late).toBe(false)
    expect(late.patienceLeft).toBeCloseTo(GIFT_PATIENCE * late.patienceMax)
    expect(giftTarget(st)).toBe(angry)
    giftCustomer(angry)
    expect(angry.patienceLeft).toBeCloseTo(4 + GIFT_PATIENCE * 20)
    giftCustomer(calm)
    expect(calm.patienceLeft).toBe(calm.patienceMax)
    expect(giftTarget(st)).toBeNull()
  })

  it('收过赠品评价 +1 星，封顶 5；上错不加', () => {
    expect(serveReview(true, false, 0.3, true).stars).toBe(5)
    expect(serveReview(true, false, 0.9, true).stars).toBe(5)
    expect(serveReview(true, true, 0, true).stars).toBe(3)
    expect(serveReview(false, false, 1, true).stars).toBe(1)
    expect(serveReview(true, false, 0.3).stars).toBe(4)
  })

  it('新到的顾客 gifted 复位', () => {
    const st = createCustomerFlow(FLOW, ORDERS, createRng(7))
    stepCustomerFlow(st, 0, 0)
    const c = st.customers.find((x) => x.active)!
    giftCustomer(c)
    stormOff(st, c)
    st.nextArrivalAt = 0
    stepCustomerFlow(st, 0, 0)
    expect(st.customers.find((x) => x.active)!.gifted).toBe(false)
  })
})
