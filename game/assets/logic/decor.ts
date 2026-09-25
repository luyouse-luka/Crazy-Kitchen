/**
 * Decoration (ROADMAP batch 6, A tier): fixed slots in the shop, each shows one item or nothing, plus wall / floor
 * colours. Bought on a rest day, kept in the save. Purely cosmetic for now. Zero Cocos (铁律①).
 * ⏳ Slots, items, colours and prices are placeholders until the user's models arrive.
 */
import type { Progress } from './progress'

export type DecorItemId = 'plant' | 'plant-small' | 'bookcase'
export type DecorSlotId = 'wait-left' | 'wait-right' | 'counter' | 'wall-n'

export interface DecorItem {
  id: DecorItemId
  name: string
  price: number
}

export interface DecorSlot {
  id: DecorSlotId
  name: string
  allowed: readonly DecorItemId[]
  /** What the scene shows before any decorating */
  initial: DecorItemId | null
}

export const DECOR_ITEMS: readonly DecorItem[] = [
  { id: 'plant', name: '盆栽', price: 60 },
  { id: 'plant-small', name: '小盆栽', price: 50 },
  { id: 'bookcase', name: '书架', price: 100 },
]

export const DECOR_SLOTS: readonly DecorSlot[] = [
  { id: 'wait-left', name: '等候区左边', allowed: ['plant', 'plant-small'], initial: 'plant' },
  { id: 'wait-right', name: '等候区右边', allowed: ['plant', 'plant-small'], initial: 'plant' },
  { id: 'counter', name: '出餐台上', allowed: ['plant-small'], initial: 'plant-small' },
  { id: 'wall-n', name: '厨房北墙', allowed: ['bookcase', 'plant'], initial: null },
]

export interface Swatch {
  name: string
  rgb: readonly [number, number, number]
}

/** Index 0 = the scene's own material colour */
export const WALL_COLORS: readonly Swatch[] = [
  { name: '原色', rgb: [230, 230, 230] },
  { name: '奶黄', rgb: [240, 225, 190] },
  { name: '薄荷', rgb: [200, 230, 215] },
  { name: '樱粉', rgb: [240, 210, 210] },
]
export const FLOOR_COLORS: readonly Swatch[] = [
  { name: '原色', rgb: [200, 200, 200] },
  { name: '木色', rgb: [205, 170, 130] },
  { name: '浅蓝', rgb: [185, 205, 225] },
  { name: '暖灰', rgb: [190, 180, 170] },
]
export const COLOR_PRICE = 30

export interface Decor {
  placed: Record<DecorSlotId, DecorItemId | null>
  /** Bought items; one purchase lets the item go in any slot that allows it */
  owned: DecorItemId[]
  wall: number
  floor: number
}

export function newDecor(): Decor {
  const placed = {} as Decor['placed']
  const owned: DecorItemId[] = []
  for (const s of DECOR_SLOTS) {
    placed[s.id] = s.initial
    if (s.initial && !owned.includes(s.initial)) owned.push(s.initial)
  }
  return { placed, owned, wall: 0, floor: 0 }
}

const item = (id: unknown) => DECOR_ITEMS.find((x) => x.id === id)

/** Anything unknown or out of range falls back to the fresh value, so a hand-edited save still loads */
export function parseDecor(o: unknown): Decor {
  const d = newDecor()
  if (!o || typeof o !== 'object') return d
  const r = o as { placed?: Record<string, unknown>; owned?: unknown; wall?: unknown; floor?: unknown }
  if (Array.isArray(r.owned)) for (const id of r.owned) if (item(id) && !d.owned.includes(id)) d.owned.push(id)
  if (r.placed && typeof r.placed === 'object') {
    for (const s of DECOR_SLOTS) {
      if (!(s.id in r.placed)) continue
      const v = r.placed[s.id]
      if (v === null) d.placed[s.id] = null
      else if (s.allowed.includes(v as DecorItemId) && d.owned.includes(v as DecorItemId)) d.placed[s.id] = v as DecorItemId
    }
  }
  const idx = (v: unknown, n: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : 0)
  d.wall = idx(r.wall, WALL_COLORS.length)
  d.floor = idx(r.floor, FLOOR_COLORS.length)
  return d
}

export type DecorResult = 'ok' | 'same' | 'poor' | 'not-allowed' | 'unknown'

/** Put `id` (or nothing) in a slot, buying it first if not owned */
export function place(p: Progress, slotId: DecorSlotId, id: DecorItemId | null): DecorResult {
  const slot = DECOR_SLOTS.find((s) => s.id === slotId)
  if (!slot) return 'unknown'
  const d = p.decor
  if (d.placed[slotId] === id) return 'same'
  if (id !== null) {
    const it = item(id)
    if (!it) return 'unknown'
    if (!slot.allowed.includes(id)) return 'not-allowed'
    if (!d.owned.includes(id)) {
      if (p.coins < it.price) return 'poor'
      p.coins -= it.price
      d.owned.push(id)
    }
  }
  d.placed[slotId] = id
  return 'ok'
}

/** Repaint walls or floor; every change costs COLOR_PRICE, going back to a colour included */
export function paint(p: Progress, which: 'wall' | 'floor', index: number): DecorResult {
  const list = which === 'wall' ? WALL_COLORS : FLOOR_COLORS
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return 'unknown'
  if (p.decor[which] === index) return 'same'
  if (p.coins < COLOR_PRICE) return 'poor'
  p.coins -= COLOR_PRICE
  p.decor[which] = index
  return 'ok'
}
