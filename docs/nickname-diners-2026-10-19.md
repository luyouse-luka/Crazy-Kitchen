# 顾客取消职业与文案统一（2026-10-19）

用户要求：列出已知网络梗；取消混乱的顾客职业，然后调整文案。本轮接续当前全部未提交工作，保留取消重打和投掷动作。

## 结果与文案方向

- 50 位顾客都用两字昵称，如阿星、大橘、小满、阿圆、小七；订单卡继续显示“昵称 · 点单/催餐/超时”，不增加职业分类。
- 所有当前顾客卡的进店、点单文本、催餐、好评、差评与四句争论文案统一为吃饭语境。对骂库中的各卡回嘴、投诉、离场句同步重写；事故吐槽不再引用职业。性格差异来自当前情绪和语气，订单要求仍独立显示。
- 例：阿圆进店“先别急，我先吃。”，催餐“好了，现在可以急了。”；小满进店“快乐加载中。”，催餐“进度条是不是卡住了？”；阿星开场“规矩立住，不烧心。”。
- 阿星三章改为“第一次来 → 又见面了 → 老位置见”，围绕三次来店及真实好坏接待建立熟悉感，删除试镜、候补和登台背景。旧章节数值及好坏记忆继续兼容，不清档、不倒退天数。
- 后续生成用的 24 个职业原型改为语气参考；提示词要求昵称、吃饭与当下反应，先说清订单，再玩梗。schema 为 identity 增加昵称说明，旧字段名保留以兼容数据。

## 可继续选用的梗与改写

常用短句：规矩立住，不烧心；包的；来都来了；主打一个；稳稳拿捏；听劝；怎么个事；这波有东西。

吐槽反应：我请问呢；绷不住了；破防了；这很难评；已读乱回；沉默震耳欲聋；你是懂我的；先别急；不嘻嘻；尊嘟假嘟。

吃饭语境改写：快乐加载中；饭搭子已就位；情绪价值拉满；先吃为敬；我的胃有意见；期待值拉满；别画饼，给真饼；快乐到账。

该清单是创作候选，不是实时热度排名；部分是适配游戏的梗式改写。每句围绕一个意思，不用多重背景和梗挤掉配方、忌口或熟度说明。

## 验证与边界

- 新昵称/无职业内容约束及熟客故事测试先失败后通过。`pnpm check`：**691 项 / 52 文件**，类型和零引擎依赖通过；开场气泡短句调整后，`reviews/p1/banter` 三文件 **42 项**再次通过。
- `pnpm validate pipeline/handwritten/cards.json`：50 通过、0 打回。昵称均两字；进店≤12、催餐≤15、好差评≤40、旧四句争论≤10 的管线限制保留。生成表和源数据一致。
- 与 HEAD 对比，50 卡的 ID、订单配方、禁料、熟度、耐心、mood 与 arc 不变；只更新昵称和表演文案。没有修改评分、客流、库存、金币或连续经营逻辑。
- Web 构建最终日志 `Finished`，Cocos 3.8.8 返回 36，浏览器实际运行验收。最终目录 `game/build/nickname-diners-web`；本聊天原 4200 预览服务改为该目录，保留同源浏览器存档。
- `verify-p1.cjs` 检查三次来店的新昵称、章节标题与台词、好坏记忆、判单解释、零星进入下一天及刷新、重复结算不重复入账、脏盘目击及怼客原因。
- `verify-story-ui.cjs` 检查五种画幅的昵称标题、进店/催餐切换、点卡回应及不误移角色、配方/忌口/熟度不随玩梗改变，以及商店、装修、评价和结算边界。展示夹具里的职业称呼也已换成昵称。

短班、提供餐点和展示状态均沿用现有明确标注的诊断夹具，不代表真人自然通关或手机体验验收。是否好笑、是否还显杂乱需由玩家试玩判断。微信包后续已更新，见下节。

## 微信真机测试包（2026-10-19 后续）

按用户要求构建到微信开发者工具供真机测试。Cocos 3.8.8 日志确认 `Finished`（进程返回 36）；输出为 `game/build/kitchen-chaos-nickname-wechat-20261019`，项目名 `KitchenChaos-20261019`。沿用现有 AppID、基础库 3.17.2、横屏与分包配置，包含取消重打、昵称与吃饭文案、投掷和此前 P1 修改。

