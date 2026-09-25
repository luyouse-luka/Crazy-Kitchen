/**
 * Daily tasks (ROADMAP batch 5): three per day, coins for each done, a bonus for all three, no penalty. Zero Cocos (铁律①).
 * Rolled from the day number on their own RNG, so orders are untouched. ⏳ Targets and rewards are self-chosen.
 */
import { createRng, nextInt } from './rng'
import type { ShiftResult } from './shift'
import type { KitchenState } from './kitchen'
import type { DeliveryDesk } from './delivery'
import { ledgerTotal, type Ledger } from './economy'

export type TaskId = 'good' | 'no-wrong' | 'no-burnt' | 'no-broken' | 'delivered' | 'income' | 'fries'
export type TaskStatus = 'open' | 'done' | 'failed'

export interface Task {
  id: TaskId
  target: number
}

export interface DayStats {
  good: number
  wrong: number
  burnt: number
  broken: number
  delivered: number
  income: number
  fries: number
}

export const DAILY_TASKS = 3
export const TASK_REWARD = 20
export const ALL_DONE_BONUS = 30

const STAT: Record<TaskId, keyof DayStats> = {
  good: 'good',
  'no-wrong': 'wrong',
  'no-burnt': 'burnt',
  'no-broken': 'broken',
  delivered: 'delivered',
  income: 'income',
  fries: 'fries',
}

/** "Never do X" tasks: failed the moment X happens, done only at closing */
const isZero = (id: TaskId) => id === 'no-wrong' || id === 'no-burnt' || id === 'no-broken'

function targetFor(id: TaskId, customers: number): number {
  switch (id) {
    case 'good':
      return Math.ceil(customers * 0.6)
    case 'delivered':
      return 2
    case 'income':
      return customers * 8
    case 'fries':
      return Math.ceil(customers * 0.2)
    default:
      return 0
  }
}

/** Same day → same tasks. Fries only once the fryer is owned */
export function rollTasks(day: number, customers: number, fryer: boolean): Task[] {
  const pool: TaskId[] = ['good', 'no-wrong', 'no-burnt', 'no-broken', 'delivered', 'income']
  if (fryer) pool.push('fries')
  const rng = createRng(Math.imul(day, 0x9e3779b1) ^ 0x7a5c3)
  const out: Task[] = []
  for (let i = 0; i < DAILY_TASKS; i++) {
    const id = pool.splice(nextInt(rng, pool.length), 1)[0]!
    out.push({ id, target: targetFor(id, customers) })
  }
  return out
}

export function collectStats(r: ShiftResult, k: KitchenState, desk: DeliveryDesk, l: Ledger): DayStats {
  return {
    good: r.served,
    wrong: r.wrong + desk.wrong,
    burnt: k.burnt,
    broken: k.broken,
    delivered: desk.delivered,
    income: ledgerTotal(l),
    fries: l.fries,
  }
}

/** `closed` = the day is over: open tasks settle either way */
export function taskStatus(t: Task, s: DayStats, closed: boolean): TaskStatus {
  const v = s[STAT[t.id]]
  if (isZero(t.id)) return v > 0 ? 'failed' : closed ? 'done' : 'open'
  return v >= t.target ? 'done' : closed ? 'failed' : 'open'
}

export function taskText(t: Task, s: DayStats): string {
  const v = Math.min(s[STAT[t.id]], t.target)
  switch (t.id) {
    case 'good':
      return `好评 ${v}/${t.target} 盘`
    case 'no-wrong':
      return '一盘都不上错'
    case 'no-burnt':
      return '一个肉饼都不烤糊'
    case 'no-broken':
      return '一个盘子都不摔'
    case 'delivered':
      return `送达外卖 ${v}/${t.target} 单`
    case 'income':
      return `收入 ¥${v}/¥${t.target}`
    case 'fries':
      return `卖出薯条 ${v}/${t.target} 份`
  }
}

export function taskReward(statuses: readonly TaskStatus[]): number {
  const done = statuses.filter((x) => x === 'done').length
  return done * TASK_REWARD + (done === statuses.length && done > 0 ? ALL_DONE_BONUS : 0)
}
