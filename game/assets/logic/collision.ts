/**
 * 手写碰撞 —— 不引入物理引擎（ROADMAP §1「轻 3D」的精确落点）。
 *
 * Cocos 的 ammo 物理模块 wasm 约 1.2MB / js 约 0.7MB，对 4MB 主包是一大块；
 * 而这个游戏需要的全部碰撞就是「角色别穿过灶台」和「角色进入工位触发范围」。
 * 放在这一层的额外收益：「角色卡在灶台里」这类 bug 也能写成单测。
 *
 * 全部函数零分配（out 参数写回 + 局部 number），见 vec2.ts 顶部说明。
 */
import type { Vec2 } from './vec2'

/** 轴对齐包围盒。用 center + 半宽半深，对应编辑器里工位方块的 position + size/2。 */
export interface AABB {
  center: Vec2
  halfX: number
  halfZ: number
}

/**
 * 推出后额外留的余量。
 * 不留的话推出结果刚好落在「距离 == radius」上，浮点误差会让下一帧的重叠判定
 * 时真时假，表现为角色贴着灶台边抖动。
 */
const SKIN = 1e-6

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 盒面上离 p 最近的点。p 在盒内时返回 p 自己。 */
export function closestPointOnAABB(out: Vec2, p: Vec2, box: AABB): Vec2 {
  out.x = clamp(p.x, box.center.x - box.halfX, box.center.x + box.halfX)
  out.z = clamp(p.z, box.center.z - box.halfZ, box.center.z + box.halfZ)
  return out
}

/**
 * 圆与盒是否重叠（相切不算）。
 *
 * 走「到最近点的距离」而不是分轴比较 —— 后者在盒的斜角外会误判，
 * 表现是角色在灶台斜角外被无形的墙挡住。
 */
export function circleOverlapsAABB(pos: Vec2, radius: number, box: AABB): boolean {
  const cx = clamp(pos.x, box.center.x - box.halfX, box.center.x + box.halfX)
  const cz = clamp(pos.z, box.center.z - box.halfZ, box.center.z + box.halfZ)
  const dx = pos.x - cx
  const dz = pos.z - cz
  return dx * dx + dz * dz < radius * radius
}

/** 圆与圆是否重叠（相切不算）。角色之间、角色与顾客用。 */
export function circleOverlapsCircle(a: Vec2, ra: number, b: Vec2, rb: number): boolean {
  const dx = a.x - b.x
  const dz = a.z - b.z
  const r = ra + rb
  return dx * dx + dz * dz < r * r
}

/**
 * 把圆推出盒子，结果写进 out；没重叠则原样写回并返回 false。
 *
 * out 可以就是 pos 本身（原地解算）—— 分量先取进局部变量再写回。
 */
export function resolveCircleAABB(out: Vec2, pos: Vec2, radius: number, box: AABB): boolean {
  const px = pos.x
  const pz = pos.z
  const minX = box.center.x - box.halfX
  const maxX = box.center.x + box.halfX
  const minZ = box.center.z - box.halfZ
  const maxZ = box.center.z + box.halfZ

  const cx = clamp(px, minX, maxX)
  const cz = clamp(pz, minZ, maxZ)

  // 圆心在盒外：沿「最近点 → 圆心」这个方向推到刚好不接触
  if (cx !== px || cz !== pz) {
    const dx = px - cx
    const dz = pz - cz
    const d2 = dx * dx + dz * dz
    if (d2 >= radius * radius) {
      out.x = px
      out.z = pz
      return false
    }
    const k = (radius + SKIN) / Math.sqrt(d2)
    out.x = cx + dx * k
    out.z = cz + dz * k
    return true
  }

  // 圆心陷在盒内：没有可用的方向向量（那会是零向量 → NaN），改推向最近的那条边
  const toRight = maxX - px
  const toLeft = px - minX
  const toFar = maxZ - pz
  const toNear = pz - minZ

  let best = toRight
  let bx = maxX + radius + SKIN
  let bz = pz
  if (toLeft < best) {
    best = toLeft
    bx = minX - radius - SKIN
    bz = pz
  }
  if (toFar < best) {
    best = toFar
    bx = px
    bz = maxZ + radius + SKIN
  }
  if (toNear < best) {
    bx = px
    bz = minZ - radius - SKIN
  }
  out.x = bx
  out.z = bz
  return true
}

/**
 * 角色够不够得着工位。边界上算够得着 —— 与碰撞的严格不等号相反：
 * 碰撞判「有没有插进去」，触发判「够不够得着」，两者的边界语义本来就不同。
 */
export function inTriggerRange(pos: Vec2, target: Vec2, range: number): boolean {
  const dx = pos.x - target.x
  const dz = pos.z - target.z
  return dx * dx + dz * dz <= range * range
}
