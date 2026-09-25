import { describe, expect, it } from 'vitest'
import { judge } from '../game/assets/logic/order'
import { addCookedPatty, createBurger, DEFAULT_COOK } from '../game/assets/logic/recipe'
import { createKitchen, interact, stepKitchen } from '../game/assets/logic/kitchen'
import { createShift, settleServe, stepShift } from '../game/assets/logic/shift'
import type { ShiftConfig } from '../game/assets/logic/shift'
import type { OrderSpec, Station, StationKind } from '../game/assets/logic/types'
import type { OrderVerdict } from '../game/assets/logic/order'
import { OPTIONAL, rollSpec } from '../game/assets/logic/customer'
import { chance, createRng } from '../game/assets/logic/rng'

const spec = (double: boolean): OrderSpec => ({ required: ['bun', 'patty'], banned: [], doneness: 'medium', patience: 30, double })

describe('双层汉堡：判定', () => {
  it('双层单只放一块肉 = 缺肉；两块都对才算对；有一块火候不对就错', () => {
    const b = createBurger()
    b.ingredients.push('bun')
    addCookedPatty(b, 'medium', true)
    expect(judge(b, spec(true)).ok).toBe(false)
    expect(judge(b, spec(true)).missing).toEqual(['patty'])
    addCookedPatty(b, 'medium', true)
    expect(judge(b, spec(true)).ok).toBe(true)
    const c = createBurger()
    c.ingredients.push('bun')
    addCookedPatty(c, 'medium', true)
    addCookedPatty(c, 'well', true)
    expect(judge(c, spec(true)).cookOk).toBe(false)
  })

  it('单层单多放一块同火候的肉不算错（多放的东西不罚）；最多两块；不开双层还是只能一块', () => {
    const b = createBurger()
    b.ingredients.push('bun')
    addCookedPatty(b, 'medium', true)
    addCookedPatty(b, 'medium', true)
    expect(judge(b, spec(false)).ok).toBe(true)
    expect(addCookedPatty(b, 'medium', true)).toBe(false)
    const one = createBurger()
    addCookedPatty(one, 'medium')
    expect(addCookedPatty(one, 'medium')).toBe(false)
  })
})

const at = (id: string, kind: StationKind, x: number): Station => ({
  id,
  kind,
  pos: { x, z: 0 },
  box: { center: { x, z: 0 }, halfX: 0.5, halfZ: 0.5 },
  triggerRange: 1.2,
})
const S = { fridge: at('f', 'fridge', 0), grill: at('g', 'grill', 5), assembly: at('a', 'assembly', 10) }

describe('双层汉堡：厨房', () => {
  it('两块肉都叠上去，第二块带的盘子回到放盘处，盘子不多不少', () => {
    const k = createKitchen({ stations: Object.values(S), cook: { ...DEFAULT_COOK }, grillSlots: 2, plates: 4, doublePatty: true })
    for (let i = 0; i < 2; i++) {
      interact(k, S.fridge.pos, S.fridge, { ingredient: 'patty' })
      interact(k, S.grill.pos, S.grill)
    }
    stepKitchen(k, DEFAULT_COOK.mediumAt + 0.1)
    interact(k, S.fridge.pos, S.fridge, { ingredient: 'bun' })
    interact(k, S.assembly.pos, S.assembly)
    for (let i = 0; i < 2; i++) {
      expect(interact(k, S.grill.pos, S.grill).kind).toBe('take-patty')
      expect(interact(k, S.assembly.pos, S.assembly).kind).toBe('add-to-burger')
    }
    expect(k.burger.double).toBe(true)
    expect(k.plates).toBe(3)
    expect(k.burgerPlated).toBe(true)
  })
})

describe('双层汉堡：出单', () => {
  const CFG: ShiftConfig = {
    seed: 11,
    customers: 30,
    flow: { intervalSec: 1, intervalJitter: 0, maxConcurrent: 6, patienceSec: 60, stayWhenLate: true },
    orders: { extraMin: 0, extraMax: 2, bannedChance: 0.3, friesChance: 0.4 },
  }
  const OK: OrderVerdict = { ok: true, missing: [], forbidden: [], cookOk: true }
  function orders(cfg: ShiftConfig): string[] {
    const st = createShift(cfg)
    const out: string[] = []
    for (let i = 0; i < 400 && out.length < cfg.customers; i++) {
      stepShift(st, 0.5, undefined)
      for (const c of st.flow.customers) {
        if (!c.active) continue
        out.push(JSON.stringify({ r: c.spec.required, b: c.spec.banned, d: c.spec.doneness, f: c.spec.fries, x: c.spec.double }))
        c.friesDue = false
        settleServe(st, c, OK)
      }
    }
    return out
  }

  it('没开双层：订单（含薯条）与「原来的出题方式」独立重算逐位一致；开了才出现双层单', () => {
    const got = orders(CFG)
    // Reference = pre-double generator: rollSpec then the fries roll, on a fresh RNG (no jitter draws at jitter 0)
    const rng = createRng(CFG.seed)
    const pool = OPTIONAL.slice()
    const ref: string[] = []
    for (let i = 0; i < CFG.customers; i++) {
      const sp: OrderSpec = { required: [], banned: [], doneness: 'medium', patience: 0 }
      rollSpec(rng, CFG.orders, pool, CFG.flow.patienceSec, sp)
      const f = chance(rng, CFG.orders.friesChance!)
      ref.push(JSON.stringify({ r: sp.required, b: sp.banned, d: sp.doneness, f, x: false }))
    }
    expect(got).toEqual(ref)
    const on = orders({ ...CFG, orders: { ...CFG.orders, doubleChance: 0.5 } })
    expect(on.some((s) => s.includes('"x":true'))).toBe(true)
  })
})
