import { describe, expect, it } from 'vitest'
import { createLedger, DELIVERY_PRICE, earn, ledgerTotal, PRICE, resetLedger, tipFor } from '../game/assets/logic/economy'

describe('收银', () => {
  it('做对且准时：菜钱 + 按星给小费', () => {
    const l = createLedger()
    expect(earn(l, true, false, 5, false)).toBe(PRICE + tipFor(5))
    expect(earn(l, true, false, 3, true)).toBe(DELIVERY_PRICE + tipFor(3))
    expect(l).toEqual({ sales: PRICE + DELIVERY_PRICE, tips: tipFor(5) + tipFor(3), paid: 2, fries: 0, drinks: 0 })
    expect(ledgerTotal(l)).toBe(PRICE + DELIVERY_PRICE + tipFor(5) + tipFor(3))
  })

  it('上错或超时免单，一分不进', () => {
    const l = createLedger()
    expect(earn(l, false, false, 5, false)).toBe(0)
    expect(earn(l, true, true, 5, false)).toBe(0)
    expect(ledgerTotal(l)).toBe(0)
    expect(l.paid).toBe(0)
  })

  it('小费随星数单调不减，三星以下没有', () => {
    const tips = [0, 1, 2, 3, 4, 5].map(tipFor)
    for (let i = 1; i < tips.length; i++) expect(tips[i]!).toBeGreaterThanOrEqual(tips[i - 1]!)
    expect(tipFor(2)).toBe(0)
    expect(tipFor(3)).toBeGreaterThan(0)
  })

  it('重开一天清零', () => {
    const l = createLedger()
    earn(l, true, false, 5, false)
    resetLedger(l)
    expect(ledgerTotal(l)).toBe(0)
  })
})
