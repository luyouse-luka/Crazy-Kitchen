import { Graphics, Label, Node, UITransform } from 'cc'
import type { Customer } from '../../logic/customer'
import type { KitchenState } from '../../logic/kitchen'
import { INGREDIENTS } from '../../logic/types'
import { inventoryPresentation, orderPresentation } from './UiModel'
import { drawPanel, UI_THEME, uiColor, uiLabel, uiNode, uiSurface } from './UiTheme'

export class InventorySkin {
  private background: Graphics
  private rows: { name: Label; count: Label; surface: Graphics }[] = []
  private subtitle: Label
  private footer: Label
  constructor(private panel: Node, slots: readonly Node[], private title: Label) {
    this.background = uiSurface(panel)
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!
      const surface = uiSurface(slot)
      drawPanel(surface, 120, 120, UI_THEME.raised)
      const icon = slot.getChildByName('Icon')
      if (icon) { icon.getComponent(UITransform)?.setContentSize(58, 58); icon.setPosition(0, 14, 0) }
      const name = uiLabel(slot, 'IngredientName', 22, 116)
      name.node.setPosition(0, -20, 0)
      const count = slot.getChildByName('Count')?.getComponent(Label) ?? uiLabel(slot, 'Count', 18, 116)
      count.fontSize = 18; count.lineHeight = 22; count.node.setPosition(0, -46, 0)
      count.node.getComponent(UITransform)?.setContentSize(116, 26)
      count.enableOutline = false
      this.rows.push({ name, count, surface })
    }
    this.subtitle = uiLabel(panel, 'PanelInstructions', 18, 550)
    this.footer = uiLabel(panel, 'PanelFooter', 18, 550)
    this.footer.color = uiColor(UI_THEME.warning)
    title.fontSize = 26; title.lineHeight = 32; title.enableOutline = false; title.color = uiColor(UI_THEME.text)
  }
  sync(kitchen: Readonly<KitchenState>, storeroom: boolean): void {
    const t = this.panel.getComponent(UITransform)!
    const left = -t.width * t.anchorX, w = t.width, cx = left + w / 2
    this.background.node.setPosition(cx, 0, 0); drawPanel(this.background, w + 28, 410)
    this.title.node.setPosition(cx, 178, 0); this.title.string = storeroom ? '冷库 · 补货' : '冰箱 · 选择食材'
    this.subtitle.node.setPosition(cx, 146, 0); this.subtitle.string = storeroom ? '点选货箱 → 搬回冰箱 → 点按补货' : '点选取一份 · 可同时拿两样食材'
    this.footer.node.setPosition(cx, -178, 0); this.footer.string = '点面板外关闭 · 烹调与顾客等待继续'
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]!, ing = INGREDIENTS[i]
      const p = ing ? inventoryPresentation(ing, kitchen.stock[i]!, kitchen.cfg.fridgeCap ?? Infinity) : null
      row.name.string = p?.name ?? '备用盘子'
      row.count.string = storeroom ? ing ? '整箱补货' : `剩余 ${kitchen.spare}` : p?.count ?? ''
      row.count.color = uiColor(!storeroom && p?.empty ? UI_THEME.danger : UI_THEME.muted)
    }
  }
  layout(height: number, bottomInset = 0): void {
    this.panel.setPosition(0, -height / 2 + Math.max(220, bottomInset + 220), 0)
  }
}

export class OrderCardView {
  readonly node: Node
  private art: Graphics
  private heading: Label
  private recipe: Label
  private cook: Label
  private banned: Label
  private bar: Graphics
  private shown = ''
  private lastRatio = -1
  constructor(parent: Node, readonly width = 280) {
    this.node = uiNode(parent, 'UI_OrderCard', width, 160)
    this.art = this.node.addComponent(Graphics)
    drawPanel(this.art, width, 160)
    this.heading = uiLabel(this.node, 'Customer', 18, width - 32)
    this.heading.node.setPosition(0, 55, 0); this.heading.color = uiColor(UI_THEME.muted)
    this.recipe = uiLabel(this.node, 'Recipe', 22, width - 32, 56)
    this.recipe.node.setPosition(0, 12, 0)
    this.cook = uiLabel(this.node, 'Doneness', 20, width - 32)
    this.cook.node.setPosition(0, -27, 0); this.cook.color = uiColor(UI_THEME.accent)
    this.banned = uiLabel(this.node, 'Banned', 18, width - 32)
    this.banned.node.setPosition(0, -53, 0); this.banned.color = uiColor(UI_THEME.danger)
    this.bar = uiNode(this.node, 'PatienceBar').addComponent(Graphics)
    for (const l of [this.heading, this.recipe, this.cook, this.banned]) l.horizontalAlign = Label.HorizontalAlign.LEFT
    this.node.active = false
  }
  sync(c: Readonly<Customer> | null, name?: string): void {
    this.node.active = !!c?.active && !!c.ordered
    if (!c || !this.node.active) return
    const p = orderPresentation(c.spec)
    const key = `${c.id}|${name}|${p.recipe}|${p.cook}|${p.banned}|${c.friesDue}|${c.drinkDue}|${!!c.burgerVerdict}|${c.late}`
    if (key !== this.shown) {
      this.shown = key
      this.lastRatio = -1
      this.heading.string = `${name ?? `顾客 #${c.id}`} · ${c.late ? '已超时' : '等待中'}`
      this.recipe.string = c.burgerVerdict ? '汉堡已交付' : p.recipe
      const sides = [c.friesDue ? '薯条' : '', c.drinkDue ? '饮料' : ''].filter(Boolean).join(' + ')
      this.cook.string = c.burgerVerdict ? sides ? `还差 ${sides}` : '餐点已送齐' : `${p.cook}${sides ? ` · 另送 ${sides}` : ''}`
      this.banned.string = p.banned || '无忌口'
      this.banned.color = uiColor(p.banned ? UI_THEME.danger : UI_THEME.muted)
    }
    const ratio = Math.max(0, Math.min(1, c.patienceMax > 0 ? c.patienceLeft / c.patienceMax : 0))
    if (ratio === this.lastRatio) return
    this.lastRatio = ratio
    this.bar.clear(); this.bar.fillColor = uiColor(c.late || ratio < .25 ? UI_THEME.danger : UI_THEME.accent)
    this.bar.roundRect(-this.width / 2 + 16, -76, (this.width - 32) * ratio, 4, 2); this.bar.fill()
  }
  destroy(): void { this.node.destroy() }
}
