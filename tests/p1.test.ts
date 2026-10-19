import { describe, expect, it } from 'vitest'
import { finishRegularVisit, nextRegularVisit, newRegularMemory, parseRegularMemory, REGULAR, regularLines } from '../game/assets/logic/regular'
import { newProgress, parseProgress, serializeProgress } from '../game/assets/logic/progress'
import { dayRecap, serviceReason, verdictReason, witnessResponse } from '../game/assets/logic/recap'
import type { RecapInput } from '../game/assets/logic/recap'
import { judge } from '../game/assets/logic/order'
import { createShift, settleServe, shiftResult, stepShift } from '../game/assets/logic/shift'
import { customerCardIndex } from '../game/assets/logic/reviews'
import { gameplayShiftConfig } from '../game/assets/logic/gameplay'
import { CARD_LINES } from '../game/assets/scripts/cardLines'

describe('P1 recurring diner', () => {
  it('uses the requested playful tone in a food-focused regular visit', () => {
    const visit = nextRegularVisit(newRegularMemory(), 1)!
    const lines = regularLines(visit)
    expect(lines.greet).toMatch(/规矩立住.*不烧心/)
    expect(REGULAR.identity).toBe('阿星')
    expect(REGULAR.chapters.map(c => c.title)).toEqual(['第一次来', '又见面了', '老位置见'])
  })
  it('starts chapter one in an existing late-game save without skipping chapters', () => {
    const p = parseProgress('{"v":3,"day":20,"best":[3],"coins":351,"owned":["fryer"]}')
    expect(nextRegularVisit(p.regular, p.day)).toEqual({ chapter: 1, day: 20, previous: null })
    expect(p.coins).toBe(351); expect(p.owned).toEqual(['fryer'])
  })
  it('advances once at closing, recalls the actual outcome, and ends after three separate days', () => {
    let p = newProgress()
    for (let day = 1; day <= 3; day++) {
      const visit = nextRegularVisit(p.regular, day)!
      expect(visit.chapter).toBe(day)
      if (day === 2) expect(regularLines(visit).greet).toContain('上回没吃痛快')
      if (day === 3) expect(regularLines(visit).greet).toContain('上回吃得挺好')
      expect(finishRegularVisit(p.regular, visit, day === 1 ? 'bad' : 'good')).toBe(true)
      expect(finishRegularVisit(p.regular, visit, 'good')).toBe(false)
      expect(nextRegularVisit(p.regular, day)).toBeNull()
      expect(nextRegularVisit(p.regular, day - 1)).toBeNull()
      p = parseProgress(serializeProgress(p))
      expect(p.regular.chapter).toBe(day)
    }
    expect(nextRegularVisit(p.regular, 100)).toBeNull()
  })
  it('rest, unfinished visits and abandoned shifts do not advance a chapter', () => {
    const memory = newRegularMemory(), visit = nextRegularVisit(memory, 1)!
    expect(finishRegularVisit(memory, null, 'good')).toBe(false)
    expect(finishRegularVisit(memory, visit, null)).toBe(false)
    expect(memory).toEqual(newRegularMemory())
    expect(nextRegularVisit(memory, 1)).toEqual(visit)
    expect(finishRegularVisit(memory, { chapter: 2, day: 2, previous: null }, 'good')).toBe(false)
  })
  it.each([null, {}, { chapter: 4, lastDay: 5, outcome: 'good' }, { chapter: 2, lastDay: 1, outcome: 'bad' }, { chapter: 1, lastDay: 1, outcome: 'invented' }, { chapter: 1.5, lastDay: 2, outcome: 'good' }])('repairs malformed story memory in isolation: %j', regular => {
    const p = newProgress(); p.coins = 80
    const loaded = parseProgress(JSON.stringify({ ...JSON.parse(serializeProgress(p)), regular }))
    expect(loaded.regular).toEqual(newRegularMemory()); expect(loaded.coins).toBe(80)
    expect(parseRegularMemory(regular)).toEqual(newRegularMemory())
  })
  it('reuses an existing identity without changing the rolled orders, timings, seed or normal card rotation', () => {
    expect(CARD_LINES[REGULAR.cardIndex]!.identity).toBe('阿星')
    const p = newProgress(), cfg = gameplayShiftConfig(1, 1234, p, { arrivalSec: 30, arrivalJitter: .2, customersPerShift: 10, patienceScale: 1, lateLeaveSec: 60, orderPatienceSec: 30, walkInSec: 2 })
    const run = (withStory: boolean) => {
      const st = createShift(cfg), specs = [], times = []
      const visit = nextRegularVisit(p.regular, 1)!
      for (let i = 0; i < 10000 && !st.over; i++) {
        if (withStory) { regularLines(visit); witnessResponse('burnt', 0); customerCardIndex(2, 1, cfg.customers, 50) }
        stepShift(st, .1)
        for (const c of st.flow.customers) if (c.active) {
          c.ordered = true
          specs.push(JSON.parse(JSON.stringify(c.spec))); times.push(st.t)
          settleServe(st, c, { ok: true, missing: [], forbidden: [], cookOk: true })
        }
      }
      return { specs, times, rng: st.rng, result: shiftResult(st) }
    }
    const baseline = run(false)
    expect(baseline.specs).toHaveLength(cfg.customers)
    expect(run(true)).toEqual(baseline)
  })
})

