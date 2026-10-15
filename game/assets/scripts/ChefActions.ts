import { _decorator, Color, Component, instantiate, Material, Mesh, MeshRenderer, Node, primitives, Quat, SkeletalAnimation, utils, Vec3 } from 'cc'
import type { Carry, InteractKind, KitchenState } from '../logic/kitchen'
import type { Burger } from '../logic/types'
import { BurgerStack, fitStackArt } from './BurgerStack'
import type { StackArt } from './BurgerStack'
import { ChefMotion, solveElbow } from './ChefMotion'
import type { ArmSolution, ChefFrame, Point3 } from './ChefMotion'

const { ccclass, executionOrder } = _decorator
interface Arm { upper: Node; lower: Node; hand: Node; wrist: Node; slot: Node; upperLength: number; lowerLength: number; side: number; pole: Vec3; solution: ArmSolution }
interface SavedRotation { node: Node; rotation: Quat }

@ccclass('ChefActions')
@executionOrder(100)
export class ChefActions extends Component {
  readonly motion = new ChefMotion()
  readonly carryAnchor = new Vec3()
  readonly handAnchors = [new Vec3(), new Vec3()]
  readonly brushAnchor = new Vec3()
  private model!: Node
  private chest!: Node
  private spine!: Node
  private arms: Arm[] = []
  private saved: SavedRotation[] = []
  private kitchen: KitchenState | null = null
  private held: BurgerStack[] = []
  private plates: Node[] = []
  private extras: { kind: string; node: Node }[] = []
  private single: Burger = { ingredients: [], cook: null }
  private running = false
  private animation: SkeletalAnimation | null = null
  private wasBaked = true
  private target = new Vec3()
  private direction = new Vec3()
  private current = new Vec3()
  private delta = new Quat()
  private desired = new Quat()
  private rotation = new Quat()
  private lastBend = 0
  private burger: BurgerStack | null = null
  private itemKind: Carry['kind'] = 'none'
  private itemIngredient: Carry['ingredient'] = 'bun'
  private itemSecond: Carry['second'] = null
  private itemCount = 0
  private lean = new Quat()
  private sponge!: Node
  private spongeMesh!: Mesh
  private spongeMaterial!: Material

  configure(model: Node, world: Node, art: StackArt, extras: Record<string, Node | null> = {}): void {
    this.model = model
    this.animation = model.getComponent(SkeletalAnimation)
    this.wasBaked = this.animation?.useBakedAnimation ?? true
    if (this.animation) this.animation.useBakedAnimation = false
    const bone = (name: string): Node => {
      const find = (n: Node): Node | null => n.name === name ? n : n.children.map(find).find(Boolean) ?? null
      const n = find(model)
      if (!n) throw new Error(`ChefActions missing bone ${name}`)
      return n
    }
    this.chest = bone('K_chest')
    this.spine = bone('K_spine')
    this.saved.push({ node: this.spine, rotation: this.spine.rotation.clone() })
    for (const [name, side] of [['r', -1], ['l', 1]] as const) {
      const upper = bone(`K_upperarm.${name}`), lower = bone(`K_lowerarm.${name}`), wrist = bone(`K_wrist.${name}`), hand = bone(`K_hand.${name}`)
      this.arms.push({ upper, lower, wrist, hand, slot: bone(`K_handslot.${name}`), side, upperLength: Vec3.distance(upper.worldPosition, lower.worldPosition), lowerLength: Vec3.distance(lower.worldPosition, hand.worldPosition), pole: new Vec3(), solution: { elbow: new Vec3(), hand: new Vec3() } })
      for (const node of [upper, lower, wrist]) this.saved.push({ node, rotation: node.rotation.clone() })
    }
    for (let i = 0; i < 2; i++) this.held.push(new BurgerStack(world, art))
    this.sponge = new Node('ChefSponge')
    this.sponge.layer = model.layer
    world.addChild(this.sponge)
    this.spongeMesh = utils.MeshUtils.createMesh(primitives.box({ width: .095, height: .04, length: .055 }))
    this.spongeMaterial = new Material()
    this.spongeMaterial.initialize({ effectName: 'builtin-unlit' })
    this.spongeMaterial.setProperty('mainColor', new Color(242, 191, 18))
    const spongeRenderer = this.sponge.addComponent(MeshRenderer)
    spongeRenderer.mesh = this.spongeMesh
    spongeRenderer.setSharedMaterial(this.spongeMaterial, 0)
    spongeRenderer.shadowCastingMode = 0
    this.sponge.active = false
    for (let i = 0; i < 5; i++) {
      const plate = fitStackArt(world, art.plate, .42, .025)
      plate.active = false
      this.plates.push(plate)
    }
    for (const [name, src] of Object.entries(extras)) {
      if (!src) continue
      const n = name === 'extinguisher' ? instantiate(src) : fitStackArt(world, src, name === 'drink' ? .13 : .27, name === 'drink' ? .22 : .18)
      if (name === 'extinguisher') { world.addChild(n); n.setScale(.25, .25, .25) }
      n.name = `ChefHeld_${name}`
      n.active = false
      this.extras.push({ kind: name, node: n })
    }
  }

