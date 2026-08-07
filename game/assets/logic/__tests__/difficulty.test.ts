import { describe, it, expect } from 'vitest'
import { difficultyForDay, starsFor, LAST_DAY } from '../difficulty'
import { runDay, defaultSimConfig } from '../sim'

/**
 * 难度曲线是**标定出来的产物**（跑 `pnpm sim curve` 反复调参得到），
 * 所以这些测试是守门的，不是驱动设计的：它们钉住曲线的契约与目标带，
 * 将来谁改了参数、把曲线调出带外，这里会红。
 */

describe('difficultyForDay · 契约', () => {
  it('天数越界向内夹紧', () => {
    expect(difficultyForDay(0)).toEqual(difficultyForDay(1))
    expect(difficultyForDay(-5)).toEqual(difficultyForDay(1))
    expect(difficultyForDay(999)).toEqual(difficultyForDay(LAST_DAY))
  })

  it('小数天数按整天算', () => {
    expect(difficultyForDay(3.9)).toEqual(difficultyForDay(3))
  })

  it('客流越往后越密、耐心越往后越短', () => {
    for (let d = 2; d <= LAST_DAY; d++) {
      const prev = difficultyForDay(d - 1)
      const cur = difficultyForDay(d)
      expect(cur.flow.intervalSec).toBeLessThan(prev.flow.intervalSec)
      expect(cur.flow.patienceSec).toBeLessThan(prev.flow.patienceSec)
    }
  })

  it('订单复杂度与禁料概率单调不降', () => {
    for (let d = 2; d <= LAST_DAY; d++) {
      const prev = difficultyForDay(d - 1)
      const cur = difficultyForDay(d)
      expect(cur.orders.extraMax).toBeGreaterThanOrEqual(prev.orders.extraMax)
      expect(cur.orders.bannedChance).toBeGreaterThanOrEqual(prev.orders.bannedChance)
    }
  })

  it('第 1 天不放禁料也不放额外配料 —— 教学关不该一上来就考记忆', () => {
    const d1 = difficultyForDay(1)
    expect(d1.orders.extraMax).toBe(0)
    expect(d1.orders.bannedChance).toBe(0)
  })

  it('每一天的星级线都严格递增', () => {
    for (let d = 1; d <= LAST_DAY; d++) {
      const { stars } = difficultyForDay(d)
      expect(stars.one).toBeLessThan(stars.two)
      expect(stars.two).toBeLessThan(stars.three)
    }
  })
})

describe('starsFor', () => {
  it('按门槛给星，门槛值本身算达标', () => {
    const { stars } = difficultyForDay(1)
    expect(starsFor(stars.three, 1)).toBe(3)
    expect(starsFor(stars.three + 5, 1)).toBe(3)
    expect(starsFor(stars.two, 1)).toBe(2)
    expect(starsFor(stars.one, 1)).toBe(1)
    expect(starsFor(stars.one - 1, 1)).toBe(0)
  })

  it('一单没做完是 0 星', () => {
    expect(starsFor(0, 10)).toBe(0)
  })
})

describe('曲线的目标带 —— M1 的验收判据', () => {
  // 少跑几个 seed 保持测试轻快；`pnpm sim curve` 用 32 个 seed 做正式标定
  const SEEDS = 8

  function idealCompletion(day: number): number {
    const d = difficultyForDay(day)
    const base = { ...defaultSimConfig(), durationSec: 210, flow: d.flow, orders: d.orders }
    let sum = 0
    for (let s = 0; s < SEEDS; s++) sum += runDay({ ...base, seed: 1000 + s * 7919 }).completionRate
    return sum / SEEDS
  }

  it('全程不把理想玩家压垮 —— 他崩了真人就毫无希望', () => {
    for (let day = 1; day <= LAST_DAY; day++) {
      const c = idealCompletion(day)
      expect(c, `第 ${day} 天理想玩家完成率 ${(c * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(0.75)
    }
  })

  it('第 4 天起总有压力 —— 前 3 天是教学关，允许接近满分', () => {
    for (let day = 4; day <= LAST_DAY; day++) {
      const c = idealCompletion(day)
      expect(c, `第 ${day} 天理想玩家完成率 ${(c * 100).toFixed(0)}%`).toBeLessThan(0.99)
    }
  })

  it('最后一天明显难过第一天 —— 否则 20 天的曲线是白排的', () => {
    expect(idealCompletion(LAST_DAY)).toBeLessThan(idealCompletion(1) - 0.08)
  })

  it('三星线定在理想玩家够得着、但要打起精神的位置', () => {
    for (const day of [1, 10, LAST_DAY]) {
      const d = difficultyForDay(day)
      const base = { ...defaultSimConfig(), durationSec: 210, flow: d.flow, orders: d.orders }
      let served = 0
      for (let s = 0; s < SEEDS; s++) served += runDay({ ...base, seed: 1000 + s * 7919 }).served
      served /= SEEDS
      // 理想玩家稳过三星（否则真人没戏），但也不能富余太多（否则三星白送）
      expect(served, `第 ${day} 天`).toBeGreaterThan(d.stars.three)
      expect(d.stars.three / served).toBeGreaterThan(0.6)
    }
  })
})
