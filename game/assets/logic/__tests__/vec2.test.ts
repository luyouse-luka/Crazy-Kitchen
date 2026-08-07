import { describe, it, expect } from 'vitest'
import { dist, dist2, set, copy, add, scale, lenSq, normalize, rotateY } from '../vec2'
import type { Vec2 } from '../vec2'

const v = (x: number, z: number): Vec2 => ({ x, z })

describe('dist2', () => {
  it('返回平方距离，不开方', () => {
    expect(dist2(v(0, 0), v(3, 4))).toBe(25)
  })

  it('同一点距离为 0', () => {
    expect(dist2(v(2, -7), v(2, -7))).toBe(0)
  })
})

describe('dist', () => {
  it('返回欧氏距离', () => {
    expect(dist(v(0, 0), v(3, 4))).toBe(5)
  })
})

describe('set', () => {
  it('写入目标对象并返回它（零分配）', () => {
    const out = v(0, 0)
    const ret = set(out, 5, -2)
    expect(out).toEqual({ x: 5, z: -2 })
    expect(ret).toBe(out)
  })
})

describe('copy', () => {
  it('把源的分量写进目标，不共享引用', () => {
    const out = v(0, 0)
    const src = v(1, 2)
    copy(out, src)
    src.x = 99
    expect(out).toEqual({ x: 1, z: 2 })
  })
})

describe('add', () => {
  it('分量相加写进 out', () => {
    const out = v(0, 0)
    add(out, v(1, 2), v(10, 20))
    expect(out).toEqual({ x: 11, z: 22 })
  })

  it('out 可以就是其中一个输入（原地累加）', () => {
    const a = v(1, 2)
    add(a, a, v(10, 20))
    expect(a).toEqual({ x: 11, z: 22 })
  })
})

describe('scale', () => {
  it('按标量缩放写进 out', () => {
    const out = v(0, 0)
    scale(out, v(3, -4), 2)
    expect(out).toEqual({ x: 6, z: -8 })
  })
})

describe('lenSq', () => {
  it('返回长度平方', () => {
    expect(lenSq(v(3, 4))).toBe(25)
  })
})

describe('normalize', () => {
  it('长度归一', () => {
    const out = v(0, 0)
    normalize(out, v(0, 5))
    expect(out.x).toBeCloseTo(0)
    expect(out.z).toBeCloseTo(1)
  })

  it('零向量归一化后仍是零向量，不产生 NaN', () => {
    // 摇杆回中时每帧都会走到这里，NaN 会直接把角色坐标污染成 NaN 再也回不来
    const out = v(9, 9)
    normalize(out, v(0, 0))
    expect(out).toEqual({ x: 0, z: 0 })
  })
})

describe('rotateY', () => {
  // 斜 45° 固定相机的头号手感坑（ROADMAP §M2）：
  // 摇杆输入必须先按相机 yaw 旋转再喂给移动，否则玩家往上推、角色斜着走。
  it('旋转 90° 把 +z 转到 +x', () => {
    const out = v(0, 0)
    rotateY(out, v(0, 1), Math.PI / 2)
    expect(out.x).toBeCloseTo(1)
    expect(out.z).toBeCloseTo(0)
  })

  it('旋转 0 弧度是恒等变换', () => {
    const out = v(0, 0)
    rotateY(out, v(3, -4), 0)
    expect(out.x).toBeCloseTo(3)
    expect(out.z).toBeCloseTo(-4)
  })

  it('相机 yaw 45° 下，摇杆正上方 = 世界斜 45°', () => {
    const out = v(0, 0)
    rotateY(out, v(0, 1), Math.PI / 4)
    expect(out.x).toBeCloseTo(Math.SQRT1_2)
    expect(out.z).toBeCloseTo(Math.SQRT1_2)
  })

  it('out 可以就是输入本身（原地旋转，不会用到写坏的中间值）', () => {
    const a = v(1, 0)
    rotateY(a, a, Math.PI / 2)
    expect(a.x).toBeCloseTo(0)
    expect(a.z).toBeCloseTo(-1)
  })
})
