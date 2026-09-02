import { describe, it, expect } from 'vitest'
import { createSimState, stepSim, defaultSimConfig, SIM_DT } from '../game/assets/logic/sim'

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
})
