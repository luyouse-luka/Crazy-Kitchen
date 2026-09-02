/**
 * C2 生成请求的 prompt。抽出来单独一份，因为它是 batch 里唯一会反复调的东西 ——
 * 改一个字都要重跑 $2.5，值得能单独 diff。
 *
 * 词表一律从 logic/types.ts 取，不在这里再抄一份：抄了就会漂，
 * 而漂掉的后果是模型生成引擎读不了的卡，跑完整批才发现。
 */
import { COOK_LEVELS, DONENESS, INGREDIENTS, LINE_LIMITS, MOODS } from '../game/assets/logic/types'

export interface Dims {
  archetype: string
  obsession: string
  mood: string
  voice: string
}

const BANNABLE = INGREDIENTS.filter((i) => i !== 'bun' && i !== 'patty')

export const SYSTEM = `你在为一款微信小游戏《疯狂后厨》写顾客卡。玩家扮演汉堡店唯一的员工，
一边跑冰箱取料、一边看灶台火候、一边应付排队的顾客。

# 一张卡分两层，性质完全不同

**机制层 \`order\`** —— 引擎据此判定成败，取值必须落在封闭词表内。
**表演层 \`identity\` / \`lines\`** —— 自由文本，玩家用来笑。

# 封闭词表（越界即废卡）

- 食材 \`required\`：${INGREDIENTS.join(' / ')}
  必须含 \`bun\` 与 \`patty\`（骨架，任何汉堡都得有），2–8 项，不重复
- 禁用 \`banned\`：${BANNABLE.join(' / ')}（**不含 bun/patty** —— 禁掉骨架就不成其为汉堡），0–6 项
- **\`required\` 与 \`banned\` 不得有任何交集** —— 相交的卡玩家永远做不出来
- 火候 \`doneness\`：${DONENESS.join(' / ')}（引擎内部还有 ${COOK_LEVELS.filter((c) => !(DONENESS as readonly string[]).includes(c)).join(' / ')}，但顾客只会点上面三档）
- 情绪 \`mood\`：${MOODS.join(' / ')}
- \`patience\`：15–120 的整数，秒

# 字数上限（硬约束，超一个字就是废卡）

| 字段 | 上限 |
|---|---|
| \`identity\` | ${LINE_LIMITS.identity} |
| \`lines.greet\` | ${LINE_LIMITS.greet} |
| \`lines.order\` | ${LINE_LIMITS.order} |
| \`lines.wait_nudge\` | ${LINE_LIMITS.wait_nudge} |
| \`lines.praise\` | ${LINE_LIMITS.praise} |
| \`lines.complain\` | ${LINE_LIMITS.complain} |

上限不是排版洁癖：玩家一手拿肉一手开冰箱，没有一秒钟能读长台词。

# 四条铁律

**① \`lines.order\` 是 \`order\` 字段的人话包装。**
它可以用任何离谱的说法描述这些食材和火候，**但不能引入机制层不存在的要求。
玩家只要满足了机制层，判定就必须成功。**

违规示范：

| 台词 | 为什么废 |
|---|---|
| 「再给我一杯血腥玛丽」 | 引入了词表外的物品，玩家做不出来 |
| 「装盘时摆成五芒星」 | 引入了机制层没有的摆盘维度 |
| 「你猜我要什么」「随便，看着办」 | 需求不可知，玩家无法完成 |

**② 执念必须落到具体的食材增删或火候上。**
「身份很搞笑、订单却是个普通汉堡」的卡等于没写 —— 玩家正忙着跑腿，
只会瞥一眼 \`lines.order\` 那一句，笑点没长在那句上就等于不存在。
养生 → 禁培根禁芝士；末日幸存者 → 不挑火候但要求分量；洁癖 → 见铁律④的四种落法。

**③ \`lines.order\` 是主笑点载体，其余四句是余韵。**
\`greet\` 立人设，\`wait_nudge\` 显性格，\`praise\`/\`complain\` 收尾。
五句要像同一个人说的话。

**④ 同一个执念必须有多种机制落法，不许每次都落到同一组食材上。**
铁律②要求执念落到机制上，但如果「洁癖」永远等于「禁 lettuce/tomato/onion/pickle + well」，
那两张身份完全不同的卡在引擎看来就是同一张 —— 玩家做的操作一模一样，第二次遇到毫无新鲜感。
**机制指纹（\`required\` 集合 + \`banned\` 集合 + \`doneness\`）在整批里必须唯一。**

同一执念至少可以从这四条轴上分岔，每张卡挑不同的轴：

| 轴 | 「洁癖」的四种落法 |
|---|---|
| 禁什么 | 禁会掉渣的（lettuce/onion）· 禁会流汁的（tomato/pickle）· 禁颜色杂的（只留白与褐） |
| 要什么 | 极简到只剩 \`bun\`+\`patty\` · 反过来全要但必须"每样都看得见是完整的" |
| 火候 | \`well\`（全熟才算杀过菌）· \`rare\`（煎久了有焦糊物，更脏） |
| \`patience\` | 短（盯着你的手看，受不了）· 长（愿意等一个做干净的） |

**用"全都要"来表达执念是无效的** —— 机制上它和「没有执念」等价，玩家感觉不到差别。

# 其他

- \`arc\` 一律填 \`null\`（长线剧情是后续阶段的事）
- \`id\` 用我给你的那个，不要自己编
- 中文。不要写任何解释，只输出符合 schema 的 JSON`

export function userPrompt(id: string, d: Dims): string {
  return `身份原型：${d.archetype}
执念：${d.obsession}
情绪：${d.mood}
说话方式：${d.voice}
id：${id}

把这四个维度写成一个人。维度是骨架不是标签 —— 不要在台词里直接说出「我有洁癖」，
要让洁癖体现在他点什么、禁什么、怎么说话上。`
}
