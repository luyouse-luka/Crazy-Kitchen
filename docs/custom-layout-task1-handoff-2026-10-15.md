# 自定义布局 Task 1 交接（2026-10-15）

## 下一窗口先定位

工作区：`C:/Users/12255/.codex/worktrees/custom-kitchen-layout/kitchen-chaos`，分支：`codex/custom-kitchen-layout`，基线：`be80cc6`。
原项目 `D:/Codex/vultr-projects/server-home-20260930/project/kitchen-chaos` 的 main 保留原提交；不要在那里重新从 Task 1 开始，也不要直接合并/推送当前功能分支。

用户已批准整个设计和“本会话直接实现”，本次又明确只实现当前任务，其余在其他对话窗口继续。本轮仅 Task 1；下一任务是计划中的 Task 2。方案和执行方式无需重新询问。

## 资料与代码入口

- 设计：`docs/custom-layout-design-2026-10-14.md`。
- 计划：`docs/superpowers/plans/2026-10-15-custom-kitchen-layout.md`，下一步读 Task 2 的完整段落。
- 数据目录：`game/assets/logic/scene-layout.ts`，稳定 LayoutId、布局/pose 类型、工位规格、固定障碍/区域。
- 纯几何：`game/assets/logic/layout.ts`，defaultLayout / parseLayout / rotateOffset / buildLayoutGeometry。
- 工具默认摆位：`tools/scene-spec.ts` 的 fixtureNode / fixtureArt 从共享目录读取，默认 main.scene 没改。
- 新测试：`tests/layout.test.ts`（27 项）。`.meta` 已生成并保留唯一 UUID。
- 本计划临时账本：`.superpowers/sdd/2026-10-15-custom-kitchen-layout/progress.md`。完整验证日志也在该忽略目录。

## 已验证与范围

新增测试先因缺少 layout 模块失败，再实现后通过。pnpm check 完整 546 项 / 41 文件通过（基线 519 项 / 40 文件），包含零引擎依赖与类型检查。
默认 pnpm layout 完成率 91.8%、后期 84.3%、idle 偏差 +0.6%，原难度闸门通过。
pnpm scene 检查通过；pnpm scene:apply dry-run 显示场景与 SPEC 一致、无改动。git diff --check 通过。
只读独立审查无待修项；审查额外比较整个 SPEC 与 be80cc6，所有值一致，新增 .meta UUID 在项目资产中唯一。

## Task 2 必须知道的边界

- LayoutConfig 是完整稳定 ID 记录，不是部分 patch；parseLayout 只做结构/有限值/朝向 0..3 检查，返回独立拷贝。越界但有限的坐标会保留，几何合法性由 Task 2 验证，不能把尚未应用的布局直接当安全输入。
- quarterTurn 是相对当前默认艺术摆法的增量。Cocos 正 Y 一档 `(x,z)` → `(z,-x)`；每次使用原宽深交换，不累积交换。
- buildLayoutGeometry.blockers 是完整物理碰撞集合；fixtures 是设备组占地；stations 保留原 Station_* / Block_* 玩法 ID。服务点不加移动碰撞，前台用一整块固定柜台。固定补货站与箱子采用同一物理占地，避免叠加重复盒。
- 饮料机整体占地含底柜 1×1m，触发中心相对柜体 z=-0.2，触发盒 0.8×0.6m；不要把机器触发盒当整个底柜的碰撞。
- 校验、操作面限制、购买限制、编辑状态、v3 存档迁移和场景运行应用均尚未接入，属于 Task 2–6。不要据本轮测试宣称装修功能可用。
- 固定障碍与当前 SPEC 用测试比对；后续改变固定建筑需同时检查这两处。当前未启用的隔断/回折柜不在 blockers 内。

## Windows 运行

当前工作区的 node_modules 是指向原项目现有依赖的 Junction，未执行依赖重装。pnpm 11 默认会检查并自动 install，复用 Junction 时需在本次命令的环境设置：

```powershell
$env:pnpm_config_verify_deps_before_run='false'
node tools/ensure-cocos-tsconfig.mjs
pnpm check
pnpm layout
pnpm scene:apply
```

不要运行会清除共享 node_modules 的 install。Bash 只有 WSL 入口，本轮没有调用；技能脚本的 brief/ledger/log 操作用 PowerShell 等价执行。

## 不要报成 bug 的清单

- 未增加装修入口、拖动 UI、碰撞运行切换或新存档字段，是用户指定只做 Task 1。
- main.scene、模型与阴影文件没有再次生成；本次只统一默认数据来源，当前游戏画面不变。
- 有限越界坐标暂不拒绝、非法布局不夹回地图，是结构解析与后续几何校验的明确分工。
- 灭火器/服务点姿态和购买限制由后续校验/编辑命令限制；结构解析只接受封闭数据类型。
- 月度费用、破产惩罚/奖励仍是后期提案，不在当前布局计划接入。

建议下个窗口使用 superpowers:executing-plans、superpowers:test-driven-development，遇到失败再用 systematic-debugging；复用上述账本，从 Task 2 开始。
