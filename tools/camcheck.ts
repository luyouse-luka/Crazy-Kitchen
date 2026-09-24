/**
 * 相机跟随的验收判据。`pnpm cam`
 *
 * 回答三个拍脑袋答不上来的问题：
 * 1. **两端黑边**有多宽 —— 内容的水平投影跨度 ÷ 画面宽
 * 2. **人物有多小** —— 角色高 ÷ 画面高
 * 3. `orthoHeight` 拉到多近，开始有可达位置看不见烤炉、或把玩家自己裁出画面
 *
 * 前两条是用户的原话（「两端全是黑色」「场景大就显得人物小」）量化后的样子，
 * 第三条是拉近的代价。三者互相拉扯，这张表就是拍板的依据。
 *
 * 相机三轴从 main.scene 的四元数复算，不信 camera.ts 里那几个常量：
 * 场景里动过相机而常量没跟着改，这里先红。
 */
declare const process: { argv: string[]; exit(code?: number): void }
declare const console: { log(...args: unknown[]): void }

// @ts-expect-error Node builtin, typed locally — same stance as scenedump.ts.
import * as nodeFs from 'node:fs'
const { readFileSync } = nodeFs as { readFileSync(p: string, enc: 'utf8'): string }

import { SPEC } from './scene-spec'
import { CHEF_RADIUS, FLOOR_BOUNDS } from '../game/assets/logic/movement'
import {
  CAMERA_OFFSET,
  CAMERA_RIGHT,
  CAMERA_UP,
  CONTENT_SPAN,
  CORE_SPAN,
  ORTHO_HEIGHT,
  EDGE_MARGIN,
  UK,
  VK,
  effectiveOrthoHeight,
  focusBounds,
  focusForPlayer,
} from '../game/assets/logic/camera'
import type { FocusBounds } from '../game/assets/logic/camera'

// ─────────────────────────── 场景读数 ───────────────────────────

interface V3 { x: number; y: number; z: number }
interface Quat { x: number; y: number; z: number; w: number }

function rotate(q: Quat, v: V3): V3 {
  const tx = 2 * (q.y * v.z - q.z * v.y)
  const ty = 2 * (q.z * v.x - q.x * v.z)
  const tz = 2 * (q.x * v.y - q.y * v.x)
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  }
}

interface CamRead { pos: V3; right: V3; up: V3; orthoHeight: number }

function readCamera(scenePath: string): CamRead {
  const arr = JSON.parse(readFileSync(scenePath, 'utf8')) as Array<Record<string, unknown>>
  let node: Record<string, unknown> | undefined
  for (const o of arr) if (o['__type__'] === 'cc.Node' && o['_name'] === 'Main Camera') node = o
  if (!node) throw new Error(`${scenePath} 里没有 Main Camera 节点`)
  let cam: Record<string, unknown> | undefined
  for (const r of node['_components'] as Array<{ __id__: number }>) {
    const c = arr[r.__id__]
    if (c && c['__type__'] === 'cc.Camera') cam = c
  }
  if (!cam) throw new Error('Main Camera 上没有 cc.Camera')
  if (cam['_projection'] !== 0) throw new Error('Main Camera 不是正交投影，这套几何不成立')
  const q = node['_lrot'] as Quat
  return {
    pos: node['_lpos'] as V3,
    right: rotate(q, { x: 1, y: 0, z: 0 }),
    up: rotate(q, { x: 0, y: 1, z: 0 }),
    orthoHeight: cam['_orthoHeight'] as number,
  }
}

// ─────────────────────────── 视图投影 ───────────────────────────

interface Box3 { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

/** AABB 的 8 个角投影后的包围。正交投影下这就是它在画面上的准确占位 */
function spanOf(b: Box3, fx: number, fz: number, cam: CamRead): FocusBounds {
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
    const dx = x - fx, dz = z - fz
    const u = dx * cam.right.x + y * cam.right.y + dz * cam.right.z
    const v = dx * cam.up.x + y * cam.up.y + dz * cam.up.z
    if (u < umin) umin = u
    if (u > umax) umax = u
    if (v < vmin) vmin = v
    if (v > vmax) vmax = v
  }
  return { umin, umax, vmin, vmax }
}

