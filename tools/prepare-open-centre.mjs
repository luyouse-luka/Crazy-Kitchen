import { readFileSync, writeFileSync } from 'node:fs'

const file = 'game/assets/main.scene'
const raw = readFileSync(file, 'utf8')
const scene = JSON.parse(raw)
const newline = raw.includes('\r\n') ? '\r\n' : '\n'
const serialize = () => JSON.stringify(scene, null, 2).replace(/\n/g, newline) + (raw.endsWith('\n') ? newline : '')
if (serialize() !== raw) throw new Error('Scene JSON round-trip changed formatting')
const pack = scene.find(n => n.__type__ === 'cc.Node' && n._name === 'Prop_Pack')
const cabinet = pack?._children.map(r => scene[r.__id__]).find(n => n._name === 'kitchenCabinetDrawer')
if (!cabinet) throw new Error('Missing packing counter model')
// The front counter supplies the surface; keep only the bag and packaging on top.
cabinet._active = false
const view = scene.find(n => Array.isArray(n.ingredientIcons))
const pan = JSON.parse(readFileSync('game/assets/art/restaurant/pot.glb.meta', 'utf8'))
if (!view || !pan.userData.assetFinder.scenes[0]) throw new Error('Missing cooking view or pot prefab')
view.grillPanModel = { __uuid__: pan.userData.assetFinder.scenes[0], __expectedType__: 'cc.Prefab' }
writeFileSync(file, serialize())
console.log('Packing props ready; run pnpm scene:apply --write.')