包体检查通过：主包 2,253,543 字节，总量 8,786,424 字节，170 文件，无远程 bundle。实际产物包含新昵称、三次来店章节、下一天按钮与投掷释放逻辑，旧职业名称及重打按钮文本不再出现。ZIP 位于 `game/build/packages/kitchen-chaos-nickname-wechat-20261019.zip`，逐文件核对 170 文件内容一致；[包体与哈希证据](wechat-device-2026-10-19-check.json)。

本机微信开发者工具 2.02.2608070 已启动；官方 CLI 自动导入因“服务端口已关闭”被拒绝，待用户决定是否开启。尚未验证开发者工具编译或真机运行，未上传、发布或推送。手动导入选择上述构建目录，使用已有小游戏 AppID；登录后在工具里点“预览”扫码进行真机测试。

后续用户授权开启服务端口，但界面操作由用户按 Esc 停止，未开启或完成自动导入；用户随后改为手动解压导入。18:51 用户反馈仍显示旧厨房，经工具“基本信息”确认当前打开的是 `D:/github/Crazy-Kitchen/game/build/wechatgame`、工程名 `NewProject`。该目录确实没有新昵称与 `Btn_NextDay`。桌面 `C:/Users/12255/Desktop/kitchen-chaos-nickname-wechat-20261019` 的 170 文件与本轮 ZIP 全部一致，当前工具未切到该目录。不能把旧目录的模拟器画面归为本包运行验证。

为减少手动选择混淆，增加 `game/build/packages/KitchenChaos-20261019-manual-import.zip`：带独立 `KitchenChaos-20261019/` 根目录及 ZIP 根部导入说明，170 个游戏文件逐字节不变。用户应通过“项目 → 导入项目”选择这个目录，工程名为 `KitchenChaos-20261019`；不要继续打开最近项目中的 `NewProject`。新包尚未在微信模拟器或真机验收，游戏源码未因本次排查修改。

复跑包体检查：`node tools/check-wechat-package.mjs game/build/kitchen-chaos-nickname-wechat-20261019 game/temp/nickname-wechat-package.json`。构建配置为 `game/temp/build-nickname-wechat.json`，构建日志为 `game/temp/nickname-wechat-build.log`。本次只新增包体证据及更新本页、ROADMAP 和交接状态，未修改游戏源码。

证据：[检查摘要与来源哈希](nickname-diners-2026-10-19-check.json)、[阿星卡片](nickname-diners/regular-card.png)、[普通顾客卡片](nickname-diners/customer-card.png)、[来店故事结算](nickname-diners/regular-recap.png)。

## 复跑

```powershell
$env:pnpm_config_verify_deps_before_run='false'
pnpm check
pnpm validate pipeline/handwritten/cards.json
pnpm cards:export
$env:PLAYWRIGHT_MODULE='C:/Users/12255/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/verify-p1.cjs http://127.0.0.1:4200 game/temp/nickname-delivery-p1
node tools/verify-story-ui.cjs http://127.0.0.1:4200 game/temp/nickname-delivery-ui
```

构建配置：`game/temp/build-nickname-diners-web.json`。构建后运行 `node tools/prepare-web-preview.mjs game/build/nickname-diners-web`，再用 `python tools/serve-web-preview.py game/build/nickname-diners-web --port 4200` 预览。若原端口仍有进程，先核实进程归属，不关闭其他服务。

## 不要报成 bug 的清单

- identity 现在存昵称；字段名是兼容格式，不代表仍有职业系统。mood 保留作语气，不给顾客新增职业标签。
- 历史记录、旧测试夹具与手写维度快照仍可能提到职业；当前运行时内容和后续生成入口已按新要求更新，不全量改写历史。
- 熟客只有固定三次来店，实际操作影响评价、收益和回忆；不是任意人生模拟。旧章节档继续接新文案，不重新演完已记录章节。
- 全部新文案为本轮创作或梗式改写，不作为实时网络热度或真人趣味性验收结论。没有调用外部付费生成服务。

## 本轮文件清单

运行时/生成表：`game/assets/logic/{regular,recap,banterLines}.ts`、`game/assets/scripts/cardLines.ts`。

内容及后续生成入口：`pipeline/handwritten/{cards,banter}.json`、`pipeline/{dimensions.json,customer.schema.json,prompt.ts}`。

测试与工具：`tests/{reviews,p1,banter}.test.ts`、`tools/{verify-p1,verify-story-ui}.cjs`。

记录和证据：本页、同名检查 JSON、`nickname-diners/` 三张截图、`ROADMAP.md`、`docs/{feedback-phases-2026-10-15,HANDOFF-2026-10-16}.md`。此前其他未提交文件、本机 information.json 和 `.superpowers/` 保留；未提交、推送、发布或上传。
