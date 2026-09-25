# `logic/` 公开接口清单 · v0.12（2026-09-25）

`logic/` 是**服务器侧的代码**与**你的 Cocos 组件**之间唯一的接缝，接缝要有文档。

## 使用约定

- **组件里只允许调这份清单上列出的东西**（铁律③）。想要个新方法就说，别在组件里自己写一份
  —— 那就是玩法规则外泄的开始，半年后规则散落在 20 个组件里，既测不了也搬不走。
- 我每次改**公开导出**，同步改本文件，且 commit message 打 `[API]` 前缀。
  你 `git pull` 之后 Cocos 编译报错，第一件事看 `git log --oneline | grep API` 和本文件的 diff。
- `logic/` 零 Cocos 依赖：这里不出现 `Vec3` / `Node` / `Component`，坐标一律 `{ x, z }`。
- **out 参数模式**：几何函数把结果写进第一个参数并返回它，不创建新对象。
  组件里请复用长期持有的临时对象（`private _tmp = { x: 0, z: 0 }`），不要每帧 `{ x: 0, z: 0 }`。

## 当前已实现

| 模块 | 内容 |
|---|---|
| `types.ts` | 全部数据结构与封闭词表 |
| `vec2.ts` | XZ 平面向量 |
| `collision.ts` | 圆 / AABB 碰撞、工位触发范围 |
| `recipe.ts` | 汉堡组装、烤炉火候时间轴 |
| `order.ts` | 订单判定、顾客卡机制层校验 |
| `rng.ts` | 可复现随机源 |
| `sim.ts` | **M1 无头模拟器**（不进包体的部分只有 `tools/sim-cli.ts`，这个文件本身零依赖可打包） |
| `difficulty.ts` | **难度曲线表**：第 1→20 天的参数与三星线 |
| `input.ts` | **M2 输入层**：多点触摸路由、浮动摇杆、点按/长按、相机相对映射 |
| `kitchen.ts` | **M2 厨房状态机**：手持、工位交互、烤炉计时 |
| `movement.ts` | **M2 角色移动**：摇杆 → 相机相对速度 → 碰撞解算后的位置 |
| `camera.ts` | **M2 相机跟随**：玩家位置 → 注视点，视图坐标钳制 + 窄屏兜底 |
| `customer.ts` | **M2 顾客流**：到达、点单、耐心、离店。**与 `sim.ts` 共用同一份** |
| `shift.ts` | **M2 一局**：计时、上菜记账、结算 |
| `witness.ts` | **M4 顾客目击**：厨房出事 → 在场顾客掉一档情绪，挑一位开口 |
| `reviews.ts` | **评价**：离店星级 + 营业中吐槽的记录，给顶部弹窗和电脑评价列表 |
| `delivery.ts` | **外卖**：电脑上接单 / 拒单、送达期限、外卖取餐口交货。自带 rng，不碰顾客流 |
| `progress.ts` | **M4 天数推进与存档格式**：过线解锁下一天、每天的客流、坏档退回新档 |

**尚未建**（按里程碑排）：`chaos.ts`（M4 混乱事件调度）· `economy.ts`（M4 金币/升级/解锁）。

---

## `types.ts`

### 词表常量（运行时可读）

| 导出 | 值 |
|---|---|
| `INGREDIENTS` | `bun` `patty` `cheese` `lettuce` `tomato` `onion` `pickle` `bacon` |
| `CORE_INGREDIENTS` | `bun` `patty` —— 骨架，任何汉堡都必须有 |
| `COOK_LEVELS` | `raw` `rare` `medium` `well` `burnt` |
| `DONENESS` | `rare` `medium` `well` —— 顾客只会点这三档 |
| `MOODS` | `cheerful` `grumpy` `anxious` `dreamy` `menacing` `heartbroken` `manic` `deadpan` |
| `STATION_KINDS` | `fridge` `grill` `assembly` `serve` `sink` |
| `LINE_LIMITS` | 台词字数上限：identity 10 / greet 12 / order 30 / wait_nudge 15 / **praise 40 / complain 40**（后两条是离店点评，玩家在打烊面板上读，不受局内限制） |

### 类型

```ts
type Ingredient    // INGREDIENTS 之一
type CookLevel     // COOK_LEVELS 之一
type Doneness      // CookLevel 里顾客能点的那三档
type Mood
type StationKind

interface CookWindows { rareAt: number; mediumAt: number; wellAt: number; burntAt: number }  // 秒
interface OrderSpec   { required: Ingredient[]; banned: Ingredient[]; doneness: Doneness; patience: number }
interface CustomerLines { greet; order; wait_nudge; praise; complain: string }
interface CustomerArc   { series_id: string; chapter: number; unlock_day: number }
interface CustomerCard  { id: string; order: OrderSpec; identity: string; mood: Mood; lines: CustomerLines; arc: CustomerArc | null }
interface Burger  { ingredients: Ingredient[]; cook: CookLevel | null }
interface Station { id: string; kind: StationKind; pos: Vec2; box: AABB; triggerRange: number }
```

