# 疯狂后厨当前进度核对

核对日期：2026-10-16。当前工作目录：`D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos`；Git 实读为 `codex/integrated-kitchen-experience`、`b75e626`。本研究没有修改游戏代码、配置或 lockfile，也没有远端操作。

## 当前版本实际上已经做到哪里？

### Takeaway
项目已经超出最小可玩原型：营业、制作、顾客反馈、结算、购买、跨天存档和休息日布局编辑已有完整代码链路。最准确的阶段是 **M3/M4 功能整合与体验验收收口，同时已有部分 M6 适配和包体工作**；不能把它标成已经达到上线标准。

### Cited Findings
- 最新正本断点是 2026-10-15 的行走、单件取物与图标按钮修复；正式玩法启用单件模式，逻辑和模拟保留旧双手兼容路径。依据：[ROADMAP:50](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:50)、[最新验收:7](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:7)、[StationView 单件配置:879](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/scripts/StationView.ts:879)、[厨房拒绝第二件:491](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/logic/kitchen.ts:491)。
- 自定义布局 Task 2–7 已正式整合：休息日移动/旋转工位、撤销、取消、恢复默认、通道校验、保存与失败保留草稿。旧 Task 1 交接中的“还没做编辑器”已被新记录替代。依据：[整合验收:3](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:3)、[ROADMAP:72](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:72)、[实际编辑入口:1173](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/scripts/StationView.ts:1173)、[存档版本3:17](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/logic/progress.ts:17)。
- 首次制作引导、库存名称/图标/数量、独立订单卡、ChefActions、五档熟度外观已接入正式主工程；最新按钮只显示上下文图标，引导仍有说明文字。依据：[ROADMAP:74](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:74)、[最新验收:13](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:13)、[实际创建引导:922](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/scripts/StationView.ts:922)。
- 自由物品第一版已经实现食材、肉饼、汉堡的放下、投掷、拾回和清理，保留配料、熟度与盘子关系，上限 16 组。依据：[自由物品验收:7](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/loose-items-2026-10-15-verification.md:7)、[真实类型白名单:23](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/logic/loose-items.ts:23)、[上限:7](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/logic/loose-items.ts:7)。
- 双层汉堡、薯条、饮料、起火/灭火、外卖骑手、对骂与目击、任务、休息日和商店都已有实现，不应照旧里程碑空框重复开发。依据：[较新的落地记录:379](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:379)、[商店9种商品:8](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/logic/shop.ts:8)、[双层熟度判定:49](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/logic/order.ts:49)、[火灾状态:254](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/logic/kitchen.ts:254)。
- 营业→失败/成功结算→收入和任务奖励→购买扩容→刷新存档生效，10-12 有真实键鼠操作记录。它是历史桌面验证，不能升级成手机或最新版本整日通过结论。依据：[真实操作:29](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/playtest-2026-10-12.md:29)。
- 最新顾客卡真实 JSON 为数组，当前本轮读取计数 **50 张，c_0001–c_0050**；可复跑 `node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync('pipeline/handwritten/cards.json','utf8')); console.log(c.length,c[0].id,c.at(-1).id)"`。9-29 的扩量记录与读取一致；旧 README/memory 的 25 张已经过时。依据：[卡源文件](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/pipeline/handwritten/cards.json)、[扩量记录:229](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:229)。

### Inferences
- 不宜报“完成百分比”：功能实现、真实玩家乐趣、性能、内容审核、发布材料是不同维度。应报“已具备连续经营闭环，当前主要缺口是体验验证、标定与发行准备”。
- 建议把路线图旧空框与当前代码做一次状态归并，保留历史但增加一张最新状态表，避免每个新会话重新做双层/饮料/起火/布局编辑。

### Gaps
- 仅凭现有记录不能证明当前最新单件玩法已由陌生玩家独立完成首次汉堡、完整首日或连续五日。
- 当前 Git HEAD 已包含整合代码；10-15 文档里的“未提交/未推送”是当时的交付边界，不能拿来声称当前远端状态。本研究没有 fetch 或查询远端推送人。

## M0–M7 原计划如何对应当前真实进度？

### Takeaway
M0/M1 已有正式历史完成记录；M2 闭环已形成；M3/M4 许多功能完成但关键真人验收未闭合；M5 内容扩产、M6 真机性能和 M7 正式发布仍未完成。8 月原始周数是阶段预估，不能据此给出今天之后的可靠上线日期。

