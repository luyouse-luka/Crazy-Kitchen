import { describe, expect, it } from 'vitest'
// @ts-expect-error Node builtin: the repository does not install @types/node.
import { readFileSync } from 'node:fs'

describe('汉堡配料模型交付规格', () => {
  it.each(['onion', 'pickle', 'bacon'])('%s 无外部依赖，底面归零，符合配料尺寸和预算', name => {
    const bytes: Uint8Array = readFileSync(`game/assets/art/food/${name}.glb`)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    expect(view.getUint32(0, true)).toBe(0x46546c67)
    expect(view.getUint32(4, true)).toBe(2)
    expect(view.getUint32(8, true)).toBe(bytes.length)
    expect(view.getUint32(16, true)).toBe(0x4e4f534a)
    const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))))
    expect(gltf.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true)
    expect(gltf.images ?? []).toHaveLength(0)
    expect(gltf.skins ?? []).toHaveLength(0)
    expect(gltf.animations ?? []).toHaveLength(0)
    expect(bytes.length).toBeLessThan(60_000)
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
    expect(min[1]).toBeCloseTo(0, 4)
    expect(max[1]).toBeGreaterThan(0.005)
    expect(max[1]).toBeLessThan(0.035)
    for (const axis of [0, 2]) {
      expect(max[axis]! - min[axis]!).toBeGreaterThan(0.2)
      expect(max[axis]! - min[axis]!).toBeLessThan(0.34)
      expect((max[axis]! + min[axis]!) / 2).toBeCloseTo(0, 2)
    }
    expect(triangles).toBeGreaterThan(20)
    expect(triangles).toBeLessThan(1500)
    expect(gltf.materials.length).toBeLessThanOrEqual(4)
  })
})