> `Station` 的字段对应编辑器里的 `Station_<名>` 节点（命名约定见 ROADMAP §6.2）。
> `box` 管「别穿过去」，`triggerRange` 管「够不够得着」，两者是不同判定。

---

## `vec2.ts`

```ts
interface Vec2 { x: number; z: number }

set(out, x, z): Vec2
copy(out, src): Vec2
add(out, a, b): Vec2
scale(out, a, s): Vec2
lenSq(a): number
dist2(a, b): number       // 平方距离。比大小用这个，省一次 sqrt
dist(a, b): number
normalize(out, a): Vec2   // 零向量归一化后仍是零向量，不产生 NaN
rotateY(out, a, radians): Vec2   // 绕 Y 轴（俯视顺时针）；out 可以就是 a
```

**⭐ 组件侧最重要的一个用法 —— 摇杆方向映射：**

```ts
// 斜 45° 固定相机下，摇杆的 (x, y) 不能直接当世界的 (x, z)。
// 直接用的话玩家往上推、角色却斜着走。先按相机 yaw 旋转再喂给移动。
vec2.set(this._input, joystick.x, joystick.y)
vec2.rotateY(this._input, this._input, this.cameraYawRadians)
vec2.normalize(this._input, this._input)
```

这行写不写对，决定这个游戏「手感对不对」，比后面所有美术都重要。

---

## `collision.ts`

```ts
interface AABB { center: Vec2; halfX: number; halfZ: number }   // 半宽半深，对应节点 position + size/2

closestPointOnAABB(out, p, box): Vec2
circleOverlapsAABB(pos, radius, box): boolean      // 相切不算重叠
circleOverlapsCircle(a, ra, b, rb): boolean        // 相切不算重叠
resolveCircleAABB(out, pos, radius, box): boolean  // 推出圆心；返回是否推动过；out 可以就是 pos
inTriggerRange(pos, target, range): boolean        // 边界算够得着（与碰撞的严格不等号相反）
```

**组件侧用法 —— 角色移动一帧：**

```ts
// 1) 先按输入积分出想去的位置，2) 再逐个工位推出去
vec2.add(this._next, this.pos, this._step)
for (const st of this.stations) collision.resolveCircleAABB(this._next, this._next, CHEF_RADIUS, st.box)
vec2.copy(this.pos, this._next)
```

不用物理引擎是刻意的（省 ~1.9MB 主包）。「角色卡在灶台里」这类 bug 在这一层能写成单测。

---

## `recipe.ts`

```ts
createBurger(): Burger
addIngredient(burger, ing): boolean       // 已有则拒绝；传 'patty' 视为夹生肉，cook 记 'raw'
addCookedPatty(burger, cook): boolean     // 从烤炉拿的肉饼；一个汉堡只能有一块
hasCore(burger): boolean                  // 面包 + 肉饼齐不齐
cookLevelAt(elapsed, windows): CookLevel  // 烤了 elapsed 秒是什么火候
DEFAULT_COOK: CookWindows                 // { rareAt: 3, mediumAt: 6, wellAt: 9, burntAt: 13 }
```

> 烤炉计时**只存一个开始时刻**，每帧用 `cookLevelAt` 现算即可 —— 不要在组件里另存一份火候状态，
> 那会和逻辑层不同步。
>
> `DEFAULT_COOK` 是 M1 标定出来的那组窗口，`sim.ts` 的 `defaultSimConfig()` 与运行时组件
> **都从这里读**。第二份拷贝 = 玩到的游戏和调过的游戏不是同一个。

---

## `order.ts`

```ts
interface OrderVerdict { ok: boolean; missing: Ingredient[]; forbidden: Ingredient[]; cookOk: boolean }

judge(burger, spec): OrderVerdict          // 上菜那一刻调；会分配，不要每帧调
validateOrderSpec(spec): string[]          // 内容管线用；空数组 = 合法
```

**判定规则（这几条是玩法契约，改动前先说）：**

- 额外食材（既不在 `required` 也不在 `banned`）**不算错** —— `banned` 是唯一的否定通道
- `cook` 与 `doneness` 必须**完全相等**；没放肉饼（`cook === null`）自然判失败
- 出错项**列全不短路** —— 评价系统要按具体错项挑 `complain`
- `validateOrderSpec` 拦得住：词表外食材 / required∩banned 相交 / 缺骨架 / banned 含骨架 / patience ≤ 0
- **拦不住**：JSON Schema 表达不了的跨字段约束由它兜底，反过来它也不做 schema 的事（字数、格式）

---

---

## `rng.ts`

```ts
interface Rng { s: number }

createRng(seed): Rng
reseed(rng, seed): void          // 跑上千局时复用同一个对象
nextFloat(rng): number           // [0, 1)
nextInt(rng, maxExclusive): number
nextRange(rng, lo, hi): number   // lo === hi 时恒返回 lo
pick(rng, arr): T
chance(rng, p): boolean
```

