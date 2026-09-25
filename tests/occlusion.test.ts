import { describe, expect, it } from 'vitest'
import { hidesPoint } from '../game/assets/logic/camera'
import type { Box3 } from '../game/assets/logic/camera'

/** main.scene Blockers/Wall_E: centre (10.1, 1.25, 1.5), scale (0.2, 2.5, 3) */
const WALL_E: Box3 = { minX: 10, minY: 0, minZ: 0, maxX: 10.2, maxY: 2.5, maxZ: 3 }
/** Kitchen/Wall_N, the back wall */
const WALL_N: Box3 = { minX: -4.1, minY: 0, minZ: -3.2, maxX: 13.7, maxY: 2.5, maxZ: -3 }

describe('墙挡不挡住厨师（正交相机，视线平行于 CAMERA_OFFSET）', () => {
  it('冷库里靠南墙那一带：脚被东墙挡住；冷库正中不挡', () => {
    expect(hidesPoint(WALL_E, 11.5, 0.3, -0.5)).toBe(true)
    expect(hidesPoint(WALL_E, 11.5, 0.3, -1.5)).toBe(false)
  })

  it('头够高就越过墙顶', () => {
    expect(hidesPoint(WALL_E, 11.5, 2.4, -0.5)).toBe(false)
  })

  it('厨房里任何地方都不被东墙挡（墙在视线背后）', () => {
    for (const [x, z] of [[5, 0], [9.5, 2], [9.8, -1.4], [-3, 1]] as const) expect(hidesPoint(WALL_E, x, 0.3, z)).toBe(false)
  })

  it('后墙永远不挡 —— 它在厨师身后', () => {
    for (const [x, z] of [[0, -2], [5, 0], [12, -1]] as const) expect(hidesPoint(WALL_N, x, 0.3, z)).toBe(false)
  })

  it('点本身在墙里算挡住', () => {
    expect(hidesPoint(WALL_E, 10.1, 1, 1)).toBe(true)
  })
})
