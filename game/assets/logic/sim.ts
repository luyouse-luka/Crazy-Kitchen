/**
 * 无头模拟器 —— M1 的全部内容。不开引擎、不碰美术，纯 Node 跑完整一局。
 *
 * **为什么值得单开一个阶段**：核心卖点「手忙脚乱」的本质是一道时间预算题
 *
 *     顾客耐心(s)  vs  完成一单所需操作时间(s) × 同时在场订单数
 *
 * 它跟画面、模型、动画一点关系都没有。在 Cocos 里改一个数要「改码→编译→启动→手玩一局」
 * 约 2 分钟，一晚上试十几组；在这里几毫秒，一秒钟上千局。而且**能算出理想玩家的上限**
 * —— 手玩算不出，因为你的手速是变量。
 *
 * ## 理想玩家的定义
 *
 * 走位零失误（直线、不撞墙）、按键零延迟、永远先处理最紧急的那一单、**不齐不上菜**。
 * 所以 `wrong` 恒为 0，差评率纯粹反映时间预算 —— 真人一定比它差，
 * **压力就是从这个差里来的**（M3 会把这个差值量化出来）。
 *
 * 它仍是保守近似：不预判（肉快好了不会提前往烤炉走）、不做全局最优调度。
 * 所以它给出的是难度上限的**下界** —— 真实上限只会更高，不会更低。
 *
 * ## 建模上的四个简化（都会影响数值，写在这里免得将来当成 bug 查）
 *
 * 1. 打烊是硬边界：到 `durationSec` 立即停，在场没做完的单一律记超时
 * 2. 肉不绑定订单：烤好后给「需要这个火候且还缺肉」的最紧急那一单，谁烤的不算数
 * 3. 火候烤过头没有垃圾桶：肉到 `burnt` 档直接从槽位消失，只记一笔 `burnt`（V1 没有垃圾桶工位）
 * 4. 顾客满员时新客在门外等，不算流失 —— `maxConcurrent` 是「同时在场上限」不是「流失阈值」
 */
import { chance, createRng, nextInt, reseed } from './rng'
import { addCookedPatty, addIngredient, cookLevelAt } from './recipe'
import { judge } from './order'
import { DONENESS } from './types'
import type { Burger, CookWindows, Doneness, Ingredient, OrderSpec, StationKind } from './types'
import type { Rng } from './rng'
import type { Vec2 } from './vec2'
import { dist } from './vec2'

// ─────────────────────────── 配置 ───────────────────────────

export interface KitchenLayout {
  fridge: Vec2
  grill: Vec2
  assembly: Vec2
  serve: Vec2
  /** 整体缩放工位间距。1 = 基准布局。这是 M3「工位间距离」那个旋钮 */
  spread: number
}

export interface ChefParams {
  /** 米/秒 */
  speed: number
  /** 每次拿/放/上菜的耗时，秒 */
  interactSec: number
}

export interface FlowParams {
  /** 客流间隔（秒） */
  intervalSec: number
  /** 间隔抖动比例，0 = 完全均匀 */
  intervalJitter: number
  /** 同时在场上限 */
  maxConcurrent: number
  /** 顾客耐心（秒） */
  patienceSec: number
}

export interface OrderDifficulty {
  /** 除 bun+patty 外额外要的食材数量下限 */
  extraMin: number
  extraMax: number
  /** 出现 banned 食材的概率 */
  bannedChance: number
}

export interface SimConfig {
  seed: number
  /** 局长。一天 = 一关，3–4 分钟 */
  durationSec: number
  layout: KitchenLayout
  chef: ChefParams
  cook: CookWindows
  grillSlots: number
  flow: FlowParams
  orders: OrderDifficulty
  /** 打开后记录文本时间线（会分配，只在调试时开） */
  trace?: boolean
}

export interface DayResult {
  arrived: number
  served: number
  /** 上错菜。理想玩家恒为 0 */
  wrong: number
  timedOut: number
  completionRate: number
  badReviewRate: number
  peakConcurrent: number
  /** 肉烤糊次数 —— 「崩」的先行指标，它先于完成率下降 */
  burnt: number
  /** 玩家空闲总秒数。归零 = 压力饱和 */
  idleSec: number
  trace: string[]
}

/**
 * 基准参数。**这些数字是 M1 要标定的对象，不是结论** ——
 * 布局取 8m×6m 厨房（ROADMAP §2.2 的粗算用的也是这个尺寸）。
 */