**别用 `Math.random`**：难度参数只有在两次跑的客流、订单完全一致时才比得出来，
否则观测到的差异里混着随机噪声。游戏里也一样 —— 同一天的客流应该可复现（`seed = 天数`）。

---

## `sim.ts`

```ts
interface SimConfig  { seed, durationSec, layout, chef, cook, grillSlots, flow, orders, trace? }
interface DayResult  { arrived, served, wrong, timedOut, completionRate, badReviewRate,
                       peakConcurrent, burnt, idleSec, trace }

defaultSimConfig(): SimConfig
runDay(config): DayResult                 // 跑完整一局，几毫秒
createSimState(config): SimState          // 逐帧接口
stepSim(state, dt): void                  // 热路径零分配（铁律②，10 万帧实测平坦）
SIM_DT                                    // 1/30
```

组件侧一般用不到它 —— 它是**给参数标定用的**（`pnpm sim ...`）。
M3 会拿它跟真人实测做对照：模拟器说「同时 4 单开始崩」，真人如果 2 单就崩，
说明操作摩擦比预期大一倍，那时该改的是操作和 UI，不是难度数值。

---

## `difficulty.ts`

```ts
difficultyForDay(day): { day, flow, orders, stars: { one, two, three } }
starsFor(served, day): 0 | 1 | 2 | 3
LAST_DAY  // 20
```

**M3/M4 直接用这个，不要自己写死数值。** 天数越界会向内夹紧。
`stars` 的单位是「当天完成的单数」。曲线怎么标定出来的、哪几个旋钮有效，
见 `difficulty.ts` 顶部的注释 —— 里面有两条反直觉的结论，改参数前先读。

---

## `input.ts`

```ts
// 摇杆
interface StickConfig { radius: number; deadzone: number }   // 像素 / 归一化后
interface StickState  { dirX, dirY: number; magnitude: number; active: boolean }
DEFAULT_STICK   // { radius: 90, deadzone: 0.15 }

// 动作键（一个键，点按与长按都从它出）
interface ActionConfig { holdSeconds: number }
interface ActionState  { down, holding, tapped, holdStarted: boolean; heldSeconds: number }
DEFAULT_ACTION  // { holdSeconds: 0.3 }

// 捕获区（UI 面板的格子、丢弃键）
interface CaptureZone { id: string; x, y, w, h: number }   // 左下角原点，与 onDown 同系

class TouchRouter {
  constructor(splitX: number, stickCfg?: StickConfig, actionCfg?: ActionConfig)
  readonly stick: StickState
  readonly action: ActionState
  onDown(id, x, y) / onMove(id, x, y) / onUp(id)
  cancelAll()            // TOUCH_CANCEL 与 onHide 必须调
  tick(dt)               // 每帧一次，在读 action / zone 之前
  setSplitX(x)
  setCaptureZones(zones: readonly CaptureZone[])   // 换一批；正按着的手指整根作废
  zone(id: string): ActionState | undefined        // 语义与 action 完全一致
  get stickOriginX / stickOriginY: number          // 摇杆按下的那一点，浮动摇杆的视觉用
}

// UI 矩形 ↔ 捕获区（唯一该做这个换算的地方）
uiRectToCaptureZone(id, cx, cy, w, h, screenW, screenH, designH?): CaptureZone
panelChildZone(id, panelX, panelY, childX, childY, w, h, screenW, screenH, designH?): CaptureZone
screenToCanvasX(x, screenW, screenH, designH?) / screenToCanvasY(y, screenH, designH?)

// 相机相对映射
ISO_CAMERA_YAW                                   // Math.PI / 4
stickToWorld(out, stick, cameraYaw): Vec2        // 单位方向
stickToVelocity(out, stick, cameraYaw, speed): boolean   // 带 magnitude，回中返回 false
```

**组件那边只做三件事**：把 touch 事件拆成 `(id, x, y)` 喂进来 · 每帧先 `tick(dt)` 再读状态 ·
`stickToVelocity` 的结果交给 `collision.resolveCircleAABB`。摇杆的死区、饱和、
手指归属这些一行都别在组件里重写。

⚠ **三条真机上必须验的**：

1. **坐标系**：`(x, y)` 按 Cocos `Touch.getLocation()` 的约定 —— 左下为原点、**y 向上**。
   组件那边如果拿的是 y 向下的坐标，在组件里翻符号，不要改 `input.ts`。
2. **yaw 的符号**：四个方向各推一次看角色往哪走。前后反了把 yaw 取负，
   左右反了说明相机往另一边转。这里锁死的是「先旋转再移动」的结构，不是某个具体符号。
3. **`holdSeconds` = 0.3 秒是待调值**：太短会把正常点按误判成长按。

**已经处理掉的坑**（别在组件里重复解决）：拇指划过屏幕中线不会让摇杆失灵（归属按下时定死，
之后只认 id）· 第三根手指不会抢走已在推的摇杆 · 斜推到角落 `magnitude` 不会超过 1 ·
按下不动不产生 NaN · 来电/切后台后摇杆不会卡在最后方向（前提是组件挂了 `cancelAll`）。

