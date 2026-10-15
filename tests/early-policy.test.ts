import { expect, it } from 'vitest'
import { earlyShiftPolicyForDay, difficultyForDay } from '../game/assets/logic/difficulty'
import { rollTasks } from '../game/assets/logic/tasks'
it('reduces the first five shifts without changing late-game parameters', () => {
  const late = difficultyForDay(6)
  expect([1, 2, 3].map(d => earlyShiftPolicyForDay(d)!.customers)).toEqual([4, 6, 8])
  expect(earlyShiftPolicyForDay(1)!.maxConcurrent).toBe(1)
  expect(earlyShiftPolicyForDay(3)!.delivery).toBe(false)
  expect(earlyShiftPolicyForDay(5)!.intervalSec).toBe(30)
  expect(earlyShiftPolicyForDay(6)).toBeUndefined()
  expect(earlyShiftPolicyForDay(Infinity)).toBeUndefined()
  expect(difficultyForDay(6)).toEqual(late)
  for (let day = 1; day <= 3; day++) expect(rollTasks(day, earlyShiftPolicyForDay(day)!.customers, false, false).some(t => t.id === 'delivered')).toBe(false)
})
