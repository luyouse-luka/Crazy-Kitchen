/**
 * 厨房状态机：手持 + 工位交互 + 烤炉计时。零 Cocos 依赖（铁律①）。
 *
 * 与 sim.ts 的分工：sim.ts 是**内部决策**的无头模拟器（标定难度参数），
 * 这里是**外部输入驱动**的真人版。两边共用 recipe.ts / order.ts 的规则，
 * 各自跑各自的循环 —— 判定规则只有一份，M1 标定的参数才对真游戏有效。
 *
 * 输入映射不在这一层：组件按一个键，调 interact()，由 station.kind 分派。
 * 「冰箱怎么选食材」「丢弃怎么触发」是 UI 决策，这里只提供 API。
 */
import { inTriggerRange } from './collision'
import { judge } from './order'
import type { OrderVerdict } from './order'
import { addCookedPatty, addIngredient, cookLevelAt, createBurger, hasCore } from './recipe'
import type { Burger, CookLevel, Ingredient, OrderSpec, Station } from './types'
import type { Vec2 } from './vec2'
import type { CookWindows } from './types'

// ─────────────────────────── 手持 ───────────────────────────

/**
 * Raw patties from the fridge carry kind 'patty' too, with cook 'raw' —
 * one kind for meat everywhere, so the grill never has to special-case it.
 */
export type CarryKind = 'none' | 'ingredient' | 'patty' | 'plate'

export interface Carry {
  kind: CarryKind
  /** valid when kind === 'ingredient'; never 'patty' */
  ingredient: Ingredient
  /** valid when kind === 'patty' */
  cook: CookLevel
}

// ─────────────────────────── 烤炉 ───────────────────────────

export interface GrillSlot {
  busy: boolean
  /** seconds on the grill; feed to cookLevelAt */
  elapsed: number
}

// ─────────────────────────── 配置与状态 ───────────────────────────

export interface KitchenConfig {
  /** 由 StationView 组件从场景节点读出来，尺寸只有一个来源（m2-scene-guide §8） */
  stations: Station[]
  cook: CookWindows
  grillSlots: number
}

export interface KitchenState {
  t: number
  carry: Carry
  grill: GrillSlot[]
  /**
   * The one in-progress burger. Owned by the assembly bench when
   * assemblyOccupied, by the player when carry.kind === 'plate' —
   * the two are never both true. Pre-allocated, reset in place (铁律②).
   */
  burger: Burger
  assemblyOccupied: boolean
  cfg: KitchenConfig
}

export function createKitchen(cfg: KitchenConfig): KitchenState {
  const grill: GrillSlot[] = []
  for (let i = 0; i < cfg.grillSlots; i++) grill.push({ busy: false, elapsed: 0 })
  return {
    t: 0,
    carry: { kind: 'none', ingredient: 'bun', cook: 'raw' },
    grill,
    burger: createBurger(),
    assemblyOccupied: false,
    cfg,
  }
}

// ─────────────────────────── 每帧 ───────────────────────────

/**
 * ⚠ Burnt patties stay on the grill — sim.ts deletes them because its ideal
 * chef never lets that happen. A real player must walk over and bin it, and
 * M4 hangs the fire chain off that same stuck slot.
 */
export function stepKitchen(st: KitchenState, dt: number): void {
  st.t += dt
  for (let i = 0; i < st.grill.length; i++) {
    const slot = st.grill[i]!
    if (slot.busy) slot.elapsed += dt
  }
}

/** 烤位当前火候。UI 画进度条用；空位返回 'raw' */
export function grillCookLevel(st: KitchenState, slot: number): CookLevel {
  const g = st.grill[slot]
  if (!g || !g.busy) return 'raw'
  return cookLevelAt(g.elapsed, st.cfg.cook)
}

// ─────────────────────────── 工位查找 ───────────────────────────

/** 够得着的最近工位，用于「进入范围 → 提示」。都够不着返回 null */
export function stationInReach(st: KitchenState, pos: Vec2): Station | null {
  let best: Station | null = null
  let bestDist = Infinity
  const list = st.cfg.stations
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!
    if (!inTriggerRange(pos, s.pos, s.triggerRange)) continue
    const dx = pos.x - s.pos.x
    const dz = pos.z - s.pos.z
    const d = dx * dx + dz * dz
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  return best
}

// ─────────────────────────── 交互 ───────────────────────────

export type InteractKind =
  | 'take-ingredient'
  | 'place-patty'
  | 'take-patty'
  | 'add-to-burger'
  | 'pick-plate'
  | 'put-plate'
  | 'serve'
  | 'discard'
  | 'blocked'

export type BlockReason =
  | 'none'
  | 'out-of-range'
  | 'hands-full'
  | 'hands-empty'
  | 'grill-full'
  | 'grill-empty'
  | 'not-raw-patty'
  | 'duplicate-ingredient'
  | 'no-burger'
  | 'incomplete-burger'
  | 'no-order'
  | 'unsupported'

export interface InteractRequest {
  /** fridge: which ingredient to take */
  ingredient?: Ingredient
  /** grill: which slot; omit or -1 picks the one that has been on longest */
  slot?: number
  /** serve: the order to judge against */
  spec?: OrderSpec
}

export interface InteractResult {
  kind: InteractKind
  reason: BlockReason
  /** serve only */
  verdict: OrderVerdict | null
  /** grill only: which slot was used */
  slot: number
}

