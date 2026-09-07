import { describe, it, expect } from 'vitest'
import { createSimState, stepSim, defaultSimConfig, SIM_DT } from '../game/assets/logic/sim'
import { createKitchen, stepKitchen, stationInReach } from '../game/assets/logic/kitchen'
import { createMovement, stepMovement } from '../game/assets/logic/movement'
import { ISO_CAMERA_YAW, TouchRouter } from '../game/assets/logic/input'
import type { Station } from '../game/assets/logic/types'

/**
 * 铁律②：热路径零分配（ROADMAP §2.6 / §3.2）。
 *
 * 每帧要遍历顾客耐心、烤炉火候、玩家与工位距离。热路径上每帧 `new` 一堆临时对象
 * （典型：算距离顺手 new 一个向量）会触发频繁 GC → 帧时间尖刺 → 手感「一卡一卡」。
 * **这在 draw call 完全健康时也会发生，而且更难查** —— 所以要在这里挡住。
 *
 * 判据就是 ROADMAP 写的那条：Node 跑 10000 帧，heapUsed 增长趋近平坦。
 * 不用开编辑器、不用真机，这正是分层架构换来的。
 */

// 只声明用到的那一点点 Node 全局：不引 @types/node，免得 logic/ 里也能用上 process/Buffer
// —— 那些在 Cocos 的微信小游戏构建里是不存在的
declare const process: { memoryUsage(): { heapUsed: number } }
const maybeGc = (globalThis as { gc?: () => void }).gc

function heapAfterGc(): number {
  if (maybeGc) {
    maybeGc()
    maybeGc()
  }
  return process.memoryUsage().heapUsed
}

const FRAMES = 10000
const MB = 1024 * 1024

