import { defaultSimConfig, runDay } from '../game/assets/logic/sim'
import { difficultyForDay, LAST_DAY } from '../game/assets/logic/difficulty'
import { takeReadyOrders, matchCustomer, matchSide } from '../game/assets/logic/customer'
import type { Customer } from '../game/assets/logic/customer'
import { acceptDelivery, createDesk, deskBusy, settleDelivery, stepDesk } from '../game/assets/logic/delivery'
import { createKitchen, discard, DEFAULT_WASH, DRINK_SEC, FIRE_SEC, FRY_SEC, grillCookLevel, interact, scrubSink, stepKitchen, carrySpeedFactor } from '../game/assets/logic/kitchen'
import type { InteractRequest } from '../game/assets/logic/kitchen'
import { judge } from '../game/assets/logic/order'
import { dayFlow, newProgress } from '../game/assets/logic/progress'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'
import { createShift, settleServe, settleSide, shiftResult, starsForShift, stepShift } from '../game/assets/logic/shift'
import { fridgeCap, shelfCap, flowFactor, FAST_GRILL, FAST_WASH, BIG_TRAY, FRIES_CHANCE, DRINK_CHANCE } from '../game/assets/logic/shop'
import type { Ingredient, OrderSpec, Station, StationKind } from '../game/assets/logic/types'
// @ts-expect-error Node builtin, typed locally.
import * as nodeFs from 'node:fs'
// @ts-expect-error Node builtin, typed locally.
import * as nodeCrypto from 'node:crypto'

declare const process: { argv: string[] }
const fs = nodeFs as { readFileSync(path: string, encoding: 'utf8'): string; writeFileSync(path: string, value: string): void }
const crypto = nodeCrypto as { createHash(name: string): { update(value: string): { digest(encoding: 'hex'): string } } }
type Kind = Exclude<StationKind, 'trash'>
interface Snapshot {
  schema: number
  hashes: Record<string, string>
  normalizedHashes: Record<string, string>
  params: Record<string, number>
  stations: Array<{ kind: Kind; name: string; center: { x: number; z: number }; halfX: number; halfZ: number }>
  distances: number[]
  layout: string
}
const input = process.argv[2] ?? 'docs/difficulty-layout-2026-10-14.json'
const output = process.argv[3] ?? 'docs/difficulty-results-2026-10-14.json'
const sourceInput = fs.readFileSync(input, 'utf8')
const snapshot = JSON.parse(sourceInput) as Snapshot
const required = ['fridge', 'grill', 'assembly', 'serve', 'register', 'delivery', 'storeroom', 'sink', 'rack', 'shelf', 'fryer', 'drinks', 'extinguisher']
if (snapshot.schema !== 1 || required.some(kind => !snapshot.stations.some(s => s.kind === kind)) || snapshot.distances.length !== required.length ** 2 ||
  snapshot.distances.some(n => !Number.isFinite(n) || n < 0)) throw new Error('Invalid calibration layout')
for (const [file, hash] of Object.entries(snapshot.normalizedHashes)) {
  if (!file.startsWith('game/assets/logic/') || file.endsWith('scene-layout.ts')) continue
  const local = crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex')
  if (local !== hash) throw new Error(`Logic drift since capture: ${file}; recapture and recalibrate`)
}
const stations = Object.fromEntries(snapshot.stations.map(s => [s.kind, { id: s.kind, kind: s.kind, pos: s.center,
  box: { center: s.center, halfX: s.halfX, halfZ: s.halfZ }, triggerRange: Math.max(s.halfX, s.halfZ) + 0.7 }])) as Record<Kind, Station>
