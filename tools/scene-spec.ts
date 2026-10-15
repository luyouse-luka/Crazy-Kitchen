/** Shared scene transforms for scene:apply, scene checks, and navigation.
 * Layout source: ROADMAP.md, open-centre layout; cube scales are metres.
 */
import { LAYOUT_FIXTURES } from '../game/assets/logic/scene-layout'
import type { LayoutId } from '../game/assets/logic/scene-layout'

export interface NodeSpec {
  pos?: [number, number, number]
  yaw?: number
  active?: boolean

  scale?: [number, number, number]
}

export const RENAMES: Record<string, string> = {
  Wall_W: 'Wall_E',
}

function fixtureNode(id: LayoutId): NodeSpec {
  const f = LAYOUT_FIXTURES[id]
  return { pos: [f.pose.x, .45, f.pose.z], scale: [f.width, .9, f.depth] }
}

function fixtureArt(id: LayoutId, node: string): NodeSpec {
  const f = LAYOUT_FIXTURES[id], art = f.art.find(a => a.node === node)
  if (!art) throw new Error(`Missing layout art: ${id}/${node}`)
  return {
    pos: [f.pose.x + art.offset[0], art.offset[1], f.pose.z + art.offset[2]],
    ...(art.yaw === undefined ? {} : { yaw: art.yaw }),
  }
}

export const SPEC: Record<string, NodeSpec> = {

  Floor: { pos: [0.5, -0.05, 0.3], scale: [9, 0.1, 6.6] },

  Floor_East: { pos: [6.5, -0.05, 0.3], scale: [3, 0.1, 6.6] },

  Floor_Store: { pos: [6.5, -0.05, -4.5], scale: [3, 0.1, 3] },
  Wall_N: { pos: [0.5, 1.25, -3.1], scale: [9.2, 2.5, 0.2] },
  Wall_StoreBack: { pos: [6.5, 1.25, -6.1], scale: [3.2, 2.5, 0.2] },

  Station_Fridge: fixtureNode('fridge'),
  Station_Grill: fixtureNode('grill'),
  Station_Assembly: fixtureNode('assembly'),
  Station_Serve: fixtureNode('serve'),
  Station_Order: fixtureNode('register'),

  Station_Delivery: fixtureNode('delivery'),

  Station_Storeroom: { pos: [6.5, 0.45, -5.5], scale: [1, 0.9, 1] },


  Wall_E: { pos: [8.1, 1.25, -1.2], scale: [0.2, 2.5, 9.6] },
  Wall_Store_W1: { pos: [4.9, 0.5, -4.5], scale: [0.2, 1, 3] },
  Wall_Store_W2: { pos: [5.25, 0.5, -3.1], scale: [0.5, 1, 0.2] },
  Wall_Store_S: { pos: [7.5, 0.5, -3.1], scale: [1, 1, 0.2] },
  Wall_Utility: { pos: [5.1, 0.45, -1], scale: [0.2, 0.9, 4], active: false },
  Wall_Kitchen_W: { pos: [-4.1, 0.45, -1.25], scale: [0.2, 0.9, 3.5] },
  Block_Pack: { pos: [-2.5, 0.45, 3.1], scale: [1, 0.9, 1], active: false },
  Block_Plate: fixtureNode('shelf'),
  Block_Fryer: fixtureNode('fryer'),
  Block_CounterW: { pos: [-2.5, 0.45, 3.1], scale: [1, 0.9, 1] },
  Block_CounterE: { pos: [1.25, 0.45, 3.1], scale: [2.5, 0.9, 1] },
  Block_Return: { pos: [-3.5, 0.45, -1.25], scale: [1, 0.9, 3.5], active: false },
  Block_BackCounter: { pos: [-1.25, 0.45, -2.5], scale: [1.5, 0.9, 1], active: false },
  Block_BackCounterE: { pos: [2.75, 0.45, -2.5], scale: [0.5, 0.9, 1] },
  Block_DrinkBase: fixtureNode('drinks'),

  Block_VoidNorth: { pos: [0.5, 0.45, -4.5], scale: [9, 0.9, 3] },
  Block_StoreShelves: { pos: [7.5, 0.45, -4.5], scale: [1, 0.9, 3] },

  Station_Sink: fixtureNode('sink'),
  Block_DishRack: fixtureNode('rack'),
  Block_Crates: { pos: [6.5, 0.45, -5.5], scale: [0.8, 0.9, 0.8] },


  Floor_Customer: { pos: [0.5, -0.05, 5.1], scale: [9, 0.1, 3] },


  Floor_Outer: { pos: [3, -0.1, 0], scale: [30, 0.1, 26] },

  Player: { pos: [0, 0, 1.55] },
  Body: { pos: [0, 0.6, 0] },
  Head: { pos: [0, 1.4, 0] },
  Anchor_Hand: { pos: [0, 1.75, 0] },

  Shadow: { pos: [0, 0.006, 0], scale: [0.08, 1, 0.06], active: true },
  Prop_Fridge: fixtureArt('fridge', 'Prop_Fridge'),
  Prop_Grill: fixtureArt('grill', 'Prop_Grill'),
  Prop_Assembly: fixtureArt('assembly', 'Prop_Assembly'),
  Prop_AssemblyEast: fixtureArt('assembly', 'Prop_AssemblyEast'),
  Prop_AssemblyPlate: fixtureArt('assembly', 'Prop_AssemblyPlate'),
  Prop_Pack: fixtureArt('serve', 'Prop_Pack'),
  Prop_Plate: fixtureArt('shelf', 'Prop_Plate'),
  Prop_Fryer: fixtureArt('fryer', 'Prop_Fryer'),
  Prop_Sink_0: { ...fixtureArt('sink', 'Prop_Sink_0'), active: true },
  Prop_Sink_1: { ...fixtureArt('sink', 'Prop_Sink_1'), active: true },
  Prop_WashRack: fixtureArt('rack', 'Prop_WashRack'),
  Prop_Crates: { pos: [6.4, 0, -5.5] },
  Prop_Shelf_0: { pos: [7.7, 0, -5.4], scale: [0.75, 0.65, 0.75] },
  Prop_Shelf_1: { pos: [7.7, 0, -4.45], scale: [0.75, 0.65, 0.75] },
  Prop_Shelf_2: { pos: [7.7, 0, -3.5], scale: [0.75, 0.65, 0.75] },
  Prop_Waiting: { pos: [0.5, 0, 6.15] },
  Prop_Serve: { pos: [0, 0, 3.1] },

  Prop_ColdDoor: { pos: [6.25, 0, -3.1], active: false },
  Prop_ReturnBack: { pos: [-3.5, 0, -2.5], active: false },
  Prop_ReturnSide: { pos: [-3.5, 0, -1.25], scale: [1.5, 1, 1], yaw: 90, active: false },
  Prop_ReturnFront: { pos: [-3.5, 0, 0], active: false },
  Prop_BackCounterW: { pos: [-1.625, 0, -2.5], scale: [0.75, 1, 1], active: false },
  Prop_BackCounterW2: { pos: [-0.875, 0, -2.5], scale: [0.75, 1, 1], active: false },
  Prop_BackCounterE: { pos: [2.75, 0, -2.5], scale: [0.5, 1, 1] },
  Prop_DrinkBase: fixtureArt('drinks', 'Prop_DrinkBase'),
}

