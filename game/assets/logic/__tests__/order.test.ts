import { describe, it, expect } from 'vitest'
import { judge, validateOrderSpec } from '../order'
import { createBurger, addIngredient, addCookedPatty } from '../recipe'
import type { OrderSpec } from '../types'

const spec = (over: Partial<OrderSpec> = {}): OrderSpec => ({
  required: ['bun', 'patty'],
  banned: [],
  doneness: 'medium',
  patience: 45,
  ...over,
})

describe('judge', () => {
  it('食材齐、火候对 → 通过', () => {
    const b = createBurger()
    addIngredient(b, 'bun')
    addCookedPatty(b, 'medium')
    const v = judge(b, spec())
    expect(v.ok).toBe(true)
    expect(v.missing).toEqual([])
    expect(v.forbidden).toEqual([])
    expect(v.cookOk).toBe(true)
  })

  it('缺 required 食材 → 不通过，并列出缺了什么', () => {
    const b = createBurger()
    addCookedPatty(b, 'medium')
    const v = judge(b, spec({ required: ['bun', 'patty', 'cheese'] }))
    expect(v.ok).toBe(false)
    expect(v.missing).toEqual(['bun', 'cheese'])
  })

  it('放了 banned 食材 → 不通过，并列出放错了什么', () => {
    // 「我都说了不要洋葱」这句 complain 的机制来源
    const b = createBurger()
    addIngredient(b, 'bun')
    addCookedPatty(b, 'medium')
    addIngredient(b, 'onion')
    const v = judge(b, spec({ banned: ['onion'] }))
    expect(v.ok).toBe(false)
    expect(v.forbidden).toEqual(['onion'])
  })

  it('多放了既不 required 也不 banned 的食材 → 仍然通过', () => {
    // 顾客没说不要，就不算错。banned 才是唯一的否定通道
    const b = createBurger()
    addIngredient(b, 'bun')
    addCookedPatty(b, 'medium')
    addIngredient(b, 'pickle')
    expect(judge(b, spec()).ok).toBe(true)
  })

  it('火候不对 → 不通过', () => {
    const b = createBurger()
    addIngredient(b, 'bun')
    addCookedPatty(b, 'well')
    const v = judge(b, spec({ doneness: 'rare' }))
    expect(v.ok).toBe(false)
    expect(v.cookOk).toBe(false)
  })

  it('生肉 → 不通过', () => {
    const b = createBurger()
    addIngredient(b, 'bun')
    addIngredient(b, 'patty')
    expect(judge(b, spec()).cookOk).toBe(false)
  })

  it('烤糊 → 不通过', () => {
    const b = createBurger()
    addIngredient(b, 'bun')
    addCookedPatty(b, 'burnt')
    expect(judge(b, spec()).cookOk).toBe(false)
  })

  it('压根没放肉饼 → 火候判定失败，不是「碰巧对上」', () => {
    // cook 为 null 时若拿 null 去和 doneness 比，任何顾客都判失败——正确；
    // 但若实现成「没肉饼就跳过火候检查」，只点了面包的边界单会被误判通过
    const b = createBurger()
    addIngredient(b, 'bun')
    const v = judge(b, spec())
    expect(v.cookOk).toBe(false)
    expect(v.missing).toEqual(['patty'])
    expect(v.ok).toBe(false)
  })

  it('多项同时出错时全部列出，不在第一项就短路', () => {
    // 评价系统要按错误项挑 complain，短路会让「缺芝士又放了洋葱」只报一半
    const b = createBurger()
    addIngredient(b, 'bun')
    addCookedPatty(b, 'raw')
    addIngredient(b, 'onion')
    const v = judge(b, spec({ required: ['bun', 'patty', 'cheese'], banned: ['onion'] }))
    expect(v.missing).toEqual(['cheese'])
    expect(v.forbidden).toEqual(['onion'])
    expect(v.cookOk).toBe(false)
    expect(v.ok).toBe(false)
  })
})

describe('validateOrderSpec', () => {
  it('合法订单没有问题', () => {
    expect(validateOrderSpec(spec())).toEqual([])
  })

  it('required 与 banned 相交 → 这单永远做不出来', () => {
    // AI 生成的卡必须被这条拦住，否则玩家会遇到无解订单
    const problems = validateOrderSpec(spec({ required: ['bun', 'patty', 'onion'], banned: ['onion'] }))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('onion')
  })

  it('缺骨架食材 → 不成其为汉堡', () => {
    expect(validateOrderSpec(spec({ required: ['bun'] }))).toHaveLength(1)
    expect(validateOrderSpec(spec({ required: ['patty'] }))).toHaveLength(1)
  })

  it('banned 里出现骨架食材 → 不成其为汉堡', () => {
    const problems = validateOrderSpec(spec({ banned: ['bun'] }))
    expect(problems.length).toBeGreaterThanOrEqual(1)
  })

  it('耐心必须为正', () => {
    expect(validateOrderSpec(spec({ patience: 0 }))).toHaveLength(1)
    expect(validateOrderSpec(spec({ patience: -5 }))).toHaveLength(1)
  })

  it('词表外的食材 → 引擎判不了', () => {
    const bad = spec()
    ;(bad.required as string[]).push('sunlight_tomato')
    const problems = validateOrderSpec(bad)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('sunlight_tomato')
  })

  it('多个问题同时列出', () => {
    const problems = validateOrderSpec(spec({ required: ['bun'], patience: -1 }))
    expect(problems).toHaveLength(2)
  })
})
