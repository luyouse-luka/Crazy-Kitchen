import { describe, it, expect } from 'vitest'
import { createBurger, addIngredient, addCookedPatty, hasCore, cookLevelAt } from '../game/assets/logic/recipe'
import type { CookWindows } from '../game/assets/logic/types'

/** M1 会扫这组参数，测试里固定一组好算的 */
const windows: CookWindows = { rareAt: 3, mediumAt: 6, wellAt: 9, burntAt: 12 }

describe('createBurger', () => {
  it('新汉堡是空的，没有肉饼所以没有火候', () => {
    const b = createBurger()
    expect(b.ingredients).toEqual([])
    expect(b.cook).toBeNull()
  })

  it('两个汉堡不共享食材数组', () => {
    const a = createBurger()
    const b = createBurger()
    addIngredient(a, 'cheese')
    expect(b.ingredients).toEqual([])
  })
})

describe('addIngredient', () => {
  it('加进去并返回 true', () => {
    const b = createBurger()
    expect(addIngredient(b, 'cheese')).toBe(true)
    expect(b.ingredients).toEqual(['cheese'])
  })

  it('同一样加第二次被拒绝，也不会重复计入', () => {
    const b = createBurger()
    addIngredient(b, 'cheese')
    expect(addIngredient(b, 'cheese')).toBe(false)
    expect(b.ingredients).toEqual(['cheese'])
  })

  it('直接夹生肉饼是允许的操作，火候记作 raw', () => {
    // 玩家跳过烤炉直接把冰箱里的肉放进汉堡——做得出来，但判定会失败
    const b = createBurger()
    addIngredient(b, 'patty')
    expect(b.cook).toBe('raw')
  })
})

describe('addCookedPatty', () => {
  it('放入烤好的肉饼，火候跟着肉饼走', () => {
    const b = createBurger()
    expect(addCookedPatty(b, 'medium')).toBe(true)
    expect(b.ingredients).toEqual(['patty'])
    expect(b.cook).toBe('medium')
  })

  it('一个汉堡只能有一块肉饼', () => {
    const b = createBurger()
    addCookedPatty(b, 'medium')
    expect(addCookedPatty(b, 'well')).toBe(false)
    expect(b.cook).toBe('medium')
  })
})

describe('hasCore', () => {
  it('有面包有肉饼才算成形', () => {
    const b = createBurger()
    addIngredient(b, 'bun')
    expect(hasCore(b)).toBe(false)
    addCookedPatty(b, 'medium')
    expect(hasCore(b)).toBe(true)
  })
})

describe('cookLevelAt', () => {
  it('刚放上去是生的', () => {
    expect(cookLevelAt(0, windows)).toBe('raw')
  })

  it('每一档的下界立刻进入该档', () => {
    expect(cookLevelAt(3, windows)).toBe('rare')
    expect(cookLevelAt(6, windows)).toBe('medium')
    expect(cookLevelAt(9, windows)).toBe('well')
    expect(cookLevelAt(12, windows)).toBe('burnt')
  })

  it('每一档的上界之前仍留在该档', () => {
    expect(cookLevelAt(2.99, windows)).toBe('raw')
    expect(cookLevelAt(5.99, windows)).toBe('rare')
    expect(cookLevelAt(8.99, windows)).toBe('medium')
    expect(cookLevelAt(11.99, windows)).toBe('well')
  })

  it('烤糊之后一直是糊的，不会绕回去', () => {
    expect(cookLevelAt(600, windows)).toBe('burnt')
  })
})
