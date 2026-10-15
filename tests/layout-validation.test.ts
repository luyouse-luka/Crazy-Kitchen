import { describe, expect, it } from 'vitest'
import { defaultLayout, buildLayoutGeometry, validateLayout, canUseStation, safeLayoutPosition } from '../game/assets/logic/layout'

describe('editable kitchen safety', () => {
  it('accepts the live default and places the fridge near storage without corner workstations', () => {
    const d = defaultLayout()
    expect(d.stations.fridge).toEqual({ x: 3.5, z: -2.5, quarterTurn: 0 })
    expect(d.stations.assembly.z).toBe(-2.5)
    expect(d.stations.shelf.z).toBe(0)
    expect(Math.hypot(d.stations.fridge.x - 6.5, d.stations.fridge.z + 5.5)).toBeLessThan(4.3)
    expect(validateLayout(d, ['fryer', 'drinks'])).toEqual({ ok: true, issues: [] })
  })
  it('rejects overlap, outside, sealed gates and inaccessible fronts', () => {
    const d = defaultLayout()
    expect(validateLayout(d, []).ok).toBe(true)
    d.stations.fridge = { ...d.stations.grill }
    expect(validateLayout(d, []).issues.some(i => i.code === 'overlap')).toBe(true)
    d.stations.fridge.x = 100
    expect(validateLayout(d, []).issues.some(i => i.code === 'outside')).toBe(true)
    const gate = defaultLayout()
    gate.stations.assembly = { x: 6.25, z: -2.5, quarterTurn: 0 }
    expect(validateLayout(gate, []).issues.some(i => i.code === 'gate' || i.code === 'aisle')).toBe(true)
    const back = defaultLayout(); back.stations.fridge.quarterTurn = 2
    expect(validateLayout(back, []).issues.some(i => i.code === 'access')).toBe(true)
  })
  it('uses the actual rotated face and rejects intervening blockers', () => {
    const d = defaultLayout(); d.stations.grill = { x: 0, z: 0, quarterTurn: 1 }
    const g = buildLayoutGeometry(d), s = g.stations.find(s => s.kind === 'grill')!
    expect(canUseStation({ x: 1, z: 0 }, s, g.blockers)).toBe(true)
    expect(canUseStation({ x: -1, z: 0 }, s, g.blockers)).toBe(false)
    expect(canUseStation({ x: 1, z: 0 }, s, [...g.blockers, { center: { x: .8, z: 0 }, halfX: .1, halfZ: .5 }])).toBe(false)
    expect(safeLayoutPosition(defaultLayout(), { x: 0, z: 0 })).toBe(true)
    expect(safeLayoutPosition(defaultLayout(), { x: 3.5, z: -2.5 })).toBe(false)
  })
  it('enforces service lanes, owned devices and the 1.5m corridor', () => {
    const d = defaultLayout(); d.stations.register.z = 0
    expect(validateLayout(d, []).issues.some(i => i.code === 'service')).toBe(true)
    const locked = defaultLayout(); locked.stations.fryer.x = 0
    expect(validateLayout(locked, []).ok).toBe(false)
    const narrow = defaultLayout(); narrow.stations.assembly = { x: 6.25, z: -1.8, quarterTurn: 1 }
    expect(validateLayout(narrow, []).ok).toBe(false)
  })
})
