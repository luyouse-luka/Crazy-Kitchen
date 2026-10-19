import { describe, expect, it } from 'vitest'
import cards from '../pipeline/handwritten/cards.json'
import source from '../pipeline/handwritten/banter.json'
import { BANTER } from '../game/assets/logic/banterLines'
import { BanterDeck, banterBubble } from '../game/assets/logic/banter'
import { createRng, nextFloat } from '../game/assets/logic/rng'
import type { TaskId, TaskStatus } from '../game/assets/logic/tasks'

describe('contextual banter', () => {
  it('covers every card by ID, with independent short line pools', () => {
    expect(BANTER.cards.map(c => c.id)).toEqual(cards.map((c: { id: string }) => c.id))
    expect(new Set(BANTER.cards.map(c => c.id)).size).toBe(50)
    expect(BANTER).toEqual({ ...source, cards: cards.map(c => source.cards.find(b => b.id === c.id)) })
    for (const c of BANTER.cards) for (const pool of [c.back, c.complain, c.exit]) {
      expect(new Set(pool).size).toBe(pool.length)
      for (const text of pool) { expect(text.trim()).not.toBe(''); expect(text.length).toBeLessThanOrEqual(40) }
    }
  })

  it('matches identity and complaint reason over repeated shuffle boundaries', () => {
    const deck = new BanterDeck(918)
    for (let card = 0; card < 50; card++) {
      let lastComplaint = '', lastExit = ''
      for (let run = 0; run < 18; run++) {
        const reason = (['wrong', 'late', 'walkout', 'provoked'] as const)[run % 4]!
        const m = deck.match({ card, reason })
        const source = BANTER.cards[card]!
        expect(source.complain).toContain(m.complaint)
        expect(source.exit).toContain(m.exit)
        expect(source.back).toContain(m.customer[0])
        expect(source.back).toContain(m.customer[2])
        expect(BANTER.reason[reason]).toContain(m.customer[1])
        expect(new Set(m.customer).size).toBe(3)
        expect(new Set(m.chef).size).toBe(6)
        expect(m.complaint).not.toBe(lastComplaint)
        expect(m.exit).not.toBe(lastExit)
        lastComplaint = m.complaint; lastExit = m.exit
      }
    }
  })

  it('uses only the actual task status; missing status never invents a failure', () => {
    const deck = new BanterDeck(17)
    for (const id of Object.keys(BANTER.tasks) as TaskId[]) {
      for (const status of ['open', 'done', 'failed'] as TaskStatus[]) {
        const m = deck.match({ card: 30, reason: 'wrong', task: { id, status } })
        const pool = (BANTER.tasks[id] as Partial<Record<TaskStatus, readonly string[]>>)[status]
        expect(pool ?? BANTER.chef).toContain(m.chef[2])
        expect(new Set(m.chef).size).toBe(6)
      }
    }
  })

  it('is reproducible on its own seed and cannot advance the gameplay RNG', () => {
    const orders = createRng(44), control = createRng(44)
    const a = new BanterDeck(3), b = new BanterDeck(3)
    for (let i = 0; i < 20; i++) {
      expect(a.match({ card: i, reason: 'late' })).toEqual(b.match({ card: i, reason: 'late' }))
      expect(nextFloat(orders)).toBe(nextFloat(control))
    }
    expect(new BanterDeck(8).match({ card: 0, reason: 'late' })).not.toEqual(new BanterDeck(9).match({ card: 0, reason: 'late' }))
  })

  it('keeps a captured encounter stable and wraps longer bubbles without losing text', () => {
    const deck = new BanterDeck(4), first = deck.match({ card: 3, reason: 'wrong' })
    const snapshot = JSON.stringify(first)
    deck.match({ card: 3, reason: 'walkout' })
    expect(JSON.stringify(first)).toBe(snapshot)
    const line = '这破饭比加班还让人上火，嘴硬也救不了！'
    expect(banterBubble(line).split('\n').every(row => row.length <= 13)).toBe(true)
    expect(banterBubble(line).replace('\n', '')).toBe(line)
    expect(banterBubble('锅都没你嘴硬')).toBe('锅都没你嘴硬')
    const long = '上回吃得挺好！今天又来你这儿，饭搭子还想继续认真把这一顿吃明白。'
    expect(banterBubble(long).split('\n').every(row => Array.from(row).length <= 13)).toBe(true)
    expect(banterBubble(long).replace(/\n/g, '')).toBe(long)
    expect(banterBubble(banterBubble(long))).toBe(banterBubble(long))
  })
})