// ─────────────────────────── 材质 ───────────────────────────

export interface MatSpec {
  /** materials/<mat>.mtl */
  mat: string
  /** mainColor, 0-255 */
  rgba: [number, number, number, number]
  /** _techIdx on the material effect: 0 opaque / 1 transparent */
  tech: number
}

/** Scene colours stay editable; the standard effect receives the soft directional light. */
export const MAT_SPEC: Record<string, MatSpec> = {
  Floor: { mat: 'M_Floor', rgba: [246, 235, 216, 255], tech: 0 },
  // 比店内深一档，只为把柜台内外分开；⏳ 色相待定，别当定稿
  Floor_Customer: { mat: 'M_FloorOut', rgba: [221, 211, 191, 255], tech: 0 },
  // 比店内暗两档、偏冷 —— 和 200/150 拉开三层，玩家一眼看得出哪边走不过去
  Floor_Outer: { mat: 'M_FloorOuter', rgba: [179, 193, 169, 255], tech: 0 },
  Wall_N: { mat: 'M_Wall', rgba: [247, 235, 213, 255], tech: 0 },
  Wall_E: { mat: 'M_Wall', rgba: [247, 235, 213, 255], tech: 0 },
  Floor_East: { mat: 'M_Floor', rgba: [246, 235, 216, 255], tech: 0 },
  // ⏳ 冷库一眼要看出是冷的：地面冰蓝、墙浅冷灰蓝，色值待定
  Floor_Store: { mat: 'M_FloorStore', rgba: [200, 228, 245, 255], tech: 0 },
  Wall_StoreBack: { mat: 'M_ColdWall', rgba: [178, 205, 225, 255], tech: 0 },
  Wall_Store_W1: { mat: 'M_ColdWall', rgba: [178, 205, 225, 255], tech: 0 },
  Wall_Store_W2: { mat: 'M_ColdWall', rgba: [178, 205, 225, 255], tech: 0 },
  Wall_Store_S: { mat: 'M_ColdWall', rgba: [178, 205, 225, 255], tech: 0 },
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
  /**
   * 节点的 `_active`。不写 = 不检查。
   *
   * ⚠ 这个必须由判据管，因为**编辑器里有两个长得很像的开关**：层级管理器里悬停冒出的
   * 眼睛图标是「编辑器内可见性」，只影响你在编辑器里看不看得见，**运行时照样显示**；
   * 真正的 active 在属性检查器最顶部、节点名左边那个复选框。
   * 关错了的话编辑器里一切正常，要等真机跑起来才发现按钮一直挂在屏幕上。
   */
  active?: boolean
  /**
   * 父节点名。`pos` 恒是 Canvas 中心系的**绝对**坐标 —— 捕获区要的就是它
   * （`uiRectToCaptureZone`），而场景文件存的 `_lpos` 是**相对父节点**的。
   * 两者只在没有 parent 时才相等，所以读写场景一律走 `localPos()`，别直接用 `pos`。
   */
  parent?: string
  /** 必须是四边贴 0 的 Widget。Fit Height 下宽屏比 1280 宽，写死尺寸的遮罩两侧会透底 */
  fullscreen?: boolean
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
      // pos 是 Canvas 绝对坐标（捕获区直接用），场景里的 _lpos 由 localPos() 减掉面板位置
      out[`Slot_${r * cols + c}`] = { size: [cell, cell], sizeMode: 0, pos: [x, y, 0], parent: 'UI_FridgePanel' }
    }
  }
  return out
}

