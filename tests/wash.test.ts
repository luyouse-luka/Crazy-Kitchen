import { describe, expect, it } from 'vitest'
import { createKitchen, discard, interact, plateOut, scrubSink, stepKitchen } from '../game/assets/logic/kitchen'
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
const WASH = { soakSec: 4, scrubSec: 2, drySec: 6, returnSec: 8 }
const mk = (plates = 2) =>
  createKitchen({ stations: [FRIDGE, ASSEMBLY, SINK, GRILL, SERVE], cook: { ...DEFAULT_COOK }, grillSlots: 2, plates, wash: WASH })
const at = (s: Station) => ({ x: s.pos.x, z: s.pos.z })
const step = (k: KitchenState, sec: number) => {
  for (let t = 0; t < sec - 1e-9; t += 0.1) stepKitchen(k, 0.1)
}
/** Raw patty from the fridge onto the grill, then take it back off (onto a plate) */
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
  it('完整走一遍，盘子回到放盘处', () => {
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
    expect(k.plates).toBe(3)
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
