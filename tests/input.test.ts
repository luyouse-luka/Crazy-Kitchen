import { describe, it, expect } from 'vitest'
import {
  TouchRouter,
  stickToWorld,
  stickToVelocity,
  ISO_CAMERA_YAW,
  DEFAULT_STICK,
} from '../game/assets/logic/input'
import type { CaptureZone } from '../game/assets/logic/input'
import type { Vec2 } from '../game/assets/logic/vec2'
import { UI_SPEC, uiRectToCaptureZone } from '../tools/scene-spec'

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

// ─────────────────────── 捕获区（UI 面板 / 丢弃键） ───────────────────────

/**
 * 坐标不手填，从 scene-spec 的定稿算出来 —— 面板挪一格、格子改大小，
 * 下面这些用例会跟着动，不会悄悄测一个早就不存在的布局。
 */
const zoneOf = (name: string, id: string, sw = 1280, sh = 720): CaptureZone => {
  const u = UI_SPEC[name]!
  return uiRectToCaptureZone(id, u.pos![0], u.pos![1], u.size![0], u.size![1], sw, sh)
}
const SLOT_L = zoneOf('Slot_0', 'slot0') // 左上格，落在摇杆那半屏
const SLOT_R = zoneOf('Slot_3', 'slot3') // 右上格，落在动作键那半屏
const DISCARD = zoneOf('UI_DiscardButton', 'discard')
const ZONES = [SLOT_L, SLOT_R, DISCARD]

/** 区中心，避免贴边测试掩盖边界 bug */
const mid = (z: CaptureZone): [number, number] => [z.x + z.w / 2, z.y + z.h / 2]

const mkZ = () => {
  const r = new TouchRouter(SPLIT)
  r.setCaptureZones(ZONES)
  return r
}

describe('捕获区优先于左右分路', () => {
  it('右半屏的丢弃键：按它不触发动作键', () => {
    const r = mkZ()
    r.onDown(1, ...mid(DISCARD))
    expect(r.zone('discard')!.down).toBe(true)
    expect(r.action.down).toBe(false) // 反例锚点：没有捕获区时这里会是 true
  })

  it('左半屏的格子：按它不推摇杆', () => {
    const r = mkZ()
    const [x, y] = mid(SLOT_L)
    r.onDown(1, x, y)
    r.onMove(1, x + 40, y) // 区内划一段（不能超出 60 的半宽，否则触发滑出取消）
    expect(r.zone('slot0')!.down).toBe(true)
    expect(r.stick.active).toBe(false)
    expect(r.stick.magnitude).toBe(0)
  })

  it('没有捕获区时同一点仍走原有分路（证伪锚点）', () => {
    const r = new TouchRouter(SPLIT) // 故意不 setCaptureZones
    r.onDown(1, ...mid(DISCARD))
    expect(r.action.down).toBe(true)
  })

  it('区外的按下照旧：右半屏走动作键、左半屏走摇杆', () => {
    const r = mkZ()
    r.onDown(1, 1200, 80) // 右下但在丢弃键之外
    expect(r.action.down).toBe(true)
    r.onDown(2, 120, 200)
    expect(r.stick.active).toBe(true)
  })

  it('中线两侧各一个格子，都不惊动摇杆与动作键', () => {
    const r = mkZ()
    r.onDown(1, ...mid(SLOT_L))
    r.onDown(2, ...mid(SLOT_R))
    expect(r.zone('slot0')!.down).toBe(true)
    expect(r.zone('slot3')!.down).toBe(true)
    expect(r.stick.active).toBe(false)
    expect(r.action.down).toBe(false)
  })
})