export function defaultSimConfig(): SimConfig {
  return {
    seed: 1,
    durationSec: 210,
    layout: {
      fridge: { x: -3, z: 2 },
      grill: { x: 0, z: 2 },
      assembly: { x: 3, z: 2 },
      serve: { x: 3, z: -2 },
      spread: 1,
    },
    chef: { speed: 4, interactSec: 0.4 },
    cook: { rareAt: 3, mediumAt: 6, wellAt: 9, burntAt: 13 },
    grillSlots: 2,
    flow: { intervalSec: 12, intervalJitter: 0, maxConcurrent: 6, patienceSec: 45 },
    orders: { extraMin: 0, extraMax: 2, bannedChance: 0.3 },
  }
}

// ─────────────────────────── 内部状态 ───────────────────────────

const FRIDGE = 0
const GRILL = 1
const ASSEMBLY = 2
const SERVE = 3

/** 除骨架外的可选配料。rollOrder 从这里挑 required 的额外项与 banned。 */
const OPTIONAL: readonly Ingredient[] = ['cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon']

type Carry = 'none' | 'ingredient' | 'raw_patty' | 'cooked_patty' | 'plate'
type Phase = 'idle' | 'moving' | 'acting'
type Action =
  | 'none'
  | 'pick_ingredient'
  | 'pick_patty'
  | 'put_grill'
  | 'take_grill'
  | 'place_assembly'
  | 'take_plate'
  | 'serve'

interface CustomerSlot {
  active: boolean
  id: number
  patienceLeft: number
  spec: OrderSpec
  burger: Burger
}

interface GrillSlotState {
  busy: boolean
  elapsed: number
  /**
   * 这块肉是为哪一单放上去的（顾客槽位索引，-1 = 无主）。
   *
   * 只用来防止给同一单重复放肉 —— **取肉时不认这个字段**：谁烤的不算数，
   * 烤好了就给「需要这个火候且还缺肉」的最紧急那一单。顾客走了肉也不作废，
   * 只是变成无主，仍可给别人。
   */
  reservedFor: number
}

export interface SimState {
  t: number
  done: boolean
  result: DayResult
  reset(config: SimConfig): void
}

interface InternalState extends SimState {
  cfg: SimConfig
  rng: Rng
  distance: number[]
  customers: CustomerSlot[]
  grill: GrillSlotState[]
  nextArrivalAt: number
  nextId: number
  activeCount: number
  // 厨师
  at: number
  phase: Phase
  phaseLeft: number
  carry: Carry
  carryIng: Ingredient
  carryCook: Doneness
  carryCustomer: number
  action: Action
  actionCustomer: number
  actionIng: Ingredient
  actionGrill: number
  // rollOrder 用的洗牌池，复用避免每单分配
  pool: Ingredient[]
}

function stationVec(layout: KitchenLayout, i: number): Vec2 {
  return i === FRIDGE
    ? layout.fridge
    : i === GRILL
      ? layout.grill
      : i === ASSEMBLY
        ? layout.assembly
        : layout.serve
}

export function createSimState(config: SimConfig): SimState {
  const st: InternalState = {
    t: 0,
    done: false,
    cfg: config,
    rng: createRng(config.seed),
    distance: new Array<number>(16).fill(0),
    customers: [],
    grill: [],
    nextArrivalAt: 0,
    nextId: 1,
    activeCount: 0,
    at: ASSEMBLY,
    phase: 'idle',
    phaseLeft: 0,
    carry: 'none',
    carryIng: 'bun',
    carryCook: 'medium',
    carryCustomer: -1,
    action: 'none',
    actionCustomer: -1,
    actionIng: 'bun',
    actionGrill: -1,
    pool: OPTIONAL.slice(),
    result: {
      arrived: 0,
      served: 0,
      wrong: 0,
      timedOut: 0,
      completionRate: 0,
      badReviewRate: 0,
      peakConcurrent: 0,
      burnt: 0,
      idleSec: 0,
      trace: [],
    },
    reset(cfg: SimConfig) {
      resetState(st, cfg)
    },
  }
  resetState(st, config)
  return st
}

