import { describe, expect, it } from 'vitest'
import { ChefMotion, solveElbow } from '../game/assets/scripts/ChefMotion'
import { COOK_APPEARANCE } from '../game/assets/scripts/CookAppearance'
import { COOK_LEVELS } from '../game/assets/logic/types'
import type { Station } from '../game/assets/logic/types'
import { createKitchen, grillCookLevel, interact, resetKitchen, stepKitchen } from '../game/assets/logic/kitchen'

const frame = { running: true, moving: false, carrying: false, scrubbing: false, holding: false, sinkInReach: false }
const target = { x: 2, y: .8, z: 3 }

describe('chef presentation lifecycle', () => {
  it('only successful interaction results trigger a reach, without a gameplay callback', () => {
    const m = new ChefMotion()
    m.notify('blocked', target)
    expect(m.action).toBe(null)
    m.notify('place-patty', target)
    m.step(frame, .08)
    expect(m.action).toBe('place')
    expect(m.reach).toBeGreaterThan(0)
    expect(m.target).toEqual(target)
    m.step(frame, 1)
    expect(m.action).toBe(null)
  })
  it('walking cancels a reach and keeps the carry pose available', () => {
    const m = new ChefMotion()
    m.notify('pick-plate', target)
    m.step({ ...frame, moving: true, carrying: true }, .1)
    expect(m.action).toBe(null)
    expect(m.carryWeight).toBeGreaterThan(0)
  })
  it.each(['holding', 'sinkInReach', 'scrubbing', 'running'] as const)('scrub stops immediately when %s becomes false', field => {
    const m = new ChefMotion()
    const scrub = { ...frame, scrubbing: true, holding: true, sinkInReach: true }
    m.step(scrub, .1)
    expect(m.action).toBe('scrub')
    m.step({ ...scrub, [field]: false }, .016)
    expect(m.action).toBe(null)
    expect(m.reach).toBe(0)
  })
  it('walking interrupts scrubbing and reset removes all transient state', () => {
    const m = new ChefMotion()
    m.step({ ...frame, scrubbing: true, holding: true, sinkInReach: true, moving: true }, .1)
    expect(m.action).toBe(null)
    m.notify('take-patty', target)
    m.reset()
    expect(m.action).toBe(null)
    expect(m.target).toBe(null)
    expect(m.carryWeight).toBe(0)
    expect(m.clock).toBe(0)
  })
  it('does not restart the reach just because a hand stays full', () => {
    const m = new ChefMotion()
    for (let i = 0; i < 90; i++) m.step({ ...frame, carrying: true }, 1 / 60)
    expect(m.action).toBe(null)
    expect(m.carryWeight).toBeCloseTo(1, 3)
  })
  it('discard cancels the previous pickup instead of completing a stale reach', () => {
    const m = new ChefMotion()
    m.notify('take-patty', target)
    m.step(frame, .05)
    m.notify('discard', null)
    expect(m.action).toBe(null)
    expect(m.reach).toBe(0)
  })
})

describe('free throw presentation', () => {
  it('winds up while walking with food, without starting a release', () => {
    const m = new ChefMotion()
    m.step({ ...frame, moving: true, carrying: true, throwCharge: .5 }, .016)
    expect(m.action).toBe('windup')
    expect(m.reach).toBeGreaterThan(0)
    expect(m.reach).toBeLessThan(1)
    expect(m.target).toBe(null)
    m.step({ ...frame, carrying: true, throwCharge: 1 }, .016)
    expect(m.action).toBe('windup')
    expect(m.reach).toBe(1)
  })
  it('cancels a windup when the touch ends, leaves the zone or opens a panel', () => {
    const m = new ChefMotion()
    m.step({ ...frame, carrying: true, throwCharge: .8 }, .1)
    expect(m.action).toBe('windup')
    m.step({ ...frame, carrying: true, throwCharge: 0 }, .016)
    expect(m.action).toBe(null)
    expect(m.reach).toBe(0)
    expect(m.carryWeight).toBeGreaterThan(0)
  })
  it('does not wind up with empty hands or an invalid charge', () => {
    const m = new ChefMotion()
    m.step({ ...frame, throwCharge: 1 }, .016)
    expect(m.action).toBe(null)
    m.step({ ...frame, carrying: true, throwCharge: NaN }, .016)
    expect(m.action).toBe(null)
  })
  it.each([true, false])('keeps the original one-handed=%s pose through a successful release while moving', single => {
    const m = new ChefMotion()
    m.releaseThrow(single)
    m.step({ ...frame, moving: true }, .05)
    expect(m.action).toBe('throw')
    expect(m.throwOneHanded).toBe(single)
    expect(m.throwProgress).toBeGreaterThan(0)
    expect(m.reach).toBeGreaterThan(0)
    m.step(frame, 1)
    expect(m.action).toBe(null)
    expect(m.reach).toBe(0)
  })
  it('stops release on hide or reset and does not replay it on resume', () => {
    const m = new ChefMotion()
    m.releaseThrow(true)
    m.step({ ...frame, running: false }, .016)
    expect(m.action).toBe(null)
    expect(m.throwProgress).toBe(0)
    m.step(frame, .016)
    expect(m.action).toBe(null)
  })
  it('lets the next successful interaction replace the throw follow-through', () => {
    const m = new ChefMotion()
    m.releaseThrow(true)
    m.step(frame, .05)
    m.notify('take-ingredient', target)
    m.step({ ...frame, carrying: true }, .05)
    expect(m.action).toBe('pick')
    expect(m.target).toEqual(target)
  })
})

