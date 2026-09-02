/**
 * C2 顾客卡生成。`pnpm gen sample [n]` · `pnpm gen submit [n]` · `pnpm gen poll`
 *
 * 三档是刻意的：sample 花几分钱同步跑几张看质量，submit 才提交整批走 Batch（5 折），
 * poll 拉结果。prompt 改一个字就要重跑整批，所以先 sample 再 submit。
 *
 * 维度组合由 logic/rng.ts 抽，不是让模型「生成 200 个有趣的顾客」——
 * 那会收敛到均值，读到第 20 张就腻（docs/ai-customer-v1.md §4）。
 * 种子写进输出，同一个种子抽出的是同一批组合。
 *
 * 不是游戏代码，不进包体，所以允许用 Node 的东西（局部 declare，同 tools/sim-cli.ts）。
 */
import Anthropic from '@anthropic-ai/sdk'
import { createRng, pick } from '../game/assets/logic/rng'
import type { Rng } from '../game/assets/logic/rng'
import dimensions from './dimensions.json'
import schema from './customer.schema.json'
import { SYSTEM, userPrompt } from './prompt'
import type { Dims } from './prompt'

// @ts-expect-error Node builtin. Typed locally instead of installing @types/node,
// which would also let logic/ reach for fs/process. Same stance as tools/sim-cli.ts.
import * as nodeFs from 'node:fs'

const { existsSync, mkdirSync, readFileSync, writeFileSync } = nodeFs as {
  existsSync(p: string): boolean
  mkdirSync(p: string, o: { recursive: true }): void
  readFileSync(p: string, enc: 'utf8'): string
  writeFileSync(p: string, data: string): void
}

declare const process: { argv: string[]; exit(code?: number): void }
declare const console: { log(...a: unknown[]): void; error(...a: unknown[]): void }

const MODEL = 'claude-opus-5'
const OUT = 'pipeline/out'
const BATCH_FILE = `${OUT}/batch.json`
const CARDS_FILE = `${OUT}/cards.json`
const DIMS_FILE = `${OUT}/dims.json`

/** 抽维度用的种子。换种子 = 换一批组合；同一种子永远抽出同一批。 */
const SEED = 20260902
const DEFAULT_N = 200

/** $/1M token。Batch 是 5 折，下面的估算已经乘过。 */
const PRICE_IN = 5.0
const PRICE_OUT = 25.0
const BATCH_DISCOUNT = 0.5

const client = new Anthropic()

// ─────────────────────────── 维度 ───────────────────────────

interface Picked extends Dims {
  id: string
}

/**
 * 抽 n 组互不相同的四维组合。池子 24×22×8×21 ≈ 8.9 万，
 * 抽 200 个撞车概率极低，但还是去重 —— 重复的卡是纯浪费。
 */
