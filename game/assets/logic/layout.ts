import { LAYOUT_FIXTURES, LAYOUT_FIXED, LAYOUT_IDS } from './scene-layout'
import type { LayoutConfig, LayoutId, LayoutPose, QuarterTurn } from './scene-layout'
import type { AABB } from './collision'
import type { Station } from './types'
import type { Vec2 } from './vec2'
import { circleOverlapsAABB, inTriggerRange } from './collision'

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

export function warehouseGate(): AABB {
  const left = LAYOUT_FIXED.obstacles.find(o => o.node === 'Wall_Store_W2')!, right = LAYOUT_FIXED.obstacles.find(o => o.node === 'Wall_Store_S')!
  return { center: { x: (left.x + left.width / 2 + right.x - right.width / 2) / 2, z: left.z }, halfX: .75, halfZ: .75 }
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
      access: { front: f.front ? rotateOffset(f.front, p.quarterTurn) : null, reach: .7, fixture: footprint },
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

export interface LayoutIssue {
  code: 'outside' | 'overlap' | 'gate' | 'aisle' | 'spawn' | 'access' | 'service'
  id?: LayoutId
  message: string
}
export interface LayoutValidation { ok: boolean; issues: LayoutIssue[] }

export function canUseStation(pos: Vec2, station: Station, blockers: readonly AABB[] = []): boolean {
  if (!inTriggerRange(pos, station.pos, station.triggerRange)) return false
  const a = station.access
  if (!a) return true
  const b = a.fixture, dx = pos.x - b.center.x, dz = pos.z - b.center.z
  const target = { x: Math.max(b.center.x - b.halfX, Math.min(b.center.x + b.halfX, pos.x)),
    z: Math.max(b.center.z - b.halfZ, Math.min(b.center.z + b.halfZ, pos.z)) }
  if (a.front) {
    const edge = Math.abs(a.front.x) * b.halfX + Math.abs(a.front.z) * b.halfZ
    if (dx * a.front.x + dz * a.front.z < edge - 1e-8) return false
  }
  if (Math.hypot(pos.x - target.x, pos.z - target.z) > a.reach + 1e-8) return false
  for (const other of blockers) {
    if (other === b) continue
    const minX = other.center.x - other.halfX + 1e-7, maxX = other.center.x + other.halfX - 1e-7
    const minZ = other.center.z - other.halfZ + 1e-7, maxZ = other.center.z + other.halfZ - 1e-7
    let lo = 0, hi = 1
    for (const [p, delta, min, max] of [[pos.x, target.x - pos.x, minX, maxX], [pos.z, target.z - pos.z, minZ, maxZ]]) {
      if (Math.abs(delta!) < 1e-10) { if (p! <= min! || p! >= max!) { hi = -1; break } }
      else { const t1 = (min! - p!) / delta!, t2 = (max! - p!) / delta!; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2)) }
    }
    if (lo < hi && hi > 0 && lo < 1) return false
  }
  return true
}

const EPS = 1e-7
const overlaps = (a: AABB, b: AABB) => Math.abs(a.center.x - b.center.x) < a.halfX + b.halfX - EPS && Math.abs(a.center.z - b.center.z) < a.halfZ + b.halfZ - EPS

export function safeLayoutPosition(layout: LayoutConfig, p: Vec2, radius = .35): boolean {
  const bounds = LAYOUT_FIXED.navigationBounds
  return Number.isFinite(p.x) && Number.isFinite(p.z) && p.x >= bounds.xmin + radius - EPS && p.x <= bounds.xmax - radius + EPS &&
    p.z >= bounds.zmin + radius - EPS && p.z <= bounds.zmax - radius + EPS && !buildLayoutGeometry(layout).blockers.some(b => circleOverlapsAABB(p, radius - EPS, b))
}