### 捕获区：为什么需要它

分路是**按左右半屏**的 —— 右半屏任何一点按下都算动作键。冰箱面板的 8 格横跨屏幕中线、
丢弃键落在右半屏，不先把它们从分路里摘出来，**点格子会推摇杆、按丢弃键会同时取一次料**。

`setCaptureZones()` 登记的矩形在 `onDown` 时优先认领手指，认领后不进左右分路。
规则三条，各有测试盯着：

| 规则 | 为什么 |
|---|---|
| 命中含左下边、不含右上边 | 相邻格子共边时只中一个，否则中间那条缝会同时属于两格 |
| 重叠时先登记的赢 | 后登记的永远点不到 —— 所以 `Slot_*` 之间有一条「不重叠」的判据 |
| 滑出即作废，滑回不复活 | 点错格子后划开松手是玩家唯一的反悔手段；作废的手指也不会转投摇杆/动作键 |

⚠ **坐标系差一个半屏的平移**：UI 节点的 position 是 Canvas 中心原点（x∈[-640,640]），
捕获区是触摸的左下原点（x∈[0,1280]）。直接拿节点 position 当捕获区，整块区会偏到
屏幕左下角 —— 而且**偏得像「没生效」，不像坐标错**。转换只走 `uiRectToCaptureZone()`，
别在组件里重写。

> 它原先在 `tools/scene-spec.ts`，2026-09-15 搬来这里 —— Cocos 只编译 `assets/` 下的脚本，
> 留在 `tools/` 的话运行时组件根本 import 不到，只能各写一份。`scene-spec.ts` 原样转出去。

⚠ **面板底下的格子还差第二次平移**：组件从 `slotNode.position` 读到的是**相对面板**的
（-204, 68），而 `uiRectToCaptureZone` 要的是 Canvas 绝对值（-204, 128）。直接喂进去，
8 个格子的命中区整体差一个面板偏移，**而判据照样全绿**（两边读同一个数）。
所以挂在面板下的节点一律走 `panelChildZone()` —— 它是场景那侧 `localPos()` 的逆，
两边各有反例锚点盯着。

`screenToCanvasX/Y` 是反向换算，给浮动摇杆用：把 `stickOriginX/Y`（触摸像素）换成
Canvas 坐标，视觉才会正好落在拇指底下。

---

## `kitchen.ts`

```ts
// 手持：同时只能拿一样
type CarryKind = 'none' | 'ingredient' | 'patty' | 'plate'
interface Carry { kind: CarryKind; ingredient: Ingredient; cook: CookLevel }

interface GrillSlot { busy: boolean; elapsed: number }

interface KitchenConfig { stations: Station[]; cook: CookWindows; grillSlots: number }
interface KitchenState {
  t: number
  carry: Carry
  grill: GrillSlot[]
  burger: Burger            // 唯一一个在制汉堡，预分配
  assemblyOccupied: boolean // 与 carry.kind === 'plate' 互斥
  burnt: number             // 累计烤糊块数，跨过 burntAt 那一帧 +1。组件比对它来发目击事件
  plates / dirty / sink / rack   // 盘子与洗碗，见下
  cfg: KitchenConfig
}

createKitchen(cfg): KitchenState
stepKitchen(st, dt)                       // 每帧一次，只推进烤炉
grillCookLevel(st, slot): CookLevel       // UI 画火候条
stationInReach(st, pos): Station | null   // 每帧一次，「进范围 → 提示」

// 一个动作键的全部去处，按 station.kind 分派
interact(st, playerPos, station, req?): InteractResult
discard(st): InteractResult               // 烤糊的肉唯一的出路

interface InteractRequest {
  ingredient?: Ingredient   // fridge：取哪样
  slot?: number             // grill：取哪位，省略 = 烤最久的那块
  spec?: OrderSpec          // serve：判定依据
}
interface InteractResult {
  kind: 'take-ingredient' | 'place-patty' | 'take-patty' | 'add-to-burger'
      | 'pick-plate' | 'put-plate' | 'serve' | 'discard' | 'blocked'
  reason: BlockReason       // 'none' | 'out-of-range' | 'hands-full' | 'grill-full' | …
  verdict: OrderVerdict | null   // 只有 serve 有
  slot: number                   // 只有烤炉有
}
```

**组件那边只做三件事**：每帧 `stepKitchen(dt)` + `stationInReach()` 决定要不要显示提示 ·
动作键按下时把够得着的那个 station 交给 `interact()` · 按 `result.kind` 播动画、
按 `result.reason` 弹提示。**规则一条都别在组件里重写。**

⚠ **烤糊的肉留在炉上**，与 `sim.ts` 不同 —— 那边的理想厨师不会让它糊，直接删掉了事；
真人得走过去端下来 `discard()`，M4 的起火链就挂在这个占着不放的烤位上。

