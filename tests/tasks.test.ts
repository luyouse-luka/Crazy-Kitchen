import { describe, expect, it } from 'vitest'
import { ALL_DONE_BONUS, DAILY_TASKS, rollTasks, TASK_REWARD, taskReward, taskStatus } from '../game/assets/logic/tasks'
import type { DayStats, Task } from '../game/assets/logic/tasks'

const ZERO: DayStats = { good: 0, wrong: 0, burnt: 0, broken: 0, delivered: 0, income: 0, fries: 0 }

describe('每日任务', () => {
  it('每天三条、互不重复；同一天每次抽到的一样', () => {
    for (let day = 1; day <= 60; day++) {
      const a = rollTasks(day, 10, true)
      expect(a).toHaveLength(DAILY_TASKS)
      expect(new Set(a.map((t) => t.id)).size).toBe(DAILY_TASKS)
      expect(rollTasks(day, 10, true)).toEqual(a)
    }
  })

  it('没买炸锅抽不到薯条任务；买了能抽到', () => {
    const days = Array.from({ length: 200 }, (_, i) => i + 1)
    expect(days.some((d) => rollTasks(d, 10, false).some((t) => t.id === 'fries'))).toBe(false)
    expect(days.some((d) => rollTasks(d, 10, true).some((t) => t.id === 'fries'))).toBe(true)
  })

  it('不同天抽到的不全一样（不是每天同一套）', () => {
    const sets = new Set(Array.from({ length: 30 }, (_, i) => rollTasks(i + 1, 10, false).map((t) => t.id).sort().join()))
    expect(sets.size).toBeGreaterThan(3)
  })

  it('「做到 N」：够了当场完成；打烊还不够算失败', () => {
    const t: Task = { id: 'good', target: 6 }
    expect(taskStatus(t, { ...ZERO, good: 5 }, false)).toBe('open')
    expect(taskStatus(t, { ...ZERO, good: 6 }, false)).toBe('done')
    expect(taskStatus(t, { ...ZERO, good: 5 }, true)).toBe('failed')
  })

  it('「一次都不」：犯一次当场失败；撑到打烊才算完成', () => {
    const t: Task = { id: 'no-broken', target: 0 }
    expect(taskStatus(t, ZERO, false)).toBe('open')
    expect(taskStatus(t, { ...ZERO, broken: 1 }, false)).toBe('failed')
    expect(taskStatus(t, ZERO, true)).toBe('done')
  })

  it('奖励：每条 TASK_REWARD，三条全完成再加 ALL_DONE_BONUS；失败不扣钱', () => {
    expect(taskReward(['failed', 'failed', 'failed'])).toBe(0)
    expect(taskReward(['done', 'failed', 'done'])).toBe(2 * TASK_REWARD)
    expect(taskReward(['done', 'done', 'done'])).toBe(3 * TASK_REWARD + ALL_DONE_BONUS)
  })
})
