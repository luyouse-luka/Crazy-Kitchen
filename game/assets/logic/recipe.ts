/**
 * 食材 → 汉堡的组装规则，以及烤炉的火候时间轴。
 *
 * V1 只有汉堡，链条短（取 → 烹 → 装盘 → 上菜），所以这里刻意保持薄：
 * 一个汉堡就是一组不重复的食材 + 一块肉饼的火候。
 */
import { CORE_INGREDIENTS } from './types'
import type { Burger, CookLevel, CookWindows, Ingredient } from './types'

export function createBurger(): Burger {
  return { ingredients: [], cook: null }
}

/**
 * 往汉堡里加一样食材。已经有了就拒绝（同一样加两次没有玩法意义，只会让判定含糊）。
 *
 * 传 'patty' 表示玩家跳过烤炉、直接夹了块生肉 —— 做得出来，判定会失败。
 * 从烤炉拿的肉饼走 addCookedPatty。
 */
export function addIngredient(burger: Burger, ing: Ingredient): boolean {
  if (burger.ingredients.includes(ing)) return false
  burger.ingredients.push(ing)
  if (ing === 'patty') burger.cook = 'raw'
  return true
}

/** 放入烤好的肉饼，汉堡的火候跟着这块肉走。一个汉堡只能有一块。 */
export function addCookedPatty(burger: Burger, cook: CookLevel): boolean {
  if (burger.ingredients.includes('patty')) return false
  burger.ingredients.push('patty')
  burger.cook = cook
  return true
}

/** 骨架食材齐不齐 —— 面包 + 肉饼，缺一样就不成其为汉堡。 */
export function hasCore(burger: Burger): boolean {
  for (let i = 0; i < CORE_INGREDIENTS.length; i++) {
    if (!burger.ingredients.includes(CORE_INGREDIENTS[i]!)) return false
  }
  return true
}

/**
 * 肉饼在烤炉上待了 elapsed 秒之后是什么火候。
 *
 * 一条单向时间轴：raw → rare → medium → well → burnt，糊了就回不去。
 * 窗口宽度是 M1 无头模拟器要扫的核心参数之一 —— 窗口越窄，玩家越要盯着烤炉，
 * 压力就越大；所以数值只能来自 CookWindows，不许在别处写死。
 */
export function cookLevelAt(elapsed: number, w: CookWindows): CookLevel {
  if (elapsed >= w.burntAt) return 'burnt'
  if (elapsed >= w.wellAt) return 'well'
  if (elapsed >= w.mediumAt) return 'medium'
  if (elapsed >= w.rareAt) return 'rare'
  return 'raw'
}