⚠ **`interact` 不认输入映射**。「冰箱怎么选食材」（8 种食材只有一个 `Station_Fridge`）
和「丢弃怎么触发」都是 UI 决策，还没定 —— 见 ROADMAP §M2 待决。

**已经锁在测试里的**（29 个用例）：同时只能拿一样 · 冰箱拿的生肉也是 `kind: 'patty'` ·
边界上算够得着 · 烤位满了不吞肉 · 烤过的不能回炉 · 不指定烤位取最久那块 ·
重复食材挡下且东西还在手上 · 汉堡不会同时在手上和台上 · 缺骨架的半成品交不出去 ·
送完手和台子都清空。

---

### 盘子与洗碗（2026-09-24）

`KitchenConfig.plates` 不传 = 盘子无限（模拟器走这条，难度基线不受影响）。

```ts
plateOut(st, dineIn)          // 上菜后调：堂食过 returnSec 脏盘回池边；外卖盘子当场回架
interact(station=sink)        // 空手点：池边脏盘全泡进去（'soak'）
scrubSink(st, dt) -> boolean  // 按住动作键每帧调；泡好才刷得动，刷满进架子晾
releaseScrub(st) -> boolean   // 松手那一帧调：刷过 STAIN_MIN(0.5) 就带污渍上架（偷工），返回是否偷工
interact(station=rack)        // 空手或摞没满：从架子拿晾好的（'take-stack'），一摞最多 STACK_MAX(5)
interact(station=shelf)       // 端着摞：放进放盘处（'shelve'），这时才能用
interact(station=storeroom, { plates: true })  // 从冷库领备用盘子（'take-stack'），KitchenConfig.sparePlates 个，领完 'out-of-stock'
carrySpeedFactor(st)          // 摞 > STACK_SLOW(3) 返回 0.7，组件乘到 movement.cfg.speed 上
bumpStack(st, impact) -> n    // movement.blocked 时调；摞 > 3 且 impact ≥ CRASH_IMPACT(0.2，约 37°) 全摔，返回摔了几个
```

开新汉堡没盘 → `blocked('no-plate')`；端着汉堡丢弃，盘子变脏回池边；端着一摞丢弃，整摞进脏盘堆。
带污渍的盘子取肉时**先用**，端给堂食记 `stainedServed++`。事件计数 `burnt / crashed / stainedServed`
组件按增量读，交给 `witness.ts`。

⚠ `rack` / `shelf` 两个工位没有 `Station_*` 节点，组件从 `Blockers/Block_DishRack`、`Block_Plate` 造出来。
**没事可做时 `stationInReach` 不返回它们**（架子上没晾好的 / 手上没摞），否则会抢走紧挨着的洗碗池和组装台。

## `movement.ts`

```ts
CHEF_RADIUS      // 0.35 —— Body 的 scale 0.7 → 直径 0.7 m
DEFAULT_CHEF_SPEED  // 4 m/s，与 sim.ts 的 chef.speed 同值
MAX_STEP_DT      // 0.1 秒，单帧 dt 上限
FLOOR_BOUNDS     // { xmin:-4, xmax:4, zmin:-3, zmax:3 } —— Floor scale [8,0.1,6]

interface Bounds { xmin, xmax, zmin, zmax: number }

// 通用一步解算，不认摇杆。customer.ts 之后直接复用这一个
moveAndSlide(out, pos, step, radius, boxes, bounds): boolean   // 返回是否被挡过

interface MovementState {
  pos: Vec2
  facing: Vec2       // 单位朝向，松手保持不回正
  facingYaw: number  // atan2(facing.x, facing.z)
  moving: boolean
  blocked: boolean   // 本帧被工位或边界推回过
  impact: number     // 本帧位移被挡掉的比例 = 1 - cos(撞墙角)：45° 约 0.29，迎面接近 1
}

createMovement({ stations?, boxes?, speed?, radius?, bounds?, x?, z? }): MovementState
stepMovement(st, stick, cameraYaw, dt)   // 每帧一次
teleport(st, x, z)                        // 开局 / 重开，不走碰撞解算
```

**组件那边只做两件事**：`router.tick(dt)` 之后把 `router.stick` 交给 `stepMovement` ·
把 `pos` 与 `facingYaw` 写回节点。碰撞、边界、朝向平滑一行都别在组件里重写。

⚠ **`facingYaw` 的零点与符号真机上验一次**，跟 `input.ts` 顶部那三条一起验 ——
这里锁死的是「朝向取自**碰撞前**的方向」这个结构，不是某个具体符号。
用碰撞后的位移算朝向，角色蹭着灶台走时会来回扭头。

**已经锁在测试里的**（23 个用例）：推满走 `speed × dt` · 轻推走得慢 · 对角不比直推快 ·
掉帧那帧 dt 被夹住不瞬移 · 撞工位停在半径外 · 侧滑时另一维照走 · 陷在盒里能推出来 ·
四边都留一个半径 · 出餐口贴南墙也挤不出地板 · 蹭墙不扭头 · 松手不回正 ·
速度与 `sim.ts` 一致 · 边界与 `scene-spec` 的 Floor 一致。
⚠ 摇杆的 `dirX/dirY` 是**单位方向**，测试里写 `stick(1, 1)` 会把速度放大 √2 倍。

