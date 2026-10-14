import { Color, gfx, instantiate, Material, Mesh, MeshRenderer, Node, Prefab, utils, Vec3 } from 'cc'
import { DRINK_SEC, grillCookLevel } from '../logic/kitchen'
import type { KitchenState } from '../logic/kitchen'
import { DRINKS_BASE_Y } from '../logic/scene-layout'

type Tint = readonly [number, number, number, number]
const WATER: Tint = [.12, .62, .93, .78]
const FOAM: Tint = [.82, .96, 1, .85]
const FIRE: Tint = [1, .19, .015, .92]
const CORE: Tint = [1, .76, .12, .96]
const STEAM: Tint = [.78, .85, .88, .25]
const SMOKE: Tint = [.12, .10, .09, .42]
const CUP: Tint = [.78, .93, .96, .45]
const JUICE: Tint = [1, .31, .035, .9]
const OIL: Tint = [.40, .25, .035, .7]
const WHITE: Tint = [.96, .96, .86, 1]
const SPONGE: Tint = [.95, .75, .07, 1]
const RAW: Tint = [.65, .17, .11, 1]
const COOKED: Tint = [.28, .09, .035, 1]
const BURNT: Tint = [.045, .032, .025, 1]
const CAPACITY = 6144
const SIDES = 10
const TAU = Math.PI * 2

/** One reusable vertex-colour mesh; animation only reads the kitchen state. */
export class WorkstationEffects {
  readonly node: Node
  private renderer: MeshRenderer
  private mesh: Mesh
  private material: Material
  private positions = new Float32Array(CAPACITY * 3)
  private colors = new Float32Array(CAPACITY * 4)
  private geometry = { positions: this.positions, colors: this.colors, minPos: new Vec3(-6, 0, -7), maxPos: new Vec3(10, 4, 7) }
  private used = 0
  private clock = 0
  private sink: Vec3
  private basin: Vec3
  private grill: Vec3[]
  private pans: Node[] = []
  private drinks: Vec3
  private fryer: Vec3
  private rack: Vec3

  constructor(parent: Node, panModel: Prefab | null = null) {
    const props = parent.getChildByName('Props')!
    const anchor = (prop: string, model: string, x: number, y: number, z: number): Vec3 => {
      const holder = props.getChildByName(prop)!.getChildByName(model)!
      return Vec3.transformMat4(new Vec3(), new Vec3(x, y, z), holder.worldMatrix)
    }
    // Coordinates are in the fitted KayKit model space, not the collision box.
    this.sink = anchor('Prop_Sink_0', 'kitchenSink', 0, 1.57, -.08)
    this.basin = anchor('Prop_Sink_0', 'kitchenSink', 0, 1.27, -.08)
    const stoves = props.getChildByName('Prop_Grill')!.children.filter(n => n.name === 'kitchenStove')
    this.grill = stoves.map((n, i) => Vec3.transformMat4(new Vec3(), new Vec3(i ? .5 : -.5, 1.21, .49), n.worldMatrix))
    if (panModel) this.pans = this.grill.map((p, i) => {
      const pan = instantiate(panModel)
      pan.name = `CookingPan_${i}`
      props.getChildByName('Prop_Grill')!.addChild(pan)
      pan.setScale(.48, .14, .48)
      pan.setWorldPosition(p.x, p.y + .005, p.z)
      return pan
    })
    const drink = parent.getChildByName('Station_Drinks')!.worldPosition
    this.drinks = new Vec3(drink.x, DRINKS_BASE_Y + .582, drink.z + .055)
    const fryer = props.getChildByName('Prop_Fryer')!.worldPosition
    this.fryer = new Vec3(fryer.x - .15, 1.035, fryer.z - .035)
    const rack = props.getChildByName('Prop_WashRack')!.worldPosition
    this.rack = new Vec3(rack.x, 1.06, rack.z)
    this.node = new Node('WorkstationEffects')
    this.node.layer = parent.layer
    parent.addChild(this.node)
    this.material = new Material()
    this.material.initialize({
      effectName: 'builtin-unlit', technique: 1, defines: { USE_VERTEX_COLOR: true },
      states: { rasterizerState: { cullMode: gfx.CullMode.NONE } },
    })
    this.material.setProperty('mainColor', Color.WHITE)
    this.mesh = utils.MeshUtils.createDynamicMesh(0, this.geometry, undefined, { maxSubMeshes: 1, maxSubMeshVertices: CAPACITY, maxSubMeshIndices: 0 })
    this.renderer = this.node.addComponent(MeshRenderer)
    this.renderer.mesh = this.mesh
    this.renderer.setSharedMaterial(this.material, 0)
    this.renderer.shadowCastingMode = 0
    this.renderer.receiveShadow = 0
    this.hide()
  }

  hide(): void { this.node.active = false }

