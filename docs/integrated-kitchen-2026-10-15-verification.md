# 厨房整合批次验收 · 2026-10-15

本批在当前工作区的 `codex/integrated-kitchen-experience` 整合已交付模块，并完成自定义布局 Task 2–7。接入提交：88b51c3（布局规格）、44cc01b（首次制作 UI）、409ee71 / f83aa8a（人物动作与熟度）。其他工作树保持原样。此页更新各独立模块“尚未接线”的历史状态；不把独立预览结论直接当作主工程验收。

[默认布局与首次提示](integrated-kitchen-2026-10-15-entry.png) · [工位编辑](integrated-kitchen-2026-10-15-editor.png) · [冰箱食材](integrated-kitchen-2026-10-15-inventory.png) · [手机比例编辑](integrated-kitchen-2026-10-15-view-780x360.png)

## 实际变化

- 回字形四周布局与中央空地保留。北侧按制作台 `(-1.5,-2.5)` → 烤炉 `(.5,-2.5)` → 饮料底柜 `(2,-2.5)` → 冰箱 `(3.5,-2.5)` 排布；取盘架 `(-3.5,0)` 在西侧中段，炸锅 `(-3.5,-1.5)`，洗区在东侧。灭火器留在前侧 `(4.5,3.25)`。移除制作台占用处的旧填充柜。
- 仓库至冰箱的导航距离由原布局 13.3203m 降至 5.7419m。最初尝试单独把冰箱移到东墙导致模拟完成率降至 53.5%，已弃用；最终备餐线通过原默认难度闸门。
- 休息日可移动/旋转已拥有的工位；建筑、冷库、顾客区固定，前台服务点只横移。0.5m 落格只作用于拖过的设备；20 步撤销，取消不保存，恢复默认只改草稿，保存后生效并退出。
- 几何、操作面、碰撞、模型、锅具、阴影、出水/火焰与顾客服务锚点使用同一布局。编辑冻结角色、营业计时和顾客；单指拥有拖动，第二指不抢占，取消手势回退半步。
- 存档 v3 原子写入完整进度与布局，v1/v2 保留金币、进度、购买和装饰。坏布局单独回退默认；写失败显示提示并保留编辑草稿。
- 正式接入库存图标/名称/数量、订单卡、首次制作引导、目标工位标记和对象/动作/手势分层按钮。库存面板的位置在生成点击区前更新。
- 正式接入取放、端盘、刷洗动作和五档肉色/烤痕。取消炉位、手持和台面的实时熟度文字；订单中的顾客要求保留，引导解释观察肉色与烤痕。

## 机器检查与真实输入

| 检查 | 结果与边界 |
| --- | --- |
| `pnpm check` | 零引擎依赖、类型检查、601 项测试 / 47 文件通过。 |
| `pnpm scene` / `pnpm cam` | 主场景、坐标、引用与相机判据通过。 |
| `pnpm layout` | 4900 个可达采样点，13 个工位，仓库门和前台东端净宽 1.5m。总体完成率 92.2%、后期 84.9%、idle 相对 M1 -7.0%，原闸门通过。 |
| Web 构建 | Cocos Creator 3.8.8，最终整合构建成功。 |
| 编辑真实输入 | 经前台休息入口进入；拖动、堵门保存拒绝且旧存档不变、撤销、取消、保存与刷新读回通过。注入存储写失败时保留草稿和原进度，恢复存储后可保存。 |
| 营业真实输入 | 真实鼠标拖动摇杆、按钮和库存格完成一单，served=1、wrong=0，引导确由成功交付结束；刷盘、晾盘、归架及仓库搬箱补货通过。没有 teleport 或直接调用 interact 代替此链路。 |
| 布局冻结 | 编辑前后 shift 时间、炉位计时、角色位置和天数一致。 |
| 浏览器触摸 | CDP 真实触摸事件验证第二指不保存/抢占，touchCancel 回退未完成拖动。微信胶囊区使用模拟 API 检查保留空间，属于浏览器模拟。 |
| 画幅 | 1024×768、1280×720、1560×720、780×360 中真实选择并拖动冰箱、撤销通过；按钮最小 CSS 高度分别 70.4 / 88 / 88 / 44px。 |
| 生命周期 | 独立程序设置状态，连续 20 次切换工位旋转/应用布局，再等待真实 Cocos 引擎帧：渲染器 148→148，两个锅、一个效果对象、一个动态阴影节点。该探针不作为真实输入玩法证明。 |
| 审查回归 | 出餐点与外卖袋交叉绑定，以及饮料旋转锚点两项均先复现失败，再验证误差 0。 |
| 浏览器日志 | 最终真实输入回归零页面异常、警告、失败请求；机器可读记录见同名前缀 `check.json`。 |

原资源计数探针曾仅等待浏览器 RAF，读到了 Cocos 本帧尚待销毁的旧节点；已改为等待引擎绘制帧。独立真实帧探针和最终 20 次应用回归均确认节点稳定，未用忽略旧节点的方式掩盖增长。

## 新手节奏与模拟边界

| 天 | 顾客数 | 平均间隔 | 并发上限 | 外卖 |
| --- | --- | --- | --- | --- |
| 1 | 4 | 35s | 1 | 关闭 |
| 2 | 6 | 36s | 2 | 关闭 |
| 3 | 8 | 36s | 2 | 关闭 |
| 4 | 10 | 33s | 3 | 原有规则 |
| 5 | 10 | 30s | 3 | 原有规则 |
| 6 起 | 原有规则 | 原有规则 | 原有规则 | 原有规则 |

