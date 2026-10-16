import { Color, Graphics, input, Input, Label, Node, Sprite, Tween, tween, UIOpacity, UITransform, Vec2 } from 'cc'
import type { EventMouse, EventTouch } from 'cc'
import { FEEL } from '../Feel'

export const UI_THEME = {
  surface: '#FFF7E8', raised: '#F1E4CC', accent: '#246253', text: '#352E29', muted: '#756658',
  danger: '#A03F32', dangerSurface: '#F6D7C9', warning: '#8D571C', stroke: '#C5AE89',
  paper: '#FFFDF5', gold: '#D59A3D', inkLight: '#FFF9EC', shadow: '#211E24',
  gap: 12, padding: 20, radius: 16, title: 26, body: 22, small: 18,
} as const
export function uiColor(hex: string, alpha = 255): Color {
  return new Color(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), alpha)
}
export function uiNode(parent: Node, name: string, w = 0, h = 0): Node {
  const n = new Node(name); n.layer = parent.layer; parent.addChild(n)
  n.addComponent(UITransform).setContentSize(w, h)
  return n
}
export function uiLabel(parent: Node, name: string, size: number, w: number, h = size + 6): Label {
  const l = uiNode(parent, name, w, h).addComponent(Label)
  l.fontSize = size; l.lineHeight = size + 5; l.color = uiColor(UI_THEME.text)
  l.overflow = Label.Overflow.SHRINK; l.enableWrapText = true
  return l
}
export function uiSurface(host: Node): Graphics {
  const sprite = host.getComponent(Sprite)
  if (sprite) sprite.enabled = false
  const node = uiNode(host, 'UiSurface')
  node.setSiblingIndex(0)
  return node.addComponent(Graphics)
}
export function drawPanel(g: Graphics, w: number, h: number, fill: string = UI_THEME.surface): void {
  g.clear(); g.fillColor = uiColor(UI_THEME.shadow, 55)
  g.roundRect(-w / 2 + 2, -h / 2 - 7, w, h, UI_THEME.radius); g.fill()
  g.fillColor = uiColor(fill)
  g.roundRect(-w / 2, -h / 2, w, h, UI_THEME.radius); g.fill()
  g.lineWidth = 2; g.strokeColor = uiColor(UI_THEME.stroke)
  g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, UI_THEME.radius); g.stroke()
  g.strokeColor = uiColor(UI_THEME.inkLight, 160); g.lineWidth = 1
  g.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, UI_THEME.radius - 4); g.stroke()
}

export function drawButton(g: Graphics, x: number, y: number, w: number, h: number, on = true): void {
  g.fillColor = uiColor(UI_THEME.shadow, 45); g.roundRect(x - w / 2, y - h / 2 - 3, w, h, 10); g.fill()
  g.fillColor = uiColor(on ? UI_THEME.accent : UI_THEME.raised); g.roundRect(x - w / 2, y - h / 2, w, h, 10); g.fill()
  g.lineWidth = 1; g.strokeColor = uiColor(on ? UI_THEME.inkLight : UI_THEME.stroke, 100)
  g.roundRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 8); g.stroke()
}

export function buttonFeedback(host: Node, w: number, h: number): void {
  const overlay = uiNode(host, 'InteractionGlow', w, h), art = overlay.addComponent(Graphics)
  art.fillColor = uiColor(UI_THEME.gold, 70); art.roundRect(-w / 2, -h / 2, w, h, 10); art.fill()
  const opacity = overlay.addComponent(UIOpacity); opacity.opacity = 0
  const fade = (value: number): void => {
    Tween.stopAllByTarget(opacity); tween(opacity).to(FEEL.pressSec, { opacity: value }).start()
  }
  // Node pointer listeners swallow global input in Cocos; observe input passively instead.
  const point = new Vec2(), transform = host.getComponent(UITransform)!
  let hovered = false, pressed = false, touch: number | null = null
  const inside = (event: EventMouse | EventTouch): boolean => {
    event.getLocation(point)
    return host.activeInHierarchy && transform.hitTest(point)
  }
  const move = (event: EventMouse): void => { const hit = inside(event); if (hit !== hovered) { hovered = hit; fade(hit ? pressed ? 255 : 150 : 0) } }
  const down = (event: EventMouse): void => { pressed = inside(event); if (pressed) fade(255) }
  const up = (event: EventMouse): void => { if (pressed) fade(inside(event) ? 150 : 0); pressed = false }
  const start = (event: EventTouch): void => { if (inside(event)) { touch = event.getID(); fade(255) } }
  const end = (event: EventTouch): void => { if (touch !== null && touch === event.getID()) { touch = null; fade(0) } }
  input.on(Input.EventType.MOUSE_MOVE, move)
  input.on(Input.EventType.MOUSE_DOWN, down)
  input.on(Input.EventType.MOUSE_UP, up)
  input.on(Input.EventType.TOUCH_START, start)
  input.on(Input.EventType.TOUCH_END, end)
  input.on(Input.EventType.TOUCH_CANCEL, end)
  host.once(Node.EventType.NODE_DESTROYED, () => {
    input.off(Input.EventType.MOUSE_MOVE, move)
    input.off(Input.EventType.MOUSE_DOWN, down)
    input.off(Input.EventType.MOUSE_UP, up)
    input.off(Input.EventType.TOUCH_START, start)
    input.off(Input.EventType.TOUCH_END, end)
    input.off(Input.EventType.TOUCH_CANCEL, end)
  })
}
