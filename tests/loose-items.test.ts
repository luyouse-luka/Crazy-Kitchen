import { describe, expect, it } from 'vitest'
import { createKitchen } from '../game/assets/logic/kitchen'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'
import { createLooseItems, putLooseItem, nearestLooseItem, pickLooseItem, clearLooseItem, stepLooseItems, canSetLooseItem, resetLooseItems, LOOSE_LIMIT } from '../game/assets/logic/loose-items'
import type { LooseWorld } from '../game/assets/logic/loose-items'

const world: LooseWorld = { bounds: { xmin: -4, xmax: 8, zmin: -6, zmax: 3.6 }, blockers: [], reserved: [] }
const at = { x: 0, z: 0 }
const kitchen = () => createKitchen({ stations: [], cook: DEFAULT_COOK, grillSlots: 2, plates: 5, fridgeCap: 12, doublePatty: true })
const flight = (s: ReturnType<typeof createLooseItems>, w = world) => { for (let i = 0; i < 120; i++) stepLooseItems(s, .016, w) }

describe('loose food ownership', () => {
  it('moves a paired raw patty and ingredient without inventory writes or aliasing', () => {
    const k = kitchen(), s = createLooseItems(), stock = [...k.stock]
    Object.assign(k.carry, { kind: 'ingredient', ingredient: 'bun', second: 'patty' })
    expect(putLooseItem(s, k, at, 0, false, world)).toBe('ok')
    expect(k.carry.kind).toBe('none'); expect(k.stock).toEqual(stock)
    k.carry.ingredient = 'cheese'
    const item = nearestLooseItem(s, at, world)!
    expect(item.payload.carry.ingredient).toBe('bun')
    expect(pickLooseItem(s, k, at, world)).toBe('ok')
    expect(k.carry).toMatchObject({ kind: 'ingredient', ingredient: 'bun', second: 'patty' })
    expect(s.items).toHaveLength(0); expect(k.stock).toEqual(stock)
  })
  it('preserves a stained plated patty without returning or taking another plate', () => {
    const k = kitchen(), s = createLooseItems(); k.plates--
    Object.assign(k.carry, { kind: 'patty', cook: 'medium', plated: true, stained: true })
    putLooseItem(s, k, at, 0, false, world)
    expect(k.dirty).toBe(0); expect(k.plates).toBe(4)
    pickLooseItem(s, k, at, world)
    expect(k.carry).toMatchObject({ kind: 'patty', cook: 'medium', plated: true, stained: true })
    expect(k.plates).toBe(4)
  })
  it('snapshots a double burger and keeps a different bench burger intact', () => {
    const k = kitchen(), s = createLooseItems()
    k.carry.kind = 'plate'; k.burger.ingredients.push('bun', 'patty', 'bacon')
    Object.assign(k.burger, { cook: 'medium', double: true, cook2: 'well' }); k.burgerPlated = true; k.burgerStained = true; k.plates--
    putLooseItem(s, k, at, 0, false, world)
    expect(k.burger.ingredients).toEqual([]); expect(k.burgerPlated).toBe(false)
    k.assemblyOccupied = true; k.burger.ingredients.push('cheese')
    expect(pickLooseItem(s, k, at, world)).toBe('bench-occupied')
    expect(k.burger.ingredients).toEqual(['cheese']); expect(s.items).toHaveLength(1)
    k.assemblyOccupied = false; k.burger.ingredients.length = 0
    expect(pickLooseItem(s, k, at, world)).toBe('ok')
    expect(k.burger).toEqual({ ingredients: ['bun', 'patty', 'bacon'], cook: 'medium', double: true, cook2: 'well' })
    expect(k.burgerPlated && k.burgerStained).toBe(true); expect(k.plates).toBe(4)
  })
  it('food-only transfers never overwrite an occupied bench', () => {
    const k = kitchen(), s = createLooseItems(); k.assemblyOccupied = true; k.burger.ingredients.push('bun'); k.carry.kind = 'patty'
    putLooseItem(s, k, at, 0, false, world); pickLooseItem(s, k, at, world)
    expect(k.assemblyOccupied).toBe(true); expect(k.burger.ingredients).toEqual(['bun'])
  })
  it('cleans an owned plate exactly once, without changing the shelf', () => {
    const k = kitchen(), s = createLooseItems(); Object.assign(k.carry, { kind: 'patty', plated: true }); k.plates--
    putLooseItem(s, k, at, 0, false, world)
    expect(clearLooseItem(s, k, at, world)).toBe('ok'); expect(k.dirty).toBe(1); expect(k.plates).toBe(4)
    expect(clearLooseItem(s, k, at, world)).toBe('not-near'); expect(k.dirty).toBe(1)
  })
  it('clearing food without a plate does not create one, including bottomless mode', () => {
    const k = kitchen(), s = createLooseItems(); k.carry.kind = 'ingredient'
    putLooseItem(s, k, at, 0, false, world); clearLooseItem(s, k, at, world); expect(k.dirty).toBe(0)
    k.cfg.plates = undefined; k.plates = Infinity; Object.assign(k.carry, { kind: 'patty', plated: true })
    putLooseItem(s, k, at, 0, false, world); clearLooseItem(s, k, at, world); expect(k.dirty).toBe(0)
  })
  it.each(['crate', 'stack', 'fries', 'drink', 'extinguisher', 'none'] as const)('does not transfer unsupported %s', kind => {
    const k = kitchen(), s = createLooseItems(); k.carry.kind = kind
    expect(canSetLooseItem(k)).toBe(false); expect(putLooseItem(s, k, at, 0, false, world)).toBe('unsupported')
    expect(k.carry.kind).toBe(kind); expect(s.items).toHaveLength(0)
  })
  it('refuses full storage without clearing hands or evicting old items', () => {
    const k = kitchen(), s = createLooseItems()
    for (let i = 0; i < LOOSE_LIMIT; i++) { k.carry.kind = 'ingredient'; expect(putLooseItem(s, k, { x: -3 + i % 8, z: -4 + Math.floor(i / 8) }, 0, false, world)).toBe('ok') }
    k.carry.kind = 'patty'; expect(putLooseItem(s, k, at, 0, true, world)).toBe('full'); expect(k.carry.kind).toBe('patty')
    expect(s.items).toHaveLength(LOOSE_LIMIT)
  })
})