const route = (a: Kind, b: Kind) => snapshot.distances[snapshot.stations.findIndex(s => s.kind === a) * required.length + snapshot.stations.findIndex(s => s.kind === b)]!
const SEEDS = Array.from({ length: 32 }, (_, s) => 1000 + (s + (process.argv[4] === 'confirm' ? 32 : 0)) * 7919)
const DT = 0.05
type Variant = 'current' | 'patience-only' | 'flow-only' | 'staged'
interface PolicyPatch { customers?: number; intervalSec?: number; intervalJitter?: number; maxConcurrent?: number; doubleChance?: number; deliveryEnabled?: boolean }
interface Profile { name: string; actionSec: number; routeFactor: number; readSec: number; initialReadSec: number }
const PROFILES: Profile[] = [
  { name: 'precise-script', actionSec: 0.4, routeFactor: 1, readSec: 0, initialReadSec: 0 },
  { name: 'guided-delay', actionSec: 0.7, routeFactor: 1.15, readSec: 2, initialReadSec: 10 },
  { name: 'learning-delay', actionSec: 1.1, routeFactor: 1.3, readSec: 4, initialReadSec: 30 },
]
const EARLY = [
  { intervalSec: 45, jitter: 0, maxConcurrent: 1, banned: 0, double: 0 },
  { intervalSec: 40, jitter: 0.1, maxConcurrent: 2, banned: 0, double: 0 },
  { intervalSec: 36, jitter: 0.15, maxConcurrent: 2, banned: 0, double: 0 },
  { intervalSec: 33, jitter: 0.2, maxConcurrent: 3, banned: 0.05, double: 0.1 },
  { intervalSec: 30, jitter: 0.25, maxConcurrent: 3, banned: 0.08, double: 0.15 },
]
const OWNERSHIP = [[], ['fridge-1', 'shelf-1'], ['fryer', 'drinks', 'fast-grill', 'fast-wash', 'big-tray', 'fridge-2', 'shelf-2']]
function config(day: number, variant: Variant, seed: number, owned: string[], patch: PolicyPatch = {}) {
  if (day >= 6 && Object.keys(patch).length) throw new Error('Sensitivity patches cannot alter day 6 or later')
  const p = snapshot.params, progress = { ...newProgress(), owned }, d = dayFlow(day, p.arrivalSec!)
  const early = day <= EARLY.length && variant !== 'current' && variant !== 'patience-only' ? EARLY[day - 1] : undefined
  return { seed, customers: patch.customers ?? (variant === 'staged' && day <= 2 ? [6, 8][day - 1]! : p.customersPerShift!),
    flow: { ...d.flow, intervalSec: (patch.intervalSec ?? early?.intervalSec ?? d.flow.intervalSec) * flowFactor(progress),
      intervalJitter: patch.intervalJitter ?? early?.jitter ?? p.arrivalJitter!, maxConcurrent: patch.maxConcurrent ?? early?.maxConcurrent ?? d.flow.maxConcurrent,
      patienceSec: d.flow.patienceSec * p.patienceScale! * (variant === 'patience-only' && day <= 5 ? 2 : 1),
      lateLeaveSec: p.lateLeaveSec! * p.patienceScale!, takeOrder: { walkInSec: p.walkInSec!, patienceSec: p.orderPatienceSec! * p.patienceScale! } },
    orders: { ...d.orders, bannedChance: variant === 'staged' && early ? early.banned : d.orders.bannedChance,
      doubleChance: patch.doubleChance ?? (day >= 4 ? (variant === 'staged' && early ? early.double : 0.25) : 0),
      friesChance: owned.includes('fryer') ? FRIES_CHANCE : 0, drinkChance: owned.includes('drinks') ? DRINK_CHANCE : 0 },
    deliveryEnabled: patch.deliveryEnabled ?? !(variant === 'staged' && day <= 3), progress }
}
function play(day: number, variant: Variant, seed: number, profile: Profile, owned: string[] = [], acceptOffers = true, patch: PolicyPatch = {}) {
  const cfg = config(day, variant, seed, owned, patch), params = snapshot.params
  const shift = createShift(cfg)
  const g = owned.includes('fast-grill') ? FAST_GRILL : 1, wash = owned.includes('fast-wash') ? FAST_WASH : 1
  const k = createKitchen({ stations: Object.values(stations), cook: { rareAt: DEFAULT_COOK.rareAt * g, mediumAt: DEFAULT_COOK.mediumAt * g,
    wellAt: DEFAULT_COOK.wellAt * g, burntAt: DEFAULT_COOK.burntAt * g }, grillSlots: 2, fridgeCap: fridgeCap(cfg.progress),
    plates: shelfCap(cfg.progress), shelfCap: shelfCap(cfg.progress), sparePlates: params.sparePlates!, fireSec: FIRE_SEC, doublePatty: true,
    wash: { soakSec: DEFAULT_WASH.soakSec * wash, scrubSec: DEFAULT_WASH.scrubSec * wash, drySec: DEFAULT_WASH.drySec * wash, returnSec: DEFAULT_WASH.returnSec },
    stackMax: owned.includes('big-tray') ? BIG_TRAY.max : undefined, stackSlow: owned.includes('big-tray') ? BIG_TRAY.slow : undefined,
    fryerSec: owned.includes('fryer') ? FRY_SEC : undefined, drinkSec: owned.includes('drinks') ? DRINK_SEC : undefined })
  const desk = createDesk({ intervalSec: params.deliveryIntervalSec!, offerSec: params.deliveryOfferSec!, deadlineSec: params.deliveryDeadlineSec!, maxOffers: 2, maxActive: 2 }, cfg.orders, (seed ^ 0x5bd1e995) >>> 0 || 1)
  let t = 0, at: Kind = 'assembly', idle = 0, walking = 0, acting = 0, washing = 0, restocking = 0, discarded = 0
  let fires = 0, lastFire = false
  let firstPaidServeSec: number | null = null, washBatches = 0, restockTrips = 0
  const waits: number[] = [], orderWaits: number[] = [], starts = new Map<number, number>(), arrivals = new Map<number, number>()
  const known = new Set<number>()
  const blocks: Record<string, number> = {}
  const tick = (dt = DT) => {
    t += dt
    if (t > 1800) throw new Error(`Script never closed day=${day} variant=${variant} profile=${profile.name}`)
    stepKitchen(k, dt); stepShift(shift, dt)
    for (const c of shift.flow.customers) if (c.active && !known.has(c.id)) { known.add(c.id); arrivals.set(c.id, t) }
    desk.open = cfg.deliveryEnabled && !shift.over && shift.flow.arrived < cfg.customers
    stepDesk(desk, dt)
    if (k.fire && !lastFire) fires++
    lastFire = k.fire
  }
  const wait = (seconds: number) => {
    for (let left = seconds; left > 1e-9; left -= DT) tick(Math.min(DT, left))
  }
  const travel = (kind: Kind) => {
    const sec = route(at, kind) / (4 * carrySpeedFactor(k)) * profile.routeFactor
    walking += sec; wait(sec); at = kind
  }
  const go = (kind: Kind, request: InteractRequest = {}) => {
    travel(kind); acting += profile.actionSec; wait(profile.actionSec)
    const r = interact(k, stations[kind].pos, stations[kind], request)
    if (r.reason !== 'none') blocks[r.reason] = (blocks[r.reason] ?? 0) + 1
    return r
  }
  const expectAction = (kind: string, result: ReturnType<typeof interact>) => {
    if (result.kind !== kind) throw new Error(`Unexpected bot action ${result.kind}/${result.reason}, expected ${kind} day=${day} at=${at}`)
    return result
  }
  const washStep = () => {
    const started = t
    if (k.rack.ready > 0) { expectAction('take-stack', go('rack')); expectAction('shelve', go('shelf')) }
    else if (k.sink.stage === 'soaked') {
      travel('sink')
      while (k.sink.stage === 'soaked') { scrubSink(k, DT); tick() }
    } else if (k.dirty > 0) { expectAction('soak', go('sink')); washBatches++ }
    else return false
    washing += t - started; return true
  }
  const fetch = (ingredient: Ingredient) => {
    let r = go('fridge', { ingredient })
    if (r.reason === 'out-of-stock') {
      const started = t
      restockTrips++
      expectAction('take-crate', go('storeroom', { ingredient })); expectAction('restock', go('fridge'))
      restocking += t - started; r = go('fridge', { ingredient })
    }
    expectAction('take-ingredient', r)
  }
  const cook = (spec: OrderSpec) => {
    while (k.plates < (spec.double ? 2 : 1)) if (!washStep()) { idle += DT; tick() }
    const meat = () => {
      fetch('patty'); const put = expectAction('place-patty', go('grill'))
      const windows = k.cfg.cook
      const ready = spec.doneness === 'rare' ? windows.rareAt : spec.doneness === 'medium' ? windows.mediumAt : windows.wellAt
      wait(ready)
      while (k.grill[put.slot]!.elapsed < ready) tick()
      if (grillCookLevel(k, put.slot) !== spec.doneness) throw new Error(`Bot cook timing drift ${JSON.stringify({ day, variant, seed, profile, target: spec.doneness, ready, slot: k.grill[put.slot], level: grillCookLevel(k, put.slot) })}`)
      expectAction('take-patty', go('grill', { slot: put.slot }))
      expectAction('add-to-burger', go('assembly'))
    }
    meat(); if (spec.double) meat()
    for (const ingredient of spec.required.filter(i => i !== 'patty')) {
      fetch(ingredient); expectAction('add-to-burger', go('assembly'))
    }
    expectAction('pick-plate', go('assembly'))
  }
  const recordWait = (c: Customer) => {
    const start = starts.get(c.id); if (start !== undefined) waits.push(t - start)
    if (shift.served > 0 && firstPaidServeSec === null) firstPaidServeSec = t
  }
  const drainSides = () => {
    for (const side of ['fries', 'drink'] as const) {
      const c = matchSide(shift.flow, side)
      if (!c || !c.burgerVerdict) continue
      const kind = side === 'fries' ? 'fryer' : 'drinks'
      expectAction(side === 'fries' ? 'fry' : 'pour', go(kind))
      const time = side === 'fries' ? FRY_SEC : DRINK_SEC
      wait(time)
      expectAction(side === 'fries' ? 'take-fries' : 'take-drink', go(kind))
      travel('serve'); acting += profile.actionSec; wait(profile.actionSec)
      const who = matchSide(shift.flow, side)
      if (!who) { discard(k); discarded++; continue }
      expectAction(side === 'fries' ? 'serve-fries' : 'serve-drink', interact(k, stations.serve.pos, stations.serve, { spec: who.spec }))
      if (settleSide(shift, who, side)) recordWait(who)
    }
  }
  wait(profile.initialReadSec)
  while (!shift.over || deskBusy(desk)) {
    if (shift.flow.customers.some(c => c.active && !c.ordered && c.orderWait >= params.walkInSec!)) {
      travel('register'); acting += profile.actionSec; wait(profile.actionSec)
      takeReadyOrders(shift.flow)
      for (const c of shift.flow.customers) if (c.active && c.ordered && !starts.has(c.id)) {
        starts.set(c.id, t); orderWaits.push(t - arrivals.get(c.id)!)
      }
      continue
    }
    const c = shift.flow.customers.filter(c => c.active && c.ordered && !c.burgerVerdict).sort((a, b) => a.patienceLeft - b.patienceLeft)[0]
    if (c) {
      wait(profile.readSec); cook({ ...c.spec, required: [...c.spec.required], banned: [...c.spec.banned] })
      travel('serve'); acting += profile.actionSec; wait(profile.actionSec)
      const who = matchCustomer(shift.flow, k.burger)
      if (!who || !judge(k.burger, who.spec).ok) { expectAction('discard', discard(k)); discarded++; continue }
      const result = expectAction('serve', interact(k, stations.serve.pos, stations.serve, { spec: who.spec }))
      if (settleServe(shift, who, result.verdict!)) recordWait(who)
      else drainSides()
      continue
    }
    if (acceptOffers && cfg.deliveryEnabled && desk.slots.some(d => d.status === 'offer')) {
      travel('register'); acting += profile.actionSec; wait(profile.actionSec)
      const offer = desk.slots.find(d => d.status === 'offer')
      if (offer) acceptDelivery(desk, offer)
    }
    const job = desk.slots.find(d => d.status === 'accepted')
    if (job) {
      const id = job.id
      wait(profile.readSec); cook({ ...job.spec, required: [...job.spec.required], banned: [...job.spec.banned] })
      travel('delivery'); acting += profile.actionSec; wait(profile.actionSec)
      if (job.status !== 'accepted' || job.id !== id) { expectAction('discard', discard(k)); discarded++; continue }
      const result = expectAction('serve', interact(k, stations.delivery.pos, stations.delivery, { spec: job.spec }))
      settleDelivery(desk, job, result.verdict!.ok); continue
    }
    if (!washStep()) { idle += DT; tick() }
  }
  const r = shiftResult(shift)
  if (r.arrived !== cfg.customers || r.served + r.lateServed + r.wrong + r.walkedOut + r.leftLate !== r.arrived) throw new Error('Diner accounting failed')
  const carry = k.carry
  const accounted = k.plates + k.spare + k.dirty + k.sink.count + k.rack.count + k.rack.ready + k.broken + k.returning.filter(n => n > 0).length +
    ((carry.kind === 'patty' && carry.plated) ? 1 : 0) + (carry.kind === 'stack' ? carry.count : 0) + ((k.assemblyOccupied || carry.kind === 'plate') && k.burgerPlated ? 1 : 0)
  if (accounted !== shelfCap(cfg.progress) + params.sparePlates!) throw new Error('Plate accounting failed')
  return { ...r, durationSec: t, peak: shift.flow.peakConcurrent, stars: starsForShift(r), idleSec: idle, walkSec: walking, actionSec: acting,
    washSec: washing, restockSec: restocking, waits, orderWaits, discarded, fires, burnt: k.burnt, blocks,
    firstPaidServeSec, washBatches, restockTrips,
    delivery: { served: desk.delivered, late: desk.late, rejected: desk.rejected, wrong: desk.wrong } }
}
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
const percentile = (values: number[], p: number) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]! : null
function aggregate(day: number, variant: Variant, profile: Profile, owned: string[] = [], acceptOffers = true, patch: PolicyPatch = {}, detail = false) {
  const runs = SEEDS.map(seed => play(day, variant, seed, profile, owned, acceptOffers, patch))
  const metrics = ['goodRate', 'served', 'lateServed', 'wrong', 'walkedOut', 'leftLate', 'timedOut', 'durationSec', 'idleSec', 'walkSec', 'actionSec', 'washSec', 'restockSec', 'discarded', 'fires', 'burnt', 'peak'] as const
  const averaged = Object.fromEntries(metrics.map(key => [key, mean(runs.map(r => r[key]))])) as Record<typeof metrics[number], number>
  return { day, variant, profile: profile.name, owned, acceptOffers, config: config(day, variant, SEEDS[0]!, owned, patch),
    ...averaged,
    passRate: runs.filter(r => r.stars >= 1).length / runs.length, threeStarRate: runs.filter(r => r.stars === 3).length / runs.length,
    starsHistogram: [0, 1, 2, 3].map(stars => runs.filter(r => r.stars === stars).length),
    waitSec: mean(runs.flatMap(r => r.waits)), waitP95: percentile(runs.flatMap(r => r.waits), 0.95),
    orderWaitSec: mean(runs.flatMap(r => r.orderWaits)), orderWaitP95: percentile(runs.flatMap(r => r.orderWaits), 0.95),
    delivery: Object.fromEntries(['served', 'late', 'rejected', 'wrong'].map(key => [key, mean(runs.map(r => r.delivery[key as keyof typeof r.delivery]))])),
    ...(detail ? { firstPaidServeSec: mean(runs.flatMap(r => r.firstPaidServeSec === null ? [] : [r.firstPaidServeSec])),
      firstPaidServeMissing: runs.filter(r => r.firstPaidServeSec === null).length,
      washBatches: mean(runs.map(r => r.washBatches)), restockTrips: mean(runs.map(r => r.restockTrips)) } : {}),
    seeds: runs.map((r, i) => ({ seed: SEEDS[i], arrived: r.arrived, served: r.served, goodRate: r.goodRate, stars: r.stars,
      lateServed: r.lateServed, walkedOut: r.walkedOut, leftLate: r.leftLate, wrong: r.wrong, durationSec: r.durationSec,
      waitSec: mean(r.waits), waitP95: percentile(r.waits, 0.95), orderWaitSec: mean(r.orderWaits), burnt: r.burnt, fires: r.fires, discarded: r.discarded, delivery: r.delivery })) }
}
function forcedFireProbe() {
  const k = createKitchen({ stations: Object.values(stations), cook: { ...DEFAULT_COOK }, grillSlots: 2, fireSec: FIRE_SEC })
  const use = (kind: Kind, request: InteractRequest = {}) => interact(k, stations[kind].pos, stations[kind], request)
  use('fridge', { ingredient: 'patty' }); const placed = use('grill')
  if (placed.kind !== 'place-patty') throw new Error('Fire probe anchor failed')
  stepKitchen(k, DEFAULT_COOK.burntAt)
  if (k.fire || k.burnt !== 1) throw new Error('Burn threshold drift')
  stepKitchen(k, FIRE_SEC - 0.001)
  if (k.fire) throw new Error('Fire happened early')
  stepKitchen(k, 0.002)
  if (!k.fire || k.fires !== 1) throw new Error('Missing forced fire')
  if (use('grill').reason !== 'on-fire') throw new Error('Burning grill not blocked')
  const recoveryTravelSec = 2 * route('grill', 'extinguisher') / 4
  if (use('extinguisher').kind !== 'take-extinguisher' || use('grill').kind !== 'extinguish' || k.fire) throw new Error('Fire recovery failed')
  return { burntAtSec: DEFAULT_COOK.burntAt, fireAtSec: DEFAULT_COOK.burntAt + FIRE_SEC, recoveryTravelSec,
    recoveryActionSec: 2 * PROFILES[0]!.actionSec, forced: true, incidenceEstimated: false }
}
if (process.argv[4] === 'sensitivity' || process.argv[4] === 'confirm') {
  const short = (day: number): PolicyPatch => day <= 3 ? { customers: [4, 6, 8][day - 1], intervalSec: [35, 36, 36][day - 1] } : {}
  const ramp = (day: number): PolicyPatch => day === 5 ? { intervalSec: 28.5, intervalJitter: 0.35, maxConcurrent: 4, doubleChance: 0.2 } : {}
  const candidates: Array<{ id: string; variant: Variant; patch: (day: number) => PolicyPatch }> = [
    { id: 'current', variant: 'current', patch: () => ({}) },
    { id: 'staged', variant: 'staged', patch: () => ({}) },
    { id: 'short-intro', variant: 'staged', patch: short },
    { id: 'ramp', variant: 'staged', patch: ramp },
    { id: 'short-ramp', variant: 'staged', patch: day => ({ ...short(day), ...ramp(day) }) },
    { id: 'short-arrival', variant: 'staged', patch: day => ({ ...short(day), ...(day === 5 ? { intervalSec: 28.5 } : {}) }) },
    { id: 'day5-arrival', variant: 'staged', patch: day => day === 5 ? { intervalSec: 28.5 } : {} },
    { id: 'day5-jitter', variant: 'staged', patch: day => day === 5 ? { intervalJitter: 0.35 } : {} },
    { id: 'day5-concurrent', variant: 'staged', patch: day => day === 5 ? { maxConcurrent: 4 } : {} },
    { id: 'day5-double', variant: 'staged', patch: day => day === 5 ? { doubleChance: 0.2 } : {} },
    { id: 'no-delivery-day4-5', variant: 'staged', patch: day => day === 4 || day === 5 ? { deliveryEnabled: false } : {} },
    { id: 'no-double-day4-5', variant: 'staged', patch: day => day === 4 || day === 5 ? { doubleChance: 0 } : {} },
  ]
  const experiments = process.argv[4] === 'confirm' ? candidates.filter(e => ['current', 'staged', 'short-intro', 'short-arrival'].includes(e.id)) : candidates
  const rows = experiments.flatMap(experiment => PROFILES.flatMap(profile => [1, 2, 3, 4, 5, 6].map(day => ({
    experiment: experiment.id, ...aggregate(day, experiment.variant, profile, [], true, experiment.patch(day), true) }))))
  const upgrades = experiments.filter(e => ['short-intro', 'short-ramp', 'short-arrival'].includes(e.id)).flatMap(experiment => OWNERSHIP.slice(1).flatMap(owned =>
    [1, 5, 6].map(day => ({ experiment: experiment.id, ...aggregate(day, experiment.variant, PROFILES[1]!, owned, true, experiment.patch(day), true) }))))
  for (const profile of PROFILES) {
    const reference = rows.find(row => row.experiment === 'current' && row.profile === profile.name && row.day === 6)!
    for (const candidate of rows.filter(row => row.day === 6 && row.profile === profile.name)) {
      if (JSON.stringify({ ...candidate, experiment: 'current', variant: 'current' }) !== JSON.stringify(reference)) throw new Error('Sensitivity changed day 6')
    }
  }
  for (const owned of OWNERSHIP.slice(1)) {
    const reference = aggregate(6, 'current', PROFILES[1]!, owned, true, {}, true)
    for (const candidate of upgrades.filter(row => row.day === 6 && JSON.stringify(row.owned) === JSON.stringify(owned))) {
      const { experiment, ...result } = candidate
      if (JSON.stringify({ ...result, variant: 'current' }) !== JSON.stringify(reference)) throw new Error('Sensitivity changed purchased upgrades on day 6')
    }
  }
  let latePatchRejected = false
  try { config(6, 'staged', 1000, [], { customers: 1 }) }
  catch (error) {
    if (!(error instanceof Error) || !error.message.includes('cannot alter day 6')) throw error
    latePatchRejected = true
  }
  if (!latePatchRejected) throw new Error('Late sensitivity patch accepted')
  const sensitivity = { schema: 1, snapshotSha256: crypto.createHash('sha256').update(sourceInput).digest('hex'), layout: snapshot.layout, seeds: SEEDS,
    seedPurpose: process.argv[4] === 'confirm' ? 'confirmation' : 'selection',
    profiles: PROFILES, experiments: experiments.map(e => ({ id: e.id, variant: e.variant, patches: [1, 2, 3, 4, 5, 6].map(day => e.patch(day)) })),
    rows, upgrades, productChanged: false, checks: { day6Equal: true, purchasedUpgradesEqual: true, latePatchRejected, accounting: true, plates: true },
    runs: (rows.length + upgrades.length) * SEEDS.length + 2 * SEEDS.length }
  fs.writeFileSync(output, JSON.stringify(sensitivity, null, 2) + '\n')
  console.log(JSON.stringify({ output, checks: sensitivity.checks, runs: sensitivity.runs }))
  for (const experiment of experiments) {
    const selected = rows.filter(row => row.experiment === experiment.id && row.profile === 'learning-delay')
    console.log(JSON.stringify({ experiment: experiment.id, days: selected.map(row => ({ day: row.day, goodRate: row.goodRate, passRate: row.passRate,
      durationSec: row.durationSec, firstPaidServeSec: row.firstPaidServeSec, washBatches: row.washBatches, restockTrips: row.restockTrips })) }))
  }
} else {
const rows = []
for (const profile of PROFILES) for (const day of [1, 2, 3, 4, 5, 6, 10, 14, 18, 20]) {
  for (const variant of (day <= 5 ? ['current', 'patience-only', 'flow-only', 'staged'] : ['current', 'staged']) as Variant[]) rows.push(aggregate(day, variant, profile))
}
const upgrades = OWNERSHIP.slice(1).flatMap(owned => [1, 5, 10, 20].flatMap(day => ['current', 'staged'].map(variant => aggregate(day, variant as Variant, PROFILES[1]!, owned))))
const deliveryAblation = [1, 4, 10].map(day => aggregate(day, 'current', PROFILES[1]!, [], false))
const cookCaptureAblation = [1, 2, 3, 4, 5].flatMap(day => [2.5, 3.5, 5].map(actionSec => aggregate(day, 'current', { ...PROFILES[2]!, name: `decision-delay-${actionSec}`, readSec: 8, actionSec })))
const core = Array.from({ length: LAST_DAY }, (_, i) => {
  const day = i + 1, d = difficultyForDay(day), coreKinds = ['fridge', 'grill', 'assembly', 'serve'] as Kind[]
  const layout = { ...defaultSimConfig().layout, ...Object.fromEntries(coreKinds.map(kind => [kind, stations[kind].pos])), routeDistances: coreKinds.flatMap(a => coreKinds.map(b => route(a, b))) }
  const runs = SEEDS.map(seed => runDay({ ...defaultSimConfig(), seed, layout, flow: d.flow, orders: d.orders }))
  return { day, served: mean(runs.map(r => r.served)), completion: mean(runs.map(r => r.completionRate)), burnt: mean(runs.map(r => r.burnt)), idleSec: mean(runs.map(r => r.idleSec)), stars: d.stars }
})
for (const profile of PROFILES) for (const day of [6, 10, 14, 18, 20]) {
  const current = rows.find(row => row.profile === profile.name && row.day === day && row.variant === 'current')!
  const staged = rows.find(row => row.profile === profile.name && row.day === day && row.variant === 'staged')!
  if (JSON.stringify({ ...current, variant: 'staged' }) !== JSON.stringify(staged)) throw new Error(`Later-game regression ${day}/${profile.name}`)
}
for (const owned of OWNERSHIP) for (let day = 6; day <= LAST_DAY; day++) {
  if (JSON.stringify(config(day, 'current', 1000, owned)) !== JSON.stringify(config(day, 'staged', 1000, owned))) throw new Error('Later configuration or upgrade drift')
}
for (const current of upgrades.filter(row => row.variant === 'current' && row.day >= 6)) {
  const staged = upgrades.find(row => row.variant === 'staged' && row.day === current.day && JSON.stringify(row.owned) === JSON.stringify(current.owned))!
  if (JSON.stringify({ ...current, variant: 'staged' }) !== JSON.stringify(staged)) throw new Error('Later purchased-upgrade regression')
}
const probe = play(1, 'staged', SEEDS[0]!, PROFILES[2]!)
if (JSON.stringify(probe) !== JSON.stringify(play(1, 'staged', SEEDS[0]!, PROFILES[2]!))) throw new Error('Non-deterministic script')
const result = { schema: 1, snapshotSha256: crypto.createHash('sha256').update(sourceInput).digest('hex'), layout: snapshot.layout, seeds: SEEDS, timestepSec: DT,
  profiles: PROFILES, earlyProposal: EARLY, productChanged: false,
  limitations: ['Scripted chef uses centre-to-centre navigation costs, not joystick movement.', 'Serial correct cooking, no simultaneous batch planning; reaction times are assumptions, not human measurements.',
    'Wait statistics include completed orders only, so failures are reported separately.', 'Wash/restock seconds include travel and overlap walk/action totals; do not add these columns.',
    'Ignores rant animation closing delay and witness/review side effects; shift stars use actual goodRate.', 'Delivery recipe has no sides/doubles in runtime; bot shares diner difficulty only where rollSpec uses it.'],
  core, rows, upgrades, deliveryAblation, decisionDelay: cookCaptureAblation, fireProbe: forcedFireProbe(),
  checks: { accounting: true, plates: true, repeatable: true, day6PlusEqual: true, firstDaySingleConcurrent: rows.filter(row => row.day === 1 && row.variant === 'staged').every(row => row.peak === 1) } }
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ output, checks: result.checks, runs: (rows.length + upgrades.length + deliveryAblation.length + cookCaptureAblation.length + core.length) * SEEDS.length }))
for (const row of rows.filter(row => row.profile === 'learning-delay' && row.day <= 6)) console.log(JSON.stringify({ day: row.day, variant: row.variant, goodRate: row.goodRate, passRate: row.passRate, waitP95: row.waitP95, walkedOut: row.walkedOut, late: row.lateServed, leftLate: row.leftLate, durationSec: row.durationSec }))
}