const specBox = (name: string): Box3 => {
  const s = SPEC[name]
  if (!s?.pos || !s.scale) throw new Error(`scene-spec 里 ${name} 缺 pos/scale`)
  const [px, py, pz] = s.pos
  const [sx, sy, sz] = s.scale
  return { x0: px - sx / 2, x1: px + sx / 2, y0: py - sy / 2, y1: py + sy / 2, z0: pz - sz / 2, z1: pz + sz / 2 }
}

const STATIONS = ['Station_Fridge', 'Station_Grill', 'Station_Assembly', 'Station_Serve']
/** 画面里「应该有东西」的部分 —— 跟随的边界 */
const CONTENT = ['Floor', 'Floor_East', 'Floor_Store', 'Floor_Customer', 'Wall_N', 'Wall_E', 'Wall_StoreBack']
/** 主厨房 + 顾客区 —— 只决定窄屏拉不拉远（CORE_SPAN） */
const CORE = ['Floor', 'Floor_Customer']
/** 挡路但不能交互的，只用来排除不可达位置 */
const BLOCKERS = Object.keys(SPEC).filter((k) => k === 'Wall_E' || k.startsWith('Block_') || k.startsWith('Wall_Store_'))
/**
 * 唯一有计时压力的工位 —— 烤炉会糊。厨房加了东翼以后，人在库房时它必然出画面，
 * 所以这一项只报数不判红；火候靠贴边的烤炉气泡补（Bubble.follow 的 clamp）。
 */
const CRITICAL = 'Station_Grill'

/** 角色总高，米。出处：scene-spec 的 Anchor_Hand y=1.75 */
const CHEF_HEIGHT = 1.75

const playerBox = (x: number, z: number): Box3 => ({
  x0: x - CHEF_RADIUS, x1: x + CHEF_RADIUS, y0: 0, y1: CHEF_HEIGHT,
  z0: z - CHEF_RADIUS, z1: z + CHEF_RADIUS,
})

// ─────────────────────────── 玩家可达位置 ───────────────────────────

const STEP = 0.1

function reachable(): Array<[number, number]> {
  const boxes = [...STATIONS, 'Station_Storeroom', 'Station_Order', 'Station_Delivery', 'Station_Sink', ...BLOCKERS].map(specBox)
  const r = CHEF_RADIUS
  const nx = Math.floor((FLOOR_BOUNDS.xmax - FLOOR_BOUNDS.xmin - 2 * r) / STEP + 1e-9) + 1
  const nz = Math.floor((FLOOR_BOUNDS.zmax - FLOOR_BOUNDS.zmin - 2 * r) / STEP + 1e-9) + 1
  const at = (i: number, j: number): [number, number] => [FLOOR_BOUNDS.xmin + r + i * STEP, FLOOR_BOUNDS.zmin + r + j * STEP]
  const free = (i: number, j: number): boolean => {
    const [x, z] = at(i, j)
    for (const b of boxes) {
      const dx = Math.max(b.x0 - x, 0, x - b.x1)
      const dz = Math.max(b.z0 - z, 0, z - b.z1)
      if (dx * dx + dz * dz < r * r - 1e-9) return false
    }
    return true
  }
  // Flood from the spawn: the floor's bounding box has a walled-off corner south of the storeroom
  const seen = new Set<number>()
  const i0 = Math.round((0 - FLOOR_BOUNDS.xmin - r) / STEP)
  const j0 = Math.round((0 - FLOOR_BOUNDS.zmin - r) / STEP)
  const stack = [[i0, j0]]
  const out: Array<[number, number]> = []
  while (stack.length > 0) {
    const [i, j] = stack.pop()!
    if (i! < 0 || j! < 0 || i! >= nx || j! >= nz || seen.has(i! * nz + j!) || !free(i!, j!)) continue
    seen.add(i! * nz + j!)
    out.push(at(i!, j!))
    stack.push([i! + 1, j!], [i! - 1, j!], [i!, j! + 1], [i!, j! - 1])
  }
  return out
}

// ─────────────────────────── 扫描 ───────────────────────────

interface Scan {
  /** 玩家包围盒离画面边缘最近的距离，米。负数 = 被裁掉 */
  worstMargin: number
  worstAt: [number, number]
  /** 看不全烤炉的可达位置占比 */
  grillLost: number
  /** 四个工位同时看得全的位置占比 */
  allFour: number
}

