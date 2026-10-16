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
  burnt: ['这肉饼糊了，我还没上台先闻到烟了。', '肉饼烤成炭，这包袱有点焦。', '捧哏也救不了这块糊肉。', '肉饼烤糊了，先处理再继续做。', '肉饼黑了，这个我真的不敢吃。'],
  stained: ['盘子没洗净，上镜可不能靠滤镜。', '盘上的污渍比我的段子还顽固。', '这盘子脏得我都接不上话了。', '盘子没洗净，不能省这一步。', '盘子上还有脏东西！'],
  crash: ['盘子摔了，这动静比出场音乐还响。', '盘子碎一地，这响声可不是捧场。', '盘子碎了，这回真接不住。', '盘子摔碎了，先别急着跑。', '盘子碎啦，我脚先收起来。'],
  vent: ['厨师发火了，后台也没这动静。', '厨师先发火，这场我没买票啊。', '厨师这火气，我可不敢捧。', '发火会影响等餐的同学，先稳住。', '厨师生气了，我有点害怕。'],
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
