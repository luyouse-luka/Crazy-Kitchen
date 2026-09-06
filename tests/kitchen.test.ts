import { describe, it, expect } from 'vitest'
import {
  createKitchen,
  stepKitchen,
  interact,
  discard,
  stationInReach,
  grillCookLevel,
} from '../game/assets/logic/kitchen'
import type { KitchenConfig, KitchenState } from '../game/assets/logic/kitchen'
import type { OrderSpec, Station, StationKind } from '../game/assets/logic/types'
import type { Vec2 } from '../game/assets/logic/vec2'

// 与 sim.ts 的 defaultSimConfig 保持同一组数值 —— 两边规则同源，参数也别岔开
const COOK = { rareAt: 3, mediumAt: 6, wellAt: 9, burntAt: 13 }

const station = (id: string, kind: StationKind, x: number, z: number): Station => ({
  id,
  kind,
  pos: { x, z },
  box: { center: { x, z }, halfX: 0.5, halfZ: 0.5 },
  triggerRange: 1.5,
})

const FRIDGE = station('Station_Fridge', 'fridge', -3, 2)
const GRILL = station('Station_Grill', 'grill', 0, 2)
const ASSEMBLY = station('Station_Assembly', 'assembly', 3, 2)
const SERVE = station('Station_Serve', 'serve', 3, -2)

const config = (grillSlots = 2): KitchenConfig => ({
  stations: [FRIDGE, GRILL, ASSEMBLY, SERVE],
  cook: COOK,
  grillSlots,
})

const mk = (grillSlots = 2) => createKitchen(config(grillSlots))

/** 站到工位上，省得每个用例都写坐标 */
const at = (s: Station): Vec2 => ({ x: s.pos.x, z: s.pos.z })

const take = (st: KitchenState, ing: OrderSpec['required'][number]) =>
  interact(st, at(FRIDGE), FRIDGE, { ingredient: ing })

const put = (st: KitchenState) => interact(st, at(ASSEMBLY), ASSEMBLY)

const SPEC: OrderSpec = {
  required: ['bun', 'patty', 'cheese'],
  banned: ['onion'],
  doneness: 'medium',
  patience: 45,
}

describe('触发范围', () => {
  it('够不着就什么都不发生', () => {
    const st = mk()
    const far = { x: 99, z: 99 }
    const r = interact(st, far, FRIDGE, { ingredient: 'bun' })
    expect(r.kind).toBe('blocked')
    expect(r.reason).toBe('out-of-range')
    expect(st.carry.kind).toBe('none')
  })

  it('边界上算够得着（与碰撞的严格不等号相反）', () => {
    const st = mk()
    const edge = { x: FRIDGE.pos.x + FRIDGE.triggerRange, z: FRIDGE.pos.z }
    expect(interact(st, edge, FRIDGE, { ingredient: 'bun' }).kind).toBe('take-ingredient')
  })

  it('stationInReach 取最近的那个，都够不着返回 null', () => {
    const st = mk()
    expect(stationInReach(st, { x: 99, z: 99 })).toBeNull()
    // 站在冰箱与烤炉之间，偏冰箱一侧
    expect(stationInReach(st, { x: -2, z: 2 })!.id).toBe('Station_Fridge')
    expect(stationInReach(st, { x: -0.2, z: 2 })!.id).toBe('Station_Grill')
  })
})

describe('手持：同时只能拿一样', () => {
  it('手上有东西时冰箱不给第二样', () => {
    const st = mk()
    expect(take(st, 'bun').kind).toBe('take-ingredient')
    const r = take(st, 'cheese')
    expect(r.reason).toBe('hands-full')
    expect(st.carry.ingredient).toBe('bun')
  })

  it('从冰箱拿的生肉也是 patty，cook 为 raw', () => {
    const st = mk()
    take(st, 'patty')
    expect(st.carry.kind).toBe('patty')
    expect(st.carry.cook).toBe('raw')
  })

  it('丢弃后手空了', () => {
    const st = mk()
    take(st, 'onion')
    expect(discard(st).kind).toBe('discard')
    expect(st.carry.kind).toBe('none')
    expect(discard(st).reason).toBe('hands-empty')
  })
})