describe('捕获区的点按与长按', () => {
  it('短按抬手发一次 tap，且只发一帧', () => {
    const r = mkZ()
    r.tick(0.016)
    r.onDown(1, ...mid(SLOT_L))
    r.tick(0.1)
    r.onUp(1)
    expect(r.zone('slot0')!.tapped).toBe(true)
    r.tick(0.016)
    expect(r.zone('slot0')!.tapped).toBe(false)
  })

  it('按住跨过阈值进入 holding，holdStarted 只亮一帧', () => {
    const r = mkZ()
    r.onDown(1, ...mid(DISCARD))
    r.tick(0.2)
    expect(r.zone('discard')!.holding).toBe(false)
    r.tick(0.2) // 累计 0.4 > 0.3
    expect(r.zone('discard')!.holding).toBe(true)
    expect(r.zone('discard')!.holdStarted).toBe(true)
    r.tick(0.016)
    expect(r.zone('discard')!.holding).toBe(true)
    expect(r.zone('discard')!.holdStarted).toBe(false)
  })

  it('长按后抬手不再补发 tap —— 丢弃不该同时算一次点按', () => {
    const r = mkZ()
    r.onDown(1, ...mid(DISCARD))
    r.tick(0.4)
    r.onUp(1)
    expect(r.zone('discard')!.tapped).toBe(false)
    expect(r.zone('discard')!.down).toBe(false)
  })
})

describe('捕获区滑出取消', () => {
  it('按下后滑出区外抬手，不产生 tap', () => {
    const r = mkZ()
    r.onDown(1, ...mid(SLOT_L))
    r.onMove(1, SLOT_L.x - 40, SLOT_L.y) // 滑到区外
    r.onUp(1)
    expect(r.zone('slot0')!.tapped).toBe(false)
  })

  it('长按途中滑出，holding 当场撤销', () => {
    const r = mkZ()
    r.onDown(1, ...mid(DISCARD))
    r.tick(0.4)
    expect(r.zone('discard')!.holding).toBe(true)
    r.onMove(1, DISCARD.x - 40, DISCARD.y)
    expect(r.zone('discard')!.holding).toBe(false)
    expect(r.zone('discard')!.down).toBe(false)
  })

  it('滑出后再滑回不复活 —— 那根手指已经作废', () => {
    const r = mkZ()
    const [x, y] = mid(DISCARD)
    r.onDown(1, x, y)
    r.onMove(1, DISCARD.x - 40, y)
    r.onMove(1, x, y)
    r.tick(0.4)
    expect(r.zone('discard')!.down).toBe(false)
    expect(r.zone('discard')!.holding).toBe(false)
  })

  it('作废的手指不会转投摇杆或动作键', () => {
    const r = mkZ()
    r.onDown(1, ...mid(SLOT_L))
    r.onMove(1, 100, 200) // 滑进摇杆区腹地
    expect(r.stick.active).toBe(false)
    r.onMove(1, 1200, 80) // 再滑到动作键区
    expect(r.action.down).toBe(false)
  })
})

