/**
 * 一个班次（真人局）：开门 → 来满 N 位顾客 → 全部接待完 → 结算。零 Cocos 依赖（铁律①）。
 *
 * 真人局没有局长、顾客不跑单（2026-09-23 定）：耐心耗尽的顾客留下接着等，
 * 上菜时不付钱、给差评。例外是**没人去接单**的：`flow.takeOrder` 开着时，等不到点单就走、记差评。模拟器仍按局长截断、超时离场 —— 那是 M1 标定的口径，别跟着改。
 *
 * 与 `sim.ts` 的分工：那边是无头模拟器，一口气跑完整局用来标定难度，厨师是 AI；
 * 这边按真实 dt 逐帧推进，厨师是玩家。**顾客流两边共用 `customer.ts`**，到达、出题、
 * 耐心是同一份代码；差别只在上面那两条规则和组件传进来的客流间隔。
 *
 * 不管厨房状态（那是 `kitchen.ts`），只管顾客与计分。上菜那一下由组件把两边接起来：
 * `matchCustomer()` 挑人 → `interact(serve, {spec})` 判定 → `settleServe()` 记账。
 */
import { createCustomerFlow, releaseCustomer, resetCustomerFlow, stepCustomerFlow } from './customer'
import type { Customer, CustomerFlow, FlowParams, OrderDifficulty } from './customer'
import { createRng, reseed } from './rng'
import type { Rng } from './rng'
import type { OrderVerdict } from './order'

export interface ShiftConfig {
  seed: number
  /** 这一局来几位顾客，接待完就结算 */
  customers: number
  flow: FlowParams
  orders: OrderDifficulty
}

export interface ShiftState {
  /** 已过去的秒数 */
  t: number
  over: boolean
  flow: CustomerFlow
  /** 准时做对：付钱、好评 */
  served: number
  /** 超时后才做对：不付钱、差评 */
  lateServed: number
  /** 上错菜：差评，顾客照样走 */
  wrong: number
  cfg: ShiftConfig
  rng: Rng
}

export interface ShiftResult {
  arrived: number
  served: number
  lateServed: number
  wrong: number
  /** 等到超时的人数（之后做对做错都算在内） */
  timedOut: number
  /** 没人来接单、等不及走掉的 —— 差评 */
  walkedOut: number
  /** 好评率 0..1。没人来过算满分，别让空局显示 0% */
  goodRate: number
}

/** 真人局的顾客流：超时不走，来满就停 */
const shiftFlow = (cfg: ShiftConfig): FlowParams => ({ ...cfg.flow, stayWhenLate: true, maxArrivals: cfg.customers })

export function createShift(cfg: ShiftConfig): ShiftState {
  const rng = createRng(cfg.seed)
  return {
    t: 0,
    over: false,
    flow: createCustomerFlow(shiftFlow(cfg), cfg.orders, rng),
    served: 0,
    lateServed: 0,
    wrong: 0,
    cfg,
    rng,
  }
}

/** 重开一局。槽位与 RNG 都复用 */
export function resetShift(st: ShiftState, cfg: ShiftConfig = st.cfg): void {
  st.cfg = cfg
  st.t = 0
  st.over = false
  st.served = 0
  st.lateServed = 0
  st.wrong = 0
  reseed(st.rng, cfg.seed)
  resetCustomerFlow(st.flow, shiftFlow(cfg), cfg.orders)
}

/** 一帧。最后一位顾客离开的那一帧置 over */
export function stepShift(st: ShiftState, dt: number, onWalkOut?: (c: Customer) => void): void {
  if (st.over) return
  st.t += dt
  stepCustomerFlow(st.flow, st.t, dt, undefined, undefined, onWalkOut)
  if (st.flow.arrived >= st.cfg.customers && st.flow.activeCount === 0) st.over = true
}

/**
 * 上菜记账。`verdict` 来自 `kitchen.interact(serve)`，`c` 来自 `matchCustomer()`。
 *
 * 顾客在这里离场 —— 对错都走，**上错菜不给第二次机会**：能重试的话玩家会拿出餐口
 * 当试错工具，一单一单试到对为止，banned 那一维就白设计了。
 */
export function settleServe(st: ShiftState, c: Customer, verdict: OrderVerdict): void {
  if (!verdict.ok) st.wrong++
  else if (c.late) st.lateServed++
  else st.served++
  releaseCustomer(st.flow, c)
  if (st.flow.arrived >= st.cfg.customers && st.flow.activeCount === 0) st.over = true
}

export function shiftResult(st: ShiftState): ShiftResult {
  const arrived = st.flow.arrived
  return {
    arrived,
    served: st.served,
    lateServed: st.lateServed,
    wrong: st.wrong,
    timedOut: st.flow.timedOut,
    walkedOut: st.flow.walkedOut,
    goodRate: arrived === 0 ? 1 : st.served / arrived,
  }
}

/** 好评率 → 星级。⏳ 三条线是占位值，等真人数据再定 */
export function starsForShift(r: ShiftResult): 0 | 1 | 2 | 3 {
  if (r.goodRate >= 0.9) return 3
  if (r.goodRate >= 0.7) return 2
  if (r.goodRate >= 0.5) return 1
  return 0
}
