# 自定义厨房布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在休息日提供可保存、可撤销的工位移动与旋转，同时保证实际操作、碰撞、模型、特效和顾客服务位置同步。

**Architecture:** 布局规格、几何校验、编辑草稿和存档格式属于零 Cocos 依赖的逻辑层。引擎层集中应用完整布局，编辑界面只操作草稿；`StationView` 保留游戏编排职责，接入休息日入口、冻结、保存和退出。运行时与离线工具复用几何和可达性判据。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript strict、现有 Vitest / pnpm、现有手写 AABB 碰撞、Playwright 浏览器验证；不增加依赖或物理引擎。

**Spec:** [已确认的设计稿](../../custom-layout-design-2026-10-14.md)。2026-10-15 用户补充：冰箱与盘子默认位置仍需调整，常用东西尽量不放角落；本计划采用下面的新默认布局。

**Execution status (2026-10-15):** 用户恢复后限定本次只做 Task 1，其余在其他窗口继续。Task 1 已完成，546 项回归通过，独立审查无待修项；Task 2–7 未开始。当前代码位于 `codex/custom-kitchen-layout` 分支的独立工作区，接力入口见 [Task 1 交接](../../custom-layout-task1-handoff-2026-10-15.md)。

## Global Constraints

- 建筑地板、墙、门、冷库边界、顾客座位固定；只在休息日编辑。
- 拖动吸附 0.5m；仅实际拖动的工位吸附，不重写未操作设备的精确坐标。
- 厨房设备旋转 0 / 90 / 180 / 270 度；灭火器只移动；前台服务点只沿固定柜台横移。
- 撤销保留最近 20 步；恢复默认只改草稿；取消还原进入时的完整布局。
- 角色直径 0.7m、现有交互距离 0.7m；主通道和冷库门口净宽至少 1.5m。
- 布局调整免费，不更改加工时间、容量、升级、设备拥有状态或难度参数。
- 旧 v1 / v2 存档保留天数、星级、金币、购买和装饰；损坏布局单独回退默认。
- 保存布局与进度一次写入；写失败时留在编辑器，原进度与原运行布局保持可用。
- 月租、水电、商税、安全费用、经营日期、债务、破产和奖励不在本计划实现。
- 保留当前工作区已经完成的布局、锅具和灭火器修改；不全量重写场景或撤销他方文件。
- 注释简短英文；新脚本 `.meta` 按当前项目格式生成唯一 UUID，保留已有资产 UUID。
- 本地实现和构建；不推送、部署或同步远端。各任务以 `git diff --check` 检查交付差异，不自动把已有未提交修改打进任务提交。

## Review Focus

1. 坏布局不能使旧档金币、购买和装饰丢失：Task 3 检查迁移、未知 ID、截断、非有限数和几何不合法。
2. 设备旋转后不能从背面或隔墙操作：Task 2 同时验证编辑校验和真实 `stationInReach` / `interact`。
3. 第二根手指、取消触摸或切后台不能留下草稿半步、按键粘住或营业偷跑：Task 4 / 6 / 7 验证指针归属与编辑冻结。
4. 反复保存、取消或恢复默认不能累积锅具、网格、材质或旧阴影：Task 5 / 7 验证绝对变换与资源生命周期。
5. 窄屏和微信安全区不能挡住保存按钮或设备；写存档失败不能显示已保存：Task 4 / 6 / 7 验证画面范围、输入坐标和失败回退。

## 当前基线与默认布局

用户补充后的默认位置以 `tools/scene-spec.ts` 与 `main.scene` 为准：

| 稳定布局 ID | 默认 x / z | 占地宽 / 深 | 默认操作方向 | 编辑方式 |
| --- | --- | --- | --- | --- |
| fridge | -3.5 / 0 | 1 / 1 | +X | 移动、旋转 |
| shelf | -3.5 / 1 | 1 / 1 | +X | 移动、旋转 |
| assembly | -3.5 / -1.5 | 1 / 2 | +X | 两段模型与台面盘子成组 |
| grill | 0.5 / -2.5 | 2 / 1 | +Z | 两个炉位成组 |
| sink | 7.5 / 0.5 | 1 / 2 | -X | 两段水槽成组 |
| rack | 7.5 / 2 | 1 / 1 | -X | 移动、旋转 |
| fryer | 2 / -2.5 | 1 / 1 | +Z | 已购时开放编辑 |
| drinks | 3.5 / -2.5 | 1 / 1，含底柜 | +Z | 已购时开放编辑；机器触发中心局部偏移 z=-0.2 |
| extinguisher | 4.5 / 3.25 | 0.5 / 0.5 | 无固定操作面 | 只移动 |
| register | -3.5 / 3.1 | 原触发宽 1 | 厨房一侧 -Z | 柜台横移 |
| serve | -1 / 3.1 | 原触发宽 2 | 厨房一侧 -Z | 柜台横移 |
| delivery | 3 / 3.1 | 原触发宽 1 | 厨房一侧 -Z | 柜台横移 |

`quarterTurn=0` 表示当前默认摆法，不是模型的绝对 yaw。各模型保留当前艺术 yaw，增加工位的 90° 增量。正 Y 旋转与 Cocos 一致：`(x,z)` 在一档后成为 `(z,-x)`。

