/**
 * Whole-day chain through the real rules: shift + kitchen + wash + delivery desk + progress, glued the way
 * StationView glues them. A scripted chef teleports between stations (each hop costs WALK seconds of world time).
 * Guards against a day that never closes and against plates leaking out of the loop.
 */
import { describe, expect, it } from 'vitest'
import { matchCustomer, matchFries, patienceRatio, takeReadyOrders } from '../game/assets/logic/customer'
import type { Customer } from '../game/assets/logic/customer'
import { acceptDelivery, createDesk, deskBusy, matchDelivery, settleDelivery, stepDesk } from '../game/assets/logic/delivery'
import type { DeliveryDesk } from '../game/assets/logic/delivery'
import { LAST_DAY } from '../game/assets/logic/difficulty'
import { createKitchen, discard, FRY_SEC, grillCookLevel, interact, scrubSink, stepKitchen } from '../game/assets/logic/kitchen'
import type { InteractRequest, KitchenState } from '../game/assets/logic/kitchen'
import { judge } from '../game/assets/logic/order'
import { dayFlow, finishDay, newProgress, parseProgress, serializeProgress } from '../game/assets/logic/progress'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'
import { createShift, settleFries, settleServe, shiftResult, starsForShift, stepShift } from '../game/assets/logic/shift'
import { FRIES_CHANCE } from '../game/assets/logic/shop'
import type { ShiftState } from '../game/assets/logic/shift'
import { createVent, RANT_SEC, rantsLeft, startRant, stepVent, vent } from '../game/assets/logic/vent'
import type { VentState } from '../game/assets/logic/vent'
import { createLedger, earn } from '../game/assets/logic/economy'
import type { Ledger } from '../game/assets/logic/economy'
import { serveReview } from '../game/assets/logic/reviews'
import { collectStats, rollTasks, taskReward, taskStatus } from '../game/assets/logic/tasks'
import type { TaskId } from '../game/assets/logic/tasks'
import type { Ingredient, OrderSpec, Station, StationKind } from '../game/assets/logic/types'

// StationView defaults
const PLATES = 6
const SPARE = 4
const LATE_LEAVE = 20
const CUSTOMERS = 10
const ARRIVAL_SEC = 30
const FRIDGE_CAP = 4

const DT = 0.1
const WALK = 1.5
/** No day may run longer than this; the ten customers arrive within ~5 minutes */
const DAY_LIMIT = 1800

const st = (kind: StationKind, x: number): Station => ({
  id: kind,
  kind,
  pos: { x, z: 0 },
  box: { center: { x, z: 0 }, halfX: 0.5, halfZ: 0.5 },
  triggerRange: 1.2,
})
const KINDS: StationKind[] = ['fridge', 'grill', 'assembly', 'serve', 'sink', 'storeroom', 'register', 'delivery', 'rack', 'shelf', 'fryer']
const S = Object.fromEntries(KINDS.map((k, i) => [k, st(k, i * 5)])) as Record<StationKind, Station>

interface World {
  k: KitchenState
  shift: ShiftState
  desk: DeliveryDesk
  /** Upset customers rant at the desk before leaving; the day waits for them */
  vent: VentState
  ledger: Ledger
  /** Orders completed with fries (liveness for the fryer variant) */
  friesDone: number
  /** Own clock: shift.t stops once the shift is over, and a stuck chef would then spin forever */
  t: number
}

/** `fryer` = bought in the shop: diners add fries, the fryer station works */
function makeWorld(day: number, seed: number, fryer = false): World {
  const d = dayFlow(day, ARRIVAL_SEC)
  const orders = { ...d.orders, friesChance: fryer ? FRIES_CHANCE : 0 }
  return {
    k: createKitchen({
      stations: Object.values(S), cook: { ...DEFAULT_COOK }, grillSlots: 2, fridgeCap: FRIDGE_CAP, plates: PLATES, sparePlates: SPARE,
      fryerSec: fryer ? FRY_SEC : undefined,
    }),
    shift: createShift({
      seed,
      customers: CUSTOMERS,
      flow: { ...d.flow, intervalJitter: 0.5, lateLeaveSec: LATE_LEAVE, takeOrder: { walkInSec: 4, patienceSec: 25 } },
      orders,
    }),
    desk: createDesk({ intervalSec: 40, offerSec: 15, deadlineSec: 75, maxOffers: 2, maxActive: 2 }, d.orders, seed ^ 0x5bd1e995),
    vent: createVent(),
    ledger: createLedger(),
    friesDone: 0,
    t: 0,
  }
}