describe('捕获区的记账边界', () => {
  it('一个区同时只收一根手指', () => {
    const r = mkZ()
    const [x, y] = mid(DISCARD)
    r.onDown(1, x, y)
    r.onDown(2, x + 10, y + 10) // 第二根落在同一个区
    r.tick(0.4)
    r.onUp(2) // 第二根抬起不该把区清空
    expect(r.zone('discard')!.down).toBe(true)
    expect(r.zone('discard')!.holding).toBe(true)
  })

  it('重叠的区，先登记的那个赢', () => {
    const r = new TouchRouter(SPLIT)
    r.setCaptureZones([
      { id: 'front', x: 400, y: 400, w: 200, h: 200 },
      { id: 'back', x: 400, y: 400, w: 200, h: 200 },
    ])
    r.onDown(1, 500, 500)
    expect(r.zone('front')!.down).toBe(true)
    expect(r.zone('back')!.down).toBe(false)
  })

  it('边界含左下、不含右上 —— 相邻格子不会同时命中', () => {
    const r = new TouchRouter(SPLIT)
    r.setCaptureZones([
      { id: 'a', x: 100, y: 100, w: 100, h: 100 },
      { id: 'b', x: 200, y: 100, w: 100, h: 100 },
    ])
    r.onDown(1, 200, 150) // 正好在 a 的右边界 = b 的左边界
    expect(r.zone('a')!.down).toBe(false)
    expect(r.zone('b')!.down).toBe(true)
  })

  it('cancelAll 清掉正按着的区', () => {
    const r = mkZ()
    r.onDown(1, ...mid(DISCARD))
    r.tick(0.4)
    r.cancelAll()
    expect(r.zone('discard')!.down).toBe(false)
    expect(r.zone('discard')!.holding).toBe(false)
    expect(r.zone('discard')!.heldSeconds).toBe(0)
  })

  it('重设捕获区会丢掉正按着的手指 —— 面板关闭时按着的格子不能留到下次', () => {
    const r = mkZ()
    r.onDown(1, ...mid(SLOT_L))
    r.setCaptureZones([DISCARD]) // 面板关了，只剩丢弃键
    expect(r.zone('slot0')).toBeUndefined()
    r.onUp(1) // 那根手指的抬起事件迟到了
    expect(r.action.down).toBe(false) // 不该被右半屏捡走
    expect(r.stick.active).toBe(false)
  })

  it('未登记的 id 读回 undefined', () => {
    const r = mkZ()
    expect(r.zone('nope')).toBeUndefined()
  })

  it('清空捕获区后，原本被挡住的位置恢复走动作键', () => {
    const r = mkZ()
    r.setCaptureZones([])
    r.onDown(1, ...mid(DISCARD))
    expect(r.action.down).toBe(true)
  })
})

describe('捕获区对 scene-spec 的跨模块漂移', () => {
  it('面板的 8 格确实横跨 splitX —— 这正是捕获区存在的理由', () => {
    const zs = Array.from({ length: 8 }, (_, i) => zoneOf(`Slot_${i}`, `slot${i}`))
    const left = zs.filter((z) => z.x + z.w <= SPLIT)
    const right = zs.filter((z) => z.x >= SPLIT)
    // 两侧都得有格子，否则「面板横跨中线」这条前提就不成立了，机制也就白做
    expect(left.length).toBeGreaterThan(0)
    expect(right.length).toBeGreaterThan(0)
    expect(left.length + right.length).toBe(8) // 没有格子骑在线上（骑线的那个两边都拿不到）
  })

  it('丢弃键落在右半屏 —— 在左半屏的话它挡的是摇杆不是动作键', () => {
    expect(DISCARD.x).toBeGreaterThanOrEqual(SPLIT)
  })

  it('格子之间不重叠 —— 重叠时 hitZone 只认先登记的那个，后面的永远点不到', () => {
    const zs = Array.from({ length: 8 }, (_, i) => zoneOf(`Slot_${i}`, `slot${i}`))
    for (let a = 0; a < zs.length; a++) {
      for (let b = a + 1; b < zs.length; b++) {
        const overlap =
          zs[a]!.x < zs[b]!.x + zs[b]!.w &&
          zs[b]!.x < zs[a]!.x + zs[a]!.w &&
          zs[a]!.y < zs[b]!.y + zs[b]!.h &&
          zs[b]!.y < zs[a]!.y + zs[a]!.h
        expect(overlap, `Slot_${a} 与 Slot_${b} 重叠`).toBe(false)
      }
    }
  })

  it('8 格都在屏内 —— 面板一旦挪出边界，越界的格子点不到但也不报错', () => {
    for (let i = 0; i < 8; i++) {
      const z = zoneOf(`Slot_${i}`, `slot${i}`)
      expect(z.x, `Slot_${i} 左边越界`).toBeGreaterThanOrEqual(0)
      expect(z.y, `Slot_${i} 下边越界`).toBeGreaterThanOrEqual(0)
      expect(z.x + z.w, `Slot_${i} 右边越界`).toBeLessThanOrEqual(1280)
      expect(z.y + z.h, `Slot_${i} 上边越界`).toBeLessThanOrEqual(720)
    }
  })

  it('丢弃键与动作键不重叠 —— 重叠会让「按动作键」偶尔变成「丢弃」', () => {
    const act = UI_SPEC['UI_ActionButton']!
    // 动作键的位置由 Widget 算出，不在 UI_SPEC 里；用 ROADMAP §6 记的中心 (440, -160)
    const a = uiRectToCaptureZone('action', 440, -160, act.size![0], act.size![1], 1280, 720)
    const overlap =
      a.x < DISCARD.x + DISCARD.w &&
      DISCARD.x < a.x + a.w &&
      a.y < DISCARD.y + DISCARD.h &&
      DISCARD.y < a.y + a.h
    expect(overlap).toBe(false)
  })
})

