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
import { INGREDIENTS } from './types'
import type { Burger, CookLevel, Ingredient, OrderSpec, Station } from './types'
import type { Vec2 } from './vec2'
import type { CookWindows } from './types'

// ─────────────────────────── 手持 ───────────────────────────

/**
 * Raw patties from the fridge carry kind 'patty' too, with cook 'raw' —
 * one kind for meat everywhere, so the grill never has to special-case it.
 */
export type CarryKind = 'none' | 'ingredient' | 'patty' | 'plate' | 'crate'

export interface Carry {
  kind: CarryKind
  /** valid when kind === 'ingredient' (never 'patty') or 'crate' (any) */
  ingredient: Ingredient
  /** kind === 'ingredient' only: a second, different topping carried in the same trip */
  second: Ingredient | null
  /** valid when kind === 'patty' */
  cook: CookLevel
  /** A patty taken off the grill sits on a clean plate */
  plated: boolean
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
  /** Fridge units per ingredient; a crate from the storeroom refills one slot to this. Omitted = bottomless */
  fridgeCap?: number
  /** Clean plates at the start. Omitted = bottomless (the simulator never washes up) */
  plates?: number
  wash?: WashConfig
}

/** 洗碗三段（GDD §12.5）：泡是被动的、刷要按住、晾是被动的 */
export interface WashConfig {
  soakSec: number
  scrubSec: number
  drySec: number
  /** 堂食吃完多久把脏盘送回洗碗池 */
  returnSec: number
}

export const DEFAULT_WASH: WashConfig = { soakSec: 4, scrubSec: 2, drySec: 6, returnSec: 8 }

/**
 * 洗碗池只收一批、架子只晾一批 —— 两批同时洗会让「先洗还是先攒」这个取舍消失。
 * stage: 'empty' → 'soaking'（倒计时）→ 'soaked'（等人来刷）→ 刷完进架子
 */
export interface Sink {
  stage: 'empty' | 'soaking' | 'soaked'
  count: number
  left: number
  /** 刷洗进度 0–1；松手保留，回来接着刷 */
  scrub: number
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
  /** The bench burger's patty came with a plate (a raw fridge patty dropped straight on does not) */
  burgerPlated: boolean
  /** Fridge units left, indexed like INGREDIENTS */
  stock: number[]
  /** 累计烤糊了几块（跨过 burntAt 那一刻记一次）。目击系统拿它当事件源 */
  burnt: number
  /** 放盘处的干净盘子 */
  plates: number
  /** 堆在洗碗池边的脏盘 */
  dirty: number
  /** 还在顾客桌上、送回洗碗池的倒计时，秒。预分配复用，<=0 为空位 */
  returning: number[]
  sink: Sink
  /** 架子上晾着的一批 */
  rack: { count: number; left: number }
  cfg: KitchenConfig
}

