/**
 * 场景里那些「有定稿数值」的东西，单一真相。
 *
 * `scenedump.ts` 拿它做对比、`sceneapply.ts` 拿它做写入 —— 两边共用一份，
 * 否则改了一处忘了另一处，判据会开始说谎。
 * 数值出处：docs/m2-scene-guide.md §2.3（那套坐标是枚举 + `pnpm layout` 验过的）。
 */

export interface NodeSpec {
  pos?: [number, number, number]
  /** 只有确定几何体默认尺寸的才写。Capsule/Sphere/Plane 的默认尺寸不在工程里，留给编辑器量 */
  scale?: [number, number, number]
}

/** 场景里的旧名 → 定稿名。相机 yaw = −45（从西南看），背对镜头的是北和**东** */
export const RENAMES: Record<string, string> = {
  Wall_W: 'Wall_E',
}

export const SPEC: Record<string, NodeSpec> = {
  // Cube，scale 即米数
  Floor: { pos: [0, -0.05, 0], scale: [8, 0.1, 6] },
  Wall_N: { pos: [0, 1.25, -3.1], scale: [8.2, 2.5, 0.2] },
  Wall_E: { pos: [4.1, 1.25, 0], scale: [0.2, 2.5, 6] },
  Station_Fridge: { pos: [2, 0.45, -2.5], scale: [1, 0.9, 1] },
  Station_Grill: { pos: [-2, 0.45, -2.5], scale: [1, 0.9, 1] },
  Station_Assembly: { pos: [-3.5, 0.45, 0], scale: [1, 0.9, 1] },
  Station_Serve: { pos: [-1, 0.45, 2.5], scale: [2, 0.9, 1] },

  // 玩家：位置是定的，scale 取决于内置 Capsule/Sphere/Plane 的默认尺寸 —— 编辑器里量（§2.2 的 _Ruler）
  Player: { pos: [0, 0, 0] },
  Body: { pos: [0, 0.6, 0] },
  Head: { pos: [0, 1.4, 0] },
  Anchor_Hand: { pos: [0, 1.75, 0] },
  Shadow: { pos: [0, 0.01, 0] },
}

/** cc.Camera.ClearFlag。SKYBOX(14) 是新建场景的默认值，正是它把天空盒拉进包里 */
export const CLEAR_SOLID_COLOR = 7
export const CLEAR_SKYBOX = 14
