/**
 * 相机跟随：玩家世界坐标 → 相机注视点。零 Cocos 依赖（铁律①）。
 *
 * 钳制发生在**相机视图坐标** (u, v) 里，不是世界 (x, z) 里。相机无 roll，
 * 画面的水平/垂直两条轴在世界里是斜的，用世界 AABB 夹 focus 表达不了
 * 「这一维装得下所以别动、那一维装不下所以跟住」—— 而这正是这套场景需要的。
 *
 * 可行域**必须运行时按屏幕比例算**，不能写成常量：4:3 的画面比 20:9 窄一半，
 * 同一套边界在宽屏上是「水平不动」，在窄屏上会把玩家夹出画面外（`pnpm cam` 验过）。
 */
import type { Vec2 } from './vec2'

/** 相机相对 focus 的位置偏移，米。出处：main.scene 的 Main Camera _lpos（focus 在原点） */
export const CAMERA_OFFSET = { x: -5.9767247746, y: 14.1421356237, z: 12.8171276411 }

/** 画面右 / 画面上，世界单位向量。由 Main Camera 的 _lrot 算出，`pnpm cam` 会复算比对 */
export const CAMERA_RIGHT = { x: 0.9063077870, y: 0.0000000000, z: 0.4226182617 }
export const CAMERA_UP = { x: 0.2988362387, y: 0.7071067812, z: -0.6408563821 }

/** 正交半高，米。`pnpm cam` 的产物 */
export const ORTHO_HEIGHT = 3.0

export interface FocusBounds {
  umin: number
  umax: number
  vmin: number
  vmax: number
}

/**
 * 场景内容（地板 + 东翼 + 库房 + 顾客区 + 外墙，含墙高）在视图坐标里的跨度 —— 跟随的边界。
 * 常量而非现算：logic/ 读不到场景。`pnpm cam` 从 scene-spec 复算并比对，改了场景这里会红。
 */
export const CONTENT_SPAN: FocusBounds = {
  umin: -5.0743474908,
  umax: 8.9531495960,
  vmin: -5.4957077546,
  vmax: 8.1616500554,
}

/**
 * 主厨房（Floor + 顾客区）的跨度 —— 只决定窄屏要不要拉远。
 * 按整个场景算的话，东翼一加宽，普通手机也会被拉远。
 */
export const CORE_SPAN: FocusBounds = {
  umin: -4.8930859334,
  umax: 7.3208194627,
  vmin: -5.4957077546,
  vmax: 3.4167503398,
}

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x)

/**
 * 玩家身体离画面边缘的最小距离，米。贴着边走看不见前方。
 * 也是下面那条兜底的余量 —— 画面宽刚好等于场景宽时，水平跟随区间只剩几十厘米，
 * 跟着走反而把玩家顶到边上（实测 0.21m）。
 */
export const EDGE_MARGIN = 0.3

/**
 * 实际用的半高。屏幕越接近方形，同样的半高给出的画面越窄 —— 窄到装不下场景时
 * 水平跟随的幅度会把烤炉甩出画面（4:3 实测 41% 的位置看不见它）。
 * 那种比例下退回全景：半高抬到画面宽 ≥ 场景宽 + 两边余量，水平方向就此不动。
 */
export function effectiveOrthoHeight(aspect: number, content = CORE_SPAN): number {
  const need = (content.umax - content.umin + 2 * EDGE_MARGIN) / (2 * aspect)
  return need > ORTHO_HEIGHT ? need : ORTHO_HEIGHT
}

/**
 * focus 的可行域：让画面尽量留在内容里。
 * 某一维内容比画面还窄时区间会反转 —— 取中点，即那一维不跟随（动了只会露背景色）。
 */
export function focusBounds(orthoHeight: number, aspect: number, content = CONTENT_SPAN): FocusBounds {
  const halfU = aspect * orthoHeight
  // Overshoot by the margin: a player hugging the outermost corner still gets breathing room,
  // and what shows past the content is Floor_Outer, not background.
  const ulo = content.umin - EDGE_MARGIN + halfU
  const uhi = content.umax + EDGE_MARGIN - halfU
  const vlo = content.vmin - EDGE_MARGIN + orthoHeight
  const vhi = content.vmax + EDGE_MARGIN - orthoHeight
  const um = (ulo + uhi) / 2
  const vm = (vlo + vhi) / 2
  return {
    umin: ulo > uhi ? um : ulo,
    umax: ulo > uhi ? um : uhi,
    vmin: vlo > vhi ? vm : vlo,
    vmax: vlo > vhi ? vm : vhi,
  }
}

/**
 * 玩家位置 → 相机注视点（世界地面坐标）。组件每帧拿它 + CAMERA_OFFSET 写相机节点。
 * 不分配（铁律②）。
 */
export function focusForPlayer(out: Vec2, p: Vec2, b: FocusBounds): void {
  const r = CAMERA_RIGHT, a = CAMERA_UP
  const u = clamp(p.x * r.x + p.z * r.z, b.umin, b.umax)
  const v = clamp(p.x * a.x + p.z * a.z, b.vmin, b.vmax)
  const det = r.x * a.z - r.z * a.x
  out.x = (u * a.z - r.z * v) / det
  out.z = (r.x * v - u * a.x) / det
}

/** World-space box, metres */
export interface Box3 {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

/**
 * Does the box stand between the point and the camera? The camera is orthographic, so every
 * sight line runs parallel to CAMERA_OFFSET — no camera position needed. Slab test on the ray.
 */
export function hidesPoint(b: Box3, x: number, y: number, z: number, dir = CAMERA_OFFSET): boolean {
  let t0 = 0
  let t1 = Infinity
  const o = [x, y, z]
  const d = [dir.x, dir.y, dir.z]
  const lo = [b.minX, b.minY, b.minZ]
  const hi = [b.maxX, b.maxY, b.maxZ]
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]!) < 1e-9) {
      if (o[i]! < lo[i]! || o[i]! > hi[i]!) return false
      continue
    }
    let a = (lo[i]! - o[i]!) / d[i]!
    let c = (hi[i]! - o[i]!) / d[i]!
    if (a > c) [a, c] = [c, a]
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, c)
    if (t0 > t1) return false
  }
  return true
}

/** Art-direction values: 22% opacity; a full fade takes about 0.2 seconds. */
export const WALL_FADE_OPACITY = 0.22
export function stepWallOpacity(current: number, hidden: boolean, dt: number): number {
  const target = hidden ? WALL_FADE_OPACITY : 1
  const step = Math.max(0, dt) * 4
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step)
}
