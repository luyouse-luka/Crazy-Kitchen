import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'

const file = 'game/assets/main.scene'
const raw = readFileSync(file, 'utf8')
const scene = JSON.parse(raw)
const dir = 'game/assets/art/restaurant/'
const read = p => JSON.parse(readFileSync(p, 'utf8'))
const library = uuid => read(`game/library/${uuid.slice(0, 2)}/${uuid}.json`)
const meta = name => read(`${dir}${name}.glb.meta`)
const prefab = name => library(meta(name).userData.assetFinder.scenes[0])
const revision = name => createHash('sha256').update(readFileSync(`${dir}${name}.glb`)).update(meta(name).uuid).digest('hex')
const compressedId = () => {
  const hex = randomUUID().replaceAll('-', ''), b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  return hex.slice(0, 2) + hex.slice(2).match(/.{3}/g).map(v => { const n = parseInt(v, 16); return b64[n >> 6] + b64[n & 63] }).join('')
}
const vector = (x, y, z) => ({ __type__: 'cc.Vec3', x, y, z })
const identity = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
const multiply = (a, b) => a.map(row => b[0].map((_, c) => row.reduce((s, v, k) => s + v * b[k][c], 0)))
function matrix(n) {
  const { x, y, z, w } = n._lrot
  const s = n._lscale, t = n._lpos
  const m = [[1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w, t.x], [2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w, t.y], [2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y, t.z], [0, 0, 0, 1]]
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[r][c] *= s[['x', 'y', 'z'][c]]
  return m
}
function bounds(data, root, includeRoot = false) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  function visit(id, parent, apply) {
    const n = data[id], m = apply ? multiply(parent, matrix(n)) : parent
    for (const ref of n._components) {
      const c = data[ref.__id__]
      if (!c._mesh) continue
      const st = library(c._mesh.__uuid__)._struct
      if (!st.minPosition || !st.maxPosition) throw new Error(`No bounds: ${n._name}`)
      for (let bits = 0; bits < 8; bits++) {
        const v = ['x', 'y', 'z'].map((k, i) => st[bits & (1 << i) ? 'maxPosition' : 'minPosition'][k]).concat(1)
        for (let r = 0; r < 3; r++) {
          const value = m[r].reduce((a, x, k) => a + x*v[k], 0)
          lo[r] = Math.min(lo[r], value); hi[r] = Math.max(hi[r], value)
        }
      }
    }
    for (const child of n._children) visit(child.__id__, m, true)
  }
  visit(root, identity, includeRoot)
  return { lo, hi, size: hi.map((v, k) => v - lo[k]) }
}
function attach(data, target) {
  const root = data[0].data.__id__, offset = scene.length
  const rewrite = value => {
    if (!value || typeof value !== 'object') return value
    if (typeof value.__id__ === 'number') return { __id__: value.__id__ === root ? target : value.__id__ + offset }
    if (Array.isArray(value)) return value.map(rewrite)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]))
  }
  const copies = data.map(entry => {
    const n = rewrite(entry)
    if (n.__type__ === 'cc.Node') n._prefab = null
    if ('__prefab' in n) n.__prefab = null
    if ('_id' in n) n._id = compressedId()
    return n
  })
  scene[target]._children = copies[root]._children
  scene[target]._components = copies[root]._components
  scene.push(...copies)
}

