import { describe, expect, it } from 'vitest'
import { createKitchen, discard, interact, stepKitchen } from '../game/assets/logic/kitchen'
import { DEFAULT_COOK } from '../game/assets/logic/recipe'
import type { Customer } from '../game/assets/logic/customer'
import type { OrderSpec, Station, StationKind } from '../game/assets/logic/types'
import { FirstOrderGuide, GUIDE_STORAGE_KEY, type GuideFrame } from '../game/assets/scripts/ui/FirstOrderGuide'
import { actionPresentation, inventoryPresentation, orderPresentation, guideLayout, overlaps } from '../game/assets/scripts/ui/UiModel'

const spec: OrderSpec = { required: ['bun', 'patty', 'cheese'], banned: ['onion'], doneness: 'medium', patience: 60 }
function setup(saved?: string) {
  const data = new Map<string, string>(saved ? [[GUIDE_STORAGE_KEY, saved]] : [])
  const guide = new FirstOrderGuide({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) } })
  const kinds: StationKind[] = ['register', 'fridge', 'grill', 'assembly', 'serve', 'sink', 'shelf']
  const stations: Station[] = kinds.map(kind => ({ id: kind, kind, pos: { x: 0, z: 0 }, box: { center: { x: 0, z: 0 }, halfX: .5, halfZ: .5 }, triggerRange: 1 }))
  const kitchen = createKitchen({ stations, cook: { ...DEFAULT_COOK }, grillSlots: 2, fridgeCap: 6, plates: 6, doublePatty: true })
  const customer = { active: true, ordered: true, id: 7, spec: structuredClone(spec), friesDue: false, drinkDue: false, burgerVerdict: null } as Customer
  const frame: GuideFrame = { kitchen, customers: [], near: null, phase: 'closed', run: 1 }
  const act = (kind: StationKind, ingredient?: 'patty' | 'bun' | 'cheese' | 'onion') => interact(kitchen, { x: 0, z: 0 }, stations.find(s => s.kind === kind)!, { ingredient, spec: customer.spec })
  const accept = () => { frame.near = 'register'; guide.observe(frame); frame.phase = 'open'; frame.customers = [customer]; return guide.observe(frame) }
  return { guide, frame, kitchen, customer, data, act, accept }
}

