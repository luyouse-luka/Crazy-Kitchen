import { describe, expect, it } from 'vitest'
import { createKitchen, DRINK_SEC, DRINK_SPILL_SEC, interact, stationInReach, stepKitchen } from '../game/assets/logic/kitchen'
import { createShift, settleServe, settleSide, shiftResult, stepShift } from '../game/assets/logic/shift'
import { matchSide, takeReadyOrders } from '../game/assets/logic/customer'
import { createLedger, DRINK_PRICE, earn, FRIES_PRICE, PRICE, tipFor } from '../game/assets/logic/economy'
import type { OrderVerdict } from '../game/assets/logic/order'
import type { ShiftConfig } from '../game/assets/logic/shift'
import type { Station, StationKind } from '../game/assets/logic/types'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'

const at = (id: string, kind: StationKind, x: number): Station => ({
  id,
  kind,
  pos: { x, z: 0 },
  box: { center: { x, z: 0 }, halfX: 0.5, halfZ: 0.5 },
  triggerRange: 1.2,
})
const M = at('d', 'drinks', 0)
const SERVE = at('s', 'serve', 5)
const mk = (drinkSec?: number) => createKitchen({ stations: [M, SERVE], cook: { ...DEFAULT_COOK }, grillSlots: 2, drinkSec })
const want = (drink: boolean) => ({ required: [], banned: [], doneness: 'medium' as const, patience: 1, drink })

describe('饮料机', () => {
  it('没买：点了没反应，也不抢「最近」', () => {
    const k = mk()
    expect(interact(k, M.pos, M).reason).toBe('unsupported')
    expect(stationInReach(k, M.pos)).toBeNull()
  })

  it('点一下开始接 → 接满取走 → 端给要饮料的人；没人要就端不出去', () => {
    const k = mk(DRINK_SEC)
    expect(interact(k, M.pos, M).kind).toBe('pour')
    stepKitchen(k, DRINK_SEC - 0.1)
    expect(interact(k, M.pos, M).reason).toBe('still-pouring')
    stepKitchen(k, 0.2)
    expect(interact(k, M.pos, M).kind).toBe('take-drink')
    expect(interact(k, SERVE.pos, SERVE, { spec: want(false) }).reason).toBe('no-order')
    expect(interact(k, SERVE.pos, SERVE, { spec: want(true) }).kind).toBe('serve-drink')
    expect(k.carry.kind).toBe('none')
  })

  it('接满了不拿：DRINK_SPILL_SEC 秒后溢出，只能擦掉重接', () => {
    const k = mk(DRINK_SEC)
    interact(k, M.pos, M)
    stepKitchen(k, DRINK_SEC + 0.01)
    stepKitchen(k, DRINK_SPILL_SEC - 0.1)
    expect(k.drinks.stage).toBe('ready')
    stepKitchen(k, 0.2)
    expect(k.drinks.stage).toBe('spilled')
    expect(k.spills).toBe(1)
    expect(interact(k, M.pos, M).kind).toBe('wipe-spill')
    expect(interact(k, M.pos, M).kind).toBe('pour')
  })

  it('每杯多收 DRINK_PRICE', () => {
    expect(earn(createLedger(), true, false, 5, false, true, true)).toBe(PRICE + FRIES_PRICE + DRINK_PRICE + tipFor(5))
  })
})

describe('汉堡 + 薯条 + 饮料：三样到齐才走', () => {
  const OK: OrderVerdict = { ok: true, missing: [], forbidden: [], cookOk: true }
  const CFG: ShiftConfig = {
    seed: 3,
    customers: 1,
    flow: { intervalSec: 1, intervalJitter: 0, maxConcurrent: 6, patienceSec: 60, stayWhenLate: true, takeOrder: { walkInSec: 0, patienceSec: 30 } },
    orders: { extraMin: 0, extraMax: 0, bannedChance: 0, friesChance: 1, drinkChance: 1 },
  }

  it('先汉堡、再饮料、最后薯条：最后一样到了才结算', () => {
    const st = createShift(CFG)
    stepShift(st, 0.1)
    takeReadyOrders(st.flow)
    const c = st.flow.customers.find((x) => x.active)!
    expect(c.spec.drink && c.spec.fries).toBe(true)
    expect(settleServe(st, c, OK)).toBe(false)
    expect(matchSide(st.flow, 'drink')).toBe(c)
    expect(settleSide(st, c, 'drink')).toBeNull()
    expect(c.active).toBe(true)
    expect(settleSide(st, c, 'fries')).toBe(OK)
    expect(c.active).toBe(false)
    expect(shiftResult(st).served).toBe(1)
  })

  it('饮料先到也不走，还在等汉堡', () => {
    const st = createShift(CFG)
    stepShift(st, 0.1)
    takeReadyOrders(st.flow)
    const c = st.flow.customers.find((x) => x.active)!
    expect(settleSide(st, c, 'drink')).toBeNull()
    expect(settleSide(st, c, 'fries')).toBeNull()
    expect(matchSide(st.flow, 'drink')).toBeNull()
    expect(settleServe(st, c, OK)).toBe(true)
  })
})
