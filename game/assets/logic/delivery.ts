/**
 * 外卖（GDD §12.1，2026-09-24 定）：单子先挂在点单台电脑上，玩家接或拒；
 * 接了就和堂食一样看得见食材，做好放外卖取餐口，骑手取走。
 *
 * - 拒单 / 挂着没理（offer 过期）= 一样算拒，扣一点评分
 * - 接了没按时送出 = 骑手走人、订单作废、差评
 *
 * 用自己的 rng：借顾客流的 rng 会让堂食每一单都错位（见 customer.ts 的 ⚠）。
 */
import { OPTIONAL, rollSpec } from './customer'
import type { OrderDifficulty } from './customer'
import { judge } from './order'
import { createRng, reseed } from './rng'
import type { Rng } from './rng'
import type { Burger, Ingredient, OrderSpec } from './types'

export interface DeliveryParams {
  /** 多久来一张新单，秒 */
  intervalSec: number
  /** 挂在电脑上多久没人理就算拒 */
  offerSec: number
  /** 接单后多久内要放上取餐口 */
  deadlineSec: number
  /** 电脑上最多同时挂几张 + 接下来最多同时做几张，两者之和 = 槽位数 */
  maxOffers: number
  maxActive: number
}

export type DeliveryStatus = 'idle' | 'offer' | 'accepted'

export interface Delivery {
  status: DeliveryStatus
  id: number
  /** 当前那段还剩几秒（offer 时是等接单，accepted 时是送达期限） */
  left: number
  max: number
  spec: OrderSpec
}

export interface DeliveryDesk {
  slots: Delivery[]
  params: DeliveryParams
  orders: OrderDifficulty
  rng: Rng
  pool: Ingredient[]
  t: number
  nextAt: number
  nextId: number
  /** false 后不再来新单；已接的照常做完 */
  open: boolean
  delivered: number
  wrong: number
  late: number
  rejected: number
}

export interface DeskEvents {
  /** offer 过期，按拒单算 */
  onExpire?: (d: Delivery) => void
  /** 接了没送到，骑手走了 */
  onLate?: (d: Delivery) => void
}

export function createDesk(params: DeliveryParams, orders: OrderDifficulty, seed: number): DeliveryDesk {
  const slots: Delivery[] = []
  for (let i = 0; i < params.maxOffers + params.maxActive; i++) {
    slots.push({ status: 'idle', id: 0, left: 0, max: 0, spec: { required: [], banned: [], doneness: 'medium', patience: 0 } })
  }
  const desk: DeliveryDesk = {
    slots,
    params,
    orders,
    rng: createRng(seed),
    pool: OPTIONAL.slice(),
    t: 0,
    nextAt: 0,
    nextId: 1,
    open: true,
    delivered: 0,
    wrong: 0,
    late: 0,
    rejected: 0,
  }
  resetDesk(desk, seed)
  return desk
}

export function resetDesk(desk: DeliveryDesk, seed: number): void {
  reseed(desk.rng, seed)
  for (let i = 0; i < OPTIONAL.length; i++) desk.pool[i] = OPTIONAL[i]!
  for (const d of desk.slots) d.status = 'idle'
  desk.t = 0
  desk.nextAt = desk.params.intervalSec
  desk.nextId = 1
  desk.open = true
  desk.delivered = desk.wrong = desk.late = desk.rejected = 0
}

export function countStatus(desk: DeliveryDesk, s: DeliveryStatus): number {
  let n = 0
  for (const d of desk.slots) if (d.status === s) n++
  return n
}

export function stepDesk(desk: DeliveryDesk, dt: number, ev?: DeskEvents): void {
  desk.t += dt
  if (desk.open && desk.t >= desk.nextAt) {
    desk.nextAt += desk.params.intervalSec
    if (countStatus(desk, 'offer') < desk.params.maxOffers) {
      const d = desk.slots.find((x) => x.status === 'idle')
      if (d) {
        d.status = 'offer'
        d.id = desk.nextId++
        d.left = d.max = desk.params.offerSec
        rollSpec(desk.rng, desk.orders, desk.pool, desk.params.deadlineSec, d.spec)
      }
    }
  }
  for (const d of desk.slots) {
    if (d.status === 'idle') continue
    d.left -= dt
    if (d.left > 0) continue
    if (d.status === 'offer') {
      desk.rejected++
      ev?.onExpire?.(d)
    } else {
      desk.late++
      ev?.onLate?.(d)
    }
    d.status = 'idle'
  }
}

/** 接单。做不过来（已接满）返回 false，单子留在电脑上 */
export function acceptDelivery(desk: DeliveryDesk, d: Delivery): boolean {
  if (d.status !== 'offer' || countStatus(desk, 'accepted') >= desk.params.maxActive) return false
  d.status = 'accepted'
  d.left = d.max = desk.params.deadlineSec
  return true
}

export function rejectDelivery(desk: DeliveryDesk, d: Delivery): void {
  if (d.status !== 'offer') return
  desk.rejected++
  d.status = 'idle'
}

/** 放上取餐口的这一盘给谁：同 matchCustomer —— 先找对得上的，没有就砸给最急的 */
export function matchDelivery(desk: DeliveryDesk, burger: Burger): Delivery | null {
  let fit: Delivery | null = null
  let urgent: Delivery | null = null
  for (const d of desk.slots) {
    if (d.status !== 'accepted') continue
    if (!urgent || d.left < urgent.left) urgent = d
    if (!judge(burger, d.spec).ok) continue
    if (!fit || d.left < fit.left) fit = d
  }
  return fit ?? urgent
}

export function settleDelivery(desk: DeliveryDesk, d: Delivery, ok: boolean): void {
  if (ok) desk.delivered++
  else desk.wrong++
  d.status = 'idle'
}

/** 还有没送完的（打烊结算要等它们） */
export function deskBusy(desk: DeliveryDesk): boolean {
  return countStatus(desk, 'accepted') > 0
}
