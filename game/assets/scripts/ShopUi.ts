import { Color, Graphics, Label, Node, UITransform } from 'cc'
import type { PanelButton } from './ReviewUi'

const W = 640
const ROW_H = 76
const HEAD_H = 72
const BTN_W = 96
const BTN_H = 44
const BG = new Color(20, 22, 28, 250)
const NAME = new Color(255, 215, 120, 255)
const ON = new Color(60, 160, 90, 255)
const OFF = new Color(90, 90, 96, 255)

export interface ListRow {
  name: string
  desc: string
  btn: string
  /** Green and tappable, else grey */
  on: boolean
}

function addLabel(parent: Node, size: number, w: number, left: boolean): Label {
  const n = new Node('Label')
  n.layer = parent.layer
  parent.addChild(n)
  const t = n.addComponent(UITransform)
  t.setContentSize(w, size + 6)
  if (left) t.setAnchorPoint(0, 0.5)
  const l = n.addComponent(Label)
  l.fontSize = size
  l.lineHeight = size + 4
  l.overflow = Label.Overflow.SHRINK
  if (left) l.horizontalAlign = Label.HorizontalAlign.LEFT
  return l
}

/** Title plus rows of name / description / button: the shop, the counter menu, decorating. Buttons are panel-local rects, turned into capture zones by the caller */
export class ListPanel {
  readonly node: Node
  buttons: PanelButton[] = []
  private g: Graphics
  private title: Label
  private names: Label[] = []
  private descs: Label[] = []
  private btnLabels: Label[] = []

  constructor(parent: Node, maxRows: number) {
    this.node = new Node('UI_List')
    this.node.layer = parent.layer
    parent.addChild(this.node)
    this.node.addComponent(UITransform)
    this.g = this.node.addComponent(Graphics)
    this.title = addLabel(this.node, 24, W - 40, false)
    for (let i = 0; i < maxRows; i++) {
      const name = addLabel(this.node, 22, W - BTN_W - 72, true)
      name.color = NAME
      this.names.push(name)
      this.descs.push(addLabel(this.node, 17, W - BTN_W - 72, true))
      this.btnLabels.push(addLabel(this.node, 18, BTN_W, false))
    }
    this.node.active = false
  }

  /** Rows past maxRows are dropped */
  show(title: string, rows: readonly ListRow[]): void {
    const n = Math.min(rows.length, this.names.length)
    const h = HEAD_H + n * ROW_H + 16
    this.node.getComponent(UITransform)!.setContentSize(W, h)
    this.title.node.setPosition(0, h / 2 - 32, 0)
    this.title.string = title
    const g = this.g
    g.clear()
    g.fillColor = BG
    g.roundRect(-W / 2, -h / 2, W, h, 18)
    g.fill()
    this.buttons = []
    for (let i = 0; i < this.names.length; i++) {
      const r = rows[i]
      const vis = i < n && !!r
      this.names[i]!.node.active = vis
      this.descs[i]!.node.active = vis
      this.btnLabels[i]!.node.active = vis
      if (!vis || !r) continue
      const y = h / 2 - HEAD_H - i * ROW_H - ROW_H / 2
      const x = W / 2 - BTN_W / 2 - 24
      this.names[i]!.node.setPosition(-W / 2 + 24, y + 12, 0)
      this.names[i]!.string = r.name
      this.descs[i]!.node.setPosition(-W / 2 + 24, y - 14, 0)
      this.descs[i]!.string = r.desc
      this.btnLabels[i]!.node.setPosition(x, y, 0)
      this.btnLabels[i]!.string = r.btn
      this.buttons.push({ id: `row${i}`, x, y, w: BTN_W, h: BTN_H })
      g.fillColor = r.on ? ON : OFF
      g.roundRect(x - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 8)
      g.fill()
    }
    this.node.active = true
  }

  hide(): void {
    this.node.active = false
  }
}
