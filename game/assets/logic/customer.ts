/**
 * 顾客流：到达、点单、耐心、离店。零 Cocos 依赖（铁律①）。
 *
 * **模拟器（sim.ts）与真人局共用这一份。** 各写一份的话 M1 标定出来的难度曲线对真游戏
 * 就不成立了，而这种偏差要真机玩上几十局才看得出来 —— `pnpm layout` 盯着它：
 * 抽出来之后模拟器跑同一个 seed 必须给出和 M1 基线一样的曲线。
 *
 * ⚠ 改这个文件时，**RNG 的调用次数与顺序不能变**。同一个 seed 下少调一次 nextInt，
 * 之后每一单的食材、火候、抖动全部错位，难度曲线整条移位而判据只会报「偏离基线」，
 * 看不出是这里动的。`chance()` 即使结果用不上也照样消耗一次，那行短路顺序是刻意的。
 */
import { judge } from './order'
import { chance, nextInt } from './rng'
import type { Rng } from './rng'
import { DONENESS } from './types'
import type { Burger, Doneness, Ingredient, OrderSpec } from './types'

export interface FlowParams {
  /** 客流间隔（秒） */
  intervalSec: number
  /** 间隔抖动比例，0 = 完全均匀 */
  intervalJitter: number
  /** 同时在场上限 */
  maxConcurrent: number
  /** 顾客耐心（秒） */
  patienceSec: number
  /**
   * 耐心耗尽后留下等餐（真人局），而不是离场（模拟器）。留下的照样记一笔 timedOut 并标 late。
   * 不写 = 离场 —— M1 的难度曲线是按离场标定的，模拟器必须保持这个默认。
   */
  stayWhenLate?: boolean
  /** 这一局总共来几位，到数就不再来。不写 = 不限（模拟器按局长截断） */
  maxArrivals?: number
  /**
   * 要玩家去点单台接单（真人局）。到店先走 walkInSec 到柜台，之后 patienceSec 没人理就走人、记差评；
   * 接了单才开始倒等餐的耐心。不写 = 一到店就下单（模拟器，M1 按这个标定）。
   */
  takeOrder?: { walkInSec: number; patienceSec: number }
}

export interface OrderDifficulty {
  /** 除 bun+patty 外额外要的食材数量下限 */
  extraMin: number
  extraMax: number
  /** 出现 banned 食材的概率 */
  bannedChance: number
}

export interface Customer {
  active: boolean
  id: number
  patienceLeft: number
  /** 这一单的耐心上限。UI 画进度条要拿它当分母，别去读 FlowParams —— 难度是逐天变的 */
  patienceMax: number
  /** 耐心已耗尽还在等（只在 stayWhenLate 下出现）。上菜也不付钱、给差评 */
  late: boolean
  /** 单已经接了。没有 takeOrder 时一到店就是 true */
  ordered: boolean
  /** 到店后等接单等了多久，秒（含走到柜台那段） */
  orderWait: number
  spec: OrderSpec
  /**
   * 模拟器拿它记「AI 厨师为这一单做到哪一步」。
   * 真人局不碰它 —— 玩家手上那个汉堡在 kitchen.ts 的 carry 里。
   */
  burger: Burger
}

export interface CustomerFlow {
  /** 长度 = maxConcurrent，按上限预分配一次之后只复用（铁律②）。索引即排队位 */
  customers: Customer[]
  activeCount: number
  nextArrivalAt: number
  nextId: number
  arrived: number
  timedOut: number
  /** 等接单等到走人的 */
  walkedOut: number
  peakConcurrent: number
  flow: FlowParams
  orders: OrderDifficulty
  rng: Rng
  /** rollOrder 的洗牌池，复用不分配 */
  pool: Ingredient[]
}

/** bun/patty 之外可点的。顺序是洗牌池的初始顺序，改它会改变同 seed 下的出题 */
const OPTIONAL: readonly Ingredient[] = ['cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon']

export function createCustomerFlow(flow: FlowParams, orders: OrderDifficulty, rng: Rng): CustomerFlow {
  const st: CustomerFlow = {
    customers: [],
    activeCount: 0,
    nextArrivalAt: 0,
    nextId: 1,
    arrived: 0,
    timedOut: 0,
    walkedOut: 0,
    peakConcurrent: 0,
    flow,
    orders,
    rng,
    pool: OPTIONAL.slice(),
  }
  resetCustomerFlow(st, flow, orders)
  return st
}

/** 重开一局。槽位不释放，只标记为空 */
export function resetCustomerFlow(st: CustomerFlow, flow: FlowParams, orders: OrderDifficulty): void {
  st.flow = flow
  st.orders = orders
  while (st.customers.length < flow.maxConcurrent) {
    st.customers.push({
      active: false,
      id: 0,
      patienceLeft: 0,
      patienceMax: 0,
      late: false,
      ordered: false,
      orderWait: 0,
      spec: { required: [], banned: [], doneness: 'medium', patience: 0 },
      burger: { ingredients: [], cook: null },
    })
  }
  for (const c of st.customers) c.active = false
  // 洗牌池必须复位：rollOrder 是原地洗的，不还原的话重开一局同一个 seed 出的是另一批单，
  // 而「同 seed 可复现」正是难度标定站得住的前提
  for (let i = 0; i < OPTIONAL.length; i++) st.pool[i] = OPTIONAL[i]!
  st.activeCount = 0
  st.nextArrivalAt = 0
  st.nextId = 1
  st.arrived = 0
  st.timedOut = 0
  st.walkedOut = 0
  st.peakConcurrent = 0
}

