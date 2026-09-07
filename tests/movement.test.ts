import { describe, it, expect } from 'vitest'
import {
  CHEF_RADIUS,
  DEFAULT_CHEF_SPEED,
  FLOOR_BOUNDS,
  MAX_STEP_DT,
  createMovement,
  moveAndSlide,
  stepMovement,
  teleport,
} from '../game/assets/logic/movement'
import { ISO_CAMERA_YAW } from '../game/assets/logic/input'
import type { StickState } from '../game/assets/logic/input'
import { defaultSimConfig } from '../game/assets/logic/sim'
import type { AABB } from '../game/assets/logic/collision'
import type { Station, StationKind } from '../game/assets/logic/types'
import { SPEC } from '../tools/scene-spec'

const stick = (dirX: number, dirY: number, magnitude = 1): StickState => ({
  dirX,
  dirY,
  magnitude,
  active: magnitude > 0,
})
const CENTERED = stick(0, 0, 0)
/** 摇杆的 dirX/dirY 约定是单位方向 —— 对角必须归一化，(1,1) 会把速度偷偷放大 √2 倍 */
const DIAG = Math.SQRT1_2

/** 定稿里的工位，1×1 的方块 —— scene-spec 的 Station_Grill */
const station = (id: string, kind: StationKind, x: number, z: number, w = 1, d = 1): Station => ({
  id,
  kind,
  pos: { x, z },
  box: { center: { x, z }, halfX: w / 2, halfZ: d / 2 },
  triggerRange: 1.2,
})

const GRILL = station('grill', 'grill', -2, -2.5)
const SERVE = station('serve', 'serve', -1, 2.5, 2, 1)

const DT = 0.1
/** 推出后比理论贴面位置多 1e-6 —— collision.ts 的 SKIN，防止贴边时重叠判定时真时假 */
const SKIN_DIGITS = 5

describe('movement · 基础位移', () => {
  it('摇杆回中不动，moving 为 false', () => {
    const m = createMovement({ x: 0, z: 0 })
    stepMovement(m, CENTERED, 0, DT)
    expect(m.pos).toEqual({ x: 0, z: 0 })
    expect(m.moving).toBe(false)
    expect(m.blocked).toBe(false)
  })

  it('推满一帧走 speed × dt', () => {
    const m = createMovement({ x: 0, z: 0 })
    stepMovement(m, stick(1, 0), 0, DT)
    expect(m.pos.x).toBeCloseTo(DEFAULT_CHEF_SPEED * DT, 9)
    expect(m.pos.z).toBeCloseTo(0, 9)
    expect(m.moving).toBe(true)
  })

  it('轻推走得慢 —— magnitude 参与进位移', () => {
    const m = createMovement({ x: 0, z: 0 })
    stepMovement(m, stick(1, 0, 0.5), 0, DT)
    expect(m.pos.x).toBeCloseTo(DEFAULT_CHEF_SPEED * DT * 0.5, 9)
  })

  it('掉帧那一帧的 dt 被夹到 MAX_STEP_DT，不会瞬移', () => {
    const m = createMovement({ x: 0, z: 0 })
    stepMovement(m, stick(1, 0), 0, 3)
    expect(m.pos.x).toBeCloseTo(DEFAULT_CHEF_SPEED * MAX_STEP_DT, 9)
  })

  it('dt 为 0 不动，也不置 moving', () => {
    const m = createMovement({ x: 1, z: 1 })
    stepMovement(m, stick(1, 0), 0, 0)
    expect(m.pos).toEqual({ x: 1, z: 1 })
    expect(m.moving).toBe(false)
  })
})