function scan(cam: CamRead, H: number, aspect: number, cells: Array<[number, number]>): Scan {
  const boxes = STATIONS.map(specBox)
  const grillIdx = STATIONS.indexOf(CRITICAL)
  const b = focusBounds(H, aspect)
  const halfU = aspect * H
  const inside = (s: FocusBounds): boolean =>
    s.umin >= -halfU && s.umax <= halfU && s.vmin >= -H && s.vmax <= H
  let worstMargin = Infinity
  let worstAt: [number, number] = [0, 0]
  let grillLost = 0
  let allFour = 0
  const focus = { x: 0, z: 0 }
  for (const [px, pz] of cells) {
    focusForPlayer(focus, { x: px, z: pz }, b)
    let seen = 0
    for (let i = 0; i < boxes.length; i++) {
      if (!inside(spanOf(boxes[i]!, focus.x, focus.z, cam))) {
        if (i === grillIdx) grillLost++
        continue
      }
      seen++
    }
    if (seen === boxes.length) allFour++
    const p = spanOf(playerBox(px, pz), focus.x, focus.z, cam)
    const m = Math.min(p.umin + halfU, halfU - p.umax, p.vmin + H, H - p.vmax)
    if (m < worstMargin) {
      worstMargin = m
      worstAt = [px, pz]
    }
  }
  const n = cells.length
  return { worstMargin, worstAt, grillLost: grillLost / n, allFour: allFour / n }
}

// ─────────────────────────── 主流程 ───────────────────────────

/** 手机常见比例 + 用户实测的那台（2532×1170）。最窄的那档决定结论 */
const ASPECTS: Array<[string, number]> = [
  ['4:3 平板', 4 / 3],
  ['16:9', 16 / 9],
  ['19.5:9 实测', 2532 / 1170],
  ['20:9', 20 / 9],
]
const ASPECT_MAIN = 2532 / 1170

const SCENE = 'game/assets/main.scene'
const near = (a: number, b: number, eps = 5e-3): boolean => Math.abs(a - b) <= eps
const pct = (v: number): string => (v * 100).toFixed(0) + '%'

/** 射线 vs AABB，slab。用来问「画面这个像素上有没有东西」—— 墙的高度和遮挡都算进去了 */
function rayHitsBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b: Box3): boolean {
  let t0 = 0
  let t1 = Infinity
  const o = [ox, oy, oz]
  const d = [dx, dy, dz]
  const lo = [b.x0, b.y0, b.z0]
  const hi = [b.x1, b.y1, b.z1]
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]!) < 1e-9) {
      if (o[i]! < lo[i]! || o[i]! > hi[i]!) return false
      continue
    }
    let a = (lo[i]! - o[i]!) / d[i]!
    let c = (hi[i]! - o[i]!) / d[i]!
    if (a > c) { const t = a; a = c; c = t }
    if (a > t0) t0 = a
    if (c < t1) t1 = c
    if (t0 > t1) return false
  }
  return true
}

const COVER_N = 56

/**
 * 画面里有多少比例被场景盖住 —— 用户说的「两端全是黑」「四个角空着」就是这一项。
 * 逐采样点投射一条视线，打中任何一个盒子就算有东西。
 */
function coverage(cam: CamRead, H: number, aspect: number, boxes: Box3[], fx: number, fz: number): number {
  // right × up 指向相机背后，取反才是视线方向
  const f = {
    x: -(cam.right.y * cam.up.z - cam.right.z * cam.up.y),
    y: -(cam.right.z * cam.up.x - cam.right.x * cam.up.z),
    z: -(cam.right.x * cam.up.y - cam.right.y * cam.up.x),
  }
  const halfU = aspect * H
  let hit = 0
  for (let i = 0; i < COVER_N; i++) {
    for (let j = 0; j < COVER_N; j++) {
      const u = -halfU + ((i + 0.5) / COVER_N) * 2 * halfU
      const v = -H + ((j + 0.5) / COVER_N) * 2 * H
      const ox = fx + cam.pos.x + u * cam.right.x + v * cam.up.x
      const oy = cam.pos.y + u * cam.right.y + v * cam.up.y
      const oz = fz + cam.pos.z + u * cam.right.z + v * cam.up.z
      for (const b of boxes) if (rayHitsBox(ox, oy, oz, f.x, f.y, f.z, b)) { hit++; break }
    }
  }
  return hit / (COVER_N * COVER_N)
}