const closed = (w: World) => w.shift.over && !deskBusy(w.desk) && rantsLeft(w.vent) === 0

function tick(w: World, dt = DT): void {
  w.t += dt
  if (w.t > DAY_LIMIT) throw new Error(`day never closed: ${JSON.stringify(shiftResult(w.shift))} plates=${w.k.plates}`)
  stepKitchen(w.k, dt)
  stepShift(w.shift, dt, (c) => startRant(w.vent, c.id, 1))
  stepVent(w.vent, dt)
  w.desk.open = !w.shift.over && w.shift.flow.arrived < CUSTOMERS
  stepDesk(w.desk, dt)
}

function wait(w: World, sec: number): void {
  for (let t = 0; t < sec - 1e-9; t += DT) tick(w)
}

function go(w: World, s: Station, req: InteractRequest = {}) {
  wait(w, WALK)
  return interact(w.k, s.pos, s, req)
}

/** Every plate is somewhere: shelf, hand, bench, table, dirty pile, sink, rack — or broken */
function platesAccounted(k: KitchenState): number {
  const c = k.carry
  const inHand = (c.kind === 'patty' && c.plated ? 1 : 0) + (c.kind === 'stack' ? c.count : 0)
  const onBench = (k.assemblyOccupied || c.kind === 'plate') && k.burgerPlated ? 1 : 0
  const onTables = k.returning.filter((x) => x > 0).length
  return k.plates + inHand + onBench + onTables + k.dirty + k.sink.count + k.rack.count + k.rack.ready + k.broken + k.spare
}

/** One wash step if there is one to do. False = nothing to wash right now */
function washStep(w: World): boolean {
  const k = w.k
  if (k.rack.ready > 0) {
    expect(go(w, S.rack).kind).toBe('take-stack')
    expect(go(w, S.shelf).kind).toBe('shelve')
    return true
  }
  if (k.sink.stage === 'soaked' && k.rack.count === 0) {
    wait(w, WALK)
    while (k.sink.stage === 'soaked') {
      scrubSink(k, DT)
      tick(w)
    }
    return true
  }
  if (k.sink.stage === 'empty' && k.dirty > 0) {
    expect(go(w, S.sink).kind).toBe('soak')
    return true
  }
  return false
}

function fetch(w: World, ing: Ingredient): void {
  let r = go(w, S.fridge, { ingredient: ing })
  if (r.reason === 'out-of-stock') {
    expect(go(w, S.storeroom, { ingredient: ing }).kind).toBe('take-crate')
    expect(go(w, S.fridge).kind).toBe('restock')
    r = go(w, S.fridge, { ingredient: ing })
  }
  expect(r.kind).toBe('take-ingredient')
}

/** Build one burger for `spec` on the bench and pick it up */
function cook(w: World, spec: OrderSpec): void {
  const k = w.k
  while (k.plates <= 0) if (!washStep(w)) tick(w)
  fetch(w, 'patty')
  const put = go(w, S.grill)
  expect(put.kind).toBe('place-patty')
  wait(w, WALK)
  while (grillCookLevel(k, put.slot) !== spec.doneness) tick(w)
  expect(interact(k, S.grill.pos, S.grill, { slot: put.slot }).kind).toBe('take-patty')
  expect(go(w, S.assembly).kind).toBe('add-to-burger')
  for (const ing of ['bun' as Ingredient, ...spec.required.filter((i) => i !== 'bun' && i !== 'patty')]) {
    fetch(w, ing)
    expect(go(w, S.assembly).kind).toBe('add-to-burger')
  }
  expect(go(w, S.assembly).kind).toBe('pick-plate')
}

function mostUrgent(w: World): Customer | null {
  let best: Customer | null = null
  for (const c of w.shift.flow.customers) if (c.active && c.ordered && (!best || c.patienceLeft < best.patienceLeft)) best = c
  return best
}

