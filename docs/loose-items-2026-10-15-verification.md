# 自由物品阶段：实施与验收

后续用户试玩要求每次只拿一件，并修复实际行走骨骼和图标按钮；当前默认行为以 [试玩修复验收](player-feedback-2026-10-15-verification.md) 为准。本页保留上批双手模式的真实历史验收。

2026-10-15，本地分支 `codex/integrated-kitchen-experience`。接续上轮整合，保留原有未提交工作；没有推送、部署或发布。

## 本阶段完成

食材（包括双手一组）、生/熟肉饼、带盘肉饼和成品汉堡支持地面放下、拾取与朝向投掷。辅助键点按放下、长按投掷；空手走近地面物品，动作键点按拾取、长按清理。按钮显示目标和手势，地面有识别圈，飞行有高度变化和碰撞落地反馈。旧前台定向砸顾客、赠品和对骂保持各自输入优先级，新辅助投掷不会叠加执行它们。

放下使用所有权转移，不调用丢弃再重建。双手食材、所有配料、两块肉各自熟度、带盘/污渍标记完整保存。拾取不写库存、不新取盘；清理带盘食物只将它原有的盘子转为脏盘。地面食物不会堵住玩家。

投掷与当前布局共用碰撞盒，采用短步进，阻挡墙、柜、边界及仓库门保护区；大帧间隔夹到 0.1 秒。营业前与休息日可从冰箱取料、在制作台整理和操作地面物品，厨房和顾客计时仍冻结。布局编辑前要求收起或清理地面物品，防止工位移动后吞入食物。

## 已执行验证

- `pnpm check`：**48 文件 / 621 项通过**，含新增 19 项自由物品测试、26 项更新后的引导测试；零引擎依赖检查与类型检查通过。
- `pnpm scene`、`pnpm layout`、`pnpm cam` 通过。默认 20 天模拟仍为总体 92.2%、后期 84.9%，保留原布局闸门。
- Cocos Creator 3.8.8 Web 构建成功；`tools/verify-loose-items.cjs` 在 Edge 用真实摇杆与按钮完成：双手食材放下/拾回、向柜台投掷受阻、再次拾回、休息日取料整理、编辑入口保护、带盘肉饼转移、汉堡投掷/拾回并交付。**正确交餐 1，错误 0，首次引导实际完成**。
- 清理真实烤制的带盘肉饼仅增加 1 个脏盘；持续按住清理没有穿透到洗碗池泡碗或刷洗。触摸取消与后台取消事件保留手持物，未误投掷。每日重置通过独立诊断调用确认地面及视图清空。没有用修改 carry 或 teleport 代替上述制作、投掷和交餐操作。
- 12 轮实际放下/拾回后对象池保持 1 组、36 个 MeshRenderer（包括未激活备用层），无增长；最多 16 组，清除后复用，销毁释放自有节点、网格和材质。
- 1024×768、1280×720、1560×720、780×360 四种画幅验证；操作按钮最小点击区分别为 96/120/120/60 CSS 像素。浏览器无警告、错误或资源请求失败。
- 一次新鲜只读代码审查完成，未发现需要修复的高置信问题。真实设备性能不包含在审查结论中。
- 追加复跑上一批整合的真实输入回归：布局拖动/撤销/取消、非法保存、存储失败与保存重载、正确交餐和引导完成、洗盘/晾盘/还盘、冷库补货、多指取消与四画幅编辑全部通过；无警告、错误或资源请求失败。数据见 [上批功能回归](loose-items-2026-10-15-regression.json)。

证据：[完整实测数据](loose-items-2026-10-15-check.json)、[双手食材落地](loose-items-2026-10-15-paired-floor.png)、[投掷](loose-items-2026-10-15-throw.png)、[成品落地](loose-items-2026-10-15-burger-floor.png)、[交餐](loose-items-2026-10-15-served.png)、[780×360](loose-items-2026-10-15-view-780x360.png)。

## 本地体验包

