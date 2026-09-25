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
export type CarryKind = 'none' | 'ingredient' | 'patty' | 'plate' | 'crate' | 'stack' | 'fries' | 'extinguisher' | 'drink'

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
  /** That plate was rushed through the sink */
  stained: boolean
  /** kind === 'stack': clean plates carried from the rack to the shelf, and how many of them are stained */
  count: number
  countStained: number
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
  /** Spare clean plates in the storeroom, fetched as a stack — the way back after a crash. Omitted = none */
  sparePlates?: number
  wash?: WashConfig
  /** Plates per trip from the rack, and above how many the chef slows and can crash. Default STACK_MAX / STACK_SLOW */
  stackMax?: number
  stackSlow?: number
  /** Seconds a basket of fries takes. Omitted = no fryer (the station offers nothing) */
  fryerSec?: number
  /** Seconds the drink machine takes to fill a cup. Omitted = no machine (the station offers nothing) */
  drinkSec?: number
  /** A second patty may go on the burger (double orders). Omitted = one patty only, as the simulator plays */
  doublePatty?: boolean
  /** A burnt patty left on the grill this long sets it alight. Omitted = never (sim, tests); the extinguisher station offers nothing */
  fireSec?: number
}

/** ⏳ Self-chosen until tuned on device */
export const FRY_SEC = 5
/** ⏳ Self-chosen: a cup takes this long, and overflows if left this long once full */
export const DRINK_SEC = 3
export const DRINK_SPILL_SEC = 5

export interface DrinkMachine {
  stage: 'empty' | 'pouring' | 'ready' | 'spilled'
  /** Pouring: until full. Ready: until it overflows */
  left: number
}

/** ⏳ Self-chosen: a burnt patty ignored this long starts a fire */
export const FIRE_SEC = 6

/** Done fries left in the basket this long burn. ⏳ Self-chosen */
export const FRY_BURN_SEC = 8

export interface Fryer {
  stage: 'empty' | 'frying' | 'ready' | 'burnt'
  /** Frying: until done. Ready: until burnt */
  left: number
}

/** 洗碗三段（GDD §12.5）：泡是被动的、刷要按住、晾是被动的 */
export interface WashConfig {
  soakSec: number
  scrubSec: number
  drySec: number
  /** 堂食吃完多久把脏盘送回洗碗池 */
  returnSec: number
}

/** ⏳ Shortened 2026-09-25 (was soak 4 / scrub 2 / dry 6): the user found the wash loop too slow */
export const DEFAULT_WASH: WashConfig = { soakSec: 2.5, scrubSec: 1.5, drySec: 4, returnSec: 8 }

/** Letting go of the scrub past this point racks the batch stained; before it, progress just waits (GDD §12.5) */
export const STAIN_MIN = 0.5

/** Plates carried from the rack in one trip; more than STACK_SLOW slows the chef and can crash on a wall */
export const STACK_MAX = 5
export const STACK_SLOW = 3
export const STACK_SLOW_SPEED = 0.7
/**
 * Share of a step lost to a wall that counts as walking into it (movement.impact = 1 - cos of the approach angle).
 * 0.2 ≈ 37°. Not higher: under the 45° camera, pushing screen-up into a counter meets it at 45° (0.29) —
 * that reads as a head-on hit on screen, and 0.6 let it slide by every time.
 */
export const CRASH_IMPACT = 0.2

/**
 * 洗碗池只收一批、架子只晾一批 —— 两批同时洗会让「先洗还是先攒」这个取舍消失。
 * stage: 'empty' → 'soaking'（倒计时）→ 'soaked'（等人来刷）→ 刷完进架子
 */
export interface Sink {
  stage: 'empty' | 'soaking' | 'soaked'
  count: number
  left: number
  /** 刷洗进度 0–1。没过 STAIN_MIN 松手保留、回来接着刷；过了松手见 releaseScrub */
  scrub: number
}