const mapping = {
  kitchenFridge: 'fridge', kitchenStove: 'stove', kitchenCabinet: 'counter',
  kitchenCabinetDrawer: 'drawer', kitchenBar: 'counter', kitchenSink: 'sink',
  kitchenStoveElectric: 'fryer', cardboardBoxClosed: 'crate', cardboardBoxOpen: 'crate-open',
  bookcaseOpen: 'shelf', pottedPlant: 'plant', plantSmall1: 'plant-small',
  plate: 'plate', pot: 'pot', bread: 'bun', 'meat-raw': 'patty', cheese: 'cheese',
  cabbage: 'lettuce', tomato: 'tomato', burger: 'burger', 'cutting-board': 'cuttingboard', benchCushion: 'seat',
}
const targets = scene.flatMap((n, i) => n.__type__ === 'cc.Node' && mapping[n._name] && scene[n._parent?.__id__]?._name?.startsWith('Prop_') ? [i] : [])
const report = []
for (const i of targets) {
  const n = scene[i]
  const key = mapping[n._name], data = prefab(key)
  const hash = revision(key)
  if (key === 'fryer') {
    n._lscale = vector(1, 1, 1)
    n._lpos = vector(0, 0, 0)
  }
  if (n.__editorExtras__?.restaurantArt) {
    if (n.__editorExtras__.restaurantArtRevision === hash) continue
    if (key === 'seat') {
      n._lrot = { __type__: 'cc.Quat', x: 0, y: 1, z: 0, w: 0 }; n._euler = vector(0, 180, 0)
    }
    attach(data, i)
    n.__editorExtras__.restaurantArt = key
    n.__editorExtras__.restaurantArtRevision = hash
    continue
  }
  const before = bounds(scene, i), after = bounds(data, data[0].data.__id__)
  const oldScale = ['x', 'y', 'z'].map(k => n._lscale[k])
  const scale = before.size.map((v, k) => oldScale[k] * v / after.size[k])
  const offset = before.lo.map((v, k) => (k === 1 ? v : (v + before.hi[k]) / 2) * oldScale[k] - (k === 1 ? after.lo[k] : (after.lo[k] + after.hi[k]) / 2) * scale[k])
  const rotation = matrix({ ...n, _lpos: vector(0, 0, 0), _lscale: vector(1, 1, 1) })
  const delta = rotation.slice(0, 3).map(row => row.slice(0, 3).reduce((a, v, k) => a + v*offset[k], 0))
  const position = ['x', 'y', 'z'].map((k, a) => n._lpos[k] + delta[a])
  if (key === 'fryer') {
    scale.fill(1)
    position.fill(0)
  }
  if (key === 'seat') {
    const old = bounds(scene, i, true)
    n._lrot = { __type__: 'cc.Quat', x: 0, y: 1, z: 0, w: 0 }; n._euler = vector(0, 180, 0)
    scale.fill(.96)
    position[0] = (old.lo[0] + old.hi[0]) / 2
    position[1] = old.lo[1]
    position[2] = (old.lo[2] + old.hi[2]) / 2
  }
  n._lscale = vector(...scale); n._lpos = vector(...position)
  n.__editorExtras__.restaurantArt = key
  n.__editorExtras__.restaurantArtRevision = hash
  attach(data, i)
  report.push({ node: n._name, art: key, size: before.size.map((v, k) => v*oldScale[k]) })
}
const fryer = scene.find(n => n._name === 'Prop_Fryer')
const serving = fryer._children.map(r => scene[r.__id__]).find(n => n._name === 'fries')
serving._lpos = vector(.32, 1.02, .045)
serving._lscale = vector(.65, .65, .65)
serving._active = false
const model = scene.findIndex(n => n.__type__ === 'cc.Node' && n._name === 'Model')
if (scene[model].__editorExtras__.restaurantArtRevision !== revision('actor-chef')) {
  attach(prefab('actor-chef'), model)
  scene[model].__editorExtras__.restaurantArt = 'actor-chef'
  scene[model].__editorExtras__.restaurantArtRevision = revision('actor-chef')
}
scene[scene[model]._components.find(r => scene[r.__id__].__type__ === 'cc.SkeletalAnimation').__id__].playOnLoad = true
scene[scene[model]._components.find(r => scene[r.__id__].__type__ === 'cc.SkeletalAnimation').__id__]._useBakedAnimation = false
const view = scene.find(n => n.customerModels)
view.customerModels = ['barbarian', 'knight', 'mage', 'ranger'].map(n => ({ __uuid__: meta(`actor-${n}`).userData.assetFinder.scenes[0], __expectedType__: 'cc.Prefab' }))
view.onionModel = { __uuid__: meta('onion').userData.assetFinder.scenes[0], __expectedType__: 'cc.Prefab' }

// Remove detached old branches without changing any surviving node IDs.
const used = new Set()
function mark(value) {
  if (!value || typeof value !== 'object') return
  if (typeof value.__id__ === 'number') {
    const id = value.__id__
    if (!used.has(id)) { used.add(id); mark(scene[id]) }
  } else for (const child of Object.values(value)) mark(child)
}
used.add(0); mark(scene[0])
const ids = [...used].sort((a, b) => a - b), remap = new Map(ids.map((id, i) => [id, i]))
function rewrite(value) {
  if (!value || typeof value !== 'object') return value
  if (typeof value.__id__ === 'number') return { __id__: remap.get(value.__id__) }
  if (Array.isArray(value)) return value.map(rewrite)
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]))
}
const output = ids.map(i => rewrite(scene[i]))
writeFileSync(file, JSON.stringify(output, null, 2) + (raw.endsWith('\n') ? '\n' : ''))
if (report.length) writeFileSync('game/temp/art-swap/scene-report.json', JSON.stringify(report, null, 2))
console.log(`Restaurant art applied: ${targets.length} prop roots, player, four customer variants and onion; ${report.length} newly converted props, ${output.length} scene records.`)
