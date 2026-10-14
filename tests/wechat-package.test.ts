import { describe, expect, it } from 'vitest'
// @ts-expect-error Build utility is JavaScript and does not use engine types.
import { summarizePackages, MAIN_LIMIT } from '../tools/check-wechat-package.mjs'

describe('WeChat package budget', () => {
  it('counts every byte, including unindexed mesh and animation binaries', () => {
    const result = summarizePackages([{ path: 'cocos-js/cc.js', bytes: MAIN_LIMIT },
      { path: 'assets/main/native/mesh@123.bin', bytes: 1 }])
    expect(result.main.bytes).toBe(MAIN_LIMIT + 1)
    expect(result.withinBudget).toBe(false)
  })

  it('counts declared subpackages separately from the main package', () => {
    const result = summarizePackages([{ path: 'game.js', bytes: 200 },
      { path: 'subpackages/main/native/mesh.bin', bytes: MAIN_LIMIT + 100 }],
    [{ name: 'main', root: 'subpackages/main/' }])
    expect(result.main.bytes).toBe(200)
    expect(result.subpackages[0].bytes).toBe(MAIN_LIMIT + 100)
    expect(result.totalBytes).toBe(MAIN_LIMIT + 300)
    expect(result.withinBudget).toBe(true)
  })

  it('does not exclude files whose folder only shares a subpackage prefix', () => {
    const result = summarizePackages([{ path: 'subpackages/main/a', bytes: 1 },
      { path: 'subpackages/main-old/a', bytes: 200 }], [{ root: 'subpackages/main' }])
    expect(result.main.bytes).toBe(200)
  })

  it('accepts the exact main limit but flags the missing safety margin', () => {
    const result = summarizePackages([{ path: 'game.js', bytes: MAIN_LIMIT }])
    expect(result.withinBudget).toBe(true)
    expect(result.withinSafetyMargin).toBe(false)
  })

  it('rejects a combined package above the total budget', () => {
    const result = summarizePackages([{ path: 'game.js', bytes: 1 },
      { path: 'subpackages/main/model.bin', bytes: 30 * 1024 * 1024 }], [{ root: 'subpackages/main' }])
    expect(result.main.bytes).toBe(1)
    expect(result.withinBudget).toBe(false)
  })

  it('rejects missing, overlapping and escaping subpackage roots', () => {
    expect(() => summarizePackages([], [{ root: 'subpackages/main' }])).toThrow('missing')
    expect(() => summarizePackages([], [{ root: '../main' }])).toThrow('Invalid')
    expect(() => summarizePackages([], [{ root: 'subpackages/main' }, { root: 'subpackages/main/child' }])).toThrow('Overlapping')
  })
})
