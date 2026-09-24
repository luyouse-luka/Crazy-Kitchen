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
  /**
   * 东翼：洗区、备餐打包台、库房。另起一块而不是把 Floor 拉宽 ——
   * 四个核心工位的间距一动难度就崩（`pnpm layout`），所以主厨房原样不动，新东西只往这边放。
   */
  Floor_East: { pos: [7, -0.05, 0], scale: [6, 0.1, 6] },
  /** 冷库：独立一间，接在东翼北半边外面 x ∈ [10, 13.5]、z ∈ [-3, 0]，门在西墙 */
  Floor_Store: { pos: [11.75, -0.05, -1.5], scale: [3.5, 0.1, 3] },
  Wall_N: { pos: [4.8, 1.25, -3.1], scale: [17.8, 2.5, 0.2] },
  Wall_StoreBack: { pos: [13.6, 1.25, -1.5], scale: [0.2, 2.5, 3] },
  /**
   * 北墙一排台面，自西向东：打包台 → 制作台 → 放盘子 → 烤炉 ×2 → 薯条，中间不留缝；
   * 冰箱在薯条东边隔 0.5m。烤炉两台对应两个烤位，所以工位是 2×1。
   *
   * 南边一整条前台，只在东头留 1m 出口：西头是点单台（电脑），顾客在它东边那段柜台点单、取餐；从东头进、西头出，
   * 正对制作台那 2m 是取餐口，其余是 Block_Counter*。
   */
  Station_Fridge: { pos: [5, 0.45, -2.5], scale: [1, 0.9, 1] },
  Station_Grill: { pos: [2, 0.45, -2.5], scale: [2, 0.9, 1] },
  Station_Assembly: { pos: [-0.5, 0.45, -2.5], scale: [1, 0.9, 1] },
  Station_Serve: { pos: [-0.5, 0.45, 2.5], scale: [2, 0.9, 1] },
  Station_Order: { pos: [-3.5, 0.45, 2.5], scale: [1, 0.9, 1] },
  /** 外卖取餐口：前台东段，出口西边紧挨着（2026-09-24）。骑手从东头出口进出 */
  Station_Delivery: { pos: [2.5, 0.45, 2.5], scale: [1, 0.9, 1] },
  /**
   * 库房货架，贴东墙从北墙排到南墙边。南端留下的空角会把玩家顶到画面边缘（`pnpm cam`），所以堵上。
   * triggerRange 隔着南墙也够得着，但南墙外那块是封死的，走不进去。
   */
  Station_Storeroom: { pos: [13, 0.45, -1.6], scale: [1, 0.9, 2.8] },

  /**
   * `Kitchen/Blockers` 底下：只挡路、不能交互。Cube，scale 即米数。
   * Wall_E 也在这里：地板边界延到库房东墙，东翼南半边那段墙得自己挡人。
   * 库房的西墙（隔断）和南墙朝镜头，做成 1m 的剖切墙 —— 2.5m 的整墙会把库房里面整个挡住。
   * 门洞在隔断 z ∈ (-1.9, -0.5)。Block_* 的渲染器关掉，外形由 `Kitchen/Props` 里的模型给。
   */
  Wall_E: { pos: [10.1, 1.25, 1.5], scale: [0.2, 2.5, 3] },
  Wall_Store_W1: { pos: [10.1, 0.5, -2.45], scale: [0.2, 1, 1.1] },
  Wall_Store_W2: { pos: [10.1, 0.5, -0.25], scale: [0.2, 1, 0.5] },
  Wall_Store_S: { pos: [11.85, 0.5, 0], scale: [3.3, 1, 0.2] },
  Block_Pack: { pos: [-1.5, 0.45, -2.5], scale: [1, 0.9, 1] },
  Block_Plate: { pos: [0.5, 0.45, -2.5], scale: [1, 0.9, 1] },
  Block_Fryer: { pos: [3.5, 0.45, -2.5], scale: [1, 0.9, 1] },
  Block_CounterW: { pos: [-2.25, 0.45, 2.5], scale: [1.5, 0.9, 1] },
  Block_CounterE: { pos: [1.25, 0.45, 2.5], scale: [1.5, 0.9, 1] },
  /** 洗碗池：一个大池子，泡 → 按住刷 → 旁边架子晾（2026-09-24 由 Block_Sink 改成工位） */
  Station_Sink: { pos: [8, 0.45, 2.5], scale: [2, 0.9, 1] },
  Block_DishRack: { pos: [9.5, 0.45, 2.5], scale: [1, 0.9, 1] },
  Block_Crates: { pos: [10.9, 0.45, -2.6], scale: [0.8, 0.9, 0.8] },

  /**
   * 柜台外的顾客区。独立一块，**不并进 Floor** —— 玩家走不到这里（movement.ts 的 FLOOR_BOUNDS），
   * 把两者合成一块会让「地板」同时指两个东西。
   * z ∈ [3, 6]，与店内地板在 z=3 精确接边，不重叠所以不会共面闪烁。顾客站前 1m，后排放等候长凳。
   * 顶面同样在 y=0（pos.y = -scale.y / 2）。
   */
  Floor_Customer: { pos: [0, -0.05, 4.5], scale: [8, 0.1, 3] },

  /**
   * 厨房外面的地面。**纯装饰** —— 不参与碰撞、不进 movement 的 FLOOR_BOUNDS、
   * 也不进 camcheck 的 CONTENT（那份决定相机跟随边界，把它算进去相机会跟到天边）。
   *
   * 它存在的唯一理由是把画面填满。正交投影没有地平线，视线全都以同一个俯角射向地面，
   * 所以地面够大，每条视线都打在地上，画面就不会空。实测：场景本体只有 64㎡，
   * 而半高 3 的画面在地面上铺开 136㎡ —— 差的那一倍就是这块补的。
   * `pnpm cam` 的「视角对比」一节证明过：光调相机角度，覆盖率天花板只有 69%。
   *
   * 顶面 y=-0.05 压在 Floor 底面（-0.1）之下，不共面所以不闪；侧面看店内地板高出一档。
   */
  Floor_Outer: { pos: [3, -0.1, 0], scale: [30, 0.1, 26] },

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
  // 比店内暗两档、偏冷 —— 和 200/150 拉开三层，玩家一眼看得出哪边走不过去
  Floor_Outer: { mat: 'M_FloorOuter', rgba: [85, 92, 105, 255], tech: 0 },
  Wall_N: { mat: 'M_Wall', rgba: [230, 230, 230, 255], tech: 0 },
  Wall_E: { mat: 'M_Wall', rgba: [230, 230, 230, 255], tech: 0 },
  Floor_East: { mat: 'M_Floor', rgba: [200, 200, 200, 255], tech: 0 },
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
