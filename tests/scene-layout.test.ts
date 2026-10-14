import { describe, expect, it } from 'vitest'
// @ts-expect-error Node builtin: this repository does not install @types/node.
import { readFileSync } from 'node:fs'
import { SPEC } from '../tools/scene-spec'
import { navigation, specBox } from '../tools/layout-navigation'
import { CHEF_RADIUS, FLOOR_BOUNDS, moveAndSlide } from '../game/assets/logic/movement'
import { circleOverlapsAABB } from '../game/assets/logic/collision'
import { hidesPoint, stepWallOpacity, WALL_FADE_OPACITY } from '../game/assets/logic/camera'
import { runDay, defaultSimConfig } from '../game/assets/logic/sim'

interface Entry {
  __type__: string
  _name: string
  _id?: string
  _parent?: { __id__: number }
  _children?: Array<{ __id__: number }>
  _components?: Array<{ __id__: number }>
  node?: { __id__: number }
  _active: boolean
  _lpos: { x: number; y: number; z: number }
  _lscale: { x: number; y: number; z: number }
  _lrot: { x: number; y: number; z: number; w: number }
}
const scene = JSON.parse(readFileSync('game/assets/main.scene', 'utf8')) as Entry[]
const nav = navigation()

describe('open-centre kitchen layout', () => {
  it('keeps the frequently used fridge and plates together in the middle of the side counter', () => {
    const fridge = specBox('Station_Fridge')
    const plates = specBox('Block_Plate')
    expect(fridge.center.z).toBe(0)
    expect(plates.center.z).toBe(1)
    expect(nav.canReach(-2.5, 0)).toBe(true)
    expect(nav.canReach(-2.5, 1)).toBe(true)
    expect(nav.access(fridge).some(id => {
      const p = nav.at(id)
      return Math.abs(p.x + 2.5) < .06 && Math.abs(p.z) < .06
    })).toBe(true)
    expect(nav.access(plates).some(id => {
      const p = nav.at(id)
      return Math.abs(p.x + 2.5) < .06 && Math.abs(p.z - 1) < .06
    })).toBe(true)
  })

  it('leaves the central floor clear for direct joystick crossings', () => {
    expect(nav.stations.length).toBeGreaterThan(0)
    for (let x = -2.5; x <= 6.5; x += 0.2) for (let z = -1.5; z <= 1.5; z += 0.2) {
      const p = { x, z }
      expect(nav.obstacles.some(b => circleOverlapsAABB(p, CHEF_RADIUS, b)), `central floor ${x},${z}`).toBe(false)
      expect(nav.canReach(x, z), `central floor ${x},${z}`).toBe(true)
    }
    const p = { x: -2.5, z: 1.5 }
    for (const [x, z] of [[6.5, -1.5], [-2.5, -1.5], [6.5, 1.5], [-3.4, 2.1]]) {
      while (Math.hypot(x! - p.x, z! - p.z) > 1e-6) {
        const d = Math.hypot(x! - p.x, z! - p.z), k = Math.min(0.05 / d, 1)
        expect(moveAndSlide(p, p, { x: (x! - p.x) * k, z: (z! - p.z) * k }, CHEF_RADIUS, nav.obstacles, FLOOR_BOUNDS)).toBe(false)
      }
    }
  })
})