describe('first-order guide follows the real kitchen', () => {
  it('waits for arrival and an accepted order, regardless of elapsed time', () => {
    const s = setup()
    expect(s.guide.observe(s.frame).step).toBe('move')
    stepKitchen(s.kitchen, 200)
    expect(s.guide.observe(s.frame).step).toBe('move')
    s.frame.near = 'register'
    expect(s.guide.observe(s.frame).step).toBe('accept')
    s.frame.phase = 'open'
    s.frame.customers = [{ ...s.customer, ordered: false }]
    expect(s.guide.observe(s.frame).step).toBe('accept')
    expect(s.accept().step).toBe('ingredients')
  })

  it('completes a real burger without mutating gameplay and requires confirmed delivery', () => {
    const s = setup(); s.accept()
    s.act('fridge', 'patty')
    expect(s.guide.observe(s.frame).step).toBe('cook')
    s.act('grill')
    expect(s.guide.observe(s.frame).gesture).toBe('wait')
    stepKitchen(s.kitchen, DEFAULT_COOK.mediumAt)
    expect(s.guide.observe(s.frame).gesture).toBe('tap')
    s.act('grill')
    expect(s.guide.observe(s.frame).step).toBe('assemble')
    s.act('assembly')
    for (const ing of ['bun', 'cheese'] as const) { s.act('fridge', ing); s.act('assembly') }
    expect(s.guide.observe(s.frame).step).toBe('assemble')
    s.act('assembly')
    expect(s.guide.observe(s.frame).step).toBe('deliver')
    const before = JSON.stringify(s.kitchen)
    s.guide.observe(s.frame)
    expect(JSON.stringify(s.kitchen)).toBe(before)
    const result = s.act('serve')
    expect(result.verdict?.ok).toBe(true)
    expect(s.guide.status).toBe('active')
    s.guide.delivered({ run: 1, orderId: 7, ok: true, complete: true })
    expect(s.guide.status).toBe('done')
    expect(s.data.get(GUIDE_STORAGE_KEY)).toBe('done')
  })

  it('recovers after discard and never treats a blocked pick or time passing as success', () => {
    const s = setup(); s.accept()
    s.kitchen.stock[1] = 0
    expect(s.act('fridge', 'patty').kind).toBe('blocked')
    expect(s.guide.observe(s.frame).target).toBe('storeroom')
    s.kitchen.stock[1] = 6
    s.act('fridge', 'patty'); discard(s.kitchen)
    expect(s.guide.observe(s.frame).step).toBe('ingredients')
  })

  it('warns about burnt or wrong doneness instead of moving on to assembly', () => {
    const s = setup(); s.accept(); s.act('fridge', 'patty'); s.act('grill')
    stepKitchen(s.kitchen, DEFAULT_COOK.burntAt)
    expect(s.guide.observe(s.frame).detail).toContain('丢弃')
    s.act('grill')
    expect(s.guide.observe(s.frame).gesture).toBe('hold')
  })

  it('recovers when the tracked diner leaves and ignores stale or wrong delivery events', () => {
    const s = setup(); s.accept()
    for (const event of [{ run: 1, orderId: 8, ok: true, complete: true }, { run: 0, orderId: 7, ok: true, complete: true }, { run: 1, orderId: 7, ok: false, complete: true }]) s.guide.delivered(event)
    expect(s.guide.status).toBe('active')
    s.customer.active = false
    expect(s.guide.observe(s.frame).step).toBe('accept')
    expect(s.guide.status).toBe('active')
  })

  it('requires sides to be delivered too', () => {
    const s = setup(); s.customer.spec.fries = true; s.customer.friesDue = true; s.accept()
    s.guide.delivered({ run: 1, orderId: 7, ok: true, complete: false })
    expect(s.guide.status).toBe('active')
    s.customer.burgerVerdict = { ok: true, missing: [], forbidden: [], cookOk: true }
    expect(s.guide.observe(s.frame).target).toBe('fryer')
    s.kitchen.carry.kind = 'fries'
    expect(s.guide.observe(s.frame).target).toBe('serve')
  })

  it('skips persistently, replays, and resets ephemeral progress on a new run', () => {
    const s = setup(); s.accept(); s.guide.skip()
    expect(s.guide.status).toBe('skipped')
    expect(new FirstOrderGuide({ getItem: k => s.data.get(k) ?? null, setItem: () => {} }).status).toBe('skipped')
    s.guide.replay(); expect(s.guide.status).toBe('active')
    s.frame.run = 2; s.frame.near = null; s.frame.phase = 'closed'; s.frame.customers = []
    expect(s.guide.observe(s.frame).step).toBe('move')
    s.guide.delivered({ run: 1, orderId: 7, ok: true, complete: true })
    expect(s.guide.status).toBe('active')
  })

  it('keeps completed guides closed across restarts and tolerates corrupt or unavailable storage', () => {
    expect(setup('done').guide.status).toBe('done')
    expect(setup('{bad json').guide.status).toBe('active')
    const g = new FirstOrderGuide({ getItem: () => { throw Error('denied') }, setItem: () => { throw Error('full') } })
    expect(() => g.skip()).not.toThrow()
    g.replay(); expect(g.status).toBe('active')
  })

  it('uses the actual order, including bans and double patties', () => {
    const s = setup(); s.customer.spec.double = true; s.accept()
    s.kitchen.burger.ingredients = ['bun', 'patty', 'cheese']; s.kitchen.burger.cook = 'medium'; s.kitchen.assemblyOccupied = true
    expect(s.guide.observe(s.frame).step).toBe('ingredients')
    expect(s.guide.observe(s.frame).detail).toContain('肉饼')
    s.kitchen.burger.double = true; s.kitchen.burger.cook2 = 'medium'; s.kitchen.burger.ingredients.push('onion')
    expect(s.guide.observe(s.frame).detail).toContain('丢弃')
  })

  it('routes to the correct real plate recovery stage and can deliver sides before the burger', () => {
    const s = setup(); s.accept(); s.act('fridge', 'patty'); s.act('grill'); s.kitchen.plates = 0
    s.kitchen.rack.ready = 1
    expect(s.guide.observe(s.frame).target).toBe('rack')
    s.kitchen.rack.ready = 0; s.kitchen.sink.stage = 'soaked'
    expect(s.guide.observe(s.frame).gesture).toBe('hold')
    s.kitchen.sink.stage = 'soaking'
    expect(s.guide.observe(s.frame).gesture).toBe('wait')
    s.kitchen.carry.kind = 'fries'
    expect(s.guide.observe(s.frame).target).toBe('serve')
  })

  it('recovers when held ingredients duplicate the bench or violate the order', () => {
    const s = setup(); s.accept(); s.act('fridge', 'bun'); s.act('assembly'); s.act('fridge', 'bun')
    expect(s.act('assembly').reason).toBe('duplicate-ingredient')
    expect(s.guide.observe(s.frame).gesture).toBe('hold')
    expect(s.guide.observe(s.frame).control).toBe('discard')
    discard(s.kitchen); s.act('fridge', 'onion')
    expect(s.guide.observe(s.frame).detail).toContain('忌口')
    expect(s.guide.observe(s.frame).gesture).toBe('hold')
  })

  it('does not tell the player to place a third cooked patty on a full burger', () => {
    const s = setup(); s.accept()
    for (let i = 0; i < 2; i++) { s.act('fridge', 'patty'); s.act('grill'); stepKitchen(s.kitchen, DEFAULT_COOK.mediumAt); s.act('grill'); s.act('assembly') }
    s.act('fridge', 'patty'); s.act('grill'); stepKitchen(s.kitchen, DEFAULT_COOK.mediumAt); s.act('grill')
    expect(s.act('assembly').reason).toBe('duplicate-ingredient')
    expect(s.guide.observe(s.frame).gesture).toBe('hold')
  })

  it('frees hands before side machines and avoids trying to put meat on a full grill', () => {
    const s = setup(); s.accept()
    for (let i = 0; i < 2; i++) { s.act('fridge', 'patty'); s.act('grill') }
    s.act('fridge', 'patty')
    expect(s.act('grill').reason).toBe('grill-full')
    expect(s.guide.observe(s.frame).gesture).toBe('hold')
    s.customer.burgerVerdict = { ok: true, missing: [], forbidden: [], cookOk: true }; s.customer.friesDue = true
    expect(s.guide.observe(s.frame).detail).toContain('空出双手')
    expect(s.guide.observe(s.frame).gesture).toBe('hold')
  })
})

