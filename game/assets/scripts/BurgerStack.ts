import { Color, instantiate, MeshRenderer, Node, Vec3 } from 'cc'
import type { Burger, CookLevel, Ingredient } from '../logic/types'

/** Scene nodes cloned as layer art; the stack squashes each into a disc, so any food model works */
export interface StackArt {
  bread: Node
  meat: Node
  cheese: Node
  cabbage: Node
  tomato: Node
  plate: Node
}

const D = 0.3
const PLATE_H = 0.025
const BUN_H = 0.06

interface LayerSpec {
  art: keyof StackArt
  h: number
  tint?: Color
}

/** onion / pickle / bacon have no model yet: a recoloured stand-in */
const LAYERS: Record<Exclude<Ingredient, 'bun'>, LayerSpec> = {
  patty: { art: 'meat', h: 0.05 },
  cheese: { art: 'cheese', h: 0.015 },
  lettuce: { art: 'cabbage', h: 0.02 },
  tomato: { art: 'tomato', h: 0.02 },
  onion: { art: 'plate', h: 0.015, tint: new Color(235, 215, 240, 255) },
  pickle: { art: 'cabbage', h: 0.012, tint: new Color(90, 130, 50, 255) },
  bacon: { art: 'meat', h: 0.015, tint: new Color(190, 90, 80, 255) },
}

const COOK_TINT: Record<CookLevel, Color> = {
  raw: new Color(255, 255, 255, 255),
  rare: new Color(210, 130, 115, 255),
  medium: new Color(160, 95, 65, 255),
  well: new Color(115, 72, 48, 255),
  burnt: new Color(45, 36, 32, 255),
}

/** The burger as a 3D stack: plate, bottom bun, toppings in the order they went on, top bun */
export class BurgerStack {
  readonly node: Node
  private plate: Node
  private bottom: Node
  private top: Node
  private layers = new Map<Ingredient, Node>()
  private patty2: Node
  private key = ''

  constructor(parent: Node, art: StackArt) {
    this.node = new Node('BurgerStack')
    this.node.layer = art.bread.layer
    parent.addChild(this.node)
    this.plate = this.layer(art.plate, D * 1.4, PLATE_H)
    this.bottom = this.layer(art.bread, D, BUN_H * 0.8)
    this.top = this.layer(art.bread, D, BUN_H)
    for (const [ing, s] of Object.entries(LAYERS) as [Exclude<Ingredient, 'bun'>, LayerSpec][]) {
      const n = this.layer(art[s.art], ing === 'patty' ? D * 0.95 : D * 1.05, s.h)
      if (s.tint) tint(n, s.tint)
      this.layers.set(ing, n)
    }
    this.patty2 = this.layer(art.meat, D * 0.95, LAYERS.patty.h)
    this.node.active = false
  }

  hide(): void {
    this.node.active = false
  }

  show(b: Burger, plated: boolean, x: number, y: number, z: number): void {
    this.node.active = true
    this.node.setPosition(x, y, z)
    const ings = b.ingredients
    const cook = b.cook
    const key = `${ings.join()}|${cook}|${b.double ? b.cook2 : '-'}|${plated}`
    if (key === this.key) return
    this.key = key
    for (const n of this.node.children) n.active = false
    let h = 0
    const put = (n: Node, dy: number): void => {
      n.active = true
      n.setPosition(n.position.x, h, n.position.z)
      h += dy
    }
    if (plated) put(this.plate, PLATE_H)
    const bun = ings.includes('bun')
    if (bun) put(this.bottom, BUN_H * 0.8)
    for (const ing of ings) {
      if (ing === 'bun') continue
      const s = LAYERS[ing]
      if (ing === 'patty' && cook) tint(this.layers.get(ing)!, COOK_TINT[cook])
      put(this.layers.get(ing)!, s.h)
      if (ing === 'patty' && b.double) {
        if (b.cook2) tint(this.patty2, COOK_TINT[b.cook2])
        put(this.patty2, s.h)
      }
    }
    if (bun) put(this.top, BUN_H)
  }

  /** A clone of `src` scaled to a w × h × w box whose bottom sits on y = 0 */
  private layer(src: Node, w: number, h: number): Node {
    const holder = new Node(src.name)
    holder.layer = this.node.layer
    this.node.addChild(holder)
    const art = instantiate(src)
    holder.addChild(art)
    art.setRotationFromEuler(0, 0, 0)
    art.setScale(1, 1, 1)
    art.setPosition(0, 0, 0)
    const lo = new Vec3(Infinity, Infinity, Infinity)
    const hi = new Vec3(-Infinity, -Infinity, -Infinity)
    // Kenney glbs nest one untransformed-or-offset mesh node; rotation inside is not expected
    for (const mr of art.getComponentsInChildren(MeshRenderer)) {
      const st = mr.mesh?.struct
      if (!st?.minPosition || !st.maxPosition) continue
      const p = mr.node === art ? Vec3.ZERO : mr.node.position
      const k = mr.node === art ? Vec3.ONE : mr.node.scale
      lo.set(Math.min(lo.x, p.x + st.minPosition.x * k.x), Math.min(lo.y, p.y + st.minPosition.y * k.y), Math.min(lo.z, p.z + st.minPosition.z * k.z))
      hi.set(Math.max(hi.x, p.x + st.maxPosition.x * k.x), Math.max(hi.y, p.y + st.maxPosition.y * k.y), Math.max(hi.z, p.z + st.maxPosition.z * k.z))
    }
    if (lo.x === Infinity) return holder
    const sx = w / Math.max(1e-4, hi.x - lo.x)
    const sy = h / Math.max(1e-4, hi.y - lo.y)
    const sz = w / Math.max(1e-4, hi.z - lo.z)
    art.setScale(sx, sy, sz)
    art.setPosition(-((lo.x + hi.x) / 2) * sx, -lo.y * sy, -((lo.z + hi.z) / 2) * sz)
    return holder
  }
}

function tint(n: Node, c: Color): void {
  for (const mr of n.getComponentsInChildren(MeshRenderer)) {
    for (let i = 0; i < mr.sharedMaterials.length; i++) mr.getMaterialInstance(i)?.setProperty('mainColor', c)
  }
}