  notify(kind: InteractKind, target: Point3 | null): void { this.motion.notify(kind, target) }

  bindBurger(stack: BurgerStack): void { this.burger = stack }

  sync(kitchen: KitchenState, frame: ChefFrame, dt: number, sinkTarget: Point3 | null): void {
    this.kitchen = kitchen
    this.running = frame.running
    this.motion.step(frame, dt)
    if (this.motion.action === 'scrub') this.motion.target = sinkTarget
  }

  reset(): void {
    this.restore()
    this.motion.reset()
    this.running = false
    this.lastBend = 0
    this.hideItems()
    this.burger?.hide()
    if (this.sponge) this.sponge.active = false
  }

  private restore(): void {
    if (!this.lastBend) return
    for (const s of this.saved) s.node.setRotation(s.rotation)
  }

  override update(): void { this.restore() }

  override lateUpdate(): void {
    if (!this.model || !this.kitchen || !this.running) { this.restore(); this.lastBend = 0; this.hideItems(); if (this.sponge) this.sponge.active = false; return }
    for (const s of this.saved) Quat.copy(s.rotation, s.node.rotation)
    const motion = this.motion, carry = this.kitchen.carry
    const weight = motion.action === 'scrub' ? 1 : Math.max(motion.carryWeight, motion.reach)
    if (motion.target && motion.reach > 0) {
      const p = this.chest.worldPosition
      const distance = Math.hypot(motion.target.x - p.x, motion.target.z - p.z)
      const angle = Math.min(30, Math.max(0, (distance - .3) * 65)) * motion.reach
      Quat.fromEuler(this.lean, angle, 0, 0)
      Quat.multiply(this.rotation, this.spine.rotation, this.lean)
      this.spine.setRotation(this.rotation)
    }
    const yaw = this.model.eulerAngles.y * Math.PI / 180
    const sx = Math.sin(yaw), cz = Math.cos(yaw)
    const chest = this.chest.worldPosition
    const y = chest.y - .015
    this.carryAnchor.set(chest.x + sx * .36, y + .025, chest.z + cz * .36)
    for (let i = 0; i < this.arms.length; i++) {
      const arm = this.arms[i]!
      const separated = carry.kind === 'ingredient' && carry.second !== null
      const width = carry.kind === 'plate' || carry.kind === 'stack' || carry.kind === 'crate' ? .19 : separated ? .15 : .12
      this.target.set(chest.x + cz * arm.side * width + sx * .36, y, chest.z - sx * arm.side * width + cz * .36)
      if (motion.target && motion.reach > 0) {
        const t = motion.target
        const scrub = motion.action === 'scrub'
        const scrubX = scrub && i === 0 ? Math.sin(motion.clock * 24) * .075 : 0
        const scrubZ = scrub && i === 0 ? Math.cos(motion.clock * 12) * .035 : 0
        const blend = scrub ? 1 : motion.reach
        Vec3.lerp(this.target, this.target, this.current.set(t.x + cz * (scrub ? arm.side * .09 + scrubX : arm.side * .08), t.y, t.z - sx * (scrub ? arm.side * .09 + scrubX : arm.side * .08) + scrubZ), blend)
      }
      arm.pole.set(cz * arm.side, -.6, -sx * arm.side)
      const result = solveElbow(arm.upper.worldPosition, this.target, arm.upperLength, arm.lowerLength, arm.pole, arm.solution)
      this.aim(arm.upper, arm.lower, result.elbow, weight)
      this.aim(arm.lower, arm.hand, result.hand, weight)
      // Preserve animated wrist twist; attachment uses the actual palm after IK.
      Vec3.copy(this.handAnchors[i]!, arm.hand.worldPosition)
      if (i === 0) Vec3.copy(this.brushAnchor, arm.slot.worldPosition)
    }
    this.lastBend = weight
    this.sponge.active = motion.action === 'scrub'
    if (this.sponge.active) {
      this.sponge.setWorldPosition(this.brushAnchor)
      this.sponge.setWorldRotation(this.arms[0]!.slot.worldRotation)
    }
    this.showItems(carry, yaw)
    if (carry.kind === 'plate' && this.burger) {
      this.burger.node.setWorldPosition(this.carryAnchor)
      this.burger.node.setWorldRotationFromEuler(0, yaw * 180 / Math.PI, 0)
    }
  }

