/**
 * 难度曲线：第 1 天 → 第 20 天各参数取值。M1 的交付物，M3/M4 直接调。
 *
 * ## 设计目标
 *
 * **理想玩家的完成率全程保持在 78%–98%。** 不是让他崩 —— 他崩了真人就毫无希望。
 * 真人比理想玩家差 30–50%（M3 会实测这个差值），压力就是从这个差里来的。
 *
 * ## 选哪几个旋钮，是实测挑出来的（`pnpm sim sweep <维度>`）
 *
 * | 旋钮 | 基准 53% 出发的跨度 | 判断 |
 * |---|---|---|
 * | 工位间距 0.5→2 | 89% → 6% | 最强，但**这是升级项不是难度**（M4 花钱买「工位更近」），不进曲线 |
 * | 额外配料数 0→4 | 75% → 9% | 极陡，加一样掉 20pt+，**只在中后期慢慢加** |
 * | 客流间隔 25→6s | 89% → 16% | 主旋钮，手感最平滑 |
 * | 单次操作耗时 0.2→1s | 72% → 7% | 手感参数，不该拿来调难度 |
 * | **顾客耐心 90→25s** | **63% → 40%** | ⚠ **最弱的旋钮，只有 23pt** —— 见下 |
 *
 * ### ⚠ 反直觉的两条，别照直觉改回去
 *
 * **① 顾客耐心几乎调不动难度。** 耐心从 90 秒砍到 25 秒（3.6 倍）只掉 23pt。
 * 因为瓶颈是玩家的**操作吞吐量**，不是顾客肯等多久：客流 12 秒来一个、玩家做一单要 15 秒，
 * 队伍必然堆积，给再多耐心也做不完。**耐心只在客流不饱和时才是有效旋钮。**
 * 所以曲线里它只做小幅收紧（60→45s），指望它扛难度是白费。
 *
 * **② `bannedChance` 对理想玩家完全零成本** —— 他不会放错，所以这一维怎么加都不影响上面的曲线。
 * 但它对真人是主要出错源（「我都说了不要洋葱」）。**这是唯一一个只压真人、不压理想玩家的旋钮**，
 * 因此可以放心地一路加到 0.5，不会把曲线带崩。
 */
import type { FlowParams, OrderDifficulty } from './sim'

export const LAST_DAY = 20

export interface DayDifficulty {
  day: number
  flow: FlowParams
  orders: OrderDifficulty
  /** 三星评分线，单位是「当天完成的单数」 */
  stars: { one: number; two: number; three: number }
}

/**
 * 每天的理想玩家完成单数（`pnpm sim curve` 实测，32 局取平均后向下取整）。
 * 星级线按它的比例定，所以这张表变了星级线要跟着重算。
 */
const IDEAL_SERVED: readonly number[] = [
  9, 9, 9, 10, 10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 11, 12, 12, 11, 11, 11,
]
// 注意第 18–20 天反而回落（12 → 11）：后期订单变复杂，理想玩家自己也开始丢单。
// 这不是表填错了 —— 星级线跟着回落是对的，否则最难的三天三星会变成天堑。

/**
 * 星级门槛占理想完成数的比例。
 *
 * 三星 0.72 —— ROADMAP 要求「三星要理想玩家也得打起精神才够得着」，
 * 但真人比理想玩家差 30–50%，定成 0.9 就没人拿得到，定成 0.5 又白送。
 * 0.72 让手熟的玩家够得着、手生的够不着。M3 拿真人数据回来后要重新校。
 */
const STAR_RATIO = { three: 0.72, two: 0.5, one: 0.3 } as const

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function difficultyForDay(day: number): DayDifficulty {
  const d = Math.max(1, Math.min(LAST_DAY, Math.floor(day)))
  const t = (d - 1) / (LAST_DAY - 1)

  // 额外配料是最陡的一维（加一样掉 20pt+），所以压到最后：
  // 12 天前一样不加，第 16 天才到 1，第 20 天才到 2。
  // 早期版本让它在第 17 天从 1 跳到 2，完成率当场掉 11pt 并一路跌到 60% —— 那一跳太狠了。
  const extraT = Math.max(0, (d - 12) / (LAST_DAY - 12))
  const extraMax = Math.round(lerp(0, 2, extraT))

  const ideal = IDEAL_SERVED[d - 1]!

  return {
    day: d,
    flow: {
      // 只压到 15s 不再往下 —— 订单在后期变复杂了，客流就得同步放松，
      // 两条都压满会把理想玩家直接推下 78% 那条线
      intervalSec: lerp(22, 15.5, t),
      intervalJitter: lerp(0, 0.25, t),
      maxConcurrent: Math.round(lerp(3, 6, t)),
      patienceSec: lerp(60, 45, t),
    },
    orders: {
      extraMin: 0,
      extraMax,
      // 只压真人、不压理想玩家的那一维，放心加满
      bannedChance: lerp(0, 0.5, t),
    },
    stars: {
      three: Math.max(1, Math.round(ideal * STAR_RATIO.three)),
      two: Math.max(1, Math.round(ideal * STAR_RATIO.two)),
      one: Math.max(1, Math.round(ideal * STAR_RATIO.one)),
    },
  }
}

/** 当天完成 served 单该给几颗星。0 = 不及格 */
export function starsFor(served: number, day: number): 0 | 1 | 2 | 3 {
  const { stars } = difficultyForDay(day)
  if (served >= stars.three) return 3
  if (served >= stars.two) return 2
  if (served >= stars.one) return 1
  return 0
}
