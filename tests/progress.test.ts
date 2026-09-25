import { describe, expect, it } from 'vitest'
import { bank, dayFlow, finishDay, newProgress, parseProgress, PASS_STARS, serializeProgress } from '../game/assets/logic/progress'
import { difficultyForDay, LAST_DAY } from '../game/assets/logic/difficulty'
import { newDecor } from '../game/assets/logic/decor'

describe('progress · 存档', () => {
  it('往返无损', () => {
    const p = { day: 4, best: [3, 2, 1], coins: 57, owned: ['fryer'], decor: { ...newDecor(), wall: 2 } }
    expect(parseProgress(serializeProgress(p))).toEqual(p)
  })

  it('v1 旧档照样读进来，金币从 0 开始', () => {
    expect(parseProgress('{"v":1,"day":3,"best":[3,2]}')).toEqual({ day: 3, best: [3, 2], coins: 0, owned: [], decor: newDecor() })
  })

  it('坏的金币字段归零，不连累整份存档', () => {
    expect(parseProgress('{"v":2,"day":3,"best":[],"coins":"lots"}')).toEqual({ day: 3, best: [], coins: 0, owned: [], decor: newDecor() })
    expect(parseProgress('{"v":2,"day":3,"best":[],"coins":-5}').coins).toBe(0)
  })

  it('没有 owned 的 v2 档读成空；owned 里的非字符串丢掉', () => {
    expect(parseProgress('{"v":2,"day":2,"best":[],"coins":9}').owned).toEqual([])
    expect(parseProgress('{"v":2,"day":2,"best":[],"coins":9,"owned":["fryer",3,null]}').owned).toEqual(['fryer'])
  })

  it.each([null, '', '{', 'null', '[]', '{"v":0,"day":3,"best":[]}', '{"v":3,"day":3,"best":[]}', '{"v":1,"day":"3","best":[]}', '{"v":1,"day":2}'])(
    '坏档 %s 退回新档',
    (raw) => expect(parseProgress(raw)).toEqual(newProgress()),
  )

  it('星数被夹回 0–3，天数不设上限但至少是 1', () => {
    const p = parseProgress(JSON.stringify({ v: 1, day: 99, best: [7, -1, 'x', 2] }))
    expect(p.day).toBe(99)
    expect(p.best).toEqual([3, 0, 0, 2])
    expect(parseProgress(JSON.stringify({ v: 1, day: -3, best: [] })).day).toBe(1)
  })
})

describe('progress · 推进', () => {
  it(`${PASS_STARS} 星过线解锁下一天，没过线停在原地`, () => {
    const p = newProgress()
    expect(finishDay(p, 1, 0)).toBe(false)
    expect(p.day).toBe(1)
    expect(finishDay(p, 1, PASS_STARS)).toBe(true)
    expect(p.day).toBe(2)
  })

  it('重打旧的一天只刷新最好成绩，不会把进度往回拉', () => {
    const p = { day: 5, best: [1, 1, 1, 1], coins: 0, owned: [], decor: newDecor() }
    finishDay(p, 2, 3)
    expect(p.day).toBe(5)
    expect(p.best[1]).toBe(3)
    finishDay(p, 2, 0)
    expect(p.best[1]).toBe(3)
  })

  it('难度表的最后一天之后照样往下打，客流停在最难那档', () => {
    const p = { day: LAST_DAY, best: [], coins: 0, owned: [], decor: newDecor() }
    expect(finishDay(p, LAST_DAY, 3)).toBe(true)
    expect(p.day).toBe(LAST_DAY + 1)
    expect(dayFlow(LAST_DAY + 30, 30)).toEqual(dayFlow(LAST_DAY, 30))
  })
})

describe('progress · 每天的客流', () => {
  it('第 1 天就是传进来的真人间隔，之后按难度表同比例收紧', () => {
    expect(dayFlow(1, 30).flow.intervalSec).toBeCloseTo(30)
    const k = difficultyForDay(10).flow.intervalSec / difficultyForDay(1).flow.intervalSec
    expect(dayFlow(10, 30).flow.intervalSec).toBeCloseTo(30 * k)
    expect(dayFlow(10, 30).flow.maxConcurrent).toBe(difficultyForDay(10).flow.maxConcurrent)
  })
})

describe('progress · 金币', () => {
  it('当天收入存进去，没过线也照存；负数和小数不会弄坏余额', () => {
    const p = newProgress()
    bank(p, 37)
    finishDay(p, 1, 0)
    bank(p, 12.9)
    bank(p, -40)
    expect(p.coins).toBe(49)
  })
})