function rollOrder(st: CustomerFlow, spec: OrderSpec): void {
  const d = st.orders
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
  spec.patience = st.flow.patienceSec
}

/** 顾客离店。槽位回到空闲，手上的进度作废 */
export function releaseCustomer(st: CustomerFlow, c: Customer): void {
  if (!c.active) return
  c.active = false
  c.burger.ingredients.length = 0
  c.burger.cook = null
  st.activeCount--
}

/**
 * 一帧。先到达再倒耐心，顺序与 RNG 调用都锁死（见文件头）。
 *
 * `onTimeout` 在顾客被释放**之前**调用 —— 调用方要清掉挂在这位顾客身上的东西
 * （模拟器的烤炉预留、端在手上的那一盘）。
 */
export function stepCustomerFlow(
  st: CustomerFlow,
  t: number,
  dt: number,
  onTimeout?: (c: Customer) => void,
  onArrive?: (c: Customer) => void,
  onWalkOut?: (c: Customer) => void,
): void {
  const cap = st.flow.maxArrivals
  while (
    t >= st.nextArrivalAt &&
    st.activeCount < st.flow.maxConcurrent &&
    (cap === undefined || st.arrived < cap)
  ) {
    for (const c of st.customers) {
      if (c.active) continue
      c.active = true
      c.id = st.nextId++
      c.patienceLeft = st.flow.patienceSec
      c.patienceMax = st.flow.patienceSec
      c.late = false
      c.ordered = st.flow.takeOrder === undefined
      c.orderWait = 0
      c.burger.ingredients.length = 0
      c.burger.cook = null
      rollOrder(st, c.spec)
      st.activeCount++
      st.arrived++
      onArrive?.(c)
      break
    }
    const jitter = st.flow.intervalJitter
    const factor = jitter > 0 ? 1 - jitter + nextInt(st.rng, 2001) * (jitter / 1000) : 1
    st.nextArrivalAt += st.flow.intervalSec * factor
  }
  if (st.activeCount > st.peakConcurrent) st.peakConcurrent = st.activeCount

  const take = st.flow.takeOrder
  for (const c of st.customers) {
    if (!c.active) continue
    if (!c.ordered) {
      c.orderWait += dt
      if (take && c.orderWait >= take.walkInSec + take.patienceSec) {
        st.walkedOut++
        onWalkOut?.(c)
        releaseCustomer(st, c)
      }
      continue
    }
    c.patienceLeft -= dt
    if (c.patienceLeft > 0 || c.late) continue
    st.timedOut++
    onTimeout?.(c)
    if (st.flow.stayWhenLate) c.late = true
    else releaseCustomer(st, c)
  }
}

/** 打烊：在场的一律记超时。`onLeave` 同 stepCustomerFlow 的 onTimeout */
export function closeShop(st: CustomerFlow, onLeave?: (c: Customer) => void): void {
  for (const c of st.customers) {
    if (!c.active) continue
    st.timedOut++
    onLeave?.(c)
    releaseCustomer(st, c)
  }
}

/**
 * 端着这个汉堡走到出餐口，算给了谁。
 *
 * 先找吃得下它的人，找不到就砸在最急的那位头上 —— 玩家看着订单做，做完不该再点一次
 * 「这是给谁的」。**没有匹配也一定要有人接**，否则做错了没有代价，判定形同虚设。
 * 多个都吃得下时给最急的：让玩家先做通用单再做刁钻单是合理策略，不该被惩罚。
 */
export function matchCustomer(st: CustomerFlow, burger: Burger): Customer | null {
  let fit: Customer | null = null
  let urgent: Customer | null = null
  for (const c of st.customers) {
    if (!c.active || !c.ordered) continue
    if (!urgent || c.patienceLeft < urgent.patienceLeft) urgent = c
    if (!judge(burger, c.spec).ok) continue
    if (!fit || c.patienceLeft < fit.patienceLeft) fit = c
  }
  return fit ?? urgent
}

/** 排队的顺序：没接单的按到店先后。0 = 站在点单台前那位。已接单或不在场返回 -1 */
export function queueIndex(st: CustomerFlow, c: Customer): number {
  if (!c.active || c.ordered) return -1
  let ahead = 0
  for (const o of st.customers) if (o.active && !o.ordered && o.id < c.id) ahead++
  return ahead
}

/** 等接单还剩几秒；还在走向柜台时返回满值。没开 takeOrder 返回 0 */
export function orderPatienceLeft(st: CustomerFlow, c: Customer): number {
  const take = st.flow.takeOrder
  if (!take) return 0
  return Math.min(take.patienceSec, take.walkInSec + take.patienceSec - c.orderWait)
}

/**
 * 在点单台按一下：接排在最前、已经走到柜台的那位的单。接了才开始倒等餐耐心。
 * 没人可接返回 null。
 */
export function takeNextOrder(st: CustomerFlow): Customer | null {
  const take = st.flow.takeOrder
  if (!take) return null
  let front: Customer | null = null
  for (const c of st.customers) if (c.active && !c.ordered && (!front || c.id < front.id)) front = c
  if (!front || front.orderWait < take.walkInSec) return null
  front.ordered = true
  front.patienceLeft = front.patienceMax
  return front
}
