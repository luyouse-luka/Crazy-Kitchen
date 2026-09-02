/**
 * 顾客卡重复度探针。`pnpm dup [cards.json] [段长]`
 *
 * 判据「重复感衰减点 ≥ 50 张」原本纯主观 —— 这个脚本给它一个客观的代理指标：
 * 按段统计字级 n-gram 与机制组合的重复率，看它随张数怎么走。
 *
 * ⚠ **它测的是「有没有在重复自己」，不是「好不好笑」。** 两者不能互相替代：
 * 重复率低的卡可能张张平淡，重复率高的卡也可能每张都好笑。
 * 这个数只用来回答一个问题 —— 写到第几段开始明显收敛。人读那一关不能省。
 *
 * 中文没分词，一律用字级 2-gram/3-gram：对中文的句式重复足够敏感，且零依赖。
 */

// @ts-expect-error Node builtin. Same stance as pipeline/gen.ts.
import * as nodeFs from 'node:fs'

const { existsSync, readFileSync } = nodeFs as {
  existsSync(p: string): boolean
  readFileSync(p: string, enc: 'utf8'): string
}

declare const process: { argv: string[]; exit(code?: number): void }
declare const console: { log(...a: unknown[]): void; error(...a: unknown[]): void }

interface Card {
  id: string
  order: { required: string[]; banned: string[]; doneness: string; patience: number }
  identity: string
  mood: string
  lines: Record<string, string>
}

/** 只取字，丢掉标点与空白 —— 标点的重复没有信息量。 */
function chars(s: string): string[] {
  return [...s].filter((c) => /[一-鿿＀-￯a-zA-Z0-9]/.test(c) && !/[，。！？：、；]/.test(c))
}

function ngrams(text: string, n: number): string[] {
  const cs = chars(text)
  const out: string[] = []
  for (let i = 0; i + n <= cs.length; i++) out.push(cs.slice(i, i + n).join(''))
  return out
}

/** 不重复的 n-gram 占比。1.0 = 全新，越低越自我重复。 */
function distinctRatio(texts: string[], n: number): number {
  const all: string[] = []
  for (const t of texts) all.push(...ngrams(t, n))
  if (all.length === 0) return 1
  return new Set(all).size / all.length
}

function topRepeats(texts: string[], n: number, k: number): [string, number][] {
  const count = new Map<string, number>()
  for (const t of texts) for (const g of ngrams(t, n)) count.set(g, (count.get(g) ?? 0) + 1)
  return [...count.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`

function main(): void {
  const file = process.argv[2] ?? 'pipeline/handwritten/cards.json'
  const seg = Number(process.argv[3] ?? '') || 25
  if (!existsSync(file)) {
    console.error(`找不到 ${file}`)
    process.exit(1)
  }
  const cards = JSON.parse(readFileSync(file, 'utf8')) as Card[]

  console.log(`\n顾客卡重复度  ${file}  共 ${cards.length} 张 · 每段 ${seg} 张\n`)
  console.log(`  段          order 3-gram   全文 2-gram   机制组合   情绪分布`)
  console.log(`  ${'─'.repeat(62)}`)

  for (let i = 0; i < cards.length; i += seg) {
    const batch = cards.slice(i, i + seg)
    const orders = batch.map((c) => c.lines.order ?? '')
    const alls = batch.flatMap((c) => Object.values(c.lines).concat(c.identity))
    const specs = new Set(
      batch.map((c) => `${c.order.required.slice().sort().join()}|${c.order.banned.slice().sort().join()}|${c.order.doneness}`),
    )
    const moods = new Set(batch.map((c) => c.mood))
    const label = `${i + 1}–${Math.min(i + seg, cards.length)}`.padEnd(10)
    console.log(
      `  ${label}  ${pct(distinctRatio(orders, 3)).padStart(11)}   ${pct(distinctRatio(alls, 2)).padStart(11)}   ${`${specs.size}/${batch.length}`.padStart(8)}   ${`${moods.size}/8`.padStart(8)}`,
    )
  }

  console.log(`\n  全量：order 3-gram ${pct(distinctRatio(cards.map((c) => c.lines.order ?? ''), 3))} · ` +
    `机制组合 ${new Set(cards.map((c) => `${c.order.required.slice().sort().join()}|${c.order.banned.slice().sort().join()}|${c.order.doneness}`)).size}/${cards.length} 唯一`)

  const rep = topRepeats(cards.map((c) => c.lines.order ?? ''), 3, 8)
  if (rep.length > 0) {
    console.log(`\n  order 里重复出现的三字片段：`)
    for (const [g, c] of rep) console.log(`    ${String(c).padStart(3)}×  ${g}`)
  }

  console.log(`\n  ⚠ 这几个数只说明「有没有在重复自己」，说明不了好不好笑。人读那一关不能省。\n`)
}

main()
