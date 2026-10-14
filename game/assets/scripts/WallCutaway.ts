import { Color, Material, MeshRenderer, Node } from 'cc'
import { hidesPoint, stepWallOpacity } from '../logic/camera'
import type { Box3 } from '../logic/camera'

const SAMPLE_Y = [0.3, 1.2]
interface Surface {
  renderer: MeshRenderer
  slot: number
  original: Material
  fade: Material
  castShadow: number
  color: Color
  opaque: boolean | null
}
interface Wall {
  node: Node
  box: Box3
  k: number
  surfaces: Surface[]
}

/** Fade the complete wall assembly without changing geometry or collision. */
export class WallCutaway {
  private walls: Wall[] = []

  constructor(roots: Node[]) {
    for (const r of roots) for (const n of r.children) {
      if (!n.activeInHierarchy || !n.name.startsWith('Wall_')) continue
      const p = n.worldPosition, s = n.worldScale
      const hx = Math.abs(s.x) / 2, hy = Math.abs(s.y) / 2, hz = Math.abs(s.z) / 2
      const surfaces: Surface[] = []
      for (const renderer of n.getComponentsInChildren(MeshRenderer)) {
        if (!renderer.enabled) continue
        renderer.sharedMaterials.forEach((original, slot) => {
          if (!original) return
          const fade = new Material()
          fade.copy(renderer.getRenderMaterial(slot) ?? original, { technique: 1 })
          const color = new Color(255, 255, 255, 255)
          const value = fade.getProperty('mainColor')
          if (value instanceof Color) color.set(value)
          if (n.name.startsWith('Wall_Store')) color.set(178, 205, 225, 255)
          fade.setProperty('mainColor', color)
          renderer.setSharedMaterial(fade, slot)
          surfaces.push({ renderer, slot, original, fade, castShadow: renderer.shadowCastingMode, color, opaque: null })
        })
      }
      this.walls.push({ node: n, box: { minX: p.x-hx, minY:p.y-hy, minZ:p.z-hz, maxX:p.x+hx, maxY:p.y+hy, maxZ:p.z+hz }, k:1, surfaces })
    }
  }

  update(x: number, z: number, dt: number): void {
    for (const w of this.walls) {
      const hidden = SAMPLE_Y.some(y => hidesPoint(w.box, x, y, z))
      w.k = stepWallOpacity(w.k, hidden, dt)
      for (const surface of w.surfaces) {
        const { renderer, slot, color } = surface
        const material = renderer.getMaterialInstance(slot)
        if (!material) continue
        const current = material.getProperty('mainColor')
        if (current instanceof Color) color.set(current)
        color.a = Math.round(w.k * 255)
        material.setProperty('mainColor', color)
        if (surface.opaque !== (w.k === 1)) {
          surface.opaque = w.k === 1
          // Opaque walls write depth; fading surfaces keep depth testing and stop casting shadows.
          const states = { depthStencilState: { depthWrite: w.k === 1 }, blendState: { targets: [{ blend: w.k < 1 }] } }
          material.overridePipelineStates(states, 0)
          renderer.shadowCastingMode = w.k === 1 ? surface.castShadow : 0
        }
      }
    }
  }

  destroy(): void {
    for (const w of this.walls) for (const s of w.surfaces) {
      if (s.renderer.isValid) s.renderer.setSharedMaterial(s.original, s.slot)
      s.fade.destroy()
    }
    this.walls.length = 0
  }
}
