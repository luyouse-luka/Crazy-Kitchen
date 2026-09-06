/**
 * 场景摆位的验收判据。`pnpm layout`
 *
 * 存在的理由：M1 标定难度曲线时用的是 `defaultSimConfig().layout` 那套坐标。
 * 场景一摆，实际坐标就换了一套 —— 跑腿距离变了，那条曲线不再成立。
 * **一圈路径长度不是可靠指标**：实测过一套一圈同为 17.20m 的摆位，
 * 后期完成率掉到 59.9%，因为真实动线是 F↔G↔A 之间的往返，不是环形一圈。
 * 所以这里既查几何硬约束，也真的把 sim 跑一遍对比基线。
 *
 * 摆位一改（M3 的「工位间距」旋钮、或场景里挪了工位）就重跑这个。
 */
import { runDay, defaultSimConfig } from '../game/assets/logic/sim'
import type { DayResult, KitchenLayout, SimConfig } from '../game/assets/logic/sim'
import { difficultyForDay, LAST_DAY } from '../game/assets/logic/difficulty'

declare const process: { exit(code?: number): void }
declare const console: { log(...args: unknown[]): void }

// ─────────────────────────── 待验摆位 ───────────────────────────

/** 地板内沿。工位 AABB 必须落在里面 */
const FLOOR = { xmin: -4, xmax: 4, zmin: -3, zmax: 3 }
/** 通道下限（m2-scene-guide §7）。玩家直径 0.7，1.5 是约两倍 */
const AISLE = 1.5

interface Placed { name: string; x: number; z: number; w: number; d: number }

/** docs/m2-scene-guide.md §2.3 的定稿。场景里挪了工位就同步改这里 */
const PLACED: Placed[] = [
  { name: 'Station_Fridge', x: 2, z: -2.5, w: 1, d: 1 },
  { name: 'Station_Grill', x: -2, z: -2.5, w: 1, d: 1 },
  { name: 'Station_Assembly', x: -3.5, z: 0, w: 1, d: 1 },
  { name: 'Station_Serve', x: -1, z: 2.5, w: 2, d: 1 },
]

/** M1 标定曲线时用的那套坐标 —— 难度基线的来源，不要改 */
const BASELINE: KitchenLayout = defaultSimConfig().layout

// ─────────────────────────── 几何 ───────────────────────────

interface Box { x0: number; x1: number; z0: number; z1: number }
const toBox = (p: Placed): Box => ({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2 })

/** Euclidean gap, so diagonal slots count too — projected-only checks miss them */
function gapBetween(a: Box, b: Box): number {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0)
  const dz = Math.max(a.z0 - b.z1, b.z0 - a.z1, 0)
  return Math.hypot(dx, dz)
}

/** Segment vs AABB, slab method. The sim's chef walks straight lines; a real player cannot walk through a bench. */
function segmentHitsBox(px: number, pz: number, qx: number, qz: number, b: Box): boolean {
  let t0 = 0
  let t1 = 1
  const seg = [qx - px, qz - pz]
  const lo = [b.x0, b.z0]
  const hi = [b.x1, b.z1]
  const org = [px, pz]
  for (let i = 0; i < 2; i++) {
    if (Math.abs(seg[i]!) < 1e-9) {
      if (org[i]! < lo[i]! || org[i]! > hi[i]!) return false
      continue
    }
    let a = (lo[i]! - org[i]!) / seg[i]!
    let c = (hi[i]! - org[i]!) / seg[i]!
    if (a > c) {
      const t = a
      a = c
      c = t
    }
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, c)
    if (t0 > t1) return false
  }
  return true
}

interface Failure { rule: string; detail: string }

function checkGeometry(): Failure[] {
  const bad: Failure[] = []
  const boxes = PLACED.map(toBox)

  PLACED.forEach((p, i) => {
    const b = boxes[i]!
    const edges: Array<[string, number]> = [
      ['西', b.x0 - FLOOR.xmin], ['东', FLOOR.xmax - b.x1],
      ['北', b.z0 - FLOOR.zmin], ['南', FLOOR.zmax - b.z1],
    ]
    for (const [side, g] of edges) {
      if (g < -1e-9) bad.push({ rule: '出界', detail: `${p.name} ${side}侧越出地板 ${(-g).toFixed(2)}m` })
      // 贴死(0) 或 ≥1.5，中间那档是玩家会卡进去的死角
      else if (g > 1e-9 && g < AISLE) {
        bad.push({ rule: '死角', detail: `${p.name} 与${side}边界隔 ${g.toFixed(2)}m —— 贴死或留够 ${AISLE}m` })
      }
    }
  })

  for (let i = 0; i < PLACED.length; i++) {
    for (let j = i + 1; j < PLACED.length; j++) {
      const g = gapBetween(boxes[i]!, boxes[j]!)
      if (g < AISLE - 1e-9) {
        bad.push({ rule: '通道窄', detail: `${PLACED[i]!.name} ↔ ${PLACED[j]!.name} 只有 ${g.toFixed(2)}m` })
      }
    }
  }

  for (let i = 0; i < PLACED.length; i++) {
    for (let j = i + 1; j < PLACED.length; j++) {
      for (let k = 0; k < PLACED.length; k++) {
        if (k === i || k === j) continue
        const a = PLACED[i]!
        const b = PLACED[j]!
        if (segmentHitsBox(a.x, a.z, b.x, b.z, boxes[k]!)) {
          bad.push({ rule: '动线穿模', detail: `${a.name} → ${b.name} 的直线穿过 ${PLACED[k]!.name}` })
        }
      }
    }
  }
  return bad
}

