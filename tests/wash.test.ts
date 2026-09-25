import { describe, expect, it } from 'vitest'
import {
  bumpStack,
  carrySpeedFactor,
  createKitchen,
  discard,
  interact,
  plateOut,
  releaseScrub,
  resetKitchen,
  scrubSink,
  STACK_MAX,
  stationInReach,
  STACK_SLOW_SPEED,
  stepKitchen,
} from '../game/assets/logic/kitchen'
import type { KitchenState } from '../game/assets/logic/kitchen'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'
import type { Station, StationKind } from '../game/assets/logic/types'

const station = (id: string, kind: StationKind, x: number): Station => ({
  id,
  kind,
  pos: { x, z: 0 },
  box: { center: { x, z: 0 }, halfX: 0.5, halfZ: 0.5 },
  triggerRange: 1.5,
})
const FRIDGE = station('F', 'fridge', 0)
const ASSEMBLY = station('A', 'assembly', 3)
const SINK = station('S', 'sink', 6)
const GRILL = station('G', 'grill', 9)
const SERVE = station('V', 'serve', 12)
const RACK = station('R', 'rack', 15)
const SHELF = station('P', 'shelf', 18)
const STORE = station('K', 'storeroom', 21)
const WASH = { soakSec: 4, scrubSec: 2, drySec: 6, returnSec: 8 }
const mk = (plates = 2, sparePlates?: number) =>
  createKitchen({ stations: [FRIDGE, ASSEMBLY, SINK, GRILL, SERVE, RACK, SHELF, STORE], cook: { ...DEFAULT_COOK }, grillSlots: 2, plates, sparePlates, wash: WASH })
const at = (s: Station) => ({ x: s.pos.x, z: s.pos.z })
const step = (k: KitchenState, sec: number) => {
  for (let t = 0; t < sec - 1e-9; t += 0.1) stepKitchen(k, 0.1)
}
/** Raw patty from the fridge onto the grill, then take it back off (onto a plate) */
/** Soak + scrub a batch to `scrub`, letting go there */
const washTo = (k: KitchenState, dirty: number, scrub: number) => {
  k.dirty = dirty
  interact(k, at(SINK), SINK)
  step(k, WASH.soakSec + 0.05)
  scrubSink(k, scrub * WASH.scrubSec)
}
const grillPatty = (k: KitchenState) => {
  interact(k, at(FRIDGE), FRIDGE, { ingredient: 'patty' })
  interact(k, at(GRILL), GRILL)
  step(k, 1)
  return interact(k, at(GRILL), GRILL)
}

describe('盘子', () => {
  it('取肉占一个干净盘；没盘取不了肉，肉留在烤位上', () => {
    const k = mk(1)
    expect(grillPatty(k).kind).toBe('take-patty')
    expect(k.plates).toBe(0)
    expect(k.carry.plated).toBe(true)
    discard(k)
    expect(k.dirty).toBe(1)
    expect(grillPatty(k).reason).toBe('no-plate')
    expect(k.grill.some((g) => g.busy)).toBe(true)
  })

  it('面包先上组装台不占盘；肉连盘放上去，端走再丢，脏的还是那一个', () => {
    const k = mk(1)
    interact(k, at(FRIDGE), FRIDGE, { ingredient: 'bun' })
    expect(interact(k, at(ASSEMBLY), ASSEMBLY).kind).toBe('add-to-burger')
    expect(k.plates).toBe(1)
    grillPatty(k)
    interact(k, at(ASSEMBLY), ASSEMBLY)
    expect(k.burgerPlated).toBe(true)
    interact(k, at(ASSEMBLY), ASSEMBLY) // pick the burger up
    discard(k)
    expect(k.dirty).toBe(1)
    expect(k.plates).toBe(0)
  })

  it('上菜时盘子跟着走：堂食送回脏盘', () => {
    const k = mk(1)
    interact(k, at(FRIDGE), FRIDGE, { ingredient: 'bun' })
    interact(k, at(ASSEMBLY), ASSEMBLY)
    grillPatty(k)
    interact(k, at(ASSEMBLY), ASSEMBLY)
    interact(k, at(ASSEMBLY), ASSEMBLY)
    const spec = { required: ['bun', 'patty'] as const, banned: [], doneness: 'rare' as const, patience: 99 }
    expect(interact(k, at(SERVE), SERVE, { spec: { ...spec, required: [...spec.required] } }).kind).toBe('serve')
    step(k, 8.1)
    expect(k.dirty).toBe(1)
  })

  it('堂食过 returnSec 送回一个脏盘；外卖盘子当场回架', () => {
    const k = mk(0)
    plateOut(k, true)
    step(k, 7.9)
    expect(k.dirty).toBe(0)
    step(k, 0.2)
    expect(k.dirty).toBe(1)
    plateOut(k, false)
    expect(k.plates).toBe(1)
  })

  it('不限盘（模拟器）时 plateOut 什么都不做', () => {
    const k = createKitchen({ stations: [], cook: { ...DEFAULT_COOK }, grillSlots: 2 })
    plateOut(k, true)
    step(k, 20)
    expect(k.dirty).toBe(0)
    expect(k.plates).toBe(Infinity)
  })
})

