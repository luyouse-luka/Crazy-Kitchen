import { Color, Graphics, Label, Node, Sprite, UITransform } from 'cc'

export const UI_THEME = {
  surface: '#152E35', raised: '#25464D', accent: '#A8E4CB', text: '#FFFFFF', muted: '#C4D5D7',
  danger: '#FFB4A9', dangerSurface: '#6D2C30', warning: '#FFE3A0', stroke: '#68898E',
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
  g.clear(); g.fillColor = uiColor(fill, 246)
  g.roundRect(-w / 2, -h / 2, w, h, UI_THEME.radius); g.fill()
  g.lineWidth = 2; g.strokeColor = uiColor(UI_THEME.stroke)
  g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, UI_THEME.radius); g.stroke()
}