微信目录：`game/build/kitchen-chaos-loose-items-wechat-20261015`。

ZIP：`game/build/packages/kitchen-chaos-loose-items-wechat-20261015.zip`，2,545,421 字节；170 个文件逐个 SHA-256 对比构建目录全部一致。主包 2,253,532 字节，internal 分包 405,194 字节，main 分包 6,069,927 字节，总量 8,728,653 字节；预算和主包安全余量通过，没有远端 bundle。记录见 [包体与校验](loose-items-2026-10-15-package.json)。构建成功不代表微信真机性能通过。

Web 目录：`game/build/loose-items-web`。桌面保留项目原模板；自动验证仅将 GameDiv 设为全窗口以测游戏区域，没有修改微信模板。

## 可复跑

```powershell
pnpm check
pnpm scene
pnpm layout
pnpm cam
node tools/verify-loose-items.cjs http://127.0.0.1:4192 game/temp/loose-items-verification
node tools/verify-integrated-kitchen.cjs http://127.0.0.1:4192 game/temp/loose-items-regression
node tools/check-wechat-package.mjs game/build/kitchen-chaos-loose-items-wechat-20261015
```

浏览器工具需 Playwright 与 Edge，可用 `PLAYWRIGHT_MODULE` 指定模块。构建配置为 `game/temp/build-loose-web.json`、`game/temp/build-loose-wechat.json`；先启动本地静态服务。每日重置、生命周期和后台事件是单独标明的诊断，不能代称真人打完整日或实际切后台。

## 不要报成 bug / 有意限制

- 第一版覆盖食材、肉饼、汉堡。货箱、叠盘、薯条、饮料、灭火器保留原工位交互和丢弃方式，尚未开放地面转移。
- 最多 16 组，不自动删除旧物；满额时保留手持物并提示先拾取或清理。双手食材整体放下和拾回。
- 当前只有一个制作台/手持汉堡槽。台上有另一份汉堡时，提示先腾空台面，不能拾取地面汉堡；仍可长按清理，台面内容不会被覆盖。
- 地面物品不跨日存档；结算冻结，重开按原规则重置库存与盘子并清空地面。不偷偷清理、扣费。
- 不做柜面堆叠、污染、摔盘费用或自由投掷击中顾客的新惩罚；这些规则还未确定。
- 自定首版手感：投掷水平 5.5m/s、起始高度 .85m、竖直 2.4m/s、重力 9m/s²、物品组安全半径 .33m、拾取 .9m。不是外部设计稿数值，需真机调校；成对食物宽度已计入碰撞余量。
- 人物或柜体可能短暂遮挡食物。实际地板顶 Y=0，物品底 .025m、落点圈 .018m，不因单张截图遮挡抬高物品。专用投掷蓄力动画、模型质感与全界面美术统一仍待后续。
- 微信设备声音、多指连续操作、安全区、帧率、16 组满场和新玩家完整日试玩未验收。

## 本阶段文件清单

新增：`game/assets/logic/loose-items.ts` 与 `.meta`、`game/assets/scripts/LooseItemsView.ts` 与 `.meta`、`tests/loose-items.test.ts`、`tools/verify-loose-items.cjs`、`docs/superpowers/plans/2026-10-15-loose-items.md`、本页及 `docs/loose-items-2026-10-15-{check.json,regression.json,package.json,paired-floor.png,throw.png,burger-floor.png,served.png,view-1024x768.png,view-1280x720.png,view-1560x720.png,view-780x360.png}`。

更新：`game/assets/logic/layout.ts`（共用仓库门保护区）、`game/assets/scripts/{StationView,Controls}.ts`、`game/assets/scripts/ui/{FirstOrderGuide,FirstOrderUi}.ts`、`tests/first-order-guide.test.ts`、`ROADMAP.md`、`docs/feedback-phases-2026-10-15.md`、`docs/loose-items-design-2026-10-15.md`、上阶段验收页的后续状态说明。构建与 ZIP 留在忽略目录，上阶段其他修改保持原样。
