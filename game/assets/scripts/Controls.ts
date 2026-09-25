import { Color, Graphics, Label, Node, Sprite, UITransform } from 'cc'
import { pop, pressTo } from './Feel'

const STICK_R = 90
const KNOB_R = 36
const KNOB_TRAVEL = 54
const ACTION_R = 78
const DISCARD_R = 58

function art(host: Node): Graphics {
  // A node can hold one renderer, and the host already has its placeholder Sprite
  host.getComponent(Sprite)!.enabled = false
  const n = new Node('Art')
  n.layer = host.layer
  host.addChild(n)
  n.addComponent(UITransform)
  return n.addComponent(Graphics)
}

function label(host: Node, size: number, y = 0): Label {
  const n = new Node('Glyph')
  n.layer = host.layer
  host.addChild(n)
  n.setPosition(0, y, 0)
  const l = n.addComponent(Label)
  l.fontSize = size
  l.lineHeight = size + 4
  l.enableOutline = true
  l.outlineWidth = 2
  l.outlineColor = new Color(0, 0, 0, 160)
  return l
}

/** Draws the on-screen controls over the scene's placeholder nodes; layout stays with the scene's Widgets */
export class Controls {
  private knob: Node
  private actionNode: Node
  private actionText: Label
  private actionShown = '\u0000'
  private pressed = false

  constructor(joystick: Node, action: Node, discard: Node) {
    const g = art(joystick)
    g.fillColor = new Color(0, 0, 0, 80)
    g.circle(0, 0, STICK_R)
    g.fill()
    g.lineWidth = 4
    g.strokeColor = new Color(255, 255, 255, 120)
    g.circle(0, 0, STICK_R - 2)
    g.stroke()
    this.knob = new Node('Knob')
    this.knob.layer = joystick.layer
    joystick.addChild(this.knob)
    this.knob.addComponent(UITransform)
    const k = this.knob.addComponent(Graphics)
    k.fillColor = new Color(255, 255, 255, 210)
    k.circle(0, 0, KNOB_R)
    k.fill()

    const a = art(action)
    a.fillColor = new Color(255, 255, 255, 60)
    a.circle(0, 0, ACTION_R)
    a.fill()
    a.lineWidth = 5
    a.strokeColor = new Color(255, 255, 255, 170)
    a.circle(0, 0, ACTION_R - 3)
    a.stroke()
    this.actionNode = action
    this.actionText = label(action, 34)

    const d = art(discard)
    d.fillColor = new Color(200, 60, 50, 220)
    d.circle(0, 0, DISCARD_R)
    d.fill()
    label(discard, 40, 8).string = '🗑'
    label(discard, 18, -30).string = '长按丢弃'
  }

  /** Stick direction is screen space, y up; magnitude 0–1 */
  syncStick(dirX: number, dirY: number, magnitude: number): void {
    this.knob.setPosition(dirX * magnitude * KNOB_TRAVEL, dirY * magnitude * KNOB_TRAVEL, 0)
  }

  /** What the action key would do right now; empty = nothing in reach */
  setAction(text: string): void {
    if (text === this.actionShown) return
    this.actionShown = text
    this.actionText.string = text || '·'
    if (text) pop(this.actionText.node)
  }

  setPressed(down: boolean): void {
    if (down === this.pressed) return
    this.pressed = down
    pressTo(this.actionNode, down)
  }
}
