import { Node, Tween, tween, Vec3 } from 'cc'
import { FEEL } from './Feel'

/** The imported door nodes already pivot at the right hinge; never move the station proxy. */
export class FridgeDoor {
  private readonly doors: { node: Node; closed: Vec3 }[] = []
  private readonly pose = { open: 0 }

  constructor(root: Node, private readonly contents?: Node) {
    const visit = (node: Node): void => {
      if (/^fridge_A_door_(bottom|top)$/.test(node.name)) this.doors.push({ node, closed: node.eulerAngles.clone() })
      for (const child of node.children) visit(child)
    }
    visit(root)
  }

  setOpen(open: boolean): void {
    Tween.stopAllByTarget(this.pose)
    tween(this.pose).to(open ? FEEL.fridgeOpenSec : FEEL.fridgeCloseSec, { open: open ? 1 : 0 }, {
      easing: open ? 'cubicOut' : 'quadInOut', onUpdate: () => this.apply(),
    }).start()
  }

  pulse(slam = false): void {
    Tween.stopAllByTarget(this.pose)
    tween(this.pose)
      .to(FEEL.fridgeOpenSec, { open: slam ? 0.65 : 1 }, { easing: 'cubicOut', onUpdate: () => this.apply() })
      .delay(slam ? 0 : FEEL.fridgeStockHoldSec)
      .to(slam ? FEEL.fridgeSlamSec : FEEL.fridgeCloseSec, { open: 0 }, { easing: 'quadIn', onUpdate: () => this.apply() })
      .start()
  }

  reset(): void {
    Tween.stopAllByTarget(this.pose)
    this.pose.open = 0
    this.apply()
  }

  destroy(): void { this.reset() }

  private apply(): void {
    if (this.contents?.isValid) this.contents.active = this.pose.open > 0.015
    for (const { node, closed } of this.doors) if (node.isValid) {
      node.setRotationFromEuler(closed.x, closed.y + FEEL.fridgeAngle * this.pose.open, closed.z)
    }
  }
}
