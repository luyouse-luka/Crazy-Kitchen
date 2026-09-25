import { Color, Graphics, Label, Node, UITransform } from 'cc'
import type { TaskStatus } from '../logic/tasks'

export const TASK_CARD_W = 300
const LINE_H = 28
const HEAD_H = 32
const PAD = 8
const BG = new Color(20, 22, 28, 200)
const HEAD = new Color(255, 215, 120, 255)
const COLOR: Record<TaskStatus, Color> = {
  open: new Color(255, 255, 255, 255),
  done: new Color(120, 220, 120, 255),
  failed: new Color(150, 150, 156, 255),
}
const MARK: Record<TaskStatus, string> = { open: '○', done: '✔', failed: '✘' }

function addLabel(parent: Node, size: number, w: number, anchorX: number): Label {
  const n = new Node('Label')
  n.layer = parent.layer
  parent.addChild(n)
  const t = n.addComponent(UITransform)
  t.setContentSize(w, size + 6)
  t.setAnchorPoint(anchorX, 0.5)
  const l = n.addComponent(Label)
  l.fontSize = size
  l.lineHeight = size + 4
  l.overflow = Label.Overflow.SHRINK
  l.horizontalAlign = anchorX === 0 ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.RIGHT
  return l
}

/** HUD card pinned to the screen's top-right corner: title, then one line per task with its reward at the end */
export class TaskCard {
  readonly node: Node
  readonly height: number
  private lines: Label[] = []
  private rewards: Label[] = []

  constructor(parent: Node, count: number, reward: number, bonus: number) {
    const W = TASK_CARD_W
    const h = (this.height = HEAD_H + count * LINE_H + PAD * 2)
    this.node = new Node('UI_Tasks')
    this.node.layer = parent.layer
    parent.addChild(this.node)
    this.node.addComponent(UITransform).setContentSize(W, h)
    const g = this.node.addComponent(Graphics)
    g.fillColor = BG
    g.roundRect(-W / 2, -h / 2, W, h, 10)
    g.fill()
    const left = -W / 2 + PAD + 4
    const right = W / 2 - PAD - 4
    const headY = h / 2 - PAD - HEAD_H / 2
    const title = addLabel(this.node, 20, 120, 0)
    title.node.setPosition(left, headY, 0)
    title.string = '每日任务'
    title.color = HEAD
    const all = addLabel(this.node, 16, W - 140, 1)
    all.node.setPosition(right, headY, 0)
    all.string = `全部完成再 +¥${bonus}`
    all.color = HEAD
    for (let i = 0; i < count; i++) {
      const y = headY - HEAD_H / 2 - LINE_H * (i + 0.5)
      const l = addLabel(this.node, 18, W - 90, 0)
      l.node.setPosition(left, y, 0)
      this.lines.push(l)
      const r = addLabel(this.node, 18, 60, 1)
      r.node.setPosition(right, y, 0)
      r.string = `+¥${reward}`
      this.rewards.push(r)
    }
  }

  set(i: number, text: string, status: TaskStatus): void {
    const l = this.lines[i]
    const r = this.rewards[i]
    if (!l || !r) return
    l.string = `${MARK[status]} ${text}`
    l.color = COLOR[status]
    r.color = status === 'open' ? HEAD : COLOR[status]
  }
}

const HL_W = 300
const HL_H = 170

/** Result-screen card: the day's most outrageous moment, set beside the result panel */
export class HighlightCard {
  readonly node: Node
  private title: Label
  private quote: Label

  constructor(parent: Node) {
    this.node = new Node('UI_Highlight')
    this.node.layer = parent.layer
    parent.addChild(this.node)
    this.node.addComponent(UITransform).setContentSize(HL_W, HL_H)
    const g = this.node.addComponent(Graphics)
    g.fillColor = new Color(20, 22, 28, 235)
    g.roundRect(-HL_W / 2, -HL_H / 2, HL_W, HL_H, 14)
    g.fill()
    const head = addLabel(this.node, 22, HL_W - 24, 0)
    head.node.setPosition(-HL_W / 2 + 14, HL_H / 2 - 22, 0)
    head.string = '🎬 今日名场面'
    head.color = HEAD
    this.title = addLabel(this.node, 20, HL_W - 28, 0)
    this.title.node.setPosition(-HL_W / 2 + 14, HL_H / 2 - 58, 0)
    this.quote = addLabel(this.node, 18, HL_W - 28, 0)
    this.quote.node.setPosition(-HL_W / 2 + 14, -18, 0)
    this.quote.node.getComponent(UITransform)!.setContentSize(HL_W - 28, 84)
    this.quote.overflow = Label.Overflow.SHRINK
    this.quote.enableWrapText = true
    this.quote.color = COLOR.open
  }

  get width(): number {
    return HL_W
  }

  show(title: string, quote: string): void {
    this.title.string = title
    this.quote.string = quote
  }
}
