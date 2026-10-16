# 游戏发展方向与分阶段玩法构建

## 1. 当前应该强化什么方向？

### Takeaway
建议把产品主张收敛为「一个人经营会出故事的混乱厨房」：手上操作创造紧张，顾客对操作结果作出有个性的反应，打烊后的成长给下一天一个明确目标。下一步先验证当前单件操作的真实体验，再补强顾客与事故、成长的联系；月费和更多菜系排在后面。此为研究建议，未授权修改游戏。

### Cited Findings
- 已定底座是单人、横屏、固定斜 45° 轻 3D、1280×720，Cocos Creator 3.8；核心是顾客整活与厨房失控，参考作只是工具箱。—— [GDD.md:12](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/GDD.md:12>)、[GDD.md:405](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/GDD.md:405>)、[ROADMAP.md:1766](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:1766>)
- 顾客的机制要求必须是引擎能判定的封闭词表，离谱文本负责表演；V1 顾客故事采用预写 arc，运行时零 AI 调用。—— [GDD.md:56](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/GDD.md:56>)、[ai-customer-v1.md:254](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/ai-customer-v1.md:254>)
- 营业前适合备料、预告；营业中承担操作混乱；打烊后承载升级、剧情。原设计已明确不要把长阅读挤进营业中。新混乱必须让玩家能选择先做 A 还是 B，且与现有机制耦合。—— [GDD.md:250](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/GDD.md:250>)、[ROADMAP.md:1828](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:1828>)、[ROADMAP.md:1860](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:1860>)
- 当前每次只拿一件；食材、带盘肉饼、汉堡可落地与投掷，箱子、叠盘、配餐、灭火器仍未开放自由落地。旧文中的「食材投掷砍掉」「双手携带」不能覆盖最新实现。—— [player-feedback 验收:3](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:3>)、[player-feedback 验收:48](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:48>)
- 新布局、引导、熟度视觉、按钮图标、自由物品已经有机器及浏览器输入证据，但首次玩家能否独立完成第一单、手机多指与声音、帧率和连续试玩仍待验证。—— [整合验收:11](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:11>)、[整合验收:83](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:83>)、[player-feedback 验收:50](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:50>)
- 用户已要求去掉实时熟度文字和右侧按钮文字；当前只保留肉色/烤痕、订单要求和首次说明。微软 XAG 103 建议重要信息采用多种感官通道，且不要只靠颜色；它是可借鉴的设计实践，不是本项目平台强制要求。—— [整合验收:15](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:15>)、[player-feedback 验收:20](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:20>)、[Microsoft XAG 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103)

### Inferences
- 核心闭环建议：营业前选布局/升级并看今日预告 → 营业中在取料、炉火、盘子和堂食/外卖之间排优先级 → 事故被顾客目击并生成有性格的评价 → 结算解释损失及今日故事 → 玩家选一个明天要改善的瓶颈 → 再开一天。每个新增功能都要明确加强其中哪一环。
- 当前功能数量已不稀少；最应防止的是「代码有系统，玩家感受不到联系」。与其立刻增加披萨、员工、扩店、实时聊天，优先让现有洗盘、补货、熟度和顾客反应形成可理解、可复盘的链条。
- 手感改进应服务决策：摇杆、朝向、目标提示应让玩家按得准，仍由玩家选择先救哪件事；不额外增加自动选最优订单或自动烹饪来替玩家做核心选择。
- 熟度可读性建议保留已定无实时文字方案，试验肉色之外的烤痕/蒸汽/翻面姿态和短音效；图标说明放首次引导或可重看的帮助。不开声音也能识别关键状态，避免强迫玩家听音。
- 新安装的游戏技能应服务当前 Cocos 3.8.8 与微信主线：采用其中的玩法、反馈和 UX 原则，代码/API 仍按现工程核对。Higgsfield 仅作为离线素材或效果概念管线的候选，不据此重建 Web 游戏、不切换引擎。最近实际构建版本见 [整合验收:24](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:24>)。
- 月费能增加长期目标，但目前同时引入会混淆「操作学不会」「收入不够」「账单看不懂」三种失败。应在当前操作和普通收入可测之后引入。

### Gaps
- 未看到能证明普通手机玩家已稳定掌握单件操作的真人数据，也未看到足以估算留存或市场规模的数据。不能把构建成功、自动化通过或卡片数量报成「已经好玩/能留住人」。
- 本轮不是全量代码审计；AI 顾客内容规模、故事调度和分享卡的实际接线状态，需由项目现状核查补足，不把旧 GDD 目标当成已实现功能。

## 2. 玩法优化按什么顺序构建？

### Takeaway
建议采用 P0 真实操作与难度 → P1 顾客故事和复盘 → P2 有收益的经营成长 → P3 月度经营与内容扩展的顺序。每阶段按证据闸门推进；下列新增样本量和通过条件是本次提议，未形成项目已批准指标。