describe('烤炉', () => {
  it('生肉放上去开始计时，火候按窗口推进', () => {
    const st = mk()
    take(st, 'patty')
    const r = interact(st, at(GRILL), GRILL)
    expect(r.kind).toBe('place-patty')
    expect(r.slot).toBe(0)
    expect(st.carry.kind).toBe('none')

    expect(grillCookLevel(st, 0)).toBe('raw')
    stepKitchen(st, 3)
    expect(grillCookLevel(st, 0)).toBe('rare')
    stepKitchen(st, 3)
    expect(grillCookLevel(st, 0)).toBe('medium')
    stepKitchen(st, 3)
    expect(grillCookLevel(st, 0)).toBe('well')
    stepKitchen(st, 4)
    expect(grillCookLevel(st, 0)).toBe('burnt')
  })

  it('取回来的肉带着当时的火候', () => {
    const st = mk()
    take(st, 'patty')
    interact(st, at(GRILL), GRILL)
    stepKitchen(st, 6.5)
    const r = interact(st, at(GRILL), GRILL)
    expect(r.kind).toBe('take-patty')
    expect(st.carry.kind).toBe('patty')
    expect(st.carry.cook).toBe('medium')
    expect(st.grill[0]!.busy).toBe(false)
  })

  it('⚠ 烤糊的肉留在炉上，不像 sim.ts 那样自动消失', () => {
    const st = mk()
    take(st, 'patty')
    interact(st, at(GRILL), GRILL)
    stepKitchen(st, 20)
    expect(st.grill[0]!.busy).toBe(true)
    expect(grillCookLevel(st, 0)).toBe('burnt')
    // 玩家得自己走过去端下来再扔掉
    interact(st, at(GRILL), GRILL)
    expect(st.carry.cook).toBe('burnt')
    expect(st.grill[0]!.busy).toBe(false)
  })

  it('烤位满了放不下', () => {
    const st = mk(1)
    take(st, 'patty')
    interact(st, at(GRILL), GRILL)
    take(st, 'patty')
    const r = interact(st, at(GRILL), GRILL)
    expect(r.reason).toBe('grill-full')
    expect(st.carry.kind).toBe('patty') // 肉还在手上
  })

  it('空炉子空手，取不出东西', () => {
    const st = mk()
    expect(interact(st, at(GRILL), GRILL).reason).toBe('grill-empty')
  })

  it('不指定烤位时取烤最久的那块', () => {
    const st = mk(2)
    take(st, 'patty')
    interact(st, at(GRILL), GRILL) // slot 0
    stepKitchen(st, 4)
    take(st, 'patty')
    interact(st, at(GRILL), GRILL) // slot 1
    stepKitchen(st, 2)
    const r = interact(st, at(GRILL), GRILL)
    expect(r.slot).toBe(0)
    expect(st.carry.cook).toBe('medium') // slot 0 已 6 秒
  })

  it('烤过的肉不能回炉', () => {
    const st = mk()
    take(st, 'patty')
    interact(st, at(GRILL), GRILL)
    stepKitchen(st, 6)
    interact(st, at(GRILL), GRILL) // 取回，medium
    const r = interact(st, at(GRILL), GRILL)
    expect(r.reason).toBe('not-raw-patty')
  })

  it('拿着配料时烤炉不收', () => {
    const st = mk()
    take(st, 'cheese')
    expect(interact(st, at(GRILL), GRILL).reason).toBe('hands-full')
  })
})

describe('组装台', () => {
  it('放第一样就开一个新汉堡', () => {
    const st = mk()
    take(st, 'bun')
    expect(put(st).kind).toBe('add-to-burger')
    expect(st.assemblyOccupied).toBe(true)
    expect(st.burger.ingredients).toEqual(['bun'])
    expect(st.carry.kind).toBe('none')
  })

  it('同一样加两次会被挡下，且东西还在手上', () => {
    const st = mk()
    take(st, 'bun')
    put(st)
    take(st, 'bun')
    const r = put(st)
    expect(r.reason).toBe('duplicate-ingredient')
    expect(st.carry.kind).toBe('ingredient')
    expect(st.burger.ingredients).toEqual(['bun'])
  })

  it('生肉也能直接夹进去 —— 做得出来，判定会失败', () => {
    const st = mk()
    take(st, 'patty')
    put(st)
    expect(st.burger.cook).toBe('raw')
  })

  it('空手在空台子上取不到盘子', () => {
    const st = mk()
    expect(put(st).reason).toBe('no-burger')
  })

  it('端起来再放回去，汉堡内容不变', () => {
    const st = mk()
    take(st, 'bun')
    put(st)
    expect(put(st).kind).toBe('pick-plate')
    expect(st.carry.kind).toBe('plate')
    expect(st.assemblyOccupied).toBe(false)

    expect(put(st).kind).toBe('put-plate')
    expect(st.assemblyOccupied).toBe(true)
    expect(st.burger.ingredients).toEqual(['bun'])
  })

  it('不变量：汉堡不可能同时在手上和台上', () => {
    const st = mk()
    take(st, 'bun')
    put(st)
    put(st) // 端起
    // 手上端着盘子时台子是空的，此时不该能再开一个新汉堡
    expect(st.assemblyOccupied).toBe(false)
    expect(st.carry.kind).toBe('plate')
  })
})

