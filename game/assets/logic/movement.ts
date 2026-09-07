/**
 * 角色移动：摇杆 → 相机相对速度 → 碰撞解算后的位置。零 Cocos 依赖（铁律①）。
 *
 * 分两层是刻意的：`moveAndSlide` 只认「一步位移」，跟摇杆无关，customer.ts 之后直接复用；
 * `stepMovement` 是玩家专用的外壳，输入映射只在这一层出现。
 *
 * 与 sim.ts 的分工：那边的厨师只算「走这段路要几秒」（`phaseLeft = d / speed`），
 * 没有真实位置，也就撞不到任何东西。真人版必须逐帧积分 —— 「卡在灶台里」这类 bug
 * 只有在有真实位置之后才测得出来，而这正是不引物理引擎换来的（collision.ts 顶部）。
 */
import { resolveCircleAABB } from './collision'
import type { AABB } from './collision'
import { stickToVelocity } from './input'
import type { StickState } from './input'
import type { Station } from './types'
import type { Vec2 } from './vec2'
import { normalize, scale } from './vec2'

// ─────────────────────────── 常量 ───────────────────────────

/** 玩家碰撞半径。出处：`Body` 的 scale (0.7, 0.6, 0.7) → 直径 0.7 m（m2-scene-guide §2.3） */
export const CHEF_RADIUS = 0.35

/**
 * 米/秒。与 `sim.ts` 的 `defaultSimConfig().chef.speed` 是同一个数 —— M1 的难度曲线
 * 就是按它标定的。两处漂移会让 M1 的参数对真游戏失效，`movement.test.ts` 有一条断言盯着。
 */
export const DEFAULT_CHEF_SPEED = 4

/**
 * 单帧 dt 上限，秒。切后台回来 / 长掉帧的那一帧 dt 可能有好几秒，
 * 不夹住角色会一步瞬移穿过灶台（连续碰撞检测的成本不值得为这一帧付）。
 */
export const MAX_STEP_DT = 0.1

/** 解算轮数。工位间隙 ≥1.5 m > 直径 0.7 m，同时嵌进两个工位不可能；2 轮是留给「工位 + 边界」的角落 */
const RESOLVE_ITERATIONS = 2

// ─────────────────────────── 边界 ───────────────────────────

/** 可走区域的矩形内沿（米）。圆心被夹进来时还要各让出一个半径 */
export interface Bounds {
  xmin: number
  xmax: number
  zmin: number
  zmax: number
}

/** 地板内沿。出处：scene-spec 的 `Floor` scale [8, 0.1, 6] → 8 × 6 米，中心在原点 */
export const FLOOR_BOUNDS: Bounds = { xmin: -4, xmax: 4, zmin: -3, zmax: 3 }

/** 把圆心夹进边界，返回是否夹过。边界比半径还窄时取中点，不让 min 反超 max */
function clampToBounds(out: Vec2, radius: number, b: Bounds): boolean {
  const loX = b.xmin + radius
  const hiX = b.xmax - radius
  const loZ = b.zmin + radius
  const hiZ = b.zmax - radius
  const x = loX > hiX ? (b.xmin + b.xmax) / 2 : out.x < loX ? loX : out.x > hiX ? hiX : out.x
  const z = loZ > hiZ ? (b.zmin + b.zmax) / 2 : out.z < loZ ? loZ : out.z > hiZ ? hiZ : out.z
  const hit = x !== out.x || z !== out.z
  out.x = x
  out.z = z
  return hit
}

// ─────────────────────────── 通用解算 ───────────────────────────

/**
 * 一步位移 → 合法位置。先推出所有盒子，再夹进边界，重复到不再动为止。
 *
 * `out` 可以就是 `pos`（原地解算）。返回本步是否被挡过 —— 组件拿去播撞墙反馈，
 * 顾客 AI 之后拿它判「路被堵住了」。
 */
