import { Graphics, Label, Node, Sprite, SpriteFrame } from 'cc'
import { pop, pressTo } from './Feel'
import { actionPresentation, GESTURE_LABEL, groundPresentation } from './ui/UiModel'
import type { ActionPresentation } from './ui/UiModel'
import { UI_THEME, uiColor, uiLabel, uiNode, uiSurface } from './ui/UiTheme'
import { drawControlGlyph, drawGestureGlyph } from './ui/ControlGlyphs'

const KNOB_TRAVEL = 54

export class Controls {
  private knob: Node
  private actionText: Label
  private targetText: Label
  private gestureText: Label
  private actionArt: Graphics
  private actionShown = ''
  private legacyShown = '\u0000'
  private pressed = false
  private hands: Sprite[] = []
  private emptyHands: Label[] = []
  private handShown: (SpriteFrame | null)[] = [null, null]
  private discardTarget: Label
  private discardRing: Graphics
  private discardProgress = -1
  private discardTitle: Label
  private discardMethod: Label
  private actionGlyph!: Graphics
  private methodGlyph!: Graphics
  private auxGlyph!: Graphics
  private auxHoldGlyph!: Graphics
  private looseMode: boolean | null = null
  private secondaryGlyph!: Graphics
  private secondaryHoldGlyph!: Graphics

