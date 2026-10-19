import type { OrderVerdict } from './order'
import { INGREDIENT_LABEL } from './types'
import type { Mishap } from './witness'
import type { ShiftResult } from './shift'

export function verdictReason(verdict: OrderVerdict): string {
  const reasons: string[] = []
  if (verdict.missing.length) reasons.push(`缺${verdict.missing.map(i => INGREDIENT_LABEL[i]).join('、')}`)
  if (verdict.forbidden.length) reasons.push(`放了忌口${verdict.forbidden.map(i => INGREDIENT_LABEL[i]).join('、')}`)
  if (!verdict.cookOk) reasons.push('肉饼熟度不符')
  return reasons.join('；')
}

export function serviceReason(ok: boolean, late: boolean, ratio: number, verdict?: OrderVerdict): string {
  if (!ok) return verdict ? verdictReason(verdict) : '餐点不符合订单'
  if (late) return '超时送达，本单免单'
  if (ratio <= .25) return '餐点正确，等候较久，基础评价 3 星'
  if (ratio <= .5) return '餐点正确，等候偏久，基础评价 4 星'
  return '餐点正确且及时送齐'
}

const WITNESS_COPY: Record<Mishap, readonly string[]> = {
  burnt: ['肉饼烤糊了，快乐先别跟着糊。', '这肉饼焦了，这波有点难评。', '肉饼黑了，快乐加载失败。', '肉饼烤糊了，先处理再继续做。', '肉饼糊了，饭搭子先提醒一下。'],
  stained: ['这盘子还脏着，滤镜也救不了。', '盘上的污渍有点抢镜了。', '脏盘子一来，快乐先暂停了。', '盘子没洗净，不能省这一步。', '盘子还有污渍，饭搭子看见了。'],
  crash: ['盘子摔了，这声真绷不住。', '盘子碎一地，我先把脚收好。', '盘子碎了，这回真接不住。', '盘子摔碎了，先别急着跑。', '盘子碎啦，饭搭子往后躲躲。'],
  vent: ['厨师发火了，这份火气我没点。', '厨师先别破防，我还想吃饭。', '厨师这火气，快乐先下线了。', '厨师发火影响等餐，先稳住。', '厨师生气了，饭搭子有点慌。'],
}
const WITNESS_DEFAULT: Record<Mishap, string> = {
  burnt: '闻到糊味了，先看看炉上的肉饼吧。', stained: '盘子还带污渍，这可不能装没看见。', crash: '盘子摔碎了，我先往后躲躲。', vent: '厨师发这么大火，我等得更不踏实了。',
}
export function witnessResponse(kind: Mishap, card: number): string { return WITNESS_COPY[kind][card] ?? WITNESS_DEFAULT[kind] }

export interface RecapInput {
  shift: ShiftResult
  wrongDelivery: number
  lateDelivery: number
  burnt: number
  broken: number
  stained: number
  vents: number
  wrongDetail: string
}
export interface DayRecap { evidence: string; action: string }

export function dayRecap(s: RecapInput): DayRecap {
  const choices: (DayRecap & { count: number })[] = [
    { count: s.shift.wrong + s.wrongDelivery, evidence: `错单 ${s.shift.wrong + s.wrongDelivery} 单`, action: `${s.wrongDetail ? `最近一单：${s.wrongDetail}。\n` : ''}明天先核对配料、忌口与熟度；双肉要检查两块。` },
    { count: s.shift.walkedOut, evidence: `未接单离店 ${s.shift.walkedOut} 位`, action: '明天看到前台有人，先去接单，再决定先做哪一单。' },
    { count: s.shift.timedOut + s.lateDelivery, evidence: `堂食等餐超时 ${s.shift.timedOut} 位 · 外卖超时 ${s.lateDelivery} 单`, action: '明天先处理耐心最少的已接订单；汉堡配餐要送齐，忙不过来时少接外卖。' },
    { count: s.burnt, evidence: `烤糊肉饼 ${s.burnt} 块`, action: '明天先练一块肉：看炉上肉饼变色，达到订单要求就取走。' },
    { count: s.broken, evidence: `摔碎盘子 ${s.broken} 个`, action: '明天端盘转弯留出空间；缺盘时先洗盘、晾干并归架。' },
    { count: s.stained, evidence: `脏盘出餐 ${s.stained} 次`, action: '明天刷洗到完成再松手；别把带污渍的盘子端给顾客。' },
    { count: s.shift.provoked + s.vents, evidence: `被怼走 ${s.shift.provoked} 位 · 发泄 ${s.vents} 次`, action: '明天试一班先不回嘴；发泄被看见会扣耐心，对骂还会压低评价。' },
  ]
  choices.sort((a, b) => b.count - a.count)
  const top = choices[0]!
  if (top.count > 0) return { evidence: top.evidence, action: top.action }
  return s.shift.arrived > 0
    ? { evidence: `准时正确完成 ${s.shift.served}/${s.shift.arrived} 位堂食`, action: '明天沿用这次顺序，留意新订单；打烊后再比较哪里最忙。' }
    : { evidence: '本局没有堂食接待记录', action: '先开门，接下第一单，再观察制作和等候情况。' }
}
