import { describe, expect, it } from 'vitest'
import {
  ARGUE_IDLE_SEC,
  ARGUE_TAPS,
  argueTap,
  createVent,
  endArgue,
  RANT_SEC,
  ranting,
  rantsLeft,
  rantStars,
  resetVent,
  startRant,
  stepVent,
  vent,
  VENT_BOOST_SEC,
  VENT_SPEED,
  ventSpeedFactor,
} from '../game/assets/logic/vent'
import type { Rant } from '../game/assets/logic/vent'

const run = (st: ReturnType<typeof createVent>, sec: number, done?: (r: Rant) => void) => {
  for (let t = 0; t < sec - 1e-9; t += 0.1) stepVent(st, 0.1, done)
}

describe('顾客在前台发火', () => {
  it('发完 RANT_SEC 秒才留评价离开；没人怼就是原本的星数', () => {
    const st = createVent()
    const done: [number, number][] = []
    startRant(st, 7, 1)
    run(st, RANT_SEC - 0.5, (r) => done.push([r.id, rantStars(r)]))
    expect(ranting(st, 7)).toBe(true)
    run(st, 1, (r) => done.push([r.id, rantStars(r)]))
    expect(done).toEqual([[7, 1]])
    expect(rantsLeft(st)).toBe(0)
  })

  it('长按开骂：对骂期间顾客不走、也还没加速；点满 ARGUE_TAPS 下顾客当场摔门走，评价少一颗星', () => {
    const st = createVent()
    const done: [number, number][] = []
    const d = (x: Rant) => done.push([x.id, rantStars(x)])
    startRant(st, 3, 2)
    const r = vent(st, 'register')
    expect(r && r !== true && r.id).toBe(3)
    expect(st.retorts).toBe(1)
    expect(ventSpeedFactor(st)).toBe(1)
    // Rant timer frozen while shouting: well past RANT_SEC and still here, as long as taps keep coming
    for (let i = 0; i < ARGUE_TAPS - 1; i++) {
      expect(argueTap(st)).toBe(i)
      run(st, RANT_SEC / ARGUE_TAPS + 0.5, d)
    }
    expect(ranting(st, 3)).toBe(true)
    expect(done).toEqual([])
    argueTap(st)
    expect(st.argue).toBeNull()
    expect(ventSpeedFactor(st)).toBe(VENT_SPEED)
    run(st, 0.1, d)
    expect(done).toEqual([[3, 1]])
    startRant(st, 4, 0)
    vent(st, 'register')
    for (let i = 0; i < ARGUE_TAPS; i++) argueTap(st)
    run(st, 0.1, d)
    expect(done).toEqual([[3, 1], [4, 0]])
  })

  it('停手 ARGUE_IDLE_SEC 秒 = 顾客骂完最后一句走人；走开也一样', () => {
    const st = createVent()
    const done: number[] = []
    startRant(st, 5, 2)
    vent(st, 'register')
    argueTap(st)
    run(st, ARGUE_IDLE_SEC - 0.2, (x) => done.push(x.id))
    expect(st.argue).not.toBeNull()
    run(st, 0.4, (x) => done.push(x.id))
    expect(done).toEqual([5])
    expect(ventSpeedFactor(st)).toBe(VENT_SPEED)
    startRant(st, 6, 2)
    vent(st, 'register')
    endArgue(st)
    run(st, 0.1, (x) => done.push(x.id))
    expect(done).toEqual([5, 6])
    expect(argueTap(st)).toBe(-1)
  })

  it('前台没人发火时长按不算发泄', () => {
    const st = createVent()
    expect(vent(st, 'register')).toBeNull()
    expect(st.vents).toBe(0)
    expect(ventSpeedFactor(st)).toBe(1)
  })

  it('一次只跟一位对骂；几位同时发火时先骂最快要走的那位，一位只能被怼一次', () => {
    const st = createVent()
    startRant(st, 1, 1)
    run(st, 1)
    startRant(st, 2, 1)
    const a = vent(st, 'register')
    expect(a && a !== true && a.id).toBe(1)
    expect(vent(st, 'register')).toBeNull()
    endArgue(st)
    run(st, 0.1)
    const b = vent(st, 'register')
    expect(b && b !== true && b.id).toBe(2)
    endArgue(st)
    run(st, 0.1)
    expect(vent(st, 'register')).toBeNull()
  })
})

describe('发泄的收益', () => {
  it('冰箱前摔门随时可以，加速持续 VENT_BOOST_SEC 秒', () => {
    const st = createVent()
    expect(vent(st, 'fridge')).toBe(true)
    run(st, VENT_BOOST_SEC - 0.2)
    expect(ventSpeedFactor(st)).toBe(VENT_SPEED)
    run(st, 0.4)
    expect(ventSpeedFactor(st)).toBe(1)
    expect(st.vents).toBe(1)
  })

  it('重开一天清空', () => {
    const st = createVent()
    startRant(st, 1, 1)
    vent(st, 'register')
    argueTap(st)
    resetVent(st)
    expect(rantsLeft(st)).toBe(0)
    expect(st.vents + st.retorts + st.boostLeft + st.taps).toBe(0)
    expect(st.argue).toBeNull()
  })

  it('槽位复用，不无限增长', () => {
    const st = createVent()
    for (let i = 0; i < 20; i++) {
      startRant(st, i, 1)
      run(st, RANT_SEC + 0.1)
    }
    expect(st.rants.length).toBe(1)
  })
})
