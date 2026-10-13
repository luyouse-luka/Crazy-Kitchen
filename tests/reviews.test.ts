import { describe, expect, it } from 'vitest'
import { addReview, averageStars, createReviewLog, customerCardIndex, serveReview } from '../game/assets/logic/reviews'
import { argueTap, ARGUE_TAPS, createVent, rantStars, startRant, throwAt, vent } from '../game/assets/logic/vent'
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
  it.each(['argue', 'throw'])('1 星顾客被 %s 后仍计入评分，不会让店铺平均分上涨', (action) => {
    const st = createVent()
    startRant(st, 2, 1)
    if (action === 'throw') throwAt(st)
    else {
      vent(st, 'register')
      for (let i = 0; i < ARGUE_TAPS; i++) argueTap(st)
    }
    const log = createReviewLog()
    addReview(log, { customerId: 1, kind: 'praise', stars: 5, t: 0 })
    addReview(log, { customerId: 2, kind: 'complain', stars: rantStars(st.rants[0]!), t: 1 })
    expect(averageStars(log)).toBe(3)
    expect(log.items[1]!.stars).toBe(1)
  })
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

describe('跨天顾客卡轮换', () => {
  it('第一天保持原身份，第二天换下一批', () => {
    expect(customerCardIndex(1, 1, 4, 50)).toBe(1)
    expect(customerCardIndex(1, 2, 4, 50)).toBe(5)
  })

  it.each([4, 10])('每天 %i 位也能轮到全部 50 张，循环后仍在池内', (perDay) => {
    const seen = new Set<number>()
    for (let day = 1; day <= 30; day++) {
      for (let id = 1; id <= perDay; id++) seen.add(customerCardIndex(id, day, perDay, 50))
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i))
    expect(customerCardIndex(10001, 1000, perDay, 50)).toBeGreaterThanOrEqual(0)
    expect(customerCardIndex(10001, 1000, perDay, 50)).toBeLessThan(50)
  })
})

describe('cardLines.ts 与手写卡同步', () => {
  it('改了 cards.json 没跑 pnpm cards:export 就红', () => {
    expect(CARD_LINES.length).toBe(cards.length)
    cards.forEach((c, i) => {
      expect(CARD_LINES[i]!.identity).toBe(c.identity)
      expect(CARD_LINES[i]!.praise).toBe(c.lines.praise)
      expect(CARD_LINES[i]!.complain).toBe(c.lines.complain)
      expect(CARD_LINES[i]!.greet).toBe(c.lines.greet)
      expect(CARD_LINES[i]!.argue).toEqual(c.lines.argue)
    })
  })
})
