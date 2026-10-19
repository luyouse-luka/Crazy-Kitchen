# 自由投掷动作接续（2026-10-19）

接续九项反馈的第 2、5、9 项，基线 `c98ed2b`、分支 `codex/integrated-kitchen-experience`。本轮补人物投掷动作，保留已有单件操作、顾客故事、复盘与冰箱陈列。

## 行为与原因

- 辅助键按住时，携物手向后上方收拢、躯干轻微后仰；沿用原 0.3 秒长按自动投掷，成功后摆臂前送并收势。原来借用放盘动作，缺少蓄力与专用出手。
- 食材和不带盘肉饼单手投，带盘肉饼或汉堡双手投；物品离手后仍保留原单手/双手姿态。边走边投继续播放腿部行走，不因移动直接取消动作。
- 滑出、取消、打开面板或手中无可投物品时停止蓄力。只有 `putLooseItem` 成功才播放出手；失败保留手持物。切后台、布局输入重置和重开沿用统一清理入口。
- 动画不参与物品生成、库存、盘子或判单。投掷速度、落点、碰撞、数量上限和携带单位保持原逻辑。

## 验证与复跑

新增动作回归先失败再通过；`pnpm check` 的类型检查、零引擎依赖和 **686 项测试 / 52 文件**通过。新增 7 项覆盖行走蓄力、取消、空手/异常输入、单手/双手出手、后台恢复和后续操作覆盖。

Cocos Creator 3.8.8 Web 构建日志 `Finished`，实际运行预览为 [本地 4199](http://127.0.0.1:4199/)，目录 `game/build/throw-feedback-web`。构建进程返回 36，成功判断同时依赖最终构建日志和浏览器实操，未将该返回值作为普通命令的 0 退出码描述。

`verify-player-feedback.cjs` 使用真实鼠标摇杆和按钮取料、制作、投掷、拾回、交餐及洗盘；逐帧采集实际手臂/脊柱四元数，验证蓄力时仍携物、投出后才空手、单手/双手正确、库存/盘子守恒。滑出取消使用实际鼠标移出按钮；后台检查为游戏隐藏事件诊断，不是真实手机切后台。保留四画幅、手持显示、行走和上下文图标回归。`verify-p1.cjs` 的七组故事与复盘检查通过，其短班/餐点夹具边界继续沿用 P1 记录。

证据：[检查摘要与来源哈希](throw-feedback-2026-10-19-check.json)、[单手投掷](throw-feedback/single-ingredient-throw.png)、[带盘投掷](throw-feedback/plated-burger-throw.png)。原始逐帧输出保存在忽略目录 `game/temp/throw-feedback-gameplay-final/result.json`。

```powershell
$env:pnpm_config_verify_deps_before_run='false'
pnpm check
node tools/verify-player-feedback.cjs http://127.0.0.1:4199 game/temp/throw-feedback-gameplay-final
$env:PLAYWRIGHT_MODULE='C:/Users/12255/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/verify-p1.cjs http://127.0.0.1:4199 game/temp/throw-feedback-p1
```

构建配置为 `game/temp/build-throw-web.json`，来源是已有 `build-player-web.json`，只更换 `outputName`。新机器缺少该配置时可按同主场景 Web Desktop 配置重建，输出名设为 `throw-feedback-web`；构建后运行 `node tools/prepare-web-preview.mjs game/build/throw-feedback-web`，再用 `python tools/serve-web-preview.py game/build/throw-feedback-web --port 4199` 提供本地预览。

## 不要报成 bug 的清单与遗留

- 保持长按达到阈值自动投掷；不是松手才投，也不按蓄力时长加投掷距离。
- 本轮只补人物动作，未扩大自由物品白名单；货箱、叠盘、配餐与灭火器仍按原规则操作，不新增自由落地或惩罚。
- 蓄力位移（后收 0.24m、抬手 0.18m）、躯干角度（后仰最多 12°、前倾最多 18°）与 0.28s 收势为本轮自定表现值，需真人判断力度和舒适度；不是外部设计稿数值。引擎 IK 按实际骨长约束可达距离。
- 微信包尚未更新；触屏多指、真实切后台、声音和设备性能尚未验收。新动作不等于完成全部动作/3D 素材打磨。

## 文件清单

源码：`game/assets/scripts/{ChefMotion,ChefActions,StationView}.ts`。

测试与工具：`tests/chef-motion.test.ts`、`tools/verify-player-feedback.cjs`。

记录与证据：本页、`throw-feedback-2026-10-19-check.json`、`throw-feedback/` 两张截图、`ROADMAP.md`、`docs/{feedback-phases-2026-10-15,HANDOFF-2026-10-16}.md`。

已有 `information.json` 本地修改及 `.superpowers/` 未跟踪内容保留，不归入本轮修改。没有提交、推送、同步、发布或上传。
