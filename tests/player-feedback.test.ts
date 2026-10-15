import { describe, expect, it } from 'vitest'
// @ts-expect-error Node builtin without @types/node.
import { readFileSync } from 'node:fs'
import { createKitchen, interact } from '../game/assets/logic/kitchen'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'
import type { Station } from '../game/assets/logic/types'
import { approachFacingYaw, oneHandedCarry } from '../game/assets/scripts/ChefMotion'
import { actionPresentation, groundPresentation } from '../game/assets/scripts/ui/UiModel'

describe('player feedback regressions', () => {
  it.each([false, true])('shows the ground cleanup icon even when pickup is blocked: %s', occupied => {
    expect(groundPresentation('汉堡', occupied)).toMatchObject({ icon: occupied ? 'blocked' : 'pick', secondaryIcon: 'trash', gesture: 'tap' })
  })
  it('initializes live bone animation before the chef overlay instead of switching baked states after playback', () => {
    const scene = JSON.parse(readFileSync('game/assets/main.scene', 'utf8'))
    const model = scene.find((n: any) => n.__editorExtras__?.restaurantArt === 'actor-chef')
    const animation = model._components.map((r: any) => scene[r.__id__]).find((c: any) => c.__type__ === 'cc.SkeletalAnimation')
    expect(animation).toBeDefined(); expect(animation._clips).toHaveLength(3)
    expect(animation._useBakedAnimation).toBe(false)
  })
  it('single-item gameplay refuses a second pick without consuming or returning inventory', () => {
    const fridge: Station = { kind: 'fridge', id: 'f', pos: { x: 0, z: 0 }, box: { center: { x: 0, z: 0 }, halfX: .5, halfZ: .5 }, triggerRange: 1 }
    const k = createKitchen({ stations: [fridge], cook: DEFAULT_COOK, grillSlots: 2, fridgeCap: 4, singleItem: true })
    expect(interact(k, fridge.pos, fridge, { ingredient: 'bun' }).kind).toBe('take-ingredient')
    const stock = [...k.stock], carry = { ...k.carry }
    expect(interact(k, fridge.pos, fridge, { ingredient: 'patty' }).reason).toBe('hands-full')
    expect(k.carry).toEqual(carry); expect(k.stock).toEqual(stock); expect(k.carry.second).toBe(null)
  })
  it('smoothly turns on the shortest arc and stops changing once aligned', () => {
    const first = approachFacingYaw(0, Math.PI, 1 / 60)
    expect(Math.abs(first)).toBeGreaterThan(0); expect(Math.abs(first)).toBeLessThan(.2)
    expect(Math.abs(approachFacingYaw(Math.PI - .02, -Math.PI + .02, .016) - (Math.PI - .02))).toBeLessThan(.04)
    let yaw = 0
    for (let i = 0; i < 60; i++) yaw = approachFacingYaw(yaw, Math.PI, 1 / 60)
    expect(Math.abs(Math.sin(yaw / 2))).toBeCloseTo(1, 3)
    expect(approachFacingYaw(1, 1, .1)).toBe(1)
    expect(approachFacingYaw(0, 1, 0)).toBe(0)
  })
  it('keeps the free arm animated for single ingredients but uses two hands for a plated meal', () => {
    const k = createKitchen({ stations: [], cook: DEFAULT_COOK, grillSlots: 2 })
    k.carry.kind = 'ingredient'; expect(oneHandedCarry(k.carry)).toBe(true)
    k.carry.kind = 'patty'; k.carry.plated = true; expect(oneHandedCarry(k.carry)).toBe(false)
    k.carry.kind = 'plate'; expect(oneHandedCarry(k.carry)).toBe(false)
    k.carry.kind = 'none'; expect(oneHandedCarry(k.carry)).toBe(false)
  })
  it.each([['取料', 'fridge'], ['下锅', 'pan-in'], ['取肉', 'pan-out'], ['按住刷', 'wash'], ['上菜', 'serve'], ['接单', 'order'], ['泡着', 'wait'], ['先放下', 'blocked'], ['', 'move']])('uses a specific contextual icon for %s', (verb, icon) => {
    expect(actionPresentation(verb).icon).toBe(icon)
  })
})