export interface Rack {
  count: number
  left: number
  stained: boolean
  ready: number
  readyStained: number
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
  burgerStained: boolean
  /** Fridge units left, indexed like INGREDIENTS */
  stock: number[]
  /** 累计烤糊了几块（跨过 burntAt 那一刻记一次）。目击系统拿它当事件源 */
  burnt: number
  /** 放盘处的干净盘子（含带污渍的） */
  plates: number
  /** plates 里带污渍的几个。取肉时先用掉它们 —— 偷工的代价要马上看得见 */
  stained: number
  /** 摔碎的 */
  broken: number
  /** Spare plates still in the storeroom */
  spare: number
  /** 事件计数，目击系统按增量读（同 burnt） */
  crashed: number
  stainedServed: number
  /** 堆在洗碗池边的脏盘 */
  dirty: number
  /** 还在顾客桌上、送回洗碗池的倒计时，秒。预分配复用，<=0 为空位 */
  returning: number[]
  sink: Sink
  /** 架子上晾着的一批（count/left/stained），晾好的（ready）等人搬去放盘处 */
  rack: Rack
  fryer: Fryer
  /** Baskets of fries burnt, read by increment like `burnt` */
  burntFries: number
  drinks: DrinkMachine
  /** Cups overflowed, read by increment */
  spills: number
  /** Grill on fire: unusable until put out with the extinguisher, which also clears every slot */
  fire: boolean
  /** Fires started, read by increment */
  fires: number
  cfg: KitchenConfig
}

