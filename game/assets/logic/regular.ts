export type VisitOutcome = 'good' | 'bad'
export interface RegularMemory { chapter: number; lastDay: number; outcome: VisitOutcome | null }
export interface RegularVisit { chapter: number; day: number; previous: VisitOutcome | null }

export const REGULAR = {
  identity: '阿星',
  cardIndex: 0,
  chapters: [
    { title: '第一次来', unlockDay: 1, greet: '规矩立住，不烧心。', wait_nudge: '期待还在，胃先急了。', praise: '第一次来就被这口拿捏了，今天的快乐有着落。', complain: '第一次来没吃痛快。这顿我先不硬夸，下次再看看。', recap: '阿星第一次来店，记住了这次接待。', next: '下一个营业日，再听听阿星的近况。' },
    { title: '又见面了', unlockDay: 2, greet: '今天不纠结了，还来你这儿。', wait_nudge: '又见面了，饭别跟我捉迷藏。', praise: '这次的情绪价值给足了，来都来了，果然没白来。', complain: '又见面了，还是没吃顺。这波我得先缓缓。', recap: '阿星再次来店，给这顿饭又一次期待。', next: '下一个营业日，再见面时聊聊这顿饭。' },
    { title: '老位置见', unlockDay: 3, greet: '老位置给我留着，饭搭子包的。', wait_nudge: '老熟人也会饿，先把饭接住。', praise: '这单接得漂亮，饭搭子这关系，稳稳拿捏。', complain: '熟归熟，这顿没吃顺还是得说。我先不替胃圆场了。', recap: '第三次见面，阿星把这里叫作老地方。', next: '这段来店小故事已完结，之后照常接待新客。' },
  ],
} as const

export function newRegularMemory(): RegularMemory { return { chapter: 0, lastDay: 0, outcome: null } }

export function parseRegularMemory(value: unknown): RegularMemory {
  if (!value || typeof value !== 'object') return newRegularMemory()
  const r = value as Partial<RegularMemory>
  if (!Number.isSafeInteger(r.chapter) || !Number.isSafeInteger(r.lastDay) || r.chapter! < 1 || r.chapter! > REGULAR.chapters.length || r.lastDay! < r.chapter! || (r.outcome !== 'good' && r.outcome !== 'bad')) return newRegularMemory()
  return { chapter: r.chapter!, lastDay: r.lastDay!, outcome: r.outcome }
}

export function nextRegularVisit(memory: RegularMemory, day: number): RegularVisit | null {
  const chapter = REGULAR.chapters[memory.chapter]
  if (!chapter || !Number.isSafeInteger(day) || day <= memory.lastDay || day < chapter.unlockDay) return null
  return { chapter: memory.chapter + 1, day, previous: memory.outcome }
}

export function regularLines(visit: RegularVisit) {
  const chapter = REGULAR.chapters[visit.chapter - 1]!
  const memory = visit.previous === 'good' ? '上回吃得挺好！' : visit.previous === 'bad' ? '上回没吃痛快。' : ''
  return { ...chapter, greet: memory + chapter.greet }
}

export function finishRegularVisit(memory: RegularMemory, visit: RegularVisit | null, outcome: VisitOutcome | null): boolean {
  const chapter = visit ? REGULAR.chapters[visit.chapter - 1] : null
  if (!visit || !chapter || !outcome || !Number.isSafeInteger(visit.day) || visit.chapter !== memory.chapter + 1 || visit.day <= memory.lastDay || visit.day < chapter.unlockDay) return false
  memory.chapter = visit.chapter; memory.lastDay = visit.day; memory.outcome = outcome
  return true
}
