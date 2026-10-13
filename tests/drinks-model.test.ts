import { describe, expect, it } from 'vitest'
// @ts-expect-error Node builtin: this repository does not install @types/node.
import { readFileSync } from 'node:fs'

describe('饮料机模型交付规格', () => {
  it('GLB 无外部依赖，底面归零，外形位于现有工位占地内', () => {
    const bytes: Uint8Array = readFileSync('game/assets/art/kitchen/drinksMachine.glb')
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
    expect(min[1]).toBeCloseTo(0, 3)
    expect(max[1]).toBeCloseTo(1.1, 3)
    expect(max[0]! - min[0]!).toBeLessThanOrEqual(0.8)
    expect(max[2]! - min[2]!).toBeLessThanOrEqual(0.6)
    expect(triangles).toBeGreaterThan(100)
    expect(triangles).toBeLessThan(1500)
    expect(gltf.materials.length).toBeLessThanOrEqual(5)
    expect(gltf.materials.some((m: { name: string }) => m.name === 'MachineBlue')).toBe(true)
  })
})
