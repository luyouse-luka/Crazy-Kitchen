# 试玩反馈：行走、手持与图标按钮

2026-10-15，接续自由物品第一版。用户已澄清：**每次只能拿一件**。修改保留在本地 `codex/integrated-kitchen-experience`，没有推送或部署。

## 修复内容与原因

行走没有实际驱动骨骼。修复前用真实摇杆连续采样，walk 状态计时前进，腿部局部四元数不变；32 条 glTF 动画路径都能绑定，素材没有缺失。原因是 ChefActions 在 SkeletalAnimation 初始化后把烘焙模式切到实时模式，Cocos 3.8.8 的已有状态仍保留 `_doNotCreateEval=true`、没有 `_clipEval`。现在场景和素材接入工具在初始化前就设为实时骨骼动画，去掉事后切换；不修改引擎和原模型文件。以前仅检查“walk 正在播放”不足以证明行走动画实际生效，本轮判据已补成真实腿部/手臂骨骼变化。

转身改为沿最短角度平滑追随，速度上限 10rad/s；移动与工位判定保持原逻辑，投掷使用当前可见朝向。行走片段随摇杆幅度调整播放速度。单个食材/生肉饼只约束持物手，另一条手臂保留原动画；带盘餐点、货箱和叠盘仍双手托举。手持目标下降到胸部下方，食物挂到实际手掌；去掉所有头顶手持气泡，并补齐饮料杯、货箱、灭火器的手持模型，以及原本克隆了隐藏源节点而不显示的薯条。

正式玩法启用单件取物：拿到一个后关闭冰箱面板，手未空时拒绝继续取料，不换料、不扣第二份库存。食材、餐点、整箱货或整叠盘分别沿用原搬运单位。逻辑层保留旧双手模式用于兼容及模拟；旧双物品快照测试仍有效，不代表正式玩法还可双持。

右侧删除对象名、动作、手势和“空手”等可见文字，改为冰箱、肉饼下锅/取出、组装、端盘、交餐、订单、箱子、洗碗、盘子等矢量图标；手持物保留一个小角标。点按和长按用小圆点/时钟圈表示，地面拾取额外显示垃圾桶＋长按标记，即便制作台被占用也可发现清理入口。首次制作引导仍保留文字解释。

## 验证

- 新增回归测试先失败后通过：初始化模式、单件库存守恒、短弧转身、单手/双手分工、场景图标、阻止拾取时的清理图标。`pnpm check`：**49 文件 / 636 项通过**，类型与零引擎依赖检查通过；场景检查通过。
- `tools/verify-player-feedback.cjs` 用真实摇杆/按钮检查空手和持物行走时腿部及空闲手臂的实际骨骼方向变化；取四元数内积绝对值计算角度，避免把 q 与 -q 当成运动。检查转身没有 180°跳变、食物低于头部且贴近手掌、头顶气泡隐藏。
- 实际流程覆盖单件取料后关闭面板、拒绝第二件且库存不变、地面放下/拾取/投掷/清理、图标随工位切换、正确交餐 1 单/错误 0 单，以及泡碗、刷洗、晾盘、还盘。薯条、饮料、货箱、灭火器的几何显示另做明确标记的表现层诊断，不冒充完整营业取用。
- 四画幅：1024×768、1280×720、1560×720、780×360。右侧操作按钮没有可见文字标签。浏览器无警告、错误或资源请求失败。
- 新鲜只读审查指出地面“长按清理”在隐藏文字后不够明显，已补图标并做两项先失败后通过回归；没有其他高置信功能问题。
- 内置侧栏实际发现桌面模板固定 1280×960 且带标题、滚动条与调试面板，右侧按钮被裁切；增加桌面专用自适应模板样式及预览整理工具。587×652、1280×720、780×360 **不注入 CSS** 实测画布完整贴合窗口，无滚动条、标题和性能面板。加内容指纹避免内置浏览器缓存旧样式；微信模板不变。当前内置浏览器已切到修复版并目视确认完整画面。

