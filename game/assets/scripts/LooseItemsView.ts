import { Color, instantiate, Material, Mesh, MeshRenderer, Node, primitives, utils } from 'cc'
import type { LooseItem, LooseItems } from '../logic/loose-items'
import type { Burger } from '../logic/types'
import { BurgerStack } from './BurgerStack'
import type { StackArt } from './BurgerStack'

interface ItemView { id: number; root: Node; stacks: BurgerStack[]; foods: Burger[]; ground: Node; lastImpacts: number; pulse: number }

export class LooseItemsView {
  private templates: Node
  private art: StackArt
  private pool: ItemView[] = []
  private ringMesh: Mesh
  private material: Material
  private root: Node

  constructor(world: Node, art: StackArt) {
    this.root = new Node('LooseItems'); this.root.layer = art.bread.layer; world.addChild(this.root)
    this.templates = new Node('LooseItemTemplates'); this.templates.active = false; this.root.addChild(this.templates)
    const copies: Record<string, Node> = {}
    for (const [key, source] of Object.entries(art)) { const n = instantiate(source as Node); n.active = true; this.templates.addChild(n); copies[key] = n }
    this.art = copies as unknown as StackArt
    this.ringMesh = utils.MeshUtils.createMesh(primitives.torus(.23, .012, { radialSegments: 6, tubularSegments: 20 }))
    this.material = new Material(); this.material.initialize({ effectName: 'builtin-unlit' }); this.material.setProperty('mainColor', new Color(77, 210, 207))
  }

  sync(state: LooseItems, selected: LooseItem | null, dt: number): void {
    for (const view of this.pool) if (!state.items.some(i => i.id === view.id)) { view.id = -1; view.root.active = false; view.ground.active = false }
    for (const item of state.items) {
      let view = this.pool.find(v => v.id === item.id)
      if (!view) { view = this.pool.find(v => v.id === -1) ?? this.makeView(); this.assign(view, item) }
      view.root.active = true; view.root.setPosition(item.x, item.y + .025, item.z)
      view.root.setRotationFromEuler(0, item.flying ? item.id * 31 + item.y * 45 : item.id * 31, 0)
      if (view.lastImpacts !== item.impacts) { view.lastImpacts = item.impacts; view.pulse = .22 }
      view.pulse = Math.max(0, view.pulse - dt)
      const pulse = 1 + Math.sin(view.pulse / .22 * Math.PI) * .25
      view.ground.active = true; view.ground.setPosition(item.x, .018, item.z)
      const scale = (selected === item ? 1.3 : item.flying ? .8 : .65) * pulse
      view.ground.setScale(scale, 1, scale)
    }
  }

  clear(): void { for (const v of this.pool) { v.id = -1; v.root.active = false; v.ground.active = false } }
  destroy(): void { this.root.destroy(); this.ringMesh.destroy(); this.material.destroy(); this.pool.length = 0 }

  private makeView(): ItemView {
    const root = new Node('LooseFood'); root.layer = this.root.layer; this.root.addChild(root)
    const ground = new Node('LooseGroundRing'); ground.layer = root.layer; this.root.addChild(ground)
    const renderer = ground.addComponent(MeshRenderer); renderer.mesh = this.ringMesh; renderer.setSharedMaterial(this.material, 0); renderer.shadowCastingMode = 0
    const view: ItemView = { id: -1, root, stacks: [new BurgerStack(root, this.art)], foods: [], ground, lastImpacts: 0, pulse: 0 }
    this.pool.push(view); return view
  }

  private assign(view: ItemView, item: LooseItem): void {
    view.id = item.id; view.lastImpacts = item.impacts; view.pulse = 0
    for (const stack of view.stacks) stack.hide()
    const p = item.payload, c = p.carry
    view.foods = p.burger ? [p.burger] : c.kind === 'patty' ? [{ ingredients: ['patty'], cook: c.cook }] : [c.ingredient, ...(c.second ? [c.second] : [])].map(i => ({ ingredients: [i], cook: i === 'patty' ? 'raw' : null }))
    if (view.foods.length === 2 && view.stacks.length === 1) view.stacks.push(new BurgerStack(view.root, this.art))
    for (let i = 0; i < view.foods.length; i++) view.stacks[i]!.show(view.foods[i]!, i === 0 && p.plated, view.foods.length === 2 ? (i - .5) * .34 : 0, 0, 0)
  }
}