/** 给定 yaw / pitch 造一台相机，距离与现有那台一致 */
function camAt(yawDeg: number, pitchDeg: number, dist: number): CamRead {
  const y = (yawDeg * Math.PI) / 180
  const p = (pitchDeg * Math.PI) / 180
  const fwd = { x: -Math.sin(y) * Math.cos(p), y: -Math.sin(p), z: -Math.cos(y) * Math.cos(p) }
  const right = { x: Math.cos(y), y: 0, z: -Math.sin(y) }
  const up = {
    x: right.y * fwd.z - right.z * fwd.y,
    y: right.z * fwd.x - right.x * fwd.z,
    z: right.x * fwd.y - right.y * fwd.x,
  }
  return { pos: { x: -fwd.x * dist, y: -fwd.y * dist, z: -fwd.z * dist }, right, up, orthoHeight: 0 }
}

/**
 * 视角对比。回答「场景是不是必须长成菱形」：不是 —— 菱形来自
 * 「相机转了 45° 而地板是轴对齐的方形」，两者不匹配，四个角就空着。
 * 加一面西墙（yaw 小了之后画面左侧会看到地板断面）后再比，否则对比不公平。
 */
function sweepYaw(dist: number): void {
  const boxes = [...CONTENT, ...STATIONS].map(specBox)
  const withOuter = [...boxes, specBox('Floor_Outer')]
  const H = 3
  const PITCHES = [35, 45, 55, 65, 75, 90]
  const YAWS = [-45, -30, -15, 0]
  console.log('\n── 视角对比：画面被场景盖住的比例（半高 3.0，19.5:9，focus 在场景中心）')
  console.log('   用户说的「两端全是黑」「四个角空着」就是这一项。俯角 90° = 纯俯视')
  console.log('   俯角 \\ yaw' + YAWS.map((y) => `${y}°`.padStart(8)).join(''))
  for (const pitch of PITCHES) {
    const row = YAWS.map((yaw) => pct(coverage(camAt(yaw, pitch, dist), H, ASPECT_MAIN, boxes, 0, 1)).padStart(8))
    console.log(`   ${String(pitch).padStart(4)}°     ` + row.join(''))
  }
  // 结论：光调角度最高只到 69%。真正填满画面的是厨房外面那块装饰地面
  const now = camAt(-45, 35, dist)
  console.log(
    `   现用角度 −45°/35°：${pct(coverage(now, H, ASPECT_MAIN, boxes, 0, 1))}` +
      ` → 铺上 Floor_Outer 后 ${pct(coverage(now, H, ASPECT_MAIN, withOuter, 0, 1))}`,
  )
}

