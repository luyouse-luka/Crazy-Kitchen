import { Graphics, Label, Node, Sprite, UITransform } from 'cc'
import type { Customer } from '../../logic/customer'
import type { KitchenState } from '../../logic/kitchen'
import { INGREDIENTS } from '../../logic/types'
import { inventoryPresentation, orderPresentation } from './UiModel'
import { buttonFeedback, drawPanel, UI_THEME, uiColor, uiLabel, uiNode, uiSurface } from './UiTheme'
import { drawFoodGlyph } from './FoodGlyphs'
import type { CardLines } from '../cardLines'

export class InventorySkin {
  private background: Graphics
  private rows: { name: Label; count: Label; surface: Graphics; glyph: Graphics; empty: boolean | null }[] = []
  private subtitle: Label
  private footer: Label
  constructor(private panel: Node, slots: readonly Node[], private title: Label) {
    this.background = uiSurface(panel)
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!
      const surface = uiSurface(slot)
      drawPanel(surface, 120, 120, UI_THEME.paper)
      const icon = slot.getChildByName('Icon')
      if (icon) { const sprite = icon.getComponent(Sprite); if (sprite) sprite.enabled = false }
      const glyph = uiNode(slot, 'FoodIllustration', 80, 72).addComponent(Graphics)
      glyph.node.setPosition(0, 18, 0)
      const name = uiLabel(slot, 'IngredientName', 22, 116)
      name.node.setPosition(0, -20, 0)
      const count = slot.getChildByName('Count')?.getComponent(Label) ?? uiLabel(slot, 'Count', 18, 116)
      count.fontSize = 18; count.lineHeight = 22; count.node.setPosition(0, -46, 0)
      count.node.getComponent(UITransform)?.setContentSize(116, 26)
      count.enableOutline = false
      this.rows.push({ name, count, surface, glyph, empty: null })
      buttonFeedback(slot, 120, 120)
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
    this.subtitle.node.setPosition(cx, 146, 0); this.subtitle.string = storeroom ? '点选货箱 → 搬回冰箱 → 点按补货' : kitchen.cfg.singleItem ? '每次取一份 · 拿好即关 · 空手再取' : '点选取一份 · 可同时拿两样食材'
    this.footer.node.setPosition(cx, -178, 0); this.footer.string = '点面板外关闭 · 烹调与顾客等待继续'
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]!, ing = INGREDIENTS[i]
      const p = ing ? inventoryPresentation(ing, kitchen.stock[i]!, kitchen.cfg.fridgeCap ?? Infinity) : null
      row.name.string = p?.name ?? '备用盘子'
      row.count.string = storeroom ? ing ? '整箱补货' : `剩余 ${kitchen.spare}` : p?.count ?? ''
      row.count.color = uiColor(!storeroom && p?.empty ? UI_THEME.danger : UI_THEME.muted)
      const empty = !storeroom && !!p?.empty
      if (row.empty !== empty) {
        row.empty = empty; drawFoodGlyph(row.glyph, ing ?? 'plate', empty)
        drawPanel(row.surface, 120, 120, empty ? UI_THEME.raised : UI_THEME.paper)
      }
    }
  }
  layout(height: number, bottomInset = 0): void {
    this.panel.setPosition(0, -height / 2 + Math.max(220, bottomInset + 220), 0)
  }
}

export class OrderCardView {
  readonly node: Node
  customerId = -1
  private art: Graphics
  private heading: Label
  private recipe: Label
  private cook: Label
  private banned: Label
  private bar: Graphics
  private story: Label
  private initial: Label
  private shown = ''
  private lastRatio = -1
  constructor(parent: Node, readonly width = 280) {
    this.node = uiNode(parent, 'UI_OrderCard', width, 196)
    this.art = this.node.addComponent(Graphics)
    drawPanel(this.art, width, 196)
    this.art.fillColor = uiColor(UI_THEME.accent); this.art.circle(-width / 2 + 30, 71, 17); this.art.fill()
    this.initial = uiLabel(this.node, 'PortraitInitial', 18, 30); this.initial.node.setPosition(-width / 2 + 30, 71, 0); this.initial.color = uiColor(UI_THEME.inkLight)
    this.heading = uiLabel(this.node, 'Customer', 18, width - 76)
    this.heading.node.setPosition(20, 72, 0); this.heading.color = uiColor(UI_THEME.accent)
    this.story = uiLabel(this.node, 'StoryBeat', 18, width - 32, 40)
    this.story.node.setPosition(0, 38, 0); this.story.color = uiColor(UI_THEME.muted)
    this.recipe = uiLabel(this.node, 'Recipe', 22, width - 32, 44)
    this.recipe.node.setPosition(0, -7, 0)
    this.cook = uiLabel(this.node, 'Doneness', 20, width - 32)
    this.cook.node.setPosition(0, -40, 0); this.cook.color = uiColor(UI_THEME.accent)
    this.banned = uiLabel(this.node, 'Banned', 18, width - 32)
    this.banned.node.setPosition(0, -66, 0); this.banned.color = uiColor(UI_THEME.danger)
    this.bar = uiNode(this.node, 'PatienceBar').addComponent(Graphics)
    for (const l of [this.heading, this.recipe, this.cook, this.banned]) l.horizontalAlign = Label.HorizontalAlign.LEFT
    this.node.active = false
    buttonFeedback(this.node, width, 196)
  }
  sync(c: Readonly<Customer> | null, name?: string, lines?: CardLines): void {
    this.node.active = !!c?.active && !!c.ordered
    this.customerId = this.node.active && c ? c.id : -1
    if (!c || !this.node.active) return
    const p = orderPresentation(c.spec)
    const ratio = Math.max(0, Math.min(1, c.patienceMax > 0 ? c.patienceLeft / c.patienceMax : 0))
    const beat = c.late ? 'late' : ratio <= .5 ? 'waiting' : 'arrival'
    const key = `${c.id}|${name}|${lines?.greet}|${lines?.wait_nudge}|${p.recipe}|${p.cook}|${p.banned}|${c.friesDue}|${c.drinkDue}|${!!c.burgerVerdict}|${beat}`
    if (key !== this.shown) {
      this.shown = key
      this.lastRatio = -1
      this.heading.string = `${name ?? `顾客 #${c.id}`} · ${c.late ? '超时' : ratio <= .5 ? '催餐' : '点单'}`
      this.initial.string = (name ?? '客').charAt(0)
      this.story.string = `“${lines ? beat === 'arrival' ? lines.greet : lines.wait_nudge : '老板，今天就拜托了'}”`
      this.recipe.string = c.burgerVerdict ? '汉堡已交付' : p.recipe
      const sides = [c.friesDue ? '薯条' : '', c.drinkDue ? '饮料' : ''].filter(Boolean).join(' + ')
      this.cook.string = c.burgerVerdict ? sides ? `还差 ${sides}` : '餐点已送齐' : `${p.cook}${sides ? ` · 另送 ${sides}` : ''}`
      this.banned.string = p.banned || '无忌口 · 点卡聊聊'
      this.banned.color = uiColor(p.banned ? UI_THEME.danger : UI_THEME.muted)
    }
    const step = Math.round(ratio * 100)
    if (step === this.lastRatio) return
    this.lastRatio = step
    this.bar.clear(); this.bar.fillColor = uiColor(c.late || ratio < .25 ? UI_THEME.danger : UI_THEME.accent)
    this.bar.roundRect(-this.width / 2 + 16, -89, Math.max(2, (this.width - 32) * ratio), 4, 2); this.bar.fill()
  }
  destroy(): void { this.node.destroy() }
}
