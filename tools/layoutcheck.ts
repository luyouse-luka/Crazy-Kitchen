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
import { SPEC } from './scene-spec'
import { navigation, specBox } from './layout-navigation'
import { CHEF_RADIUS } from '../game/assets/logic/movement'

declare const process: { exit(code?: number): void }
declare const console: { log(...args: unknown[]): void }

// ─────────────────────────── 待验摆位 ───────────────────────────

const nav = navigation()
const AISLE = 1.5
const BASELINE: KitchenLayout = defaultSimConfig().layout
interface Failure { rule: string; detail: string }
function checkGeometry(): Failure[] {
  const bad: Failure[] = []
  const require = (ok: boolean, detail: string) => { if (!ok) bad.push({ rule: '布局', detail }) }
  const edge = (name: string, axis: 'x' | 'z', side: -1 | 1) => {
    const b = specBox(name)
    return b.center[axis] + side * (axis === 'x' ? b.halfX : b.halfZ)
  }
  const passages: Array<[string, number]> = [
    ['中央纵向空地', edge('Station_Serve', 'z', -1) - edge('Station_Grill', 'z', 1)],
    ['中央横向空地', edge('Station_Sink', 'x', -1) - edge('Station_Assembly', 'x', 1)],
    ['冷库门洞', edge('Wall_Store_S', 'x', -1) - edge('Wall_Store_W2', 'x', 1)],
    ['厨房前台东端', edge('Floor', 'x', 1) - edge('Station_Delivery', 'x', 1)],
  ]
  for (const [name, width] of passages) {
    console.log(`   ${name}: ${width.toFixed(2)}m`)
    require(width >= AISLE - 1e-9, `${name} 小于 ${AISLE}m`)
  }
  require(passages[0]![1] >= 3 * 2 * CHEF_RADIUS - 1e-9, '中央空地净宽不足三个身位')
  for (const s of nav.stations) require(nav.access(s).length > 0, `${s.name} 没有可达交互点`)
  for (const [name, x, z] of [['中央空地', 0, 0], ['左侧制作通道', -2.5, 0], ['后场入口', 6.1, 1.5], ['冷库入口', 6.25, -3.1], ['冷库取货', 6.5, -4.5]] as const) require(nav.canReach(x, z), `${name} 不可达`)
  const floors = ['Floor', 'Floor_East', 'Floor_Store'].map(n => specBox(n))
  require(nav.reachable.every(p => floors.some(b => Math.abs(p.x - b.center.x) <= b.halfX && Math.abs(p.z - b.center.z) <= b.halfZ)), '角色可以走到地板外')
  for (const s of nav.stations) require(floors.some(b => Math.abs(s.center.x - b.center.x) + s.halfX <= b.halfX + 1e-9 && Math.abs(s.center.z - b.center.z) + s.halfZ <= b.halfZ + 1e-9), `${s.name} 越出地板`)
  for (let i = 0; i < nav.stations.length; i++) for (let j = i + 1; j < nav.stations.length; j++) {
    const a = nav.stations[i]!, b = nav.stations[j]!
    require(Math.abs(a.center.x - b.center.x) >= a.halfX + b.halfX - 1e-9 || Math.abs(a.center.z - b.center.z) >= a.halfZ + b.halfZ - 1e-9, `${a.name} 与 ${b.name} 重叠`)
  }
  console.log(`   ${nav.reachable.length} 个可达采样点，${nav.stations.length} 个交互工位`)
  return bad
}
const routes = nav.distances()
if (!routes.every(Number.isFinite)) throw new Error('Core stations are disconnected')

// ─────────────────────────── 难度 ───────────────────────────

function asLayout(): KitchenLayout {
  const at = (n: string): { x: number; z: number } => {
    const p = SPEC[n]?.pos
    if (!p) throw new Error(`SPEC missing ${n}`)
    return { x: p[0], z: p[2] }
  }
  return { fridge: at('Station_Fridge'), grill: at('Station_Grill'), assembly: at('Station_Assembly'), serve: at('Station_Serve'), spread: 1, routeDistances: routes }
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
