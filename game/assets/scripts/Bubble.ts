import { Camera, Color, Label, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc'

const ICON = 44
const GAP = 4
/** Keeps an edge-pinned bubble's icons and caption fully on screen */
const EDGE = 60

/**
 * A HUD chip pinned over a 3D point: a row of icons with an optional caption under it.
 * Redraws only when `key` changes — Label.string relayouts on every assignment, and a numeric
 * key keeps the per-frame check allocation-free.
 */
export class Bubble {
  readonly node: Node
  private icons: Sprite[] = []
  private label: Label
  private key = -1
  private world = new Vec3()
  private ui = new Vec3()

  constructor(parent: Node, name: string, maxIcons: number) {
    this.node = new Node(name)
    this.node.layer = parent.layer
    parent.addChild(this.node)
    for (let i = 0; i < maxIcons; i++) {
      const n = new Node(`Icon_${i}`)
      n.layer = parent.layer
      this.node.addChild(n)
      n.addComponent(UITransform).setContentSize(ICON, ICON)
      const s = n.addComponent(Sprite)
      s.sizeMode = Sprite.SizeMode.CUSTOM
      n.active = false
      this.icons.push(s)
    }
    const t = new Node('Caption')
    t.layer = parent.layer
    this.node.addChild(t)
    t.setPosition(0, -ICON / 2 - 14, 0)
    this.label = t.addComponent(Label)
    this.label.fontSize = 22
    this.label.lineHeight = 24
    this.label.enableOutline = true
    this.label.outlineWidth = 3
    this.label.outlineColor = Color.BLACK
    this.node.active = false
  }

  /** `frames[0..count)` are drawn left to right; `text` may be empty. */
  show(key: number, frames: readonly (SpriteFrame | null)[], count: number, text: string, color: Color): void {
    if (!this.node.active) this.node.active = true
    if (key === this.key) return
    this.key = key
    const n = Math.min(count, this.icons.length)
    const x0 = -((n - 1) * (ICON + GAP)) / 2
    for (let i = 0; i < this.icons.length; i++) {
      const s = this.icons[i]!
      const on = i < n
      s.node.active = on
      if (!on) continue
      s.spriteFrame = frames[i] ?? null
      s.node.setPosition(x0 + i * (ICON + GAP), 0, 0)
    }
    this.label.string = text
    this.label.color = color
  }

  hide(): void {
    if (this.node.active) this.node.active = false
    this.key = -1
  }

  /** Pinned inside ±halfW/±halfH (canvas units) so an off-screen station still shows its state at the edge. */
  follow(cam: Camera, x: number, y: number, z: number, halfW = Infinity, halfH = Infinity): void {
    this.world.set(x, y, z)
    cam.convertToUINode(this.world, this.node.parent!, this.ui)
    const mx = halfW - EDGE
    const my = halfH - EDGE
    this.ui.x = Math.max(-mx, Math.min(mx, this.ui.x))
    this.ui.y = Math.max(-my, Math.min(my, this.ui.y))
    this.node.setPosition(this.ui)
  }
}
