import { describe, expect, it } from 'vitest'
import { addReview, averageStars, createReviewLog, serveReview } from '../game/assets/logic/reviews'
import { CARD_LINES } from '../game/assets/scripts/cardLines'
import cards from '../pipeline/handwritten/cards.json'

describe('serveReview', () => {
  it('对且快 5 星，慢了递减；超时 2 星；上错 1 星', () => {
    expect([0.9, 0.5, 0.3, 0.1].map((k) => serveReview(true, false, k).stars)).toEqual([5, 4, 4, 3])
    expect(serveReview(true, true, 0)).toEqual({ kind: 'complain', stars: 2 })
    expect(serveReview(false, false, 1)).toEqual({ kind: 'complain', stars: 1 })
  })
})

describe('ReviewLog', () => {
  it('超出上限丢最旧的', () => {
    const log = createReviewLog(2)
    for (let i = 0; i < 3; i++) addReview(log, { customerId: i, kind: 'praise', stars: 5, t: i })
    expect(log.items.map((r) => r.customerId)).toEqual([1, 2])
  })

  it('averageStars 不算吐槽，空表为 0', () => {
    const log = createReviewLog()
    expect(averageStars(log)).toBe(0)
    addReview(log, { customerId: 1, kind: 'praise', stars: 5, t: 0 })
    addReview(log, { customerId: 2, kind: 'witness', stars: 0, t: 0 })
    addReview(log, { customerId: 3, kind: 'reject', stars: 3, t: 0 })
    expect(averageStars(log)).toBe(4)
  })
})

describe('cardLines.ts 与手写卡同步', () => {
  it('改了 cards.json 没跑 pnpm cards:export 就红', () => {
    expect(CARD_LINES.length).toBe(cards.length)
    cards.forEach((c, i) => {
      expect(CARD_LINES[i]!.identity).toBe(c.identity)
      expect(CARD_LINES[i]!.praise).toBe(c.lines.praise)
      expect(CARD_LINES[i]!.complain).toBe(c.lines.complain)
    })
  })
})
