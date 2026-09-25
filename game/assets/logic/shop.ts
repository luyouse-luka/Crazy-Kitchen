/**
 * Shop (ROADMAP batch 4): coins buy stations and upgrades, kept in the save. Zero Cocos (铁律①).
 * ⚠ No "second grill": M1 measured the grill is not the bottleneck, walking is. Upgrades speed things up instead.
 * ⏳ Every price and effect size here is self-chosen until tuned on device.
 */
import type { Progress } from './progress'

export type ItemId = 'fryer' | 'drinks' | 'fast-grill' | 'fast-wash' | 'big-tray'

export interface ShopItem {
  id: ItemId
  name: string
  price: number
  desc: string
}

export const SHOP: readonly ShopItem[] = [
  { id: 'fryer', name: '炸锅', price: 150, desc: '顾客会加点薯条，每份多收 ¥4' },
  { id: 'drinks', name: '饮料机', price: 250, desc: '顾客会加点饮料，每杯多收 ¥3（接满不拿会溢出）' },
  { id: 'fast-grill', name: '烤得更快', price: 120, desc: '烤肉快 20%（糊得也快），客人来得更勤' },
  { id: 'fast-wash', name: '洗得更快', price: 100, desc: '泡、刷、晾都快 30%，客人来得更勤' },
  { id: 'big-tray', name: '大托盘', price: 80, desc: '一趟搬 7 个盘子（5 个以上变慢），客人来得更勤' },
]

/** Share of diners who add fries once the fryer is bought */
export const FRIES_CHANCE = 0.4
export const DRINK_CHANCE = 0.35
export const FAST_GRILL = 0.8
export const FAST_WASH = 0.7
export const BIG_TRAY = { max: 7, slow: 5 }
/**
 * Arrival interval multiplier per upgrade: a faster kitchen also gets busier, or the game goes idle (GDD §12.2).
 * The fryer adds its own work, so it has none. ⏳ Self-chosen
 */
export const FLOW_UP: Partial<Record<ItemId, number>> = { 'fast-grill': 0.92, 'fast-wash': 0.95, 'big-tray': 0.95 }

/** Nothing bought = exactly 1, so the M1-calibrated flow is untouched */
export function flowFactor(p: Progress): number {
  let k = 1
  for (const id of p.owned) k *= FLOW_UP[id as ItemId] ?? 1
  return k
}

export function owns(p: Progress, id: ItemId): boolean {
  return p.owned.includes(id)
}

export type BuyResult = 'ok' | 'owned' | 'poor' | 'unknown'

export function buy(p: Progress, id: string): BuyResult {
  const item = SHOP.find((x) => x.id === id)
  if (!item) return 'unknown'
  if (p.owned.includes(item.id)) return 'owned'
  if (p.coins < item.price) return 'poor'
  p.coins -= item.price
  p.owned.push(item.id)
  return 'ok'
}
