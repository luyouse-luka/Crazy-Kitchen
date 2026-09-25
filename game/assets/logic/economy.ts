/**
 * Money for one day: what the till takes. Service quality → tips → coins → unlocks (batch 4), the
 * Burgie's-style loop (ROADMAP ①). Zero Cocos (铁律①). Every number here is ⏳ self-chosen until tuned on device.
 */

/** Paid for a correct burger served on time */
export const PRICE = 10
/** Delivery pays a bit more: the rider waits, and it takes a trip to the pickup counter */
export const DELIVERY_PRICE = 12
/** Added when the order came with fries */
export const FRIES_PRICE = 4
export const DRINK_PRICE = 3

/** Tip by review stars. Only a burger served right and on time earns one */
export function tipFor(stars: number): number {
  return stars >= 5 ? 5 : stars >= 4 ? 3 : stars >= 3 ? 1 : 0
}

export interface Ledger {
  sales: number
  tips: number
  /** Burgers paid for */
  paid: number
  /** Fries paid for */
  fries: number
  drinks: number
}

export function createLedger(): Ledger {
  return { sales: 0, tips: 0, paid: 0, fries: 0, drinks: 0 }
}

export function resetLedger(l: Ledger): void {
  l.sales = 0
  l.tips = 0
  l.paid = 0
  l.fries = 0
  l.drinks = 0
}

/** One order completed. Wrong or late earns nothing (免单). Returns what came in, for the floater */
export function earn(l: Ledger, ok: boolean, late: boolean, stars: number, delivery: boolean, fries = false, drink = false): number {
  if (!ok || late) return 0
  const price = (delivery ? DELIVERY_PRICE : PRICE) + (fries ? FRIES_PRICE : 0) + (drink ? DRINK_PRICE : 0)
  const tip = tipFor(stars)
  l.sales += price
  l.tips += tip
  l.paid++
  if (fries) l.fries++
  if (drink) l.drinks++
  return price + tip
}

export function ledgerTotal(l: Ledger): number {
  return l.sales + l.tips
}
