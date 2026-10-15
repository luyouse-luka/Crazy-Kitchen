import { _decorator, Color, Component, gfx, Material, Mesh, MeshRenderer, Node, utils, Vec3 } from 'cc'
import type { CookLevel } from '../logic/types'
import { COOK_APPEARANCE } from './CookAppearance'

const { ccclass } = _decorator
const cache = new Map<CookLevel, Mesh>()
let owners = 0
let bodyMaterial: Material | null = null
const SMOKE_FACES = new Uint8Array([0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 2, 1, 3, 2, 1, 4, 3, 1, 5, 4, 1, 2, 5])

function bodyMesh(level: CookLevel): Mesh {
  const cached = cache.get(level)
  if (cached) return cached
  const appearance = COOK_APPEARANCE[level]
  const rgb = appearance.rgb.map(v => v / 255)
  const positions: number[] = [], colors: number[] = []
  const tri = (a: number[], b: number[], c: number[], shade: number): void => {
    positions.push(...a, ...b, ...c)
    for (let k = 0; k < 3; k++) colors.push(rgb[0]! * shade, rgb[1]! * shade, rgb[2]! * shade, 1)
  }
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, b = (i + 1) * Math.PI / 8
    const p = [Math.cos(a) * .5, 1, Math.sin(a) * .5], q = [Math.cos(b) * .5, 1, Math.sin(b) * .5]
    tri([0, 1, 0], q, p, 1)
    tri([p[0]!, 0, p[2]!], p, q, .76)
    tri([p[0]!, 0, p[2]!], q, [q[0]!, 0, q[2]!], .76)
  }
  if (appearance.char > 0) for (let i = -1; i <= 1; i++) {
    const x = i * .23, w = .018 + appearance.char * .022
    const z = Math.sqrt(.48 ** 2 - (Math.abs(x) + w) ** 2)
    tri([x - w, 1.015, -z], [x + w, 1.015, z], [x + w, 1.015, -z], 1 - appearance.char * .85)
    tri([x - w, 1.015, -z], [x - w, 1.015, z], [x + w, 1.015, z], 1 - appearance.char * .85)
  }
  const mesh = utils.MeshUtils.createMesh({ positions, colors })
  cache.set(level, mesh)
  return mesh
}

@ccclass('PattyVisual')
export class PattyVisual extends Component {
  cook: CookLevel = 'raw'
  private renderer!: MeshRenderer
  private smoke!: Node
  private smokeMesh!: Mesh
  private smokeMaterial!: Material
  private positions = new Float32Array(3 * 24 * 3)
  private colors = new Float32Array(3 * 24 * 4)
  private smokePoints = new Float32Array(18)
  private geometry = { positions: this.positions, colors: this.colors, minPos: new Vec3(-1, 0, -1), maxPos: new Vec3(1, 12, 1) }
  private height = .05
  private clock = 0
  private ready = false
  private meshDirty = false

  static create(parent: Node, diameter: number, height: number): PattyVisual {
    const node = new Node('PattySurface')
    node.layer = parent.layer
    parent.addChild(node)
    node.setScale(diameter, height, diameter)
    const visual = node.addComponent(PattyVisual)
    visual.init(height)
    return visual
  }

  private init(height: number): void {
    owners++
    this.height = height
    if (!bodyMaterial) {
      bodyMaterial = new Material()
      bodyMaterial.initialize({ effectName: 'builtin-unlit', defines: { USE_VERTEX_COLOR: true }, states: { rasterizerState: { cullMode: gfx.CullMode.NONE } } })
      bodyMaterial.setProperty('mainColor', Color.WHITE)
    }
    this.renderer = this.node.addComponent(MeshRenderer)
    this.renderer.setSharedMaterial(bodyMaterial, 0)
    this.renderer.mesh = bodyMesh('raw')
    this.renderer.shadowCastingMode = 0
    this.smoke = new Node('BurntSmoke')
    this.smoke.layer = this.node.layer
    this.node.addChild(this.smoke)
    this.smokeMaterial = new Material()
    this.smokeMaterial.initialize({ effectName: 'builtin-unlit', technique: 1, defines: { USE_VERTEX_COLOR: true }, states: { rasterizerState: { cullMode: gfx.CullMode.NONE } } })
    this.smokeMaterial.setProperty('mainColor', Color.WHITE)
    this.smokeMesh = utils.MeshUtils.createDynamicMesh(0, this.geometry, undefined, { maxSubMeshes: 1, maxSubMeshVertices: 72, maxSubMeshIndices: 0 })
    const renderer = this.smoke.addComponent(MeshRenderer)
    renderer.mesh = this.smokeMesh
    renderer.setSharedMaterial(this.smokeMaterial, 0)
    renderer.shadowCastingMode = 0
    this.smoke.active = false
    this.ready = true
  }

  setCook(level: CookLevel): void {
    if (this.cook === level) return
    this.cook = level
    if (this.renderer.enabledInHierarchy) this.renderer.mesh = bodyMesh(level)
    else this.meshDirty = true
    this.smoke.active = COOK_APPEARANCE[level].smoke
  }

  override lateUpdate(dt: number): void {
    // An inactive Cocos renderer retains its old submodel when its mesh changes.
    if (this.meshDirty) { this.renderer.mesh = bodyMesh(this.cook); this.meshDirty = false }
    if (!this.ready || !this.smoke.active) return
    this.clock += dt
    let used = 0
    for (let i = 0; i < 3; i++) {
      const phase = (this.clock * 1.3 + i / 3) % 1
      const x = Math.sin(this.clock * 2 + i * 2) * .16, y = 1 + (phase * .22 + .035) / this.height, z = Math.cos(i * 2) * .12
      const r = .07 + phase * .09, ry = (.014 + phase * .02) / this.height
      for (let j = 0; j < 6; j++) {
        this.smokePoints[j * 3] = x + (j === 2 ? -r : j === 4 ? r : 0)
        this.smokePoints[j * 3 + 1] = y + (j === 0 ? ry : j === 1 ? -ry : 0)
        this.smokePoints[j * 3 + 2] = z + (j === 3 ? r : j === 5 ? -r : 0)
      }
      for (const v of SMOKE_FACES) {
        for (let axis = 0; axis < 3; axis++) this.positions[used * 3 + axis] = this.smokePoints[v * 3 + axis]!
        this.colors[used * 4] = .025
        this.colors[used * 4 + 1] = .021
        this.colors[used * 4 + 2] = .02
        this.colors[used * 4 + 3] = (1 - phase) * .42
        used++
      }
    }
    this.smokeMesh.updateSubMesh(0, this.geometry)
  }

  override onDestroy(): void {
    if (!this.ready) return
    this.smokeMesh.destroy()
    this.smokeMaterial.destroy()
    if (--owners === 0) {
      for (const mesh of cache.values()) mesh.destroy()
      cache.clear()
      bodyMaterial?.destroy()
      bodyMaterial = null
    }
  }
}
