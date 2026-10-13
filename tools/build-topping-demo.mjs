// Run after Cocos imports the GLBs, with the editor closed.
// --bind-main also binds the three topping prefabs to StationView.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const read = path => JSON.parse(readFileSync(path, 'utf8'))
const write = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
const scene = read('game/assets/test.scene')
const main = read('game/assets/main.scene')
const nodeTemplate = main.find(e => e.__type__ === 'cc.Node' && e._name === 'Floor')
const rendererTemplate = main.find(e => e.__type__ === 'cc.MeshRenderer')
const bakeTemplate = main[rendererTemplate.bakeSettings.__id__]
const shortId = () => randomUUID().replaceAll('-', '').slice(0, 20)
for (const entry of scene) if (typeof entry._id === 'string') entry._id = shortId()
scene[0]._name = scene[1]._name = 'toppings-demo'
const camera = scene.find(e => e.__type__ === 'cc.Camera')
scene[camera.node.__id__]._lpos = { __type__: 'cc.Vec3', x: -2.828, y: 3.0, z: 2.828 }
camera._orthoHeight = .8
camera._near = .1
camera._far = 30
camera._color = { __type__: 'cc.Color', r: 87, g: 100, b: 114, a: 255 }

function addNode(name, parent, position, scale = 1) {
  const index = scene.length
  const node = structuredClone(nodeTemplate)
  node._name = name
  node._parent = { __id__: parent }
  node._children = []
  node._components = []
  node._lpos = { __type__: 'cc.Vec3', ...position }
  node._lrot = { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }
  node._euler = { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 }
  node._lscale = { __type__: 'cc.Vec3', x: scale, y: scale, z: scale }
  node._id = shortId()
  scene.push(node)
  scene[parent]._children.push({ __id__: index })
  return index
}

function addModel(name, file, parent, position, scale = 1) {
  const meta = read(`game/assets/art/food/${file}.glb.meta`)
  if (meta.userData.assetFinder.meshes.length !== 1) throw Error(`Expected one mesh: ${file}`)
  const index = addNode(name, parent, position, scale)
  const renderer = structuredClone(rendererTemplate)
  const componentIndex = scene.length
  renderer.node = { __id__: index }
  renderer._name = ''
  renderer._mesh = { __uuid__: meta.userData.assetFinder.meshes[0], __expectedType__: 'cc.Mesh' }
  renderer._materials = Object.values(meta.subMetas)
    .filter(e => e.importer === 'gltf-material')
    .sort((a, b) => a.userData.gltfIndex - b.userData.gltfIndex)
    .map(e => ({ __uuid__: e.uuid, __expectedType__: 'cc.Material' }))
  renderer.bakeSettings = { __id__: componentIndex + 1 }
  renderer._id = shortId()
  scene[index]._components.push({ __id__: componentIndex })
  scene.push(renderer, structuredClone(bakeTemplate))
}

for (const [i, name] of ['onion', 'pickle', 'bacon'].entries()) {
  const u = (i - 1) * .46
  addModel(name, name, 1, { x: (u + 1.3) / Math.SQRT2, y: 0, z: (u - 1.3) / Math.SQRT2 }, 1.2)
}
const preview = addNode('BurgerPreview', 1, { x: 0, y: 0, z: 0 })
const models = ['bread', 'meat-raw', 'cheese', 'cabbage', 'tomato', 'plate', 'onion', 'pickle', 'bacon']
  .map(file => ({ __uuid__: read(`game/assets/art/food/${file}.glb.meta`).userData.assetFinder.scenes[0], __expectedType__: 'cc.Prefab' }))
const scriptMetaPath = 'game/assets/scripts/ToppingPreview.ts.meta'
if (!existsSync(scriptMetaPath)) {
  write(scriptMetaPath, { ...read('game/assets/scripts/BurgerStack.ts.meta'), uuid: randomUUID() })
}
const scriptId = read(scriptMetaPath).uuid.replaceAll('-', '')
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
let compressed = scriptId.slice(0, 5)
for (let i = 5; i < 32; i += 3) {
  const hex = parseInt(scriptId.slice(i, i + 3), 16)
  compressed += alphabet[hex >> 6] + alphabet[hex & 63]
}
scene[preview]._components.push({ __id__: scene.length })
scene.push({ __type__: compressed, _name: '', _objFlags: 0, __editorExtras__: {}, node: { __id__: preview }, _enabled: true, __prefab: null, models, _id: shortId() })
write('game/assets/toppings-demo.scene', scene)
if (process.argv.includes('--bind-main')) {
  const stations = main.filter(e => 'customerModels' in e)
  if (stations.length !== 1) throw Error('Expected exactly one StationView')
  for (const name of ['onion', 'pickle', 'bacon']) {
    const meta = read(`game/assets/art/food/${name}.glb.meta`)
    stations[0][`${name}Model`] = { __uuid__: meta.userData.assetFinder.scenes[0], __expectedType__: 'cc.Prefab' }
  }
  write('game/assets/main.scene', main)
}
console.log('Created toppings-demo: three static toppings and the production BurgerStack preview, no saves.')