describe('movement · 相机相对映射', () => {
  it('yaw 为 0 时上推走 -z（屏幕上 = 世界 -z）', () => {
    const m = createMovement({ x: 0, z: 0 })
    stepMovement(m, stick(0, 1), 0, DT)
    expect(m.pos.x).toBeCloseTo(0, 9)
    expect(m.pos.z).toBeCloseTo(-DEFAULT_CHEF_SPEED * DT, 9)
  })

  it('斜 45° 相机下上推走对角，两个分量等长', () => {
    const m = createMovement({ x: 0, z: 0 })
    stepMovement(m, stick(0, 1), ISO_CAMERA_YAW, DT)
    expect(Math.abs(m.pos.x)).toBeCloseTo(Math.abs(m.pos.z), 9)
    expect(Math.abs(m.pos.x)).toBeGreaterThan(0)
  })

  it('对角走的总距离仍等于 speed × dt，不会比直推快', () => {
    const m = createMovement({ x: 0, z: 0 })
    stepMovement(m, stick(0, 1), ISO_CAMERA_YAW, DT)
    const d = Math.hypot(m.pos.x, m.pos.z)
    expect(d).toBeCloseTo(DEFAULT_CHEF_SPEED * DT, 9)
  })
})

describe('movement · 工位碰撞', () => {
  it('直冲烤炉会被挡在外面，圆心到盒面 ≥ 半径', () => {
    const m = createMovement({ stations: [GRILL], x: -2, z: -1 })
    for (let i = 0; i < 20; i++) stepMovement(m, stick(0, 1), 0, DT)
    expect(m.pos.z).toBeCloseTo(-2 + CHEF_RADIUS, SKIN_DIGITS)
    expect(m.blocked).toBe(true)
  })

  it('贴着烤炉侧滑：被挡的那一维停住，另一维照走', () => {
    const m = createMovement({ stations: [GRILL], x: -2, z: -1.6 })
    const x0 = m.pos.x
    stepMovement(m, stick(DIAG, DIAG), 0, DT)
    expect(m.blocked, '起点没贴到盒子，这条就没在测滑行').toBe(true)
    expect(m.pos.x).toBeGreaterThan(x0)
    expect(m.pos.z).toBeCloseTo(-2 + CHEF_RADIUS, SKIN_DIGITS)
  })

  it('陷在盒子里也能被推出去（异常恢复，不会卡死）', () => {
    const m = createMovement({ stations: [GRILL] })
    teleport(m, GRILL.pos.x, GRILL.pos.z)
    stepMovement(m, stick(1, 0), 0, DT)
    const dx = Math.abs(m.pos.x - GRILL.pos.x)
    const dz = Math.abs(m.pos.z - GRILL.pos.z)
    expect(dx > 0.5 || dz > 0.5).toBe(true)
  })

  it('远离工位时 blocked 为 false', () => {
    const m = createMovement({ stations: [GRILL], x: 2, z: 0 })
    stepMovement(m, stick(0, 1), 0, DT)
    expect(m.blocked).toBe(false)
  })
})

describe('movement · 地板边界', () => {
  const walk = (dirX: number, dirY: number): { x: number; z: number } => {
    const m = createMovement({ x: 0, z: 0 })
    for (let i = 0; i < 60; i++) stepMovement(m, stick(dirX, dirY), 0, DT)
    return m.pos
  }

  it('四个方向都被夹在地板内沿，各留一个半径', () => {
    expect(walk(1, 0).x).toBeCloseTo(FLOOR_BOUNDS.xmax - CHEF_RADIUS, 9)
    expect(walk(-1, 0).x).toBeCloseTo(FLOOR_BOUNDS.xmin + CHEF_RADIUS, 9)
    expect(walk(0, 1).z).toBeCloseTo(FLOOR_BOUNDS.zmin + CHEF_RADIUS, 9)
    expect(walk(0, -1).z).toBeCloseTo(FLOOR_BOUNDS.zmax - CHEF_RADIUS, 9)
  })

  it('出餐口贴着南边界，绕过去也不会被挤出地板', () => {
    const m = createMovement({ stations: [SERVE], x: 1, z: 0 })
    for (let i = 0; i < 40; i++) stepMovement(m, stick(-DIAG, -DIAG), 0, DT)
    expect(m.pos.z).toBeLessThanOrEqual(FLOOR_BOUNDS.zmax - CHEF_RADIUS + 1e-9)
    expect(m.pos.x).toBeGreaterThanOrEqual(FLOOR_BOUNDS.xmin + CHEF_RADIUS - 1e-9)
  })

  it('moveAndSlide 一步跨出地板也照样夹得住', () => {
    const out = { x: 0, z: 0 }
    const blocked = moveAndSlide(out, { x: 0, z: 0 }, { x: 100, z: 100 }, CHEF_RADIUS, [], FLOOR_BOUNDS)
    expect(blocked).toBe(true)
    expect(out.x).toBeCloseTo(FLOOR_BOUNDS.xmax - CHEF_RADIUS, 9)
    expect(out.z).toBeCloseTo(FLOOR_BOUNDS.zmax - CHEF_RADIUS, 9)
  })
})

