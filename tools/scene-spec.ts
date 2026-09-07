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

// ─────────────────────────── 冰箱面板的 8 格 ───────────────────────────

/** 面板几何。改这里，格子位置与 docs 的俯视图一起动 */
export const PANEL = {
  cell: 120,
  gap: 16,
  pad: 16,
  cols: 4,
  rows: 2,
  /** 面板中心（Canvas 系） */
  center: [0, 60] as [number, number],
}

/**
 * 8 格的位置，按 INGREDIENTS 的顺序排（bun/patty/cheese/lettuce · tomato/onion/pickle/bacon）。
 * 算出来而不是手填：改 PANEL 的任一项，位置和 docs 的图一起跟着动。
 */
function fridgeSlots(): Record<string, UiSpec> {
  const { cell, gap, pad, cols, rows, center } = PANEL
  const w = cols * cell + (cols - 1) * gap + 2 * pad
  const h = rows * cell + (rows - 1) * gap + 2 * pad
  const out: Record<string, UiSpec> = {}
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = center[0] - w / 2 + pad + cell / 2 + c * (cell + gap)
      const y = center[1] + h / 2 - pad - cell / 2 - r * (cell + gap)
      out[`Slot_${r * cols + c}`] = { size: [cell, cell], sizeMode: 0, pos: [x, y, 0] }
    }
  }
  return out
}

export const FRIDGE_SLOTS = fridgeSlots()

/**
 * UI 节点中心 → TouchRouter 的捕获区。**唯一该做这次转换的地方。**
 *
 * 两处不一致，各错一次就够毁掉整块面板：
 *
 * ① **原点差半屏** —— Canvas 锚点在中心（x∈[-640,640]），而 `Touch.getLocation()`
 *    是左下原点。直接拿节点 position 当捕获区，整块区偏到屏幕左下角，
 *    **偏得像「没生效」，不像坐标错**。
 * ② **单位不是设计分辨率，是真实触摸像素** —— 与 §2.3 那条「`splitX` 别写死 640」同源。
 *    Fit Height 下 2400×1080 的手机 scale = 1080/720 = 1.5，按 1280 硬算的区
 *    在真机上全部错位，而在编辑器 1280×720 预览里**完全正常** —— 只有真机能暴露。
 *
 * 所以 screenW / screenH 必传，运行时取 `view.getVisibleSize()`，别填常量。
 */
export function uiRectToCaptureZone(
  id: string,
  centerX: number,
  centerY: number,
  w: number,
  h: number,
  screenW: number,
  screenH: number,
  designH = 720,
): { id: string; x: number; y: number; w: number; h: number } {
  const k = screenH / designH // Fit Height：缩放由高度定，宽度随比例延展
  const sw = w * k
  const sh = h * k
  return {
    id,
    x: screenW / 2 + centerX * k - sw / 2,
    y: screenH / 2 + centerY * k - sh / 2,
    w: sw,
    h: sh,
  }
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

  /**
   * 丢弃键。动作键正上方、中心 x 对齐（两者宽度不同，所以 Widget 的 right 也不同：
   * 140 vs 120）。只在 carry.kind !== 'none' 时显示，不是常驻 —— 这是 input.ts
   * 「右手一个键够用」那条能被推翻的前提。
   * Widget: right=140 bottom=300（= 动作键 bottom 120 + 高 160 + 间距 20）
   */
  UI_DiscardButton: { size: [120, 120], sizeMode: 0, pos: [440, 0, 0] },

  /**
   * 冰箱面板。4 列 × 2 行，格子 120、间距 16、内边距 16 → 560 × 288。
   * 中心抬到 y=+60，避开左下摇杆与右下动作键的拇指区；世界继续跑，所以它
   * **不能全屏遮挡** —— 玩家要看得见烤炉在糊。
   */
  UI_FridgePanel: { size: [560, 288], pos: [0, 60, 0] },
  ...FRIDGE_SLOTS,
}

/** cc.Camera.ClearFlag。SKYBOX(14) 是新建场景的默认值，正是它把天空盒拉进包里 */
export const CLEAR_SOLID_COLOR = 7
export const CLEAR_SKYBOX = 14