  update(k: KitchenState, scrubbing: boolean, running: boolean, dt: number): void {
    this.used = 0
    if (!running) { this.hide(); return }
    this.clock += Math.min(dt, .1)
    const t = this.clock
    for (let i = 0; i < this.grill.length; i++) {
      const slot = k.grill[i], p = this.grill[i]!
      if (!slot?.busy && !k.fire) continue
      const burnt = slot?.busy && grillCookLevel(k, i) === 'burnt'
      for (let j = 0; j < (k.fire ? 6 : 4); j++) {
        const angle = j * TAU / (k.fire ? 6 : 4) + .3
        const x = p.x + Math.cos(angle) * .24, z = p.z + Math.sin(angle) * .23
        const h = (k.fire ? .43 : .13) * (1 + .24 * Math.sin(t * 18 + j * 2.1))
        this.flame(x, p.y - .02, z, k.fire ? .085 : .045, h, FIRE, t + j)
        this.flame(x, p.y - .015, z, k.fire ? .045 : .024, h * .62, CORE, t + j)
      }
      if (slot?.busy) {
        this.disc(p.x, p.y + .06, p.z, .17, .032, burnt ? BURNT : slot.elapsed < k.cfg.cook.rareAt ? RAW : COOKED)
        for (let j = -1; j <= 1; j++) this.box(p.x + j * .065, p.y + .078, p.z, .017, .003, .22, BURNT)
      }
      this.puffs(p, t, burnt || k.fire ? SMOKE : STEAM, k.fire ? .95 : .48, 6)
    }
    if (k.sink.stage !== 'empty') {
      const p = this.basin
      this.disc(p.x, p.y - .025, p.z, .19, .008, WATER)
      this.disc(p.x, p.y - .006 + .007 * Math.sin(t * 4), p.z, .14, .018, WHITE)
      if (k.sink.stage === 'soaking' || scrubbing) {
        this.tube(this.sink.x, p.y + .018, this.sink.z, .018 * (1 + .15 * Math.sin(t * 32)), this.sink.y - p.y - .018, WATER)
        for (let j = 0; j < 3; j++) {
          const f = (t * 3.3 + j / 3) % 1
          this.blob(this.sink.x, this.sink.y - (this.sink.y - p.y) * f, this.sink.z, .011, .024, .011, FOAM, .75)
        }
      }
      for (let j = 0; j < 12; j++) {
        const a = j * 2.4, wave = .5 + .5 * Math.sin(t * 3 + j)
        this.blob(p.x + Math.cos(a) * .16, p.y + .02 + wave * .025, p.z + Math.sin(a) * .16, .023 + wave * .018, .018, .023 + wave * .018, FOAM)
      }
      if (scrubbing) {
        this.box(p.x + Math.sin(t * 24) * .10, p.y + .044, p.z + Math.cos(t * 12) * .055, .095, .04, .055, SPONGE)
        this.puffs(p, t * 1.5, FOAM, .22, 5)
      }
    }
    if (k.cfg.drinkSec !== undefined && k.drinks.stage !== 'empty') {
      const p = this.drinks, d = k.drinks
      const fill = d.stage === 'pouring' ? Math.max(0, Math.min(1, 1 - d.left / (k.cfg.drinkSec ?? DRINK_SEC))) : 1
      this.cup(p.x, p.y, p.z, .067, .165)
      this.disc(p.x, p.y + .008, p.z, .055, .015 + fill * .125, JUICE)
      if (d.stage === 'pouring') {
        this.tube(p.x, p.y + .023 + fill * .125, p.z, .012, .167 - fill * .125, JUICE)
        for (let j = 0; j < 4; j++) {
          const a = t * 8 + j * TAU / 4
          this.blob(p.x + Math.cos(a) * .028, p.y + .025 + fill * .125, p.z + Math.sin(a) * .028, .008, .01, .008, FOAM)
        }
      } else if (d.stage === 'spilled') {
        this.disc(p.x, p.y + .002, p.z + .07, .18, .003, JUICE)
        for (let j = 0; j < 4; j++) {
          const f = (t * 1.8 + j / 4) % 1
          this.blob(p.x + Math.sin(j * 4) * .09, p.y + .16 * (1 - f), p.z + .12, .012, .02, .012, JUICE, 1 - f)
        }
      }
    }
    if (k.cfg.fryerSec !== undefined && k.fryer.stage !== 'empty') {
      const p = this.fryer
      this.disc(p.x, p.y, p.z, .17, .008, OIL)
      if (k.fryer.stage === 'frying') for (let j = 0; j < 10; j++) {
        const f = (t * 1.7 + j * .21) % 1, a = j * 2.4
        this.blob(p.x + Math.cos(a) * .14, p.y + f * .085, p.z + Math.sin(a) * .14, .015 + f * .014, .018, .015 + f * .014, CORE, 1 - f)
      }
      this.puffs(p, t, k.fryer.stage === 'burnt' ? SMOKE : STEAM, .45, 5)
    }
    if (k.rack.count > 0) this.puffs(this.rack, t, FOAM, .25, 4)
    if (this.used === 0) { this.hide(); return }
    this.colors.fill(0, this.used * 4)
    this.mesh.updateSubMesh(0, this.geometry)
    this.renderer.onGeometryChanged()
    this.node.active = true
  }