describe('出餐', () => {
  const buildCorrect = (st: KitchenState): void => {
    take(st, 'bun')
    put(st)
    take(st, 'cheese')
    put(st)
    take(st, 'patty')
    interact(st, at(GRILL), GRILL)
    stepKitchen(st, 6.5)
    interact(st, at(GRILL), GRILL)
    put(st)
    put(st) // 端起
  }

  it('做对了 verdict.ok', () => {
    const st = mk()
    buildCorrect(st)
    const r = interact(st, at(SERVE), SERVE, { spec: SPEC })
    expect(r.kind).toBe('serve')
    expect(r.verdict!.ok).toBe(true)
  })

  it('送完手空了、台子空了，下一单从头开始', () => {
    const st = mk()
    buildCorrect(st)
    interact(st, at(SERVE), SERVE, { spec: SPEC })
    expect(st.carry.kind).toBe('none')
    expect(st.assemblyOccupied).toBe(false)
    expect(st.burger.ingredients).toEqual([])
    expect(st.burger.cook).toBeNull()
  })

  it('火候不对照样送得出去，只是判定失败', () => {
    const st = mk()
    take(st, 'bun')
    put(st)
    take(st, 'cheese')
    put(st)
    take(st, 'patty')
    interact(st, at(GRILL), GRILL)
    stepKitchen(st, 10) // well，顾客要 medium
    interact(st, at(GRILL), GRILL)
    put(st)
    put(st)
    const r = interact(st, at(SERVE), SERVE, { spec: SPEC })
    expect(r.verdict!.ok).toBe(false)
    expect(r.verdict!.cookOk).toBe(false)
  })

  it('放了 banned 的东西会被逐项报出来', () => {
    const st = mk()
    take(st, 'onion')
    put(st)
    take(st, 'bun')
    put(st)
    take(st, 'patty')
    interact(st, at(GRILL), GRILL)
    stepKitchen(st, 6.5)
    interact(st, at(GRILL), GRILL)
    put(st)
    put(st)
    const r = interact(st, at(SERVE), SERVE, { spec: SPEC })
    expect(r.verdict!.forbidden).toEqual(['onion'])
    expect(r.verdict!.missing).toEqual(['cheese'])
  })

  it('缺骨架的半成品交不出去 —— 拦在出餐口，不算一次失败', () => {
    const st = mk()
    take(st, 'cheese')
    put(st)
    put(st) // 端起，只有芝士
    const r = interact(st, at(SERVE), SERVE, { spec: SPEC })
    expect(r.reason).toBe('incomplete-burger')
    expect(st.carry.kind).toBe('plate') // 还端在手上
  })

  it('空手到出餐口没反应', () => {
    const st = mk()
    expect(interact(st, at(SERVE), SERVE, { spec: SPEC }).reason).toBe('hands-empty')
  })

  it('没有订单时不判定', () => {
    const st = mk()
    take(st, 'bun')
    put(st)
    put(st)
    expect(interact(st, at(SERVE), SERVE).reason).toBe('no-order')
  })

  it('端着盘子丢弃会连汉堡一起清空', () => {
    const st = mk()
    take(st, 'bun')
    put(st)
    put(st)
    discard(st)
    expect(st.carry.kind).toBe('none')
    expect(st.burger.ingredients).toEqual([])
  })
})

describe('一整条链路', () => {
  it('取 → 烤 → 装 → 端 → 送，30 秒内跑得完', () => {
    const st = mk()
    take(st, 'bun')
    put(st)
    take(st, 'patty')
    interact(st, at(GRILL), GRILL)
    stepKitchen(st, 6.5)
    interact(st, at(GRILL), GRILL)
    put(st)
    take(st, 'cheese')
    put(st)
    put(st)
    const r = interact(st, at(SERVE), SERVE, { spec: SPEC })
    expect(r.verdict!.ok).toBe(true)
    expect(st.t).toBeLessThan(30)
  })
})