export function createKitchen(cfg: KitchenConfig): KitchenState {
  const grill: GrillSlot[] = []
  for (let i = 0; i < cfg.grillSlots; i++) grill.push({ busy: false, elapsed: 0 })
  return {
    t: 0,
    carry: { kind: 'none', ingredient: 'bun', second: null, cook: 'raw', plated: false },
    grill,
    burger: createBurger(),
    assemblyOccupied: false,
    burgerPlated: false,
    stock: INGREDIENTS.map(() => cfg.fridgeCap ?? Infinity),
    burnt: 0,
    plates: cfg.plates ?? Infinity,
    dirty: 0,
    returning: [],
    sink: { stage: 'empty', count: 0, left: 0, scrub: 0 },
    rack: { count: 0, left: 0 },
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
    if (!slot.busy) continue
    const before = slot.elapsed
    slot.elapsed += dt
    if (before < st.cfg.cook.burntAt && slot.elapsed >= st.cfg.cook.burntAt) st.burnt++
  }
  for (let i = 0; i < st.returning.length; i++) {
    if (st.returning[i]! <= 0) continue
    st.returning[i]! -= dt
    if (st.returning[i]! <= 0) st.dirty++
  }
  const sink = st.sink
  if (sink.stage === 'soaking') {
    sink.left -= dt
    if (sink.left <= 0) sink.stage = 'soaked'
  }
  if (st.rack.count > 0) {
    st.rack.left -= dt
    if (st.rack.left <= 0) {
      st.plates += st.rack.count
      st.rack.count = 0
    }
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
  | 'take-crate'
  | 'restock'
  | 'soak'
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
  | 'out-of-stock'
  | 'stock-full'
  | 'no-plate'
  | 'nothing-to-wash'
  | 'sink-busy'
  | 'still-soaking'
  | 'unsupported'

export interface InteractRequest {
  /** fridge / storeroom: which ingredient to take */
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
    case 'delivery':
      // Same hand-off; who it's for (diner or rider) is decided by the caller's spec
      return serveTo(st, req.spec, station.kind === 'serve')
    case 'storeroom':
      return takeCrate(st, req.ingredient)
    case 'sink':
      return loadSink(st)
    default:
      return blocked('unsupported')
  }
}

/**
 * 从冰箱取料。手上最多两样**不同**的配料；肉饼只能单独拿（它得先下锅）。
 * 拿满两样再点第三样 = 换掉后拿的那样；点肉饼 = 手上的全退回。
 * 点错不该逼玩家先跑一趟垃圾桶 —— 那趟路在 30 秒一局里是实打实的惩罚，而错因只是眼花。
 *
 * 盘子是唯一的例外：那是组装好的汉堡，换食材等于整个扔掉，
 * 代价和「拿错一片生菜」完全不是一回事，要丢得走 discard，让玩家自己按那一下。
 */
function takeFromFridge(st: KitchenState, ing: Ingredient | undefined): InteractResult {
  if (st.carry.kind === 'crate') return restock(st)
  if (ing === undefined) return blocked('unsupported')
  const c = st.carry
  if (c.kind === 'plate' || c.plated) return blocked('hands-full')
  if (c.kind === 'ingredient' && (ing === c.ingredient || ing === c.second)) return blocked('duplicate-ingredient')
  const i = INGREDIENTS.indexOf(ing)
  if (st.stock[i]! <= 0) return blocked('out-of-stock')
  st.stock[i]!--
  if (ing !== 'patty' && c.kind === 'ingredient') {
    if (c.second !== null) giveBack(st, c.second)
    c.second = ing
    return done('take-ingredient')
  }
  // Swapping hands the old pick back — a mis-tap must not cost stock either
  if (c.kind === 'ingredient') {
    giveBack(st, c.ingredient)
    if (c.second !== null) giveBack(st, c.second)
  } else if (c.kind === 'patty' && c.cook === 'raw') giveBack(st, 'patty')
  c.second = null
  if (ing === 'patty') {
    c.kind = 'patty'
    c.cook = 'raw'
  } else {
    c.kind = 'ingredient'
    c.ingredient = ing
  }
  return done('take-ingredient')
}

function giveBack(st: KitchenState, ing: Ingredient): void {
  const i = INGREDIENTS.indexOf(ing)
  st.stock[i] = Math.min(st.stock[i]! + 1, st.cfg.fridgeCap ?? Infinity)
}

function takeCrate(st: KitchenState, ing: Ingredient | undefined): InteractResult {
  if (ing === undefined) return blocked('unsupported')
  if (st.carry.kind !== 'none') return blocked('hands-full')
  st.carry.kind = 'crate'
  st.carry.ingredient = ing
  return done('take-crate')
}

/** Refused when already full, so the crate stays in hand instead of vanishing */
function restock(st: KitchenState): InteractResult {
  const i = INGREDIENTS.indexOf(st.carry.ingredient)
  const cap = st.cfg.fridgeCap ?? Infinity
  if (st.stock[i]! >= cap) return blocked('stock-full')
  st.stock[i] = cap
  st.carry.kind = 'none'
  return done('restock')
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
    if (st.carry.plated) st.plates++
    st.carry.plated = false
    return done('place-patty', free)
  }

  if (st.carry.kind !== 'none') return blocked('hands-full')

  const slot = want >= 0 ? want : longestSlot(st)
  const g = st.grill[slot]
  if (!g || !g.busy) return blocked('grill-empty')
  if (st.plates <= 0) return blocked('no-plate')
  st.plates--
  st.carry.plated = true
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
      const c = st.carry
      const a = addIngredient(st.burger, c.ingredient)
      const b = c.second !== null && addIngredient(st.burger, c.second)
      if (!a && !b) return blocked('duplicate-ingredient')
      // Whatever the burger already had stays in hand
      if (c.second === null || (a && b)) c.kind = 'none'
      else if (a) c.ingredient = c.second
      c.second = null
      return done('add-to-burger')
    }

    case 'patty': {
      startBurgerIfEmpty(st)
      // raw and burnt go on too — the burger is buildable, judge() fails it later
      if (!addCookedPatty(st.burger, st.carry.cook)) {
        return blocked('duplicate-ingredient')
      }
      st.burgerPlated = st.carry.plated
      st.carry.plated = false
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
  st.burgerPlated = false
  st.assemblyOccupied = true
}