function resetState(st: InternalState, cfg: SimConfig): void {
  st.cfg = cfg
  st.t = 0
  st.done = false
  reseed(st.rng, cfg.seed)

  // 距离矩阵：预计算，决策里不再开方
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      st.distance[a * 4 + b] = dist(stationVec(cfg.layout, a), stationVec(cfg.layout, b)) * cfg.layout.spread
    }
  }

  // 顾客槽位与烤炉槽位按上限预分配一次，之后只复用
  while (st.customers.length < cfg.flow.maxConcurrent) {
    st.customers.push({
      active: false,
      id: 0,
      patienceLeft: 0,
      spec: { required: [], banned: [], doneness: 'medium', patience: 0 },
      burger: { ingredients: [], cook: null },
    })
  }
  for (const c of st.customers) c.active = false

  while (st.grill.length < cfg.grillSlots) st.grill.push({ busy: false, elapsed: 0, reservedFor: -1 })
  for (const g of st.grill) {
    g.busy = false
    g.elapsed = 0
    g.reservedFor = -1
  }

  st.nextArrivalAt = 0
  st.nextId = 1
  st.activeCount = 0
  st.at = ASSEMBLY
  st.phase = 'idle'
  st.phaseLeft = 0
  st.carry = 'none'
  st.carryCustomer = -1
  st.action = 'none'
  st.actionCustomer = -1
  st.actionGrill = -1

  const r = st.result
  r.arrived = 0
  r.served = 0
  r.wrong = 0
  r.timedOut = 0
  r.completionRate = 0
  r.badReviewRate = 0
  r.peakConcurrent = 0
  r.burnt = 0
  r.idleSec = 0
  r.trace.length = 0
}

function trace(st: InternalState, msg: string): void {
  if (st.cfg.trace) st.result.trace.push(`[${st.t.toFixed(1)}] ${msg}`)
}

// ─────────────────────────── 订单生成 ───────────────────────────

function rollOrder(st: InternalState, spec: OrderSpec): void {
  const d = st.cfg.orders
  spec.required.length = 0
  spec.required.push('bun', 'patty')

  // 部分 Fisher-Yates：洗前 n 个就够，池子复用不分配
  const extras = d.extraMin + nextInt(st.rng, d.extraMax - d.extraMin + 1)
  const pool = st.pool
  for (let i = 0; i < extras && i < pool.length; i++) {
    const j = i + nextInt(st.rng, pool.length - i)
    const tmp = pool[i]!
    pool[i] = pool[j]!
    pool[j] = tmp
    spec.required.push(pool[i]!)
  }

  spec.banned.length = 0
  if (chance(st.rng, d.bannedChance) && extras < pool.length) {
    // 从没被选进 required 的那部分里挑，保证不相交
    const idx = extras + nextInt(st.rng, pool.length - extras)
    spec.banned.push(pool[idx]!)
  }

  spec.doneness = DONENESS[nextInt(st.rng, DONENESS.length)] as Doneness
  spec.patience = st.cfg.flow.patienceSec
}

// ─────────────────────────── 查询 ───────────────────────────

function firstMissingIngredient(c: CustomerSlot): Ingredient | null {
  for (let i = 0; i < c.spec.required.length; i++) {
    const ing = c.spec.required[i]!
    if (ing === 'patty') continue
    if (!c.burger.ingredients.includes(ing)) return ing
  }
  return null
}

function isComplete(c: CustomerSlot): boolean {
  if (c.burger.cook !== c.spec.doneness) return false
  return firstMissingIngredient(c) === null
}

/** 最紧急（耐心剩得最少）且满足条件的 active 顾客索引，没有则 -1 */
function mostUrgent(st: InternalState, test: (c: CustomerSlot) => boolean): number {
  let best = -1
  let bestLeft = Infinity
  for (let i = 0; i < st.customers.length; i++) {
    const c = st.customers[i]!
    if (!c.active || !test(c)) continue
    if (c.patienceLeft < bestLeft) {
      bestLeft = c.patienceLeft
      best = i
    }
  }
  return best
}

function freeGrillSlot(st: InternalState): number {
  for (let i = 0; i < st.grill.length; i++) if (!st.grill[i]!.busy) return i
  return -1
}

/** 已经有一块肉在为这一单烤着 */
function hasPattyCooking(st: InternalState, customerIdx: number): boolean {
  for (const g of st.grill) if (g.busy && g.reservedFor === customerIdx) return true
  return false
}

// ─────────────────────────── 决策 ───────────────────────────

function beginTask(st: InternalState, station: number, action: Action): void {
  st.action = action
  const d = st.distance[st.at * 4 + station]!
  if (station === st.at || d === 0) {
    st.phase = 'acting'
    st.phaseLeft = st.cfg.chef.interactSec
  } else {
    st.phase = 'moving'
    st.phaseLeft = d / st.cfg.chef.speed
    st.at = station // 出发即视为「归属于目标工位」，到达时间由 phaseLeft 表达
  }
}