describe('loose object movement and reach', () => {
  it('throws in facing direction, visibly arcs, lands and can be recovered', () => {
    const k = kitchen(), s = createLooseItems(); k.carry.kind = 'ingredient'
    putLooseItem(s, k, at, Math.PI / 2, true, world)
    const item = s.items[0]!; expect(item.y).toBeGreaterThan(.5)
    expect(pickLooseItem(s, k, at, world)).toBe('not-near')
    const start = item.x; stepLooseItems(s, .1, world)
    expect(item.x).toBeGreaterThan(start); expect(item.y).toBeGreaterThan(.85); expect(Math.abs(item.z)).toBeLessThan(.001)
    flight(s); expect(item.y).toBe(0); expect(item.flying).toBe(false)
    expect(pickLooseItem(s, k, { x: item.x, z: item.z }, world)).toBe('ok')
  })
  it('hits a wall without tunneling, even after a background-sized frame', () => {
    const k = kitchen(), s = createLooseItems(); k.carry.kind = 'patty'
    const w = { ...world, blockers: [{ center: { x: 0, z: 1.5 }, halfX: 2, halfZ: .05 }] }
    putLooseItem(s, k, at, 0, true, w); stepLooseItems(s, 30, w)
    expect(s.items[0]!.z).toBeLessThan(1.3)
    flight(s, w); expect(s.items[0]!.z).toBeLessThan(1.3); expect(s.items[0]!.y).toBe(0)
    expect(s.items[0]!.impacts).toBeGreaterThan(0)
  })
  it('never lands in reserved warehouse gates or outside the world', () => {
    const k = kitchen(), s = createLooseItems(); k.carry.kind = 'patty'
    const w = { ...world, reserved: [{ center: { x: 0, z: 1.5 }, halfX: 1, halfZ: .2 }] }
    putLooseItem(s, k, at, 0, true, w); flight(s, w)
    expect(s.items[0]!.z).toBeLessThan(1.1)
    resetLooseItems(s); k.carry.kind = 'patty'; putLooseItem(s, k, { x: 0, z: 3 }, 0, true, world); flight(s)
    expect(s.items[0]!.z).toBeLessThan(3.6)
  })
  it('keeps the full width of paired food clear of walls', () => {
    const k = kitchen(), s = createLooseItems(); Object.assign(k.carry, { kind: 'ingredient', ingredient: 'bun', second: 'patty' })
    const w = { ...world, blockers: [{ center: { x: 0, z: 1.5 }, halfX: 2, halfZ: .05 }] }
    putLooseItem(s, k, at, 0, true, w); flight(s, w)
    expect(s.items[0]!.z + .32).toBeLessThanOrEqual(1.45)
  })
  it('refuses an obstructed placement atomically and prevents through-wall pickup', () => {
    const k = kitchen(), s = createLooseItems(); k.carry.kind = 'ingredient'
    const sealed = { ...world, blockers: [{ center: at, halfX: 1, halfZ: 1 }] }
    expect(putLooseItem(s, k, at, 0, false, sealed)).toBe('no-space'); expect(k.carry.kind).toBe('ingredient')
    putLooseItem(s, k, at, 0, false, world)
    const wall = { ...world, blockers: [{ center: { x: 0, z: .25 }, halfX: 1, halfZ: .05 }] }
    expect(nearestLooseItem(s, at, wall)).toBeNull(); expect(pickLooseItem(s, k, { x: 2, z: 0 }, world)).toBe('not-near')
  })
  it('will not pick into occupied hands and daily reset drops all references', () => {
    const k = kitchen(), s = createLooseItems(); k.carry.kind = 'ingredient'; putLooseItem(s, k, at, 0, false, world)
    k.carry.kind = 'patty'; expect(pickLooseItem(s, k, at, world)).toBe('hands-full')
    resetLooseItems(s); expect(s.items).toHaveLength(0)
  })
})
