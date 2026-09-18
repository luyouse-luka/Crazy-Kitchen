import { describe, expect, it } from 'vitest'
import {
  createShift,
  resetShift,
  settleServe,
  shiftResult,
  stepShift,
  timeLeft,
} from '../game/assets/logic/shift'
import type { ShiftConfig, ShiftState } from '../game/assets/logic/shift'
import { matchCustomer } from '../game/assets/logic/customer'
import type { Customer } from '../game/assets/logic/customer'
import { starsFor, CALIBRATION_SEC } from '../game/assets/logic/difficulty'
import type { OrderVerdict } from '../game/assets/logic/order'

const CFG: ShiftConfig = {
  seed: 7,
  durationSec: 60,
  flow: { intervalSec: 10, intervalJitter: 0, maxConcurrent: 4, patienceSec: 25 },
  orders: { extraMin: 0, extraMax: 1, bannedChance: 0 },
}

const mk = (over: Partial<ShiftConfig> = {}): ShiftState => createShift({ ...CFG, ...over })

const run = (st: ShiftState, sec: number, onLeave?: (c: Customer) => void): void => {
  const dt = 1 / 30
  for (let i = 0; i < Math.ceil(sec / dt); i++) stepShift(st, dt, onLeave)
}

const OK: OrderVerdict = { ok: true, missing: [], forbidden: [], cookOk: true }
const BAD: OrderVerdict = { ok: false, missing: ['cheese'], forbidden: [], cookOk: true }

describe('计时', () => {
  it('到点打烊，t 不会跑过局长', () => {
    const st = mk({ durationSec: 30 })
    run(st, 40)
    expect(st.over).toBe(true)
    expect(st.t).toBe(30)
    expect(timeLeft(st)).toBe(0)
  })

  it('打烊后 stepShift 是空操作 —— 多跑几帧不会再记超时', () => {
    const st = mk({ durationSec: 10, patienceSec: 999 } as Partial<ShiftConfig>)
    run(st, 15)
    const after = shiftResult(st)
    run(st, 30)
    expect(shiftResult(st)).toEqual(after)
  })

  it('打烊时在场的一律记超时', () => {
    const st = mk({ durationSec: 25, flow: { ...CFG.flow, patienceSec: 999 } })
    const left: number[] = []
    run(st, 30, (c) => left.push(c.id))
    const r = shiftResult(st)
    expect(r.arrived).toBe(3) // t = 0 / 10 / 20
    expect(r.timedOut).toBe(3)
    expect(left).toEqual([1, 2, 3])
  })
})

describe('上菜记账', () => {
  it('做对了记 served，顾客离场', () => {
    const st = mk()
    run(st, 1)
    const c = matchCustomer(st.flow, { ingredients: ['bun', 'patty'], cook: 'medium' })!
    expect(c).not.toBeNull()
    settleServe(st, c, OK)
    expect(st.served).toBe(1)
    expect(st.flow.activeCount).toBe(0)
  })

  it('做错了记 wrong，顾客照样走 —— 出餐口不能当试错工具', () => {
    const st = mk()
    run(st, 1)
    const c = st.flow.customers.find((x) => x.active)!
    settleServe(st, c, BAD)
    expect(st.wrong).toBe(1)
    expect(st.served).toBe(0)
    expect(st.flow.activeCount).toBe(0)
  })

  it('completionRate 只认做对的那些', () => {
    const st = mk({ durationSec: 25 })
    run(st, 11)
    const a = st.flow.customers.find((x) => x.active)!
    settleServe(st, a, OK)
    const b = st.flow.customers.find((x) => x.active)!
    settleServe(st, b, BAD)
    run(st, 30)
    const r = shiftResult(st)
    expect(r.served).toBe(1)
    expect(r.wrong).toBe(1)
    expect(r.completionRate).toBeCloseTo(1 / r.arrived, 10)
  })

  it('空局算满分，不是 0%', () => {
    const st = mk({ durationSec: 1, flow: { ...CFG.flow, intervalSec: 999 } })
    // intervalSec 再大，第一位仍在 t=0 到达，所以这里直接看没人来过的那个分支
    st.flow.arrived = 0
    expect(shiftResult(st).completionRate).toBe(1)
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
    expect(shiftResult(st)).toEqual({ arrived: 0, served: 0, wrong: 0, timedOut: 0, completionRate: 1 })
    run(st, 35)
    expect(st.flow.customers.map((c) => c.spec.required.join('+'))).toEqual(first)
  })
})

describe('星级', () => {
  it('短局按比例缩门槛 —— 60 秒的局不能用 210 秒的线', () => {
    // 第 1 天理想 9 单，三星线 6 单。3 单在整局里只值一星，在 60 秒的局里该是三星
    expect(starsFor(3, 1)).toBe(1)
    expect(starsFor(3, 1, 60)).toBe(3)
  })

  it('缩完至少要 1 单，短局不白送', () => {
    expect(starsFor(0, 1, 10)).toBe(0)
    expect(starsFor(1, 1, 10)).toBe(3)
  })

  it('不传时长 = 标定局长，老行为不变', () => {
    for (const served of [0, 3, 5, 7, 9]) {
      expect(starsFor(served, 1)).toBe(starsFor(served, 1, CALIBRATION_SEC))
    }
  })
})
