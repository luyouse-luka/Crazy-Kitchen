import { Graphics, Label, Node, UITransform } from 'cc'
import { uiRectToCaptureZone } from '../../logic/input'
import type { CaptureZone } from '../../logic/input'
import { FirstOrderGuide } from './FirstOrderGuide'
import type { GuideFrame, GuideStore } from './FirstOrderGuide'
import { GESTURE_LABEL, guideLayout, STATION_NAME } from './UiModel'
import type { UiInsets, UiRect } from './UiModel'
import { drawPanel, UI_THEME, uiColor, uiLabel, uiNode } from './UiTheme'

export class FirstOrderUi {
  readonly guide: FirstOrderGuide
  readonly node: Node
  zoneRevision = 0
  private zoneKey = ''
  private background: Graphics
  private progress: Label
  private title: Label
  private detail: Label
  private skipArt: Graphics
  private skipLabel: Label
  private compact = false
  private visible = false
  private card: UiRect = { x: 0, y: 0, w: 0, h: 0 }
  private skip: UiRect = { x: 0, y: 0, w: 0, h: 0 }
  private lastKey = ''
  private hint: ReturnType<FirstOrderGuide['observe']> | null = null
  private marker: Node
  private markerText: Label
  private nearTarget = false

  get currentHint() { return this.hint }

  constructor(parent: Node, store?: GuideStore) {
    this.guide = new FirstOrderGuide(store)
    this.node = uiNode(parent, 'UI_FirstOrderGuide')
    this.background = this.node.addComponent(Graphics)
    this.progress = uiLabel(this.node, 'Step', 18, 400)
    this.progress.color = uiColor(UI_THEME.accent)
    this.title = uiLabel(this.node, 'NextAction', 26, 400, 36)
    this.detail = uiLabel(this.node, 'Instructions', 22, 400, 60)
    for (const l of [this.progress, this.title, this.detail]) l.horizontalAlign = Label.HorizontalAlign.LEFT
    const skip = uiNode(this.node, 'SkipButton', 100, 88)
    this.skipArt = skip.addComponent(Graphics)
    this.skipLabel = uiLabel(skip, 'Label', 22, 96, 64)
    this.marker = uiNode(parent, 'UI_GuideTarget', 160, 40)
    const markerArt = this.marker.addComponent(Graphics)
    drawPanel(markerArt, 160, 40)
    markerArt.fillColor = uiColor(UI_THEME.accent)
    markerArt.moveTo(-7, -20); markerArt.lineTo(0, -28); markerArt.lineTo(7, -20); markerArt.close(); markerArt.fill()
    this.markerText = uiLabel(this.marker, 'TargetName', 20, 150)
    this.markerText.color = uiColor(UI_THEME.accent)
    this.marker.active = false
    this.node.active = false
  }
  sync(frame: GuideFrame): void {
    this.hint = this.guide.observe(frame)
    this.nearTarget = frame.near === this.hint.target
  }
  layout(width: number, height: number, modal: boolean, safe?: UiInsets, obstacles?: readonly UiRect[]): void {
    const layout = guideLayout(width, height, safe, obstacles)
    const full = this.guide.status === 'active' && !layout.collapsed
    const card = full ? layout.card : { x: layout.card.x + (layout.card.w - 160) / 2, y: layout.card.y, w: 160, h: 88 }
    this.visible = !modal && !layout.hidden
    this.compact = !full; this.card = card; this.skip = layout.skip
    const zoneKey = `${this.visible}|${full}|${card.x},${card.y},${card.w},${card.h}`
    if (zoneKey !== this.zoneKey) { this.zoneKey = zoneKey; this.zoneRevision++ }
    this.node.active = this.visible
    this.marker.active = this.visible && this.guide.status === 'active' && this.hint?.control !== 'discard'
    if (!this.visible) return
    const hint = this.hint
    const key = `${card.x},${card.y},${card.w},${card.h}|${full}|${this.guide.status}|${hint?.title}|${hint?.detail}`
    if (key === this.lastKey) return
    this.lastKey = key
    this.node.setPosition(card.x + card.w / 2, card.y + card.h / 2, 0)
    this.node.getComponent(UITransform)!.setContentSize(card.w, card.h)
    drawPanel(this.background, card.w, card.h)
    this.progress.node.active = full; this.detail.node.active = full; this.skipArt.node.active = full
    this.title.horizontalAlign = full ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER
    this.title.node.getComponent(UITransform)!.setContentSize(full ? card.w - 152 : 146, full ? 36 : 76)
    this.title.fontSize = full ? 26 : 22
    this.title.node.setPosition(full ? -66 : 0, full ? 12 : 0, 0)
    this.title.string = full ? hint?.title ?? '' : this.guide.status === 'active' ? `${hint?.title}\n点按跳过` : '操作指南\n点按重新查看'
    if (!full || !hint) return
    const textW = card.w - 152
    for (const l of [this.progress, this.detail]) l.node.getComponent(UITransform)!.width = textW
    this.progress.node.setPosition(-66, 50, 0)
    this.progress.string = `首次制作 ${hint.index}/6 · ${hint.control === 'discard' ? '丢弃键' : STATION_NAME[hint.target]} · ${GESTURE_LABEL[hint.gesture]}`
    this.detail.node.setPosition(-66, -34, 0); this.detail.string = hint.detail
    const skip = this.skipArt.node
    skip.setPosition(layout.skip.x + layout.skip.w / 2 - (card.x + card.w / 2), 0, 0)
    drawPanel(this.skipArt, 100, 88, UI_THEME.raised); this.skipLabel.string = '跳过'
  }
  captureZones(screenW: number, screenH: number, designH: number): CaptureZone[] {
    if (!this.visible) return []
    const zone = (id: string, r: UiRect) => uiRectToCaptureZone(id, r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, screenW, screenH, designH)
    return this.compact ? [zone('guide-help', this.card)] : [zone('guide-skip', this.skip), zone('guide-body', this.card)]
  }
  tapped(id: string): boolean {
    if (!this.visible || !id.startsWith('guide-')) return false
    if (id === 'guide-skip' || (id === 'guide-help' && this.guide.status === 'active')) this.guide.skip()
    else if (id === 'guide-help') this.guide.replay()
    this.lastKey = ''
    return true
  }
  pointAt(x: number, y: number, width: number, height: number): void {
    if (!this.hint) return
    const outside = Math.abs(x) > width / 2 - 90 || Math.abs(y) > height / 2 - 70
    this.marker.setPosition(Math.max(-width / 2 + 90, Math.min(width / 2 - 90, x)), Math.max(-height / 2 + 70, Math.min(height / 2 - 70, y + 40)), 0)
    this.markerText.string = `${STATION_NAME[this.hint.target]} · ${outside ? '屏幕外' : this.nearTarget ? GESTURE_LABEL[this.hint.gesture] : '走近'}`
  }
  destroy(): void { this.node.destroy(); this.marker.destroy() }
}