describe('UI meaning and safe landscape layout', () => {
  it.each([['取料', '冰箱', 'tap'], ['按住刷', '洗碗池', 'hold'], ['泡着', '洗碗池', 'wait'], ['长按怼', '前台', 'hold'], ['', '附近无工位', 'move']])('separates target and gesture for %s', (verb, target, gesture) => {
    const p = actionPresentation(verb)
    expect(p.target).toBe(target); expect(p.gesture).toBe(gesture)
  })
  it('never invents the target for ambiguous legacy verbs', () => {
    expect(actionPresentation('放下').target).toBe('制作台')
    expect(actionPresentation('特殊动作').target).toBe('当前工位')
    expect(actionPresentation('取料', 'storeroom').target).toBe('冷库')
  })
  it('labels inventory amounts and stockouts explicitly', () => {
    expect(inventoryPresentation('cheese', 0, 6)).toMatchObject({ name: '芝士', count: '缺货', empty: true })
    expect(inventoryPresentation('bun', 4, 6).count).toBe('剩余 4 / 6')
    expect(inventoryPresentation('bun', Infinity, Infinity).count).toBe('库存充足')
  })
  it('keeps recipe, doneness and bans separate without changing required quantities', () => {
    const p = orderPresentation({ ...spec, double: true })
    expect(p.recipe).toContain('肉饼×2'); expect(p.cook).toBe('五分'); expect(p.banned).toBe('不要 洋葱')
    expect(spec.required).toEqual(['bun', 'patty', 'cheese'])
  })
  it.each([[1280, 960], [1280, 720], [1680, 720]])('fits %sx%s with separate controls and safe insets', (width, height) => {
    const layout = guideLayout(width, height, { left: 44, right: 50, bottom: 18, top: 0 })
    expect(layout.card.x).toBeGreaterThanOrEqual(-width / 2 + 44)
    expect(layout.card.y).toBeGreaterThanOrEqual(-height / 2 + 18)
    expect(layout.card.x + layout.card.w).toBeLessThanOrEqual(width / 2 - 50)
    expect(overlaps(layout.card, layout.leftControl)).toBe(false)
    expect(overlaps(layout.card, layout.rightControl)).toBe(false)
    expect(layout.skip.h).toBeGreaterThanOrEqual(64)
  })
  it('collapses when a key workstation occupies the guide card area', () => {
    const normal = guideLayout(1280, 720)
    const blocked = guideLayout(1280, 720, undefined, [normal.card])
    expect(blocked.collapsed).toBe(true)
    expect(overlaps(blocked.card, normal.card)).toBe(false)
  })
})
