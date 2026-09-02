import { describe, it, expect } from 'vitest'
import {
  TouchRouter,
  stickToWorld,
  stickToVelocity,
  ISO_CAMERA_YAW,
  DEFAULT_STICK,
} from '../game/assets/logic/input'
import type { Vec2 } from '../game/assets/logic/vec2'

const SPLIT = 640 // 1280 宽的一半
const R = DEFAULT_STICK.radius // 90

const mk = () => new TouchRouter(SPLIT)
const out = (): Vec2 => ({ x: 0, z: 0 })

describe('归属锁定', () => {
  it('左半屏按下的手指划过中线，仍然算摇杆', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    r.onMove(1, 900, 300) // 越过 splitX 到了右半屏
    expect(r.stick.active).toBe(true)
    expect(r.stick.dirX).toBe(1)
    expect(r.action.down).toBe(false) // 没有莫名触发动作键
  })

  it('右半屏按下的手指划到左边，不会变成摇杆', () => {
    const r = mk()
    r.onDown(1, 900, 300)
    r.onMove(1, 100, 300)
    expect(r.action.down).toBe(true)
    expect(r.stick.active).toBe(false)
  })
})

describe('一路只收一根手指', () => {
  it('摇杆已被占用时，第二根左手指整根被忽略', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    r.onMove(1, 100 + R, 300) // 满格向右
    r.onDown(2, 500, 500) // 第二根落在左半屏
    r.onMove(2, 500, 700) // 想把摇杆掰成向上
    expect(r.stick.dirX).toBe(1)
    expect(r.stick.dirY).toBe(0)
  })

  it('被忽略的那根抬起时，不影响还在推的摇杆', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    r.onMove(1, 100, 300 + R)
    r.onDown(2, 500, 500)
    r.onUp(2)
    expect(r.stick.active).toBe(true)
    expect(r.stick.dirY).toBe(1)
  })
})

describe('双手同时', () => {
  it('左推右按互不干扰', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    r.onMove(1, 100 + R, 300)
    r.onDown(2, 900, 200)
    r.tick(0.016)
    expect(r.stick.magnitude).toBe(1)
    expect(r.stick.dirX).toBe(1)
    expect(r.action.down).toBe(true)
    // 松开动作键，摇杆照旧
    r.onUp(2)
    expect(r.stick.magnitude).toBe(1)
    expect(r.action.down).toBe(false)
  })
})

describe('摇杆量化', () => {
  it('死区内视为回中', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    r.onMove(1, 100 + R * (DEFAULT_STICK.deadzone - 0.01), 300)
    expect(r.stick.magnitude).toBe(0)
    expect(r.stick.dirX).toBe(0)
    expect(r.stick.active).toBe(true) // 手指还在，只是没推出死区
  })

  it('超出半径饱和到 1，方向仍正确', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    r.onMove(1, 100 + R * 5, 300)
    expect(r.stick.magnitude).toBe(1)
    expect(r.stick.dirX).toBe(1)
  })

  it('斜推到角落 magnitude 不超过 1', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    r.onMove(1, 100 + R, 300 + R) // 两轴都满格，直线距离是 R*√2
    expect(r.stick.magnitude).toBe(1)
    expect(r.stick.dirX).toBeCloseTo(Math.SQRT1_2, 6)
    expect(r.stick.dirY).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('按下不动不产生 NaN', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    expect(r.stick.dirX).toBe(0)
    expect(r.stick.dirY).toBe(0)
    expect(r.stick.magnitude).toBe(0)
  })

  it('抬手立即回中', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    r.onMove(1, 100 + R, 300)
    r.onUp(1)
    expect(r.stick.active).toBe(false)
    expect(r.stick.magnitude).toBe(0)
  })
})

