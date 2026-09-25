import { describe, expect, it } from 'vitest'
import { buy, flowFactor, FLOW_UP, owns, SHOP } from '../game/assets/logic/shop'
import { newProgress, parseProgress, serializeProgress } from '../game/assets/logic/progress'
import { createShift, settleFries, settleServe, shiftResult, stepShift } from '../game/assets/logic/shift'
import type { ShiftConfig, ShiftState } from '../game/assets/logic/shift'
import { matchCustomer, matchFries, OPTIONAL, rollSpec, takeReadyOrders } from '../game/assets/logic/customer'
import { createRng } from '../game/assets/logic/rng'
import type { OrderSpec } from '../game/assets/logic/types'
import { createKitchen, FRY_BURN_SEC, FRY_SEC, interact, stepKitchen } from '../game/assets/logic/kitchen'
import type { OrderVerdict } from '../game/assets/logic/order'
import type { Station } from '../game/assets/logic/types'
import { earn, createLedger, FRIES_PRICE, PRICE, tipFor } from '../game/assets/logic/economy'

describe('商店', () => {
  it('钱够才买得到，扣钱、记进存档、读回来还在；不能买两次', () => {
    const p = newProgress()
    const fryer = SHOP.find((x) => x.id === 'fryer')!
    p.coins = fryer.price - 1
    expect(buy(p, 'fryer')).toBe('poor')
    expect(owns(p, 'fryer')).toBe(false)
    p.coins = fryer.price + 5
    expect(buy(p, 'fryer')).toBe('ok')
    expect(p.coins).toBe(5)
    expect(buy(p, 'fryer')).toBe('owned')
    expect(p.coins).toBe(5)
    expect(owns(parseProgress(serializeProgress(p)), 'fryer')).toBe(true)
    expect(buy(p, 'second-grill')).toBe('unknown')
  })

  it('不卖「多一个烤炉」—— M1 实测烤炉不是瓶颈，跑腿才是', () => {
    expect(SHOP.some((x) => /烤炉|grill-slot/.test(x.name + x.id))).toBe(false)
  })
})

const CFG: ShiftConfig = {
  seed: 5,
  customers: 30,
  flow: { intervalSec: 1, intervalJitter: 0, maxConcurrent: 6, patienceSec: 60, stayWhenLate: true },
  orders: { extraMin: 0, extraMax: 2, bannedChance: 0.3 },
}

/** Every order the flow hands out for this config, in arrival order */
function orders(cfg: ShiftConfig): string[] {
  const st = createShift(cfg)
  const out: string[] = []
  for (let i = 0; i < 400 && out.length < cfg.customers; i++) {
    stepShift(st, 0.5, undefined)
    for (const c of st.flow.customers) {
      if (!c.active) continue
      out.push(JSON.stringify({ id: c.id, r: c.spec.required, b: c.spec.banned, d: c.spec.doneness }))
      settleServe(st, c, OK)
    }
  }
  return out
}

const OK: OrderVerdict = { ok: true, missing: [], forbidden: [], cookOk: true }
const BAD: OrderVerdict = { ok: false, missing: ['cheese'], forbidden: [], cookOk: true }

describe('薯条：没买炸锅时订单逐位不变', () => {
  it('friesChance 不写 / 写 0 → 与原来的出题完全一致（RNG 一次都没多调）', () => {
    const base = orders(CFG)
    expect(base.length).toBe(CFG.customers)
    // Reference = the pre-fries generator: one rollSpec per arrival on the flow's RNG (no jitter draws at jitter 0)
    const rng = createRng(CFG.seed)
    const pool = OPTIONAL.slice()
    const ref: string[] = []
    for (let id = 1; id <= CFG.customers; id++) {
      const sp: OrderSpec = { required: [], banned: [], doneness: 'medium', patience: 0 }
      rollSpec(rng, CFG.orders, pool, CFG.flow.patienceSec, sp)
      ref.push(JSON.stringify({ id, r: sp.required, b: sp.banned, d: sp.doneness }))
    }
    expect(base).toEqual(ref)
    expect(orders({ ...CFG, orders: { ...CFG.orders, friesChance: 0 } })).toEqual(base)
    // Liveness: turning fries on does move the stream, so the comparison above can fail
    expect(orders({ ...CFG, orders: { ...CFG.orders, friesChance: 0.5 } })).not.toEqual(base)
  })
})

function withFriesDiner(): { st: ShiftState; c: ShiftState['flow']['customers'][number] } {
  const st = createShift({ ...CFG, customers: 1, orders: { ...CFG.orders, friesChance: 1 }, flow: { ...CFG.flow, takeOrder: { walkInSec: 0, patienceSec: 30 } } })
  stepShift(st, 0.1)
  takeReadyOrders(st.flow)
  const c = st.flow.customers.find((x) => x.active)!
  return { st, c }
}

describe('升级也让客人来得更勤', () => {
  it('什么都没买 = 正好 1；三项升级各自收紧，炸锅不收紧', () => {
    const p = newProgress()
    expect(flowFactor(p)).toBe(1)
    p.owned = ['fryer']
    expect(flowFactor(p)).toBe(1)
    p.owned = ['fryer', 'fast-grill', 'fast-wash', 'big-tray']
    expect(flowFactor(p)).toBeCloseTo(FLOW_UP['fast-grill']! * FLOW_UP['fast-wash']! * FLOW_UP['big-tray']!)
    expect(flowFactor(p)).toBeLessThan(1)
  })

  it('间隔缩短只让人来得早，出的单逐位不变', () => {
    const k = 0.8
    const fast = { ...CFG, flow: { ...CFG.flow, intervalSec: CFG.flow.intervalSec * k } }
    expect(orders(fast)).toEqual(orders(CFG))
    const st = createShift(fast)
    const base = createShift(CFG)
    // Below maxConcurrent, so the cap does not hide the difference
    for (let i = 0; i < 5; i++) {
      stepShift(st, 0.5, undefined)
      stepShift(base, 0.5, undefined)
    }
    expect(st.flow.arrived).toBeGreaterThan(base.flow.arrived)
  })
})

