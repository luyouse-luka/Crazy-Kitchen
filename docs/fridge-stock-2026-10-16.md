# 冰箱内部库存陈列（2026-10-16）

用户补充：冰箱打开后不能是空的，需要摆放物品；完成后记录总结，准备在新窗口继续。

## 本轮完成

- 新增四层托盘，陈列肉饼、培根、洋葱、酸黄瓜、生菜、番茄、面包和芝士。复用已有 3D 食材模型，保留当前低多边形风格；没有全量重制原模型材质。
- 陈列读取实际 `KitchenState.stock`：每类最多展示 4 份；取料减少、缺货消失、补货恢复。升级后超过 4 的真实数量由选料卡显示，展示层不会修改库存。
- 陈列放在原冰箱模型内部，随冰箱布局变换移动；门开始打开后显示，关门隐藏，重开和结算沿用门的复位。新增几何不改变工位交互、碰撞或单件携带规则。
- 本地新构建：`game/build/fridge-stock-web`，预览 [4197](http://127.0.0.1:4197/?ui=fridge-stock-20261016)。构建与预览均为本地，没有推送、部署或上传，微信包未更新。

## 验证与证据

`pnpm check` 通过：零引擎依赖检查、TypeScript、654 项测试／51 个文件。Cocos Creator 3.8.8 Web 构建成功。

- 新增 4 组陈列检查：默认八类食材及有效网格；真实取料后库存与模型同步减少、关闭及再次打开；清空库存与真实补货；展示上限不改库存及重开复位。
- 原 8 项冰箱／对骂检查在新构建通过，包括真实选料、取消、12 次打断动画、补货、长按摔门、重开、连续回嘴及结算关闭。
- 实际操作回归通过：移动转向、单件携带、取放投拾、正确交餐 1 单／错误 0 单、洗盘；额外持物网格诊断及 4 种窗口检查通过。原始预览在 587×652、1280×720、780×360 均无页面滚动或调试浮层。
- 已查看默认视角的开门和关门截图，确认食材可见，关门未外露。截图：[开门](fridge-stock/fridge-open.png)、[关门](fridge-stock/fridge-closed.png)、[库存耗尽诊断](fridge-stock/fridge-empty-stock.png)。

全部结果与本轮源文件、构建 SHA-256 见 [自动验证证据](fridge-stock-check.json)。库存耗尽、补货和指定任务使用诊断状态；实际取料、取消、对骂和做餐采用浏览器真实输入。这些检查不能替代真人整日通关或手机性能验收。

## 复跑

已生成的构建配置为 `game/temp/fridge-stock-web.json`，从上一轮配置只更改输出目录。重建需使用本机 Cocos Creator 3.8.8，后台启动参数为 `--project <game绝对路径> --build "configPath=<配置绝对路径>"`，并检查构建日志中的 `Finished` 成功标记。重建后再执行：

```powershell
pnpm check
node tools/prepare-web-preview.mjs game/build/fridge-stock-web
python tools/serve-web-preview.py game/build/fridge-stock-web --port 4197
# Start the server in a separate terminal; reuse it if already running.
$env:PLAYWRIGHT_MODULE = 'C:/Users/dell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/verify-fridge-stock.cjs http://127.0.0.1:4197 game/temp/fridge-stock-check
node tools/verify-fridge-banter.cjs http://127.0.0.1:4197 game/temp/fridge-stock-banter-check
node tools/verify-player-preview.cjs http://127.0.0.1:4197 game/temp/fridge-stock-viewports.json
node tools/verify-player-feedback.cjs http://127.0.0.1:4197 game/temp/fridge-stock-gameplay
```

## 仍需你试玩

- 默认视角里食材是否足够显眼，门、人物和选料面板是否影响观察；原 3D 食材的质感是否还需要进一步重做。
- 开关速度、摔门反馈、台词火力和重复频率，以及顾客故事、商店与其他弹窗的整体观感。
- 手机触屏、多指取消、声音与帧率；单件模式整日节奏，尤其第 5→6 天及后期压力。

## 文件清单

新增 `game/assets/scripts/FridgeContents.ts` 及 `.meta`、`tools/verify-fridge-stock.cjs`；修改 `game/assets/scripts/FridgeDoor.ts`、`game/assets/scripts/StationView.ts`。文档为本记录、`docs/fridge-stock-check.json`、`docs/fridge-stock/` 截图、`docs/HANDOFF-2026-10-16.md` 和 `ROADMAP.md` 当前断点。之前各轮改动全部保留；新窗口见 [交接记录](HANDOFF-2026-10-16.md)。