固定几何从当前 SPEC 提取：主厨房/洗区地板联合范围 x=-4..8、z=-3..3.6，导航另含冷库 x=5..8、z=-6..-3。前台物理柜台统一覆盖 x=-4..3.5、z=2.6..3.6；服务点是其上的逻辑标记，不再另外生成移动碰撞柜台。墙、北侧空白区、后排填充柜、冷库货架与补货碰撞沿用现有位置。当前未启用的 `Wall_Utility`、`Block_Return`、`Block_Pack` 不重新变成障碍。

## 文件职责与顺序

| 文件 | 职责 | 任务 |
| --- | --- | --- |
| `game/assets/logic/scene-layout.ts` | 默认布局、稳定 ID、设备规格、固定区域与障碍 | 1 |
| `game/assets/logic/layout.ts`（新） | 格式解析、旋转投影、布局几何、导航与校验 | 1–2 |
| `game/assets/logic/types.ts`、`kitchen.ts` | 可选操作面数据、实际动作的同一可达规则 | 2 |
| `game/assets/logic/progress.ts` | v3 迁移、独立布局回退、整份进度写入结果 | 3 |
| `game/assets/logic/layout-editor.ts`（新） | 编辑草稿、单指手势、撤销和工具栏/相机几何 | 4 |
| `game/assets/scripts/LayoutRuntime.ts`（新） | 场景绑定、绝对应用设备组、运行阴影 | 5 |
| `game/assets/scripts/WorkstationEffects.ts` | 从旋转后模型取锚点，锅具和网格销毁 | 5 |
| `game/assets/scripts/LayoutEditor.ts`（新） | 点选、地面投影、拖动、轮廓、提示和按钮 | 6 |
| `game/assets/scripts/StationView.ts` | 初始化/应用布局、缓存同步、休息菜单、输入与存档事务 | 3 / 5 / 6 |
| `game/assets/scripts/ShopUi.ts` | 休息菜单增加一行后的高度/容量，沿用现有面板风格 | 6 |
| `tools/scene-spec.ts`、`layout-navigation.ts`、`layoutcheck.ts` | 默认场景与纯逻辑几何一致；保留默认难度模拟 | 1–2 |
| `tests/layout.test.ts`、`layout-editor.test.ts`（新），现有 progress/kitchen/scene/art 测试 | 纯逻辑与资产判据 | 1–6 |
| `tools/verify-custom-layout.cjs`（新）与现有浏览器验证脚本 | 真输入编辑/营业链路、截图、资源生命周期证据 | 5–7 |
| `docs/custom-layout-verification-2026-10-15.md`（新）、`ROADMAP.md` | 实际结果、文件清单、遗留及有意行为 | 7 |

所有任务顺序执行；共享 `StationView` 不交给多个写入者同时改。

## Task 1: 布局数据与旋转几何

**Files:** Modify `scene-layout.ts`、`tools/scene-spec.ts`；Create `layout.ts`、其 `.meta`、`tests/layout.test.ts`；Modify `tests/scene-layout.test.ts`。

**Interfaces:**

```ts
export type LayoutId = 'fridge' | 'grill' | 'assembly' | 'shelf' | 'sink' | 'rack'
  | 'fryer' | 'drinks' | 'extinguisher' | 'register' | 'serve' | 'delivery'
export type QuarterTurn = 0 | 1 | 2 | 3
export interface LayoutPose { x: number; z: number; quarterTurn: QuarterTurn }
export interface LayoutConfig { version: 1; stations: Record<LayoutId, LayoutPose> }
export interface LayoutGeometry {
  stations: Station[]
  blockers: AABB[]
  fixtures: Record<LayoutId, AABB>
}
export function defaultLayout(): LayoutConfig
export function parseLayout(raw: unknown): LayoutConfig | null
export function rotateOffset(p: Vec2, quarterTurn: QuarterTurn): Vec2
export function buildLayoutGeometry(layout: LayoutConfig): LayoutGeometry
```

类型定义与 `LAYOUT_FIXTURES`、`LAYOUT_FIXED` 放在 `scene-layout.ts`；上面四个函数放在 `layout.ts`。`Station` / `AABB` / `Vec2` 使用现有类型。每个 fixture 定义默认 pose、宽深、中文名、原 station ID/kind、操作面、触发中心偏移、编辑方式及购买 ID。`RUNTIME_SPOTS` 从默认规格派生，既有调用继续可用。

- [x] 写失败测试，先锁定默认坐标、真实轴交换与旋转符号：

```ts
it('projects a quarter-turn using the original fixture dimensions', () => {
  const d = defaultLayout()
  expect(d.stations.fridge).toEqual({ x: -3.5, z: 0, quarterTurn: 0 })
  expect(d.stations.shelf.z).toBe(1)
  d.stations.grill = { x: 0, z: 0, quarterTurn: 1 }
  const g = buildLayoutGeometry(d)
  expect(g.fixtures.grill.halfX).toBe(.5)
  expect(g.fixtures.grill.halfZ).toBe(1)
  expect(rotateOffset({ x: 0, z: 1 }, 1)).toEqual({ x: 1, z: 0 })
})
it('returns independent defaults and rejects malformed records', () => {
  const a = defaultLayout(), b = defaultLayout()
  a.stations.fridge.x = 0
  expect(b.stations.fridge.x).toBe(-3.5)
  expect(parseLayout({ ...b, stations: { ...b.stations, unknown: b.stations.fridge } })).toBeNull()
  expect(parseLayout({ ...b, stations: { ...b.stations, fridge: { x: Infinity, z: 0, quarterTurn: 0 } } })).toBeNull()
})
```

