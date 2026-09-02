/**
 * C2 两道校验。`pnpm validate`
 *
 * 两道缺一不可：
 *   ① customer.schema.json —— 拦词表外取值、超长台词、多余/缺失字段
 *   ② logic/order.ts 的 validateOrderSpec —— 拦 required 与 banned 相交
 *
 * 第二道不能省：JSON Schema 表达不了跨字段约束，相交的卡它照单全收，
 * 而那种卡进了包体，玩家会遇到一单永远做不出来。第二道跑的是**引擎真正会用的那份代码**，
 * 不是它的复制品 —— 复制品会漂。
 */
import Ajv from 'ajv/dist/2020'
import { validateOrderSpec } from '../game/assets/logic/order'
import type { OrderSpec } from '../game/assets/logic/types'
import schema from './customer.schema.json'

// @ts-expect-error Node builtin. Same stance as pipeline/gen.ts.
import * as nodeFs from 'node:fs'

const { existsSync, readFileSync, writeFileSync } = nodeFs as {
  existsSync(p: string): boolean
  readFileSync(p: string, enc: 'utf8'): string
  writeFileSync(p: string, data: string): void
}

declare const process: { argv: string[]; exit(code?: number): void }
declare const console: { log(...a: unknown[]): void; error(...a: unknown[]): void }

const CARDS_FILE = 'pipeline/out/cards.json'
const CLEAN_FILE = 'pipeline/out/cards.clean.json'

interface Card {
  id: string
  order: OrderSpec
  identity: string
  mood: string
  lines: Record<string, string>
  arc: unknown
}

function main(): void {
  const file = process.argv[2] ?? CARDS_FILE
  if (!existsSync(file)) {
    console.error(`找不到 ${file} —— 先 pnpm gen poll`)
    process.exit(1)
  }
  const cards = JSON.parse(readFileSync(file, 'utf8')) as Card[]

  const ajv = new Ajv({ allErrors: true, strict: false })
  const bySchema = ajv.compile(schema)

  const clean: Card[] = []
  const bad: { id: string; gate: 1 | 2 | 3; why: string }[] = []

  for (const card of cards) {
    if (!bySchema(card)) {
      const why = (bySchema.errors ?? []).map((e) => `${e.instancePath} ${e.message}`).join(' · ')
      bad.push({ id: card.id, gate: 1, why })
      continue
    }
    const errs = validateOrderSpec(card.order)
    if (errs.length > 0) {
      bad.push({ id: card.id, gate: 2, why: errs.join(' · ') })
      continue
    }
    // C2 阶段 arc 一律 null，长线剧情是后续阶段的事。非 null 说明 prompt 没压住。
    if (card.arc !== null) {
      bad.push({ id: card.id, gate: 3, why: 'arc 不是 null' })
      continue
    }
    clean.push(card)
  }

  console.log(`共 ${cards.length} 张 · 通过 ${clean.length} · 打回 ${bad.length}\n`)
  if (bad.length > 0) {
    for (const b of bad) console.log(`  [${b.id}] 第 ${b.gate} 道: ${b.why}`)
    console.log()
  }

  const ids = new Set(cards.map((c) => c.id))
  if (ids.size !== cards.length) console.log(`⚠ id 有重复：${cards.length - ids.size} 个\n`)

  writeFileSync(CLEAN_FILE, `${JSON.stringify(clean, null, 2)}\n`)
  console.log(`干净的 ${clean.length} 张 → ${CLEAN_FILE}`)
  console.log(`\n下一步是 C3：把它们**当文本读一遍**，按三条判据打分（见 pipeline/README.md）。`)
  console.log(`别跳过这一步 —— schema 全绿只说明格式对，说明不了好不好笑。`)
  if (bad.length > 0) process.exit(1)
}

main()
