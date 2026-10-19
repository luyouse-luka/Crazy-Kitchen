# 取消重打当天与顾客梗台词（2026-10-19）

用户要求：① 去掉重新打这一天的设定；② 顾客卡增加趣味性，多用“规矩立住，不烧心”等网络梗。承接 `c98ed2b` 及本地未提交的投掷动作修改，未重置工作区。

## 结果

- 每次完成营业日都推进日历，零星也进入下一天；星级继续表示当天成绩，不再作为解锁门槛。结算只保留“下一天 / 商店”，删除重打捕获区和门槛文案。刷新读取已推进的存档；重复结算仍不重复入账。历史最佳成绩、金币、购买、布局、装饰和熟客记忆保持兼容。
- 原场景按钮原位改为 `Btn_NextDay`，UUID 保留；`scene-spec.ts` 与运行时路径同时更新，重新生成场景也不会恢复旧按钮。
- 50 位顾客的进店、催餐、好评和差评共 200 个文本按身份重写。例如相声演员接包袱、班主任被拖堂、程序员胃在加载、骑手送完别人再安排自己；不是每张卡套同一梗。进店句最多 12 字、催餐最多 15 字，沿用原管线限制。订单规格独立显示，梗不新增配料或熟度要求。
- 阿星三章保留“试镜 → 候补 → 登台”的故事与实际接待记忆，加入“规矩立住，不烧心”“干饭必须出圈”“情绪价值”等表达。对骂库新增各身份回嘴和投诉，以及两句厨师回应，共从 474 增到 576 句；随机防重复和订单随机源继续分离。

## 验证

- 新推进和梗台词测试先失败再通过。`pnpm check`：**690 项测试 / 52 文件**、类型与零引擎依赖通过；`pnpm scene` 通过；`pnpm validate pipeline/handwritten/cards.json` **50 通过 / 0 打回**。生成表与手写源同步检查通过。
- 对比 HEAD 的 50 张卡，ID、身份、情绪、订单配方、忌口、熟度、耐心和 arc 未改。此轮不改客流参数、评分或金币算法；天数不再由星级拦截是用户指定的行为变化。
- Web 构建最终日志 `Finished`，Cocos 返回 36，实际浏览器启动和操作通过。目录 `game/build/continuous-days-web`，预览 [本地 4200](http://127.0.0.1:4200/)。
- `verify-p1.cjs` 七组检查通过：三次接待与结算；第 3 天缺芝士、零星仍保存第 4 天；结果只存在下一天和商店按钮及对应捕获区；点击进入第 4 天、休息及刷新保留进度与故事；重复结算不重复入账；坏接待回忆、目击与怼客原因仍正确。
- `verify-story-ui.cjs` 五画幅通过：1280×720、1024×768、1560×720、780×360、587×652，含顾客进店/催餐句、订单规格、商店购买与翻页、已拥有状态、装修、食材与脏盘图标、结算边界。人工查看首章新台词和零星结算截图，配方与故事区域分离，结算两个按钮完整显示。

浏览器故事检查仍使用短班和提供餐点的诊断夹具，操作按钮和判单/结算为真实链路；不冒充真人自然打完三天。界面脚本的展示夹具边界沿用既有记录。网络梗是否好笑、频率是否舒服仍需要真人试玩。

证据：[检查与来源哈希](continuous-days-memes-2026-10-19-check.json)、[首章顾客卡](continuous-days-memes/chapter-1-order.png)、[零星结算](continuous-days-memes/chapter-3-result.png)。原始浏览器输出在忽略目录 `game/temp/continuous-days-{p1,story-ui}/result.json`。

## 复跑

```powershell
$env:pnpm_config_verify_deps_before_run='false'
pnpm check
pnpm scene
pnpm validate pipeline/handwritten/cards.json
pnpm cards:export
$env:PLAYWRIGHT_MODULE='C:/Users/12255/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/verify-p1.cjs http://127.0.0.1:4200 game/temp/continuous-days-p1
node tools/verify-story-ui.cjs http://127.0.0.1:4200 game/temp/continuous-days-story-ui
```

构建配置 `game/temp/build-continuous-days-web.json` 沿用已有主场景 Web Desktop 配置，仅改输出名为 `continuous-days-web`。构建后用 `node tools/prepare-web-preview.mjs game/build/continuous-days-web` 整理预览，再运行 `python tools/serve-web-preview.py game/build/continuous-days-web --port 4200`。

## 不要报成 bug 的清单与遗留

- 零星也进下一天是本次明确变化，不应恢复一星门槛或添加重打按钮。历史成绩字段保留用于兼容与防止重复/旧结算倒退进度，不代表仍提供重玩入口。
- 休息不推进熟客章节；没有实际完成接待时也不补造熟客记忆。内部重置方法继续供下一营业日和诊断脚本复用，不是玩家可选的重打功能。
- 梗是表演层，不是新订单条件，不改变判单。好笑程度没有用自动测试背书。
- 未更新微信包、做真机验证、提交、推送或发布。前轮未提交工作和本机原有修改保持。

## 本轮文件清单

源码/场景：`game/assets/logic/{progress,regular,banterLines}.ts`、`game/assets/scripts/{StationView,cardLines}.ts`、`game/assets/main.scene`。

内容源：`pipeline/handwritten/{cards,banter}.json`；生成表经 `cards:export` 同步。

测试/工具：`tests/{progress,day-chain,reviews,p1}.test.ts`、`tools/{scene-spec.ts,verify-p1.cjs}`。

记录/证据：本页及同名检查 JSON、`continuous-days-memes/` 两张截图、`ROADMAP.md`、`docs/{feedback-phases-2026-10-15,HANDOFF-2026-10-16}.md`。前轮 ChefMotion/ChefActions/投掷测试与工具、本机 information.json 和 `.superpowers/` 均不算本轮新增修改。