---

## `customer.ts`

顾客流。**`sim.ts` 与真人局共用这一份** —— 各写一份的话 M1 标定出来的难度曲线对真游戏
就不成立了，而这种偏差要真机玩几十局才看得出来。`pnpm layout` 盯着这条。

```ts
interface Customer {
  active: boolean
  id: number            // 全局递增，换人时组件靠它判断要不要重画订单卡
  patienceLeft: number
  patienceMax: number   // 进度条的分母。别去读 FlowParams，难度是逐天变的
  spec: OrderSpec
  burger: Burger        // 模拟器专用；真人局玩家手上的汉堡在 kitchen.carry
}

interface CustomerFlow {
  customers: Customer[] // 长度 = maxConcurrent，预分配后只复用。**索引即排队位**
  activeCount, arrived, timedOut, peakConcurrent: number
}

createCustomerFlow(flow, orders, rng) -> CustomerFlow
resetCustomerFlow(st, flow, orders)
stepCustomerFlow(st, t, dt, onTimeout?, onArrive?, onWalkOut?)   // 先到达再倒耐心
// FlowParams.lateLeaveSec：stayWhenLate 下超时后再等这么多秒就走，记 flow.leftLate，也走 onWalkOut
releaseCustomer(st, c)                               // 幂等
closeShop(st, onLeave?)                              // 在场的一律记超时
matchCustomer(st, burger) -> Customer | null         // 上菜给谁
rollSpec(rng, orders, pool, patienceSec, spec)       // 出一张单；外卖用自己的 rng/pool 调
patienceRatio(st, c) -> number                       // 当前那段耐心剩几成 0–1，耐心圈的填充量
moodTier(st, c) -> 0|1|2|3|4                         // 头顶五档情绪，由 patienceRatio 映射
```

⚠ `onTimeout` / `onLeave` 在顾客被释放**之前**调用，回调里还看得见是谁。

**`matchCustomer` 的规则**：先找吃得下这一盘的，找不到就砸在最急的那位头上。
**没有匹配也一定要有人接** —— 否则做错了没有代价，`banned` 那一维就白设计了。
多个都吃得下时给最急的。

⚠ 改这个文件时 **RNG 的调用次数与顺序不能变**。少调一次 `nextInt`，之后每一单的食材、
火候、抖动全部错位，判据只会报「偏离基线」，看不出是这里动的。

---

## `shift.ts`

一个班次（真人局）：开门 → 顾客来 → 打烊 → 结算。不管厨房状态（那是 `kitchen.ts`）。

```ts
interface ShiftConfig { seed, durationSec, flow, orders }
interface ShiftState  { t, over, flow: CustomerFlow, served, wrong }
interface ShiftResult { arrived, served, lateServed, wrong, timedOut, walkedOut, leftLate, goodRate }

createShift(cfg) -> ShiftState
resetShift(st, cfg?)                       // 重开一局，不分配
stepShift(st, dt, onWalkOut?)             // onWalkOut：没人接单走掉的、超时后等不下去走掉的，离场前回调
timeLeft(st) -> number                     // 倒计时用，打烊后恒 0
settleServe(st, customer, verdict)         // 上菜记账，顾客离场
shiftResult(st) -> ShiftResult
```

**上菜那一下由组件把两边接起来**，这是唯一需要跨模块的地方：

```ts
const c = matchCustomer(shift.flow, kitchen.burger)
const r = interact(kitchen, pos, serveStation, { spec: c?.spec })
if (r.kind === 'serve' && c && r.verdict) settleServe(shift, c, r.verdict)
```

⚠ 上错菜**不给第二次机会**（顾客照样走）。能重试的话玩家会拿出餐口当试错工具，
一单一单试到对为止。

星级走 `difficulty.ts` 的 `starsFor(served, day, durationSec)` —— 第三个参数不传
就是标定局长（210s）。**短局必须传**，否则用 210 秒的门槛，玩家永远拿不到星。

---

## `witness.ts`

```ts
type Mishap = 'burnt' | 'stained' | 'crash' | 'vent'
canWitness(st, c) -> boolean                // 还在门口走的看不见厨房
witnessMishap(st, kind) -> Customer | null  // 看得见的每位扣 1/4 当前耐心，返回开口的那位
```

开口的是**扣之前最满意**的那位。不碰 `flow.rng`（理由同 `customer.ts` 那条 ⚠）。
事件源各报各的，惩罚只在这一处：组件发现 `kitchen.burnt / crashed / stainedServed` 涨了就调一次。

---

## `vent.ts`（发泄 × 顾客发火，2026-09-25）

