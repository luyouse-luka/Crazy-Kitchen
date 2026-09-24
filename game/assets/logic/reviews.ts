/**
 * 评价：顾客离店时给的星级 + 营业中的吐槽，按时间记一份，给顶部弹窗和电脑上的评价列表用。
 * 台词是表演层，这里只记「谁、哪一类、几星」，文本由组件按顾客卡去取。
 */
export type ReviewKind = 'witness' | 'praise' | 'complain' | 'walkout' | 'reject'

export interface Review {
  customerId: number
  kind: ReviewKind
  /** 1–5；0 = 营业中的吐槽，不算评分 */
  stars: number
  t: number
}

export interface ReviewLog {
  /** 新的在后面，超出 cap 丢最旧的 */
  items: Review[]
  cap: number
}

export function createReviewLog(cap = 30): ReviewLog {
  return { items: [], cap }
}

export function resetReviewLog(log: ReviewLog): void {
  log.items.length = 0
}

export function addReview(log: ReviewLog, r: Review): void {
  log.items.push(r)
  if (log.items.length > log.cap) log.items.shift()
}

/**
 * 上菜后的星级。`ratioLeft` 取上菜那一刻的 patienceRatio（顾客还没离场时读）。
 * 做对且等得不久 5 星，等久了 4、3；超时才上（免单）2 星；上错 1 星。
 */
export function serveReview(ok: boolean, late: boolean, ratioLeft: number): { kind: ReviewKind; stars: number } {
  if (!ok) return { kind: 'complain', stars: 1 }
  if (late) return { kind: 'complain', stars: 2 }
  return { kind: 'praise', stars: ratioLeft > 0.5 ? 5 : ratioLeft > 0.25 ? 4 : 3 }
}

/** 没人接单走掉的；外卖接了没送到也是这一档 */
export const WALKOUT_STARS = 1

/** 外卖拒单 / 挂着没理：扣一点评分，比做砸了轻 */
export const REJECT_STARS = 3

/** 店铺评分：所有带星的评价取平均，吐槽不算。没有评价返回 0 */
export function averageStars(log: ReviewLog): number {
  let sum = 0
  let n = 0
  for (const r of log.items) {
    if (r.stars <= 0) continue
    sum += r.stars
    n++
  }
  return n > 0 ? sum / n : 0
}