describe('铁律② · 热路径零分配', () => {
  it('跑 10000 帧，堆增长趋近平坦', () => {
    const cfg = { ...defaultSimConfig(), durationSec: 1e9, seed: 7 }
    const state = createSimState(cfg)

    // 先热身：让 V8 完成 JIT 与首次扩容，否则测到的是预热成本不是每帧分配
    for (let i = 0; i < 2000; i++) stepSim(state, SIM_DT)

    const before = heapAfterGc()
    for (let i = 0; i < FRAMES; i++) stepSim(state, SIM_DT)
    const after = heapAfterGc()

    const grownMB = (after - before) / MB
    expect(grownMB, `10000 帧后堆增长 ${grownMB.toFixed(2)}MB`).toBeLessThan(2)
  })

  it('厨房状态机跑 10000 帧同样平坦（stepKitchen + 每帧的工位提示查询）', () => {
    const station = (id: string, kind: Station['kind'], x: number, z: number): Station => ({
      id,
      kind,
      pos: { x, z },
      box: { center: { x, z }, halfX: 0.5, halfZ: 0.5 },
      triggerRange: 1.5,
    })
    const st = createKitchen({
      stations: [
        station('Station_Fridge', 'fridge', -3, 2),
        station('Station_Grill', 'grill', 0, 2),
        station('Station_Assembly', 'assembly', 3, 2),
        station('Station_Serve', 'serve', 3, -2),
      ],
      cook: { rareAt: 3, mediumAt: 6, wellAt: 9, burntAt: 13 },
      grillSlots: 2,
    })
    st.grill[0]!.busy = true
    st.grill[1]!.busy = true

    // 玩家位置每帧都在动 —— stationInReach 是每帧调用的，别只测 stepKitchen
    const pos = { x: 0, z: 0 }
    // 返回值必须被用掉 —— 丢弃的话 V8 可能把整个调用优化没，这条就成了测空气
    let hits = 0
    const run = (n: number): void => {
      for (let i = 0; i < n; i++) {
        pos.x = Math.sin(i * 0.01) * 4
        pos.z = Math.cos(i * 0.01) * 3
        stepKitchen(st, SIM_DT)
        if (stationInReach(st, pos) !== null) hits++
      }
    }

    run(2000)
    const before = heapAfterGc()
    run(FRAMES)
    const after = heapAfterGc()

    expect(hits, 'stationInReach 一次都没命中 → 这条测的是没进过循环体的空路径').toBeGreaterThan(0)

    const grownMB = (after - before) / MB
    expect(grownMB, `10000 帧后堆增长 ${grownMB.toFixed(2)}MB`).toBeLessThan(2)
  })

  it('角色移动跑 10000 帧同样平坦（stepMovement + 每帧的碰撞解算）', () => {
    const m = createMovement({
      boxes: [
        { center: { x: 2, z: -2.5 }, halfX: 0.5, halfZ: 0.5 },
        { center: { x: -2, z: -2.5 }, halfX: 0.5, halfZ: 0.5 },
        { center: { x: -3.5, z: 0 }, halfX: 0.5, halfZ: 0.5 },
        { center: { x: -1, z: 2.5 }, halfX: 1, halfZ: 0.5 },
      ],
    })

    // 摇杆对象也复用 —— 每帧 new 一个 StickState 就测不出 movement 自己的分配了
    const stick = { dirX: 0, dirY: 0, magnitude: 1, active: true }
    // 撞墙次数必须非零，否则这条只测了空地上转圈那条捷径
    let blocked = 0
    const run = (n: number): void => {
      for (let i = 0; i < n; i++) {
        const a = i * 0.017
        stick.dirX = Math.cos(a)
        stick.dirY = Math.sin(a)
        stepMovement(m, stick, ISO_CAMERA_YAW, SIM_DT)
        if (m.blocked) blocked++
      }
    }

    run(2000)
    const before = heapAfterGc()
    run(FRAMES)
    const after = heapAfterGc()

    expect(blocked, '一次都没被挡住 → 碰撞解算那条路径没进去过').toBeGreaterThan(0)

    const grownMB = (after - before) / MB
    expect(grownMB, `10000 帧后堆增长 ${grownMB.toFixed(2)}MB`).toBeLessThan(2)
  })

  // ↓ 活性守卫：没有它，万一 heapAfterGc 读到的是常数（比如 memoryUsage 被垫片掉），
  //   上面那条会恒真报全绿。先证明这套测量真能看见分配，上面的通过才有意义。
  it('对照：同样帧数下真的分配对象时，这套测量看得见', () => {
    const before = heapAfterGc()
    const sink: object[] = []
    for (let i = 0; i < FRAMES; i++) sink.push({ x: i, z: i, tag: 'leak' })
    const after = heapAfterGc()
    expect(sink.length).toBe(FRAMES)
    expect((after - before) / MB).toBeGreaterThan(0.3)
  })

  it('gc 确实可用 —— 否则上面两条读的都是 GC 时机的噪声', () => {
    expect(typeof maybeGc).toBe('function')
  })

  it('TouchRouter 带 9 个捕获区跑 10000 帧仍平坦（面板开着时的最坏情况）', () => {
    // 8 格 + 丢弃键 = 面板打开时同时挂着的最大数量
    const zones = []
    for (let i = 0; i < 8; i++) {
      zones.push({ id: `slot${i}`, x: 376 + (i % 4) * 136, y: 420 - Math.floor(i / 4) * 136, w: 120, h: 120 })
    }
    zones.push({ id: 'discard', x: 1040, y: 300, w: 120, h: 120 })

    const r = new TouchRouter(640)
    r.setCaptureZones(zones)
    // 双手都按着：摇杆在推、一个格子被按住 —— tick 要走完所有分支
    r.onDown(1, 100, 300)
    r.onMove(1, 190, 300)
    r.onDown(2, 436, 480)

    for (let i = 0; i < 2000; i++) r.tick(SIM_DT)

    const before = heapAfterGc()
    for (let i = 0; i < FRAMES; i++) r.tick(SIM_DT)
    const after = heapAfterGc()

    // 守卫：这一路真的走到了长按分支，否则上面 10000 次 tick 可能什么都没做
    expect(r.zone('discard')).toBeDefined()
    expect(r.zone('slot0')!.holding).toBe(true)

    const grownMB = (after - before) / MB
    expect(grownMB, `10000 帧后堆增长 ${grownMB.toFixed(2)}MB`).toBeLessThan(2)
  })
})
