# `logic/` 公开接口清单 · v0.2（2026-08-07）

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

**尚未建**（按里程碑排）：`customer.ts`（M2 顾客状态机）·
`chaos.ts`（M4 混乱事件调度）· `economy.ts`（M4 金币/升级/解锁）。

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
```

> 烤炉计时**只存一个开始时刻**，每帧用 `cookLevelAt` 现算即可 —— 不要在组件里另存一份火候状态，
> 那会和逻辑层不同步。`CookWindows` 的数值来自 M1 的难度曲线表，别在组件里写死。

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

## 测试夹具

`__tests__/fixtures/customers.json` —— **21 张手写顾客卡**，覆盖 8 种 mood、3 档 doneness，
含一条 3 章的长线 arc（`lao_zhang`）。M1–M4 直接用，不必等内容管线。

守门测试在 `__tests__/fixtures.test.ts` 与 `__tests__/schema.test.ts`：
机制层可解 · 字数在限内 · arc 章节递增 · 与 `pipeline/customer.schema.json` 双向一致。

---

## 开工 / 收工

```bash
git pull
pnpm test          # 逻辑层没坏，才值得开编辑器（30 秒换掉半小时）
# → 然后再启动 Cocos Creator

pnpm check         # 铁律① + 类型 + 全部测试，提交前跑
```