function decide(st: InternalState): void {
  // 手上有东西 → 先送出去
  switch (st.carry) {
    case 'raw_patty':
      beginTask(st, GRILL, 'put_grill')
      return
    case 'ingredient':
    case 'cooked_patty':
      beginTask(st, ASSEMBLY, 'place_assembly')
      return
    case 'plate':
      beginTask(st, SERVE, 'serve')
      return
  }

  // 1) 烤好的肉优先取 —— 再等就烤过头，之前那几步全白做
  for (let g = 0; g < st.grill.length; g++) {
    const slot = st.grill[g]!
    if (!slot.busy) continue
    const level = cookLevelAt(slot.elapsed, st.cfg.cook)
    if (level === 'raw' || level === 'burnt') continue
    const target = mostUrgent(st, (c) => c.burger.cook === null && c.spec.doneness === level)
    if (target >= 0) {
      st.actionGrill = g
      st.actionCustomer = target
      beginTask(st, GRILL, 'take_grill')
      return
    }
  }

  // 2) 处理最紧急那一单 —— 但「最紧急」要在**还推得动**的单里挑。
  //
  //    ⚠ 这里曾经写错过，代价很直观：原先「缺肉且烤炉有空就去拿肉」是条不绑定订单的
  //    全局规则，于是槽位越多、玩家越忙着给一堆单铺肉、每单都做一半 ——
  //    实测 1 个槽位反而比 3 个完成率高一倍（56% vs 33%）。多一个烤炉不该让玩家变差，
  //    那是策略缺陷不是难度。理想玩家一次只推进一单，直到那单只能干等为止。
  let best = -1
  let bestLeft = Infinity
  let bestAction: Action = 'none'
  for (let i = 0; i < st.customers.length; i++) {
    const c = st.customers[i]!
    if (!c.active || c.patienceLeft >= bestLeft) continue
    const act = nextActionFor(st, c, i)
    if (act === 'none') continue
    best = i
    bestLeft = c.patienceLeft
    bestAction = act
  }

  if (best >= 0) {
    st.actionCustomer = best
    switch (bestAction) {
      case 'take_plate':
        beginTask(st, ASSEMBLY, 'take_plate')
        return
      case 'pick_patty':
        beginTask(st, FRIDGE, 'pick_patty')
        return
      case 'pick_ingredient':
        st.actionIng = firstMissingIngredient(st.customers[best]!)!
        beginTask(st, FRIDGE, 'pick_ingredient')
        return
    }
  }

  st.phase = 'idle'
  st.action = 'none'
}

/**
 * 这一单眼下能推进的下一步，'none' = 只能干等（缺肉但烤炉满了，或肉正在烤）。
 *
 * 顺序有讲究：**先把肉放上烤炉，再去拿配料** —— 烤肉那 3–9 秒是这个游戏里
 * 唯一的并行窗口，不先占上就白白串行了。
 */
function nextActionFor(st: InternalState, c: CustomerSlot, idx: number): Action {
  if (isComplete(c)) return 'take_plate'
  if (c.burger.cook === null && !hasPattyCooking(st, idx) && freeGrillSlot(st) >= 0) {
    return 'pick_patty'
  }
  if (firstMissingIngredient(c) !== null) return 'pick_ingredient'
  return 'none'
}

function finishAction(st: InternalState): void {
  switch (st.action) {
    case 'pick_ingredient':
      st.carry = 'ingredient'
      st.carryIng = st.actionIng
      st.carryCustomer = st.actionCustomer
      break

    case 'pick_patty':
      st.carry = 'raw_patty'
      st.carryCustomer = st.actionCustomer
      break

    case 'put_grill': {
      const g = freeGrillSlot(st)
      if (g >= 0) {
        st.grill[g]!.busy = true
        st.grill[g]!.elapsed = 0
        st.grill[g]!.reservedFor = st.carryCustomer
        trace(st, `grill#${g} start`)
      }
      st.carry = 'none'
      st.carryCustomer = -1
      break
    }

    case 'take_grill': {
      const slot = st.grill[st.actionGrill]!
      const level = cookLevelAt(slot.elapsed, st.cfg.cook)
      slot.busy = false
      slot.elapsed = 0
      slot.reservedFor = -1
      if (level === 'raw' || level === 'burnt') {
        // 走过来的这段时间里过火了，白跑一趟
        if (level === 'burnt') st.result.burnt++
        st.carry = 'none'
      } else {
        st.carry = 'cooked_patty'
        st.carryCook = level
        st.carryCustomer = st.actionCustomer
      }
      break
    }

    case 'place_assembly': {
      const c = st.customers[st.carryCustomer]
      // 顾客可能在路上就走了，手上这份直接作废
      if (c && c.active) {
        if (st.carry === 'cooked_patty') addCookedPatty(c.burger, st.carryCook)
        else addIngredient(c.burger, st.carryIng)
      }
      st.carry = 'none'
      st.carryCustomer = -1
      break
    }

    case 'take_plate': {
      const c = st.customers[st.actionCustomer]!
      if (c.active && isComplete(c)) {
        st.carry = 'plate'
        st.carryCustomer = st.actionCustomer
      }
      break
    }

    case 'serve': {
      const c = st.customers[st.carryCustomer]
      if (c && c.active) {
        const verdict = judge(c.burger, c.spec)
        if (verdict.ok) st.result.served++
        else st.result.wrong++
        trace(st, `serve #${c.id} ${verdict.ok ? 'ok' : 'WRONG'}`)
        releaseCustomer(st, c)
      }
      st.carry = 'none'
      st.carryCustomer = -1
      break
    }
  }
  st.action = 'none'
  st.phase = 'idle'
}