/** 空手点洗碗池：把池边的脏盘全部泡进去 */
function loadSink(st: KitchenState): InteractResult {
  if (st.carry.kind !== 'none') return blocked('hands-full')
  const sink = st.sink
  if (sink.stage === 'soaking') return blocked('still-soaking')
  if (sink.stage === 'soaked') return blocked('sink-busy')
  if (st.dirty <= 0) return blocked('nothing-to-wash')
  sink.stage = 'soaking'
  sink.count = st.dirty
  sink.left = st.cfg.wash?.soakSec ?? DEFAULT_WASH.soakSec
  sink.scrub = 0
  st.dirty = 0
  return done('soak')
}

/**
 * 按住动作键刷一帧。泡好了才能刷，刷满进架子晾（架子上那批没晾完就刷不完 —— 放不下）。
 * 返回这一帧有没有在刷，组件拿它播动画。
 */
export function scrubSink(st: KitchenState, dt: number): boolean {
  const sink = st.sink
  if (sink.stage !== 'soaked' || st.carry.kind !== 'none') return false
  const w = st.cfg.wash ?? DEFAULT_WASH
  sink.scrub = Math.min(1, sink.scrub + dt / w.scrubSec)
  if (sink.scrub < 1 || st.rack.count > 0) return true
  st.rack.count = sink.count
  st.rack.left = w.drySec
  sink.stage = 'empty'
  sink.count = 0
  sink.scrub = 0
  return true
}

/**
 * 堂食上完菜：盘子在顾客手上，过一会儿脏着送回池边。外卖装袋带走，盘子当场回到放盘处。
 * 盘子无上限（模拟器）时什么都不做。
 */
export function plateOut(st: KitchenState, dineIn: boolean): void {
  if (st.plates === Infinity) return
  if (!dineIn) {
    st.plates++
    return
  }
  const sec = st.cfg.wash?.returnSec ?? DEFAULT_WASH.returnSec
  const i = st.returning.findIndex((x) => x <= 0)
  if (i >= 0) st.returning[i] = sec
  else st.returning.push(sec)
}

function serveTo(st: KitchenState, spec: OrderSpec | undefined, dineIn: boolean): InteractResult {
  if (st.carry.kind !== 'plate') return blocked('hands-empty')
  if (spec === undefined) return blocked('no-order')
  if (!hasCore(st.burger)) return blocked('incomplete-burger')

  const verdict = judge(st.burger, spec)
  st.carry.kind = 'none'
  resetBurger(st.burger)
  if (st.burgerPlated) plateOut(st, dineIn)
  st.burgerPlated = false
  return done('serve', -1, verdict)
}

/**
 * 丢掉手上的东西。烤糊的肉只有这一条出路 —— 触发方式（长按 / 垃圾桶工位）由 UI 定。
 */
/**
 * 重开一局：清空手上、组装台与全部烤位。
 *
 * 不重建对象，原地清 —— 结算面板上按「再来一局」是高频操作，
 * 每次重建 KitchenState 等于每局丢一批垃圾给 GC（铁律②）。
 */
export function resetKitchen(st: KitchenState): void {
  st.t = 0
  st.carry.kind = 'none'
  st.carry.ingredient = 'bun'
  st.carry.second = null
  st.carry.cook = 'raw'
  st.carry.plated = false
  for (const g of st.grill) {
    g.busy = false
    g.elapsed = 0
  }
  resetBurger(st.burger)
  st.assemblyOccupied = false
  st.burgerPlated = false
  st.stock.fill(st.cfg.fridgeCap ?? Infinity)
  st.burnt = 0
  st.plates = st.cfg.plates ?? Infinity
  st.dirty = 0
  st.returning.fill(0)
  st.sink.stage = 'empty'
  st.sink.count = 0
  st.sink.left = 0
  st.sink.scrub = 0
  st.rack.count = 0
  st.rack.left = 0
}

export function discard(st: KitchenState): InteractResult {
  if (st.carry.kind === 'none') return blocked('hands-empty')
  // The food goes in the bin, the plate goes to the sink
  const plated = st.carry.kind === 'plate' ? st.burgerPlated : st.carry.plated
  if (plated && st.plates !== Infinity) st.dirty++
  if (st.carry.kind === 'plate') {
    resetBurger(st.burger)
    st.burgerPlated = false
  }
  st.carry.plated = false
  st.carry.second = null
  st.carry.kind = 'none'
  return done('discard')
}

function resetBurger(b: Burger): void {
  b.ingredients.length = 0
  b.cook = null
}