- [x] Run `pnpm test -- tests/layout.test.ts`；新模块/函数缺失应失败。
- [x] 实现深复制默认记录、封闭字段解析和整数朝向检查。缺失工位/未知 ID/未知版本/字符串数值/NaN/Infinity/非对象均返回 null，不接受部分设备配置。有限但越界坐标留给 Task 2，不能静默夹回地图。
- [x] 实现旋转和 AABB 投影；每次从原宽深计算，不能交换上一次的结果：

```ts
export function rotateOffset(p: Vec2, q: QuarterTurn): Vec2 {
  switch (q) {
    case 0: return { x: p.x, z: p.z }
    case 1: return { x: p.z, z: p.x === 0 ? 0 : -p.x }
    case 2: return { x: p.x === 0 ? 0 : -p.x, z: p.z === 0 ? 0 : -p.z }
    case 3: return { x: p.z === 0 ? 0 : -p.z, z: p.x }
  }
}
```

- [x] `buildLayoutGeometry` 生成原玩法 station ID，统一 movable fixture 碰撞。饮料底柜与机器算同一设备；水槽、制作台的两段算一盒。服务点不加入移动实体碰撞，原柜台代理组成固定物理柜台；固定补货点继续生成玩法工位。
- [x] 将 `SPEC` 中可编辑设备默认变换改为读取同一规格并加模型局部偏移；固定节点规格保留。增加默认投影与场景的逐 ID 比对，并测试 drinks 一档旋转后的机器偏移为 x=-0.2、z=0。
- [x] Run `pnpm test -- tests/layout.test.ts tests/scene-layout.test.ts`、`pnpm typecheck`、`git diff --check`。默认场景不变，测试通过。

## Task 2: 净宽、连通性与真实操作面

**Files:** Modify `layout.ts`、`types.ts`、`kitchen.ts`、`tools/layout-navigation.ts`、`tools/layoutcheck.ts`、`tests/layout.test.ts`、`tests/kitchen.test.ts`、`tests/scene-layout.test.ts`。

**Interfaces:** Consumes Task 1 的类型/几何；新增：

```ts
export interface LayoutIssue {
  code: 'outside' | 'overlap' | 'gate' | 'aisle' | 'spawn' | 'access' | 'service'
  id?: LayoutId
  message: string
}
export interface LayoutValidation { ok: boolean; issues: LayoutIssue[] }
export function validateLayout(layout: LayoutConfig, owned: readonly string[]): LayoutValidation
export function canUseStation(pos: Vec2, station: Station, blockers?: readonly AABB[]): boolean
export function safeLayoutPosition(layout: LayoutConfig, pos: Vec2): boolean
```

`Station` 增加可选 `access: { front: Vec2 | null; reach: number; fixture: AABB }`。`KitchenConfig` 增加可选 `accessBoxes: readonly AABB[]`。未提供 access 的历史模拟/测试工位维持原触发行为。新布局的运行工位必须提供 access；纯导航与实际交互必须调用同一 `canUseStation`。

- [ ] 写默认活性、堵门、旋转后背面拒绝测试：

```ts
it('accepts the live default before rejecting a blocked gate', () => {
  const d = defaultLayout()
  expect(validateLayout(d, ['fryer', 'drinks']).ok).toBe(true)
  d.stations.assembly = { x: 6.25, z: -2.5, quarterTurn: 1 }
  const result = validateLayout(d, ['fryer', 'drinks'])
  expect(result.ok).toBe(false)
  expect(result.issues.some(e => e.code === 'gate' || e.code === 'aisle')).toBe(true)
})
it('uses the rotated front, not a centre-distance shortcut', () => {
  const d = defaultLayout()
  d.stations.grill = { x: 0, z: 0, quarterTurn: 1 }
  const g = buildLayoutGeometry(d)
  const s = g.stations.find(s => s.kind === 'grill')!
  expect(canUseStation({ x: 1, z: 0 }, s, g.blockers)).toBe(true)
  expect(canUseStation({ x: -1, z: 0 }, s, g.blockers)).toBe(false)
})
```

- [ ] Run `pnpm test -- tests/layout.test.ts`，确认校验缺失导致失败。
- [ ] 将现有 0.1m 网格的空闲采样、禁止斜穿角和 flood-fill 核心移入 `layout.ts`，参数使用统一几何。保存/加载时运行完整导航；拖动落格后运行并缓存结果，未换格不重新分配导航，不能在每帧营业时 flood-fill。
- [ ] 逐盒检查主厨房/洗区联合区域、固定墙柜、设备重叠。贴边相切允许，旋转后的真实占地越界拒绝；不能把冷库/顾客区当放置区。前台服务点检查 z=3.1、quarterTurn=0、原触发宽能放进固定柜台、服务标记不互相覆盖；其柜台宿主重叠是明确豁免。
- [ ] 冷库门宽从固定 `Wall_Store_W2` / `Wall_Store_S` 的边缘计算，并检查门前设备遮挡。再用半径 0.75m 的通道网格，保证固定出生点 `(0,1.55)` 到固定冷库门中点 `(6.25,-3.1)` 有连通路线；这条路线跨过主厨房与洗区。其他工位操作位置用真实半径 0.35m 网格，从出生点连到每个必需操作面及固定补货点。不能把旧布局的中央/洗区某个采样坐标设成必须空着的位置，误拒绝已经留出另一条合格通道的自定义布局。可选设备只在拥有时要求操作面，但其底柜物理占地始终参与碰撞。
- [ ] 实现 `canUseStation`：先沿用 radial trigger；再检查操作面外侧、距盒面不超过 reach、玩家到操作面的线段不穿其他障碍。跳过 `access.fixture` 的自身盒，灭火器不限定正面；零 Cocos，营业热路径不分配数组。`stationInReach` 和 `interact` 同时调用它，不能只修改提示查询。

