# P1 顾客与打烊复盘 · 2026-10-16

承接 [进度与玩法规划](../reports/疯狂后厨%20进度与玩法规划.md) 中 P1 的剩余项。保留单件模式、既有 UI、随机对骂和冰箱库存陈列的全部工作区改动。本轮仅更新本地源码及 Web 预览，没有推送、部署、同步或微信上传。

## 本轮结果

- 熟客“阿星·练习生”复用现有练习生身份，连续三个不同营业日讲述“第一次试镜 → 候补也要练 → 三分钟的舞台”。开门菜单预告当日章节，进店、点卡、催餐、离店评价和打烊手记使用相同章节；下次进店会记得上次吃得好不好。
- 章节只在实际接待产生最终评价并打烊后记录。重玩已记录的同一天、休息、未完成营业及重复结算不会跳章；三章后结束。老存档在下个符合条件的营业日从第一章开始，保留金币、购买、装饰与布局。v1/v2/v3 存档仍可读取，v3 增加可选的 `regular` 字段，损坏的章节单独回退。
- 前五种身份（练习生、相声演员、捧哏、班主任、小学生）各有四类事故回应：肉饼烤糊、脏盘、摔盘和厨师发泄；其他身份使用事实明确的通用回应。调用真实目击与耐心扣减，零星吐槽不额外算一份评分，名场面引用同一次实际台词。
- 最终评价附本单实际原因：缺哪些配料、放了哪些忌口、熟度不符、等候造成的基础星级、超时免单或离店原因。区分未接单离店、接单后等餐太久和被厨师怼走；后者增加专用对骂原因池，避免误说“没人接单”。既有随机台词库由 470 条增至 474 条。
- 结算显示餐费、小费、任务奖励和存款的关系，说明错单/超时不收款。保留“今日名场面”，增加“明天试一件事”和“熟客手记”：按本局发生最多的问题给出真实次数与一个具体改法，错单可追溯最近一次判单详情。没有事件时显示实际接待统计。
- 顾客卡为故事预留两行并在换日时刷新；顾客回应按最多 13 字换行，并预留弹出和上浮空间，避免屏幕边缘截断。结算主面板和三张侧卡沿用现有自适应缩放。

## 验证与证据

`pnpm check` 的零引擎依赖、类型和 **679 项测试 / 52 文件**通过，其中新增 `tests/p1.test.ts` 的 25 项覆盖旧档、三次推进、坏字段隔离、重玩/未完成不跳章、故事不改变订单与到达时刻、实际判单原因、复盘分类和五种事故声音。现有存档测试补齐新增字段；对骂测试覆盖被怼走原因与长句换行。

Cocos Creator 3.8.8 的 Web Desktop 构建目录为 `game/build/p1-customers-web`，本地预览为 [4198](http://127.0.0.1:4198/?ui=p1-customers-20261016)。构建仍有既有压缩参数默认回退提示，以构建日志 `Finished` 及实际运行共同判断成功。

自动操作及源码/构建 SHA-256 见 [证据 JSON](p1-customers-recap-check.json)。该证据包含三次接待的真实规格、故事、气泡边界、评价、收入、章节存档、五种结算画幅及以下回归：

- `verify-p1.cjs`：三章接单/点卡/交餐/打烊；前两次正确餐点、第三次缺芝士，判单、最终评价与复盘一致；重复结算不重复入账；重玩、休息、刷新保持记忆；坏接待回访；脏盘目击的真实扣耐心；长按怼客使用正确原因池。
- 1280×720、1024×768、1560×720、780×360、587×652：结算主面板和三张侧卡均在视区内，含结算打开时缩放。人工查看关键截图，无文字重叠；小窗口/手机实际阅读舒适度仍待试玩。
- `verify-player-feedback.cjs`：真实移动、手脚动画、单件携带、上下文图标、放下/拾取/投掷、正确制作交餐和洗盘回归。
- `verify-fridge-stock.cjs` 四组库存陈列检查，以及 `verify-fridge-banter.cjs` 八项门与对骂检查。
- `verify-story-ui.cjs`：五种画幅的购买、重复购买拦截、翻页、装修、八类食材插画、顾客卡、三类洗盘图标和弹窗边界回归。通用卡片夹具显式关闭熟客覆盖，三章熟客另由 P1 脚本验证。

P1 脚本用单顾客短班、提供餐点及事故诊断夹具；菜单、接单、点卡、交餐、结算按钮和长按怼客走真实鼠标事件。它证明链路接通，不代表玩家自然玩完三天，也不代表微信设备或主观乐趣验收。

截图：[第二次来店](p1-customers-recap/chapter-2-order.png)、[第一章结算](p1-customers-recap/chapter-1-result.png)、[缺芝士后的复盘](p1-customers-recap/chapter-3-result.png)、[窄窗口结算](p1-customers-recap/result-587x652.png)。

### 复跑

```powershell
pnpm check
pnpm validate pipeline/handwritten/cards.json
pnpm cards:export
$projectPath = (Resolve-Path game).Path
$configPath = (Resolve-Path game/temp/p1-customers-web.json).Path
$buildProcess = Start-Process 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -WindowStyle Hidden -ArgumentList @('--project', "`"$projectPath`"", '--build', "`"configPath=$configPath`"") -PassThru
$buildProcess.WaitForExit()
node tools/prepare-web-preview.mjs game/build/p1-customers-web
python tools/serve-web-preview.py game/build/p1-customers-web --port 4198
```

构建配置若不存在，以已有 `game/temp/fridge-stock-web.json` 为同场景 Web Desktop 模板，将 `outputName` 设为 `p1-customers-web`。构建完成后再启动/访问预览；服务命令保持运行，在另一个 PowerShell 执行：

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/Users/dell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/verify-p1.cjs http://127.0.0.1:4198 game/temp/p1-browser
node tools/verify-player-feedback.cjs http://127.0.0.1:4198 game/temp/p1-gameplay
node tools/verify-fridge-stock.cjs http://127.0.0.1:4198 game/temp/p1-fridge
node tools/verify-fridge-banter.cjs http://127.0.0.1:4198 game/temp/p1-banter
node tools/verify-story-ui.cjs http://127.0.0.1:4198 game/temp/p1-story-ui
```

