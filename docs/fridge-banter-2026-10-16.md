# 冰箱开关门与随机对骂（2026-10-16）

## 改动

- 冰箱原 GLB 有上下门及右侧铰链节点，没有动画。新增 `FridgeDoor` 驱动原门节点，不改交互碰撞体。选料开门，取料、取消或切换冷库关门；补货短暂开关；长按泄愤真实摔门。开门 0.28 秒、关门 0.24 秒、打开 100°，均为本轮手感参数，待真人微调。
- 中途反向操作从当前角度继续；重开、结算及布局调整处理关闭／复位，销毁时停止动画。
- 手写随机库 470 条：50 位顾客各 4 条回嘴、2 条投诉、2 条离场，厨师 30 条，投诉原因 12 条，任务状态 28 条。包括更冲的脏话、职业梗及网络梗，不调用在线生成服务。
- 顾客身份跟随实际当天卡片；投诉分上错、超时、没人接单。对骂开始时读取当日任务实际状态，优先引用失败任务，其次未完成任务；不会拿已完成状态冒充失败。
- 独立随机数与洗牌袋，避免一轮内重复及同一身份连续重复投诉／离场句；重开不重置台词抽取袋，订单随机数不受影响。回嘴、离场句及结算引用使用同一场保存的台词。
- 长句分两行，同一说话人连点时替换旧气泡，避免多句长文叠在一起。

原卡片 `argue` 四句继续保留，以兼容原卡片 schema 和内容管线；当前游戏对骂读取新随机库。修改新台词后运行 `pnpm cards:export`，生成文件不可手改。

## 验证

`pnpm check` 的类型、零引擎依赖检查及 654 项测试／51 个文件通过，50 张卡内容校验通过，Cocos 3.8.8 Web 构建完成。8 项冰箱与对骂浏览器检查通过：真实点击选料和取消、12 次中断开关、补货、长按摔门、重开复位、六次真实对骂输入及结算关门；检查动画中间帧、说话人气泡替换、任务状态变化及 2 星被怼后降至 1 星的真实评价结果。

3 种窗口（587×652、1280×720、780×360）原始预览布局通过。完整做餐／洗盘回归证据与本轮最终来源哈希保存在 [自动验证记录](fridge-banter-check.json)。截图见 [开门](fridge-banter/fridge-open.png)、[当前对骂气泡](fridge-banter/banter.png)。

诊断脚本把角色与任务设置到特定状态，操作、取料、长按、六次回嘴采用真实鼠标事件；这些诊断数据不计作真人通关。动画检查记录每帧姿态，避免把截图的调度延迟误判为没有动画；曾发现的连点多句叠字已修复并加入实际运行断言。

```powershell
pnpm cards:export
pnpm check
pnpm validate pipeline/handwritten/cards.json
node tools/prepare-web-preview.mjs game/build/fridge-banter-web
python tools/serve-web-preview.py game/build/fridge-banter-web --port 4196
$env:PLAYWRIGHT_MODULE = 'C:/Users/dell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/verify-fridge-banter.cjs http://127.0.0.1:4196 game/temp/fridge-banter-check
node tools/verify-player-preview.cjs http://127.0.0.1:4196 game/temp/fridge-banter-viewports.json
node tools/verify-player-feedback.cjs http://127.0.0.1:4196 game/temp/fridge-banter-gameplay
```

## 仍需真人试玩

- 冰箱开关速度和门打开幅度，是否既看得见又不拖操作；长按摔门的音画节奏是否满意。
- 连点对骂时能否读清当前两句；台词火力、职业梗和重复频率是否合适。
- 手机触屏、刘海与微信容器中的显示及帧率。当前更新仅本地 Web 预览，微信包未更新。

## 本轮文件

`game/assets/scripts/{FridgeDoor,Feel,StationView}.ts`；`game/assets/logic/{banter,banterLines}.ts` 及新脚本 meta；`pipeline/handwritten/banter.json`；`tools/export-card-lines.mjs`、`tools/verify-fridge-banter.cjs`；`tests/banter.test.ts`；本记录、验证证据与 `ROADMAP.md`。此前 P0 和 UI 改动保留，没有推送、部署或同步。
