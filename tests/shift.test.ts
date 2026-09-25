import { describe, expect, it } from 'vitest'
import {
  createShift,
  resetShift,
  settleServe,
  shiftResult,
  starsForShift,
  stepShift,
} from '../game/assets/logic/shift'
import type { ShiftConfig, ShiftResult, ShiftState } from '../game/assets/logic/shift'
import { matchCustomer, queueIndex, takeNextOrder, takeReadyOrders } from '../game/assets/logic/customer'
import type { OrderVerdict } from '../game/assets/logic/order'

const CFG: ShiftConfig = {
  seed: 7,
  customers: 3,
  flow: { intervalSec: 10, intervalJitter: 0, maxConcurrent: 4, patienceSec: 25 },
  orders: { extraMin: 0, extraMax: 1, bannedChance: 0 },
}

const mk = (over: Partial<ShiftConfig> = {}): ShiftState => createShift({ ...CFG, ...over })

const run = (st: ShiftState, sec: number): void => {
  const dt = 1 / 30
  for (let i = 0; i < Math.ceil(sec / dt); i++) stepShift(st, dt)
}

const OK: OrderVerdict = { ok: true, missing: [], forbidden: [], cookOk: true }
const BAD: OrderVerdict = { ok: false, missing: ['cheese'], forbidden: [], cookOk: true }

const serveAll = (st: ShiftState, v: OrderVerdict): void => {
  for (const c of st.flow.customers) if (c.active) settleServe(st, c, v)
}

describe('按顾客数结算', () => {
  it('来满 N 位就不再来，时间再久也一样', () => {
    const st = mk()
    run(st, 300)
    expect(st.flow.arrived).toBe(3)
  })

  it('没有局长：人都在等，就一直不结算', () => {
    const st = mk()
    run(st, 600)
    expect(st.over).toBe(false)
    expect(st.flow.activeCount).toBe(3)
  })

  it('最后一位离开的那一下结算', () => {
    const st = mk()
    run(st, 21) // t = 0 / 10 / 20 三位都到了
    serveAll(st, OK)
    expect(st.over).toBe(true)
  })

  it('还有人没来就不结算 —— 场上暂时空了不算完', () => {
    const st = mk()
    run(st, 1)
    serveAll(st, OK)
    expect(st.flow.activeCount).toBe(0)
    expect(st.over).toBe(false)
  })
})

describe('超时不跑单', () => {
  it('耐心耗尽的留下等，记一笔超时、标 late', () => {
    const st = mk()
    run(st, 26)
    const first = st.flow.customers.find((c) => c.id === 1)!
    expect(first.active).toBe(true)
    expect(first.late).toBe(true)
    expect(st.flow.timedOut).toBe(1)
  })

  it('超时只记一次，多等不重复记', () => {
    const st = mk()
    run(st, 26)
    run(st, 100)
    expect(st.flow.timedOut).toBe(3)
  })

  it('超时后做对：免单，不算好评', () => {
    const st = mk()
    run(st, 26)
    settleServe(st, st.flow.customers.find((c) => c.id === 1)!, OK)
    expect(st.lateServed).toBe(1)
    expect(st.served).toBe(0)
  })

  it('超时的排最前 —— 做出来的通用单先给等得最久的', () => {
    const st = mk()
    run(st, 26)
    expect(matchCustomer(st.flow, { ingredients: ['bun', 'patty'], cook: 'medium' })!.id).toBe(1)
  })
})

describe('上菜记账', () => {
  it('准时做对记好评，顾客离场', () => {
    const st = mk()
    run(st, 1)
    const c = matchCustomer(st.flow, { ingredients: ['bun', 'patty'], cook: 'medium' })!
    settleServe(st, c, OK)
    expect(st.served).toBe(1)
    expect(st.flow.activeCount).toBe(0)
  })

  it('做错了记 wrong，顾客照样走 —— 出餐口不能当试错工具', () => {
    const st = mk()
    run(st, 1)
    settleServe(st, st.flow.customers.find((x) => x.active)!, BAD)
    expect(st.wrong).toBe(1)
    expect(st.served).toBe(0)
    expect(st.flow.activeCount).toBe(0)
  })

  it('好评率只认准时做对的', () => {
    const st = mk()
    run(st, 1)
    serveAll(st, OK)
    run(st, 10)
    serveAll(st, BAD)
    run(st, 36) // 第三位到了又等超时
    serveAll(st, OK)
    const r = shiftResult(st)
    expect([r.served, r.wrong, r.lateServed]).toEqual([1, 1, 1])
    expect(r.goodRate).toBeCloseTo(1 / 3, 10)
    expect(st.over).toBe(true)
  })
})

