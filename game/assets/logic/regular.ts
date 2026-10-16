export type VisitOutcome = 'good' | 'bad'
export interface RegularMemory { chapter: number; lastDay: number; outcome: VisitOutcome | null }
export interface RegularVisit { chapter: number; day: number; previous: VisitOutcome | null }

export const REGULAR = {
  identity: '阿星·练习生',
  cardIndex: 0,
  chapters: [
    { title: '第一次试镜', unlockDay: 1, greet: '第一次试镜，来吃个汉堡壮胆。', wait_nudge: '试镜还没开始，我的肚子先抢麦了。', praise: '这顿吃踏实了，上台就当台下全是汉堡！', complain: '试镜已经够紧张了，这顿又让我破防。', recap: '阿星带着试镜号码牌离开了。', next: '下一个新营业日，听听试镜的后续。' },
    { title: '候补也要练', unlockDay: 2, greet: '试镜进候补了，继续练！', wait_nudge: '排练能候补，吃饭也要候补吗？', praise: '吃饱继续练，候补也得有主角的饭量！', complain: '舞台还在候补，这顿饭也没吃痛快。', recap: '阿星还在候补名单里，决定继续排练。', next: '下一个新营业日，听听他的登台消息。' },
    { title: '三分钟的舞台', unlockDay: 3, greet: '今晚终于上台，能演三分钟！', wait_nudge: '台词背熟了，胃还在给我打节拍。', praise: '这顿是登台前的底气，谢了老板！', complain: '登台前这顿没吃顺，先去稳稳心态。', recap: '阿星拿到了三分钟的舞台，准备去演出。', next: '这段小故事已完结，之后照常接待新客。' },
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
