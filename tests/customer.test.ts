import { describe, expect, it } from 'vitest'
import {
  closeShop,
  createCustomerFlow,
  matchCustomer,
  releaseCustomer,
  stepCustomerFlow,
} from '../game/assets/logic/customer'
import type { Customer, CustomerFlow, FlowParams, OrderDifficulty } from '../game/assets/logic/customer'
import { validateOrderSpec } from '../game/assets/logic/order'
import { createRng } from '../game/assets/logic/rng'
import type { Burger } from '../game/assets/logic/types'

const FLOW: FlowParams = { intervalSec: 10, intervalJitter: 0, maxConcurrent: 3, patienceSec: 20 }
const ORDERS: OrderDifficulty = { extraMin: 0, extraMax: 2, bannedChance: 0.3 }

const mk = (flow: Partial<FlowParams> = {}, orders: Partial<OrderDifficulty> = {}, seed = 1): CustomerFlow =>
  createCustomerFlow({ ...FLOW, ...flow }, { ...ORDERS, ...orders }, createRng(seed))

/**
  * 往前推 sec 秒，步长贴近真机的 30fps。返回停在哪一秒 —— 时钟必须接力，
  * 每次从 0 重来的话 nextArrivalAt 早就跑到前面去了，测出来是「没人来」。
  */
const run = (
  st: CustomerFlow,
  sec: number,
  from = 0,
  onArrive?: (c: Customer) => void,
): number => {
  const dt = 1 / 30
  let t = from
  const end = from + sec
  while (t < end - 1e-9) {
    t += dt
    stepCustomerFlow(st, t, dt, undefined, onArrive)
  }
  return t
}

const burger = (ings: Burger['ingredients'], cook: Burger['cook']): Burger => ({ ingredients: ings, cook })

describe('到达', () => {
  it('第一位在 t=0 就到，之后按 intervalSec 来', () => {
    const st = mk()
    stepCustomerFlow(st, 0, 0)
    expect(st.arrived).toBe(1)
    const t = run(st, 9)
    expect(st.arrived).toBe(1)
    run(st, 2, t)
    expect(st.arrived).toBe(2)
  })

  it('在场人数顶到 maxConcurrent 就不再放人进来', () => {
    const st = mk({ maxConcurrent: 2, patienceSec: 999 })
    run(st, 60)
    expect(st.activeCount).toBe(2)
    expect(st.arrived).toBe(2)
  })

  it('peakConcurrent 记的是峰值，不随人走而回落', () => {
    const st = mk({ maxConcurrent: 3, patienceSec: 25 })
    const t = run(st, 30)
    const peak = st.peakConcurrent
    expect(peak).toBeGreaterThanOrEqual(2)
    run(st, 60, t)
    expect(st.peakConcurrent).toBe(peak)
  })
})

describe('耐心', () => {
  it('耗尽即离场并记一笔超时', () => {
    const st = mk({ intervalSec: 999, patienceSec: 5 })
    stepCustomerFlow(st, 0, 0)
    expect(st.activeCount).toBe(1)
    run(st, 5.1)
    expect(st.timedOut).toBe(1)
    expect(st.activeCount).toBe(0)
  })

  it('onTimeout 在释放之前调用 —— 回调里还看得见是谁', () => {
    const st = mk({ intervalSec: 999, patienceSec: 5 })
    stepCustomerFlow(st, 0, 0)
    const seen: Array<{ id: number; active: boolean }> = []
    let t = 0
    for (let i = 0; i < 200; i++) {
      t += 1 / 30
      stepCustomerFlow(st, t, 1 / 30, (c) => seen.push({ id: c.id, active: c.active }))
    }
    expect(seen).toHaveLength(1)
    expect(seen[0]!.id).toBe(1)
    expect(seen[0]!.active).toBe(true)
  })

  it('patienceMax 记着上限，UI 拿它当进度条分母', () => {
    const st = mk({ patienceSec: 33 })
    stepCustomerFlow(st, 0, 0)
    expect(st.customers[0]!.patienceMax).toBe(33)
  })
})

describe('点单', () => {
  it('每一单都是机制层可解的', () => {
    const st = mk({ intervalSec: 1, maxConcurrent: 6, patienceSec: 3 }, { extraMax: 3, bannedChance: 0.8 })
    // 到达的当场查：槽位是复用的，事后遍历数组会扫到从没用过的空格子
    const bad: string[] = []
    run(st, 120, 0, (c) => bad.push(...validateOrderSpec(c.spec)))
    expect(st.arrived).toBeGreaterThan(20)
    expect(bad).toEqual([])
  })

  it('同一个 seed 出同一批单 —— 难度可复现', () => {
    const a = mk({}, {}, 42)
    const b = mk({}, {}, 42)
    run(a, 45)
    run(b, 45)
    expect(a.customers.map((c) => c.spec.required.join('+'))).toEqual(
      b.customers.map((c) => c.spec.required.join('+')),
    )
    expect(a.arrived).toBe(b.arrived)
  })
})

describe('matchCustomer', () => {
  it('优先给吃得下的那位，不是最急的那位', () => {
    const st = mk({ intervalSec: 999, maxConcurrent: 3, patienceSec: 999 })
    stepCustomerFlow(st, 0, 0)
    const a = st.customers[0]!
    a.active = true
    a.spec = { required: ['bun', 'patty'], banned: [], doneness: 'rare', patience: 99 }
    a.patienceLeft = 1 // 最急，但吃不下
    const b = st.customers[1]!
    b.active = true
    b.id = 99
    b.spec = { required: ['bun', 'patty'], banned: [], doneness: 'medium', patience: 99 }
    b.patienceLeft = 50
    st.activeCount = 2
    expect(matchCustomer(st, burger(['bun', 'patty'], 'medium'))!.id).toBe(99)
  })

  it('没人吃得下也一定有人接 —— 砸在最急的那位头上', () => {
    const st = mk({ intervalSec: 999, patienceSec: 999 })
    stepCustomerFlow(st, 0, 0)
    const a = st.customers[0]!
    a.spec = { required: ['bun', 'patty'], banned: [], doneness: 'well', patience: 99 }
    a.patienceLeft = 3
    const hit = matchCustomer(st, burger(['bun'], null))
    expect(hit).toBe(a)
  })

  it('店里没人时返回 null', () => {
    const st = mk()
    expect(matchCustomer(st, burger(['bun', 'patty'], 'medium'))).toBeNull()
  })
})

describe('离场', () => {
  it('releaseCustomer 幂等 —— 重复调不会把 activeCount 减穿', () => {
    const st = mk({ intervalSec: 999 })
    stepCustomerFlow(st, 0, 0)
    const c = st.customers[0]!
    releaseCustomer(st, c)
    releaseCustomer(st, c)
    expect(st.activeCount).toBe(0)
  })

  it('打烊把在场的都记成超时', () => {
    const st = mk({ intervalSec: 5, maxConcurrent: 3, patienceSec: 999 })
    run(st, 12)
    const n = st.activeCount
    expect(n).toBeGreaterThan(1)
    closeShop(st)
    expect(st.timedOut).toBe(n)
    expect(st.activeCount).toBe(0)
  })
})
