# 厨师动作与肉熟度交接

2026-10-15。本轮模块与独立集成预览已完成；正式公共文件尚未接线。主对话接线后需在其最新工作树重跑验收。未推送、部署或同步。

工作树：`C:/Users/12255/.codex/worktrees/chef-actions/kitchen-chaos`，分支 `codex/chef-actions`。起点为主对话已完成并验证的 `88b51c3`，包含 `be80cc6` 的冰箱中段换位、盘架邻接、两只浅锅及灭火器去浮字。`main.scene`、`StationView.ts`、`WorkstationEffects.ts`、玩法和布局逻辑源文件保持基线原样。

## 原因和动作方案

旧版只有 idle、walk、sit，手臂没有端物姿势；汉堡位置使用固定 `HAND.y=1.0` 和朝向偏移，与手骨无关。炉上肉饼只分生、熟、焦，汉堡则把熟度色乘在生肉贴图上，两条路径表现不一致。

保留原模型、23 根骨骼及名称映射、idle / walk / sit、全部原有 `.meta`。人物 GLB 仍为 673,892 字节，SHA-256 和 UUID 见 [资源记录](chef-actions-2026-10-15-assets.json)。不新增动画片段或下载素材。

| 动作 | 表现与触发 | 退出和衔接 |
| --- | --- | --- |
| 取物 | 成功的 take / pick 事件触发伸手、适度前倾、收回；拒绝操作不触发 | 0.3 秒的表现窗口；移动立即打断，不延迟物品取得 |
| 放物与放肉 | 成功的 put / place / add / serve 事件触发；炉位在交互前选定，与实际状态机选择一致 | 物品立即按真实状态显示在工位；动作不等待回调、不锁移动 |
| 端盘 | 双手托盘边，盘底跟随实际双手中点，离手面 0.025 米；本次站姿盘底约 0.683 米 | 原 walk / idle 保留；持物权重指数过渡，不替换腿部动画 |
| 双手取料与叠盘 | 两种食材分别跟随两手，单个肉饼和取下的带盘肉饼由双手托住；叠盘最多显示五层 | 数量、配料和熟度均读现有 carry，不建立第二份玩法状态 |
| 刷盘 | 真实刷洗中、仍按住、仍在水槽范围、未移动时循环；身体前倾，双臂伸向水槽，独立海绵节点在 IK 后读取右手原有 `K_handslot.r` 骨骼挂点 | 松手、离站、移动、面板遮挡、完成、重开、打烊和输入取消分别停用 |

