import { BANTER } from './banterLines'
import { createRng, nextInt } from './rng'
import type { TaskId, TaskStatus } from './tasks'

export type BanterReason = 'wrong' | 'late' | 'walkout' | 'provoked'
export interface BanterContext { card: number; reason: BanterReason; task?: { id: TaskId; status: TaskStatus } }
export interface BanterMatch { complaint: string; chef: string[]; customer: string[]; exit: string }

/** Cosmetic RNG and shuffle bags never consume the order simulation's RNG. */
export class BanterDeck {
  private readonly rng
  private readonly bags = new Map<string, string[]>()
  private readonly last = new Map<string, string>()

  constructor(seed: number) { this.rng = createRng(seed) }

  taskLine(task?: BanterContext['task']): string | undefined {
    if (!task) return undefined
    const pool = BANTER.tasks[task.id] as Partial<Record<TaskStatus, readonly string[]>>
    const lines = pool[task.status]
    return lines ? this.draw(`task:${task.id}:${task.status}`, lines) : undefined
  }

  private draw(key: string, lines: readonly string[], exclude: readonly string[] = []): string {
    let bag = this.bags.get(key)
    if (!bag?.some(line => !exclude.includes(line))) {
      bag = lines.filter(line => !exclude.includes(line))
      for (let i = bag.length - 1; i > 0; i--) {
        const j = nextInt(this.rng, i + 1)
        ;[bag[i], bag[j]] = [bag[j]!, bag[i]!]
      }
      if (bag.length > 1 && bag[bag.length - 1] === this.last.get(key)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!]
      this.bags.set(key, bag)
    }
    let index = bag.length - 1
    while (exclude.includes(bag[index]!)) index--
    const line = bag.splice(index, 1)[0]!
    this.last.set(key, line)
    return line
  }

  match(context: BanterContext): BanterMatch {
    const card = BANTER.cards[context.card] ?? BANTER.cards[0]
    const chef: string[] = []
    for (let i = 0; i < 6; i++) chef.push(this.draw('chef', BANTER.chef, chef))
    chef[2] = this.taskLine(context.task) ?? chef[2]!
    const first = this.draw(`${card.id}:back`, card.back)
    const customer = [first, this.draw(`reason:${context.reason}`, BANTER.reason[context.reason]), this.draw(`${card.id}:back`, card.back, [first])]
    return {
      complaint: this.draw(`${card.id}:complain`, card.complain), chef, customer,
      exit: this.draw(`${card.id}:exit`, card.exit),
    }
  }
}

/** Keep shouting bubbles readable at the portrait reference width. */
export function banterBubble(text: string): string {
  const rows: string[] = []
  for (const line of text.split('\n')) {
    const row = Array.from(line)
    for (let i = 0; i < row.length; i += 13) rows.push(row.slice(i, i + 13).join(''))
  }
  return rows.join('\n')
}
