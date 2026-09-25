/**
 * 天数推进与存档：一天 = 一局（接待完 N 位顾客打烊），拿到 PASS_STARS 颗星才解锁下一天。零 Cocos 依赖（铁律①）。
 * Days never run out: past LAST_DAY the difficulty table stays at its top row.
 *
 * 读写存储由组件做（sys.localStorage），这里只管格式。读进来的串可能是旧版本、被截断或被手改过 ——
 * 解析不了一律退回新档，坏档不能把游戏卡死在启动。
 */
import type { FlowParams, OrderDifficulty } from './customer'
import { difficultyForDay } from './difficulty'
import { newDecor, parseDecor } from './decor'
import type { Decor } from './decor'

export const SAVE_KEY = 'kc.progress'
/** v1 had no coins; it still loads, with coins 0 */
const VERSION = 2

/** ⏳ 占位：一星就放行，等真人数据再定 */
export const PASS_STARS = 1

export interface Progress {
  /** 解锁到第几天（下次开游戏打这一天） */
  day: number
  /** best[d - 1] = 第 d 天拿过的最好星数 */
  best: number[]
  /** Banked money, spent on unlocks */
  coins: number
  /** Shop item ids bought (shop.ts). Added within v2: saves without it load with none */
  owned: string[]
  /** Rest-day decorating (decor.ts). Added within v2: saves without it load the scene's own look */
  decor: Decor
}

export function newProgress(): Progress {
  return { day: 1, best: [], coins: 0, owned: [], decor: newDecor() }
}

export function parseProgress(raw: string | null | undefined): Progress {
  if (!raw) return newProgress()
  let o: { v?: unknown; day?: unknown; best?: unknown; coins?: unknown; owned?: unknown; decor?: unknown }
  try {
    o = JSON.parse(raw)
  } catch {
    return newProgress()
  }
  if (!o || (o.v !== 1 && o.v !== VERSION) || !Number.isInteger(o.day) || !Array.isArray(o.best)) return newProgress()
  return {
    day: Math.max(1, o.day as number),
    best: o.best.map((n) => (Number.isInteger(n) ? Math.max(0, Math.min(3, n as number)) : 0)),
    coins: Number.isInteger(o.coins) ? Math.max(0, o.coins as number) : 0,
    owned: Array.isArray(o.owned) ? o.owned.filter((x): x is string => typeof x === 'string') : [],
    decor: parseDecor(o.decor),
  }
}

export function serializeProgress(p: Progress): string {
  return JSON.stringify({ v: VERSION, day: p.day, best: p.best, coins: p.coins, owned: p.owned, decor: p.decor })
}

/** 打完第 day 天：记最好成绩，过线就解锁下一天。返回这一局是否过线 */
export function finishDay(p: Progress, day: number, stars: number): boolean {
  while (p.best.length < day) p.best.push(0)
  p.best[day - 1] = Math.max(p.best[day - 1]!, stars)
  if (stars < PASS_STARS) return false
  p.day = Math.max(p.day, day + 1)
  return true
}

/** Put the day's takings in the bank. Earned whether or not the day passed */
export function bank(p: Progress, amount: number): void {
  p.coins += Math.max(0, Math.floor(amount))
}

/**
 * 真人局某一天的客流。难度表是按理想厨师标定的，真人跟不上那个间隔 ——
 * `arrivalSec` 是第 1 天的真人间隔，之后各天按难度表的比例一起收紧。
 */
export function dayFlow(day: number, arrivalSec: number): { flow: FlowParams; orders: OrderDifficulty } {
  const d = difficultyForDay(day)
  const k = arrivalSec / difficultyForDay(1).flow.intervalSec
  return { flow: { ...d.flow, intervalSec: d.flow.intervalSec * k }, orders: d.orders }
}