### Cited Findings
| 里程碑 | 当前判断 | 证据 |
|---|---|---|
| M0 引擎/逻辑/顾客方向 | 历史已过。9-6 用户读25张卡认可方向，原先200张量化闸门实际被缩减为方向验证，不可声称做完200张统计实验。 | [ROADMAP:1325](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:1325)、[M0出口:1370](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:1370) |
| M1 无头压力原型 | 已完成历史标定和模拟工具；当前布局检查仍能通过，但代表旧携带模型。 | [M1清单:2337](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2337)、[单件标定边界:50](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:50) |
| M2 垂直切片 | 技术闭环已合上，9-18记录首次真机出画面；最新移动玩法的手机首日验收以及最终定名/软著材料无完成证据。 | [M2闭环记录:606](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:606)、[发布缺口:54](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/playtest-2026-10-12.md:54)、[M2出口要求:2438](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2438) |
| M3 压力落地 | 并发、订单、客流、情绪与评价已有；“真人连玩5局”与模拟-真人偏差尚无最新通过证据。正式音效仍有占位历史记录。 | [M3验收:2469](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2469)、[整合难度边界:49](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:49) |
| M4 混乱+经营 | 功能主体已经超过原始清单，当前处于完善和体验收口。薯条出锅变凉、卫生检查、砸凳维修、半暗示订单等仍只有旧计划条目，未见当前实现证据；今日名场面已有本地卡片，但微信分享仍待真机。 | [M4旧计划:2494](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2494)、[今日名场面实装:384](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:384)、[实际显示卡片:3034](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/scripts/StationView.ts:3034) |
| M5 内容扩产 | 当前50张手写卡，未达到2000–10000张目标；人设跨日记忆与剧情arc未见完成；200句对骂的人工审核不能视为通过。 | [M5目标:2532](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2532)、[内容缺口:53](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/playtest-2026-10-12.md:53) |
| M6 适配性能真机 | 主包分包与部分安全区/多画幅工作已有，当前微信设备帧率、声音、多指、长时稳定和新玩家完整日仍未验收。 | [最新边界:50](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:50)、[满场和完整日:59](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/loose-items-2026-10-15-verification.md:59)、[性能判据:2550](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2550) |
| M7 上架 | 未见定名、软著下证、体验版和正式审核/上线的完成证据。法规、平台流程等需另查当下官方来源，不能直接把8月旧说明当现行要求。 | [M7清单:2563](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2563)、[发布缺口:54](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/playtest-2026-10-12.md:54) |

### Inferences
- 推荐下一关口先完成“当前单件携带规则下的完整一日可玩性”：新手第一单、补货和洗盘节奏、满单信息可读性、升级前后差异，再扩张混乱源。
- 近程计划可以用验收顺序替代拍脑袋日期：①单件模拟与真人首日 ②中期并发及升级平衡 ③音效/UI/自由物品收口 ④内容特色与跨天关系 ⑤真机与发布准备。
- 月费、欠费、破产重整及对应奖励仍是设计提案，不应计入已实现经营循环。依据：[整合验收:82](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:82)。

### Gaps
- 未查见薯条变凉、卫生检查、退款分级、砸凳维修、半暗示规格落地的现行验证；只能列“旧计划候选/待产品裁决”，不自动批准实现。
- 当前生产环境、正式AppID/资质和审核后台状态不在仓库证据内。

## 本轮实际验证与历史验证的边界是什么？

### Takeaway
**本轮真正复跑**：`pnpm check` 成功，49文件/636测试全过，零引擎依赖和TypeScript检查通过；`pnpm scene`、`pnpm cam`、`pnpm layout` 均成功。本轮没有重建 Cocos、没有浏览器/微信/手机操作，包体与真实输入细节引用的均是10-15历史记录。

### Cited Findings
- 本轮 Node 读到 `v24.0.2`、pnpm `11.20.0`，项目已有 `node_modules/.bin/vitest.cmd` 与 `tsc.cmd`；依照项目现有命令执行，没有手动安装或升级依赖。命令依据：[package脚本:7](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/package.json:7)。本轮终端最终输出 `Test Files 49 passed (49); Tests 636 passed (636)`、进程退出0；Git检查未出现代码/配置/lockfile修改。
- 本轮scene判据确认无物理组件、无实时阴影、无Skybox贴图；671个合法节点_id，28条StationView引用可解析。scene命令依据：[package:23](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/package.json:23)；判据来源：[场景工具](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/tools/scenedump.ts)。
- 本轮cam扫描4900个可达位置，通过相机三轴与场景一致、人物完整可见判据；不表示所有工位同时在屏幕内。命令来源：[package:19](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/package.json:19)、[相机判据](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/tools/camcheck.ts)。
- 本轮layout检查：4900可达采样点、13工位，门洞和前台东端1.50m，默认曲线完成率92.2%、后期84.9%、idle偏差-7.0%，与10-15历史报告一致。其适用边界仍是现有模拟模型，不能算当前单件操作的难度验收。依据：[layout工具](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/tools/layoutcheck.ts)、[历史相同结果:23](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:23)、[sim保留第二配料:174](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/game/assets/logic/sim.ts:174)、[最新边界:50](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:50)。
- **历史10-15** 最新真实摇杆/按钮链覆盖：单件取料、第二件拒绝且库存不变、地面操作、正确交餐1/错误0、泡刷晾还盘，以及四画幅和浏览器无异常。薯条/饮料/箱子/灭火器的部分画面是诊断，不是完整营业取用。依据：[最新验收:18](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:18)。
- **历史10-15** 微信最终主包2,253,532字节（约2.15MiB），总包8,734,079字节；ZIP170文件逐个SHA-256对齐。只能写“历史构建体积通过”，本轮未读产物复量。依据：[最新包体验收:28](D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:28)。

### Inferences
- 可以向用户明确说明“代码健康检查本次通过”；不可以把“49/636通过”推导成“完整游戏好玩、手机不卡、可上架”。
- 当前最大的实证缺口是单件规则改变了跑腿吞吐量，而模拟/历史压力基准没有同步覆盖这一变化。优先补齐这项，比立即增加更多工位或惩罚更有判断价值。

### Gaps
- 本轮终端输出保留在会话记录，未额外创建大日志；所有命令均可按上述脚本复跑。未对历史屏幕录制重新做视觉验收。