  constructor(joystick: Node, private actionNode: Node, discard: Node) {
    const stick = uiSurface(joystick)
    stick.fillColor = uiColor(UI_THEME.surface, 185); stick.circle(0, 0, 90); stick.fill()
    stick.lineWidth = 3; stick.strokeColor = uiColor(UI_THEME.accent, 180); stick.circle(0, 0, 88); stick.stroke()
    this.knob = uiNode(joystick, 'Knob')
    const knob = this.knob.addComponent(Graphics)
    knob.fillColor = uiColor(UI_THEME.accent, 240); knob.circle(0, 0, 36); knob.fill()
    const movement = uiLabel(joystick, 'MovementMethod', 18, 180)
    movement.node.setPosition(0, -116, 0); movement.string = '拖动移动'

    this.actionArt = uiSurface(actionNode)
    this.targetText = uiLabel(actionNode, 'ActionTarget', 18, 112)
    this.targetText.node.setPosition(0, 58, 0); this.targetText.color = uiColor(UI_THEME.muted)
    for (const x of [-49]) {
      const hand = uiNode(actionNode, 'Hand', 40, 40); hand.setPosition(x, -47, 0)
      const bg = hand.addComponent(Graphics)
      bg.fillColor = uiColor(UI_THEME.raised); bg.circle(0, 0, 20); bg.fill()
      const empty = uiLabel(hand, 'EmptyHand', 14, 36); empty.string = ''; this.emptyHands.push(empty)
      const sp = uiNode(hand, 'Icon', 32, 32).addComponent(Sprite)
      sp.sizeMode = Sprite.SizeMode.CUSTOM; sp.node.active = false; hand.active = false; this.hands.push(sp)
    }
    this.actionText = uiLabel(actionNode, 'ActionVerb', 24, 146, 32)
    this.actionText.node.setPosition(0, -14, 0)
    this.gestureText = uiLabel(actionNode, 'ActionMethod', 18, 128)
    this.gestureText.node.setPosition(0, -48, 0)
    for (const label of [this.targetText, this.actionText, this.gestureText]) label.node.active = false
    this.actionGlyph = uiNode(actionNode, 'ContextIcon').addComponent(Graphics)
    this.methodGlyph = uiNode(actionNode, 'GestureIcon').addComponent(Graphics)
    this.methodGlyph.node.setPosition(0, -52, 0)
    this.secondaryGlyph = uiNode(actionNode, 'SecondaryIcon').addComponent(Graphics)
    this.secondaryGlyph.node.setPosition(44, -42, 0); this.secondaryGlyph.node.setScale(.32, .32, 1)
    this.secondaryHoldGlyph = uiNode(actionNode, 'SecondaryHoldIcon').addComponent(Graphics)
    this.secondaryHoldGlyph.node.setPosition(57, -25, 0); this.secondaryHoldGlyph.node.setScale(.5, .5, 1)
    drawGestureGlyph(this.secondaryHoldGlyph, 'hold')
    this.setContext(actionPresentation(''))

    const d = uiSurface(discard)
    d.fillColor = uiColor(UI_THEME.dangerSurface, 246); d.circle(0, 0, 58); d.fill()
    d.lineWidth = 2; d.strokeColor = uiColor(UI_THEME.danger); d.circle(0, 0, 56); d.stroke()
    this.discardTitle = uiLabel(discard, 'DiscardVerb', 26, 96); this.discardTitle.string = '丢弃'; this.discardTitle.node.setPosition(0, 16, 0)
    this.discardMethod = uiLabel(discard, 'DiscardMethod', 16, 108); this.discardMethod.string = '按住'; this.discardMethod.node.setPosition(0, -14, 0)
    this.discardTarget = uiLabel(discard, 'DiscardTarget', 14, 90)
    this.discardTarget.string = '手中物品'; this.discardTarget.node.setPosition(0, -37, 0)
    this.discardRing = uiNode(discard, 'DiscardProgress').addComponent(Graphics)
    for (const label of [this.discardTitle, this.discardMethod, this.discardTarget]) label.node.active = false
    this.auxGlyph = uiNode(discard, 'AuxiliaryIcon').addComponent(Graphics)
    this.auxGlyph.node.setScale(.85, .85, 1)
    this.auxHoldGlyph = uiNode(discard, 'AuxiliaryHoldIcon').addComponent(Graphics)
    this.auxHoldGlyph.node.setPosition(33, -32, 0); this.auxHoldGlyph.node.setScale(.35, .35, 1)
    this.setLooseMode(false)
  }
  syncStick(dirX: number, dirY: number, magnitude: number): void {
    this.knob.setPosition(dirX * magnitude * KNOB_TRAVEL, dirY * magnitude * KNOB_TRAVEL, 0)
  }
  setAction(text: string): void {
    if (text === this.legacyShown) return
    this.legacyShown = text; this.setContext(actionPresentation(text))
  }
  setContext(context: ActionPresentation): void {
    const key = `${context.target}|${context.verb}|${context.gesture}|${context.enabled}|${context.icon}|${context.secondaryIcon}`
    if (key === this.actionShown) return
    this.actionShown = key
    drawControlGlyph(this.actionGlyph, context.icon ?? 'pick', context.enabled)
    drawGestureGlyph(this.methodGlyph, context.gesture)
    this.secondaryGlyph.node.active = !!context.secondaryIcon; this.secondaryHoldGlyph.node.active = !!context.secondaryIcon
    if (context.secondaryIcon) drawControlGlyph(this.secondaryGlyph, context.secondaryIcon)
    this.targetText.string = context.target; this.actionText.string = context.verb
    this.gestureText.string = GESTURE_LABEL[context.gesture]
    this.gestureText.color = uiColor(context.enabled ? UI_THEME.accent : UI_THEME.muted)
    const g = this.actionArt
    g.clear(); g.fillColor = uiColor(context.enabled ? UI_THEME.surface : UI_THEME.raised, 242)
    g.circle(0, 0, 78); g.fill(); g.lineWidth = 3
    g.strokeColor = uiColor(context.enabled ? UI_THEME.accent : UI_THEME.stroke)
    g.circle(0, 0, 76); g.stroke()
  }
  setDiscardTarget(text: string): void { if (this.discardTarget.string !== text) this.discardTarget.string = text }
  setGroundContext(name: string, occupied: boolean): void {
    this.setContext(groundPresentation(name, occupied))
    this.gestureText.string = occupied ? '长按可清理' : '点拾 · 长按清理'
  }
  setLooseMode(enabled: boolean): void {
    if (this.looseMode !== enabled) {
      this.looseMode = enabled
      drawControlGlyph(this.auxGlyph, enabled ? 'place' : 'trash')
      drawControlGlyph(this.auxHoldGlyph, enabled ? 'throw' : 'trash')
    }
    const title = enabled ? '放下' : '丢弃', method = enabled ? '点放 · 长按扔' : '按住'
    if (this.discardTitle.string !== title) this.discardTitle.string = title
    if (this.discardMethod.string !== method) this.discardMethod.string = method
  }
  setDiscardProgress(progress: number): void {
    progress = Math.max(0, Math.min(1, progress))
    if (progress === this.discardProgress) return
    this.discardProgress = progress
    const g = this.discardRing; g.clear()
    if (!(progress > 0)) return
    g.lineWidth = 5; g.strokeColor = uiColor(UI_THEME.danger)
    g.arc(0, 0, 54, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * Math.min(1, progress), false); g.stroke()
  }
  setHands(left: SpriteFrame | null, right: SpriteFrame | null): void {
    const want = [left, right]
    for (let i = 0; i < this.hands.length; i++) {
      if (want[i] === this.handShown[i]) continue
      this.handShown[i] = want[i]!
      const sp = this.hands[i]!
      sp.node.parent!.active = want[i] !== null
      sp.spriteFrame = want[i]!; sp.node.active = want[i] !== null; this.emptyHands[i]!.node.active = want[i] === null
      if (want[i]) pop(sp.node)
    }
  }
  setPressed(down: boolean): void {
    if (down === this.pressed) return
    this.pressed = down; pressTo(this.actionNode, down)
  }
}