/** The chef: take orders, cook for the most urgent diner, take deliveries when the dining room is quiet, wash when idle */
function playDay(w: World, deliveries: boolean): void {
  while (!closed(w)) {
    if (w.shift.flow.customers.some((c) => c.active && !c.ordered && c.orderWait >= 4)) {
      wait(w, WALK)
      takeReadyOrders(w.shift.flow)
      continue
    }
    const c = mostUrgent(w)
    if (c) {
      cook(w, c.spec)
      const who = matchCustomer(w.shift.flow, w.k.burger)
      // The diner gave up while it cooked and nobody else fits: bin it rather than serve it wrong
      if (!who || !judge(w.k.burger, who.spec).ok) {
        expect(discard(w.k).kind).toBe('discard')
        continue
      }
      const r = go(w, S.serve, { spec: who.spec })
      expect(r.kind).toBe('serve')
      const rv = serveReview(r.verdict!.ok, who.late, patienceRatio(w.shift.flow, who))
      const late = who.late
      if (settleServe(w.shift, who, r.verdict!)) {
        earn(w.ledger, r.verdict!.ok, late, rv.stars, false)
        if (late) startRant(w.vent, who.id, 2)
        continue
      }
      // Burger in, fries still due
      expect(go(w, S.fryer).kind).toBe('fry')
      while (w.k.fryer.stage !== 'ready') tick(w)
      expect(interact(w.k, S.fryer.pos, S.fryer).kind).toBe('take-fries')
      wait(w, WALK)
      const fw = matchFries(w.shift.flow)
      if (!fw) {
        expect(discard(w.k).kind).toBe('discard')
        continue
      }
      expect(interact(w.k, S.serve.pos, S.serve, { spec: fw.spec }).kind).toBe('serve-fries')
      const fv = serveReview(fw.burgerVerdict?.ok ?? true, fw.late, patienceRatio(w.shift.flow, fw))
      const flate = fw.late
      const v = settleFries(w.shift, fw)
      if (v) {
        w.friesDone++
        earn(w.ledger, v.ok, flate, fv.stars, false, true)
        if (flate) startRant(w.vent, fw.id, 2)
      }
      continue
    }
    const offer = w.desk.slots.find((d) => d.status === 'offer')
    if (deliveries && offer && acceptDelivery(w.desk, offer)) continue
    const job = w.desk.slots.find((d) => d.status === 'accepted')
    if (job) {
      cook(w, job.spec)
      const d = matchDelivery(w.desk, w.k.burger)!
      const r = go(w, S.delivery, { spec: d.spec })
      expect(r.kind).toBe('serve')
      earn(w.ledger, r.verdict!.ok, false, 5, true)
      settleDelivery(w.desk, d, r.verdict!.ok)
      continue
    }
    if (!washStep(w)) tick(w)
  }
}

