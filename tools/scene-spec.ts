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

  /**
   * 柜台外的顾客区。独立一块，**不并进 Floor** —— 玩家可走边界仍是 Floor 的 ±4/±3
   * （movement.ts 的 FLOOR_BOUNDS），把两者合成一块会让「地板」同时指两个东西。
   * z ∈ [3, 5]，与店内地板在 z=3 精确接边，不重叠所以不会共面闪烁。
   * 顶面同样在 y=0（pos.y = -scale.y / 2）。
   */
  Floor_Customer: { pos: [0, -0.05, 4], scale: [8, 0.1, 2] },

  // 玩家：位置是定的，scale 取决于内置 Capsule/Sphere/Plane 的默认尺寸 —— 编辑器里量（§2.2 的 _Ruler）
  Player: { pos: [0, 0, 0] },
  Body: { pos: [0, 0.6, 0] },
  Head: { pos: [0, 1.4, 0] },
  Anchor_Hand: { pos: [0, 1.75, 0] },
  // Plane 的内置 mesh 默认边长 10m（实测确认：scale=1 时它盖住了整个 8×6 地板），
  // 所以 0.08/0.06 出来是 0.8 × 0.6 米 —— 比玩家直径 0.7 略大一圈
  Shadow: { pos: [0, 0.006, 0], scale: [0.08, 1, 0.06] },
}

// ─────────────────────────── 材质 ───────────────────────────

export interface MatSpec {
  /** materials/<mat>.mtl */
  mat: string
  /** mainColor, 0-255 */
  rgba: [number, number, number, number]
  /** _techIdx on builtin-unlit: 0 opaque / 1 transparent */
  tech: number
}

/**
 * 全部用 `builtin-unlit`（属性名 `mainColor`；`builtin-standard` 那边叫 `albedo`）。
 * unlit 不吃光照，填什么色渲染出来就是什么色 —— 扁平卡通风要的正是这个，
 * 也省掉「场景里偏暗，是光的问题还是材质的问题」这类查不动的问题。
 *
 * Shadow 是唯一 tech=1 的：opaque 下 alpha 被忽略，出来是一块不透明纯黑片。
 */
export const MAT_SPEC: Record<string, MatSpec> = {
  Floor: { mat: 'M_Floor', rgba: [200, 200, 200, 255], tech: 0 },
  // 比店内深一档，只为把柜台内外分开；⏳ 色相待定，别当定稿
  Floor_Customer: { mat: 'M_FloorOut', rgba: [150, 150, 150, 255], tech: 0 },
  Wall_N: { mat: 'M_Wall', rgba: [230, 230, 230, 255], tech: 0 },
  Wall_E: { mat: 'M_Wall', rgba: [230, 230, 230, 255], tech: 0 },
  Station_Fridge: { mat: 'M_Fridge', rgba: [58, 123, 213, 255], tech: 0 },
  Station_Grill: { mat: 'M_Grill', rgba: [192, 57, 43, 255], tech: 0 },
  Station_Assembly: { mat: 'M_Assembly', rgba: [200, 155, 90, 255], tech: 0 },
  Station_Serve: { mat: 'M_Serve', rgba: [39, 174, 96, 255], tech: 0 },
  Body: { mat: 'M_Player', rgba: [255, 45, 149, 255], tech: 0 },
  Head: { mat: 'M_Player', rgba: [255, 45, 149, 255], tech: 0 },
  Shadow: { mat: 'M_Shadow', rgba: [0, 0, 0, 76], tech: 1 },
}

/** 新建材质槽位的默认值，等于「还没挂」 */
export const DEFAULT_MATERIAL_UUID = '620b6bf3-0369-4560-837f-2a2c00b73c26'

// ─────────────────────────── UI ───────────────────────────

export interface UiSpec {
  /** UITransform 的 contentSize */
  size?: [number, number]
  /** cc.Sprite.SizeMode：0 CUSTOM / 1 TRIMMED / 2 RAW。不是 CUSTOM 的话 size 会被图片顶回去 */
  sizeMode?: number
  pos?: [number, number, number]
}

/**
 * 设计分辨率 1280×720，Canvas 锚点在中心，所以 x∈[-640,640] y∈[-360,360]。
 * 摇杆 180 = DEFAULT_STICK.radius(90) 的两倍（API.md 的 input.ts 一节）。
 *
 * 位置只写 UI_HUD 的 —— 另两个一个是浮动（运行时移到手指位置）、
 * 一个由 Widget 锚定，编辑器里的 position 运行时都会被覆盖。
 */
export const UI_SPEC: Record<string, UiSpec> = {
  UI_Joystick: { size: [180, 180], sizeMode: 0 },
  UI_ActionButton: { size: [160, 160], sizeMode: 0 },
  UI_HUD: { size: [1280, 720], pos: [0, 0, 0] },
}

/** cc.Camera.ClearFlag。SKYBOX(14) 是新建场景的默认值，正是它把天空盒拉进包里 */
export const CLEAR_SOLID_COLOR = 7
export const CLEAR_SKYBOX = 14
