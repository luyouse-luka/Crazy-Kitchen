import { describe, expect, it } from 'vitest'
import { createKitchen, FIRE_SEC, interact, stationInReach, stepKitchen } from '../game/assets/logic/kitchen'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'
import type { Station, StationKind } from '../game/assets/logic/types'

const at = (id: string, kind: StationKind, x: number): Station => ({
  id,
  kind,
  pos: { x, z: 0 },
  box: { center: { x, z: 0 }, halfX: 0.5, halfZ: 0.5 },
  triggerRange: 1.2,
})
const GRILL = at('g', 'grill', 0)
const FRIDGE = at('f', 'fridge', 5)
const EXT = at('e', 'extinguisher', 10)
const mk = (fireSec?: number) =>
  createKitchen({ stations: [GRILL, FRIDGE, EXT], cook: { ...DEFAULT_COOK }, grillSlots: 2, plates: 4, fireSec })

function burnOne(k: ReturnType<typeof mk>): void {
  interact(k, FRIDGE.pos, FRIDGE, { ingredient: 'patty' })
  expect(interact(k, GRILL.pos, GRILL).kind).toBe('place-patty')
  stepKitchen(k, DEFAULT_COOK.burntAt)
}

describe('烤炉起火', () => {
  it('烤糊的肉放着不管 FIRE_SEC 秒起火；起火后烤炉什么都做不了', () => {
    const k = mk(FIRE_SEC)
    burnOne(k)
    stepKitchen(k, FIRE_SEC - 0.1)
    expect(k.fire).toBe(false)
    stepKitchen(k, 0.2)
    expect(k.fire).toBe(true)
    expect(k.fires).toBe(1)
    expect(interact(k, GRILL.pos, GRILL).reason).toBe('on-fire')
    interact(k, FRIDGE.pos, FRIDGE, { ingredient: 'patty' })
    expect(interact(k, GRILL.pos, GRILL).reason).toBe('on-fire')
  })

  it('拿灭火器去灭：火灭了，烤炉上的肉全清掉，灭火器自动放回', () => {
    const k = mk(FIRE_SEC)
    burnOne(k)
    stepKitchen(k, FIRE_SEC + 1)
    expect(interact(k, EXT.pos, EXT).kind).toBe('take-extinguisher')
    expect(k.carry.kind).toBe('extinguisher')
    expect(interact(k, GRILL.pos, GRILL).kind).toBe('extinguish')
    expect(k.fire).toBe(false)
    expect(k.grill.every((g) => !g.busy)).toBe(true)
    expect(k.carry.kind).toBe('none')
    stepKitchen(k, 60)
    expect(k.fires).toBe(1)
  })

  it('没着火拿着灭火器点烤炉没用；再点灭火器挂回去；手上有东西拿不了', () => {
    const k = mk(FIRE_SEC)
    interact(k, EXT.pos, EXT)
    expect(interact(k, GRILL.pos, GRILL).reason).toBe('no-fire')
    expect(interact(k, EXT.pos, EXT).kind).toBe('return-extinguisher')
    interact(k, FRIDGE.pos, FRIDGE, { ingredient: 'patty' })
    expect(interact(k, EXT.pos, EXT).reason).toBe('hands-full')
  })

  it('不开起火（模拟器 / 老测试）：糊肉放多久都不着，灭火器工位不抢「最近」', () => {
    const k = mk()
    burnOne(k)
    stepKitchen(k, 600)
    expect(k.fire).toBe(false)
    expect(stationInReach(k, EXT.pos)).toBeNull()
    expect(interact(k, EXT.pos, EXT).reason).toBe('unsupported')
  })
})