describe('洗碗：泡 → 刷 → 晾', () => {
  it('完整走一遍：晾好留在架子上，搬到放盘处才能用', () => {
    const k = mk(0)
    k.dirty = 3
    expect(interact(k, at(SINK), SINK).kind).toBe('soak')
    expect(k.dirty).toBe(0)
    expect(scrubSink(k, 1)).toBe(false) // still soaking
    expect(interact(k, at(SINK), SINK).reason).toBe('still-soaking')
    step(k, 4.05)
    expect(k.sink.stage).toBe('soaked')
    for (let t = 0; t < 2.05; t += 0.1) scrubSink(k, 0.1)
    expect(k.sink.stage).toBe('empty')
    expect(k.rack.count).toBe(3)
    step(k, 6.05)
    expect(k.plates).toBe(0)
    expect(k.rack.ready).toBe(3)
    expect(interact(k, at(SHELF), SHELF).reason).toBe('hands-empty')
    expect(interact(k, at(RACK), RACK).kind).toBe('take-stack')
    expect(k.carry.count).toBe(3)
    expect(interact(k, at(SHELF), SHELF).kind).toBe('shelve')
    expect(k.plates).toBe(3)
    expect(k.stained).toBe(0)
  })

  it('刷过一半松手 = 偷工：带污渍上架，取肉先用它，端给堂食记一次', () => {
    const k = mk(0)
    washTo(k, 1, 0.6)
    expect(releaseScrub(k)).toBe(true)
    expect(k.rack.stained).toBe(true)
    step(k, WASH.drySec + 0.05)
    interact(k, at(RACK), RACK)
    interact(k, at(SHELF), SHELF)
    expect(k.stained).toBe(1)
    grillPatty(k)
    expect(k.carry.stained).toBe(true)
    expect(k.stained).toBe(0)
    interact(k, at(ASSEMBLY), ASSEMBLY)
    interact(k, at(FRIDGE), FRIDGE, { ingredient: 'bun' })
    interact(k, at(ASSEMBLY), ASSEMBLY)
    interact(k, at(ASSEMBLY), ASSEMBLY)
    const r = interact(k, at(SERVE), SERVE, { spec: { required: ['bun', 'patty'], banned: [], doneness: 'medium', patience: 60 } })
    expect(r.kind).toBe('serve')
    expect(k.stainedServed).toBe(1)
  })

  it('刷得太少松手不算偷工，进度留着', () => {
    const k = mk(0)
    washTo(k, 2, 0.3)
    expect(releaseScrub(k)).toBe(false)
    expect(k.sink.stage).toBe('soaked')
    expect(k.sink.scrub).toBeCloseTo(0.3)
  })

  it('放回烤炉的生肉把那个带污渍的盘子原样还回去', () => {
    const k = mk(1)
    k.stained = 1
    interact(k, at(FRIDGE), FRIDGE, { ingredient: 'patty' })
    interact(k, at(GRILL), GRILL)
    interact(k, at(GRILL), GRILL) // raw, on the stained plate
    expect(k.carry.stained).toBe(true)
    interact(k, at(GRILL), GRILL)
    expect(k.plates).toBe(1)
    expect(k.stained).toBe(1)
  })
})

