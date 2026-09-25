import { describe, expect, it } from 'vitest'
import { COLOR_PRICE, DECOR_ITEMS, DECOR_SLOTS, newDecor, paint, parseDecor, place } from '../game/assets/logic/decor'
import { newProgress, parseProgress, serializeProgress } from '../game/assets/logic/progress'

const price = (id: string) => DECOR_ITEMS.find((x) => x.id === id)!.price

describe('装修', () => {
  it('新档 = 场景原样：每个位子摆着原来的东西，原有的东西算已拥有', () => {
    const d = newDecor()
    for (const s of DECOR_SLOTS) expect(d.placed[s.id]).toBe(s.initial)
    expect(d.owned.sort()).toEqual(['plant', 'plant-small'])
    expect([d.wall, d.floor]).toEqual([0, 0])
  })

  it('没买过的东西：钱够才摆得上并扣钱；买过一次，别的位子再摆不要钱', () => {
    const p = newProgress()
    p.coins = price('bookcase') - 1
    expect(place(p, 'wall-n', 'bookcase')).toBe('poor')
    expect(p.decor.placed['wall-n']).toBeNull()
    p.coins = price('bookcase')
    expect(place(p, 'wall-n', 'bookcase')).toBe('ok')
    expect(p.coins).toBe(0)
    expect(place(p, 'wall-n', null)).toBe('ok')
    expect(place(p, 'wall-n', 'bookcase')).toBe('ok')
    expect(p.coins).toBe(0)
  })

  it('位子不收的东西摆不上；原样不动算 same、不扣钱', () => {
    const p = newProgress()
    p.coins = 999
    expect(place(p, 'counter', 'bookcase')).toBe('not-allowed')
    expect(place(p, 'wait-left', 'plant')).toBe('same')
    expect(p.coins).toBe(999)
  })

  it('换颜色每次 COLOR_PRICE，换回原色也要钱；钱不够不换', () => {
    const p = newProgress()
    p.coins = COLOR_PRICE * 2
    expect(paint(p, 'wall', 2)).toBe('ok')
    expect(paint(p, 'wall', 2)).toBe('same')
    expect(paint(p, 'wall', 0)).toBe('ok')
    expect(p.coins).toBe(0)
    expect(paint(p, 'floor', 1)).toBe('poor')
    expect(p.decor.floor).toBe(0)
    expect(paint(p, 'floor', 99)).toBe('unknown')
  })

  it('存档往返无损；没有 decor 的旧档读成场景原样', () => {
    const p = newProgress()
    p.coins = 500
    place(p, 'wall-n', 'bookcase')
    place(p, 'counter', null)
    paint(p, 'floor', 3)
    expect(parseProgress(serializeProgress(p))).toEqual(p)
    expect(parseProgress('{"v":2,"day":2,"best":[],"coins":9}').decor).toEqual(newDecor())
  })

  it('手改的坏值退回原样：没买的东西、位子不收的东西、越界的颜色', () => {
    const d = parseDecor({ placed: { 'wall-n': 'bookcase', counter: 'bookcase', 'wait-left': null }, owned: ['nope'], wall: 9, floor: -1 })
    expect(d.placed['wall-n']).toBeNull()
    expect(d.placed.counter).toBe('plant-small')
    expect(d.placed['wait-left']).toBeNull()
    expect(d.owned).not.toContain('nope')
    expect([d.wall, d.floor]).toEqual([0, 0])
  })
})
