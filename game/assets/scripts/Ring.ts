import { Camera, Color, Graphics, Label, Node, UITransform, Vec3 } from 'cc'

const R = 22
const W = 5
/** Arc is redrawn only when its fill crosses one of these steps */
const STEPS = 60
const EDGE = 40
const DISC = new Color(0, 0, 0, 150)
const TRACK = new Color(255, 255, 255, 60)

/**
 * A countdown ring pinned over a 3D point, with a short glyph in the middle.
 * The ring sits on top of the anchor (its bottom edge touches it), so anchor at the head top.
 */
export class Ring {
  readonly node: Node
  private g: Graphics
  private label: Label
  private step = -2
  private color = new Color()
  private text = ''
  private world = new Vec3()
  private ui = new Vec3()

  constructor(parent: Node, name: string, fontSize = 26) {
    this.node = new Node(name)
    this.node.layer = parent.layer
    parent.addChild(this.node)
    this.node.addComponent(UITransform).setContentSize(2 * (R + W), 2 * (R + W))
    this.g = this.node.addComponent(Graphics)
    this.g.lineWidth = W
    const t = new Node('Glyph')
    t.layer = parent.layer
    this.node.addChild(t)
    this.label = t.addComponent(Label)
    this.label.fontSize = fontSize
    this.label.lineHeight = fontSize + 2
    this.node.active = false
  }

  /** `fill` 0–1 is the arc left (clockwise from 12 o'clock); below 0 draws no arc. */
  show(fill: number, color: Readonly<Color>, text: string, textColor: Readonly<Color> = Color.WHITE): void {
    if (!this.node.active) this.node.active = true
    const step = fill < 0 ? -1 : Math.round(Math.min(1, fill) * STEPS)
    if (step !== this.step || !this.color.equals(color)) {
      this.step = step
      this.color.set(color)
      this.redraw()
    }
    if (text !== this.text) {
      this.text = text
      this.label.string = text
    }
    if (!this.label.color.equals(textColor)) this.label.color = textColor
  }

  hide(): void {
    if (this.node.active) this.node.active = false
  }

  follow(cam: Camera, x: number, y: number, z: number, halfW = Infinity, halfH = Infinity, dx = 0): void {
    this.world.set(x, y, z)
    cam.convertToUINode(this.world, this.node.parent!, this.ui)
    this.ui.x += dx
    this.ui.y += R + W
    const mx = halfW - EDGE
    const my = halfH - EDGE
    this.ui.x = Math.max(-mx, Math.min(mx, this.ui.x))
    this.ui.y = Math.max(-my, Math.min(my, this.ui.y))
    this.node.setPosition(this.ui)
  }

  private redraw(): void {
    const g = this.g
    g.clear()
    g.fillColor = DISC
    g.circle(0, 0, R + W / 2)
    g.fill()
    g.strokeColor = TRACK
    g.circle(0, 0, R)
    g.stroke()
    if (this.step <= 0) return
    g.strokeColor = this.color
    g.moveTo(0, R)
    g.arc(0, 0, R, Math.PI / 2, Math.PI / 2 - (2 * Math.PI * this.step) / STEPS, false)
    g.stroke()
  }
}