实测数据、截图和包体校验随本页保存为 `player-feedback-2026-10-15-*`。Web 构建为 `game/build/player-feedback-web`，本地预览端口 4193。微信构建为 `game/build/kitchen-chaos-player-feedback-wechat-20261015`。

本次空手腿部方向变化范围 1.0152rad，持物时空闲手臂 0.8745rad。完整数据见 [真实操作](player-feedback-2026-10-15-check.json)、[修复前骨骼](player-feedback-2026-10-15-before.json)、[预览窗口](player-feedback-2026-10-15-preview.json)。[持物行走](player-feedback-2026-10-15-carry-walk-8.png)、[地面操作图标](player-feedback-2026-10-15-ground-icons.png)、[洗碗图标](player-feedback-2026-10-15-wash-icon.png)与四画幅截图同目录保存。

微信 ZIP：`game/build/packages/kitchen-chaos-player-feedback-wechat-20261015.zip`，2,547,229 字节，170 文件逐个 SHA-256 与构建目录一致。主包 2,253,532 字节、internal 405,194 字节、main 分包 6,075,353 字节，总量 8,734,079 字节；主包安全余量与总包预算通过，无远端 bundle。见 [包体报告](player-feedback-2026-10-15-package.json)。

## 可复跑

```powershell
pnpm check
pnpm scene
node tools/prepare-web-preview.mjs game/build/player-feedback-web
node tools/verify-player-preview.cjs http://127.0.0.1:4193
node tools/verify-player-feedback.cjs http://127.0.0.1:4193 game/temp/player-feedback-verification
node tools/verify-loose-items.cjs http://127.0.0.1:4193 game/temp/player-feedback-loose-regression
node tools/check-wechat-package.mjs game/build/kitchen-chaos-player-feedback-wechat-20261015
```

构建配置在 `game/temp/build-player-web.json`、`game/temp/build-player-wechat.json`。浏览器验证需本地静态服务、Playwright 与 Edge；可用 `PLAYWRIGHT_MODULE` 指定模块路径。

## 不要报成 bug / 边界

- glTF clip 的 `tracks.length=0` 不表示没有动画，其曲线位于 exoticAnimation；以后不能只凭播放标记或 tracks 数量验收动作。
- 玩家使用实时骨骼以叠加手持 IK，顾客继续原有动画方式。原有 GLB 和 UUID 保留，不重做骨骼。
- 手上只拿一件，整箱货/整叠盘仍按原机制计为一个搬运单位；旧双手逻辑测试是兼容路径。
- 箱子、叠盘、配餐、灭火器仍未开放自由落地投掷；已有食材、肉饼和汉堡支持这些操作。
- 图标是本项目绘制的首版，手感、辨识度和真实微信设备帧率仍需试玩。新增单件模式可能改变实际往返节奏，旧双手模拟通过不等于单件模式已完成人类难度标定。
- 原任务卡、商店、结算等页面未在本轮全面换皮。首次引导与错误反馈保留说明文字。

## 本轮文件清单

源码：`game/assets/logic/kitchen.ts`、`game/assets/main.scene`、`game/assets/scripts/{ChefMotion,ChefActions,BurgerStack,Controls,StationView}.ts`、`game/assets/scripts/ui/{UiModel,ControlGlyphs}.ts` 及新增 `.meta`、`tools/apply-restaurant-art.mjs`、`game/build-templates/web-desktop/style.css`。

测试/工具：新增 `tests/player-feedback.test.ts`、`tools/{verify-player-feedback.cjs,verify-player-preview.cjs,prepare-web-preview.mjs}`；更新 `tools/verify-loose-items.cjs` 兼容正式单件模式并区分报告中的单件/旧双手验证。预览整理只处理本地 Web 构建：复制内容指纹样式，派生关闭 profiler 的启动文件并更新 HTML 引用；不修改引擎、游戏逻辑或微信产物。

记录：本页与 `player-feedback-2026-10-15-*` 证据、`ROADMAP.md`、`docs/feedback-phases-2026-10-15.md`、自由物品设计/验收页的最新状态说明。保留前两批未提交工作，不将整个工作区差异全部归为本轮。