describe('重开一局', () => {
  it('计数归零，同 seed 出同一批单', () => {
    const st = mk()
    run(st, 35)
    const first = st.flow.customers.map((c) => c.spec.required.join('+'))
    resetShift(st)
    expect(st.t).toBe(0)
    expect(st.over).toBe(false)
    expect(shiftResult(st)).toEqual({ arrived: 0, served: 0, lateServed: 0, wrong: 0, timedOut: 0, walkedOut: 0, leftLate: 0, goodRate: 1 })
    run(st, 35)
    expect(st.flow.customers.map((c) => c.spec.required.join('+'))).toEqual(first)
  })

  it('late 标记随重开清掉', () => {
    const st = mk()
    run(st, 60)
    resetShift(st)
    run(st, 1)
    expect(st.flow.customers.filter((c) => c.active).every((c) => !c.late)).toBe(true)
  })
})

describe('星级按好评率', () => {
  const r = (goodRate: number): ShiftResult =>
    ({ arrived: 10, served: 0, lateServed: 0, wrong: 0, timedOut: 0, walkedOut: 0, leftLate: 0, goodRate })
  it('四档分界', () => {
    expect([1, 0.9, 0.89, 0.7, 0.5, 0.49].map((k) => starsForShift(r(k)))).toEqual([3, 3, 2, 2, 1, 0])
  })
})

describe('要去点单台接单', () => {
  const TAKE = { walkInSec: 2, patienceSec: 10 }
  const mkT = (): ShiftState => mk({ flow: { ...CFG.flow, takeOrder: TAKE } })

  it('走到柜台之前接不了单', () => {
    const st = mkT()
    run(st, 1)
    expect(takeNextOrder(st.flow)).toBeNull()
    run(st, 1.1)
    expect(takeNextOrder(st.flow)!.id).toBe(1)
  })

  it('没接单时不倒等餐耐心、出餐口也不认他', () => {
    const st = mkT()
    run(st, 5)
    const c = st.flow.customers.find((x) => x.id === 1)!
    expect(c.patienceLeft).toBe(c.patienceMax)
    expect(matchCustomer(st.flow, { ingredients: ['bun', 'patty'], cook: 'medium' })).toBeNull()
  })

  it('一直没人理：走人，记一笔，算差评', () => {
    const st = mkT()
    run(st, 12.1)
    expect(st.flow.walkedOut).toBe(1)
    expect(st.flow.customers.find((x) => x.id === 1)?.active ?? false).toBe(false)
    run(st, 100)
    const r = shiftResult(st)
    expect(r.walkedOut).toBe(3)
    expect(r.goodRate).toBe(0)
    expect(st.over).toBe(true)
  })

  it('先来先接，接了单开始倒等餐耐心', () => {
    const st = mkT()
    run(st, 12) // 1 号、2 号都在排
    const c = takeNextOrder(st.flow)!
    expect(c.id).toBe(1)
    expect(queueIndex(st.flow, st.flow.customers.find((x) => x.id === 2)!)).toBe(0)
    run(st, 1)
    expect(c.patienceLeft).toBeLessThan(c.patienceMax)
  })

  it('点单台按一下，柜台前等着的全接了', () => {
    const st = mkT()
    run(st, 12) // 1 号、2 号都已走到柜台
    expect(takeReadyOrders(st.flow)).toBe(2)
    expect(st.flow.customers.filter((c) => c.active).every((c) => c.ordered)).toBe(true)
    expect(takeReadyOrders(st.flow)).toBe(0)
  })

  it('还在路上的不算：刚进门那位接不到', () => {
    const st = mkT()
    run(st, 21) // 3 号 t=20 进门，还没走到柜台
    expect(takeReadyOrders(st.flow)).toBe(1) // 1 号早已走人，只剩 2 号
    expect(st.flow.customers.find((x) => x.id === 3)!.ordered).toBe(false)
  })

  it('没开 takeOrder 的老路径不变：一到店就下单', () => {
    const st = mk()
    run(st, 1)
    expect(st.flow.customers.find((x) => x.id === 1)!.ordered).toBe(true)
    expect(takeNextOrder(st.flow)).toBeNull()
  })
})

describe('超时后再等一会儿就走', () => {
  const mkL = (lateLeaveSec?: number): ShiftState => mk({ customers: 1, flow: { ...CFG.flow, stayWhenLate: true, lateLeaveSec } })

  it('耐心耗尽后再过 lateLeaveSec 秒离场，记 leftLate，这一天能打烊', () => {
    const st = mkL(20)
    const gone: number[] = []
    const dt = 1 / 30
    const step = (sec: number) => {
      for (let i = 0; i < Math.ceil(sec / dt); i++) stepShift(st, dt, (c) => gone.push(c.id))
    }
    // arrives at t=0, runs out at 25, gives up at 45
    step(44)
    expect(st.flow.customers.some((c) => c.active && c.late)).toBe(true)
    expect(gone).toEqual([])
    step(2)
    expect(st.flow.leftLate).toBe(1)
    expect(st.over).toBe(true)
    expect(shiftResult(st).leftLate).toBe(1)
    expect(shiftResult(st).goodRate).toBe(0)
    // Same hook as a walk-out, so the view plays the same leaving review
    expect(gone).toEqual([1])
  })

  it('不设 lateLeaveSec 就一直等（旧规则）', () => {
    const st = mkL(undefined)
    run(st, 600)
    expect(st.flow.leftLate).toBe(0)
    expect(st.over).toBe(false)
  })
})