厨师单独切换到实时骨骼模式，在动画采样后调整上身；顾客继续使用原有动画方式。手臂长度由当前骨骼测量，不伸缩骨骼，不移动角色碰撞体。Cocos 的相关机制见 [官方骨骼动画说明](https://docs.cocos.com/creator/3.8/manual/en/animation/skeletal-animation.html)。

## 熟度表现

`CookAppearance.ts` 定义五档绝对颜色及焦痕强度；`PattyVisual.ts` 为炉上、手持和汉堡共用的肉饼网格与焦肉烟气。颜色不再乘生肉贴图，保持真实 `grillCookLevel` / carry.cook / burger.cook / burger.cook2。双层肉饼各自保留熟度。

| 熟度 | sRGB | 焦痕强度 | 烟气 |
| --- | --- | --- | --- |
| 生肉 | 224 101 115 | 0 | 无 |
| 三分 | 185 111 81 | 0.18 | 无 |
| 五分 | 142 83 42 | 0.4 | 无 |
| 全熟 | 91 49 26 | 0.7 | 无 |
| 焦肉 | 30 26 24 | 1 | 深色烟气 |

这些是本轮表现参数，后续可集中调整。肉饼采用 16 边轮廓；焦痕逐渐加深。Cocos 隐藏节点换网格会保留旧渲染子模型，已延后到重新启用后的 lateUpdate 更新，并检查实际渲染子模型，而非只看 cook 字段。

**熟度文字全部保留。** 正常镜头下已能看到颜色和焦痕差异，但人物遮挡、面包覆盖和手机画面大小仍影响辨认；本轮不提出撤除文字。

正常镜头：[生肉](chef-actions-2026-10-15-cook-raw-normal.png)、[三分](chef-actions-2026-10-15-cook-rare-normal.png)、[五分](chef-actions-2026-10-15-cook-medium-normal.png)、[全熟](chef-actions-2026-10-15-cook-well-normal.png)、[焦肉](chef-actions-2026-10-15-cook-burnt-normal.png)。

## 公共接线清单

公共改动以 [补丁](chef-actions-public.patch) 和 `tools/prepare-chef-preview.mjs` 的定点替换提供。补丁基于 `88b51c3`；接手方若已继续修改这些文件，应按下面接口合并，不覆盖整文件。生成器核对每个替换锚点的数量，不匹配即停止。

1. `StationView.buildBurgerStack` 创建并 configure `ChefActions`，传入现有 StackArt，随后 `bindBurger`。角色动作组件挂在现有 playerModel，不能同时创建第二套厨师。
2. 统一交互入口 `interactAt`：调用原 interact，直接使用返回的 `result.slot` 选择实际炉位锚点，再把结果交给 `notify`。不复制“先取烤得最久的肉”的玩法规则。面板取料、出餐和外卖也经过此入口。`blocked` 不触发；discard 撤销上一段取物动作。
3. `syncNodes` 每帧复用一个 `ChefFrame`，传入 running、moving、carrying、scrubbing、holding、sinkInReach；实际水槽 stage 必须仍为 soaked。传入 WorkstationEffects 的水槽锚点，不自行复刻刷洗计时。
4. 手持汉堡先按原逻辑更新内容，由动作组件在 lateUpdate 用当前双手位置更新最终坐标，消除移动时的一帧挂点差。台上汉堡继续用实际制作台坐标和 benchTopY。
5. `WorkstationEffects` 每炉位创建一个 `PattyVisual`，读取真实 grillCookLevel；移除旧的肉色 disc / 三根固定黑条，保留锅具、火焰、蒸汽和失火效果。hide / destroy 同时处理肉饼。
6. `WorkstationEffects.actionTarget` 暴露实际锅、水槽、饮料和晾架的表现锚点。移除原有动态网格中的海绵 box，由 `ChefActions` 独立海绵节点复用当前帧右手 `K_handslot.r` 的位置与旋转，避免工位网格先更新造成的一帧延迟；水流、泡沫和洗盘状态仍归工位效果负责。
7. restart、showResult、输入取消调用 reset；销毁时销毁组件。不要把动作结束接到玩法计时、操作权限或移动速度上。
8. 不需要修改 `main.scene`、骨骼映射、模型资产和已有 `.meta`。后续自定义布局移动 / 旋转工位后，须刷新 WorkstationEffects 锚点；当前补丁沿用基线的静态默认布局。

补丁预检：`git apply --check --ignore-space-change docs/chef-actions-public.patch`。本工作树已通过预检，但没有向公共源文件应用。

## 验证和实拍

- `pnpm check`：42 文件、565 项测试通过；基线为 41 文件、546 项。新增测试覆盖成功事件、拒绝操作、丢弃、移动、刷洗四项退出条件、reset、骨长守恒、五档颜色，以及真实肉饼从炉上取下、放进汉堡后的熟度守恒。表现 step 不修改厨房状态。
- 公共补丁在临时副本中通过完整类型检查，Cocos Creator 3.8.8 Web 与微信实际构建成功。scene 和 cam 检查通过。
- [浏览器记录](chef-actions-2026-10-15-check.json)：手中盘底距双手中点 0.025 米，横向 / 前后误差小于 0.002 米；手臂原长度保留；端盘时 walk 继续推进；放下坐标等于真实制作台；刷洗松手、离站、重开、打烊停止，海绵与当前帧手部挂点距离为 0；20 次重开后八个肉饼对象与烟气缓冲复用。双炉位回填后正确伸向较早下锅的第 1 炉位。五档炉上与手中肉饼共用网格，实际渲染子模型也与该网格一致。浏览器异常 / 警告 / 请求失败均为零。
- [真实输入回归](chef-actions-2026-10-15-real-input.json)：21 段鼠标拖动摇杆移动，正确交付一份汉堡，洗盘 / 晾盘 / 归架和灭火器取还通过，错误送餐 0，浏览器错误 / 失败请求 0。
- 姿态 / 熟度诊断使用临时摆位和近景镜头，开门飘字仅在诊断截图中隐藏；这些不写回正式场景。真实输入回归另行执行，不把诊断摆位当作寻路验证。
- 独立只读审查指出的炉位目标与海绵延迟已修正，回归通过；复审确认这两项无剩余问题。真机与全动画周期所有角度的遮挡不作为已验证结论。
- 复跑：`node tools/prepare-chef-preview.mjs` → `pnpm exec tsc --noEmit -p game/temp/chef-preview/tsconfig-check.json` → Cocos CLI 构建生成的 web-desktop.json / wechatgame.json → HTTP 服务 Web 目录 → `node tools/verify-chef-actions.cjs <URL> <输出目录>` 与 `node tools/verify-open-centre.cjs <URL> <输出目录>`。

临时集成工程位于 `game/temp/chef-preview/project`，构建位于 `game/temp/chef-preview/build/{chef-actions-web,chef-actions-wechat}`。预览脚本需 Playwright 和 Edge，可通过 `PLAYWRIGHT_MODULE` 指定现有模块路径。Cocos 构建首次缓存为空时重建了引擎缓存；最终构建日志确认成功，不将构建器的缓存提示算作浏览器验收结果。

[真实摇杆操作动画实拍](chef-actions-2026-10-15.webm) · [正常镜头端盘](chef-actions-2026-10-15-plate-normal.png) · [端盘近景](chef-actions-2026-10-15-plate-close.png) · [刷盘近景](chef-actions-2026-10-15-scrub-close.png)。实拍以 `node tools/record-chef-input.cjs <URL> <输出目录>` 复跑，包装现有真实摇杆脚本并记录视频，不修改原验证脚本。

## 资源和包体

新增模型 / 贴图 / 音频为 0 字节。四个独立模块及其 `.meta` 共 22,203 字节；详细文件大小见 [资源记录](chef-actions-2026-10-15-assets.json)。运行时共用五种肉饼网格和一个主体材质，每个肉饼拥有固定烟气缓冲；两个炉位最多额外两次主体绘制，每个可见焦肉再增加一次烟气绘制；独立海绵为 12 三角形，仅刷洗时增加一次绘制。未把这些静态开销换算为手机帧率。

| 微信实际产物 | 字节 |
| --- | --- |
| 主包 | 2,253,532 |
| main 分包 | 6,012,236 |
| internal 分包 | 405,194 |
| 合计 | 8,670,962 |

相对常用工位基线产物，总量增加 23,853 字节，增量全部在 main 分包；主包未增加。[包体判据](chef-actions-2026-10-15-package.json)通过，仍为本地临时集成构建，未上传。

## 文件清单

- 修改：`game/assets/scripts/BurgerStack.ts`。
- 新增：`game/assets/scripts/{ChefActions,ChefMotion,CookAppearance,PattyVisual}.ts` 及各自新 `.meta`。
- 测试：`tests/chef-motion.test.ts`。
- 工具：`tools/{prepare-chef-preview.mjs,verify-chef-actions.cjs,check-chef-assets.mjs,record-chef-input.cjs}`。
- 交接：本文、`docs/chef-actions-public.patch`、`docs/chef-actions-2026-10-15-{assets,check,package,real-input}.json`、端盘 / 刷洗截图、五档正常镜头截图与 WebM 实拍。

## 不要报成 bug 的清单和遗留

- 公共接线只在临时集成副本中应用，正式源文件留给主对话合并；本分支模块完成不等于主线已接入。
- 原 GLB / UUID / 骨骼 / 动画 / `.meta` 全部保留。动作由运行时上身控制完成，不新增 glTF 动画片段。
- 交互立即执行，伸手是后续表现；超出真实手臂长度的最远交互位置会限制伸手幅度，不伸缩骨骼、不移动碰撞体。若主对话要在全部触发距离都让指尖碰到工位中心，需要另定站位 / 操作距离规则。本轮没有扩大玩法修改范围。
- 自定义布局尚未集成动作锚点刷新；主对话需在移动工位后刷新锚点。
- 正常镜头下仍可能有面包、角色和工位遮挡，因此保留熟度文字。尚未进行手机视觉辨识、长时间帧率、发热、触控和微信真机试玩。
- 新增实物表现优先覆盖肉、配料、汉堡和叠盘。其余手持种类沿用现有提示和资源；可由 configure 的可选 extras 提供模型，不能把未接入的模型报成已完成。