  private aim(bone: Node, child: Node, target: Point3, weight: number): void {
    const start = bone.worldPosition
    Vec3.subtract(this.direction, child.worldPosition, start)
    this.current.set(target.x - start.x, target.y - start.y, target.z - start.z)
    this.direction.normalize(); this.current.normalize()
    Quat.rotationTo(this.delta, this.direction, this.current)
    Quat.multiply(this.desired, this.delta, bone.worldRotation)
    Quat.slerp(this.rotation, bone.worldRotation, this.desired, weight)
    bone.setWorldRotation(this.rotation)
  }

  private hideItems(): void {
    for (const h of this.held) h.hide()
    for (const p of this.plates) p.active = false
    for (const extra of this.extras) extra.node.active = false
  }

  private showItems(carry: Carry, yaw: number): void {
    if (carry.kind !== this.itemKind || carry.ingredient !== this.itemIngredient || carry.second !== this.itemSecond || carry.count !== this.itemCount) this.hideItems()
    this.itemKind = carry.kind
    this.itemIngredient = carry.ingredient
    this.itemSecond = carry.second
    this.itemCount = carry.count
    if (carry.kind === 'none') return
    const a = this.handAnchors[0]!, b = this.handAnchors[1]!
    this.carryAnchor.set((a.x + b.x) / 2, (a.y + b.y) / 2 + .025, (a.z + b.z) / 2)
    if (carry.kind === 'plate') return
    if (carry.kind === 'patty' || carry.kind === 'ingredient') {
      const count = carry.kind === 'ingredient' && carry.second ? 2 : 1
      for (let i = 0; i < count; i++) {
        const ing = carry.kind === 'patty' ? 'patty' : i === 0 ? carry.ingredient : carry.second!
        const p = count === 1 ? this.carryAnchor : this.handAnchors[i]!
        this.single.ingredients[0] = ing
        this.single.ingredients.length = 1
        this.single.cook = carry.kind === 'patty' ? carry.cook : ing === 'patty' ? 'raw' : null
        this.held[i]!.show(this.single, carry.kind === 'patty' && carry.plated, p.x, p.y + (count > 1 ? .025 : 0), p.z)
        if (ing === 'bun') this.held[i]!.node.setScale(.75, .75, .75)
        else this.held[i]!.node.setScale(1, 1, 1)
      }
    } else if (carry.kind === 'stack') {
      for (let i = 0; i < Math.min(5, carry.count); i++) {
        const p = this.plates[i]!
        p.active = true
        p.setWorldPosition(this.carryAnchor.x, this.carryAnchor.y + i * .025, this.carryAnchor.z)
        p.setWorldRotationFromEuler(0, yaw * 180 / Math.PI, 0)
      }
    } else {
      let n: Node | null = null
      for (const extra of this.extras) if (extra.kind === carry.kind) n = extra.node
      if (!n) return
      n.active = true
      n.setWorldPosition(this.carryAnchor)
      n.setWorldRotationFromEuler(0, yaw * 180 / Math.PI, 0)
    }
  }

  override onDisable(): void { this.reset() }

  override onDestroy(): void {
    this.reset()
    for (const h of this.held) h.node.destroy()
    for (const p of this.plates) p.destroy()
    for (const extra of this.extras) extra.node.destroy()
    this.sponge?.destroy()
    this.spongeMesh?.destroy()
    this.spongeMaterial?.destroy()
    if (this.animation?.isValid) this.animation.useBakedAnimation = this.wasBaked
  }
}
