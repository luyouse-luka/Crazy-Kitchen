import { LAYOUT_FIXTURES, LAYOUT_FIXED, LAYOUT_IDS } from './scene-layout'
import type { LayoutConfig, LayoutId, LayoutPose, QuarterTurn } from './scene-layout'
import type { AABB } from './collision'
import type { Station } from './types'
import type { Vec2 } from './vec2'

export interface LayoutGeometry {
  stations: Station[]
  blockers: AABB[]
  fixtures: Record<LayoutId, AABB>
}

export function defaultLayout(): LayoutConfig {
  const stations = {} as Record<LayoutId, LayoutPose>
  for (const id of LAYOUT_IDS) stations[id] = { ...LAYOUT_FIXTURES[id].pose }
  return { version: 1, stations }
}

function record(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const proto = Object.getPrototypeOf(raw)
  return proto === Object.prototype || proto === null
}

function exactKeys(raw: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(raw).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(raw, key))
}

export function parseLayout(raw: unknown): LayoutConfig | null {
  if (!record(raw) || !exactKeys(raw, ['version', 'stations']) || raw.version !== 1 || !record(raw.stations)) return null
  if (!exactKeys(raw.stations, LAYOUT_IDS)) return null
  const stations = {} as Record<LayoutId, LayoutPose>
  for (const id of LAYOUT_IDS) {
    const p = raw.stations[id]
    if (!record(p) || !exactKeys(p, ['x', 'z', 'quarterTurn'])) return null
    if (typeof p.x !== 'number' || !Number.isFinite(p.x) || typeof p.z !== 'number' || !Number.isFinite(p.z)) return null
    if (p.quarterTurn !== 0 && p.quarterTurn !== 1 && p.quarterTurn !== 2 && p.quarterTurn !== 3) return null
    stations[id] = { x: p.x, z: p.z, quarterTurn: p.quarterTurn }
  }
  return { version: 1, stations }
}

export function rotateOffset(p: Vec2, q: QuarterTurn): Vec2 {
  switch (q) {
    case 0: return { x: p.x, z: p.z }
    case 1: return { x: p.z, z: p.x === 0 ? 0 : -p.x }
    case 2: return { x: p.x === 0 ? 0 : -p.x, z: p.z === 0 ? 0 : -p.z }
    case 3: return { x: p.z === 0 ? 0 : -p.z, z: p.x }
  }
}

function box(x: number, z: number, width: number, depth: number, q: QuarterTurn = 0): AABB {
  return { center: { x, z }, halfX: (q % 2 ? depth : width) / 2, halfZ: (q % 2 ? width : depth) / 2 }
}

export function buildLayoutGeometry(layout: LayoutConfig): LayoutGeometry {
  const stations: Station[] = []
  const blockers = LAYOUT_FIXED.obstacles.map(o => box(o.x, o.z, o.width, o.depth))
  const fixtures = {} as Record<LayoutId, AABB>
  for (const id of LAYOUT_IDS) {
    const f = LAYOUT_FIXTURES[id], p = layout.stations[id]
    const footprint = box(p.x, p.z, f.width, f.depth, p.quarterTurn)
    fixtures[id] = footprint
    // Service markers move along the fixed counter without moving its collision.
    if (f.mode !== 'slide') blockers.push(footprint)
    const offset = rotateOffset(f.triggerOffset ?? { x: 0, z: 0 }, p.quarterTurn)
    const pos = { x: p.x + offset.x, z: p.z + offset.z }
    const [width, depth] = f.triggerSize ?? [f.width, f.depth]
    stations.push({
      id: f.node, kind: f.kind, pos,
      box: box(pos.x, pos.z, width, depth, p.quarterTurn),
      triggerRange: Math.max(width, depth) / 2 + .7,
    })
  }
  const supplyIndex = LAYOUT_FIXED.obstacles.findIndex(o => o.node === 'Station_Storeroom')
  const supplyBox = blockers[supplyIndex]!
  stations.push({
    id: 'Station_Storeroom', kind: 'storeroom', pos: { ...supplyBox.center },
    box: supplyBox, triggerRange: Math.max(supplyBox.halfX, supplyBox.halfZ) + .7,
  })
  return { stations, blockers, fixtures }
}
