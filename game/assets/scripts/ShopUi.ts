import { Graphics, Label, Node, UITransform, view } from 'cc'
import type { PanelButton } from './ReviewUi'
import { buttonFeedback, drawButton, drawPanel, UI_THEME, uiColor, uiLabel, uiNode } from './ui/UiTheme'
import { drawControlGlyph } from './ui/ControlGlyphs'
import type { ActionIcon } from './ui/UiModel'

const W = 720
const HEAD_H = 106
const FOOT_H = 88
const BTN_W = 132
const BTN_H = 88

export interface ListRow {
  name: string
  desc: string
  btn: string
  on: boolean
  icon?: ActionIcon
}

export class ListPanel {
  readonly node: Node
  buttons: PanelButton[] = []
  private g: Graphics
  private backdrop: Graphics
  private title: Label
  private subtitle: Label
  private footer: Label
  private close: Label
  private previous: Label
  private next: Label
  private cards: { node: Node; art: Graphics; name: Label; desc: Label; button: Label; icon: Graphics }[] = []
  private page = 0
  private pageSize = 1
  private lastTitle = ''
  private rows: readonly ListRow[] = []

  constructor(parent: Node, maxRows: number) {
    this.node = uiNode(parent, 'UI_List')
    this.backdrop = uiNode(this.node, 'Dimmer').addComponent(Graphics)
    this.g = uiNode(this.node, 'Paper').addComponent(Graphics)
    this.title = uiLabel(this.node, 'Title', 30, W - 160, 42)
    this.title.horizontalAlign = Label.HorizontalAlign.LEFT
    this.subtitle = uiLabel(this.node, 'Subtitle', 20, W - 160, 30)
    this.subtitle.horizontalAlign = Label.HorizontalAlign.LEFT; this.subtitle.color = uiColor(UI_THEME.muted)
    this.footer = uiLabel(this.node, 'PageInfo', 20, 340, 32); this.footer.color = uiColor(UI_THEME.muted)
    this.close = uiLabel(this.node, 'Close', 32, 88, 88); this.close.string = '×'
    this.previous = uiLabel(this.node, 'Previous', 22, 132, 88); this.previous.string = '‹ 上一页'
    this.next = uiLabel(this.node, 'Next', 22, 132, 88); this.next.string = '下一页 ›'
    for (const label of [this.close, this.previous, this.next]) buttonFeedback(label.node, label.node.getComponent(UITransform)!.width, 88)
    for (let i = 0; i < maxRows; i++) {
      const node = uiNode(this.node, `Product_${i}`, W - 32, 100), art = node.addComponent(Graphics)
      const name = uiLabel(node, 'Name', 24, W - BTN_W - 156, 34); name.node.setPosition(-30, 28, 0); name.horizontalAlign = Label.HorizontalAlign.LEFT
      const desc = uiLabel(node, 'Description', 20, W - BTN_W - 156, 44); desc.node.setPosition(-30, -16, 0); desc.horizontalAlign = Label.HorizontalAlign.LEFT; desc.color = uiColor(UI_THEME.muted)
      const button = uiLabel(node, 'Buy', 22, BTN_W - 10, BTN_H); button.node.setPosition(W / 2 - BTN_W / 2 - 32, 0, 0)
      buttonFeedback(button.node, BTN_W, BTN_H)
      const icon = uiNode(node, 'ItemIcon').addComponent(Graphics); icon.node.setPosition(-W / 2 + 60, 0, 0); icon.node.setScale(.65, .65, 1)
      this.cards.push({ node, art, name, desc, button, icon })
    }
    this.node.active = false
  }

  resetPage(): void { this.page = 0 }
  turnPage(delta: number): void { this.page += delta; this.show(this.lastTitle, this.rows) }

  show(title: string, rows: readonly ListRow[]): void {
    this.lastTitle = title; this.rows = rows
    const size = view.getVisibleSize()
    this.pageSize = Math.max(1, Math.min(this.cards.length, Math.floor((size.height - HEAD_H - FOOT_H - 48) / 108)))
    const pages = Math.max(1, Math.ceil(rows.length / this.pageSize))
    this.page = Math.max(0, Math.min(pages - 1, this.page))
    const n = Math.min(this.pageSize, rows.length - this.page * this.pageSize)
    const h = HEAD_H + n * 108 + FOOT_H
    this.node.getComponent(UITransform)!.setContentSize(W, h)
    const parts = title.split(' · ')
    this.title.string = parts.shift()!; this.title.node.setPosition(-36, h / 2 - 32, 0)
    this.subtitle.string = parts.join(' · ') || '先准备好厨房，再去接住今天的混乱'
    this.subtitle.node.setPosition(-36, h / 2 - 70, 0)
    this.close.node.setPosition(W / 2 - 52, h / 2 - 48, 0)
    this.backdrop.clear(); this.backdrop.fillColor = uiColor(UI_THEME.shadow, 140)
    this.backdrop.rect(-size.width, -size.height, size.width * 2, size.height * 2); this.backdrop.fill()
    drawPanel(this.g, W, h)
    this.g.fillColor = uiColor(UI_THEME.gold); this.g.roundRect(-W / 2 + 22, h / 2 - 88, 5, 62, 2); this.g.fill()
    this.buttons = [{ id: 'menu-close', x: W / 2 - 52, y: h / 2 - 48, w: 88, h: 88 }]
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]!, index = this.page * this.pageSize + i, row = rows[index]
      card.node.active = i < n && !!row
      if (!card.node.active || !row) continue
      const y = h / 2 - HEAD_H - i * 108 - 50, x = W / 2 - BTN_W / 2 - 32
      card.node.setPosition(0, y, 0); drawPanel(card.art, W - 32, 100, UI_THEME.paper)
      drawButton(card.art, x, 0, BTN_W, BTN_H, row.on)
      card.name.string = row.name; card.desc.string = row.desc; card.button.string = row.btn
      card.button.color = uiColor(row.on ? UI_THEME.inkLight : UI_THEME.muted)
      drawControlGlyph(card.icon, row.icon ?? 'gear', row.on)
      this.buttons.push({ id: `row${index}`, x, y, w: BTN_W, h: BTN_H })
    }
    const y = -h / 2 + FOOT_H / 2
    this.footer.node.setPosition(0, y, 0); this.footer.string = pages > 1 ? `${this.page + 1} / ${pages} 页 · 共 ${rows.length} 项` : '点空白处关闭'
    this.previous.node.active = this.next.node.active = pages > 1
    for (const [label, id, x, on] of [[this.previous, 'menu-prev', -W / 2 + 84, this.page > 0], [this.next, 'menu-next', W / 2 - 84, this.page < pages - 1]] as const) {
      if (pages <= 1) continue
      label.node.setPosition(x, y, 0); label.color = uiColor(on ? UI_THEME.accent : UI_THEME.muted)
      this.buttons.push({ id, x, y, w: 144, h: 88 })
    }
    this.node.active = true
  }
  hide(): void { this.node.active = false }
}