describe('arm geometry', () => {
  it.each([.1, .25, .35, .7])('keeps both segments at their measured bone lengths for target distance %s', z => {
    const result = solveElbow({ x: 0, y: 0, z: 0 }, { x: 0, y: -.05, z }, .17, .23, { x: 1, y: -.6, z: 0 })
    expect(Math.hypot(result.elbow.x, result.elbow.y, result.elbow.z)).toBeCloseTo(.17, 5)
    expect(Math.hypot(result.hand.x - result.elbow.x, result.hand.y - result.elbow.y, result.hand.z - result.elbow.z)).toBeCloseTo(.23, 5)
    expect(Object.values(result.elbow).every(Number.isFinite)).toBe(true)
  })
})

describe('one appearance per actual cook level', () => {
  it('covers all five levels with descending brightness, rising char and smoke only for burnt food', () => {
    const values = COOK_LEVELS.map(level => COOK_APPEARANCE[level])
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!.rgb.reduce((a, b) => a + b, 0)).toBeLessThan(values[i - 1]!.rgb.reduce((a, b) => a + b, 0))
      expect(values[i]!.char).toBeGreaterThan(values[i - 1]!.char)
    }
    expect(values.map(v => v.smoke)).toEqual([false, false, false, false, true])
    expect(new Set(values.map(v => v.rgb.join())).size).toBe(5)
  })
  it.each([0, 3, 6, 9, 13])('preserves true doneness at %s seconds from stove through held plate and burger', elapsed => {
    const station = (kind: Station['kind'], x: number): Station => ({ id: kind, kind, pos: { x, z: 0 }, box: { center: { x, z: 0 }, halfX: .5, halfZ: .5 }, triggerRange: 1 })
    const fridge = station('fridge', 0), grill = station('grill', 3), assembly = station('assembly', 6)
    const k = createKitchen({ stations: [fridge, grill, assembly], cook: { rareAt: 3, mediumAt: 6, wellAt: 9, burntAt: 13 }, grillSlots: 2, plates: 5 })
    const m = new ChefMotion()
    const take = interact(k, fridge.pos, fridge, { ingredient: 'patty' })
    m.notify(take.kind, target)
    const place = interact(k, grill.pos, grill)
    m.notify(place.kind, target)
    stepKitchen(k, elapsed)
    const cook = grillCookLevel(k, 0)
    const remove = interact(k, grill.pos, grill)
    m.notify(remove.kind, target)
    expect(k.carry.cook).toBe(cook)
    interact(k, assembly.pos, assembly)
    expect(k.burger.cook).toBe(cook)
    expect(COOK_APPEARANCE[k.burger.cook!]).toBe(COOK_APPEARANCE[cook])
    const before = JSON.stringify(k)
    for (let i = 0; i < 60; i++) m.step({ ...frame, carrying: true }, 1 / 60)
    expect(JSON.stringify(k)).toBe(before)
    resetKitchen(k)
    m.reset()
    expect(k.carry.kind).toBe('none')
    expect(m.action).toBe(null)
  })
})
