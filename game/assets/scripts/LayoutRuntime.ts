import { Color, gfx, Material, Mesh, MeshRenderer, Node, Quat, utils, Vec3 } from 'cc'
import { buildLayoutGeometry, rotateOffset } from '../logic/layout'
import { LAYOUT_FIXTURES, LAYOUT_IDS } from '../logic/scene-layout'
import type { LayoutConfig, LayoutId } from '../logic/scene-layout'

interface Binding { id: LayoutId; node: Node; p: Vec3; q: Quat; scale: Vec3; proxy: boolean }
export class LayoutRuntime {
  private bindings: Binding[] = []
  private shadow: Node
  private renderer: MeshRenderer
  private material: Material
  private mesh: Mesh | null = null
  private oldShadow: Node | null
  private fixedShadows: Array<{ center: { x: number; z: number }; halfX: number; halfZ: number; y: number }> = []
  constructor(private root: Node) {
    const props = root.getChildByName('Props')!, blockers = root.getChildByName('Blockers')!
    const add = (id: LayoutId, node: Node | null, proxy = false) => {
      if (!node) throw Error(`Missing layout binding: ${id}`)
      this.bindings.push({ id, node, p: node.worldPosition.clone(), q: node.worldRotation.clone(), scale: node.worldScale.clone(), proxy })
    }
    const serviceArt = ['Prop_Pack', 'Prop_Serve'].flatMap(name => props.getChildByName(name)?.children ?? [])
    for (const id of LAYOUT_IDS) {
      const f = LAYOUT_FIXTURES[id]
      add(id, root.getChildByName(f.node) ?? blockers.getChildByName(f.node), true)
      if (f.mode === 'slide') {
        const names = id === 'register' ? ['computerScreen', 'computerKeyboard'] : id === 'delivery' ? ['bag_delivery'] : ['bag', 'styrofoam']
        for (const n of serviceArt.filter(n => names.includes(n.name))) add(id, n)
      } else {
        if (id === 'drinks') add(id, blockers.getChildByName('Block_DrinkBase'), true)
        for (const art of f.art) add(id, props.getChildByName(art.node))
        if (f.runtime) for (const child of root.getChildByName(f.node)!.children) if (child.active) add(id, child)
      }
    }
    this.oldShadow = props.getChildByName('ContactShadows') ?? root.getChildByName('ContactShadows')
    for (const renderer of this.oldShadow?.getComponentsInChildren(MeshRenderer) ?? []) {
      const vertices = renderer.mesh?.readAttribute(0, gfx.AttributeName.ATTR_POSITION)
      if (!vertices || vertices.length % 216) throw Error('Unexpected contact-shadow geometry')
      for (let i = 0; i < vertices.length; i += 216) {
        let x = 0, y = 0, z = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
        for (let j = 0; j < 72; j++) {
          const p = Vec3.transformMat4(new Vec3(), new Vec3(vertices[i + j * 3]!, vertices[i + j * 3 + 1]!, vertices[i + j * 3 + 2]!), renderer.node.worldMatrix)
          x += p.x / 72; y += p.y / 72; z += p.z / 72
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
        }
        if (LAYOUT_IDS.some(id => { const f = LAYOUT_FIXTURES[id]; return f.mode !== 'slide' && Math.hypot(f.pose.x - x, f.pose.z - z) < .001 })) continue
        this.fixedShadows.push({ center: { x, z }, halfX: (maxX - minX) / 2, halfZ: (maxZ - minZ) / 2, y })
      }
    }
    if (this.oldShadow) this.oldShadow.active = false
    this.shadow = new Node('LayoutContactShadows'); root.addChild(this.shadow); this.shadow.layer = root.layer
    this.renderer = this.shadow.addComponent(MeshRenderer)
    this.material = new Material()
    this.material.initialize({ effectName: 'builtin-unlit', technique: 1, defines: { USE_VERTEX_COLOR: true }, states: { rasterizerState: { cullMode: gfx.CullMode.NONE } } })
    this.material.setProperty('mainColor', Color.WHITE); this.renderer.setSharedMaterial(this.material, 0)
    this.renderer.shadowCastingMode = 0; this.renderer.receiveShadow = 0
  }
  apply(layout: LayoutConfig) {
    const g = buildLayoutGeometry(layout)
    for (const b of this.bindings) {
      const p = layout.stations[b.id], origin = LAYOUT_FIXTURES[b.id].pose
      const offset = rotateOffset({ x: b.p.x - origin.x, z: b.p.z - origin.z }, p.quarterTurn)
      b.node.setWorldPosition(p.x + offset.x, b.p.y, p.z + offset.z)
      if (b.proxy) {
        b.node.setWorldRotation(b.q)
        b.node.setWorldScale(p.quarterTurn % 2 ? b.scale.z : b.scale.x, b.scale.y, p.quarterTurn % 2 ? b.scale.x : b.scale.z)
      } else {
        const q = Quat.fromEuler(new Quat(), 0, p.quarterTurn * 90, 0)
        Quat.multiply(q, q, b.q); b.node.setWorldRotation(q); b.node.setWorldScale(b.scale)
      }
    }
    const positions: number[] = [], colors: number[] = []
    const boxes = [...LAYOUT_IDS.filter(id => LAYOUT_FIXTURES[id].mode !== 'slide').map(id => ({ ...g.fixtures[id], y: .008 })), ...this.fixedShadows]
    for (const b of boxes) for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12, c = (i + 1) * Math.PI / 12
      for (const [x, z, alpha] of [[b.center.x, b.center.z, .17], [b.center.x + Math.cos(a) * (b.halfX + .14), b.center.z + Math.sin(a) * (b.halfZ + .14), 0], [b.center.x + Math.cos(c) * (b.halfX + .14), b.center.z + Math.sin(c) * (b.halfZ + .14), 0]]) {
        positions.push(x!, b.y + .001, z!); colors.push(0, 0, 0, alpha!)
      }
    }
    this.renderer.mesh = null; this.mesh?.destroy()
    this.mesh = utils.createMesh({ positions, colors }); this.renderer.mesh = this.mesh
    return g
  }
  destroy(): void {
    this.shadow.active = false; this.renderer.mesh = null; this.shadow.destroy(); this.mesh?.destroy(); this.material.destroy()
  }
}
