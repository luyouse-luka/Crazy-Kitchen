import { describe, it, expect } from 'vitest'
import { runDay, defaultSimConfig, createSimState, stepSim } from '../sim'
import type { SimConfig } from '../sim'

/** 在默认配置上改几个字段。默认值本身是 M1 要标定的东西，测试只依赖相对关系。 */
const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({ ...defaultSimConfig(), ...over })

describe('runDay · 单顾客的宽裕场景', () => {
  const relaxed = cfg({
    durationSec: 60,
    flow: { intervalSec: 999, intervalJitter: 0, maxConcurrent: 4, patienceSec: 120 },
    orders: { extraMin: 0, extraMax: 0, bannedChance: 0 },
  })

  it('一个顾客、时间充裕 → 服务成功', () => {
    const r = runDay(relaxed)
    expect(r.arrived).toBe(1)
    expect(r.served).toBe(1)
    expect(r.timedOut).toBe(0)
  })

  it('理想玩家永远不上错菜 —— 零失误的定义就是「不齐不上」', () => {
    const r = runDay(relaxed)
    expect(r.wrong).toBe(0)
  })

  it('时间充裕时玩家有空闲 —— 空闲归零才说明压力饱和', () => {
    const r = runDay(relaxed)
    expect(r.idleSec).toBeGreaterThan(0)
  })
})

describe('runDay · 可复现性', () => {
  it('同 seed 两次跑，每一项统计都相同', () => {
    const c = cfg({ durationSec: 180, seed: 20260807 })
    expect(runDay(c)).toEqual(runDay(c))
  })

  it('不同 seed 会给出不同的客流 —— 否则扫参数只是在看同一局', () => {
    const a = runDay(cfg({ durationSec: 180, seed: 1 }))
    const b = runDay(cfg({ durationSec: 180, seed: 2 }))
    expect(a).not.toEqual(b)
  })
})

describe('runDay · 顾客耐心', () => {
  it('耐心极短 → 等不及走人，且不算上错菜', () => {
    const r = runDay(
      cfg({
        durationSec: 60,
        flow: { intervalSec: 999, intervalJitter: 0, maxConcurrent: 4, patienceSec: 3 },
      }),
    )
    expect(r.timedOut).toBe(1)
    expect(r.served).toBe(0)
    expect(r.wrong).toBe(0)
  })

  it('差评率只来自超时 —— 理想玩家不会做错，所以这条曲线纯粹反映时间预算', () => {
    const r = runDay(cfg({ durationSec: 180, flow: { intervalSec: 6, intervalJitter: 0, maxConcurrent: 8, patienceSec: 30 } }))
    expect(r.badReviewRate).toBeCloseTo(r.timedOut / r.arrived, 10)
  })
})

describe('runDay · 在场上限', () => {
  it('峰值并发不超过 maxConcurrent', () => {
    const r = runDay(
      cfg({
        durationSec: 180,
        flow: { intervalSec: 2, intervalJitter: 0, maxConcurrent: 3, patienceSec: 60 },
      }),
    )
    expect(r.peakConcurrent).toBeLessThanOrEqual(3)
  })
})

describe('runDay · 压力的三个旋钮都要真的有效', () => {
  const base = { durationSec: 210, seed: 99 }

  it('客流越密，完成率越低', () => {
    const loose = runDay(cfg({ ...base, flow: { intervalSec: 20, intervalJitter: 0, maxConcurrent: 8, patienceSec: 45 } }))
    const dense = runDay(cfg({ ...base, flow: { intervalSec: 5, intervalJitter: 0, maxConcurrent: 8, patienceSec: 45 } }))
    expect(dense.completionRate).toBeLessThan(loose.completionRate)
  })

  it('工位摆得越散，完成率越低 —— 横屏的第二个旋钮（ROADMAP M3）', () => {
    const tight = runDay(cfg({ ...base, layout: { ...defaultSimConfig().layout, spread: 0.5 } }))
    const wide = runDay(cfg({ ...base, layout: { ...defaultSimConfig().layout, spread: 3 } }))
    expect(wide.completionRate).toBeLessThan(tight.completionRate)
  })

  // ⚠ 这两条钉住的是一个反直觉的实测结论，别照着「多加设备总是更好」的直觉改回去。
  //
  // 基准火候（3/6/9/13s）下烤一块肉比玩家跑一趟还快，烤炉根本不是瓶颈 ——
  // **跑腿才是**。多给槽位不但不提升，还因为要多盯一个计时器而略微变差。
  // 这直接是 M4「升级项·设备」的设计输入：做成「多一个烤炉」= 无效升级。

  it('基准火候下烤炉不是瓶颈 —— 多给槽位换不来完成率', () => {
    const flow = { intervalSec: 12, intervalJitter: 0, maxConcurrent: 8, patienceSec: 45 }
    const one = runDay(cfg({ ...base, grillSlots: 1, flow }))
    const four = runDay(cfg({ ...base, grillSlots: 4, flow }))
    expect(four.completionRate).toBeLessThanOrEqual(one.completionRate)
  })

  it('但烤肉一旦成为瓶颈，多槽立刻显效 —— 证明这不是调度写坏了', () => {
    // 火候窗口 ×5，烤一块肉远超玩家跑一趟的时间，此时槽位才是真约束
    const slowCook = { rareAt: 15, mediumAt: 30, wellAt: 45, burntAt: 65 }
    const flow = { intervalSec: 25, intervalJitter: 0, maxConcurrent: 8, patienceSec: 45 }
    const one = runDay(cfg({ ...base, grillSlots: 1, cook: slowCook, flow }))
    const three = runDay(cfg({ ...base, grillSlots: 3, cook: slowCook, flow }))
    expect(three.completionRate).toBeGreaterThan(one.completionRate)
    // 而且玩家的干等时间会明显下降 —— 瓶颈确实被解开了
    expect(three.idleSec).toBeLessThan(one.idleSec)
  })

  it('订单越复杂（额外食材越多），完成率越低', () => {
    const simple = runDay(cfg({ ...base, orders: { extraMin: 0, extraMax: 0, bannedChance: 0 }, flow: { intervalSec: 10, intervalJitter: 0, maxConcurrent: 8, patienceSec: 45 } }))
    const complex = runDay(cfg({ ...base, orders: { extraMin: 3, extraMax: 4, bannedChance: 0 }, flow: { intervalSec: 10, intervalJitter: 0, maxConcurrent: 8, patienceSec: 45 } }))
    expect(complex.completionRate).toBeLessThan(simple.completionRate)
  })
})

