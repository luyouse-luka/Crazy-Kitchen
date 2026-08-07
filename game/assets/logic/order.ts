/**
 * 订单判定：手上这个汉堡满不满足顾客要求。
 *
 * 这里是「机制层」的终点 —— docs/ai-customer-v1.md §1 的铁律：
 * lines.order 可以用任何离谱的说法描述这些食材和火候，但不能引入机制层不存在的要求。
 * **玩家只要满足了 OrderSpec，判定就必须是成功。**
 */
import { CORE_INGREDIENTS, INGREDIENTS } from './types'
import type { Burger, Ingredient, OrderSpec } from './types'

/**
 * 判定结果。逐项列全而不在第一个错误处短路 —— 评价系统要按具体错项挑 complain，
 * 「缺芝士又放了洋葱」只报一半就没法挑。
 */
export interface OrderVerdict {
  ok: boolean
  /** required 里没做到的 */
  missing: Ingredient[]
  /** banned 里却放了的 */
  forbidden: Ingredient[]
  cookOk: boolean
}

/**
 * 判一单。
 *
 * 额外食材（既不在 required 也不在 banned）**不算错** —— banned 是唯一的否定通道。
 * 顾客没说不要，就不能罚玩家。
 *
 * 会分配一个 verdict 与两个数组：只在上菜那一刻调用，不在每帧热路径上（铁律②）。
 */
export function judge(burger: Burger, spec: OrderSpec): OrderVerdict {
  const missing: Ingredient[] = []
  for (let i = 0; i < spec.required.length; i++) {
    const ing = spec.required[i]!
    if (!burger.ingredients.includes(ing)) missing.push(ing)
  }

  const forbidden: Ingredient[] = []
  for (let i = 0; i < spec.banned.length; i++) {
    const ing = spec.banned[i]!
    if (burger.ingredients.includes(ing)) forbidden.push(ing)
  }

  // cook 为 null（压根没放肉饼）时这里自然为 false，不需要特判
  const cookOk = burger.cook === spec.doneness

  return {
    ok: missing.length === 0 && forbidden.length === 0 && cookOk,
    missing,
    forbidden,
    cookOk,
  }
}

/**
 * 校验一张顾客卡的机制层是否可解。
 *
 * 给内容管线用（pipeline/ 生成 10000 张卡时逐张过），不在运行时调用。
 * 返回问题描述列表，空数组 = 合法。
 *
 * 存在的理由：JSON Schema 能拦住词表外的取值，拦不住「required 与 banned 同时含洋葱」
 * 这种自相矛盾 —— 那种卡进了包体，玩家会遇到一单永远做不出来。
 */
export function validateOrderSpec(spec: OrderSpec): string[] {
  const problems: string[] = []
  const vocabulary = INGREDIENTS as readonly string[]

  for (const ing of spec.required) {
    if (!vocabulary.includes(ing)) problems.push(`required 含词表外食材：${ing}`)
  }
  for (const ing of spec.banned) {
    if (!vocabulary.includes(ing)) problems.push(`banned 含词表外食材：${ing}`)
  }

  for (const ing of spec.required) {
    if (spec.banned.includes(ing)) {
      problems.push(`required 与 banned 同时含 ${ing}，这单永远做不出来`)
    }
  }

  for (const core of CORE_INGREDIENTS) {
    if (!spec.required.includes(core)) problems.push(`required 缺骨架食材 ${core}`)
    if (spec.banned.includes(core)) problems.push(`banned 含骨架食材 ${core}，不成其为汉堡`)
  }

  if (!(spec.patience > 0)) problems.push(`patience 必须为正数，当前 ${spec.patience}`)

  return problems
}
