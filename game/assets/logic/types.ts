/**
 * 全部游戏数据结构。零 Cocos 依赖（铁律①）。
 *
 * 词表是**封闭**的 —— 这是 docs/ai-customer-v1.md §1「机制层 / 表演层分离」的地基：
 * AI 能生成的需求 ≠ 引擎能判定的需求。机制层只认这里的枚举，表演层（lines.*）随便写。
 *
 * 混乱事件（chaos）的类型留到 M4 随 chaos.ts 一起定，现在写只能是猜。
 */
import type { Vec2 } from './vec2'
import type { AABB } from './collision'

// ─────────────────────────── 食材 ───────────────────────────

/**
 * V1 食材词表。GDD 原稿只有 面包/牛肉/芝士 三种，这里扩到 8 种是刻意的：
 * 只有三种时 banned 毫无意义（禁掉任一样汉堡就不成立），
 * 而「我都说了不要洋葱」正是评价系统最有梗的一类反馈。
 */
export const INGREDIENTS = [
  'bun',
  'patty',
  'cheese',
  'lettuce',
  'tomato',
  'onion',
  'pickle',
  'bacon',
] as const

export type Ingredient = (typeof INGREDIENTS)[number]

/** 骨架食材：任何汉堡都必须有，生成顾客卡时恒在 required。 */
export const CORE_INGREDIENTS = ['bun', 'patty'] as const satisfies readonly Ingredient[]

// ─────────────────────────── 火候 ───────────────────────────

/**
 * 烤炉上的一条时间轴：raw → rare → medium → well → burnt。
 *
 * 顾客只会要求中间三档（见 DONENESS）；raw 和 burnt 都是失败状态，
 * burnt 同时是 M4「烤糊 → 起火 → 灭火器」那条混乱链的起点。
 */
export const COOK_LEVELS = ['raw', 'rare', 'medium', 'well', 'burnt'] as const

export type CookLevel = (typeof COOK_LEVELS)[number]

/** 顾客能点的火候。三档对应烤炉计时窗口，也是「牛肉火候完美 +20」这条评价的机制来源。 */
export const DONENESS = ['rare', 'medium', 'well'] as const

export type Doneness = Extract<CookLevel, 'rare' | 'medium' | 'well'>

/** 烤炉三档的时间窗口（秒）。M1 的无头模拟器会扫这组参数，别把数值写死在别处。 */
export interface CookWindows {
  /** 到这个时刻之前都是 raw */
  rareAt: number
  mediumAt: number
  wellAt: number
  /** 超过这个时刻变 burnt */
  burntAt: number
}

// ─────────────────────────── 订单 ───────────────────────────

/** 机制层：引擎据此判定成败，取值受词表约束。 */
export interface OrderSpec {
  required: Ingredient[]
  banned: Ingredient[]
  doneness: Doneness
  /** 秒。引擎倒计时，M1 标定的核心参数之一 */
  patience: number
}

// ─────────────────────────── 顾客卡 ───────────────────────────

/**
 * 表演层：玩家阅读，纯展示，不参与判定。
 *
 * 字数上限不是排版洁癖 —— 玩家一边跑冰箱一边烤肉时没有一秒能读长台词。
 * 笑点必须压进 `order` 那一句，因为那句玩家**必须**读（不读做不出来）。
 */
export interface CustomerLines {
  /** ≤12 字 */
  greet: string
  /** ≤30 字 · 主笑点载体 */
  order: string
  /** ≤15 字 */
  wait_nudge: string
  /** ≤20 字 */
  praise: string
  /** ≤20 字 */
  complain: string
}

/**
 * 台词字数上限（字符数）。生成管线与夹具都按这个收，超了就是塞不进 UI。
 * 数值来自 docs/ai-customer-v1.md §3 —— 那里论证了为什么这不是排版洁癖。
 */
export const LINE_LIMITS = {
  identity: 10,
  greet: 12,
  order: 30,
  wait_nudge: 15,
  praise: 20,
  complain: 20,
} as const

export const MOODS = [
  'cheerful',
  'grumpy',
  'anxious',
  'dreamy',
  'menacing',
  'heartbroken',
  'manic',
  'deadpan',
] as const

export type Mood = (typeof MOODS)[number]

/** 长线剧情：一条 arc 是一组共享 series_id、按 chapter 排序的卡，由 unlock_day 控制出现时机。 */
export interface CustomerArc {
  series_id: string
  chapter: number
  unlock_day: number
}

export interface CustomerCard {
  id: string
  order: OrderSpec
  /** ≤10 字 */
  identity: string
  mood: Mood
  lines: CustomerLines
  arc: CustomerArc | null
}

// ─────────────────────────── 成品 ───────────────────────────

/** 玩家手上/盘子里的那个汉堡。 */
export interface Burger {
  ingredients: Ingredient[]
  /** 没放肉饼时为 null；放了就跟着烤炉走 raw→…→burnt */
  cook: CookLevel | null
}

// ─────────────────────────── 场地 ───────────────────────────

export const STATION_KINDS = ['fridge', 'grill', 'assembly', 'serve', 'sink'] as const

export type StationKind = (typeof STATION_KINDS)[number]

/**
 * 工位。`box` 用于「角色别穿过灶台」，`triggerRange` 用于「够不够得着」——
 * 两者是不同的判定，边界语义也不同（见 collision.ts）。
 *
 * 命名对应编辑器里的 `Station_<名>` 节点（ROADMAP §6.2）。
 */
export interface Station {
  id: string
  kind: StationKind
  pos: Vec2
  box: AABB
  triggerRange: number
}