const empty = (): RecapInput => ({ shift: { arrived: 4, served: 4, wrong: 0, lateServed: 0, timedOut: 0, walkedOut: 0, leftLate: 0, provoked: 0, goodRate: 1 }, wrongDelivery: 0, lateDelivery: 0, burnt: 0, broken: 0, stained: 0, vents: 0, wrongDetail: '' })

describe('P1 factual reviews and closing recap', () => {
  it('explains all real verdict failures including a missing second patty', () => {
    const v = judge({ ingredients: ['bun', 'patty', 'onion'], cook: 'rare' }, { required: ['bun', 'patty', 'cheese'], banned: ['onion'], doneness: 'well', patience: 30, double: true })
    expect(verdictReason(v)).toBe('缺芝士、肉饼；放了忌口洋葱；肉饼熟度不符')
    expect(serviceReason(false, true, 0, v)).toBe(verdictReason(v))
    expect(serviceReason(true, true, 0)).toContain('免单')
    expect(serviceReason(true, false, .1)).toContain('3 星')
    expect(serviceReason(true, false, .4)).toContain('4 星')
    expect(serviceReason(true, false, .8)).toContain('及时送齐')
  })
  it('uses actual wrong-order counts and the recorded detail, then suggests a specific change', () => {
    const s = empty(); s.shift.wrong = 2; s.wrongDelivery = 1; s.wrongDetail = '缺芝士'
    expect(dayRecap(s)).toEqual({ evidence: '错单 3 单', action: '最近一单：缺芝士。\n明天先核对配料、忌口与熟度；双肉要检查两块。' })
  })
  it.each([
    ['walkedOut', '未接单', '先去接单'], ['timedOut', '堂食等餐超时', '耐心最少'], ['provoked', '被怼走', '先不回嘴'],
  ] as const)('ties %s to its observed outcome', (key, evidence, action) => {
    const s = empty(); s.shift[key] = 2
    expect(dayRecap(s).evidence).toContain(evidence); expect(dayRecap(s).action).toContain(action)
  })
  it.each([
    ['burnt', '烤糊', '变色'], ['broken', '摔碎', '转弯'], ['stained', '脏盘', '刷洗'], ['vents', '发泄', '耐心'], ['lateDelivery', '外卖超时 2', '外卖'],
  ] as const)('offers a recovery action for %s', (key, evidence, action) => {
    const s = empty(); s[key] = 2
    expect(dayRecap(s).evidence).toContain(evidence); expect(dayRecap(s).action).toContain(action)
  })
  it('selects the most frequent observed category, keeps deterministic ties and makes no invented quiet-day claims', () => {
    const s = empty(); s.shift.wrong = 1; s.burnt = 3
    expect(dayRecap(s).evidence).toContain('烤糊')
    s.shift.wrong = 3
    expect(dayRecap(s).evidence).toContain('错单')
    expect(dayRecap(empty()).evidence).toBe('准时正确完成 4/4 位堂食')
    s.shift.arrived = 0; s.shift.served = 0; s.shift.wrong = 0; s.burnt = 0
    expect(dayRecap(s).evidence).toBe('本局没有堂食接待记录')
  })
  it.each([['burnt', /糊|焦|黑/], ['stained', /盘/], ['crash', /盘/], ['vent', /厨师|发火/]] as const)('matches %s to five authored voices and a factual fallback', (kind, anchor) => {
    const voices = Array.from({ length: 5 }, (_, i) => witnessResponse(kind, i))
    expect(new Set(voices).size).toBe(5)
    for (const line of [...voices, witnessResponse(kind, 49)]) expect(line).toMatch(anchor)
    expect(witnessResponse(kind, 49)).not.toContain('（')
  })
})
