import { describe, expect, it } from 'vitest'
import {
  acceptDelivery,
  countStatus,
  createDesk,
  deskBusy,
  matchDelivery,
  rejectDelivery,
  settleDelivery,
  stepDesk,
} from '../game/assets/logic/delivery'
import type { DeliveryParams } from '../game/assets/logic/delivery'
import { createCustomerFlow, stepCustomerFlow } from '../game/assets/logic/customer'
import { createRng } from '../game/assets/logic/rng'
import type { Burger } from '../game/assets/logic/types'

const P: DeliveryParams = { intervalSec: 10, offerSec: 5, deadlineSec: 30, maxOffers: 2, maxActive: 1 }
const ORDERS = { extraMin: 0, extraMax: 2, bannedChance: 0.3 }
const run = (desk: ReturnType<typeof createDesk>, sec: number, ev?: Parameters<typeof stepDesk>[2]) => {
  for (let t = 0; t < sec - 1e-9; t += 0.1) stepDesk(desk, 0.1, ev)
}

describe('delivery desk', () => {
  it('按间隔来单，挂着不理就过期算拒', () => {
    const desk = createDesk(P, ORDERS, 3)
    let expired = 0
    run(desk, 10.05, { onExpire: () => expired++ })
    expect(countStatus(desk, 'offer')).toBe(1)
    run(desk, 5, { onExpire: () => expired++ })
    expect(expired).toBe(1)
    expect(desk.rejected).toBe(1)
  })

  it('接单换成送达期限；超过 maxActive 接不了', () => {
    const desk = createDesk({ ...P, intervalSec: 1 }, ORDERS, 3)
    run(desk, 2.05)
    const [a, b] = desk.slots.filter((d) => d.status === 'offer')
    expect(acceptDelivery(desk, a!)).toBe(true)
    expect(a!.left).toBe(30)
    expect(acceptDelivery(desk, b!)).toBe(false)
    expect(b!.status).toBe('offer')
    rejectDelivery(desk, b!)
    expect(desk.rejected).toBe(1)
    expect(deskBusy(desk)).toBe(true)
  })

  it('接了没送到算迟，释放槽位', () => {
    const desk = createDesk({ ...P, intervalSec: 1 }, ORDERS, 3)
    run(desk, 1.05)
    acceptDelivery(desk, desk.slots.find((d) => d.status === 'offer')!)
    desk.open = false
    let late = 0
    run(desk, 31, { onLate: () => late++ })
    expect(late).toBe(1)
    expect(deskBusy(desk)).toBe(false)
  })

  it('matchDelivery：对得上的优先，否则给最急的；settle 记账', () => {
    const desk = createDesk({ ...P, intervalSec: 1, maxActive: 2 }, ORDERS, 3)
    run(desk, 2.05)
    const [a, b] = desk.slots.filter((d) => d.status === 'offer')
    acceptDelivery(desk, a!)
    acceptDelivery(desk, b!)
    b!.left = 5
    const fitsA: Burger = { ingredients: [...a!.spec.required], cook: a!.spec.doneness }
    const wrong: Burger = { ingredients: ['bun'], cook: 'burnt' }
    expect(matchDelivery(desk, wrong)).toBe(b)
    const m = matchDelivery(desk, fitsA)!
    expect(m.spec.required).toEqual(expect.arrayContaining(a!.spec.required))
    settleDelivery(desk, m, true)
    expect(desk.delivered).toBe(1)
  })

  it('不碰顾客流的 rng：有没有外卖，堂食出的单一模一样', () => {
    const specs = (withDesk: boolean) => {
      const flow = createCustomerFlow(
        { intervalSec: 3, intervalJitter: 0.3, maxConcurrent: 4, patienceSec: 99 },
        ORDERS,
        createRng(11),
      )
      const desk = createDesk({ ...P, intervalSec: 2 }, ORDERS, 11)
      for (let t = 0; t < 12; t += 0.1) {
        stepCustomerFlow(flow, t, 0.1)
        if (withDesk) stepDesk(desk, 0.1)
      }
      return flow.customers.map((c) => JSON.stringify(c.spec))
    }
    expect(specs(true)).toEqual(specs(false))
  })
})
