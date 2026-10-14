import { SPEC } from './scene-spec'
import type { NodeSpec } from './scene-spec'
import { CHEF_RADIUS, FLOOR_BOUNDS } from '../game/assets/logic/movement'
import { circleOverlapsAABB } from '../game/assets/logic/collision'
import type { AABB } from '../game/assets/logic/collision'
import { RUNTIME_SPOTS } from '../game/assets/logic/scene-layout'

export const CORE_STATIONS = ['Station_Fridge', 'Station_Grill', 'Station_Assembly', 'Station_Serve']
export const STEP = 0.1
export interface Obstacle extends AABB { name: string }
export const specBox = (name: string, spec = SPEC): Obstacle => {
  const s = spec[name]
  if (!s?.pos || !s.scale) throw new Error(`Missing geometry: ${name}`)
  return { name, center: { x: s.pos[0], z: s.pos[2] }, halfX: s.scale[0] / 2, halfZ: s.scale[2] / 2 }
}

export function navigation(spec: Record<string, NodeSpec> = SPEC) {
  const obstacles = Object.keys(spec)
    .filter(n => n.startsWith('Station_') || n.startsWith('Block_') || n.startsWith('Wall_'))
    .map(n => specBox(n, spec))
  const runtime: Obstacle[] = [
    { name: 'Station_Drinks', center: { x: RUNTIME_SPOTS.drinks[0], z: RUNTIME_SPOTS.drinks[1] }, halfX: 0.4, halfZ: 0.3 },
    { name: 'Station_Extinguisher', center: { x: RUNTIME_SPOTS.extinguisher[0], z: RUNTIME_SPOTS.extinguisher[1] }, halfX: 0.25, halfZ: 0.25 },
  ]
  obstacles.push(...runtime)
  const nx = Math.floor((FLOOR_BOUNDS.xmax - FLOOR_BOUNDS.xmin - 2 * CHEF_RADIUS) / STEP + 1e-9) + 1
  const nz = Math.floor((FLOOR_BOUNDS.zmax - FLOOR_BOUNDS.zmin - 2 * CHEF_RADIUS) / STEP + 1e-9) + 1
  const at = (id: number) => ({ x: FLOOR_BOUNDS.xmin + CHEF_RADIUS + Math.floor(id / nz) * STEP, z: FLOOR_BOUNDS.zmin + CHEF_RADIUS + (id % nz) * STEP })
  const idAt = (x: number, z: number) => Math.round((x - FLOOR_BOUNDS.xmin - CHEF_RADIUS) / STEP) * nz + Math.round((z - FLOOR_BOUNDS.zmin - CHEF_RADIUS) / STEP)
  const free = new Uint8Array(nx * nz)
  for (let id = 0; id < free.length; id++) free[id] = Number(!obstacles.some(b => circleOverlapsAABB(at(id), CHEF_RADIUS - 1e-8, b)))
  function neighbors(id: number): Array<[number, number]> {
    const x = Math.floor(id / nz), z = id % nz
    const out: Array<[number, number]> = []
    for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
      if ((!dx && !dz) || x + dx < 0 || x + dx >= nx || z + dz < 0 || z + dz >= nz) continue
      const next = (x + dx) * nz + z + dz
      if (!free[next]) continue
      if (dx && dz && (!free[(x + dx) * nz + z] || !free[x * nz + z + dz])) continue
      out.push([next, Math.hypot(dx, dz) * STEP])
    }
    return out
  }
  const spawn = spec.Player!.pos!
  const start = idAt(spawn[0], spawn[2])
  if (!free[start]) throw new Error('Player spawn is blocked')
  const reached = new Set<number>([start])
  const pending = [start]
  while (pending.length) for (const [next] of neighbors(pending.pop()!)) {
    if (!reached.has(next)) { reached.add(next); pending.push(next) }
  }
  const reachable = [...reached].map(at)
  const sameFixture = (a: Obstacle, b: Obstacle) => a.name === b.name ||
    (a.name === 'Station_Storeroom' && b.name === 'Block_Crates') ||
    (a.name === 'Station_Drinks' && b.name === 'Block_DrinkBase')
  const access = (station: Obstacle) => [...reached].filter(id => {
    const p = at(id), dx = p.x - station.center.x, dz = p.z - station.center.z
    const distance = Math.hypot(dx, dz)
    if (distance > Math.max(station.halfX, station.halfZ) + 0.7 + 1e-9) return false
    // The centre is inside its own fixture; every other fixture must leave the approach clear.
    for (const b of obstacles) {
      if (sameFixture(station, b)) continue
      const steps = Math.ceil(distance / 0.05)
      for (let i = 1; i <= steps; i++) {
        const k = i / steps
        const x = station.center.x + dx * k, z = station.center.z + dz * k
        if (Math.abs(x - b.center.x) < b.halfX - 1e-8 && Math.abs(z - b.center.z) < b.halfZ - 1e-8) return false
      }
    }
    return true
  })
  function distances(): number[] {
    const core = CORE_STATIONS.map(n => specBox(n, spec))
    const ports = core.map(access)
    const matrix = new Array<number>(16).fill(0)
    for (let a = 0; a < core.length; a++) {
      const cost = new Float64Array(free.length).fill(Infinity)
      const heap: Array<[number, number]> = []
      const push = (item: [number, number]) => {
        heap.push(item)
        let i = heap.length - 1
        while (i > 0) {
          const p = (i - 1) >> 1
          if (heap[p]![1] <= item[1]) break
          heap[i] = heap[p]!; i = p
        }
        heap[i] = item
      }
      const pop = (): [number, number] => {
        const result = heap[0]!, last = heap.pop()!
        if (!heap.length) return result
        let i = 0
        while (i * 2 + 1 < heap.length) {
          let j = i * 2 + 1
          if (j + 1 < heap.length && heap[j + 1]![1] < heap[j]![1]) j++
          if (heap[j]![1] >= last[1]) break
          heap[i] = heap[j]!; i = j
        }
        heap[i] = last
        return result
      }
      for (const id of ports[a]!) {
        const p = at(id), s = core[a]!.center
        cost[id] = Math.hypot(p.x - s.x, p.z - s.z)
        push([id, cost[id]!])
      }
      while (heap.length) {
        const [id, d] = pop()
        if (d > cost[id]!) continue
        for (const [next, step] of neighbors(id)) if (d + step < cost[next]!) {
          cost[next] = d + step; push([next, cost[next]!])
        }
      }
      for (let b = a + 1; b < core.length; b++) {
        const s = core[b]!.center
        const d = Math.min(...ports[b]!.map(id => { const p = at(id); return cost[id]! + Math.hypot(p.x - s.x, p.z - s.z) }))
        matrix[a * 4 + b] = matrix[b * 4 + a] = d
      }
    }
    return matrix
  }
  const stations = obstacles.filter(b => b.name.startsWith('Station_') || ['Block_Plate', 'Block_DishRack', 'Block_Fryer'].includes(b.name))
  return { obstacles, reachable, stations, access, at, distances, canReach: (x: number, z: number) => reached.has(idAt(x, z)) }
}
