# 首次制作引导与 UI 交接

本分支提供首次制作引导、控制按钮、库存面板与订单卡模块。基线为主对话归档的 `be80cc6e1a5ffc4afa8bcbd7b803c9c9c5884efc`，分支 `codex/first-order-ui`，工作树 `C:/Users/12255/.codex/worktrees/first-order-ui/kitchen-chaos`。主对话负责正式场景接线；本分支没有修改 `StationView.ts`、`main.scene`、`progress.ts`、输入路由或游戏规则。

## 现状梳理与设计

| 原来的信息 | 问题 | 本次表达 |
| --- | --- | --- |
| 动作键只有“取料、取肉、上菜” | 不知道针对哪个对象，也不知道点按还是按住 | 对象、动作、手势分三层；无可用目标时提示走近 |
| “按住刷、长按怼”混在动作名中 | 主动作与手势混杂 | 手势独立显示；支持主对话提供明确的操作上下文 |
| 两个空圆圈及手持气泡 | 空手与携带物含义不清，图标重复 | 圆圈标注空手；拾取后显示对应物品；丢弃键显示手中对象 |
| 库存只有 `4/4` 和图标 | 缺少食材名、余量和缺货含义 | 食材名、图标、剩余数量分层；缺货用文字及红色提示 |
| 订单规格挤在一个 Label 中 | 配方、熟度、忌口权重接近 | 独立配方、熟度、忌口、配餐与耐心条 |
| 失败提示短暂飘走 | 看漏后没有持续的下一步 | 引导卡持续显示当前目标与操作方式，并标记目标工位 |

移动用“拖动左侧移动”；取放、接单、下锅与交付用“点按”；刷盘用“按住”；丢弃使用独立按钮，显示“丢弃／按住／手中对象”。不增加手势，不改变按住阈值。按钮皮肤沿用原节点大小和 Widget 位置。

新 UI 使用深青底、白色主文字、浅绿动作提示、浅红错误及暖黄提醒；字号、颜色和间距集中在 `UiTheme.ts`。这些是本次自主设计值，没有声称来自 Figma。库存面板移至画面下部，保留烤炉视野；模态面板打开时隐藏引导，继续沿用原有冻结移动、世界继续运行的规则。

## 引导如何推进

`FirstOrderGuide.observe(frame)` 只读取实际状态，按当前可执行操作生成提示：

1. 走进前台真实交互范围。
2. 开门，并等到实际顾客 `active && ordered`。
3. 按该单的真实规格取料，优先取肉饼。
4. 检查真实手持与炉位，根据项目 `cookLevelAt` 和当前烹调窗口等待或取肉。
5. 放熟肉、补配料，并端起实际完成的汉堡。
6. 向出餐口交付；需要配餐时继续引导送齐配餐。

只有已跟踪订单的成功交付事件才能完成引导，不能用顾客消失、时间经过或得分增加代替。丢弃后会退回实际需要的步骤。缺货、无盘、错误熟度、烧焦、重复配料、多余肉饼、烤位已满、手被占用及顾客离开都有恢复提示。正确但迟到的完整交付也能结束操作引导，原来的迟到评分照常执行。

独立存储键为 `kitchen-chaos.first-order-guide.v1`，只保存 `active / skipped / done`。跳过与完成跨刷新保留；“操作指南”可以重新开启。中途进度不跨营业局继承。`run` 必须由主对话在重开或进入下一局时递增，用来拒绝旧局的交付事件。存储损坏、拒绝访问或写满均不影响游戏。

## 公共文件的最小接线清单

只需主对话修改 `StationView.ts`。本次无需编辑场景 JSON、`progress.ts` 或输入路由源码。`tools/first-order-ui-preview-adapter.ts` 是可运行的验证参考，使用运行时包装来避免改动公共文件；正式实现应直接调用接口，不复制这种包装方式。

### 1 初始化和销毁

在厨房、顾客流、输入路由及原有面板节点初始化完毕后创建：

```ts
import { FirstOrderUi } from './ui/FirstOrderUi'
import { InventorySkin, OrderCardView } from './ui/KitchenPanels'
import { actionPresentation } from './ui/UiModel'

this.firstOrderUi = new FirstOrderUi(this.node, sys.localStorage)
this.inventorySkin = new InventorySkin(this.panelNode, this.slotNodes, this.panelTitle)
```

