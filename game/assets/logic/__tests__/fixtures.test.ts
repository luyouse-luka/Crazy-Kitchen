import { describe, it, expect } from 'vitest'
import cards from './fixtures/customers.json'
import { validateOrderSpec } from '../order'
import { LINE_LIMITS, MOODS, DONENESS } from '../types'
import type { CustomerCard } from '../types'

/**
 * 手写夹具的守门测试。
 *
 * 这 20 张卡是给 M1–M4 用的，好让厨房那几条线不必等内容管线（ROADMAP M0 线 B）。
 * 它们同时是 pipeline/ 将来要生成的 10000 张卡的格式样板 —— 所以这里的每一条检查，
 * C1 的 customer.schema.json 都要能拦住同样的错误。
 */
const fixtures = cards as CustomerCard[]

describe('顾客卡夹具', () => {
  it('至少 20 张', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20)
  })

  it('id 不重复', () => {
    const ids = new Set(fixtures.map((c) => c.id))
    expect(ids.size).toBe(fixtures.length)
  })

  it('每张的机制层都可解', () => {
    for (const c of fixtures) {
      expect({ id: c.id, problems: validateOrderSpec(c.order) }).toEqual({ id: c.id, problems: [] })
    }
  })

  it('mood 与 doneness 都在词表内', () => {
    for (const c of fixtures) {
      expect(MOODS as readonly string[]).toContain(c.mood)
      expect(DONENESS as readonly string[]).toContain(c.order.doneness)
    }
  })

  it('五句台词都非空', () => {
    for (const c of fixtures) {
      for (const key of ['greet', 'order', 'wait_nudge', 'praise', 'complain'] as const) {
        expect(c.lines[key].length, `${c.id}.lines.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('字数不超上限 —— 玩家一边跑冰箱一边烤肉，没有一秒能读长台词', () => {
    for (const c of fixtures) {
      expect(c.identity.length, `${c.id}.identity`).toBeLessThanOrEqual(LINE_LIMITS.identity)
      for (const key of ['greet', 'order', 'wait_nudge', 'praise', 'complain'] as const) {
        expect(c.lines[key].length, `${c.id}.lines.${key}`).toBeLessThanOrEqual(LINE_LIMITS[key])
      }
    }
  })

  it('带 arc 的卡按 chapter 递增，unlock_day 也递增', () => {
    // 长线记忆（GDD §8）：同一 series_id 的章节必须能排出确定顺序，
    // 否则「第 20 天他带朋友来」会在第 3 天先播
    const bySeries = new Map<string, CustomerCard[]>()
    for (const c of fixtures) {
      if (!c.arc) continue
      const list = bySeries.get(c.arc.series_id) ?? []
      list.push(c)
      bySeries.set(c.arc.series_id, list)
    }
    expect(bySeries.size).toBeGreaterThanOrEqual(1)

    for (const [seriesId, list] of bySeries) {
      list.sort((a, b) => a.arc!.chapter - b.arc!.chapter)
      for (let i = 1; i < list.length; i++) {
        expect(list[i]!.arc!.chapter, `${seriesId} chapter`).toBeGreaterThan(list[i - 1]!.arc!.chapter)
        expect(list[i]!.arc!.unlock_day, `${seriesId} unlock_day`).toBeGreaterThan(
          list[i - 1]!.arc!.unlock_day,
        )
      }
    }
  })

  it('多数卡的笑点长在订单上 —— 机制耦合率 ≥40%（判据 3）', () => {
    // 纯身份搞笑、订单却是普通汉堡的卡，玩家在游戏里看不到笑点：
    // 他正忙着跑冰箱，只会瞥一眼 order 那句。
    // 这里用一个可机器判定的下界代理：订单不是「光面包夹肉」的默认款。
    const coupled = fixtures.filter(
      (c) => c.order.required.length > 2 || c.order.banned.length > 0,
    )
    expect(coupled.length / fixtures.length).toBeGreaterThanOrEqual(0.4)
  })
})
