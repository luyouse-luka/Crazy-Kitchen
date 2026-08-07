/**
 * M1 的参数扫描台。`pnpm sim <命令>`
 *
 * 这里不是游戏代码 —— 它不进包体，只是把 logic/sim.ts 跑上千次并把数字摆出来。
 * 所以允许用 Node 的东西（下面局部 declare，不引 @types/node，
 * 免得 logic/ 也跟着能用 process/Buffer —— 那些在微信小游戏构建里不存在）。
 */
import { runDay, defaultSimConfig } from '../game/assets/logic/sim'
import type { DayResult, SimConfig } from '../game/assets/logic/sim'
import { difficultyForDay, LAST_DAY } from '../game/assets/logic/difficulty'

declare const process: { argv: string[]; exit(code?: number): void }
declare const console: { log(...args: unknown[]): void }

/** 每个参数点跑多少个 seed 取平均。单局几毫秒，跑满不心疼。 */
const SEEDS = 32

export interface Agg {
  arrived: number
  served: number
  timedOut: number
  burnt: number
  completion: number
  badReview: number
  idle: number
  peak: number
}

export function runMany(base: SimConfig, seeds = SEEDS): Agg {
  const acc: Agg = { arrived: 0, served: 0, timedOut: 0, burnt: 0, completion: 0, badReview: 0, idle: 0, peak: 0 }
  for (let s = 0; s < seeds; s++) {
    const r: DayResult = runDay({ ...base, seed: 1000 + s * 7919 })
    acc.arrived += r.arrived
    acc.served += r.served
    acc.timedOut += r.timedOut
    acc.burnt += r.burnt
    acc.completion += r.completionRate
    acc.badReview += r.badReviewRate
    acc.idle += r.idleSec
    acc.peak += r.peakConcurrent
  }
  for (const k of Object.keys(acc) as (keyof Agg)[]) acc[k] /= seeds
  return acc
}

const pct = (x: number) => (x * 100).toFixed(0).padStart(4) + '%'
const num = (x: number, w = 5, d = 1) => x.toFixed(d).padStart(w)

// ─────────────────────────── crash：同时几单开始崩 ───────────────────────────

/**
 * M1 验收判据之一：**同时几单开始崩？**
 *
 * 做法是把「同时在场上限」当自变量，客流压到必然满员，其余固定。
 * 这样 maxConcurrent 就等于「玩家同时要盯几单」，不掺客流节奏的干扰。
 */
function cmdCrash(): void {
  const base = defaultSimConfig()
  console.log('同时在场上限 → 理想玩家还撑不撑得住（客流压满，其余取基准值）\n')
  console.log('同时单数  完成率  差评率  烤糊  空闲(s)  实际峰值')
  let prev = 1
  let crashAt = 0
  for (let n = 1; n <= 8; n++) {
    const a = runMany({
      ...base,
      durationSec: 210,
      flow: { intervalSec: 2, intervalJitter: 0, maxConcurrent: n, patienceSec: 45 },
    })
    console.log(
      String(n).padStart(6),
      pct(a.completion).padStart(8),
      pct(a.badReview).padStart(7),
      num(a.burnt, 6, 1),
      num(a.idle, 8, 1),
      num(a.peak, 9, 1),
    )
    if (crashAt === 0 && a.completion < 0.6 && prev >= 0.6) crashAt = n
    prev = a.completion
  }
  console.log(
    crashAt > 0
      ? `\n→ 崩点：同时 ${crashAt} 单时理想玩家的完成率跌破 60%。真人会更早崩。`
      : '\n→ 在 1–8 单区间内没跌破 60%，把 durationSec 或订单复杂度调高再扫。',
  )
}

// ─────────────────────────── sweep：扫单维 ───────────────────────────

const DIMENSIONS: Record<string, { values: number[]; apply(c: SimConfig, v: number): SimConfig; label: string }> = {
  interval: {
    label: '客流间隔(s)',
    values: [25, 20, 16, 14, 12, 10, 8, 6],
    apply: (c, v) => ({ ...c, flow: { ...c.flow, intervalSec: v } }),
  },
  patience: {
    label: '顾客耐心(s)',
    values: [90, 75, 60, 50, 45, 40, 35, 30, 25],
    apply: (c, v) => ({ ...c, flow: { ...c.flow, patienceSec: v } }),
  },
  spread: {
    label: '工位间距倍数',
    values: [0.5, 0.75, 1, 1.25, 1.5, 2, 3],
    apply: (c, v) => ({ ...c, layout: { ...c.layout, spread: v } }),
  },
  slots: {
    label: '烤炉槽位',
    values: [1, 2, 3, 4],
    apply: (c, v) => ({ ...c, grillSlots: v }),
  },
  extras: {
    label: '额外配料数',
    values: [0, 1, 2, 3, 4],
    apply: (c, v) => ({ ...c, orders: { ...c.orders, extraMin: v, extraMax: v } }),
  },
  speed: {
    label: '移动速度(m/s)',
    values: [2, 3, 4, 5, 6],
    apply: (c, v) => ({ ...c, chef: { ...c.chef, speed: v } }),
  },
  interact: {
    label: '单次操作耗时(s)',
    values: [0.2, 0.3, 0.4, 0.6, 0.8, 1.0],
    apply: (c, v) => ({ ...c, chef: { ...c.chef, interactSec: v } }),
  },
}