/** Shared flood fill for runtime safety and offline navigation. */
export function layoutNavigation(blockers: readonly AABB[], radius = .35) {
  const b = LAYOUT_FIXED.navigationBounds, step = .1
  const nx = Math.floor((b.xmax - b.xmin - 2 * radius) / step + EPS) + 1
  const nz = Math.floor((b.zmax - b.zmin - 2 * radius) / step + EPS) + 1
  const at = (id: number): Vec2 => ({ x: b.xmin + radius + Math.floor(id / nz) * step, z: b.zmin + radius + id % nz * step })
  const idAt = (p: Vec2) => Math.round((p.x - b.xmin - radius) / step) * nz + Math.round((p.z - b.zmin - radius) / step)
  const free = new Uint8Array(nx * nz)
  for (let i = 0; i < free.length; i++) free[i] = Number(!blockers.some(box => circleOverlapsAABB(at(i), radius - EPS, box)))
  const start = idAt(LAYOUT_FIXED.spawn), seen = new Uint8Array(free.length), pending: number[] = []
  if (free[start]) { seen[start] = 1; pending.push(start) }
  const reached: Vec2[] = []
  for (let i = 0; i < pending.length; i++) {
    const id = pending[i]!, x = Math.floor(id / nz), z = id % nz
    reached.push(at(id))
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx!, zz = z + dz!, next = xx * nz + zz
      if (xx < 0 || xx >= nx || zz < 0 || zz >= nz || !free[next] || seen[next]) continue
      seen[next] = 1; pending.push(next)
    }
  }
  return { reached, canReach: (p: Vec2) => !!seen[idAt(p)] }
}

export function validateLayout(layout: LayoutConfig, owned: readonly string[]): LayoutValidation {
  const issues: LayoutIssue[] = [], add = (code: LayoutIssue['code'], id: LayoutId | undefined, message: string) => issues.push({ code, ...(id ? { id } : {}), message })
  if (!parseLayout(layout)) return { ok: false, issues: [{ code: 'outside', message: '布局数据不完整' }] }
  const g = buildLayoutGeometry(layout), bounds = LAYOUT_FIXED.placementBounds
  for (const id of LAYOUT_IDS) {
    const f = LAYOUT_FIXTURES[id], p = layout.stations[id], b = g.fixtures[id]
    if (f.mode === 'slide') {
      if (p.z !== f.pose.z || p.quarterTurn !== 0 || p.x - b.halfX < -4 - EPS || p.x + b.halfX > 3.5 + EPS) add('service', id, `${f.label}只能沿前台横移`)
    } else {
      if (b.center.x - b.halfX < bounds.xmin - EPS || b.center.x + b.halfX > bounds.xmax + EPS || b.center.z - b.halfZ < bounds.zmin - EPS || b.center.z + b.halfZ > bounds.zmax + EPS) add('outside', id, `${f.label}超出厨房`)
      if (LAYOUT_FIXED.obstacles.some(o => overlaps(b, { center: { x: o.x, z: o.z }, halfX: o.width / 2, halfZ: o.depth / 2 }))) add('overlap', id, `${f.label}与固定墙柜重叠`)
    }
    if (f.mode !== 'free' && p.quarterTurn !== 0) add('service', id, `${f.label}不能旋转`)
    if (f.purchase && !owned.includes(f.purchase) && JSON.stringify(p) !== JSON.stringify(f.pose)) add('access', id, `购买${f.label}后才能调整`)
    for (const other of LAYOUT_IDS.slice(0, LAYOUT_IDS.indexOf(id))) {
      if (LAYOUT_FIXTURES[other].mode === 'slide' !== (f.mode === 'slide')) continue
      if (overlaps(b, g.fixtures[other])) add('overlap', id, `${f.label}与${LAYOUT_FIXTURES[other].label}重叠`)
    }
  }
  if (issues.some(i => i.code === 'outside')) return { ok: false, issues }
  const gate = warehouseGate()
  for (const id of LAYOUT_IDS) if (LAYOUT_FIXTURES[id].mode !== 'slide' && overlaps(g.fixtures[id], gate)) add('gate', id, `${LAYOUT_FIXTURES[id].label}堵住仓库门口`)
  const nav = layoutNavigation(g.blockers), wide = layoutNavigation(g.blockers, .75)
  if (!nav.canReach(LAYOUT_FIXED.spawn)) add('spawn', undefined, '出生点被挡住')
  if (!wide.canReach(gate.center)) add('aisle', undefined, '主通道至仓库需保留 1.5 米净宽')
  for (const station of g.stations) {
    const id = LAYOUT_IDS.find(id => LAYOUT_FIXTURES[id].node === station.id), f = id ? LAYOUT_FIXTURES[id] : null
    if (f?.purchase && !owned.includes(f.purchase)) continue
    if (!nav.reached.some(p => canUseStation(p, station, g.blockers))) add('access', id, `${f?.label ?? '仓库补货点'}没有可到达的操作面`)
  }
  return { ok: issues.length === 0, issues }
}