export function moveAndSlide(
  out: Vec2,
  pos: Vec2,
  step: Vec2,
  radius: number,
  boxes: readonly AABB[],
  bounds: Bounds,
): boolean {
  out.x = pos.x + step.x
  out.z = pos.z + step.z

  let blocked = false
  for (let iter = 0; iter < RESOLVE_ITERATIONS; iter++) {
    let moved = false
    for (let i = 0; i < boxes.length; i++) {
      if (resolveCircleAABB(out, out, radius, boxes[i]!)) moved = true
    }
    if (clampToBounds(out, radius, bounds)) moved = true
    if (!moved) break
    blocked = true
  }
  return blocked
}

// ─────────────────────────── 玩家 ───────────────────────────

export interface MovementConfig {
  /** 米/秒，摇杆推满时的速度 */
  speed: number
  radius: number
  bounds: Bounds
  /** 挡路的盒子。`createMovement` 从 Station[] 提取一次，之后每帧只读 */
  boxes: AABB[]
}

export interface MovementState {
  pos: Vec2
  /**
   * 单位朝向。松手时保持最后一次的方向 —— 归零的话角色会在停下的瞬间转正，
   * 看起来像抽搐。
   */
  facing: Vec2
  /**
   * 绕 Y 的朝向角，弧度，`atan2(facing.x, facing.z)`。
   * ⚠ 零点与符号真机上验一次，跟 input.ts 顶部那三条一起验：这里锁死的是
   * 「朝向取自碰撞前的方向」这个结构，不是某个具体符号。
   */
  facingYaw: number
  moving: boolean
  /** 本帧被工位或边界推回过 */
  blocked: boolean
  cfg: MovementConfig
  /** 每帧复用的位移向量，零分配（铁律②） */
  _step: Vec2
}

export interface MovementInit {
  stations?: readonly Station[]
  boxes?: readonly AABB[]
  speed?: number
  radius?: number
  bounds?: Bounds
  x?: number
  z?: number
}

export function createMovement(init: MovementInit = {}): MovementState {
  const boxes: AABB[] = []
  if (init.stations) for (const s of init.stations) boxes.push(s.box)
  if (init.boxes) for (const b of init.boxes) boxes.push(b)

  return {
    pos: { x: init.x ?? 0, z: init.z ?? 0 },
    facing: { x: 0, z: 1 },
    facingYaw: 0,
    moving: false,
    blocked: false,
    cfg: {
      speed: init.speed ?? DEFAULT_CHEF_SPEED,
      radius: init.radius ?? CHEF_RADIUS,
      bounds: init.bounds ?? FLOOR_BOUNDS,
      boxes,
    },
    _step: { x: 0, z: 0 },
  }
}

/**
 * 玩家一帧。组件那边只需要：`tick(dt)` 摇杆 → 这里 → 把 `pos` / `facingYaw` 写回节点。
 *
 * 朝向取自**碰撞前**的方向：贴着灶台侧滑时解算后的位移是沿墙的，拿它算朝向
 * 会让角色在蹭墙时来回扭头。
 */
export function stepMovement(
  st: MovementState,
  stick: StickState,
  cameraYaw: number,
  dt: number,
): void {
  const clamped = dt > MAX_STEP_DT ? MAX_STEP_DT : dt
  if (!stickToVelocity(st._step, stick, cameraYaw, st.cfg.speed) || clamped <= 0) {
    st.moving = false
    st.blocked = false
    return
  }

  normalize(st.facing, st._step)
  st.facingYaw = Math.atan2(st.facing.x, st.facing.z)

  scale(st._step, st._step, clamped)
  st.blocked = moveAndSlide(st.pos, st.pos, st._step, st.cfg.radius, st.cfg.boxes, st.cfg.bounds)
  st.moving = true
}

/** 把角色放回某处（开局、重开一局）。不走碰撞解算，调用方自己保证位置合法 */
export function teleport(st: MovementState, x: number, z: number): void {
  st.pos.x = x
  st.pos.z = z
  st.moving = false
  st.blocked = false
}
