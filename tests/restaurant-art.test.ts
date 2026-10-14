import { describe, expect, it } from 'vitest'
// @ts-expect-error Node builtin: this repository does not install @types/node.
import { readFileSync } from 'node:fs'
import { navigation } from '../tools/layout-navigation'
import { CHEF_RADIUS, FLOOR_BOUNDS } from '../game/assets/logic/movement'
import { circleOverlapsAABB } from '../game/assets/logic/collision'

const folder = 'game/assets/art/restaurant/'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const scene = read('game/assets/main.scene')
const manifest = read(folder + 'manifest.json')
const meta = (name: string) => read(folder + name + '.glb.meta')
const gltf = (name: string) => {
  const bytes: Uint8Array = readFileSync(folder + name + '.glb')
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  expect(header.getUint32(0, true)).toBe(0x46546c67)
  expect(header.getUint32(8, true)).toBe(bytes.byteLength)
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + header.getUint32(12, true))))
}

describe('restaurant art integration', () => {
  it('the cooking view uses the existing pot prefab for both burner pans', () => {
    const component = scene.find((n: any) => Array.isArray(n.ingredientIcons))
    expect(component.grillPanModel?.__uuid__).toBe(meta('pot').userData.assetFinder.scenes[0])
  })

  it('contact shadows follow the relocated fridge and assembly instead of the empty centre', () => {
    const data = gltf('contact-shadows')
    const bytes: Uint8Array = readFileSync(folder + 'contact-shadows.glb')
    const buffer = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const binary = 28 + buffer.getUint32(12, true)
    const positions = data.accessors[data.meshes[0].primitives[0].attributes.POSITION]
    const offset = binary + (data.bufferViews[positions.bufferView].byteOffset || 0) + (positions.byteOffset || 0)
    const centres: Array<[number, number]> = []
    for (let i = 0; i < positions.count; i += 72) {
      let x = 0, z = 0
      for (let j = 0; j < 72; j++) {
        x += buffer.getFloat32(offset + (i + j) * 12, true)
        z += buffer.getFloat32(offset + (i + j) * 12 + 8, true)
      }
      centres.push([x / 72, z / 72])
    }
    expect(centres.some(([x, z]) => Math.abs(x + 3.5) < 1e-5 && Math.abs(z - 1) < 1e-5)).toBe(true)
    expect(centres.some(([x, z]) => Math.abs(x + 3.5) < 1e-5 && Math.abs(z + 1.5) < 1e-5)).toBe(true)
    expect(centres.some(([x, z]) => Math.abs(x + 3.5) < 1e-5 && Math.abs(z) < 1e-5)).toBe(true)
    expect(centres.some(([x, z]) => Math.abs(x) < 1e-5 && Math.abs(z) < 1e-5)).toBe(false)
    expect(centres.some(([x, z]) => Math.abs(x + 3.5) < 1e-5 && Math.abs(z + 2.5) < 1e-5)).toBe(false)
  })

  it('KayKit furniture and wall surfaces use lit rough materials', () => {
    for (const asset of manifest.assets.filter((a: any) => a.collection !== 'project')) {
      const data = gltf(asset.name)
      for (const material of data.materials) {
        expect(material.extensions?.KHR_materials_unlit, asset.name).toBeUndefined()
        expect(material.pbrMetallicRoughness.roughnessFactor, asset.name).toBeGreaterThanOrEqual(.85)
      }
    }
  })

  it('batched floor geometry matches the gameplay footprint and has a low contrast palette', () => {
    const floors = [['floor-main', 'Floor'], ['floor-east', 'Floor_East'], ['floor-store', 'Floor_Store'], ['floor-customer', 'Floor_Customer']]
    for (const [asset, name] of floors) {
      const data = gltf(asset!), root = scene.find((n: any) => n._name === name)
      expect(data.meshes).toHaveLength(1)
      expect(data.meshes[0].primitives).toHaveLength(1)
      const attributes = data.meshes[0].primitives[0].attributes
      const bounds = data.accessors[attributes.POSITION], colors = data.accessors[attributes.COLOR_0]
      expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(root._lscale.x, 5)
      expect(bounds.max[2] - bounds.min[2]).toBeCloseTo(root._lscale.z, 5)
      expect(bounds.max[1]).toBeCloseTo(0, 6)
      expect(colors.min[0]).toBeGreaterThan(.3)
      const tile = scene.find((n: any) => n._name === 'Tiles_' + name)
      expect(tile._parent.__id__).toBe(scene.indexOf(root))
    }
  })

  it('all fifty prop replacements reference their selected asset', () => {
    const props = scene.filter((n: any) => n.__editorExtras__?.restaurantArt && n._name !== 'Model')
    expect(props).toHaveLength(50)
    for (const root of props) {
      const source = meta(root.__editorExtras__.restaurantArt)
      const meshes: string[] = []
      const visit = (node: any) => {
        for (const c of node._components) {
          const component = scene[c.__id__]
          if (component._mesh) meshes.push(component._mesh.__uuid__)
        }
        for (const child of node._children) visit(scene[child.__id__])
      }
      visit(root)
      expect(meshes.length, root._name).toBeGreaterThan(0)
      for (const uuid of meshes) expect(uuid.startsWith(source.uuid + '@'), root._name).toBe(true)
    }
  })

  it('fries are placed on the serving tray beside the fryer oil well', () => {
    const root = scene.find((n: any) => n._name === 'Prop_Fryer')
    const children = root._children.map((r: any) => scene[r.__id__])
    const appliance = children.find((n: any) => n.__editorExtras__?.restaurantArt === 'fryer')
    expect(appliance).toBeDefined()
    expect(appliance._lscale).toMatchObject({ x: 1, y: 1, z: 1 })
    const serving = children.find((n: any) => n._name === 'fries')
    expect(serving._active).toBe(false)
    expect(serving._lpos).toMatchObject({ x: .32, y: 1.02, z: .045 })
    expect(serving._lpos.x).toBeGreaterThan(.115)
    const model = gltf('fryer')
    expect(model.nodes[0].name).toBe('fryer')
    expect(model.meshes).toHaveLength(1)
    expect(model.materials[0].pbrMetallicRoughness.roughnessFactor).toBe(.9)
  })

  it('visible barriers stop at the actual movement edges and leave every reachable chef position clear', () => {
    const config = read('tools/art-direction.json')
    const west = config.boundaries.find((b: any) => b.name === 'kitchen-west').footprint
    const front = config.boundaries.find((b: any) => b.name === 'kitchen-front-east').footprint
    expect(west[0] + west[2] / 2).toBeCloseTo(FLOOR_BOUNDS.xmin, 6)
    expect(front[1] - front[3] / 2).toBeCloseTo(FLOOR_BOUNDS.zmax, 6)
    const node = scene.find((n: any) => n._name === 'WalkableBoundary')
    expect([node._lpos.x, node._lpos.y, node._lpos.z]).toEqual([0, 0, 0])
    const data = gltf('site-boundaries')
    const bytes: Uint8Array = readFileSync(folder + 'site-boundaries.glb')
    const buffer = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const binaryStart = 28 + buffer.getUint32(12, true)
    const primitive = data.meshes[0].primitives[0]
    const positions = data.accessors[primitive.attributes.POSITION]
    const view = data.bufferViews[positions.bufferView]
    const points: number[][] = []
    for (let i = 0; i < positions.count; i++) {
      const offset = binaryStart + (view.byteOffset || 0) + (positions.byteOffset || 0) + i * 12
      const p = [0, 4, 8].map(k => buffer.getFloat32(offset + k, true))
      points.push(p)
    }
    expect(points.filter(p => p[1]! > .02).length).toBeGreaterThan(200)
    const reachable = navigation().reachable
    expect(reachable.length).toBeGreaterThan(3000)
    const index = data.accessors[primitive.indices], indexView = data.bufferViews[index.bufferView]
    for (let i = 0; i < index.count; i += 3) {
      const triangle = [0, 1, 2].map(k => points[buffer.getUint32(binaryStart + (indexView.byteOffset || 0) + (index.byteOffset || 0) + (i + k) * 4, true)]!)
      if (Math.max(...triangle.map(p => p[1]!)) <= .02) continue
      const xs = triangle.map(p => p[0]!), zs = triangle.map(p => p[2]!)
      const xmin = Math.min(...xs), xmax = Math.max(...xs), zmin = Math.min(...zs), zmax = Math.max(...zs)
      const box = { center: { x: (xmin + xmax) / 2, z: (zmin + zmax) / 2 }, halfX: (xmax - xmin) / 2, halfZ: (zmax - zmin) / 2 }
      expect(reachable.some(c => circleOverlapsAABB(c, CHEF_RADIUS - 1e-5, box)), `Barrier inside chef clearance: triangle ${i / 3}`).toBe(false)
    }
    const garden = gltf('floor-terrace')
    const ground = garden.accessors[garden.meshes[0].primitives[0].attributes.POSITION]
    expect(ground.max[1]).toBeLessThanOrEqual(-.35 + 1e-6)
    expect(scene.find((n: any) => n._name === 'RecessedGarden')).toBeDefined()
  })

  it('characters have one material, a skin, and complete looping idle/walk/sit clips', () => {
    for (const actor of manifest.characters) {
      const name = 'actor-' + actor.name, data = gltf(name), metadata = meta(name)
      expect(data.meshes).toHaveLength(1)
      expect(data.meshes[0].primitives).toHaveLength(1)
      expect(data.materials).toHaveLength(1)
      expect(data.materials[0].extensions?.KHR_materials_unlit).toBeUndefined()
      expect(data.meshes[0].primitives[0].attributes.COLOR_0).toBeDefined()
      expect(data.skins[0].joints.length).toBeGreaterThan(20)
      expect(data.animations.map((a: any) => a.name)).toEqual(['idle', 'walk', 'sit'])
      for (const clip of Object.values(metadata.subMetas) as any[]) {
        if (clip.importer !== 'gltf-animation') continue
        expect(clip.userData.wrapMode).toBe(2)
        expect(clip.userData.span.to - clip.userData.span.from).toBeGreaterThan(.5)
      }
      for (const animation of data.animations) for (const channel of animation.channels) {
        expect(data.nodes[channel.target.node].name.startsWith('K_')).toBe(true)
      }
      const bones = data.skins[0].joints.map((id: number) => data.nodes[id].name).sort()
      for (const animation of data.animations) {
        for (const path of ['translation', 'rotation', 'scale']) {
          const targets = animation.channels.filter((c: any) => c.target.path === path).map((c: any) => data.nodes[c.target.node].name).sort()
          expect(targets, `${name}/${animation.name}/${path}: complete bone-name retargeting`).toEqual(bones)
        }
      }
    }
    expect(manifest.characters.find((a: any) => a.name === 'chef').height * 2).toBeCloseTo(1.75, 5)
  })

  it('the chef and all four customer variants use KayKit Adventurers prefabs and bones', () => {
    const player = scene.find((n: any) => n.__editorExtras__?.restaurantArt === 'actor-chef')
    expect(scene[player._children[0].__id__]._name).toBe('K_chef')
    const animation = player._components.map((r: any) => scene[r.__id__]).find((c: any) => c.__type__ === 'cc.SkeletalAnimation')
    expect(animation.playOnLoad).toBe(true)
    const view = scene.find((n: any) => n.customerModels)
    expect(view.customerModels.map((p: any) => p.__uuid__)).toEqual(
      ['barbarian', 'knight', 'mage', 'ranger'].map(n => meta('actor-' + n).userData.assetFinder.scenes[0]),
    )
    const chairs = scene.filter((n: any) => n.__editorExtras__?.restaurantArt === 'seat')
    expect(chairs).toHaveLength(4)
    for (const chair of chairs) {
      expect(chair._lrot.y).toBe(1)
      expect(chair._lscale.y).toBe(.96)
    }
  })
})
