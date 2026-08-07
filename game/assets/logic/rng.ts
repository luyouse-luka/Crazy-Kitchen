/**
 * 可复现的伪随机源（mulberry32）。
 *
 * **为什么不用 Math.random**：M1 要扫参数空间——「耐心 45 秒」和「耐心 50 秒」哪个更难，
 * 只有在两次跑的客流、订单完全一样时才比得出来。用 Math.random 的话，
 * 观测到的差异里混着随机噪声，参数结论全不可信（这正是「两个比对量共享污染源」那条铁律的反面：
 * 这里要的是**消除**变量，不是比不变量）。
 *
 * 状态是一个 number，除 createRng 外全程零分配（铁律②）。
 */
export interface Rng {
  s: number
}

export function createRng(seed: number): Rng {
  return { s: seed >>> 0 }
}

/** 把已有的发生器拨回起点。跑上千局时复用同一个对象，不新建。 */
export function reseed(rng: Rng, seed: number): void {
  rng.s = seed >>> 0
}

/** [0, 1) */
export function nextFloat(rng: Rng): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0
  let t = rng.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** [0, maxExclusive) 的整数 */
export function nextInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(nextFloat(rng) * maxExclusive)
}

/** [lo, hi) 的浮点。lo === hi 时恒返回 lo —— 扫参数时经常把某一维锁死。 */
export function nextRange(rng: Rng, lo: number, hi: number): number {
  return lo + nextFloat(rng) * (hi - lo)
}

/** 从数组里等概率取一个。空数组是调用方的错误。 */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[nextInt(rng, arr.length)]!
}

/** 以概率 p 返回 true。p ≤ 0 恒假，p ≥ 1 恒真。 */
export function chance(rng: Rng, p: number): boolean {
  return nextFloat(rng) < p
}