describe('movement · 朝向', () => {
  it('朝向取自碰撞前的方向：蹭着灶台走不会扭头', () => {
    const m = createMovement({ stations: [GRILL], x: -2, z: -1.6 })
    stepMovement(m, stick(DIAG, DIAG), 0, DT)
    expect(m.blocked, '没蹭到灶台，这条就没在测扭头').toBe(true)
    const yawWhileSliding = m.facingYaw
    const free = createMovement({ x: 0, z: 0 })
    stepMovement(free, stick(DIAG, DIAG), 0, DT)
    expect(yawWhileSliding).toBeCloseTo(free.facingYaw, 9)
  })

  it('松手保持最后朝向，不回正', () => {
    const m = createMovement({ x: 0, z: 0 })
    stepMovement(m, stick(1, 0), 0, DT)
    const yaw = m.facingYaw
    stepMovement(m, CENTERED, 0, DT)
    expect(m.facingYaw).toBe(yaw)
    expect(m.facing.x).toBeCloseTo(1, 9)
  })

  it('facing 始终是单位向量，与 magnitude 无关', () => {
    const m = createMovement({ x: 0, z: 0 })
    stepMovement(m, stick(0, 1, 0.2), ISO_CAMERA_YAW, DT)
    expect(Math.hypot(m.facing.x, m.facing.z)).toBeCloseTo(1, 9)
  })
})

describe('movement · 与其它模块的数值一致', () => {
  it('速度与 sim.ts 的 chef.speed 同值 —— M1 的难度曲线按它标定', () => {
    expect(DEFAULT_CHEF_SPEED).toBe(defaultSimConfig().chef.speed)
  })

  it('地板边界与 scene-spec 的 Floor scale 对得上', () => {
    const floor = SPEC['Floor']!
    const [w, , d] = floor.scale!
    expect(FLOOR_BOUNDS.xmax - FLOOR_BOUNDS.xmin).toBeCloseTo(w, 9)
    expect(FLOOR_BOUNDS.zmax - FLOOR_BOUNDS.zmin).toBeCloseTo(d, 9)
  })

  it('玩家半径容得下最窄的工位通道（layoutcheck 的 1.5 m 判据）', () => {
    expect(CHEF_RADIUS * 2).toBeLessThan(1.5)
  })
})

describe('movement · 自定义配置', () => {
  it('boxes 与 stations 可以混着传，都会挡路', () => {
    const extra: AABB = { center: { x: 1, z: 0 }, halfX: 0.5, halfZ: 0.5 }
    const m = createMovement({ stations: [GRILL], boxes: [extra], x: 0, z: 0 })
    expect(m.cfg.boxes.length).toBe(2)
    for (let i = 0; i < 10; i++) stepMovement(m, stick(1, 0), 0, DT)
    expect(m.pos.x).toBeLessThanOrEqual(0.5 - CHEF_RADIUS + 1e-9)
  })

  it('teleport 直接落位并清掉本帧状态', () => {
    const m = createMovement({ stations: [GRILL], x: 0, z: 0 })
    stepMovement(m, stick(1, 0), 0, DT)
    teleport(m, 3, 2)
    expect(m.pos).toEqual({ x: 3, z: 2 })
    expect(m.moving).toBe(false)
    expect(m.blocked).toBe(false)
  })
})
