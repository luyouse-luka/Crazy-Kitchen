import { Color, Material, Mesh, MeshRenderer, Node, primitives, utils } from 'cc'
import { INGREDIENTS } from '../logic/types'
import type { Ingredient } from '../logic/types'
import { fitStackArt } from './BurgerStack'
import type { StackArt } from './BurgerStack'

const ART: Record<Ingredient, keyof StackArt> = {
  bun: 'bread', patty: 'meat', cheese: 'cheese', lettuce: 'cabbage', tomato: 'tomato',
  onion: 'onion', pickle: 'pickle', bacon: 'bacon',
}
// Positions are in the GLB cavity: x ±.744, lower y .256–1.45, upper y 1.55–2.244, z -.85–.5.
const SHELVES: readonly (readonly Ingredient[])[] = [['patty', 'bacon'], ['onion', 'pickle'], ['lettuce', 'tomato'], ['bun', 'cheese']]
const HEIGHTS = [.29, .88, 1.59, 1.94] as const
const DISPLAY_UNITS = 4

/** Read-only stock display, parented inside the fridge so layout edits carry it along. */
export class FridgeContents {
  readonly node: Node
  private readonly foods = new Map<Ingredient, Node[]>()
  private readonly mesh: Mesh
  private readonly material: Material

  constructor(fridge: Node, art: StackArt) {
    const body = fridge.getChildByPath('kitchenFridge/fridge/fridge_A')!
    this.node = new Node('FridgeContents')
    this.node.layer = body.layer
    body.addChild(this.node)
    this.mesh = utils.createMesh(primitives.box())
    this.material = new Material()
    this.material.initialize({ effectName: 'builtin-unlit' })
    this.material.setProperty('mainColor', new Color(213, 233, 225, 255))
    for (let row = 0; row < SHELVES.length; row++) {
      const y = HEIGHTS[row]!
      this.box(`Shelf_${row}`, 0, y - .018, -.15, 1.43, .025, 1.22)
      for (let col = 0; col < 2; col++) {
        const ingredient = SHELVES[row]![col]!, source = art[ART[ingredient]]
        if (!source) continue
        const x = col ? .36 : -.36
        this.box(`Tray_${ingredient}`, x, y + .015, -.02, .67, .035, .86)
        this.box(`TrayLip_${ingredient}`, x, y + .055, .395, .67, .07, .025)
        const units: Node[] = []
        for (let i = 0; i < DISPLAY_UNITS; i++) {
          const food = fitStackArt(this.node, source, .29, ingredient === 'cheese' || ingredient === 'bacon' ? .065 : .16)
          food.name = `Stock_${ingredient}_${i}`
          food.setPosition(x + (i % 2 ? .16 : -.16), y + .035, i < 2 ? .19 : -.22)
          for (const renderer of food.getComponentsInChildren(MeshRenderer)) renderer.shadowCastingMode = 0
          units.push(food)
        }
        this.foods.set(ingredient, units)
      }
    }
    this.node.active = false
  }

  sync(stock: readonly number[]): void {
    for (let index = 0; index < INGREDIENTS.length; index++) {
      const units = this.foods.get(INGREDIENTS[index]!)
      if (!units) continue
      const visible = Math.min(DISPLAY_UNITS, Math.max(0, stock[index] ?? 0))
      for (let i = 0; i < units.length; i++) units[i]!.active = i < visible
    }
  }

  destroy(): void {
    this.node.destroy()
    this.mesh.destroy()
    this.material.destroy()
  }

  private box(name: string, x: number, y: number, z: number, w: number, h: number, d: number): void {
    const node = new Node(name)
    node.layer = this.node.layer
    this.node.addChild(node)
    node.setPosition(x, y, z); node.setScale(w, h, d)
    const renderer = node.addComponent(MeshRenderer)
    renderer.mesh = this.mesh
    renderer.setSharedMaterial(this.material, 0)
    renderer.shadowCastingMode = 0; renderer.receiveShadow = 0
  }
}