```ts
// stationInReach filter and interact guard both use this predicate.
if (!canUseStation(playerPos, station, st.cfg.accessBoxes)) {
  return blocked('out-of-range')
}
```

- [ ] 增加同位置两设备、矩形转出地图、背墙工位、0.7m 能通但 1.5m 主通道不通、隔墙操作、只断开补货点的测试；另接受绕开旧中央采样点、仍保留合格主通路的布局。所有拒绝测试先断言合法默认可达；错误带中文名称和具体原因。
- [ ] 离线工具复用校验和操作面；保留现有 routeDistances 与默认 `pnpm layout` 的模拟难度闸门。用户自定义不跑默认完成率等价检查。
- [ ] Run `pnpm test -- tests/layout.test.ts tests/kitchen.test.ts tests/scene-layout.test.ts`、`pnpm layout`、`pnpm check:no-engine`、`git diff --check`。

## Task 3: v3 迁移与完整布局保存

**Files:** Modify `progress.ts`、`StationView.ts` 的 load/save；Modify `tests/progress.test.ts`、其他显式构造 Progress 的测试调用方。

**Interfaces:** `Progress` 增加 `layout: LayoutConfig`；`newProgress` 产生独立默认布局；`parseProgress` 接受 v1/v2/v3；新增：

```ts
export function progressWithLayout(p: Progress, layout: LayoutConfig): Progress
export function persistProgress(p: Progress, write: (key: string, value: string) => void): boolean
```

`progressWithLayout` 返回新 Progress，不改原对象；布局做深复制。`persistProgress` 用现有 SAVE_KEY 一次调用 write，捕获异常返回 false。`StationView.save` 改为返回 boolean，原调用方可忽略结果；编辑保存必须检查结果。

- [ ] 增加保留旧进度和单写失败测试：

```ts
it('falls back only the layout while preserving old money and purchases', () => {
  const p = parseProgress(JSON.stringify({ v: 2, day: 7, best: [3, 2], coins: 80, owned: ['fryer'] }))
  expect(p.day).toBe(7)
  expect(p.coins).toBe(80)
  expect(p.owned).toEqual(['fryer'])
  expect(p.layout).toEqual(defaultLayout())
  const bad = parseProgress(JSON.stringify({ ...p, v: 3, layout: { version: 1, stations: {} } }))
  expect(bad.coins).toBe(80)
  expect(bad.layout).toEqual(defaultLayout())
})
it('writes once and keeps the original progress when storage throws', () => {
  const p = newProgress(), d = defaultLayout()
  d.stations.fridge.x = -2
  const next = progressWithLayout(p, d)
  let writes = 0
  expect(persistProgress(next, () => { writes++; throw Error('quota') })).toBe(false)
  expect(writes).toBe(1)
  expect(p.layout.stations.fridge.x).toBe(-3.5)
})
```

- [ ] Run `pnpm test -- tests/progress.test.ts`，新字段/版本/函数缺失应失败。
- [ ] 升级 VERSION=3。解析其他字段按现有规则处理，随后 `parseLayout` + `validateLayout`；布局缺失或不合法单独默认。serialize 写 `{v:3, day,best,coins,owned,decor,layout}`，不序列化临时选中/手势/历史。

```ts
export function persistProgress(p: Progress, write: (key: string, value: string) => void): boolean {
  try { write(SAVE_KEY, serializeProgress(p)); return true }
  catch { return false }
}
```

- [ ] 测试 v1、v2 无 layout、v3 往返、未知 layout ID、非法朝向、缺一设备、几何堵门以及 decor 已购/摆放完整保留。现有“v3 是坏档”断言改为未知 v4；测试中手写 Progress 改成 `{...newProgress(), ...业务覆盖}`。
- [ ] `StationView.save` 用此函数包装 `sys.localStorage.setItem`，失败仍沿用当前日志，不返回假成功。加载的实际应用留给 Task 5。
- [ ] Run `pnpm check`、`git diff --check`，包括 day-chain/shop/decor 的存档调用方。

## Task 4: 草稿、指针与编辑画面计算

**Files:** Create `layout-editor.ts`、其 `.meta`、`tests/layout-editor.test.ts`。

**Interfaces:** Consumes LayoutConfig、LayoutId、Vec2、owned 与固定画面跨度；新增：