function blocked(reason: BlockReason): InteractResult {
  return { kind: 'blocked', reason, verdict: null, slot: -1 }
}

function done(kind: InteractKind, slot = -1, verdict: OrderVerdict | null = null): InteractResult {
  return { kind, reason: 'none', verdict, slot }
}

/**
 * 一个动作键的全部去处，按 station.kind 分派。
 *
 * 只在按键那一刻调用，不在每帧热路径上 —— 允许分配（与 order.judge 同）。
 */
export function interact(
  st: KitchenState,
  playerPos: Vec2,
  station: Station,
  req: InteractRequest = {},
): InteractResult {
  if (!inTriggerRange(playerPos, station.pos, station.triggerRange)) {
    return blocked('out-of-range')
  }

  switch (station.kind) {
    case 'fridge':
      return takeFromFridge(st, req.ingredient)
    case 'grill':
      return useGrill(st, req.slot ?? -1)
    case 'assembly':
      return useAssembly(st)
    case 'serve':
      return serveTo(st, req.spec)
    case 'sink':
      return blocked('unsupported')
    default:
      return blocked('unsupported')
  }
}

function takeFromFridge(st: KitchenState, ing: Ingredient | undefined): InteractResult {
  if (ing === undefined) return blocked('unsupported')
  if (st.carry.kind !== 'none') return blocked('hands-full')
  if (ing === 'patty') {
    st.carry.kind = 'patty'
    st.carry.cook = 'raw'
  } else {
    st.carry.kind = 'ingredient'
    st.carry.ingredient = ing
  }
  return done('take-ingredient')
}

function useGrill(st: KitchenState, want: number): InteractResult {
  // hands full with a raw patty → put it on
  if (st.carry.kind === 'patty') {
    if (st.carry.cook !== 'raw') return blocked('not-raw-patty')
    const free = firstFreeSlot(st)
    if (free < 0) return blocked('grill-full')
    st.grill[free]!.busy = true
    st.grill[free]!.elapsed = 0
    st.carry.kind = 'none'
    return done('place-patty', free)
  }

  if (st.carry.kind !== 'none') return blocked('hands-full')

  const slot = want >= 0 ? want : longestSlot(st)
  const g = st.grill[slot]
  if (!g || !g.busy) return blocked('grill-empty')
  st.carry.kind = 'patty'
  st.carry.cook = cookLevelAt(g.elapsed, st.cfg.cook)
  g.busy = false
  g.elapsed = 0
  return done('take-patty', slot)
}

function firstFreeSlot(st: KitchenState): number {
  for (let i = 0; i < st.grill.length; i++) if (!st.grill[i]!.busy) return i
  return -1
}

/** 烤最久的那块 —— 再等就过头，前面几步全白做（同 sim.ts 的取肉优先级） */
function longestSlot(st: KitchenState): number {
  let best = -1
  let bestElapsed = -1
  for (let i = 0; i < st.grill.length; i++) {
    const g = st.grill[i]!
    if (g.busy && g.elapsed > bestElapsed) {
      bestElapsed = g.elapsed
      best = i
    }
  }
  return best
}

function useAssembly(st: KitchenState): InteractResult {
  switch (st.carry.kind) {
    case 'none':
      if (!st.assemblyOccupied) return blocked('no-burger')
      st.assemblyOccupied = false
      st.carry.kind = 'plate'
      return done('pick-plate')

    case 'plate':
      st.assemblyOccupied = true
      st.carry.kind = 'none'
      return done('put-plate')

    case 'ingredient': {
      startBurgerIfEmpty(st)
      if (!addIngredient(st.burger, st.carry.ingredient)) {
        return blocked('duplicate-ingredient')
      }
      st.carry.kind = 'none'
      return done('add-to-burger')
    }

    case 'patty': {
      startBurgerIfEmpty(st)
      // raw and burnt go on too — the burger is buildable, judge() fails it later
      if (!addCookedPatty(st.burger, st.carry.cook)) {
        return blocked('duplicate-ingredient')
      }
      st.carry.kind = 'none'
      return done('add-to-burger')
    }

    default:
      return blocked('unsupported')
  }
}

function startBurgerIfEmpty(st: KitchenState): void {
  if (st.assemblyOccupied) return
  resetBurger(st.burger)
  st.assemblyOccupied = true
}

function serveTo(st: KitchenState, spec: OrderSpec | undefined): InteractResult {
  if (st.carry.kind !== 'plate') return blocked('hands-empty')
  if (spec === undefined) return blocked('no-order')
  if (!hasCore(st.burger)) return blocked('incomplete-burger')

  const verdict = judge(st.burger, spec)
  st.carry.kind = 'none'
  resetBurger(st.burger)
  return done('serve', -1, verdict)
}

/**
 * 丢掉手上的东西。烤糊的肉只有这一条出路 —— 触发方式（长按 / 垃圾桶工位）由 UI 定。
 */
export function discard(st: KitchenState): InteractResult {
  if (st.carry.kind === 'none') return blocked('hands-empty')
  if (st.carry.kind === 'plate') resetBurger(st.burger)
  st.carry.kind = 'none'
  return done('discard')
}

function resetBurger(b: Burger): void {
  b.ingredients.length = 0
  b.cook = null
}