export const FRIDGE_SLOTS = fridgeSlots()

/**
 * 捕获区换算搬去了 `game/assets/logic/input.ts` —— Cocos 只编译 `assets/` 下的脚本，
 * 留在这里的话运行时组件 import 不到，只能各写一份。这里原样转出去，判据与测试照旧。
 */
export { uiRectToCaptureZone, panelChildZone } from '../game/assets/logic/input'

/**
 * 设计分辨率 1280×720，Canvas 锚点在中心，所以 x∈[-640,640] y∈[-360,360]。
 * 摇杆 180 = DEFAULT_STICK.radius(90) 的两倍（API.md 的 input.ts 一节）。
 *
 * 位置只写 UI_HUD 的 —— 另两个一个是浮动（运行时移到手指位置）、
 * 一个由 Widget 锚定，编辑器里的 position 运行时都会被覆盖。
 */
export const UI_SPEC: Record<string, UiSpec> = {
  // 浮动摇杆：按下才出现，运行时由组件移到手指位置并开 active
  UI_Joystick: { size: [180, 180], sizeMode: 0, active: false },
  UI_ActionButton: { size: [160, 160], sizeMode: 0 },
  UI_HUD: { size: [1280, 720], pos: [0, 0, 0], fullscreen: true },

  /**
   * 丢弃键。动作键正上方、中心 x 对齐（两者宽度不同，所以 Widget 的 right 也不同：
   * 140 vs 120）。只在 carry.kind !== 'none' 时显示，不是常驻 —— 这是 input.ts
   * 「右手一个键够用」那条能被推翻的前提。
   * Widget: right=140 bottom=300（= 动作键 bottom 120 + 高 160 + 间距 20）
   */
  UI_DiscardButton: { size: [120, 120], sizeMode: 0, pos: [440, 0, 0], active: false },

  /**
   * 冰箱面板。4 列 × 2 行，格子 120、间距 16、内边距 16 → 560 × 288。
   * 中心抬到 y=+60，避开左下摇杆与右下动作键的拇指区；世界继续跑，所以它
   * **不能全屏遮挡** —— 玩家要看得见烤炉在糊。
   */
  UI_FridgePanel: { size: [560, 288], sizeMode: 0, pos: [0, 60, 0], active: false },

  /**
   * 结算面板。打烊后盖住一切，只有「再来一局」可点。
   * 这三个尺寸必须进判据 —— `Btn_Again` 的捕获区是按它们算出来的，
   * 在编辑器里随手拖一下位置，真机上按钮就点不中，而画面看起来完全正常。
   */
  UI_Result: { size: [1280, 720], pos: [0, 0, 0], active: false, fullscreen: true },
  Mask: { fullscreen: true },
  Panel: { size: [540, 380], sizeMode: 0, pos: [0, 0, 0], parent: 'UI_Result' },
  Btn_Again: { size: [260, 76], sizeMode: 0, pos: [0, -132, 0], parent: 'Panel' },

  ...FRIDGE_SLOTS,
}

/**
 * `UiSpec.pos`（Canvas 绝对）→ 场景文件的 `_lpos`（相对父节点）。
 *
 * 只有 `Slot_*` 有父节点，它们挂在 `UI_FridgePanel` 下 —— 关一次面板就收掉 9 个节点。
 * 面板中心在 y=+60，所以格子的绝对坐标和 `_lpos` **恒差这 60**：
 * 拿 `pos` 直接写场景，8 个格子整体上移 60px，而判据读的也是同一个数、照样全绿。
 *
 * parent 写成 UI_SPEC 里没有的名字会抛 —— 静默退回绝对坐标正是上面那个错法。
 */
export function localPos(name: string): [number, number, number] | undefined {
  const ui = UI_SPEC[name]
  if (!ui?.pos) return undefined
  if (!ui.parent) return ui.pos
  const p = UI_SPEC[ui.parent]?.pos
  if (!p) throw new Error(`localPos: ${name} 的 parent ${ui.parent} 不在 UI_SPEC 里`)
  return [ui.pos[0] - p[0], ui.pos[1] - p[1], ui.pos[2] - p[2]]
}

/** cc.Camera.ClearFlag。SKYBOX(14) 是新建场景的默认值，正是它把天空盒拉进包里 */
export const CLEAR_SOLID_COLOR = 7
export const CLEAR_SKYBOX = 14
