// Creates the missing scene structure; scene:apply supplies the canonical transforms.
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const file = 'game/assets/main.scene'
const raw = readFileSync(file, 'utf8')
const scene = JSON.parse(raw)
const suffix = raw.endsWith('\n') ? '\n' : ''
if (JSON.stringify(scene, null, 2) + suffix !== raw) throw new Error('Scene JSON round-trip changed formatting')
const shortId = () => {
  const hex = randomUUID().replaceAll('-', '')
  return hex.slice(0, 2) + Buffer.from(hex.slice(2), 'hex').toString('base64')
}
const index = name => {
  const i = scene.findIndex(e => e.__type__ === 'cc.Node' && e._name === name)
  if (i < 0) throw new Error(`Missing scene node: ${name}`)
  return i
}
const has = name => scene.some(e => e.__type__ === 'cc.Node' && e._name === name)
const references = value => {
  if (!value || typeof value !== 'object') return []
  if (typeof value.__id__ === 'number') return [value.__id__]
  return Object.values(value).flatMap(references)
}
function cloneBranch(template, name, parent) {
  if (has(name)) return index(name)
  const start = index(template)
  const nodes = new Set()
  const collect = id => {
    nodes.add(id)
    for (const r of scene[id]._children ?? []) collect(r.__id__)
  }
  collect(start)
  const entries = new Set(nodes)
  const pending = [...nodes]
  while (pending.length) {
    const id = pending.pop()
    for (const ref of references(scene[id])) {
      const target = scene[ref]
      if (!target || entries.has(ref) || target.__type__ === 'cc.Scene') continue
      if (target.__type__ === 'cc.Node' && !nodes.has(ref)) continue
      if (target.node && !nodes.has(target.node.__id__)) continue
      entries.add(ref)
      pending.push(ref)
    }
  }
  const ids = [...entries].sort((a, b) => a - b)
  const remap = new Map(ids.map((id, i) => [id, scene.length + i]))
  const rewrite = value => {
    if (!value || typeof value !== 'object') return value
    if (typeof value.__id__ === 'number') return { ...value, __id__: remap.get(value.__id__) ?? value.__id__ }
    if (Array.isArray(value)) return value.map(rewrite)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]))
  }
  const clones = ids.map(id => {
    const entry = rewrite(scene[id])
    if (typeof entry._id === 'string') entry._id = shortId()
    return entry
  })
  const root = clones[ids.indexOf(start)]
  root._name = name
  root._parent = { __id__: index(parent) }
  scene.push(...clones)
  scene[index(parent)]._children.push({ __id__: remap.get(start) })
  return remap.get(start)
}

for (const name of ['Wall_Utility', 'Wall_Kitchen_W']) cloneBranch('Wall_Store_W1', name, 'Blockers')
for (const name of ['Block_Return', 'Block_BackCounter', 'Block_BackCounterE', 'Block_DrinkBase', 'Block_VoidNorth', 'Block_StoreShelves']) {
  cloneBranch('Block_CounterW', name, 'Blockers')
}
for (const name of ['Prop_AssemblyEast', 'Prop_ReturnBack', 'Prop_ReturnSide', 'Prop_ReturnFront', 'Prop_BackCounterW', 'Prop_BackCounterW2', 'Prop_BackCounterE', 'Prop_DrinkBase']) {
  cloneBranch('Prop_Assembly', name, 'Props')
}

// Both sink modules must fit one metre; the former west module was oversized.
const firstSink = scene[scene[index('Prop_Sink_0')]._children[0].__id__]
const secondSink = scene[scene[index('Prop_Sink_1')]._children[0].__id__]
for (const key of ['_lpos', '_lscale', '_lrot', '_euler']) firstSink[key] = structuredClone(secondSink[key])

// The front counter extends from x=-4 to x=3.5, leaving a 1.5m kitchen-side opening.
const serve = scene[index('Prop_Serve')]
const bars = serve._children.map(r => scene[r.__id__]).filter(n => n._name === 'kitchenBar')
for (let i = 0; i < bars.length; i++) {
  bars[i]._lpos.x = -4 + i * (7.5 / bars.length)
  bars[i]._lscale.x = (2.3255813566654555 * 7.5) / bars.length
}
const screen = serve._children.map(r => scene[r.__id__]).find(n => n._name === 'computerScreen')
const keyboard = serve._children.map(r => scene[r.__id__]).find(n => n._name === 'computerKeyboard')
screen._lpos.x = -3.5875
keyboard._lpos.x = -3.6625
serve._children.map(r => scene[r.__id__]).find(n => n._name === 'bag_delivery')._lpos.x = 3

writeFileSync(file, JSON.stringify(scene, null, 2) + suffix)
console.log('Peninsula structure ready; run pnpm scene:apply --write.')