// ─────────────────────────── 难度 ───────────────────────────

function asLayout(): KitchenLayout {
  const at = (n: string): { x: number; z: number } => {
    const p = PLACED.find((q) => q.name === n)
    if (!p) throw new Error(`PLACED 里缺 ${n}`)
    return { x: p.x, z: p.z }
  }
  return { fridge: at('Station_Fridge'), grill: at('Station_Grill'), assembly: at('Station_Assembly'), serve: at('Station_Serve'), spread: 1 }
}

interface Curve { completion: number; late: number; idle: number; outOfBand: number }

/** 同 sim-cli 的 runMany，就地写一份 —— import 它会触发那边的顶层 main */
function average(base: SimConfig, seeds: number): { completion: number; idle: number } {
  let completion = 0
  let idle = 0
  for (let s = 0; s < seeds; s++) {
    const r: DayResult = runDay({ ...base, seed: 1000 + s * 7919 })
    completion += r.completionRate
    idle += r.idleSec
  }
  return { completion: completion / seeds, idle: idle / seeds }
}

function runCurve(layout: KitchenLayout, seeds: number): Curve {
  let sum = 0
  let late = 0
  let idle = 0
  let out = 0
  for (let day = 1; day <= LAST_DAY; day++) {
    const d = difficultyForDay(day)
    const a = average({ ...defaultSimConfig(), layout, flow: d.flow, orders: d.orders }, seeds)
    sum += a.completion
    idle += a.idle
    if (day >= LAST_DAY - 2) late += a.completion
    if ((day > 3 && a.completion > 0.98) || a.completion < (day <= 3 ? 0.92 : 0.78)) out++
  }
  return { completion: sum / LAST_DAY, late: late / 3, idle: idle / LAST_DAY, outOfBand: out }
}

const pct = (v: number): string => (v * 100).toFixed(1) + '%'

function main(): void {
  console.log('── 几何判据（m2-scene-guide §7 / §2.3）')
  const bad = checkGeometry()
  if (bad.length === 0) console.log('   OK：边界、通道 ≥1.5m、动线不穿模，全部通过')
  else for (const f of bad) console.log(`   ✗ [${f.rule}] ${f.detail}`)

  console.log('\n── 难度判据：跑 20 天曲线，与 M1 标定布局对比')
  const mine = runCurve(asLayout(), 32)
  const base = runCurve(BASELINE, 32)
  const row = (n: string, c: Curve): void =>
    console.log(`   ${n.padEnd(12)} 完成率 ${pct(c.completion)}  后期 ${pct(c.late)}  idle ${c.idle.toFixed(1)}s  带外 ${c.outOfBand} 天`)
  row('M1 基线', base)
  row('场景摆位', mine)

  // idle 是最灵敏的一维：完成率还没动的时候它已经先动了
  const dIdle = (mine.idle - base.idle) / base.idle
  const dLate = mine.late - base.late
  console.log(`   偏差：idle ${(dIdle * 100).toFixed(1)}%  后期完成率 ${(dLate * 100).toFixed(1)}pt`)

  const fails: string[] = []
  if (bad.length > 0) fails.push(`${bad.length} 条几何判据`)
  if (mine.outOfBand > 0) fails.push(`难度曲线 ${mine.outOfBand} 天掉出 0.78–0.98 带`)
  if (Math.abs(dIdle) > 0.1) fails.push(`idle 偏离基线 ${(dIdle * 100).toFixed(1)}%（>10% 说明难度已经变了，要么改摆位要么重标定 difficulty.ts）`)
  if (Math.abs(dLate) > 0.05) fails.push(`后期完成率偏离 ${(dLate * 100).toFixed(1)}pt（>5pt 同上）`)

  if (fails.length === 0) {
    console.log('\n✅ 摆位通过：几何可走，难度与 M1 标定一致')
    return
  }
  console.log('\n❌ 不通过：')
  for (const f of fails) console.log('   ·', f)
  process.exit(1)
}

main()