function releaseCustomer(st: InternalState, c: CustomerSlot): void {
  const idx = st.customers.indexOf(c)
  for (const g of st.grill) if (g.reservedFor === idx) g.reservedFor = -1
  c.active = false
  c.burger.ingredients.length = 0
  c.burger.cook = null
  st.activeCount--
}

// ─────────────────────────── 主循环 ───────────────────────────

export function stepSim(state: SimState, dt: number): void {
  const st = state as InternalState
  if (st.done) return

  st.t += dt
  if (st.t >= st.cfg.durationSec) {
    // 强制打烊：在场没做完的一律记超时
    for (const c of st.customers) {
      if (!c.active) continue
      st.result.timedOut++
      trace(st, `closing, #${c.id} left`)
      releaseCustomer(st, c)
    }
    st.done = true
    finalize(st)
    return
  }

  // 顾客到达
  while (st.t >= st.nextArrivalAt && st.activeCount < st.cfg.flow.maxConcurrent) {
    for (const c of st.customers) {
      if (c.active) continue
      c.active = true
      c.id = st.nextId++
      c.patienceLeft = st.cfg.flow.patienceSec
      c.burger.ingredients.length = 0
      c.burger.cook = null
      rollOrder(st, c.spec)
      st.activeCount++
      st.result.arrived++
      trace(st, `arrive #${c.id} req=${c.spec.required.join('+')} ${c.spec.doneness}`)
      break
    }
    const jitter = st.cfg.flow.intervalJitter
    const factor = jitter > 0 ? 1 - jitter + nextInt(st.rng, 2001) * (jitter / 1000) : 1
    st.nextArrivalAt += st.cfg.flow.intervalSec * factor
  }
  if (st.activeCount > st.result.peakConcurrent) st.result.peakConcurrent = st.activeCount

  // 耐心
  for (const c of st.customers) {
    if (!c.active) continue
    c.patienceLeft -= dt
    if (c.patienceLeft <= 0) {
      st.result.timedOut++
      trace(st, `timeout #${c.id}`)
      // 端在手上的那一份也一起作废
      if (st.carry === 'plate' && st.customers[st.carryCustomer] === c) {
        st.carry = 'none'
        st.carryCustomer = -1
        st.phase = 'idle'
        st.action = 'none'
      }
      releaseCustomer(st, c)
    }
  }

  // 烤炉
  for (let g = 0; g < st.grill.length; g++) {
    const slot = st.grill[g]!
    if (!slot.busy) continue
    slot.elapsed += dt
    if (cookLevelAt(slot.elapsed, st.cfg.cook) === 'burnt') {
      slot.busy = false
      slot.elapsed = 0
      slot.reservedFor = -1
      st.result.burnt++
      trace(st, `grill#${g} BURNT`)
    }
  }

  // 厨师
  if (st.phase === 'idle') {
    decide(st)
    if (st.phase === 'idle') st.result.idleSec += dt
  } else {
    st.phaseLeft -= dt
    if (st.phaseLeft <= 0) {
      if (st.phase === 'moving') {
        st.phase = 'acting'
        st.phaseLeft = st.cfg.chef.interactSec
      } else {
        finishAction(st)
      }
    }
  }
}

function finalize(st: InternalState): void {
  const r = st.result
  r.completionRate = r.arrived === 0 ? 1 : r.served / r.arrived
  r.badReviewRate = r.arrived === 0 ? 0 : (r.wrong + r.timedOut) / r.arrived
}

/** 逻辑帧步长。真机 30fps 也够跑逻辑，模拟器与它保持一致。 */
export const SIM_DT = 1 / 30

/** 跑完整一局。扫参数时上千次调用它。 */
export function runDay(config: SimConfig): DayResult {
  const st = createSimState(config)
  const steps = Math.ceil(config.durationSec / SIM_DT) + 2
  for (let i = 0; i < steps && !(st as InternalState).done; i++) stepSim(st, SIM_DT)
  return st.result
}