### Cited Findings
- 最近正式单件模式明确可能改变往返节奏，旧双手模拟通过不能当单件模式难度已标定。—— [player-feedback 验收:50](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:50>)
- 当前前五天采用 4/6/8/10/10 位，前 3 天无外卖；第 5 天是 30s 间隔。独立复核第 6 天仅 23/32 过关属于学习延迟假设下的脚本样本，不是真人通过率。—— [整合验收:38](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:38>)、[整合验收:49](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:49>)
- 缩短前三天客数也减少赚钱机会，首单理解成本并不会自动降低，设备可负担时机须另查。—— [短教学提案:39](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/early-difficulty-proposal-2026-10-15.md:39>)、[短教学提案:59](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/early-difficulty-proposal-2026-10-15.md:59>)
- 顾客目击事故、半暗示订单、今日名场面在既定方向内；压力导致变慢/失误的死亡螺旋明确不做。—— [GDD.md:326](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/GDD.md:326>)、[GDD.md:336](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/GDD.md:336>)、[GDD.md:347](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/GDD.md:347>)
- 自定义布局已实现，要求安全可操作，不要求每种摆法的完成率与默认等价，布局效率收益是玩家选择。—— [整合验收:78](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:78>)
- 月费、欠款和奖励仍只是待标定设计，经营日期不能借用解锁关卡 day；推荐重整保留资产、禁止降低移速和制作能力。—— [月度设计:3](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/monthly-economy-design-2026-10-14.md:3>)、[月度设计:7](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/monthly-economy-design-2026-10-14.md:7>)、[月度设计:61](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/monthly-economy-design-2026-10-14.md:61>)

### Inferences

| 优先级 | 目标与玩法闭环 | 设计取舍 | 建议验收标准（待执行） |
| --- | --- | --- | --- |
| P0：当前模式玩得懂、按得准 | 首单引导 → 单件取料 → 判熟 → 组装交付 → 洗盘/补货 → 第二、三天轮转 | 先区分操作摩擦与策略压力；延续 4/6/8 教学，不凭旧模拟加客；先不扩菜谱 | 先约 5 名未接触游戏的玩家作小样本观察：全部能独立取料/交出首单，完成后能说出一次失败原因；出现一致卡点即修并另测。人数是可用性起点，不代表统计显著或市场通过率。记录首单用时、误按/错目标、火候判断、三天完成时长，观察第 5→6 天突跳。 |
| P0：反馈有质感 | 接触目标 → 按键接受/拒绝反馈 → 手部/物品/音效同步 → 交付评价 | 可读性优先于额外屏幕震动和复杂动作；手持不遮订单，表现不更改判定 | 真机完成取/放/投/拾、烹饪、洗盘、交餐；每个成功/失败操作均有可区分反馈，玩家能解释为何不能拿/为何拒收；静音仍能完成，右手操作时不被拇指遮住关键状态。 |
| P1：顾客成为记忆点 | 清楚的奇葩需求 → 操作选择 → 顾客目击与回应 → 打烊后回顾 | 优先用已有事故触发性格回应，营业中短句、长故事放前后；先小量好卡、预写熟客，不直接量产万卡 | 所有订单规格可判定，台词与评分原因一致；连续体验中不重复刷同一句；玩家在无提示复述时能说出至少一个顾客故事及其与自己操作的关系。沿用原 200 卡内部筛选指标，但分别报告作者挑选和真实玩家反馈。 |
| P1：失败可以复盘 | 一次失误 → 明确损失 → 可恢复选择 → 下一局验证修正 | 每次混乱都能回答「我可以先做什么」；不用无预告剥夺和越输越慢 | 为缺盘、错熟度、糊锅、错单、外卖超时逐项制作原因/后果/恢复路径表；玩家能在结算指认最大瓶颈，下一局可尝试不同策略；不得将故意放弃某单一律视作操作失败。 |
| P2：升级与布局形成成长 | 看见瓶颈 → 存钱/改布局 → 明天执行 → 看见改善 | 承接现有商店和布局，不再立新货币；保留已购收益和现有设备客流规则，未来调整须显式验证。别把所有升级提升立刻完全抵消到玩家无感 | 能解释每项升级帮了什么；同一天/同种子/同熟练度对照能观测对应收益；记录首个可选升级可负担天数、购买后钱包与任务收入。布局存取、朝向、可达和全部已购工位保持一致；自选低效布局不保证过关。 |
| P3：月度账本与可恢复经营 | 日收支 → 可预告账单 → 预算/投资选择 → 偿债或重整 → 恢复 | 先影子账单只展示，实测收入后才定费率；保留设备、布局和已学能力，不清档、不让低水平玩家更难挣钱 | 正常营业可覆盖必要费用而不要求连续三星；材料计量、跨月、失败/重玩/休息、旧档迁移、重复结算/支付可复算；零现金有基础材料和可执行恢复路径。此处不能沿用设计示例金额作为已标定值。 |
| P3：受控扩展内容 | 现有冲突稳定 → 加一类订单/事件 → 耦合既有资源 → 检验是否更有趣 | 菜谱、员工、连锁、实时 AI 都须重新证明收益；熟客预写 arc 优先。员工若探索，先考虑外围协助，避免替玩家自动做核心菜链 | 每新增内容有明确解锁提示、至少一项现有资源冲突和恢复选择；复跑旧天数随机序列与守恒，真机再验满场负担；没有独特决策就不进正式循环。 |

