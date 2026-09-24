/**
 * 顾客目击系统（GDD §12.5）：厨房里出事时，在场顾客看得见，情绪各掉一档，其中一位开口吐槽。
 * 洗盘失误、发泄行为以后都挂在这里 —— 事件源各自报，惩罚规则只有这一处。
 *
 * 不消耗 flow.rng：顾客流的 RNG 调用顺序一变，之后每一单都错位（见 customer.ts）。
 */
import { orderPatienceLeft, patienceRatio } from './customer'
import type { Customer, CustomerFlow } from './customer'

export type Mishap = 'burnt'

/** 一次事故 = 当前那段耐心掉 1/4，正好是 moodTier 的一档 */
export const WITNESS_PENALTY = 0.25

/** 进门到柜台之前那段在店外，看不见厨房 */
export function canWitness(st: CustomerFlow, c: Customer): boolean {
  if (!c.active || c.late) return false
  if (c.ordered) return true
  const take = st.flow.takeOrder
  return !take || orderPatienceLeft(st, c) < take.patienceSec
}

/**
 * 记一次事故：每位看得见的顾客扣耐心，返回开口吐槽的那位（没人看见返回 null）。
 * 开口的是扣之前最满意的那位 —— 他掉得最明显，吐槽也最有落差。并列取排在前面的。
 * 扣到 0 不在这里结算，下一帧 stepCustomerFlow 照常按超时处理。
 */
export function witnessMishap(st: CustomerFlow, _kind: Mishap): Customer | null {
  let speaker: Customer | null = null
  let best = -1
  const take = st.flow.takeOrder
  for (const c of st.customers) {
    if (!canWitness(st, c)) continue
    const k = patienceRatio(st, c)
    if (k > best) {
      best = k
      speaker = c
    }
    if (c.ordered) c.patienceLeft = Math.max(0, c.patienceLeft - WITNESS_PENALTY * c.patienceMax)
    else if (take) c.orderWait += WITNESS_PENALTY * take.patienceSec
  }
  return speaker
}
