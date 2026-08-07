import { describe, it, expect } from 'vitest'
import {
  closestPointOnAABB,
  circleOverlapsAABB,
  circleOverlapsCircle,
  resolveCircleAABB,
  inTriggerRange,
} from '../collision'
import type { AABB } from '../collision'
import type { Vec2 } from '../vec2'

const v = (x: number, z: number): Vec2 => ({ x, z })
const box = (cx: number, cz: number, hx: number, hz: number): AABB => ({
  center: { x: cx, z: cz },
  halfX: hx,
  halfZ: hz,
})

/** 2×2 的方块灶台，中心在原点 */
const grill = box(0, 0, 1, 1)

describe('closestPointOnAABB', () => {
  it('盒外一点被 clamp 到边界', () => {
    const out = v(0, 0)
    closestPointOnAABB(out, v(5, 0.5), grill)
    expect(out).toEqual({ x: 1, z: 0.5 })
  })

  it('对角线方向的点被 clamp 到角点', () => {
    const out = v(0, 0)
    closestPointOnAABB(out, v(5, 5), grill)
    expect(out).toEqual({ x: 1, z: 1 })
  })

  it('盒内一点返回它自己', () => {
    const out = v(0, 0)
    closestPointOnAABB(out, v(0.3, -0.4), grill)
    expect(out).toEqual({ x: 0.3, z: -0.4 })
  })
})

describe('circleOverlapsAABB', () => {
  it('离得远不重叠', () => {
    expect(circleOverlapsAABB(v(10, 0), 0.5, grill)).toBe(false)
  })

  it('刚好接触边界不算重叠', () => {
    expect(circleOverlapsAABB(v(1.5, 0), 0.5, grill)).toBe(false)
  })

  it('压进边界算重叠', () => {
    expect(circleOverlapsAABB(v(1.4, 0), 0.5, grill)).toBe(true)
  })

  it('圆心在盒内算重叠', () => {
    expect(circleOverlapsAABB(v(0, 0), 0.5, grill)).toBe(true)
  })

  it('角落外侧不误判 —— 两轴都在扩张范围内，但离角点仍够远', () => {
    // 圆心 (2,2) 到角点 (1,1) 距离 √2≈1.414 > 1.2，不该重叠。
    // 只按轴分别比较（|dx| < halfX+r 且 |dz| < halfZ+r）会误判成重叠，
    // 表现是角色在灶台斜角外被无形的墙挡住。
    expect(circleOverlapsAABB(v(2, 2), 1.2, grill)).toBe(false)
  })

  it('角落内侧算重叠', () => {
    expect(circleOverlapsAABB(v(1.5, 1.5), 1.0, grill)).toBe(true)
  })
})

describe('circleOverlapsCircle', () => {
  it('圆心距离大于半径和不重叠', () => {
    expect(circleOverlapsCircle(v(0, 0), 1, v(3, 4), 3)).toBe(false)
  })

  it('刚好相切不算重叠', () => {
    expect(circleOverlapsCircle(v(0, 0), 2, v(5, 0), 3)).toBe(false)
  })

  it('相交算重叠', () => {
    expect(circleOverlapsCircle(v(0, 0), 2, v(4, 0), 3)).toBe(true)
  })
})

describe('resolveCircleAABB', () => {
  it('没重叠就不动，返回 false', () => {
    const out = v(0, 0)
    const moved = resolveCircleAABB(out, v(10, 3), 0.5, grill)
    expect(moved).toBe(false)
    expect(out).toEqual({ x: 10, z: 3 })
  })

  it('从侧面压进去时沿最短方向推出', () => {
    const out = v(0, 0)
    const moved = resolveCircleAABB(out, v(1.2, 0), 0.5, grill)
    expect(moved).toBe(true)
    expect(out.x).toBeCloseTo(1.5)
    expect(out.z).toBeCloseTo(0)
  })

  it('推出之后不再重叠 —— 这是「角色不会卡在灶台里」的判据', () => {
    const out = v(0, 0)
    resolveCircleAABB(out, v(1.2, 0), 0.5, grill)
    expect(circleOverlapsAABB(out, 0.5, grill)).toBe(false)
  })

  it('圆心陷进盒内时推向最近的那条边', () => {
    // (0.8, 0) 离 +x 边只有 0.2，离其它三边都更远
    const out = v(0, 0)
    const moved = resolveCircleAABB(out, v(0.8, 0), 0.5, grill)
    expect(moved).toBe(true)
    expect(out.x).toBeCloseTo(1.5)
    expect(out.z).toBeCloseTo(0)
    expect(circleOverlapsAABB(out, 0.5, grill)).toBe(false)
  })

  it('圆心正落在盒中心也要推出去，不能返回 NaN', () => {
    // 角色被两个方向同时挤进灶台正中心是真会发生的；除零会让坐标变 NaN 再也回不来
    const out = v(0, 0)
    const moved = resolveCircleAABB(out, v(0, 0), 0.5, grill)
    expect(moved).toBe(true)
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.z)).toBe(true)
    expect(circleOverlapsAABB(out, 0.5, grill)).toBe(false)
  })

  it('从角落压进去时推出后也不重叠', () => {
    const out = v(0, 0)
    resolveCircleAABB(out, v(1.3, 1.3), 0.6, grill)
    expect(circleOverlapsAABB(out, 0.6, grill)).toBe(false)
  })

  it('out 可以就是输入本身（原地解算）', () => {
    const pos = v(1.2, 0)
    resolveCircleAABB(pos, pos, 0.5, grill)
    expect(pos.x).toBeCloseTo(1.5)
    expect(circleOverlapsAABB(pos, 0.5, grill)).toBe(false)
  })
})

describe('inTriggerRange', () => {
  it('范围内为真', () => {
    expect(inTriggerRange(v(0, 0), v(0, 1.2), 1.5)).toBe(true)
  })

  it('范围外为假', () => {
    expect(inTriggerRange(v(0, 0), v(0, 2), 1.5)).toBe(false)
  })

  it('边界上算在范围内 —— 触发范围是「够得着」，与碰撞的严格不等号相反', () => {
    expect(inTriggerRange(v(0, 0), v(3, 4), 5)).toBe(true)
  })
})