```ts
export interface LayoutEdit {
  original: LayoutConfig
  draft: LayoutConfig
  owned: readonly string[]
  selected: LayoutId | null
  history: LayoutConfig[]
  gesture: { pointer: number; id: LayoutId; start: LayoutConfig; offset: Vec2 } | null
}
export type LayoutCommand =
  | { type: 'select'; id: LayoutId }
  | { type: 'begin'; id: LayoutId; pointer: number; point: Vec2 }
  | { type: 'move'; pointer: number; point: Vec2 }
  | { type: 'end'; pointer: number }
  | { type: 'cancel-pointer'; pointer: number }
  | { type: 'rotate' | 'undo' | 'default' }
export function beginLayoutEdit(layout: LayoutConfig, owned: readonly string[]): LayoutEdit
export function editLayout(state: LayoutEdit, command: LayoutCommand): boolean
export interface EditorViewport {
  width: number; height: number
  inset: { left: number; right: number; top: number; bottom: number }
}
export interface EditorFrame {
  buttons: Array<{ id: 'cancel' | 'save' | 'rotate' | 'undo' | 'default'; x: number; y: number; w: number; h: number }>
  work: { x: number; y: number; w: number; h: number }
  orthoHeight: number
  focus: Vec2
}
export function editorFrame(viewport: EditorViewport): EditorFrame
```

Frame 坐标统一为左下原点屏幕像素；UI 层转换到 Canvas 设计坐标，不把两种单位混用。工具栏沿用现有 UI 色、字号与 SAFE_GAP；全景相机按照 CONTENT_SPAN / CAMERA_RIGHT / CAMERA_UP 和剩余 work 区计算，不更改普通游戏相机常量。

- [ ] 增加一次拖动一条历史、多指与取消测试：

```ts
it('keeps untouched fractional defaults and commits one step per drag', () => {
  const s = beginLayoutEdit(defaultLayout(), [])
  editLayout(s, { type: 'begin', id: 'fridge', pointer: 1, point: { x: -3.5, z: 0 } })
  editLayout(s, { type: 'move', pointer: 2, point: { x: 0, z: 0 } })
  expect(s.draft.stations.fridge.x).toBe(-3.5)
  editLayout(s, { type: 'move', pointer: 1, point: { x: -2.12, z: .26 } })
  editLayout(s, { type: 'end', pointer: 1 })
  expect(s.draft.stations.fridge).toEqual({ x: -2, z: .5, quarterTurn: 0 })
  expect(s.history).toHaveLength(1)
  expect(s.draft.stations.extinguisher.z).toBe(3.25)
  editLayout(s, { type: 'undo' })
  expect(s.draft).toEqual(s.original)
})
it('rolls back only the unfinished pointer gesture', () => {
  const s = beginLayoutEdit(defaultLayout(), [])
  editLayout(s, { type: 'begin', id: 'fridge', pointer: 1, point: { x: -3.5, z: 0 } })
  editLayout(s, { type: 'move', pointer: 1, point: { x: -1, z: 0 } })
  editLayout(s, { type: 'cancel-pointer', pointer: 1 })
  expect(s.draft).toEqual(s.original)
  expect(s.history).toHaveLength(0)
  expect(s.gesture).toBeNull()
})
```

- [ ] Run `pnpm test -- tests/layout-editor.test.ts`，模块缺失应失败。
- [ ] 按上述命令实现草稿。begin 保存设备点击偏移和手势前整份草稿；move 对 owner pointer 更新吸附位置；end 只在有实际变化时把 start 压入 history，最多 20 条。取消指针恢复 start，不制造 undo。gesture 期间忽略工具栏变更命令。
- [ ] 旋转仅 selected 设备，`(quarterTurn+1)%4`；灭火器/服务点禁旋转。服务点 move 只改变 x，z=3.1/quarterTurn=0 保留。未购 fryer/drinks 不能选中；其默认位置保留。恢复默认同样压入一步历史，original 不改。
- [ ] 测试空撤销、重复点选不吸附、旋转四次回原位、20 条上限、恢复默认后撤销、取消不改变原对象、未购不可移动，以及跨 toolbar 的手势不会保存。
- [ ] 实现 `editorFrame`，先从安全区和微信胶囊保留区划定 work。正交半高取横/纵投影所需值最大值，focus 对准 work 中心；预留 EDGE_MARGIN。保存/取消位于上栏，旋转/撤销/默认位于下栏，五个按钮可点范围不重叠。短屏降低沿用间距，不缩到不能点。
- [ ] 对 1024×768、1280×720、1560×720 与左右/顶部安全区测试：按钮在可用屏幕内、work 非空、固定内容投影四角均在 work 中；Canvas 转换的实际 CSS 点击尺寸在浏览器任务再测。
- [ ] Run `pnpm test -- tests/layout-editor.test.ts`、`pnpm typecheck`、`git diff --check`。

## Task 5: 成组应用、碰撞与视觉同步

**Files:** Create `LayoutRuntime.ts` 和 `.meta`；Modify `StationView.ts`、`WorkstationEffects.ts`、`tests/restaurant-art.test.ts`、`tools/verify-workstation-effects.cjs`。

**Interfaces:** Consumes buildLayoutGeometry；新增 `LayoutRuntime`：

```ts
export class LayoutRuntime {
  constructor(kitchenRoot: Node)
  apply(layout: LayoutConfig): LayoutGeometry
  destroy(): void
}
```

