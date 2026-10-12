import { describe, expect, it } from 'vitest'
// @ts-expect-error Node builtin: this repository does not install @types/node.
import { readFileSync } from 'node:fs'

const file = 'game/assets/art/kitchen/fireExtinguisher.glb'

describe('灭火器模型交付规格', () => {
  it('是独立、无外部依赖的 GLB 2.0，符合尺寸与移动端面数预算', () => {
    const bytes: Uint8Array = readFileSync(file)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    expect(view.getUint32(0, true)).toBe(0x46546c67)
    expect(view.getUint32(4, true)).toBe(2)
    expect(view.getUint32(8, true)).toBe(bytes.length)
    expect(view.getUint32(16, true)).toBe(0x4e4f534a)
    const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))))
    expect(gltf.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true)
    expect(gltf.images ?? []).toHaveLength(0)
    expect(gltf.skins ?? []).toHaveLength(0)
    expect(bytes.length).toBeLessThan(100_000)

    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    let triangles = 0
    for (const mesh of gltf.meshes) for (const p of mesh.primitives) {
      const a = gltf.accessors[p.attributes.POSITION]
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis]!, a.min[axis])
        max[axis] = Math.max(max[axis]!, a.max[axis])
      }
      triangles += gltf.accessors[p.indices].count / 3
    }
    // Exported vertices are baked in metres, Y up, with the bottle base at zero.
    expect(min[1]).toBeCloseTo(0, 3)
    expect(max[1]).toBeGreaterThan(0.65)
    expect(max[1]).toBeLessThan(0.85)
    expect(max[0]! - min[0]!).toBeLessThan(0.6)
    expect(max[2]! - min[2]!).toBeLessThan(0.5)
    expect(triangles).toBeGreaterThan(100)
    expect(triangles).toBeLessThan(1500)
    expect(gltf.materials.some((m: { name: string }) => m.name === 'BottleRed')).toBe(true)
    expect(gltf.materials.some((m: { name: string }) => m.name === 'HoseBlack')).toBe(true)
  })
})