describe('runDay · 烤糊是「崩」的先行指标', () => {
  it('闲时不会烤糊 —— 理想玩家掐着点取肉', () => {
    const r = runDay(
      cfg({
        durationSec: 120,
        flow: { intervalSec: 30, intervalJitter: 0, maxConcurrent: 4, patienceSec: 90 },
      }),
    )
    expect(r.burnt).toBe(0)
  })

  it('火候窗口窄到跑一趟就过火时会烤糊 —— 这是 M4 收窄窗口提难度的机制来源', () => {
    // 每档只有 1 秒：玩家从冰箱走到烤炉就要 0.75s + 0.4s 交互，必然错过一些
    const r = runDay(
      cfg({
        durationSec: 210,
        cook: { rareAt: 2, mediumAt: 3, wellAt: 4, burntAt: 5 },
        flow: { intervalSec: 8, intervalJitter: 0, maxConcurrent: 8, patienceSec: 45 },
        orders: { extraMin: 1, extraMax: 3, bannedChance: 0 },
      }),
    )
    expect(r.burnt).toBeGreaterThan(0)
  })
})

describe('runDay · 局长', () => {
  it('到点收工，之后不再有人进来', () => {
    const short = runDay(cfg({ durationSec: 60, flow: { intervalSec: 10, intervalJitter: 0, maxConcurrent: 8, patienceSec: 45 } }))
    const long = runDay(cfg({ durationSec: 180, flow: { intervalSec: 10, intervalJitter: 0, maxConcurrent: 8, patienceSec: 45 } }))
    expect(short.arrived).toBeLessThan(long.arrived)
    expect(short.arrived).toBeLessThanOrEqual(60 / 10 + 1)
  })
})

describe('trace', () => {
  it('默认不记录时间线 —— 它会分配，只在调试时开', () => {
    expect(runDay(cfg({ durationSec: 60 })).trace).toHaveLength(0)
  })

  it('打开后能读出发生了什么', () => {
    const r = runDay(cfg({ durationSec: 60, trace: true }))
    expect(r.trace.length).toBeGreaterThan(0)
    expect(r.trace.join('\n')).toContain('arrive')
  })
})

describe('stepSim · 逐帧接口', () => {
  it('推进到局长之后就停止，统计与 runDay 一致', () => {
    const c = cfg({ durationSec: 60, seed: 4242 })
    const state = createSimState(c)
    const dt = 1 / 30
    for (let i = 0; i < Math.ceil(60 / dt) + 10; i++) stepSim(state, dt)
    expect(state.result.served).toBe(runDay(c).served)
  })

  it('同一个 state 可以重置后重跑 —— 扫参数时跑上千局不新建对象', () => {
    const c = cfg({ durationSec: 60, seed: 4242 })
    const state = createSimState(c)
    const dt = 1 / 30
    for (let i = 0; i < Math.ceil(60 / dt) + 10; i++) stepSim(state, dt)
    const first = state.result.served

    state.reset(c)
    for (let i = 0; i < Math.ceil(60 / dt) + 10; i++) stepSim(state, dt)
    expect(state.result.served).toBe(first)
  })
})