  private vertex(x: number, y: number, z: number, c: Tint, alpha = 1): void {
    if (this.used >= CAPACITY) throw new Error('Workstation effect mesh capacity exceeded')
    const v = this.used * 3, color = this.used * 4
    this.positions[v] = x; this.positions[v + 1] = y; this.positions[v + 2] = z
    this.colors[color] = c[0]; this.colors[color + 1] = c[1]; this.colors[color + 2] = c[2]; this.colors[color + 3] = c[3] * alpha
    this.used++
  }

  private tube(x: number, y: number, z: number, r: number, h: number, c: Tint): void {
    for (let i = 0; i < SIDES; i++) {
      const a = i * TAU / SIDES, b = (i + 1) * TAU / SIDES
      const ax = x + Math.cos(a) * r, az = z + Math.sin(a) * r, bx = x + Math.cos(b) * r, bz = z + Math.sin(b) * r
      this.vertex(ax, y, az, c); this.vertex(ax, y + h, az, c); this.vertex(bx, y + h, bz, c)
      this.vertex(ax, y, az, c); this.vertex(bx, y + h, bz, c); this.vertex(bx, y, bz, c)
    }
  }

  private disc(x: number, y: number, z: number, r: number, h: number, c: Tint): void {
    this.tube(x, y, z, r, h, c)
    for (let i = 0; i < SIDES; i++) {
      const a = i * TAU / SIDES, b = (i + 1) * TAU / SIDES
      this.vertex(x, y + h, z, c); this.vertex(x + Math.cos(a) * r, y + h, z + Math.sin(a) * r, c); this.vertex(x + Math.cos(b) * r, y + h, z + Math.sin(b) * r, c)
    }
  }

  private cup(x: number, y: number, z: number, r: number, h: number): void {
    this.tube(x, y, z, r, h, CUP)
    for (let i = 0; i < SIDES; i++) {
      const a = i * TAU / SIDES, b = (i + 1) * TAU / SIDES
      const ax = Math.cos(a), az = Math.sin(a), bx = Math.cos(b), bz = Math.sin(b)
      this.vertex(x + ax * r, y + h, z + az * r, WHITE); this.vertex(x + bx * r, y + h, z + bz * r, WHITE); this.vertex(x + ax * (r - .009), y + h, z + az * (r - .009), WHITE)
      this.vertex(x + bx * r, y + h, z + bz * r, WHITE); this.vertex(x + bx * (r - .009), y + h, z + bz * (r - .009), WHITE); this.vertex(x + ax * (r - .009), y + h, z + az * (r - .009), WHITE)
    }
  }

  private flame(x: number, y: number, z: number, r: number, h: number, c: Tint, t: number): void {
    const sway = Math.sin(t * 13) * r * .45
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6, b = (i + 1) * TAU / 6
      const ax = x + Math.cos(a) * r, az = z + Math.sin(a) * r, bx = x + Math.cos(b) * r, bz = z + Math.sin(b) * r
      this.vertex(ax, y, az, c); this.vertex(x + sway, y + h, z, c); this.vertex(bx, y, bz, c)
    }
  }

  private blob(x: number, y: number, z: number, rx: number, ry: number, rz: number, c: Tint, alpha = 1): void {
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4, b = (i + 1) * TAU / 4
      const ax = x + Math.cos(a) * rx, az = z + Math.sin(a) * rz, bx = x + Math.cos(b) * rx, bz = z + Math.sin(b) * rz
      this.vertex(ax, y, az, c, alpha); this.vertex(x, y + ry, z, c, alpha); this.vertex(bx, y, bz, c, alpha)
      this.vertex(ax, y, az, c, alpha); this.vertex(bx, y, bz, c, alpha); this.vertex(x, y - ry, z, c, alpha)
    }
  }

  private box(x: number, y: number, z: number, w: number, h: number, d: number, c: Tint): void {
    for (let side = 0; side < 4; side++) {
      const a = side * TAU / 4 + Math.PI / 4, b = (side + 1) * TAU / 4 + Math.PI / 4
      const ax = x + Math.cos(a) * w * .7071, az = z + Math.sin(a) * d * .7071, bx = x + Math.cos(b) * w * .7071, bz = z + Math.sin(b) * d * .7071
      this.vertex(ax, y, az, c); this.vertex(ax, y + h, az, c); this.vertex(bx, y + h, bz, c)
      this.vertex(ax, y, az, c); this.vertex(bx, y + h, bz, c); this.vertex(bx, y, bz, c)
      this.vertex(x, y + h, z, c); this.vertex(ax, y + h, az, c); this.vertex(bx, y + h, bz, c)
    }
  }

  private puffs(p: Vec3, t: number, c: Tint, height: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const f = (t * .8 + i / count) % 1, a = i * 2.4
      const size = .025 + f * .065
      this.blob(p.x + Math.cos(a + f) * (.06 + f * .10), p.y + .13 + f * height, p.z + Math.sin(a + f) * .10, size, size * 1.2, size, c, Math.sin(f * Math.PI))
    }
  }

  destroy(): void {
    for (const pan of this.pans) pan.destroy()
    this.node.destroy()
    this.mesh.destroy()
    this.material.destroy()
  }
}