```ts
startRant(st, customerId, stars)   // 不满意的顾客（没人接单 / 等太久 / 上错 / 超时）先去前台发火 RANT_SEC 秒
stepVent(st, dt, onDone?)          // onDone(rant)：发完了，这时才发评价，星数用 rantStars(rant)
vent(st, 'fridge' | 'register')    // 长按 VENT_HOLD_SEC(0.6s)。前台要有人在发火才算，开一场对骂；返回对骂的那位 / true（摔门）/ null
argueTap(st) -> number             // 对骂中点一下，返回第几下（挑台词用）；不在对骂返回 -1。点满 ARGUE_TAPS(6) 结束
endArgue(st)                       // 走开了。停手 ARGUE_IDLE_SEC(1.5s) 由 stepVent 自己结束
ventSpeedFactor(st)                // 发泄后 VENT_BOOST_SEC(4s) 内 ×1.3，乘到 movement.cfg.speed
ranting(st, id) / rantsLeft(st)    // 小人走去发火位 / 打烊要等 rantsLeft === 0
```

对骂（`st.argue`）期间那位的发火倒计时停住；结束时顾客当场走、这时才给加速。那位的评价少 RETORT_PENALTY(1) 颗星（最低 0）。`st.vents` 每涨一次，组件调 `witnessMishap(flow, 'vent')`。

---

## `economy.ts`（2026-09-25）

```ts
earn(ledger, ok, late, stars, delivery, fries?) -> number   // 一单：做对且准时 = PRICE(10) / DELIVERY_PRICE(12) (+ FRIES_PRICE(4)) + tipFor(stars)；错或超时 0
ledgerTotal(ledger)                                   // 当天收入，打烊时 bank() 进存档
createLedger() / resetLedger(l)
```

数值全是 ⏳ 占位。

---

## `progress.ts`

```ts
SAVE_KEY = 'kc.progress'   // 组件用 sys.localStorage 读写（微信下落到 wx storage）
PASS_STARS = 1             // ⏳ 占位
interface Progress { day: number; best: number[]; coins: number; owned: string[] }   // day = 解锁到第几天；存档 v2，v1 读进来 coins = 0；没有 owned 的读成 []
parseProgress(raw) -> Progress       // 空 / 坏 JSON / 旧版本 / 越界一律退回新档或夹回范围
serializeProgress(p) -> string
bank(p, amount)                      // 当天收入存进 coins，没过线也照存
finishDay(p, day, stars) -> boolean  // 记最好成绩；过线返回 true 并解锁 day+1（重打旧的一天不会往回拉）。天数没有上限
dayFlow(day, arrivalSec) -> { flow, orders }   // 难度表的客流间隔按 arrivalSec / 第 1 天间隔 等比放宽
```

一天仍是「接待完 N 位顾客打烊」（09-23 定），不是限时。过了 `LAST_DAY` 照样往下打，客流停在难度表最后一档。

---

## `shop.ts`（2026-09-25）

```ts
SHOP: ShopItem[]                 // fryer ¥150 · fast-grill ¥120 · fast-wash ¥100 · big-tray ¥80（⏳ 占位）
buy(p, id) -> 'ok' | 'owned' | 'poor' | 'unknown'   // 扣 coins、记进 p.owned；组件负责存档
owns(p, id)
FRIES_CHANCE / FAST_GRILL / FAST_WASH / BIG_TRAY    // 升级的效果大小，组件每天开局写进 kitchen.cfg / orders
```

`flowFactor(p)`：到店间隔乘数，按已买升级收紧（`FLOW_UP`），什么都没买 = 1。
炸好的薯条 `FRY_BURN_SEC` 秒不取变 `fryer.stage = 'burnt'`（`kitchen.burntFries++`），空手点 = `'dump-fries'` 倒掉。

**薯条**：`orders.friesChance > 0` 时顾客的 `spec.fries` 才可能为 true —— 为 0 / 不写时**一次都不调 RNG**，出题与标定逐位一致。
`kitchen.cfg.fryerSec` 设了炸锅工位才响应（空手点 = 下锅 / 取出，`carry.kind = 'fries'`），在 `serve` 交出返回 `'serve-fries'`。
`matchFries(flow)` 挑给谁；`settleServe` 汉堡对了但还欠薯条时返回 false、顾客留下（`c.burgerVerdict` 记着判定），
`settleFries(shift, c)` 补齐时按那份判定结算。汉堡上错当场结算。`matchCustomer` 跳过已经拿到汉堡的人。

---

## `tasks.ts`（每日任务，2026-09-25）

```ts
rollTasks(day, customers, fryer) -> Task[]   // 每天 DAILY_TASKS=3 条，只看天数（自带 RNG，不碰出题）；没炸锅不抽薯条任务
collectStats(shiftResult, kitchen, desk, ledger) -> DayStats
taskStatus(task, stats, closed) -> 'open' | 'done' | 'failed'
taskText(task, stats)                       // 「好评 3/6 盘」之类
taskReward(statuses)                        // 每条完成 TASK_REWARD=20，全完成再加 ALL_DONE_BONUS=30；失败不扣
```

