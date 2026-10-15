// @ts-expect-error Node builtin, typed locally.
import * as nodeFs from 'node:fs'
// @ts-expect-error Node builtin, typed locally.
import * as nodeCrypto from 'node:crypto'
import type { navigation as navigationType } from './layout-navigation'
import type { NodeSpec } from './scene-spec'

declare const process: { argv: string[] }
const fs = nodeFs as { readFileSync(path: string, encoding: 'utf8'): string; writeFileSync(path: string, value: string): void }
const crypto = nodeCrypto as { createHash(name: string): { update(value: string): { digest(encoding: 'hex'): string } } }
const root = process.argv[2]?.replace(/\\/g, '/')
const output = process.argv[3]
if (!root || !output) throw new Error('Usage: vite-node tools/difficulty-capture.ts SOURCE_ROOT OUTPUT_JSON')
const files = ['game/assets/main.scene', 'tools/scene-spec.ts', 'tools/layout-navigation.ts', 'game/assets/logic/scene-layout.ts',
  'game/assets/scripts/StationView.ts', 'game/assets/logic/difficulty.ts', 'game/assets/logic/progress.ts', 'game/assets/logic/customer.ts',
  'game/assets/logic/shift.ts', 'game/assets/logic/kitchen.ts', 'game/assets/logic/shop.ts', 'game/assets/logic/recipe.ts', 'game/assets/logic/movement.ts']
const hash = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(`${root}/${file}`, 'utf8')).digest('hex')
const hashes = Object.fromEntries(files.map(file => [file, hash(file)]))
const normalizedHashes = Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(`${root}/${file}`, 'utf8').replace(/\r\n/g, '\n')).digest('hex')]))
const { SPEC } = await import(`${root}/tools/scene-spec.ts`) as { SPEC: Record<string, NodeSpec> }
const { navigation } = await import(`${root}/tools/layout-navigation.ts`) as { navigation: typeof navigationType }
const nav = navigation(SPEC)
const scene = JSON.parse(fs.readFileSync(`${root}/game/assets/main.scene`, 'utf8')) as Array<Record<string, any>>
for (const [name, spec] of Object.entries(SPEC)) {
  if (!spec.pos || !spec.scale || !/^(Station_|Block_|Wall_|Floor)/.test(name)) continue
  const nodes = scene.filter(node => node.__type__ === 'cc.Node' && node._name === name)
  if (nodes.length !== 1) throw new Error(`Scene geometry anchor is not unique: ${name}`)
  const node = nodes[0]!
  for (const [key, values] of [['_lpos', spec.pos], ['_lscale', spec.scale]] as const) {
    if (values.some((value, i) => Math.abs(node[key][['x', 'y', 'z'][i]!] - value) > 1e-6)) throw new Error(`Scene/SPEC mismatch: ${name}.${key}`)
  }
  if (spec.active !== undefined && node._active !== spec.active) throw new Error(`Scene/SPEC active mismatch: ${name}`)
}
const names: Record<string, string> = { fridge: 'Station_Fridge', grill: 'Station_Grill', assembly: 'Station_Assembly', serve: 'Station_Serve',
  register: 'Station_Order', delivery: 'Station_Delivery', storeroom: 'Station_Storeroom', sink: 'Station_Sink', rack: 'Block_DishRack',
  shelf: 'Block_Plate', fryer: 'Block_Fryer', drinks: 'Station_Drinks', extinguisher: 'Station_Extinguisher' }