构造时定位全部绑定并捕获初始世界变换/默认 pose，缺失必需节点时关闭编辑入口并给日志，不能半套布局继续应用。`apply` 从捕获值计算绝对位置/旋转；重复应用相同布局不漂移。运行预览调用此方法只改模型和阴影，不改厨房状态/金币/存档；正式同步由 `StationView.applyLayout(layout)` 接手。

- [ ] 在浏览器效果验证中先加旋转/重复应用断言：grill 改到 `(0,0)`、q=1 后两个 CookingPan 锚点围绕新炉位；sink 两段相对距离保持 1m。恢复默认后需有且只有两个锅、一个 WorkstationEffects、一个动态阴影节点。现有未支持布局接口的构建应失败。
- [ ] 绑定设备组：

| ID | 逻辑/碰撞节点 | 随动艺术节点（相对 Kitchen） |
| --- | --- | --- |
| fridge | Station_Fridge | Props/Prop_Fridge |
| grill | Station_Grill | Props/Prop_Grill |
| assembly | Station_Assembly | Props/Prop_Assembly、Prop_AssemblyEast、Prop_AssemblyPlate |
| shelf | Blockers/Block_Plate | Props/Prop_Plate |
| sink | Station_Sink | Props/Prop_Sink_0、Prop_Sink_1 |
| rack | Blockers/Block_DishRack | Props/Prop_WashRack |
| fryer | Blockers/Block_Fryer | Props/Prop_Fryer |
| drinks | Blockers/Block_DrinkBase、Station_Drinks | Props/Prop_DrinkBase、机器运行节点 |
| extinguisher | Station_Extinguisher | 其已有模型子树 |
| register | Station_Order 只改逻辑 | Props/Prop_Serve 的 computerScreen、computerKeyboard 子节点 |
| serve | Station_Serve 只改逻辑 | Props/Prop_Pack 的 bag、styrofoam 及 Prop_Serve 的对应包装子节点 |
| delivery | Station_Delivery 只改逻辑 | Props/Prop_Serve/bag_delivery |

- [ ] 非统一缩放的 host 与模型独立保留世界尺度；用原 offset 的旋转和世界 Quaternion 增量，不把已缩放代理盒再套一个旋转父节点造成剪切。固定 `Prop_Serve/kitchenBar` 与 plantSmall1、顾客区和冷库不移动。

```ts
const relative = rotateOffset({ x: base.x - origin.x, z: base.z - origin.z }, pose.quarterTurn)
node.setWorldPosition(pose.x + relative.x, base.y, pose.z + relative.z)
// World quaternion = yaw increment multiplied by the captured world quaternion.
```

- [ ] 初始化顺序：读取 progress → 创建运行设备及模型 → 创建 runtime/应用已验证 layout → 生成 kitchen/movement → 创建 UI、装饰及 effects → 开局。把当前先创建 kitchen 后读档的顺序调整为先准备数据，保留 applyUpgrades/resetKitchen 依赖。
- [ ] 正式 `applyLayout` 将 geometry.stations 写回 kitchen.cfg，geometry.blockers 写入 movement.cfg.boxes 和 kitchen.cfg.accessBoxes；movement 构造时不再额外叠加所有 station.box。重新绑定 shelf/rack/grill/assembly/sink/fryer/drinks/register/delivery 缓存、platePos/rackPos；普通菜单进出和 restart 不覆盖保存布局。
- [ ] 前台队列/取餐/骑手锚点采用原默认位置相对服务点的偏移，随相应服务点横移增量更新。同步 shiftConfig 的 walkInSec；固定 door、exit、seat 不变。验证移动服务点后 NPC 仍在柜台外且按新位置接单/交付。
- [ ] 效果对象只在正式应用后重建：先 deactivate/destroy 旧 effects、锅具、mesh/material，再创建新对象。将 drink/fryer/rack 的世界轴硬编码偏移改成模型局部点经 worldMatrix 投影；grill/sink 已使用模型锚点，继续复用。UI 炉位提示从真实两炉锚点投影，不能保持屏幕固定 ±64px 偏移模拟旋转。
- [ ] `LayoutRuntime` 用合并顶点色软椭圆生成一次动态贴地阴影，设备 footprint 跟随，固定柜台/座椅/装饰阴影保留。禁用旧整场 ContactShadows 避免双影；透明材质共享，重复 apply 销毁旧 mesh，destroy 释放自有材质。保留厨师的现有随动 Shadow。
- [ ] 更新艺术测试：默认源 GLB 仍有有效固定/原始阴影；运行动态阴影通过浏览器 mesh 检查，先验证新位置有影再断言旧位置无影。运行效果验证至少循环 20 次 apply，节点数量不增长，旧效果立即 inactive；下一帧销毁结束后资源节点数量稳定。
- [ ] Run `pnpm check`；新 Web 构建后运行 `verify-workstation-effects.cjs`。此任务的程序设置状态仅证明渲染/生命周期，不当作真实输入玩法验收。

## Task 6: 编辑 UI、输入路由与保存退出

**Files:** Create `LayoutEditor.ts` 和 `.meta`；Modify `StationView.ts`、`ShopUi.ts`；Modify `tests/layout-editor.test.ts` / progress 失败判据。

**Interfaces:** Consumes Task 1–5；新增：