describe('一天的完整链路（真实规则 + 脚本厨师）', () => {
  const days = Array.from({ length: LAST_DAY }, (_, i) => i + 1)

  it.each(days)('第 %i 天能打烊，人数与盘子都对得上账', (day) => {
    const w = makeWorld(day, 1000 + day)
    playDay(w, true)
    const r = shiftResult(w.shift)
    expect(r.arrived).toBe(CUSTOMERS)
    expect(r.served + r.lateServed + r.wrong + r.walkedOut + r.leftLate).toBe(CUSTOMERS)
    expect(r.wrong).toBe(0)
    expect(w.desk.wrong).toBe(0)
    expect(platesAccounted(w.k)).toBe(PLATES + SPARE)
    // The till agrees with the shift: every paid burger is an on-time good serve or a delivered order
    expect(w.ledger.paid).toBe(r.served + w.desk.delivered)
    // The bot never serves wrong or drops a plate, so those tasks settle done at closing
    const s = collectStats(r, w.k, w.desk, w.ledger)
    for (const t of rollTasks(day, CUSTOMERS, false)) {
      const st = taskStatus(t, s, true)
      expect(st).not.toBe('open')
      if (t.id === 'no-wrong' || t.id === 'no-broken') expect(st).toBe('done')
    }
  })

  it.each([1, 10, 20])('买了炸锅：第 %i 天有人加点薯条，汉堡和薯条都到齐才走，照样打烊对账', (day) => {
    const w = makeWorld(day, 3000 + day, true)
    playDay(w, false)
    const r = shiftResult(w.shift)
    expect(r.served + r.lateServed + r.wrong + r.walkedOut + r.leftLate).toBe(CUSTOMERS)
    expect(r.wrong).toBe(0)
    expect(platesAccounted(w.k)).toBe(PLATES + SPARE)
    expect(w.ledger.paid).toBe(r.served + w.desk.delivered)
    expect(w.friesDone).toBeGreaterThan(0)
    expect(collectStats(r, w.k, w.desk, w.ledger).fries).toBeGreaterThan(0)
  })

  it('什么都不做：没人接单的全走光，照样打烊，0 星不放行', () => {
    const w = makeWorld(1, 7)
    while (!closed(w)) tick(w)
    const r = shiftResult(w.shift)
    expect(r.walkedOut).toBe(CUSTOMERS)
    expect(starsForShift(r)).toBe(0)
    const p = newProgress()
    expect(finishDay(p, 1, 0)).toBe(false)
    expect(p.day).toBe(1)
    // Tasks: every "reach N" fails, every "never do X" holds
    const s = collectStats(r, w.k, w.desk, w.ledger)
    const ids: TaskId[] = ['good', 'delivered', 'income', 'fries', 'no-wrong', 'no-burnt', 'no-broken']
    const st = ids.map((id) => taskStatus({ id, target: id.startsWith('no-') ? 0 : 1 }, s, true))
    expect(st).toEqual(['failed', 'failed', 'failed', 'failed', 'done', 'done', 'done'])
    expect(taskReward(st.slice(0, 3))).toBe(0)
  })

  it('接了单就挂机：顾客超时后再等 LATE_LEAVE 秒走人，照样打烊', () => {
    const w = makeWorld(1, 9)
    while (!closed(w)) {
      takeReadyOrders(w.shift.flow)
      tick(w)
    }
    const r = shiftResult(w.shift)
    expect(r.walkedOut).toBe(0)
    expect(r.leftLate).toBe(CUSTOMERS)
  })

  it('最后一位顾客在前台发火：发完才结算；怼回去不影响打烊', () => {
    const w = makeWorld(1, 21)
    while (!w.shift.over) {
      takeReadyOrders(w.shift.flow)
      tick(w)
    }
    const at = w.t
    expect(rantsLeft(w.vent)).toBeGreaterThan(0)
    expect(closed(w)).toBe(false)
    expect(vent(w.vent, 'register')).not.toBeNull()
    while (!closed(w)) tick(w)
    expect(w.t - at).toBeLessThanOrEqual(RANT_SEC + DT)
  })

  it('盘子全摔光：去冷库领备用盘，还能做熟的汉堡', () => {
    const w = makeWorld(1, 13)
    w.k.broken = w.k.plates
    w.k.plates = 0
    expect(go(w, S.storeroom, { plates: true }).kind).toBe('take-stack')
    expect(go(w, S.shelf).kind).toBe('shelve')
    fetch(w, 'patty')
    go(w, S.grill)
    wait(w, DEFAULT_COOK.mediumAt)
    expect(go(w, S.grill).kind).toBe('take-patty')
    expect(platesAccounted(w.k)).toBe(PLATES + SPARE)
  })

  it('接了外卖就要等它送完或超时才结算', () => {
    const w = makeWorld(1, 11)
    while (!w.desk.slots.some((d) => d.status === 'offer')) {
      stepShift(w.shift, DT)
      w.desk.open = true
      stepDesk(w.desk, DT)
    }
    acceptDelivery(w.desk, w.desk.slots.find((d) => d.status === 'offer')!)
    w.shift.over = true
    expect(closed(w)).toBe(false)
    for (let t = 0; t < 76; t += DT) stepDesk(w.desk, DT)
    expect(w.desk.late).toBe(1)
    expect(closed(w)).toBe(true)
  })

  it('20 天连打：每天的结果写进存档再读回来，过线就推进一天', () => {
    let saved = serializeProgress(newProgress())
    let day = 1
    const stars: number[] = []
    for (let n = 0; n < LAST_DAY; n++) {
      const p = parseProgress(saved)
      expect(p.day).toBe(day)
      const w = makeWorld(day, 2000 + day)
      playDay(w, false)
      const s = starsForShift(shiftResult(w.shift))
      stars.push(s)
      const passed = finishDay(p, day, s)
      saved = serializeProgress(p)
      if (!passed) break
      day = Math.min(LAST_DAY, day + 1)
    }
    // The chef is no speed-runner, but day 1 must be winnable or the chain dead-ends at the first result screen
    expect(stars[0]).toBeGreaterThan(0)
    expect(parseProgress(saved).best.slice(0, stars.length)).toEqual(stars)
    console.log(`[day-chain] stars by day: ${stars.join(' ')}`)
  })
})