## 文件清单

新增：`game/assets/logic/{regular,recap}.ts` 与对应 `.meta`、`tests/p1.test.ts`、`tools/verify-p1.cjs`、本记录、`docs/p1-customers-recap-check.json` 和 `docs/p1-customers-recap/` 证据截图。

在已有文件上追加：`game/assets/logic/progress.ts`、`game/assets/logic/banter.ts`、生成的 `game/assets/logic/banterLines.ts`、`pipeline/handwritten/banter.json`、`game/assets/scripts/{StationView,TaskUi,Feel}.ts`、`game/assets/scripts/ui/KitchenPanels.ts`、`tests/{progress,banter}.test.ts`、`tools/verify-story-ui.cjs`、`ROADMAP.md`、`reports/疯狂后厨 进度与玩法规划.md`、`docs/HANDOFF-2026-10-16.md`。工作区其他已有改动继续保留，不包含本轮全量重做。

## 不要报成 bug 的清单

- 熟客覆盖当日第一位堂食顾客的表演身份，沿用实际随机订单，不固定剧情配方，也不增加客数；订单、到达时刻、客流与难度未改。
- 这是一条三章手写小故事，职业进展是既定情节；操作改变本次接待、评价、收入与下次回忆，不模拟任意人生分支或实时 AI。差评后也会记录该次来店，失败营业日不能反复刷章。
- 同一营业日的故事最多记录一次。休息不会推进故事；三章结束后第一位顾客恢复原有身份轮换。
- 零星目击吐槽不计入平均评分。更高优先级的火灾/对骂等事件可以替换当日名场面，复盘仍按实际次数选最常见问题；并非每个事故都单列一张卡。
- 评价中的“基础 3/4 星”描述等待档位，既有赠品加星与回嘴扣星规则继续生效。
- 旧的 4195/4196/4197 预览及微信 P0 包不含本轮 P1 内容。浏览器自动验证不能当作真人通关、手机可读性或性能验收。

## 遗留与下一阶段

P1 实现和自动验证完成；真人通过条件尚未验证：玩家能否在做餐时记住阿星的来意，复述自己的操作如何影响接待，读完复盘后指出下一天要改的一件事，以及是否愿意再开一天。用现有试玩记录字段补设备、经验、天数、误判/误触和实际叙述，不把自动截图当人类反馈。

P0 的首单、持续单件往返、熟度识别、第 5→6 天及后期压力仍待真人；微信多指、安全区、声音和持续帧率仍待当前构建真机验证。下一批 P2 验证现有升级、布局、任务收益；P3 再标定月度经营与扩展，均未执行。本轮未改金币费率、升级、客流或增加经营功能。