function main(): void {
  const cam = readCamera(SCENE)
  const fails: string[] = []

  console.log('── 相机三轴：main.scene 的四元数 vs logic/camera.ts 的常量')
  const axes: Array<[string, V3, V3]> = [
    ['right', cam.right, CAMERA_RIGHT],
    ['up', cam.up, CAMERA_UP],
    ['offset', cam.pos, CAMERA_OFFSET],
  ]
  for (const [n, got, want] of axes) {
    const ok = near(got.x, want.x) && near(got.y, want.y) && near(got.z, want.z)
    const fmt = (v: V3): string => `(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`
    console.log(`   ${ok ? 'OK ' : '✗  '}${n.padEnd(7)} 场景 ${fmt(got)}  常量 ${fmt(want)}`)
    if (!ok) fails.push(`camera.ts 的 ${n} 与场景对不上 —— 场景里动过相机就要同步改常量`)
  }
  if (!near(cam.right.y, 0, 1e-6)) fails.push('相机有 roll，u = (x+z)·UK 这条简化不成立')
  if (!near(UK, CAMERA_RIGHT.x) || !near(VK, CAMERA_UP.x)) fails.push('UK/VK 与三轴对不上')

  const spanOfAll = (names: string[]): FocusBounds => {
    let out: FocusBounds = { umin: Infinity, umax: -Infinity, vmin: Infinity, vmax: -Infinity }
    for (const n of names) {
      const s = spanOf(specBox(n), 0, 0, cam)
      out = {
        umin: Math.min(out.umin, s.umin), umax: Math.max(out.umax, s.umax),
        vmin: Math.min(out.vmin, s.vmin), vmax: Math.max(out.vmax, s.vmax),
      }
    }
    return out
  }
  const keys: Array<keyof FocusBounds> = ['umin', 'umax', 'vmin', 'vmax']
  const got = spanOfAll(CONTENT)
  for (const [name, span, want] of [['CONTENT_SPAN', got, CONTENT_SPAN], ['CORE_SPAN', spanOfAll(CORE), CORE_SPAN]] as const) {
    const drift = keys.filter((k) => !near(span[k], want[k], 1e-3))
    console.log(
      `\n── ${name}  场景算出 { ${keys.map((k) => `${k}: ${span[k].toFixed(4)}`).join(', ')} }` +
        `  水平跨度 ${(span.umax - span.umin).toFixed(2)}m  垂直 ${(span.vmax - span.vmin).toFixed(2)}m`,
    )
    if (drift.length > 0) fails.push(`${name} 与场景不符（${drift.join(', ')}）—— 把上面那行抄进 logic/camera.ts`)
  }

  sweepYaw(Math.hypot(cam.pos.x, cam.pos.y, cam.pos.z))

  const cells = reachable()
  console.log(`\n── 扫描 ${cells.length} 个可达位置（步长 ${STEP}m）· 19.5:9`)
  console.log('   半高  画面(米)     横向填充  人物占屏  玩家余量  丢烤炉  四工位全见')
  for (const H of [2.0, 2.6, 3.0, 3.2, 3.4, 3.6, 4.0, 5.0]) {
    const r = scan(cam, H, ASPECT_MAIN, cells)
    const fill = (got.umax - got.umin) / (2 * ASPECT_MAIN * H)
    const line =
      `   ${H.toFixed(1)}  ${(2 * ASPECT_MAIN * H).toFixed(1)}×${(2 * H).toFixed(1)}`.padEnd(21) +
      pct(Math.min(fill, 1)).padEnd(10) +
      pct(CHEF_HEIGHT / (2 * H)).padEnd(10) +
      `${r.worstMargin.toFixed(2)}m`.padEnd(10) +
      pct(r.grillLost).padEnd(8) +
      pct(r.allFour)
    console.log(line + (near(H, ORTHO_HEIGHT, 1e-6) ? '  ←现用' : ''))
  }

  console.log(`\n── 定稿值 ORTHO_HEIGHT=${ORTHO_HEIGHT} 在各比例下`)
  if (!near(cam.orthoHeight, ORTHO_HEIGHT, 1e-6)) {
    fails.push(`main.scene 的 _orthoHeight=${cam.orthoHeight}，camera.ts 写的是 ${ORTHO_HEIGHT}`)
  }
  for (const [name, aspect] of ASPECTS) {
    const H = effectiveOrthoHeight(aspect)
    const r = scan(cam, H, aspect, cells)
    const b = focusBounds(H, aspect)
    const frozen = (near(b.umin, b.umax) ? 'u' : '') + (near(b.vmin, b.vmax) ? 'v' : '') || '—'
    console.log(
      `   ${name.padEnd(12)} 半高 ${H.toFixed(2)}  玩家余量 ${r.worstMargin.toFixed(2)}m` +
        `  丢烤炉 ${pct(r.grillLost)}  四工位全见 ${pct(r.allFour)}  不跟随 ${frozen}`,
    )
    if (r.worstMargin < EDGE_MARGIN) {
      const [wx, wz] = r.worstAt
      fails.push(`${name}：玩家在 (${wx.toFixed(1)}, ${wz.toFixed(1)}) 离画面边缘只剩 ${r.worstMargin.toFixed(2)}m（下限 ${EDGE_MARGIN}m）`)
    }
  }

  if (fails.length === 0) {
    console.log('\n✅ 相机通过：三轴与场景一致，玩家在任何可达位置都完整可见')
    return
  }
  console.log('\n❌ 不通过：')
  for (const f of fails) console.log('   ·', f)
  process.exit(1)
}

main()