const stations = Object.entries(names).map(([kind, name]) => {
  const station = nav.stations.find(item => item.name === name)
  if (!station) throw new Error(`Missing station: ${name}`)
  return { kind, ...station, access: nav.access(station) }
})
const coords = nav.reachable
const key = (x: number, z: number) => `${Math.round(x * 100)},${Math.round(z * 100)}`
const indices = new Map(coords.map((point, i) => [key(point.x, point.z), i]))
const portIndices = stations.map(station => station.access.map(nav.at).map(point => indices.get(key(point.x, point.z))!))
if (portIndices.some(ports => ports.length === 0)) throw new Error('Unreachable station')
const matrix = new Array<number>(stations.length ** 2).fill(0)
for (let source = 0; source < stations.length; source++) {
  const costs = new Float64Array(coords.length).fill(Infinity)
  const heap: Array<[number, number]> = []
  const push = (item: [number, number]) => {
    heap.push(item); let i = heap.length - 1
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p]![1] <= item[1]) break; heap[i] = heap[p]!; i = p }
    heap[i] = item
  }
  const pop = () => {
    const first = heap[0]!, last = heap.pop()!
    if (heap.length) {
      let i = 0
      while (i * 2 + 1 < heap.length) {
        let j = i * 2 + 1
        if (j + 1 < heap.length && heap[j + 1]![1] < heap[j]![1]) j++
        if (heap[j]![1] >= last[1]) break
        heap[i] = heap[j]!; i = j
      }
      heap[i] = last
    }
    return first
  }
  for (const index of portIndices[source]!) {
    const p = coords[index]!, s = stations[source]!.center
    costs[index] = Math.hypot(p.x - s.x, p.z - s.z); push([index, costs[index]!])
  }
  while (heap.length) {
    const [index, cost] = pop()
    if (cost > costs[index]!) continue
    const p = coords[index]!
    for (const dx of [-0.1, 0, 0.1]) for (const dz of [-0.1, 0, 0.1]) {
      if (!dx && !dz) continue
      const next = indices.get(key(p.x + dx, p.z + dz))
      if (next === undefined) continue
      if (dx && dz && (!indices.has(key(p.x + dx, p.z)) || !indices.has(key(p.x, p.z + dz)))) continue
      const value = cost + Math.hypot(dx, dz)
      if (value < costs[next]!) { costs[next] = value; push([next, value]) }
    }
  }
  for (let target = source + 1; target < stations.length; target++) {
    const s = stations[target]!.center
    const value = Math.min(...portIndices[target]!.map(index => { const p = coords[index]!; return costs[index]! + Math.hypot(p.x - s.x, p.z - s.z) }))
    if (!Number.isFinite(value)) throw new Error('Disconnected route')
    matrix[source * stations.length + target] = matrix[target * stations.length + source] = value
  }
}
const control = scene.find(node => Array.isArray(node.ingredientIcons))
if (!control) throw new Error('StationView scene component missing')
const source = fs.readFileSync(`${root}/game/assets/scripts/StationView.ts`, 'utf8')
const fields = ['orderPatienceSec', 'customersPerShift', 'sparePlates', 'lateLeaveSec', 'patienceScale', 'deliveryIntervalSec',
  'deliveryOfferSec', 'deliveryDeadlineSec', 'arrivalSec', 'arrivalJitter']
const params = Object.fromEntries(fields.map(name => {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*(\\d+(?:\\.\\d+)?)`))
  const value = control[name] ?? (match ? Number(match[1]) : undefined)
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Missing runtime property ${name}`)
  return [name, value]
}))
const floor = SPEC.Floor_Customer!.pos!, scale = SPEC.Floor_Customer!.scale!
const queueX = SPEC.Block_CounterW!.pos![0], queueZ = floor[2] - scale[2] / 2 + 1
const doorX = floor[0] + scale[0] / 2 + 1.5, doorZ = floor[2]
const speed = Number(source.match(/const CUSTOMER_SPEED = ([\d.]+)/)?.[1])
if (!(speed > 0)) throw new Error('Missing customer speed')
params.walkInSec = Math.hypot(queueX - doorX, queueZ - doorZ) / speed
for (const file of files) if (hashes[file] !== hash(file)) throw new Error(`Source changed during capture: ${file}`)
const snapshot = { schema: 1, sourceRoot: root, capturedAt: new Date().toISOString(), confirmationThread: '01a13a52-f1f9-79f2-a16e-9a65097ba4f5',
  layout: process.argv[4] ?? 'open-centre / left-middle fridge / 2026-10-14', hashes, normalizedHashes, params, stations: stations.map(({ access, ...station }) => station), distances: matrix,
  navigation: { gridStep: 0.1, cost: 'centre-to-centre via reachable interaction ports; no joystick errors', sceneSpecAnchorsChecked: true } }
fs.writeFileSync(output, JSON.stringify(snapshot, null, 2) + '\n')
console.log(JSON.stringify({ output, layout: snapshot.layout, params, sceneSha256: hashes['game/assets/main.scene'], routes: matrix.length }))
