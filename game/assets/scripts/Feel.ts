import { Camera, Color, game, Label, Node, Tween, tween, UIOpacity, Vec3 } from 'cc'

/**
 * Every timing and amount for interaction feedback lives here; components reference it and never
 * write their own 0.2s. ⏳ All self-chosen, not from any design source — tune on device.
 */
export const FEEL = {
  popSec: 0.18,
  popScale: 1.18,
  pressSec: 0.08,
  pressScale: 0.9,
  panelSec: 0.22,
  floatSec: 0.9,
  floatRise: 70,
  fadeSec: 0.2,
  /** Same hint again within this window is dropped, so holding into a wall does not spam */
  hintRepeatSec: 0.8,
  shakeSec: 0.3,
  /** Camera shake amplitude, metres */
  shakeSmall: 0.06,
  shakeBig: 0.14,
  scrubTickSec: 0.35,
} as const

const ONE = new Vec3(1, 1, 1)

/** Quick grow-and-settle. Restarts cleanly when fired again mid-pop */
export function pop(node: Node, scale: number = FEEL.popScale): void {
  Tween.stopAllByTarget(node)
  node.setScale(ONE)
  tween(node)
    .to(FEEL.popSec / 2, { scale: new Vec3(scale, scale, 1) }, { easing: 'quadOut' })
    .to(FEEL.popSec / 2, { scale: ONE }, { easing: 'quadIn' })
    .start()
}

/** Panel open: scale in from slightly small with a little overshoot */
export function popIn(node: Node): void {
  Tween.stopAllByTarget(node)
  node.setScale(0.85, 0.85, 1)
  tween(node).to(FEEL.panelSec, { scale: ONE }, { easing: 'backOut' }).start()
}

export function pressTo(node: Node, down: boolean): void {
  Tween.stopAllByTarget(node)
  const s = down ? FEEL.pressScale : 1
  tween(node).to(FEEL.pressSec, { scale: new Vec3(s, s, 1) }, { easing: 'quadOut' }).start()
}

interface Floater {
  node: Node
  label: Label
  op: UIOpacity
}

/** Short text that pops up over a spot and drifts away: "+★★★★★", "糊了", hints. Pooled, oldest reused */
export class Floaters {
  private pool: Floater[] = []
  private next = 0
  private world = new Vec3()
  private ui = new Vec3()
  private lastText = ''
  private lastAt = -Infinity

  constructor(private parent: Node, size = 8) {
    for (let i = 0; i < size; i++) {
      const node = new Node(`Float_${i}`)
      node.layer = parent.layer
      parent.addChild(node)
      const label = node.addComponent(Label)
      label.fontSize = 30
      label.lineHeight = 34
      label.enableOutline = true
      label.outlineWidth = 3
      label.outlineColor = Color.BLACK
      const op = node.addComponent(UIOpacity)
      node.active = false
      this.pool.push({ node, label, op })
    }
  }

  /** Over a world point */
  spawn(cam: Camera, x: number, y: number, z: number, text: string, color: Readonly<Color>, size = 30): void {
    this.world.set(x, y, z)
    cam.convertToUINode(this.world, this.parent, this.ui)
    this.spawnAt(this.ui.x, this.ui.y, text, color, size)
  }

  /** At a canvas point */
  spawnAt(x: number, y: number, text: string, color: Readonly<Color>, size = 30): void {
    // Wall clock, not the shift's: that one restarts at 0 every day
    const now = game.totalTime / 1000
    if (text === this.lastText && now - this.lastAt < FEEL.hintRepeatSec) return
    this.lastText = text
    this.lastAt = now
    const f = this.pool[this.next++ % this.pool.length]!
    Tween.stopAllByTarget(f.node)
    Tween.stopAllByTarget(f.op)
    f.label.string = text
    f.label.color = color
    f.label.fontSize = size
    f.label.lineHeight = size + 4
    f.node.setPosition(x, y, 0)
    f.node.setScale(0.6, 0.6, 1)
    f.op.opacity = 255
    f.node.active = true
    f.node.setSiblingIndex(this.parent.children.length - 1)
    tween(f.node)
      .to(FEEL.popSec, { scale: ONE }, { easing: 'backOut' })
      .by(FEEL.floatSec, { position: new Vec3(0, FEEL.floatRise, 0) }, { easing: 'quadOut' })
      .call(() => (f.node.active = false))
      .start()
    tween(f.op).delay(FEEL.popSec + FEEL.floatSec / 2).to(FEEL.floatSec / 2, { opacity: 0 }).start()
  }
}