describe('搬盘子：叠太多变慢、撞墙全摔', () => {
  const withReady = (n: number) => {
    const k = mk(0)
    k.rack.ready = n
    interact(k, at(RACK), RACK)
    return k
  }

  it(`一趟最多 ${STACK_MAX} 个，满了再拿被拒，剩下的留在架子上`, () => {
    const k = withReady(STACK_MAX + 2)
    expect(k.carry.count).toBe(STACK_MAX)
    expect(interact(k, at(RACK), RACK).reason).toBe('stack-full')
    expect(k.rack.ready).toBe(2)
  })

  it('手上的摞没满可以接着往上叠', () => {
    const k = withReady(2)
    k.rack.ready = 2
    interact(k, at(RACK), RACK)
    expect(k.carry.count).toBe(4)
  })

  it('3 个以内不减速、撞了也不摔', () => {
    const k = withReady(3)
    expect(carrySpeedFactor(k)).toBe(1)
    expect(bumpStack(k, 1)).toBe(0)
    expect(k.carry.count).toBe(3)
  })

  it('超过 3 个变慢；蹭墙不摔，迎面撞上全摔', () => {
    const k = withReady(4)
    expect(carrySpeedFactor(k)).toBe(STACK_SLOW_SPEED)
    expect(bumpStack(k, 0.1)).toBe(0)
    expect(bumpStack(k, 0.9)).toBe(4)
    expect(k.broken).toBe(4)
    expect(k.crashed).toBe(1)
    expect(k.carry.kind).toBe('none')
  })

  it('端着摞丢弃 = 放回脏盘堆，不算摔', () => {
    const k = withReady(2)
    discard(k)
    expect(k.dirty).toBe(2)
    expect(k.broken).toBe(0)
  })

  it('端着摞去冰箱被拒', () => {
    const k = withReady(2)
    expect(interact(k, at(FRIDGE), FRIDGE, { ingredient: 'bun' }).reason).toBe('hands-full')
  })

  it('松手保留进度；架子没晾完刷不完', () => {
    const k = mk(0)
    k.rack.count = 1
    k.rack.left = 100
    k.sink.stage = 'soaked'
    k.sink.count = 2
    scrubSink(k, 1)
    expect(k.sink.scrub).toBeCloseTo(0.5)
    scrubSink(k, 5)
    expect(k.sink.stage).toBe('soaked')
    expect(k.sink.scrub).toBe(1)
  })

  it('没脏盘 / 手上有东西都泡不了', () => {
    const k = mk(1)
    expect(interact(k, at(SINK), SINK).reason).toBe('nothing-to-wash')
    k.dirty = 1
    interact(k, at(FRIDGE), FRIDGE, { ingredient: 'bun' })
    expect(interact(k, at(SINK), SINK).reason).toBe('hands-full')
  })
})

describe('晾碗架 / 放盘处不抢邻位', () => {
  const RACK_NEAR = station('R2', 'rack', 7)
  const SHELF_NEAR = station('P2', 'shelf', 4)
  const mkNear = () =>
    createKitchen({ stations: [ASSEMBLY, SINK, RACK_NEAR, SHELF_NEAR], cook: { ...DEFAULT_COOK }, grillSlots: 2, plates: 0, wash: WASH })
  const between = (a: Station, b: Station) => ({ x: (a.pos.x + b.pos.x) / 2 + 0.2, z: 0 })

  it('架子上没晾好的，站在洗碗池和架子中间够到的是洗碗池', () => {
    const k = mkNear()
    expect(stationInReach(k, between(SINK, RACK_NEAR))?.kind).toBe('sink')
    k.rack.ready = 2
    expect(stationInReach(k, between(SINK, RACK_NEAR))?.kind).toBe('rack')
  })

  it('没端着一摞盘子时，放盘处让给组装台', () => {
    const k = mkNear()
    const p = { x: SHELF_NEAR.pos.x - 0.2, z: 0 }
    expect(stationInReach(k, p)?.kind).toBe('assembly')
    k.rack.ready = 1
    interact(k, at(RACK_NEAR), RACK_NEAR)
    expect(stationInReach(k, p)?.kind).toBe('shelf')
  })
})

describe('冷库的备用盘子', () => {
  it('领一摞干净盘子，端去放盘处上架', () => {
    const k = mk(0, 4)
    expect(interact(k, at(STORE), STORE, { plates: true }).kind).toBe('take-stack')
    expect(k.carry).toMatchObject({ kind: 'stack', count: 4, countStained: 0 })
    expect(k.spare).toBe(0)
    expect(interact(k, at(SHELF), SHELF).kind).toBe('shelve')
    expect(k.plates).toBe(4)
  })

  it('一趟最多 STACK_MAX 个，领完了拦下', () => {
    const k = mk(0, STACK_MAX + 2)
    interact(k, at(STORE), STORE, { plates: true })
    expect(k.carry.count).toBe(STACK_MAX)
    expect(interact(k, at(STORE), STORE, { plates: true }).reason).toBe('stack-full')
    interact(k, at(SHELF), SHELF)
    interact(k, at(STORE), STORE, { plates: true })
    expect(k.carry.count).toBe(2)
    interact(k, at(SHELF), SHELF)
    expect(interact(k, at(STORE), STORE, { plates: true }).reason).toBe('out-of-stock')
  })

  it('端着备用盘子撞墙一样会摔；重开一天备用盘补满', () => {
    const k = mk(0, 4)
    interact(k, at(STORE), STORE, { plates: true })
    expect(bumpStack(k, 1)).toBe(4)
    resetKitchen(k)
    expect(k.spare).toBe(4)
    expect(k.broken).toBe(0)
  })

  it('没配备用盘子的厨房（模拟器）领不到', () => {
    expect(interact(mk(2), at(STORE), STORE, { plates: true }).reason).toBe('out-of-stock')
  })
})