describe('真机分辨率下的捕获区（编辑器 1280×720 预览永远看不出问题的那一类）', () => {
  // 2400×1080：常见的 20:9 手机。Fit Height → scale = 1080/720 = 1.5
  const SW = 2400
  const SH = 1080
  const K = SH / 720

  it('区随屏幕缩放，不是钉在设计分辨率上', () => {
    const z = zoneOf('UI_DiscardButton', 'discard', SW, SH)
    expect(z.w).toBeCloseTo(120 * K, 6)
    expect(z.h).toBeCloseTo(120 * K, 6)
  })

  it('丢弃键仍贴着右下角 —— 按 1280 硬算的话它会落到屏幕正中偏左', () => {
    const z = zoneOf('UI_DiscardButton', 'discard', SW, SH)
    const wrong = uiRectToCaptureZone('discard', 440, 0, 120, 120, 1280, 720) // 写死常量的错法
    expect(z.x).toBeGreaterThan(SW / 2) // 右半屏
    expect(wrong.x).toBeLessThan(SW / 2) // 反例：错法把它扔到了左半边
  })

  it('8 格仍横跨真实中线 —— splitX 也得取真实宽度', () => {
    const split = SW / 2
    const zs = Array.from({ length: 8 }, (_, i) => zoneOf(`Slot_${i}`, `slot${i}`, SW, SH))
    expect(zs.filter((z) => z.x + z.w <= split).length).toBeGreaterThan(0)
    expect(zs.filter((z) => z.x >= split).length).toBeGreaterThan(0)
  })

  it('缩放后仍不越界、仍不重叠', () => {
    const zs = Array.from({ length: 8 }, (_, i) => zoneOf(`Slot_${i}`, `slot${i}`, SW, SH))
    for (const z of zs) {
      expect(z.x).toBeGreaterThanOrEqual(0)
      expect(z.x + z.w).toBeLessThanOrEqual(SW)
      expect(z.y).toBeGreaterThanOrEqual(0)
      expect(z.y + z.h).toBeLessThanOrEqual(SH)
    }
    for (let a = 0; a < zs.length; a++) {
      for (let b = a + 1; b < zs.length; b++) {
        const o =
          zs[a]!.x < zs[b]!.x + zs[b]!.w &&
          zs[b]!.x < zs[a]!.x + zs[a]!.w &&
          zs[a]!.y < zs[b]!.y + zs[b]!.h &&
          zs[b]!.y < zs[a]!.y + zs[a]!.h
        expect(o, `Slot_${a} 与 Slot_${b} 在 ${SW}×${SH} 下重叠`).toBe(false)
      }
    }
  })

  it('点真实屏幕上的那个位置，命中的是对的区', () => {
    const r = new TouchRouter(SW / 2)
    r.setCaptureZones([zoneOf('UI_DiscardButton', 'discard', SW, SH)])
    const z = zoneOf('UI_DiscardButton', 'discard', SW, SH)
    r.onDown(1, z.x + z.w / 2, z.y + z.h / 2)
    expect(r.zone('discard')!.down).toBe(true)
    expect(r.action.down).toBe(false)
  })
})