export function createKitchen(cfg: KitchenConfig): KitchenState {
  const grill: GrillSlot[] = []
  for (let i = 0; i < cfg.grillSlots; i++) grill.push({ busy: false, elapsed: 0 })
  return {
    t: 0,
    carry: { kind: 'none', ingredient: 'bun', second: null, cook: 'raw', plated: false, stained: false, count: 0, countStained: 0 },
    grill,
    burger: createBurger(),
    assemblyOccupied: false,
    burgerPlated: false,
    burgerStained: false,
    stock: INGREDIENTS.map(() => cfg.fridgeCap ?? Infinity),
    burnt: 0,
    plates: cfg.plates ?? Infinity,
    stained: 0,
    broken: 0,
    spare: cfg.sparePlates ?? 0,
    crashed: 0,
    stainedServed: 0,
    dirty: 0,
    returning: [],
    sink: { stage: 'empty', count: 0, left: 0, scrub: 0 },
    rack: { count: 0, left: 0, stained: false, ready: 0, readyStained: 0 },
    fryer: { stage: 'empty', left: 0 },
    drinks: { stage: 'empty', left: 0 },
    spills: 0,
    burntFries: 0,
    fire: false,
    fires: 0,
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
    const fireAt = st.cfg.fireSec === undefined ? Infinity : st.cfg.cook.burntAt + st.cfg.fireSec
    if (!st.fire && slot.elapsed >= fireAt) {
      st.fire = true
      st.fires++
    }
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
  const fry = st.fryer
  if (fry.stage === 'frying') {
    fry.left -= dt
    if (fry.left <= 0) {
      fry.stage = 'ready'
      fry.left = FRY_BURN_SEC
    }
  } else if (fry.stage === 'ready') {
    fry.left -= dt
    if (fry.left <= 0) {
      fry.stage = 'burnt'
      st.burntFries++
    }
  }
  const dr = st.drinks
  if (dr.stage === 'pouring') {
    dr.left -= dt
    if (dr.left <= 0) {
      dr.stage = 'ready'
      dr.left = DRINK_SPILL_SEC
    }
  } else if (dr.stage === 'ready') {
    dr.left -= dt
    if (dr.left <= 0) {
      dr.stage = 'spilled'
      st.spills++
    }
  }
  const rack = st.rack
  if (rack.count > 0) {
    rack.left -= dt
    if (rack.left <= 0) {
      rack.ready += rack.count
      if (rack.stained) rack.readyStained += rack.count
      rack.count = 0
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
    if (!offers(st, s) || !inTriggerRange(pos, s.pos, s.triggerRange)) continue
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

/**
 * 晾碗架和放盘处紧挨着洗碗池、组装台，没事可做时不能抢走旁边工位的「最近」——
 * 否则站在洗碗池右半边按住刷，刷的其实是架子。
 */
function offers(st: KitchenState, s: Station): boolean {
  if (s.kind === 'shelf') return st.carry.kind === 'stack'
  if (s.kind === 'fryer') return st.cfg.fryerSec !== undefined
  if (s.kind === 'extinguisher') return st.cfg.fireSec !== undefined
  if (s.kind === 'drinks') return st.cfg.drinkSec !== undefined
  if (s.kind === 'rack') return st.rack.ready > 0 && (st.carry.kind === 'none' || st.carry.kind === 'stack')
  return true
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
  | 'take-stack'
  | 'shelve'
  | 'fry'
  | 'take-fries'
  | 'serve-fries'
  | 'dump-fries'
  | 'take-extinguisher'
  | 'return-extinguisher'
  | 'extinguish'
  | 'pour'
  | 'take-drink'
  | 'serve-drink'
  | 'wipe-spill'
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
  | 'rack-empty'
  | 'stack-full'
  | 'still-frying'
  | 'still-pouring'
  | 'on-fire'
  | 'no-fire'
  | 'unsupported'

export interface InteractRequest {
  /** fridge / storeroom: which ingredient to take */
  ingredient?: Ingredient
  /** grill: which slot; omit or -1 picks the one that has been on longest */
  slot?: number
  /** serve: the order to judge against */
  spec?: OrderSpec
  /** storeroom: take spare plates instead of a crate */
  plates?: boolean
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
      return req.plates ? takeFromRack(st, true) : takeCrate(st, req.ingredient)
    case 'sink':
      return loadSink(st)
    case 'rack':
      return takeFromRack(st)
    case 'shelf':
      return putOnShelf(st)
    case 'fryer':
      return useFryer(st)
    case 'extinguisher':
      return useExtinguisher(st)
    case 'drinks':
      return useDrinks(st)
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
  if (c.kind === 'plate' || c.kind === 'stack' || c.plated) return blocked('hands-full')
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
  if (st.carry.kind === 'extinguisher') {
    if (!st.fire) return blocked('no-fire')
    st.fire = false
    for (const g of st.grill) {
      g.busy = false
      g.elapsed = 0
    }
    st.carry.kind = 'none'
    return done('extinguish')
  }
  if (st.fire) return blocked('on-fire')
  // hands full with a raw patty → put it on
  if (st.carry.kind === 'patty') {
    if (st.carry.cook !== 'raw') return blocked('not-raw-patty')
    const free = firstFreeSlot(st)
    if (free < 0) return blocked('grill-full')
    st.grill[free]!.busy = true
    st.grill[free]!.elapsed = 0
    st.carry.kind = 'none'
    if (st.carry.plated) returnPlate(st, st.carry.stained)
    st.carry.plated = false
    st.carry.stained = false
    return done('place-patty', free)
  }

  if (st.carry.kind !== 'none') return blocked('hands-full')

  const slot = want >= 0 ? want : longestSlot(st)
  const g = st.grill[slot]
  if (!g || !g.busy) return blocked('grill-empty')
  if (st.plates <= 0) return blocked('no-plate')
  st.plates--
  st.carry.stained = st.stained > 0
  if (st.carry.stained) st.stained--
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
      const second = st.burger.ingredients.includes('patty')
      // raw and burnt go on too — the burger is buildable, judge() fails it later
      if (!addCookedPatty(st.burger, st.carry.cook, st.cfg.doublePatty === true)) {
        return blocked('duplicate-ingredient')
      }
      // The burger already sits on the first patty's plate; the second one's plate goes back to the shelf
      if (second) {
        if (st.carry.plated) returnPlate(st, st.carry.stained)
      } else {
        st.burgerPlated = st.carry.plated
        st.burgerStained = st.carry.stained
      }
      st.carry.plated = false
      st.carry.stained = false
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
  st.burgerStained = false
  st.assemblyOccupied = true
}

function returnPlate(st: KitchenState, stained: boolean): void {
  st.plates++
  if (stained) st.stained++
}

/** Empty-handed: drop a basket in, lift out the one that is done, or tip out a burnt one */
function useFryer(st: KitchenState): InteractResult {
  if (st.cfg.fryerSec === undefined) return blocked('unsupported')
  if (st.carry.kind !== 'none') return blocked('hands-full')
  const f = st.fryer
  if (f.stage === 'frying') return blocked('still-frying')
  if (f.stage === 'burnt') {
    f.stage = 'empty'
    return done('dump-fries')
  }
  if (f.stage === 'ready') {
    f.stage = 'empty'
    st.carry.kind = 'fries'
    return done('take-fries')
  }
  f.stage = 'frying'
  f.left = st.cfg.fryerSec
  return done('fry')
}

/** Empty-handed: start a cup, take the full one, or wipe up an overflowed one */
function useDrinks(st: KitchenState): InteractResult {
  if (st.cfg.drinkSec === undefined) return blocked('unsupported')
  if (st.carry.kind !== 'none') return blocked('hands-full')
  const d = st.drinks
  if (d.stage === 'pouring') return blocked('still-pouring')
  if (d.stage === 'spilled') {
    d.stage = 'empty'
    return done('wipe-spill')
  }
  if (d.stage === 'ready') {
    d.stage = 'empty'
    st.carry.kind = 'drink'
    return done('take-drink')
  }
  d.stage = 'pouring'
  d.left = st.cfg.drinkSec
  return done('pour')
}

/** Empty-handed: take it off the wall; holding it: hang it back */
function useExtinguisher(st: KitchenState): InteractResult {
  if (st.cfg.fireSec === undefined) return blocked('unsupported')
  if (st.carry.kind === 'extinguisher') {
    st.carry.kind = 'none'
    return done('return-extinguisher')
  }
  if (st.carry.kind !== 'none') return blocked('hands-full')
  st.carry.kind = 'extinguisher'
  return done('take-extinguisher')
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
  if (sink.scrub >= 1 && st.rack.count === 0) toRack(st, false)
  return true
}

/**
 * 刷到一半松手：过了 STAIN_MIN 这批就带着污渍上架（偷工换时间，GDD §12.5）；
 * 没过就当没刷完，进度留着回来接着刷。架子还有一批在晾时放不上去，同样留着。返回是不是偷工上架了。
 */
export function releaseScrub(st: KitchenState): boolean {
  const sink = st.sink
  if (sink.stage !== 'soaked' || sink.scrub < STAIN_MIN || sink.scrub >= 1 || st.rack.count > 0) return false
  toRack(st, true)
  return true
}

function toRack(st: KitchenState, stained: boolean): void {
  const sink = st.sink
  st.rack.count = sink.count
  st.rack.left = (st.cfg.wash ?? DEFAULT_WASH).drySec
  st.rack.stained = stained
  sink.stage = 'empty'
  sink.count = 0
  sink.scrub = 0
}

/** 空手或手上的摞还没满：从架子上把晾好的拿走。带污渍的先拿。`spare` = from the storeroom's spares instead (never stained) */
function takeFromRack(st: KitchenState, spare = false): InteractResult {
  const c = st.carry
  if (c.kind !== 'none' && c.kind !== 'stack') return blocked('hands-full')
  const have = c.kind === 'stack' ? c.count : 0
  const max = st.cfg.stackMax ?? STACK_MAX
  if (have >= max) return blocked('stack-full')
  const rack = st.rack
  const avail = spare ? st.spare : rack.ready
  if (avail <= 0) return blocked(spare ? 'out-of-stock' : 'rack-empty')
  const n = Math.min(avail, max - have)
  const ns = spare ? 0 : Math.min(rack.readyStained, n)
  if (spare) st.spare -= n
  else {
    rack.ready -= n
    rack.readyStained -= ns
  }
  c.kind = 'stack'
  c.count = have + n
  c.countStained = (have > 0 ? c.countStained : 0) + ns
  return done('take-stack')
}

function putOnShelf(st: KitchenState): InteractResult {
  const c = st.carry
  if (c.kind !== 'stack') return blocked(c.kind === 'none' ? 'hands-empty' : 'hands-full')
  st.plates += c.count
  st.stained += c.countStained
  c.kind = 'none'
  c.count = 0
  c.countStained = 0
  return done('shelve')
}

/** 端着超过 STACK_SLOW 个盘子走得慢 */
export function carrySpeedFactor(st: KitchenState): number {
  return st.carry.kind === 'stack' && st.carry.count > (st.cfg.stackSlow ?? STACK_SLOW) ? STACK_SLOW_SPEED : 1
}

/**
 * 这一帧撞上了东西（`impact` 取 movement.impact）。端着的摞超过 STACK_SLOW 个、且是迎面撞上
 * 而不是蹭着墙走，就全摔了。返回摔了几个。
 */
export function bumpStack(st: KitchenState, impact: number): number {
  const c = st.carry
  if (c.kind !== 'stack' || c.count <= (st.cfg.stackSlow ?? STACK_SLOW) || impact < CRASH_IMPACT) return 0
  const n = c.count
  st.broken += n
  st.crashed++
  c.kind = 'none'
  c.count = 0
  c.countStained = 0
  return n
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
  if (st.carry.kind === 'fries') {
    // Deliveries never order fries, so the rider's spec never asks for them either
    if (!spec?.fries) return blocked('no-order')
    st.carry.kind = 'none'
    return done('serve-fries')
  }
  if (st.carry.kind === 'drink') {
    if (!spec?.drink) return blocked('no-order')
    st.carry.kind = 'none'
    return done('serve-drink')
  }
  if (st.carry.kind !== 'plate') return blocked('hands-empty')
  if (spec === undefined) return blocked('no-order')
  if (!hasCore(st.burger)) return blocked('incomplete-burger')

  const verdict = judge(st.burger, spec)
  st.carry.kind = 'none'
  resetBurger(st.burger)
  if (st.burgerPlated) {
    plateOut(st, dineIn)
    if (st.burgerStained && dineIn) st.stainedServed++
  }
  st.burgerPlated = false
  st.burgerStained = false
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
  st.carry.stained = false
  st.carry.count = 0
  st.carry.countStained = 0
  for (const g of st.grill) {
    g.busy = false
    g.elapsed = 0
  }
  resetBurger(st.burger)
  st.assemblyOccupied = false
  st.burgerPlated = false
  st.burgerStained = false
  st.stock.fill(st.cfg.fridgeCap ?? Infinity)
  st.burnt = 0
  st.plates = st.cfg.plates ?? Infinity
  st.stained = 0
  st.broken = 0
  st.spare = st.cfg.sparePlates ?? 0
  st.crashed = 0
  st.stainedServed = 0
  st.dirty = 0
  st.returning.fill(0)
  st.sink.stage = 'empty'
  st.sink.count = 0
  st.sink.left = 0
  st.sink.scrub = 0
  st.rack.count = 0
  st.rack.left = 0
  st.rack.stained = false
  st.rack.ready = 0
  st.rack.readyStained = 0
  st.fryer.stage = 'empty'
  st.fryer.left = 0
  st.burntFries = 0
  st.fire = false
  st.fires = 0
  st.drinks.stage = 'empty'
  st.drinks.left = 0
  st.spills = 0
}

export function discard(st: KitchenState): InteractResult {
  if (st.carry.kind === 'none') return blocked('hands-empty')
  // The food goes in the bin, the plate goes to the sink — clean ones too, they have been dropped
  if (st.carry.kind === 'stack') st.dirty += st.carry.count
  const plated = st.carry.kind === 'plate' ? st.burgerPlated : st.carry.plated
  if (plated && st.plates !== Infinity) st.dirty++
  if (st.carry.kind === 'plate') {
    resetBurger(st.burger)
    st.burgerPlated = false
    st.burgerStained = false
  }
  st.carry.plated = false
  st.carry.stained = false
  st.carry.count = 0
  st.carry.countStained = 0
  st.carry.second = null
  st.carry.kind = 'none'
  return done('discard')
}

function resetBurger(b: Burger): void {
  b.ingredients.length = 0
  b.cook = null
  b.double = false
  b.cook2 = null
}