describe('点按与长按', () => {
  it('短按抬手发一次 tap，且只发一帧', () => {
    const r = mk()
    r.tick(0.016)
    r.onDown(1, 900, 300)
    r.tick(0.1)
    r.onUp(1)
    expect(r.action.tapped).toBe(true)
    r.tick(0.016)
    expect(r.action.tapped).toBe(false)
  })

  it('按住跨过阈值进入 holding，holdStarted 只亮一帧', () => {
    const r = mk()
    r.onDown(1, 900, 300)
    r.tick(0.2)
    expect(r.action.holding).toBe(false)
    r.tick(0.2) // 累计 0.4 > 0.3
    expect(r.action.holding).toBe(true)
    expect(r.action.holdStarted).toBe(true)
    r.tick(0.016)
    expect(r.action.holding).toBe(true)
    expect(r.action.holdStarted).toBe(false)
  })

  it('长按后抬手不再补发 tap', () => {
    const r = mk()
    r.onDown(1, 900, 300)
    r.tick(0.5)
    r.onUp(1)
    expect(r.action.tapped).toBe(false)
    expect(r.action.holding).toBe(false)
  })

  it('holding 期间 heldSeconds 持续累加（洗碗池按进度用）', () => {
    const r = mk()
    r.onDown(1, 900, 300)
    r.tick(0.5)
    r.tick(0.5)
    expect(r.action.heldSeconds).toBeCloseTo(1, 6)
  })
})

describe('cancelAll', () => {
  it('系统抢走触摸后摇杆不会卡在最后方向', () => {
    const r = mk()
    r.onDown(1, 100, 300)
    r.onMove(1, 100 + R, 300)
    r.onDown(2, 900, 300)
    r.cancelAll()
    expect(r.stick.magnitude).toBe(0)
    expect(r.stick.active).toBe(false)
    expect(r.action.down).toBe(false)
    // 清完之后同 id 能重新按下（没有残留占位）
    r.onDown(1, 200, 300)
    expect(r.stick.active).toBe(true)
  })
})

describe('setSplitX', () => {
  it('改分界后新按下的手指按新界线归属', () => {
    const r = mk()
    r.setSplitX(200)
    r.onDown(1, 300, 300) // 老界线下算左，新界线下算右
    expect(r.action.down).toBe(true)
    expect(r.stick.active).toBe(false)
  })
})

describe('stickToWorld', () => {
  const push = (dx: number, dy: number) => {
    const r = mk()
    r.onDown(1, 400, 300)
    r.onMove(1, 400 + dx * R, 300 + dy * R)
    return r.stick
  }

  it('yaw 为 0 时，向上推 = 世界 -z（屏幕上对应相机朝向）', () => {
    const o = out()
    stickToWorld(o, push(0, 1), 0)
    expect(o.x).toBeCloseTo(0, 6)
    expect(o.z).toBeCloseTo(-1, 6)
  })

  it('yaw 为 0 时，向右推 = 世界 +x', () => {
    const o = out()
    stickToWorld(o, push(1, 0), 0)
    expect(o.x).toBeCloseTo(1, 6)
    expect(o.z).toBeCloseTo(0, 6)
  })

  it('斜 45° 下向上推走的是对角线，且仍是单位向量', () => {
    const o = out()
    stickToWorld(o, push(0, 1), ISO_CAMERA_YAW)
    expect(Math.hypot(o.x, o.z)).toBeCloseTo(1, 6)
    // 两个分量等长 —— 这正是「玩家往上推却斜着走」那个坑的数学形状
    expect(Math.abs(o.x)).toBeCloseTo(Math.abs(o.z), 6)
  })

  it('旋转不改变长度：四个方向都是单位向量', () => {
    const o = out()
    const dirs: ReadonlyArray<readonly [number, number]> = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]
    for (const [dx, dy] of dirs) {
      stickToWorld(o, push(dx, dy), ISO_CAMERA_YAW)
      expect(Math.hypot(o.x, o.z)).toBeCloseTo(1, 6)
    }
  })
})

describe('stickToVelocity', () => {
  it('回中时写零向量并返回 false', () => {
    const r = mk()
    const o = { x: 9, z: 9 }
    expect(stickToVelocity(o, r.stick, ISO_CAMERA_YAW, 5)).toBe(false)
    expect(o.x).toBe(0)
    expect(o.z).toBe(0)
  })

  it('轻推走得慢：速度按 magnitude 缩放', () => {
    const r = mk()
    r.onDown(1, 400, 300)
    r.onMove(1, 400 + R * 0.5, 300)
    const o = out()
    stickToVelocity(o, r.stick, 0, 10)
    expect(Math.hypot(o.x, o.z)).toBeCloseTo(5, 6)
  })

  it('满格时长度就是 speed', () => {
    const r = mk()
    r.onDown(1, 400, 300)
    r.onMove(1, 400, 300 + R)
    const o = out()
    expect(stickToVelocity(o, r.stick, ISO_CAMERA_YAW, 4)).toBe(true)
    expect(Math.hypot(o.x, o.z)).toBeCloseTo(4, 6)
  })
})