任务数量目标、顾客表现轮换及停止生成外卖的条件同步使用实际客数；前三天不抽外卖任务。保留所有已购升级、加工/火候/洗盘时间、移速、耐心与评分线。没有通过直接修改 difficultyForDay(1) 牵动全期归一化。

两组各 32 个固定种子在当前布局复核，学习延迟假设下前三天均 32/32 过关；第五天 30s 两组各 31/32，原 28.5s 在独立组只有 30/32，因此选用 30s。第六天原参数、已购升级、人数与盘子守恒判据通过。独立组第六天仍只有 23/32 过关，后期压力仍需真人反馈。

旧分析的首日“少于 180 秒”是旧布局观测目标；本轮选参组为 181.18s、独立组 178.74s，不能声称都低于 180s。复跑判据改为相对同布局原参数缩短首日，并保留首日四位、无需补货、过关比例和守恒检查；减少人数本身会减少工作量及收入，不能把改善全部归因于间隔。早期收入与商店购买时机可能变化，未擅自加奖励或改价格。

完整冻结输入、原参数对照、选参与独立复核见 `integrated-difficulty-{layout,results,sensitivity,confirmation}-2026-10-15.json`。全部结果逐字节复跑通过，坏布局和来源漂移会被拒绝。报告中的 `productChanged:false` 指标只表明标定脚本不写产品源码，不表示本次整合未修改难度。

## 产物与复跑

- Web：`game/build/integrated-kitchen-web`，本地预览 `http://127.0.0.1:4191`。
- 微信：`game/build/kitchen-chaos-integrated-wechat-20261015`。
- ZIP：`game/build/packages/kitchen-chaos-integrated-wechat-20261015.zip`，170 个文件逐一 SHA-256 与构建目录相同。
- 主包 2,253,532 字节，main 分包 6,059,046 字节，internal 分包 405,194 字节，总量 8,717,772 字节；预算与安全余量通过，无远程 bundle。主包未增加。

```powershell
pnpm check
pnpm scene
pnpm cam
pnpm layout
node tools/verify-integrated-kitchen.cjs http://127.0.0.1:4191 game/temp/integrated-verification
node tools/verify-layout-bindings.cjs http://127.0.0.1:4191
node tools/check-wechat-package.mjs game/build/kitchen-chaos-integrated-wechat-20261015
node tools/difficulty-verify.mjs docs/integrated-difficulty-layout-2026-10-15.json docs/integrated-difficulty-results-2026-10-15.json docs/integrated-difficulty-sensitivity-2026-10-15.json docs/integrated-difficulty-confirmation-2026-10-15.json
```

新浏览器脚本需要 Playwright 和 Edge，可用 `PLAYWRIGHT_MODULE` 指定模块。布局绑定和生命周期检查含独立程序状态设置，真实营业输入与其分开记录。

## 不要报成 bug / 遗留

- 建筑和未购设备不能移动，服务点只能横移；未拖过的默认小数坐标不全部吸附。
- 自定义布局只要求安全可操作，不要求与默认模拟完成率等价；布局收益是玩家选择。
- 旧存档没有布局时使用这次的新默认；取消不落盘，恢复默认仍需保存。
- 原任务卡、评价弹窗、商店和结算页没有在本批全面换皮。饮料与灭火器手持实物挂点仍待补接，现有图标提示保留；不将本批动作接入报成所有动作素材已完善。
- 本批结束时自由物品只有设计；后续已完成食材/带盘肉饼/汉堡第一版，见 `loose-items-2026-10-15-verification.md`。本页保留上批整合的验收范围，不将工位装修代称为物品自由交互。
- 月度经营、欠费、破产和奖励仍只设计，不扣费。
- 浏览器输入、模拟和微信构建不能代替手机真实拖动、多指、声音、安全区、性能和连续试玩；新玩家仅凭提示能否独立完成第一单仍需真人观察。
- 新布局和界面观感需用户试玩确认。所有修改和构建留在本地，未推送、部署或发布。

## 文件清单

整合源码：`game/assets/logic/{layout,scene-layout,types,kitchen,progress,layout-editor,difficulty,tasks}.ts`；`game/assets/scripts/{StationView,ShopUi,WorkstationEffects,LayoutRuntime,LayoutEditor}.ts`，新增脚本及目录 `.meta`；`tools/{scene-spec,layout-navigation}.ts`；`game/assets/main.scene`、`game/assets/art/restaurant/contact-shadows.glb` 及其导入计数 `.meta`（原 UUID 保留）。

引入已交付模块：`Controls.ts`、`BurgerStack.ts`、`ChefActions.ts`、`ChefMotion.ts`、`CookAppearance.ts`、`PattyVisual.ts`、`scripts/ui/*` 及相应测试/元数据；原交付文档、实景、录像与专用工具随其提交保留。

新改测试：`tests/{layout,layout-validation,layout-save,layout-editor,early-policy,scene-layout,restaurant-art,progress}.test.ts`。工具：`tools/{verify-integrated-kitchen.cjs,verify-layout-bindings.cjs,difficulty-capture.ts,difficulty-calibrate.ts,difficulty-verify.mjs}`。

记录：`ROADMAP.md`、本页、九项反馈批次、布局设计和计划更新、物品自由交互设计、历史难度/经营设计资料、`integrated-difficulty-*`、`integrated-kitchen-2026-10-15-*` 证据。构建和 ZIP 沿用忽略规则留在本地。