describe('薯条：两样到齐才走', () => {
  it('先上汉堡：顾客留下等薯条，不再接第二个汉堡；薯条到了按汉堡的判定结算', () => {
    const { st, c } = withFriesDiner()
    expect(c.spec.fries).toBe(true)
    expect(settleServe(st, c, OK)).toBe(false)
    expect(c.active).toBe(true)
    expect(matchCustomer(st.flow, { ingredients: ['bun', 'patty'], cook: 'medium' })).toBeNull()
    expect(matchFries(st.flow)).toBe(c)
    expect(settleFries(st, c)).toBe(OK)
    expect(c.active).toBe(false)
    expect(shiftResult(st).served).toBe(1)
    expect(st.over).toBe(true)
  })

  it('先上薯条：还在等汉堡；汉堡到了就走', () => {
    const { st, c } = withFriesDiner()
    expect(settleFries(st, c)).toBeNull()
    expect(c.active).toBe(true)
    expect(matchFries(st.flow)).toBeNull()
    expect(settleServe(st, c, OK)).toBe(true)
    expect(shiftResult(st).served).toBe(1)
  })

  it('汉堡上错：当场算上错走人，不用再等薯条', () => {
    const { st, c } = withFriesDiner()
    expect(settleServe(st, c, BAD)).toBe(true)
    expect(c.active).toBe(false)
    expect(shiftResult(st).wrong).toBe(1)
  })

  it('薯条优先给已经拿到汉堡、只差这一样的那位', () => {
    const st = createShift({ ...CFG, customers: 2, orders: { ...CFG.orders, friesChance: 1 }, flow: { ...CFG.flow, takeOrder: { walkInSec: 0, patienceSec: 30 } } })
    stepShift(st, 0.1)
    stepShift(st, 1)
    takeReadyOrders(st.flow)
    const [a, b] = st.flow.customers.filter((x) => x.active)
    expect(a && b).toBeTruthy()
    a!.patienceLeft = 5
    settleServe(st, b!, OK)
    expect(matchFries(st.flow)).toBe(b)
  })

  it('带薯条的单多收 FRIES_PRICE', () => {
    const l = createLedger()
    expect(earn(l, true, false, 5, false, true)).toBe(PRICE + FRIES_PRICE + tipFor(5))
    expect(earn(l, true, true, 5, false, true)).toBe(0)
  })
})

describe('炸锅工位', () => {
  const at = (x: number): Station => ({ id: 'f', kind: 'fryer', pos: { x, z: 0 }, box: { center: { x, z: 0 }, halfX: 0.5, halfZ: 0.5 }, triggerRange: 1.2 })
  const FRYER = at(0)
  const SERVE: Station = { ...at(5), id: 's', kind: 'serve' }
  const mk = (fryerSec?: number) =>
    createKitchen({ stations: [FRYER, SERVE], cook: { rareAt: 3, mediumAt: 6, wellAt: 9, burntAt: 13 }, grillSlots: 2, fryerSec })

  it('没买：点了没反应，也不抢「最近的工位」', () => {
    const k = mk()
    expect(interact(k, FRYER.pos, FRYER).kind).toBe('blocked')
  })

  it('空手下锅 → 炸 FRY_SEC 秒 → 取出一份 → 端到出餐口', () => {
    const k = mk(FRY_SEC)
    expect(interact(k, FRYER.pos, FRYER).kind).toBe('fry')
    stepKitchen(k, FRY_SEC - 0.1)
    expect(interact(k, FRYER.pos, FRYER).reason).toBe('still-frying')
    stepKitchen(k, 0.2)
    expect(interact(k, FRYER.pos, FRYER).kind).toBe('take-fries')
    expect(k.carry.kind).toBe('fries')
    expect(interact(k, SERVE.pos, SERVE, { spec: { required: [], banned: [], doneness: 'medium', patience: 1 } }).reason).toBe('no-order')
    expect(interact(k, SERVE.pos, SERVE, { spec: { required: [], banned: [], doneness: 'medium', patience: 1, fries: true } }).kind).toBe('serve-fries')
    expect(k.carry.kind).toBe('none')
  })
  it('炸好不取：FRY_BURN_SEC 秒后炸糊，只能倒掉再重炸；及时取不会糊', () => {
    const k = mk(FRY_SEC)
    interact(k, FRYER.pos, FRYER)
    stepKitchen(k, FRY_SEC + 0.01)
    stepKitchen(k, FRY_BURN_SEC - 0.1)
    expect(k.fryer.stage).toBe('ready')
    stepKitchen(k, 0.2)
    expect(k.fryer.stage).toBe('burnt')
    expect(k.burntFries).toBe(1)
    const r = interact(k, FRYER.pos, FRYER)
    expect(r.kind).toBe('dump-fries')
    expect(k.carry.kind).toBe('none')
    expect(interact(k, FRYER.pos, FRYER).kind).toBe('fry')
    stepKitchen(k, FRY_SEC + 1)
    expect(interact(k, FRYER.pos, FRYER).kind).toBe('take-fries')
    stepKitchen(k, FRY_BURN_SEC * 2)
    expect(k.burntFries).toBe(1)
    expect(k.carry.kind).toBe('fries')
  })
})
