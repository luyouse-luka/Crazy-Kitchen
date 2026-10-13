// Builds a script-free Cocos scene for inspecting the two original props.
// Run only with the editor closed: node tools/build-model-demo.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const read = path => JSON.parse(readFileSync(path, 'utf8'))
const scene = read('game/assets/test.scene')
const main = read('game/assets/main.scene')
const nodeTemplate = main.find(e => e.__type__ === 'cc.Node' && e._name === 'Floor')
const rendererTemplate = main.find(e => e.__type__ === 'cc.MeshRenderer')
const bakeTemplate = main[rendererTemplate.bakeSettings.__id__]
const shortId = () => {
  const hex = randomUUID().replaceAll('-', '')
  return hex.slice(0, 2) + Buffer.from(hex.slice(2), 'hex').toString('base64')
}
for (const entry of scene) if (typeof entry._id === 'string') entry._id = shortId()
scene[0]._name = scene[1]._name = 'model-demo'
const camera = scene.find(e => e.__type__ === 'cc.Camera')
const cameraNode = scene[camera.node.__id__]
cameraNode._lpos = { __type__: 'cc.Vec3', x: -2.828, y: 3.4, z: 2.828 }
camera._orthoHeight = 1.05
camera._near = .1
camera._far = 30
camera._color = { __type__: 'cc.Color', r: 87, g: 100, b: 114, a: 255 }

for (const [file, x] of [['fireExtinguisher', -.5], ['drinksMachine', .55]]) {
  const meta = read(`game/assets/art/kitchen/${file}.glb.meta`)
  const index = scene.length
  const node = structuredClone(nodeTemplate)
  node._name = file
  node._parent = { __id__: 1 }
  node._components = [{ __id__: index + 1 }]
  node._lpos = { __type__: 'cc.Vec3', x, y: 0, z: 0 }
  node._lscale = { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 }
  node._id = shortId()
  const renderer = structuredClone(rendererTemplate)
  renderer.node = { __id__: index }
  renderer._name = ''
  renderer._mesh = { __uuid__: meta.userData.assetFinder.meshes[0], __expectedType__: 'cc.Mesh' }
  renderer._materials = Object.values(meta.subMetas)
    .filter(e => e.importer === 'gltf-material')
    .sort((a, b) => a.userData.gltfIndex - b.userData.gltfIndex)
    .map(e => ({ __uuid__: e.uuid, __expectedType__: 'cc.Material' }))
  renderer.bakeSettings = { __id__: index + 2 }
  renderer._id = shortId()
  scene.push(node, renderer, structuredClone(bakeTemplate))
  scene[1]._children.push({ __id__: index })
}
writeFileSync('game/assets/model-demo.scene', JSON.stringify(scene, null, 2) + '\n')
console.log('Created model-demo.scene: two static props, no game scripts or save access.')