- “今日名场面”建议先做本地结算回顾：取实际事故事件与实际顾客回应，不虚构玩家没做过的故事；是否导出分享图、调用微信分享由后续明确功能范围决定。
- 熟客首个试验可以只做一条短 arc，通过既有卡片与解锁日机制检验记忆，不把全量动态记忆/实时模型当 V1 前置。
- 分阶段优先级不是日历工期承诺；P0 未过就不靠加内容补救，内容素材生产可独立准备，但不得先据此宣布主循环通过。

### Gaps
- 真人操作时间、误触、首单独立完成、静音辨识、首个升级购买时间、普通净收益分布都尚缺实测；本次不编造目标达成率或估算营收。
- 现有机器指标需要按最新单件模式更新输入模型，并与真人观察并排看；不能只增添测试数量就宣布手感变好。

## 3. 下一轮如何验证，以及仍需决定什么？

### Takeaway
下一轮最有价值的交付是「当前正式模式的手机试玩记录＋分原因的数据」，而不是再列一串功能。真正未定的关键产品边界是每个营业日的目标时长：旧文希望 3–4 分钟，现实现按客数打烊，脚本较后天数出现约 6 分钟；建议默认保留客数制，以真实单件试玩决定是否另行缩短工作量。

### Cited Findings
- GDD 最早写一天一关、3–4 分钟，后来 ROADMAP 明确当前按接待完 N 位打烊，非硬限时。—— [GDD.md:372](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/GDD.md:372>)、[ROADMAP.md:2513](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2513>)
- 历史学习延迟模拟第 4/5/6 天班长约 371/360/364s，属于旧快照假设；后续新布局首日样本约 181/179s，且当前单件模式又改变了前提。—— [短教学提案:30](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/early-difficulty-proposal-2026-10-15.md:30>)、[整合验收:51](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/integrated-kitchen-2026-10-15-verification.md:51>)、[player-feedback 验收:50](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/player-feedback-2026-10-15-verification.md:50>)
- 原 M3 已规定比较模拟与真人差值：真人在更少并发就崩，可能是走位、按键、看不清的摩擦，优先修 UI/操作；原真机预算列有中低端安卓 ≥28fps、旧 iPhone 内存、长时间帧尖刺和首屏 3000ms，均是项目验收目标而非本轮实测。—— [ROADMAP.md:2469](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2469>)、[ROADMAP.md:2552](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/ROADMAP.md:2552>)
- 原 AI 卡内部判据是 200 张作者自读的想截图比例 ≥15%、重复感开始点 ≥50 张、机制耦合率 ≥40%。这些不是微信分享转化率、留存率或玩家真实截图率。—— [ai-customer-v1.md:281](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/ai-customer-v1.md:281>)
- 月费必须先量测每班真实收入、材料消耗、设备使用、休息频率、普通/重整净收益，先显示账单不扣费。—— [月度设计:125](</D:/codex-workspace-sync/vultr-projects/server-home-20260930/project/kitchen-chaos/docs/monthly-economy-design-2026-10-14.md:125>)

### Inferences
- 建议下一轮记录表固定字段：构建提交、设备/微信版本、玩家是否新手、天数、布局/升级、首单时间、总班长、顾客总数/正确/超时/错单、误触或错目标次数、缺盘/缺货停滞、看熟度出错、记住哪位顾客、是否自愿开始下一天、失败后想改什么。前后版本用同类玩家及相同操作规则比较。
- 明确区分四种证据：纯逻辑测试证明规则；固定种子模拟证明特定假设下的平衡；浏览器真实输入证明链路；微信真机与人类观察证明触感、可读性、性能。报告不能跨层替代。
- 先做新人三天与已学会玩家第 4–6 天两个小观察组，避免熟练开发者掩盖教学问题，也避免新人尚未学会就用第六天判死刑。无需在本次就加正式埋点服务或采集账号信息，人工记录已能开始。
- 每次观察一个主要假设。例如「单件往返是否让首单过长」「图标是否让清理难发现」「玩家是否因看不懂熟度而错单」。一次同时改客流、移速、炉火、教学和金币会失去归因。
- 后续有数据再考虑的唯一关键产品边界是后期班长：后期也必须控制在 3–4 分钟，还是允许按客数完成一班更长。当前资料已足够推进，推荐默认继续客数制、不新增硬倒计时；先量测真实班长，再决定是否减少部分后期客数，联动任务与收入。不要求用户此刻作答，也不在本轮改规则。
- 不重开已定的引擎、单人、横屏和固定视角；不将新物理引擎、多人联机、员工全自动做菜、营业中长对话或受挫后降移速列为近期方向。

### Gaps
- 没有本轮真机试验与真人访谈，无法作上线日期或留存提升承诺。
- 本次只有该研究文件新增；未修改游戏代码、存档、费率、难度、ROADMAP 或任何远端。文件清单：`research_notes/疯狂后厨 进度与玩法规划/direction.md`。