describe('open-centre scene integration', () => {
  it('scene transforms, rotations and visibility match the shared specification', () => {
    for (const [name, spec] of Object.entries(SPEC)) {
      const matches = scene.filter(n => n.__type__ === 'cc.Node' && n._name === name)
      expect(matches, name).toHaveLength(1)
      const n = matches[0]!
      for (const [key, value] of [['_lpos', spec.pos], ['_lscale', spec.scale]] as const) {
        if (value) for (const [i, axis] of ['x', 'y', 'z'].entries()) {
          expect(n[key][axis as 'x' | 'y' | 'z'], name).toBeCloseTo(value[i]!, 6)
        }
      }
      if (spec.active !== undefined) expect(n._active, name).toBe(spec.active)
      if (spec.yaw !== undefined) {
        const angle = spec.yaw * Math.PI / 360
        expect(n._lrot.y, name).toBeCloseTo(Math.sin(angle), 6)
        expect(n._lrot.w, name).toBeCloseTo(Math.cos(angle), 6)
      }
    }
  })

  it('cloned nodes retain reciprocal parents and component owners, with unique serialized IDs', () => {
    const ids = scene.map(n => n._id).filter(id => id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const [i, n] of scene.entries()) {
      for (const child of n._children ?? []) expect(scene[child.__id__]!._parent?.__id__).toBe(i)
      for (const comp of n._components ?? []) expect(scene[comp.__id__]!.node?.__id__).toBe(i)
    }
  })

  it('all interaction points are accessible, while the missing L-floor corner stays blocked', () => {
    expect(nav.stations).toHaveLength(13)
    for (const station of nav.stations) expect(nav.access(station).length, station.name).toBeGreaterThan(0)
    expect(nav.canReach(0, -4.5)).toBe(false)
    expect(nav.canReach(6.5, -4.5)).toBe(true)
    expect(nav.canReach(7.5, -4.5)).toBe(false)
  })

  it('closing the cold-room gate makes storage inaccessible', () => {
    const storage = specBox('Station_Storeroom')
    expect(nav.access(storage).length).toBeGreaterThan(0)
    const blocked = navigation({ ...SPEC, Wall_Store_S: { pos: [6.5, 0.5, -3.1], scale: [3, 1, 0.2] } })
    expect(blocked.access(storage)).toHaveLength(0)
  })

  it('actual movement crosses the centre, wash aisle and cold-room gate without collision', () => {
    const p = { x: SPEC.Player!.pos![0], z: SPEC.Player!.pos![2] }
    const stops = [[2.7, 1.25], [2.7, -1.25], [0, -1.25], [2.7, -1.25], [2.7, 1.5], [6.1, 1.5], [6.1, -4.5], [6.5, -4.5]]
    for (const [x, z] of stops) {
      let steps = 0
      while (Math.hypot(x! - p.x, z! - p.z) > 1e-6 && steps++ < 200) {
        const d = Math.hypot(x! - p.x, z! - p.z), k = Math.min(0.05 / d, 1)
        expect(moveAndSlide(p, p, { x: (x! - p.x) * k, z: (z! - p.z) * k }, CHEF_RADIUS, nav.obstacles, FLOOR_BOUNDS)).toBe(false)
        expect(nav.obstacles.some(b => circleOverlapsAABB(p, CHEF_RADIUS - 1e-8, b))).toBe(false)
      }
      expect(p.x).toBeCloseTo(x!, 5)
      expect(p.z).toBeCloseTo(z!, 5)
    }
  })

  it('occluding walls fade and restore without reducing their full-height bounds', () => {
    let fullHeightHits = 0
    for (const name of Object.keys(SPEC).filter(n => n.startsWith('Wall_'))) {
      const s = SPEC[name]!, b = specBox(name), height = s.scale![1], base = s.pos![1] - height / 2
      const full = { minX: b.center.x - b.halfX, maxX: b.center.x + b.halfX, minZ: b.center.z - b.halfZ, maxZ: b.center.z + b.halfZ, minY: base, maxY: base + height }
      for (const p of nav.reachable) {
        if (!hidesPoint(full, p.x, 0.3, p.z)) continue
        fullHeightHits++
        expect(stepWallOpacity(1, true, 1), name).toBe(WALL_FADE_OPACITY)
        expect(stepWallOpacity(WALL_FADE_OPACITY, false, 1), name).toBe(1)
      }
    }
    expect(fullHeightHits).toBeGreaterThan(0)
  })

  it('the fridge no longer conceals the cold-room entrance', () => {
    const bytes: Uint8Array = readFileSync('game/assets/art/restaurant/fridge.glb')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))))
    const root = scene.find(n => n._name === 'Prop_Fridge')!
    const model = scene[root._children![0]!.__id__]!
    const top = (id: number, y = 0, scale = 1): number => {
      const n = gltf.nodes[id]
      expect(n.rotation?.[0] ?? 0).toBe(0)
      expect(n.rotation?.[2] ?? 0).toBe(0)
      const nextY = y + (n.translation?.[1] ?? 0) * scale
      const nextScale = scale * (n.scale?.[1] ?? 1)
      const own = n.mesh === undefined ? [nextY] : gltf.meshes[n.mesh].primitives.map((p: { attributes: { POSITION: number } }) =>
        nextY + gltf.accessors[p.attributes.POSITION].max[1] * nextScale)
      return Math.max(...own, ...(n.children ?? []).map((c: number) => top(c, nextY, nextScale)))
    }
    const height = Math.max(...gltf.scenes[gltf.scene ?? 0].nodes.map((n: number) => top(n))) * model._lscale.y
    const b = specBox('Station_Fridge')
    const box = { minX: b.center.x - b.halfX, maxX: b.center.x + b.halfX, minZ: b.center.z - b.halfZ, maxZ: b.center.z + b.halfZ, minY: 0, maxY: height }
    expect(hidesPoint({ ...box, minX: 4, maxX: 5, minZ: -2, maxZ: -1 }, 6.25, 0.3, -3.1, { x: -10.447, y: 10.505, z: 10.391 })).toBe(true)
    for (const x of [5.9, 6.25, 6.6]) for (const y of [0.3, 1.2, 1.75]) {
      expect(hidesPoint(box, x, y, -3.1)).toBe(false)
      expect(hidesPoint(box, x, y, -4.5)).toBe(false)
    }
  })

  it('simulation uses symmetric finite detour costs and retains spread scaling', () => {
    const routes = nav.distances()
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      expect(Number.isFinite(routes[a * 4 + b])).toBe(true)
      expect(routes[a * 4 + b]).toBe(routes[b * 4 + a])
    }
    const cfg = defaultSimConfig()
    const scaled = runDay({ ...cfg, layout: { ...cfg.layout, routeDistances: routes, spread: 2 } })
    expect(scaled).toEqual(runDay({ ...cfg, layout: { ...cfg.layout, routeDistances: routes.map(d => d * 2), spread: 1 } }))
    const slower = runDay({ ...cfg, layout: { ...cfg.layout, routeDistances: routes, spread: 10 } })
    expect(slower.completionRate).toBeLessThan(scaled.completionRate)
    expect(routes[2 * 4 + 3]).toBeGreaterThan(2.5)
  })
})
