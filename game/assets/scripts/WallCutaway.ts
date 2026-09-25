import { Node } from 'cc'
import { hidesPoint } from '../logic/camera'
import type { Box3 } from '../logic/camera'

/** Share of a wall's height left standing while cut away. ⏳ self-chosen */
const LOW = 0.12
/** Full height ↔ stub in 1/SPEED seconds */
const SPEED = 6
/** Chef sample heights: feet and chest, so a waist-high wall still counts */
const SAMPLE_Y = [0.3, 1.2]

interface Wall {
  node: Node
  /** Full-height box, read once: the lowered wall must not stop hiding and pop back up */
  box: Box3
  sy: number
  baseY: number
  k: number
}

/**
 * Walls between the chef and the camera drop to a stub and rise again once clear.
 * Lowered rather than faded: fading needs a transparent pass per wall material and sorts badly.
 * Assumes the scene's wall convention — a centred 1m cube scaled to size under an unscaled parent.
 */
export class WallCutaway {
  private walls: Wall[] = []

  constructor(roots: Node[]) {
    for (const r of roots) {
      for (const n of r.children) {
        if (!n.name.startsWith('Wall_')) continue
        const p = n.worldPosition
        const s = n.worldScale
        const hx = Math.abs(s.x) / 2
        const hy = Math.abs(s.y) / 2
        const hz = Math.abs(s.z) / 2
        this.walls.push({
          node: n,
          box: { minX: p.x - hx, minY: p.y - hy, minZ: p.z - hz, maxX: p.x + hx, maxY: p.y + hy, maxZ: p.z + hz },
          sy: n.scale.y,
          baseY: n.position.y - n.scale.y / 2,
          k: 1,
        })
      }
    }
  }

  update(x: number, z: number, dt: number): void {
    for (const w of this.walls) {
      const hidden = SAMPLE_Y.some((y) => hidesPoint(w.box, x, y, z))
      const target = hidden ? LOW : 1
      if (w.k === target) continue
      const step = dt * SPEED
      w.k = w.k < target ? Math.min(target, w.k + step) : Math.max(target, w.k - step)
      const sy = w.sy * w.k
      const s = w.node.scale
      const p = w.node.position
      w.node.setScale(s.x, sy, s.z)
      w.node.setPosition(p.x, w.baseY + sy / 2, p.z)
    }
  }
}
