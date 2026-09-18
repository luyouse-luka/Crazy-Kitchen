/**
 * 一个班次（真人局）：开门 → 顾客来 → 打烊 → 结算。零 Cocos 依赖（铁律①）。
 *
 * 与 `sim.ts` 的分工：那边是无头模拟器，一口气跑完整局用来标定难度，厨师是 AI；
 * 这边按真实 dt 逐帧推进，厨师是玩家。**顾客流两边共用 `customer.ts`**，
 * 所以 M1 标定出来的参数就是这里在跑的参数，不存在「模拟器调好了真游戏不是那回事」。
 *
 * 不管厨房状态（那是 `kitchen.ts`），只管顾客与计分。上菜那一下由组件把两边接起来：
 * `matchCustomer()` 挑人 → `interact(serve, {spec})` 判定 → `settleServe()` 记账。
 */
import {
  closeShop,
  createCustomerFlow,
  releaseCustomer,
  resetCustomerFlow,
  stepCustomerFlow,
} from './customer'
import type { Customer, CustomerFlow, FlowParams, OrderDifficulty } from './customer'
import { createRng, reseed } from './rng'
import type { Rng } from './rng'
import type { OrderVerdict } from './order'

export interface ShiftConfig {
  seed: number
  /** 局长，秒 */
  durationSec: number
  flow: FlowParams
  orders: OrderDifficulty
}

export interface ShiftState {
  /** 已过去的秒数 */
  t: number
  over: boolean
  flow: CustomerFlow
  served: number
  /** 上错菜。和 timedOut 一样都算差评，但玩家心里是两回事，分开记 */
  wrong: number
  cfg: ShiftConfig
  rng: Rng
}

export interface ShiftResult {
  arrived: number
  served: number
  wrong: number
  timedOut: number
  /** 0..1。没人来过算满分，别让空局显示 0% */
  completionRate: number
}

export function createShift(cfg: ShiftConfig): ShiftState {
  const rng = createRng(cfg.seed)
  return {
    t: 0,
    over: false,
    flow: createCustomerFlow(cfg.flow, cfg.orders, rng),
    served: 0,
    wrong: 0,
    cfg,
    rng,
  }
}

/** 重开一局。槽位与 RNG 都复用，不分配 */
export function resetShift(st: ShiftState, cfg: ShiftConfig = st.cfg): void {
  st.cfg = cfg
  st.t = 0
  st.over = false
  st.served = 0
  st.wrong = 0
  reseed(st.rng, cfg.seed)
  resetCustomerFlow(st.flow, cfg.flow, cfg.orders)
}

/**
 * 一帧。`onLeave` 在顾客因超时或打烊离场时调用，**在释放之前** ——
 * 调用方拿它清掉挂在这位顾客身上的东西（场景节点、正在播的动画）。
 */
export function stepShift(st: ShiftState, dt: number, onLeave?: (c: Customer) => void): void {
  if (st.over) return
  st.t += dt
  if (st.t >= st.cfg.durationSec) {
    st.t = st.cfg.durationSec
    // 打烊是硬边界：在场没做完的一律记超时，与 sim.ts 的简化①一致
    closeShop(st.flow, onLeave)
    st.over = true
    return
  }
  stepCustomerFlow(st.flow, st.t, dt, onLeave)
}

/** 剩余秒数，给倒计时用。已打烊恒为 0 */
export function timeLeft(st: ShiftState): number {
  const left = st.cfg.durationSec - st.t
  return left > 0 ? left : 0
}

/**
 * 上菜记账。`verdict` 来自 `kitchen.interact(serve)`，`c` 来自 `matchCustomer()`。
 *
 * 顾客在这里离场 —— 对错都走，**上错菜不给第二次机会**：能重试的话玩家会拿出餐口
 * 当试错工具，一单一单试到对为止，banned 那一维就白设计了。
 */
export function settleServe(st: ShiftState, c: Customer, verdict: OrderVerdict): void {
  if (verdict.ok) st.served++
  else st.wrong++
  releaseCustomer(st.flow, c)
}

export function shiftResult(st: ShiftState): ShiftResult {
  const arrived = st.flow.arrived
  return {
    arrived,
    served: st.served,
    wrong: st.wrong,
    timedOut: st.flow.timedOut,
    completionRate: arrived === 0 ? 1 : st.served / arrived,
  }
}