现有 `new Controls(...)` 自动使用本分支皮肤，保留 `syncStick / setAction / setHands / setPressed`。销毁时调用 `firstOrderUi.destroy()` 和新增订单卡的 `destroy()`；库存皮肤随原有面板节点销毁。

### 2 提供真实状态

在操作完成、模式切换、尺寸变化时立即刷新，烹调期间可按约 0.15 秒刷新；不要每帧重新创建全部 UI。

```ts
this.firstOrderUi.sync({
  kitchen: this.kitchen,
  customers: this.shift.flow.customers,
  near: stationInReach(this.kitchen, this.movement.pos)?.kind ?? null,
  phase: this.phase,
  run: this.uiRun,
})
this.firstOrderUi.layout(visibleWidth, visibleHeight, modalOpen, this.inset, stationRects)
```

`phase` 是现有的 `closed / open / rest`。`modalOpen` 包含库存、菜单、电脑、装修和结算等所有模态界面。装修窗口接线时也应隐藏引导。工位位置读取当局 `kitchen.cfg.stations`，支持后续自定义布局，不引用默认坐标。

`stationRects` 为 Canvas 中心坐标、左下原点矩形 `{x,y,w,h}`，应包括关键工位的屏幕占位；由现有 Camera 的 `convertToUINode(world, canvas, out)` 得到，**不要混用 Camera 组件与渲染 Camera 不同的 `worldToScreen` 参数顺序**。引导避开下方左右操作区，并在与工位区域冲突时缩成可跳过的提示块；无空位时隐藏。`currentHint.target` 是当前工位，可用同一投影结果调用 `pointAt(x, y, visibleWidth, visibleHeight)` 显示标记。丢弃步骤不显示工位标记，避免误导玩家去按住工位动作键。

### 3 接入捕获区和点击

把 `firstOrderUi.zoneRevision` 加入原有 `zonesKey`，仅当区域真的变化时重建捕获区。将 `firstOrderUi.captureZones(screenW, screenH, designH)` 放在普通左右分路、面板外部兜底区域之前。模态界面中该方法返回空数组。

在唯一的 `router.tick(dt)` 之前读取 `guide-skip / guide-help / guide-body` 的 `tapped`，调用 `firstOrderUi.tapped(id)` 后消费该次 UI 输入，不继续执行本次普通操作。`guide-body` 只吞掉点击，不能触发移动或动作。

**不能每帧调用 `router.setCaptureZones`**：现有接口会清除按住状态，导致丢弃和刷盘中断。`zoneRevision` 只因区域位置、尺寸或显隐改变，不因引导文案改变。

### 4 确认交付和重开

在 `finishOrder` 中先保存实际 `c.id`，执行原结算后调用：

```ts
this.firstOrderUi.guide.delivered({
  run: this.uiRun, orderId, ok, complete: true,
})
```

只交汉堡但仍缺薯条或饮料时不传 `complete: true`。失败交付不能完成引导。每次 `restart` 开头将 `uiRun` 加一，并立即刷新引导；完成/跳过状态保留，中途步骤按新厨房复位。现有外卖规则和顾客匹配保持原样，此引导以堂食单为首次目标。

### 5 完善动作键上下文

将原有 `setAction(this.actionVerb())` 换成一次 `setContext(...)`：

```ts
this.controls.setContext(actionPresentation(this.actionVerb(), station?.kind))
```

`ActionPresentation` 是 `{target, verb, gesture, enabled}`，`gesture` 为 `tap / hold / wait / move`。主对话可以直接提供明确对象以覆盖兼容文案。`enabled` 只控制视觉，不修改玩法分派。前台点按接单与按住回怼的优先级仍由主对话负责，不应仅用旧的“长按怼”文案推断主动作。

按手持状态调用 `setDiscardTarget(物品名)`；按真实丢弃区的 `heldSeconds / DEFAULT_ACTION.holdSeconds` 调用 `setDiscardProgress`，不要另写时间阈值。

### 6 接入库存和订单