「做到 N」类够了当场完成、打烊还不够算失败；「一次都不」类犯一次当场失败、撑到打烊才算完成。
`Ledger.fries` = 收了钱的薯条份数（薯条任务用）。

## `decor.ts`（休息日装修，2026-09-25）

```ts
DECOR_ITEMS / DECOR_SLOTS          // 东西（盆栽 ¥60 · 小盆栽 ¥50 · 书架 ¥100）与固定装饰位（每位允许哪些、场景原样摆什么）
WALL_COLORS / FLOOR_COLORS          // 各 4 色，下标 0 = 材质原色；COLOR_PRICE = 30
place(p, slot, item | null) -> 'ok' | 'same' | 'poor' | 'not-allowed' | 'unknown'   // 没买过的先扣钱买下
paint(p, 'wall' | 'floor', index)   // 每次换色都收钱
newDecor() / parseDecor(raw)        // Progress.decor；缺失或坏值 = 场景原样
```

纯好看，不影响玩法。组件：每天开局 `phase = 'closed'`，在前台选开门 / 休息；`'rest'` 时世界不走、前台打开装修菜单。

## 第 16 轮新增（2026-09-25）

- 起火：`cfg.fireSec`（组件设 `FIRE_SEC`）。糊肉在烤炉上放过 `burntAt + fireSec` → `kitchen.fire = true`、`fires++`；起火时烤炉返回 `'on-fire'`。`'extinguisher'` 工位空手拿 / 拿着挂回；拿着点烤炉 = `'extinguish'`（清空全部烤位）。不设 `fireSec` = 永不起火、灭火器工位不响应
- 双层：`orders.doubleChance`（0/不写 = 不调 RNG）→ `spec.double`；`cfg.doublePatty` 允许第二块肉，`burger.double / cook2`；`judge` 双层单缺第二块记 `missing: ['patty']`，两块火候都要对
- 饮料：`orders.drinkChance` → `spec.drink`；`cfg.drinkSec` 开饮料机（`'drinks'` 工位：`pour` → `take-drink`，满了 `DRINK_SPILL_SEC` 不拿 → `spilled`，`wipe-spill`）；`serve` 交出 = `'serve-drink'`
- 配餐通用：`matchSide(flow, 'fries' | 'drink')`、`settleSide(shift, c, side)`；汉堡对了但还欠任何配餐时 `settleServe` 返回 false；`matchFries` / `settleFries` 保留为薯条的简写
- `earn(..., fries, drink)`；`Ledger.drinks`

## `reviews.ts`

```ts
type ReviewKind = 'witness' | 'praise' | 'complain' | 'walkout'
interface Review { customerId, kind, stars /* 0 = 吐槽不算分 */, t }
createReviewLog(cap = 30) -> ReviewLog
addReview(log, r)                                   // 超出 cap 丢最旧
serveReview(ok, late, ratioLeft) -> { kind, stars } // ratioLeft 在 settleServe 之前读
WALKOUT_STARS = 1
REJECT_STARS = 3                                    // 外卖拒单 / 挂着没理
averageStars(log) -> number                         // 店铺评分，吐槽不算，空表 0
```

台词不在这里：组件按 `customerId % CARD_LINES.length` 取顾客卡（`scripts/cardLines.ts`，
由 `pnpm cards:export` 从手写卡生成）。

---

## `delivery.ts`

```ts
interface DeliveryParams { intervalSec, offerSec, deadlineSec, maxOffers, maxActive }
interface Delivery { status: 'idle' | 'offer' | 'accepted', id, left, max, spec }
createDesk(params, orders, seed) / resetDesk(desk, seed)
stepDesk(desk, dt, { onExpire?, onLate? })   // offer 过期 = 拒单；接了超时 = 骑手走人
acceptDelivery(desk, d) -> boolean           // 已接满返回 false
rejectDelivery(desk, d)
matchDelivery(desk, burger) -> Delivery | null  // 同 matchCustomer：对得上的优先，否则最急的
settleDelivery(desk, d, ok)
deskBusy(desk) -> boolean                    // 还有已接没送完的，打烊结算要等
```

交货走 `kitchen.interact(station=delivery, { spec: d?.spec })`，和出餐口是同一个交接。
`desk.open` 由组件每帧设：最后一位堂食顾客到店后不再来新单。

---

## 测试夹具

`tests/fixtures/customers.json` —— **21 张手写顾客卡**，覆盖 8 种 mood、3 档 doneness，
含一条 3 章的长线 arc（`lao_zhang`）。M1–M4 直接用，不必等内容管线。

守门测试在 `tests/fixtures.test.ts` 与 `tests/schema.test.ts`：
机制层可解 · 字数在限内 · arc 章节递增 · 与 `pipeline/customer.schema.json` 双向一致。

---

## 开工 / 收工

```bash
git pull
pnpm test          # 逻辑层没坏，才值得开编辑器（30 秒换掉半小时）
# → 然后再启动 Cocos Creator

pnpm check         # 铁律① + 类型 + 全部测试，提交前跑
```
