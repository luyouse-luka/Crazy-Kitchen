import { describe, it, expect } from 'vitest'
import { createRng, reseed, nextFloat, nextInt, nextRange, pick, chance } from '../rng'

describe('createRng / reseed', () => {
  it('同一 seed 给出同一序列 —— 参数扫描的两次跑必须可比', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    const seqA = Array.from({ length: 20 }, () => nextFloat(a))
    const seqB = Array.from({ length: 20 }, () => nextFloat(b))
    expect(seqA).toEqual(seqB)
  })

  it('不同 seed 给出不同序列', () => {
    const a = createRng(1)
    const b = createRng(2)
    const seqA = Array.from({ length: 20 }, () => nextFloat(a))
    const seqB = Array.from({ length: 20 }, () => nextFloat(b))
    expect(seqA).not.toEqual(seqB)
  })

  it('reseed 把已经用过的发生器拨回起点，不需要新建对象', () => {
    const r = createRng(777)
    const first = [nextFloat(r), nextFloat(r), nextFloat(r)]
    reseed(r, 777)
    expect([nextFloat(r), nextFloat(r), nextFloat(r)]).toEqual(first)
  })

  it('seed 0 也能正常出数，不会退化成常数列', () => {
    const r = createRng(0)
    const seq = Array.from({ length: 10 }, () => nextFloat(r))
    expect(new Set(seq).size).toBeGreaterThan(1)
  })
})

describe('nextFloat', () => {
  it('落在 [0, 1)', () => {
    const r = createRng(42)
    for (let i = 0; i < 2000; i++) {
      const x = nextFloat(r)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('大致均匀 —— 四等分桶的偏差在 10% 以内', () => {
    // 不是要证明它是好 PRNG，是要挡住「实现写错导致全落在某一段」这类事故
    const r = createRng(2026)
    const buckets = [0, 0, 0, 0]
    const n = 40000
    for (let i = 0; i < n; i++) buckets[Math.floor(nextFloat(r) * 4)]!++
    for (const b of buckets) expect(Math.abs(b - n / 4) / (n / 4)).toBeLessThan(0.1)
  })
})

describe('nextInt', () => {
  it('落在 [0, max)', () => {
    const r = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const x = nextInt(r, 5)
      expect(Number.isInteger(x)).toBe(true)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(5)
    }
  })

  it('max 为 1 时恒为 0', () => {
    const r = createRng(7)
    for (let i = 0; i < 20; i++) expect(nextInt(r, 1)).toBe(0)
  })
})

describe('nextRange', () => {
  it('落在 [lo, hi)', () => {
    const r = createRng(99)
    for (let i = 0; i < 1000; i++) {
      const x = nextRange(r, 30, 70)
      expect(x).toBeGreaterThanOrEqual(30)
      expect(x).toBeLessThan(70)
    }
  })

  it('lo === hi 时恒为 lo —— 扫参数时经常把某一维锁死', () => {
    const r = createRng(99)
    for (let i = 0; i < 20; i++) expect(nextRange(r, 45, 45)).toBe(45)
  })
})

describe('pick', () => {
  it('总是返回数组里的元素', () => {
    const r = createRng(5)
    const arr = ['a', 'b', 'c'] as const
    for (let i = 0; i < 200; i++) expect(arr).toContain(pick(r, arr))
  })

  it('长度为 1 的数组恒返回那一个', () => {
    const r = createRng(5)
    expect(pick(r, ['only'])).toBe('only')
  })
})

describe('chance', () => {
  it('概率 0 恒假，概率 1 恒真', () => {
    const r = createRng(3)
    for (let i = 0; i < 100; i++) {
      expect(chance(r, 0)).toBe(false)
      expect(chance(r, 1)).toBe(true)
    }
  })

  it('概率 0.3 的实测频率在 ±0.03 内', () => {
    const r = createRng(3)
    let hit = 0
    const n = 20000
    for (let i = 0; i < n; i++) if (chance(r, 0.3)) hit++
    expect(Math.abs(hit / n - 0.3)).toBeLessThan(0.03)
  })
})