function cmdSweep(name: string): void {
  const dim = DIMENSIONS[name]
  if (!dim) {
    console.log(`未知维度 ${name}。可用：${Object.keys(DIMENSIONS).join(' ')}`)
    process.exit(1)
    return
  }
  const base = { ...defaultSimConfig(), durationSec: 210 }
  console.log(`扫「${dim.label}」，其余取基准值，每点 ${SEEDS} 局取平均\n`)
  console.log(dim.label.padEnd(16), '完成率  差评率  到店  完成  超时  烤糊  空闲(s)')
  for (const v of dim.values) {
    const a = runMany(dim.apply(base, v))
    console.log(
      String(v).padStart(dim.label.length > 8 ? 10 : 6).padEnd(16),
      pct(a.completion),
      pct(a.badReview).padStart(7),
      num(a.arrived, 6),
      num(a.served, 6),
      num(a.timedOut, 6),
      num(a.burnt, 6),
      num(a.idle, 8),
    )
  }
}

// ─────────────────────────── day：单局细节 ───────────────────────────

function cmdDay(): void {
  const r = runDay({ ...defaultSimConfig(), durationSec: 210, trace: true })
  for (const line of r.trace) console.log(line)
  console.log(
    `\n到店 ${r.arrived} · 完成 ${r.served} · 超时 ${r.timedOut} · 上错 ${r.wrong} · 烤糊 ${r.burnt}`,
    `\n完成率 ${(r.completionRate * 100).toFixed(0)}% · 差评率 ${(r.badReviewRate * 100).toFixed(0)}%`,
    `· 峰值同时 ${r.peakConcurrent} 单 · 空闲 ${r.idleSec.toFixed(1)}s`,
  )
}

// ─────────────────────────── curve：难度曲线表 ───────────────────────────

/**
 * M1 的验收判据：一条命令跑出「第 N 天、理想玩家的完成率与差评率」曲线。
 *
 * 目标带是 78%–98%：低于 78% 说明这一天连理想玩家都撑不住，真人毫无希望；
 * 高于 98% 说明这一天没有任何压力，白过一天。
 */
function cmdCurve(): void {
  const base = { ...defaultSimConfig(), durationSec: 210 }
  console.log('第 1→20 天难度曲线 · 理想玩家表现（每天 32 局取平均）\n')
  console.log('天  间隔  耐心  同时  配料  禁料   完成率  差评率   完成  超时  烤糊  空闲   星级线(1/2/3)')

  let outOfBand = 0
  for (let day = 1; day <= LAST_DAY; day++) {
    const d = difficultyForDay(day)
    const a = runMany({ ...base, flow: d.flow, orders: d.orders })
    // 第 1–3 天是教学关，理想玩家接近满分本来就应该，只卡下界
    const tooEasy = day > 3 && a.completion > 0.98
    const tooHard = a.completion < (day <= 3 ? 0.92 : 0.78)
    const flag = tooEasy || tooHard ? ' ⚠' : ''
    if (flag) outOfBand++
    console.log(
      String(day).padStart(2),
      num(d.flow.intervalSec, 5),
      num(d.flow.patienceSec, 5),
      String(d.flow.maxConcurrent).padStart(5),
      String(d.orders.extraMax).padStart(5),
      num(d.orders.bannedChance, 6, 2),
      pct(a.completion).padStart(8),
      pct(a.badReview).padStart(7),
      num(a.served, 6),
      num(a.timedOut, 5),
      num(a.burnt, 5),
      num(a.idle, 6),
      `   ${d.stars.one}/${d.stars.two}/${d.stars.three}`,
      flag,
    )
  }
  console.log(
    outOfBand === 0
      ? '\n✅ 全 20 天都落在目标带内（教学期 1–3 天 ≥92%，之后 78%–98%）'
      : `\n⚠ 有 ${outOfBand} 天落在目标带外，调 difficulty.ts 的曲线参数`,
  )
}

// ─────────────────────────── 入口 ───────────────────────────

const [, , cmd, arg] = process.argv

switch (cmd) {
  case 'crash':
    cmdCrash()
    break
  case 'sweep':
    cmdSweep(arg ?? 'interval')
    break
  case 'day':
    cmdDay()
    break
  case 'curve':
    cmdCurve()
    break
  default:
    console.log(`用法：
  pnpm sim crash          同时几单开始崩（M1 验收判据）
  pnpm sim sweep <维度>   扫单个参数：${Object.keys(DIMENSIONS).join(' / ')}
  pnpm sim day            跑一局并打印时间线
  pnpm sim curve          第 1→20 天的难度曲线表`)
}
