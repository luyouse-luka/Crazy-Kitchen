import { describe, expect, it } from 'vitest'
import {
  CONTENT_SPAN,
  EDGE_MARGIN,
  ORTHO_HEIGHT,
  UK,
  VK,
  effectiveOrthoHeight,
  focusBounds,
  focusForPlayer,
} from '../game/assets/logic/camera'
import { CHEF_RADIUS, FLOOR_BOUNDS } from '../game/assets/logic/movement'

const WIDE = 2532 / 1170
const toView = (p: { x: number; z: number }) => ({ u: (p.x + p.z) * UK, v: (p.x - p.z) * VK })
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x)

/** 玩家能站到的四个角 + 中心。钳制只在角上才生效，中间测不出任何东西 */
const corners = (): Array<{ x: number; z: number }> => {
  const r = CHEF_RADIUS
  const xs = [FLOOR_BOUNDS.xmin + r, 0, FLOOR_BOUNDS.xmax - r]
  const zs = [FLOOR_BOUNDS.zmin + r, 0, FLOOR_BOUNDS.zmax - r]
  return xs.flatMap((x) => zs.map((z) => ({ x, z })))
}

describe('focusForPlayer', () => {
  it('focus 的视图坐标恒等于玩家视图坐标夹进可行域 —— 正逆变换互为反函数', () => {
    const b = focusBounds(ORTHO_HEIGHT, WIDE)
    const out = { x: 0, z: 0 }
    for (const p of corners()) {
      focusForPlayer(out, p, b)
      const want = toView(p)
      const got = toView(out)
      expect(got.u).toBeCloseTo(clamp(want.u, b.umin, b.umax), 9)
      expect(got.v).toBeCloseTo(clamp(want.v, b.vmin, b.vmax), 9)
    }
  })

  it('画面比场景宽时水平不跟随 —— 所有玩家位置给出同一个 u', () => {
    const b = focusBounds(ORTHO_HEIGHT, WIDE)
    expect(b.umin).toBe(b.umax)
    const out = { x: 0, z: 0 }
    const us = corners().map((p) => {
      focusForPlayer(out, p, b)
      return toView(out).u
    })
    for (const u of us) expect(u).toBeCloseTo(us[0]!, 9)
  })

  it('垂直方向真的在跟随 —— 南北两端给出不同的 v', () => {
    const b = focusBounds(ORTHO_HEIGHT, WIDE)
    expect(b.vmin).toBeLessThan(b.vmax)
    const a = { x: 0, z: 0 }
    const c = { x: 0, z: 0 }
    focusForPlayer(a, { x: 0, z: FLOOR_BOUNDS.zmin + CHEF_RADIUS }, b)
    focusForPlayer(c, { x: 0, z: FLOOR_BOUNDS.zmax - CHEF_RADIUS }, b)
    expect(toView(a).v).toBeGreaterThan(toView(c).v)
  })

  it('不分配：同一个 out 反复写（铁律②）', () => {
    const b = focusBounds(ORTHO_HEIGHT, WIDE)
    const out = { x: 0, z: 0 }
    const first = out
    for (const p of corners()) focusForPlayer(out, p, b)
    expect(out).toBe(first)
  })
})

describe('focusBounds', () => {
  it('区间反转时退化成中点，不让 min 反超 max', () => {
    // 半高给到离谱的大，两维都装得下 —— 此时两端都该塌成同一个点
    const b = focusBounds(50, WIDE)
    expect(b.umin).toBe(b.umax)
    expect(b.vmin).toBe(b.vmax)
  })
})

describe('effectiveOrthoHeight', () => {
  it('宽屏用定稿值，窄屏抬高到装得下整个场景宽', () => {
    expect(effectiveOrthoHeight(WIDE)).toBe(ORTHO_HEIGHT)
    expect(effectiveOrthoHeight(4 / 3)).toBeGreaterThan(ORTHO_HEIGHT)
  })

  it('抬高后画面宽 ≥ 场景宽 + 两边余量 —— 这正是抬它的理由', () => {
    const want = CONTENT_SPAN.umax - CONTENT_SPAN.umin + 2 * EDGE_MARGIN
    for (const aspect of [4 / 3, 16 / 9, WIDE, 20 / 9]) {
      const h = effectiveOrthoHeight(aspect)
      expect(2 * aspect * h).toBeGreaterThanOrEqual(want - 1e-9)
    }
  })
})

describe('视图坐标系', () => {
  it('UK/VK 与 CONTENT_SPAN 自洽：场景四角投影落在跨度里', () => {
    for (const x of [-4, 4]) {
      for (const z of [-3, 5]) {
        const { u, v } = toView({ x, z })
        expect(u).toBeGreaterThanOrEqual(CONTENT_SPAN.umin - 1e-9)
        expect(u).toBeLessThanOrEqual(CONTENT_SPAN.umax + 1e-9)
        expect(v).toBeGreaterThanOrEqual(CONTENT_SPAN.vmin - 1e-9)
        expect(v).toBeLessThanOrEqual(CONTENT_SPAN.vmax + 1e-9)
      }
    }
  })
})