库存打开及窗口尺寸变化时，调用 `inventorySkin.layout(visibleHeight, bottomInset)`；原来 `openPanel` 写完数量后，调用 `inventorySkin.sync(kitchen, panelStation.kind === 'storeroom')`。捕获区仍取实际移动后的面板和格子位置，沿用原有格子尺寸。

每个新订单卡 `new OrderCardView(parent, width)`，建议宽 280、高 160。`sync(customer, displayName?)` 使用现有顾客槽位与原姓名，不改变排序、匹配或耐心计时。不要同时显示旧规格 Label 和新卡片。主对话需根据可用顶栏宽度排列当前活跃订单，避开任务卡、微信胶囊、台词提示和关键工位；预览桥展示三列以内的排列，正式多单排布仍需接线后的密集订单验收。

## 验证与复跑

新测试覆盖真实厨房的取料、下锅、取肉、组装与交付，以及拒绝操作、糊肉、缺货、盘子恢复、重复食材、多余肉饼、满炉位、双层与配餐、存储异常、跳过重看、旧局事件和横屏安全区域。完整 `pnpm check` 的最终数量及浏览器记录见同名 `check.json`。

运行时实景测试以真实鼠标拖动摇杆、点击与长按完成一单正确汉堡，再验证丢弃及刷盘按住不被捕获区刷新打断。没有直接写角色坐标、改游戏时钟或生成假订单。确认基线的冰箱、制作台、出餐口锚点存在且与 Web 构建相符；报告同时记录 Web 入口和 UI 包 SHA256。

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm scene
pnpm layout
pnpm cam
node tools/build-first-order-ui-preview.mjs
$env:PLAYWRIGHT_MODULE='C:/Users/12255/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/verify-first-order-ui.cjs 'D:/Codex/vultr-projects/server-home-20260930/project/kitchen-chaos/game/build/open-centre-web' game/temp/ui-verification
```

最后一条需要保留的 `be80cc6` Web 构建和 Edge；路径可换成另一份同基线的构建目录。验证脚本启动并关闭独立本地 HTTP 服务，不占用其他窗口的预览端口。它在已有 Cocos 场景里注入本次准确的 UI 源码；**不代表正式 Cocos/微信构建已接线**。

实景：

- [首次进入](first-order-ui-2026-10-15-entry.png)
- [库存面板](first-order-ui-2026-10-15-inventory.png)
- [烹调提示](first-order-ui-2026-10-15-cooking.png)
- [4比3 横屏](first-order-ui-2026-10-15-4by3.png)
- [844乘390 横屏](first-order-ui-2026-10-15-phone.png)

## 文件清单

- 修改 `game/assets/scripts/Controls.ts`，保留原 `.meta`。
- 新增 `game/assets/scripts/ui/{FirstOrderGuide,FirstOrderUi,KitchenPanels,UiModel,UiTheme}.ts`，目录和各脚本均附独立 `.meta`。
- 新增 `tests/first-order-guide.test.ts`。
- 新增 `tools/{build-first-order-ui-preview.mjs,first-order-ui-preview-adapter.ts,verify-first-order-ui.cjs}`。
- 新增本交接文档、`docs/first-order-ui-2026-10-15-check.json` 及上述五张截图。

## 遗留与不要报成 bug 的清单

- 模块与运行时验证完成，正式场景接线由主对话完成；本分支不编辑公共文件。合入后需再做 Cocos Web/微信构建、密集订单及最新自定义布局回归。
- 浏览器自动化证明操作闭环与触控区隔离，不能替代首次试玩者“仅凭提示完成第一单”的观察实验，也不代表真人手机多指、刘海、性能验收完成。
- 引导不暂停世界，不延长耐心，不放慢烹调，不重写评分；恢复时建议丢弃会消耗原有库存，这是既有规则。
- 跳过后显示“操作指南”，不是再次自动弹出；重新查看会从当前真实状态继续，不回放固定时间线。
- 原任务卡、顾客台词、经营菜单及结算页未换皮；这轮统一的是控制按钮、引导、库存和订单模块。
- 无空盘且全部损坏时提示重开，不生成额外盘子；没有引入救济或破产规则。
- 未推送、部署、同步或修改其他窗口工作树。
