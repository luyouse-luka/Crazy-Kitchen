import { describe, expect, it } from 'vitest'
import { buildLayoutGeometry, defaultLayout, parseLayout, rotateOffset } from '../game/assets/logic/layout'
import { LAYOUT_FIXTURES, LAYOUT_FIXED, LAYOUT_IDS } from '../game/assets/logic/scene-layout'
import { SPEC } from '../tools/scene-spec'

describe('layout data and geometry', () => {
  it('keeps the approved defaults and stable gameplay identities', () => {
    const d = defaultLayout(), g = buildLayoutGeometry(d)
    expect(d.version).toBe(1)
    expect(d.stations.fridge).toEqual({ x: 3.5, z: -2.5, quarterTurn: 0 })
    expect(d.stations.shelf).toEqual({ x: -3.5, z: 0, quarterTurn: 0 })
    expect(d.stations.assembly).toEqual({ x: -1.5, z: -2.5, quarterTurn: 0 })
    expect(d.stations.extinguisher.z).toBe(3.25)
    expect(g.stations.map(s => s.id)).toEqual([
      'Station_Fridge', 'Station_Grill', 'Station_Assembly', 'Block_Plate', 'Station_Sink',
      'Block_DishRack', 'Block_Fryer', 'Station_Drinks', 'Station_Extinguisher',
      'Station_Order', 'Station_Serve', 'Station_Delivery', 'Station_Storeroom',
    ])
  })

  it.each([0, 1, 2, 3] as const)('projects quarter turn %s from original dimensions', q => {
    const d = defaultLayout()
    d.stations.grill = { x: 0, z: 0, quarterTurn: q }
    const box = buildLayoutGeometry(d).fixtures.grill
    expect(box.halfX).toBe(q % 2 ? .5 : 1)
    expect(box.halfZ).toBe(q % 2 ? 1 : .5)
    expect(box.center).toEqual({ x: 0, z: 0 })
  })

  it('uses Cocos yaw convention and normalizes negative zero', () => {
    expect(rotateOffset({ x: 0, z: 1 }, 1)).toEqual({ x: 1, z: 0 })
    expect(rotateOffset({ x: 1, z: 0 }, 2)).toEqual({ x: -1, z: 0 })
    expect(rotateOffset({ x: 1, z: 0 }, 3)).toEqual({ x: 0, z: 1 })
    expect(rotateOffset({ x: 2, z: 3 }, 0)).toEqual({ x: 2, z: 3 })
  })

  it('keeps independent defaults, parses and projections without aliases', () => {
    const a = defaultLayout(), b = defaultLayout(), parsed = parseLayout(b)!
    a.stations.fridge.x = 4
    parsed.stations.fridge.x = 2
    const g = buildLayoutGeometry(b)
    g.fixtures.fridge.center.x = 7
    expect(b.stations.fridge.x).toBe(3.5)
    expect(defaultLayout()).toEqual(b)
    expect(parseLayout(JSON.parse(JSON.stringify(b)))).toEqual(b)
  })

  it.each([null, [], {}, { version: 2, stations: {} }, { version: 1, stations: {} }])('rejects malformed layout %j', raw => {
    expect(parseLayout(raw)).toBeNull()
  })

  it.each([
    { x: Infinity, z: 0, quarterTurn: 0 }, { x: NaN, z: 0, quarterTurn: 0 },
    { x: '0', z: 0, quarterTurn: 0 }, { x: 0, z: null, quarterTurn: 0 },
    { x: 0, z: 0, quarterTurn: 4 }, { x: 0, z: 0, quarterTurn: 1.5 },
    { x: 0, z: 0, quarterTurn: -1 }, { x: 0, z: 0, quarterTurn: '1' },
    { x: 0, z: 0 }, { x: 0, z: 0, quarterTurn: 0, uuid: 'scene-id' },
  ])('rejects malformed pose %j', pose => {
    const d = defaultLayout()
    expect(parseLayout({ ...d, stations: { ...d.stations, fridge: pose } })).toBeNull()
  })

  it('rejects unknown IDs and missing entries instead of partially applying them', () => {
    const d = defaultLayout()
    expect(parseLayout({ ...d, stations: { ...d.stations, future: d.stations.fridge } })).toBeNull()
    const stations: Record<string, unknown> = { ...d.stations }
    delete stations.sink
    expect(parseLayout({ ...d, stations })).toBeNull()
    expect(parseLayout({ ...d, extra: true })).toBeNull()
  })

  it('leaves finite out-of-bounds positions for geometric validation, without clamping', () => {
    const d = defaultLayout()
    d.stations.fridge.x = 1000
    expect(parseLayout(d)?.stations.fridge.x).toBe(1000)
  })

  it('uses one physical box for grouped equipment and a single fixed front counter', () => {
    const d = defaultLayout(), g = buildLayoutGeometry(d)
    for (const id of ['sink', 'assembly', 'drinks'] as const) {
      expect(g.blockers.filter(b => b === g.fixtures[id])).toHaveLength(1)
    }
    const counter = g.blockers.find(b => b.center.x === -.25 && b.center.z === 3.1)
    expect(counter).toMatchObject({ halfX: 3.75, halfZ: .5 })
    for (const id of ['register', 'serve', 'delivery'] as const) expect(g.blockers).not.toContain(g.fixtures[id])
    d.stations.serve.x = 1
    const moved = buildLayoutGeometry(d)
    expect(moved.blockers).toEqual(g.blockers)
    expect(moved.stations.find(s => s.kind === 'serve')?.pos.x).toBe(1)
    expect(g.stations.find(s => s.kind === 'storeroom')?.pos).toEqual({ x: 6.5, z: -5.5 })
  })

  it('rotates the drinks trigger offset while keeping the whole base footprint', () => {
    const d = defaultLayout()
    const initial = buildLayoutGeometry(d).stations.find(s => s.kind === 'drinks')!
    expect(initial.pos).toEqual({ x: 2, z: -2.7 })
    expect(initial.triggerRange).toBe(1.1)
    d.stations.drinks = { x: 0, z: 0, quarterTurn: 1 }
    const g = buildLayoutGeometry(d), s = g.stations.find(s => s.kind === 'drinks')!
    expect(s.pos).toEqual({ x: -.2, z: 0 })
    expect(s.box.halfX).toBe(.3)
    expect(s.box.halfZ).toBe(.4)
    expect(g.fixtures.drinks).toMatchObject({ center: { x: 0, z: 0 }, halfX: .5, halfZ: .5 })
  })

  it('matches the scene source for every serialized fixture and fixed obstacle', () => {
    const g = buildLayoutGeometry(defaultLayout())
    for (const id of LAYOUT_IDS) {
      const fixture = LAYOUT_FIXTURES[id], node = SPEC[fixture.node]
      if (node) {
        expect(node.pos, id).toEqual([fixture.pose.x, .45, fixture.pose.z])
        expect(node.scale, id).toEqual([fixture.width, .9, fixture.depth])
      }
      for (const art of fixture.art) {
        expect(SPEC[art.node]?.pos, art.node).toEqual([
          fixture.pose.x + art.offset[0], art.offset[1], fixture.pose.z + art.offset[2],
        ])
      }
    }
    for (const fixed of LAYOUT_FIXED.obstacles) {
      const source = SPEC[fixed.node]
      if (!source) continue
      expect(source.active, fixed.node).not.toBe(false)
      expect(source.pos, fixed.node).toEqual([fixed.x, source.pos![1], fixed.z])
      expect(source.scale, fixed.node).toEqual([fixed.width, source.scale![1], fixed.depth])
    }
    expect(g.blockers.some(b => b.center.x === 5.1 && b.center.z === -1)).toBe(false)
  })
})
