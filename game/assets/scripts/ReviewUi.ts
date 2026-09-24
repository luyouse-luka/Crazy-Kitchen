import { Color, Graphics, Label, Node, tween, UIOpacity, UITransform } from 'cc'

/** Placeholder avatars until the character art has portraits: a coloured disc with the first glyph */
const AVATAR = [
  new Color(231, 111, 81, 255),
  new Color(42, 157, 143, 255),
  new Color(233, 196, 106, 255),
  new Color(106, 76, 147, 255),
  new Color(69, 123, 157, 255),
  new Color(230, 57, 70, 255),
]
const BG = new Color(20, 22, 28, 215)
const NAME = new Color(255, 215, 120, 255)

export interface ReviewLine {
  name: string
  avatar: number
  /** 1–5, or 0 for a remark */
  stars: number
  text: string
}

export function starsText(n: number): string {
  return n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : ''
}

function addLabel(parent: Node, name: string, size: number, x: number, y: number, w: number, left: boolean): Label {
  const n = new Node(name)
  n.layer = parent.layer
  parent.addChild(n)
  n.setPosition(x, y, 0)
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

function drawAvatar(g: Graphics, x: number, y: number, r: number, idx: number): void {
  g.fillColor = AVATAR[idx % AVATAR.length]!
  g.circle(x, y, r)
  g.fill()
}

const W = 1000
/** One row so it fits the strip above the order cards */
export const TOAST_H = 54
const H = TOAST_H
const SHOW_SEC = 4.5
const QUEUE_MAX = 4

/** Top-of-screen popup, one line at a time: avatar · who · stars · what they said */
export class Toast {
  readonly node: Node
  private g: Graphics
  private initial: Label
  private name: Label
  private text: Label
  private opacity: UIOpacity
  private queue: ReviewLine[] = []
  private left = 0

  constructor(parent: Node) {
    this.node = new Node('UI_Toast')
    this.node.layer = parent.layer
    parent.addChild(this.node)
    this.node.addComponent(UITransform).setContentSize(W, H)
    this.opacity = this.node.addComponent(UIOpacity)
    this.g = this.node.addComponent(Graphics)
    this.initial = addLabel(this.node, 'Initial', 24, -W / 2 + 32, 0, 44, false)
    this.name = addLabel(this.node, 'Name', 22, -W / 2 + 64, 0, 280, true)
    this.name.color = NAME
    this.text = addLabel(this.node, 'Text', 24, -W / 2 + 356, 0, W - 372, true)
    this.node.active = false
  }

  push(line: ReviewLine): void {
    if (this.queue.length >= QUEUE_MAX) this.queue.shift()
    this.queue.push(line)
  }

  clear(): void {
    this.queue.length = 0
    this.left = 0
    this.node.active = false
  }

  /** `y` = canvas y of the popup's centre */
  tick(dt: number, y: number): void {
    if (this.left > 0) {
      this.left -= dt
      if (this.left > 0) return
      this.node.active = false
    }
    const next = this.queue.shift()
    if (!next) return
    this.show(next)
    this.node.setPosition(0, y, 0)
    this.left = SHOW_SEC
  }

  private show(r: ReviewLine): void {
    const g = this.g
    g.clear()
    g.fillColor = BG
    g.roundRect(-W / 2, -H / 2, W, H, H / 2)
    g.fill()
    drawAvatar(g, -W / 2 + 32, 0, 22, r.avatar)
    this.initial.string = r.name.charAt(0)
    const stars = starsText(r.stars)
    this.name.string = stars ? `${r.name}  ${stars}` : r.name
    this.text.string = r.text
    this.node.active = true
    this.opacity.opacity = 0
    tween(this.opacity).to(0.15, { opacity: 255 }).start()
  }
}

const BW = 640
const BH = 560
const ROWS = 5
const BTN_W = 84
const BTN_H = 40
const OK = new Color(60, 160, 90, 255)
const NO = new Color(170, 70, 60, 255)

export interface OfferRow {
  /** 订单内容，已拼好 */
  text: string
  /** 挂在电脑上还剩几秒（取整后传进来，变了才重画） */
  sec: number
}

/** A tappable rect in panel-local coordinates; the caller turns it into a capture zone */
export interface PanelButton {
  id: string
  x: number
  y: number
  w: number
  h: number
}

/** The order-counter computer: delivery offers with accept/reject on top, reviews below */
export class ComputerPanel {
  readonly node: Node
  readonly buttons: PanelButton[] = []
  private g: Graphics
  private title: Label
  private offerTexts: Label[] = []
  private offerNone: Label
  private rows: { initial: Label; name: Label; text: Label }[] = []
  private empty: Label
  private offerKey = ''
  private reviewLines: readonly ReviewLine[] = []

  constructor(parent: Node, maxOffers: number) {
    this.node = new Node('UI_Computer')
    this.node.layer = parent.layer
    parent.addChild(this.node)
    this.node.addComponent(UITransform).setContentSize(BW, BH)
    this.g = this.node.addComponent(Graphics)
    this.title = addLabel(this.node, 'Title', 24, 0, BH / 2 - 28, BW - 40, false)
    const sub = addLabel(this.node, 'OffersTitle', 18, -BW / 2 + 24, BH / 2 - 64, 200, true)
    sub.string = '外卖单'
    sub.color = NAME
    for (let i = 0; i < maxOffers; i++) {
      const y = BH / 2 - 104 - i * 56
      this.offerTexts.push(addLabel(this.node, `Offer_${i}`, 18, -BW / 2 + 24, y, BW - 2 * BTN_W - 72, true))
      this.buttons.push({ id: `accept${i}`, x: BW / 2 - BTN_W * 1.5 - 30, y, w: BTN_W, h: BTN_H })
      this.buttons.push({ id: `reject${i}`, x: BW / 2 - BTN_W / 2 - 20, y, w: BTN_W, h: BTN_H })
      addLabel(this.node, `Accept_${i}`, 18, BW / 2 - BTN_W * 1.5 - 30, y, BTN_W, false).string = '接单'
      addLabel(this.node, `Reject_${i}`, 18, BW / 2 - BTN_W / 2 - 20, y, BTN_W, false).string = '拒单'
    }
    this.offerNone = addLabel(this.node, 'OffersNone', 18, 0, BH / 2 - 104, BW, false)
    this.offerNone.string = '暂时没有外卖单'
    const sub2 = addLabel(this.node, 'ReviewsTitle', 18, -BW / 2 + 24, BH / 2 - 104 - maxOffers * 56 + 6, 200, true)
    sub2.string = '顾客评价'
    sub2.color = NAME
    const top = BH / 2 - 150 - maxOffers * 56
    for (let i = 0; i < ROWS; i++) {
      const y = top - i * 52
      this.rows.push({
        initial: addLabel(this.node, `Initial_${i}`, 18, -BW / 2 + 36, y, 36, false),
        name: addLabel(this.node, `Name_${i}`, 16, -BW / 2 + 62, y + 12, BW - 80, true),
        text: addLabel(this.node, `Text_${i}`, 18, -BW / 2 + 62, y - 10, BW - 80, true),
      })
      this.rows[i]!.name.color = NAME
    }
    this.empty = addLabel(this.node, 'Empty', 18, 0, top - 40, BW, false)
    this.empty.string = '还没有评价'
    this.node.active = false
  }

  /** Reviews newest first. Call once on open and whenever a review lands. */
  show(rating: number, lines: readonly ReviewLine[]): void {
    this.title.string = rating > 0 ? `店铺评分 ${rating.toFixed(1)} ★  ·  点空白处关闭` : '店铺评分 —  ·  点空白处关闭'
    for (let i = 0; i < ROWS; i++) {
      const row = this.rows[i]!
      const r = lines[i]
      row.initial.node.active = row.name.node.active = row.text.node.active = !!r
      if (!r) continue
      row.initial.string = r.name.charAt(0)
      const stars = starsText(r.stars)
      row.name.string = stars ? `${r.name}  ${stars}` : `${r.name}  · 吐槽`
      row.text.string = r.text
    }
    this.empty.node.active = lines.length === 0
    this.reviewLines = lines
    this.offerKey = ''
    this.node.active = true
  }

  /** Per frame while open; redraws only when an offer's text or whole second changes */
  syncOffers(offers: readonly (OfferRow | null)[]): void {
    let key = ''
    for (const o of offers) key += o ? `${o.sec}|${o.text};` : '-;'
    if (key === this.offerKey) return
    this.offerKey = key
    const g = this.g
    g.clear()
    g.fillColor = BG
    g.roundRect(-BW / 2, -BH / 2, BW, BH, 18)
    g.fill()
    let any = false
    for (let i = 0; i < this.offerTexts.length; i++) {
      const o = offers[i] ?? null
      const label = this.offerTexts[i]!
      label.node.active = !!o
      this.node.getChildByName(`Accept_${i}`)!.active = !!o
      this.node.getChildByName(`Reject_${i}`)!.active = !!o
      if (!o) continue
      any = true
      label.string = `${o.text}  （${o.sec}s）`
      const a = this.buttons[i * 2]!
      const r = this.buttons[i * 2 + 1]!
      g.fillColor = OK
      g.roundRect(a.x - a.w / 2, a.y - a.h / 2, a.w, a.h, 8)
      g.fill()
      g.fillColor = NO
      g.roundRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 8)
      g.fill()
    }
    this.offerNone.node.active = !any
    const top = BH / 2 - 150 - this.offerTexts.length * 56
    for (let i = 0; i < ROWS; i++) {
      const r = this.reviewLines[i]
      if (r) drawAvatar(g, -BW / 2 + 36, top - i * 52, 18, r.avatar)
    }
  }

  hide(): void {
    this.node.active = false
  }
}