```ts
export interface LayoutEditorCallbacks {
  preview: (layout: LayoutConfig) => void
  save: (layout: LayoutConfig) => boolean
  cancel: () => void
}
export class LayoutEditor {
  readonly node: Node
  readonly state: LayoutEdit
  readonly buttons: EditorFrame['buttons']
  constructor(parent: Node, camera: Camera, layout: LayoutConfig, owned: readonly string[], callbacks: LayoutEditorCallbacks)
  resize(viewport: EditorViewport): void
  down(pointer: number, x: number, y: number): void
  move(pointer: number, x: number, y: number): void
  up(pointer: number): void
  cancelPointer(pointer?: number): void
  destroy(): void
}
```

buttons/state 只用于正常呈现与诊断读取；自动化不得修改它们来绕过输入。`StationView` 新增 `layoutEditor: LayoutEditor | null`、`beginLayoutEditor()`、`saveLayout(layout): boolean`、`exitLayoutEditor(cancelled:boolean)` 与 Task 5 的 `applyLayout`。

- [ ] 先新增浏览器入口判据：真实前台按钮选择休息 → 再点前台“调整厨房布局”。必须看到五个编辑按钮和可选设备，摇杆/取放/丢弃不可点；运行版无入口应失败。
- [ ] 休息菜单增加布局行，ListPanel 最大行数从 DECOR_SLOTS.length+3 增至 +4，并根据可用高度缩放/重新排现有行，不能静默掉最后“休息结束”。布局按钮仅 phase=rest 可进入；营业/结果页调用入口返回，不改状态。
- [ ] 进入先关闭菜单、cancelAll、清 keys/mouseDown/spaceDown，捕获摄像机与 HUD active 状态；建立草稿并切全景。编辑分支在 update 内先于 stepMovement / stepKitchen / NPC 同步，调用编辑器呈现后直接返回；保留屏幕 resize 检查。不能只是把厨师移速设零。
- [ ] 所有 touch/mouse handler 首先判断 layoutEditor，转交单一设备指针；键盘在编辑期间不触发动作。TOUCH_CANCEL / EVENT_HIDE 取消正在拖动的一步，编辑器仍打开；不在后台自动保存或退出。解除编辑时清所有输入，再恢复普通区域捕获。
- [ ] 用 Camera.screenPointToRay 和 y=0 地面求交拖动；禁止固定屏幕 delta 当世界 x/z。点击选择使用真实投影轮廓和稳定 ID，不依赖 Cocos 节点 UUID。UI 按钮先命中，避免按钮下面的设备被一起拖动。
- [ ] 显示名称、选中 footprint、0.5m 地面网格。每个新落格/旋转后校验：绿框合法、红框非法、错误逐条/首条展示；非法草稿允许继续拖回。绘制草稿模型时调用 runtime.apply，营业缓存保持原配置，直到保存/取消。
- [ ] 初次进入提示“点工位选择，拖动调整，旋转改变朝向；绿色可保存”。用独立偏好键 `kc.layoutHintSeen` 记录已展示（不参与 gameplay 存档）；读写不可用时本会话只显示一次。取消布局仍不再重复首次提示。
- [ ] 保存事务按下面顺序，不把整份 progress 提前改成 next：

```ts
const checked = validateLayout(layout, this.progress.owned)
if (!checked.ok) return false
const next = progressWithLayout(this.progress, layout)
if (!StationView.save(next)) return false
this.progress = next
this.applyLayout(next.layout)
this.exitLayoutEditor(false)
return true
```

- [ ] 保存失败提示“布局未保存，请重试”，仍显示草稿、保持编辑冻结；取消把 runtime 与玩法缓存恢复 original，不写 layout。恢复默认不退出/不落盘；只有成功保存关闭编辑器。
- [ ] 退出恢复相机跟随参数、HUD 和休息日菜单状态；若原玩家位置不安全，用 safeLayoutPosition 校验后放到已验证 spawn，否则保持原位置。取消不凭空移走原安全位置；不影响营业时间、库存或 day。
- [ ] 浏览器模拟 `sys.localStorage.setItem` 抛异常，只在独立验证用例注入并恢复：保存应留在编辑器、progress 原记录不变，随后恢复存储重试一次成功。再测旋转/拖动后取消和 refresh 原布局不变。
- [ ] Run `pnpm check`、`git diff --check`；完成编辑器实际输入用例后再进入 Task 7。

## Task 7: 真输入回归、构建与交付证据

**Files:** Create `tools/verify-custom-layout.cjs`、`docs/custom-layout-verification-2026-10-15.md`；Modify `tools/verify-open-centre.cjs` 的默认锚点兼容、`ROADMAP.md`。

**Interfaces:** 验证脚本 CLI：`node tools/verify-custom-layout.cjs <url> <outputDirectory>`。输出 result.json、编辑前/合法草稿/堵门/保存刷新/营业/三屏幕截图。非零退出表示任何判据失败。

- [ ] 仿现有脚本等待 StationView ready、读取真实 screenW/H 和 canvas rect，显式核对新默认 fridge/shelf 坐标。mouse/touch 坐标必须从真实投影或按钮屏幕矩形换算：

```js
const assert = require('node:assert/strict')
async function editorButton(page, id) {
  const p = await page.evaluate(id => {
    const b = sv.layoutEditor.buttons.find(b => b.id === id)
    if (!b) throw Error('Missing layout button ' + id)
    const r = document.querySelector('canvas').getBoundingClientRect()
    return { x: r.left + (b.x + b.w / 2) * r.width / sv.screenW,
      y: r.top + (sv.screenH - b.y - b.h / 2) * r.height / sv.screenH }
  }, id)
  await page.mouse.click(p.x, p.y)
}
```