function pickDims(n: number): Picked[] {
  const rng: Rng = createRng(SEED)
  const seen = new Set<string>()
  const out: Picked[] = []
  let guard = 0
  while (out.length < n && guard++ < n * 100) {
    const d: Dims = {
      archetype: pick(rng, dimensions.archetype),
      obsession: pick(rng, dimensions.obsession),
      mood: pick(rng, dimensions.mood),
      voice: pick(rng, dimensions.voice),
    }
    const key = `${d.archetype}|${d.obsession}|${d.mood}|${d.voice}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...d, id: `c_${String(out.length + 1).padStart(4, '0')}` })
  }
  return out
}

// ─────────────────────────── 请求 ───────────────────────────

/** system 对 200 个请求完全相同 —— 打 cache_control，整批只算一次写入。 */
function params(p: Picked) {
  return {
    model: MODEL,
    max_tokens: 4000,
    output_config: {
      effort: 'medium' as const,
      format: { type: 'json_schema' as const, schema: schema as Record<string, unknown> },
    },
    system: [{ type: 'text' as const, text: SYSTEM, cache_control: { type: 'ephemeral' as const } }],
    messages: [{ role: 'user' as const, content: userPrompt(p.id, p) }],
  }
}

interface Usage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

function cost(u: Usage, batched: boolean): number {
  const cached = u.cache_read_input_tokens ?? 0
  const written = u.cache_creation_input_tokens ?? 0
  const raw =
    ((u.input_tokens + written * 1.25 + cached * 0.1) * PRICE_IN + u.output_tokens * PRICE_OUT) / 1e6
  return batched ? raw * BATCH_DISCOUNT : raw
}

// ─────────────────────────── 命令 ───────────────────────────

function save(path: string, data: unknown): void {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

async function sample(n: number): Promise<void> {
  const picks = pickDims(n)
  console.log(`试跑 ${n} 张（同步，不走 Batch，无 5 折）\n`)
  let spent = 0
  for (const p of picks) {
    const r = await client.messages.parse(params(p))
    spent += cost(r.usage as Usage, false)
    console.log(`── ${p.id}  ${p.archetype} / ${p.obsession} / ${p.mood} / ${p.voice}`)
    console.log(JSON.stringify(r.parsed_output, null, 2))
    console.log()
  }
  const per = spent / n
  console.log(`本次花费 $${spent.toFixed(4)}（每张 $${per.toFixed(4)}）`)
  console.log(`→ ${DEFAULT_N} 张走 Batch 估算 $${(per * DEFAULT_N * BATCH_DISCOUNT).toFixed(2)}`)
  console.log(`  （估算偏高：整批共用一份 system 缓存，实际更低）`)
}

async function submit(n: number): Promise<void> {
  const picks = pickDims(n)
  const batch = await client.messages.batches.create({
    requests: picks.map((p) => ({ custom_id: p.id, params: params(p) })),
  })
  save(DIMS_FILE, { seed: SEED, picks })
  save(BATCH_FILE, { id: batch.id, model: MODEL, n, created_at: batch.created_at })
  console.log(`已提交 ${n} 张 · batch ${batch.id}`)
  console.log(`状态 ${batch.processing_status}\n`)
  console.log(`跑完再来：pnpm gen poll`)
}

async function poll(): Promise<void> {
  if (!existsSync(BATCH_FILE)) {
    console.error(`没有 ${BATCH_FILE} —— 先 pnpm gen submit`)
    process.exit(1)
  }
  const { id } = JSON.parse(readFileSync(BATCH_FILE, 'utf8')) as { id: string }
  const batch = await client.messages.batches.retrieve(id)
  const c = batch.request_counts
  console.log(`batch ${id} · ${batch.processing_status}`)
  console.log(`  成功 ${c.succeeded} · 出错 ${c.errored} · 处理中 ${c.processing} · 取消 ${c.canceled} · 过期 ${c.expired}`)
  if (batch.processing_status !== 'ended') {
    console.log(`\n还没跑完。Batch 通常 1 小时内，最长 24 小时。`)
    return
  }

  const cards: unknown[] = []
  const failed: { id: string; why: string }[] = []
  let spent = 0
  // 结果顺序不保证，一律按 custom_id 取，不按位置
  for await (const r of await client.messages.batches.results(id)) {
    if (r.result.type !== 'succeeded') {
      failed.push({ id: r.custom_id, why: r.result.type })
      continue
    }
    const msg = r.result.message
    spent += cost(msg.usage as Usage, true)
    const text = msg.content.find((b) => b.type === 'text')
    if (text === undefined || text.type !== 'text') {
      failed.push({ id: r.custom_id, why: 'no text block' })
      continue
    }
    try {
      const card = JSON.parse(text.text) as Record<string, unknown>
      card.id = r.custom_id // 模型编的 id 一律覆盖，唯一性由我们保证
      cards.push(card)
    } catch {
      failed.push({ id: r.custom_id, why: 'not json' })
    }
  }
  cards.sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)))
  save(CARDS_FILE, cards)
  console.log(`\n落盘 ${cards.length} 张 → ${CARDS_FILE}`)
  if (failed.length > 0) console.log(`失败 ${failed.length} 张：`, failed)
  console.log(`实际花费 $${spent.toFixed(2)}`)
  console.log(`\n下一步：pnpm validate`)
}

/**
 * 只打印抽到的组合并落盘，不调 API。花钱之前先看一眼维度合不合理。
 * 落盘是为了手写那条路（无 key 时）用的是同一批组合 —— 两条路可比。
 */
function dims(n: number): void {
  const picks = pickDims(n)
  for (const p of picks) {
    console.log(`${p.id}  ${p.archetype} / ${p.obsession} / ${p.mood} / ${p.voice}`)
  }
  save(DIMS_FILE, { seed: SEED, picks })
  console.log(`\n${picks.length} 组 → ${DIMS_FILE}`)
}

async function main(): Promise<void> {
  const cmd = process.argv[2]
  const n = Number(process.argv[3] ?? '') || undefined
  if (cmd === 'dims') dims(n ?? 20)
  else if (cmd === 'sample') await sample(n ?? 3)
  else if (cmd === 'submit') await submit(n ?? DEFAULT_N)
  else if (cmd === 'poll') await poll()
  else {
    console.log(`pnpm gen dims [n]     只看抽到的维度组合，不调 API、不花钱（默认 20）`)
    console.log(`pnpm gen sample [n]   同步跑 n 张（默认 3）看质量，不走 Batch`)
    console.log(`pnpm gen submit [n]   提交整批走 Batch 5 折（默认 ${DEFAULT_N}）`)
    console.log(`pnpm gen poll         查进度；跑完则拉结果落盘`)
    process.exit(1)
  }
}

void main()