- [ ] 真实操作序列：先保留原存档 → 通过摇杆前台休息入口进入 → 移动冰箱 → 旋转制作台到可用正面 → 制作台拖堵冷库入口 → 点保存被拒绝且存档值不变 → 撤销 → 恢复默认再撤销 → 取消 → 重进、摆成校验通过的布局 → 保存 → reload 位置/朝向一致。用下列断言绑定负向拒绝与活性：

```js
assert.equal(before.defaultValid, true)
assert.equal(blocked.saveExited, false)
assert.equal(blocked.persisted, before.persisted)
assert.equal(saved.editorOpen, false)
assert.deepEqual(reloaded.layout, saved.layout)
assert.equal(reloaded.pans, 2)
assert.deepEqual(result.pageErrors, [])
assert.deepEqual(result.failedRequests, [])
```

- [ ] editor 多指测试用浏览器触摸事件/CDP 输入：第一指拖设备，第二指点保存/别的设备不劫持；取消 owner 后回退 unfinished 草稿。切后台后没有粘住动作；编辑期间 shift.t、grill elapsed、dirty return、顾客位置、movement.pos 均保持进入时值。
- [ ] 保存后的营业用同一个真实摇杆驱动器，按新工位操作面导航，完成实际订单的取料、煎肉、制作、送餐。断言 served=1、wrong=0；等真实脏盘返回后刷盘、晾架、还盘，再从冷库取货给新位置冰箱补货。不得 teleport 或调用 interact 代替输入；特效专用脚本的状态注入独立记录。
- [ ] 各服务点横移后核对电脑/包装/交付标记和队列/取餐/骑手锚点同增量，顾客仍在固定柜台外。旧点不残留可操作空气工位；设备旧位置移动碰撞不残留、新位置确实碰撞，先确认正向锚点存在。
- [ ] 4:3、16:9、长屏（1024×768 / 1280×720 / 1560×720）分别真实点按钮并拖设备，核对 toolbar 完全在安全区、CSS 点击区域至少 44px、全部设备可选，拍图。加入微信胶囊保留区用例。
- [ ] Full check：`pnpm check`、`pnpm layout`、`pnpm cam`、`pnpm scene`。后两者的大报告落 `game/temp/`，仅读取结论；不能仅因测试通过就声称微信手机拖动已验收。
- [ ] Web 与微信构建顺序执行：先确保新增 `.meta` 导入完成，再使用现有 Cocos CLI / `tools/build-wechat.json`；构建配置复制到 ignored temp，Web outputName=`custom-layout-web`、compression=`merge_dep`，微信 outputName=`kitchen-chaos-custom-layout-wechat-20261015`、compression=`subpackage`。Creator 路径 `C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe`，参数 `--project <absolute game path> --build configPath=<absolute config>`，后台窗口隐藏。日志确认成功后启动预览。
- [ ] Run 浏览器 CLI、`verify-workstation-effects.cjs`；确认零 pageerror/资源失败，记录真实输入与程序状态注入的验证边界。微信运行 `node tools/check-wechat-package.mjs game/build/kitchen-chaos-custom-layout-wechat-20261015 game/temp/custom-layout-package.json`，withinBudget=true，并核对 game.json / settings 分包与远程资源字段。
- [ ] 将微信目录压 ZIP 至 `game/build/packages/`，对 ZIP 内容逐文件 byte 校验；恢复 Creator 自动改动的 splash URL 字段，保留其他设置。检查 `git diff --check`，记录文件清单和实际测试数量，不预填通过结果。
- [ ] 验证文档必须含“不要报成 bug”：建筑不可移动、未购设备不可调整、服务点只横移、默认精确坐标不全量吸附、取消不保存、custom 不要求默认模拟完成率、月度费用仍是后期建议。遗留记录手机真实拖动/多指触控试玩签收。

## 计划自审与执行交接

- [x] 规格覆盖：操作/工具栏/首次提示→4/6；设备范围→1/5/6；操作面/净宽/连通→2；旧档/原子保存→3/6；模型/特效/阴影/NPC→5；真实输入/响应式/微信→7。
- [x] 接口一致：LayoutConfig 不与 sim.ts 的 KitchenLayout 重名；各任务使用同一稳定 ID、QuarterTurn 与 canUseStation；编辑屏幕像素与 Canvas 坐标分开转换。
- [x] 五类风险各有对应任务判据；月度费用不混入本批实现。
- [x] 用户追加的默认冰箱/盘子位置已纳入表格与恢复默认数据。

推荐本会话直接逐任务实现，末尾做一次独立整体审查。主要工作共享 StationView 初始化、存档和相机/输入接口，顺序实现更容易维护这些依赖；不需要逐任务建立多个上下文。

本文件是实现计划，尚不代表编辑器已实现或各验收已通过。2026-10-15 用户已审阅认可，选择“本会话直接实现”；暂停并提交基线后恢复，又限定本次只实现 Task 1，其余在其他窗口继续。当前实际状态以文件顶部 Execution status 和 Task 1 交接为准；后续沿用已批准的设计与执行方式，不重复确认。
