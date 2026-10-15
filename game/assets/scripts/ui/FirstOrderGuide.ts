import type { Customer } from '../../logic/customer'
import type { KitchenState } from '../../logic/kitchen'
import { judge } from '../../logic/order'
import { cookLevelAt } from '../../logic/recipe'
import { COOK_LABEL, INGREDIENTS, INGREDIENT_LABEL } from '../../logic/types'
import type { StationKind } from '../../logic/types'
import type { Gesture } from './UiModel'

export const GUIDE_STORAGE_KEY = 'kitchen-chaos.first-order-guide.v1'
export type GuideStatus = 'active' | 'skipped' | 'done'
export interface GuideStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface GuideFrame {
  kitchen: Readonly<KitchenState>; customers: readonly Customer[]; near: StationKind | null
  phase: 'closed' | 'open' | 'rest'; run: number
  groundItem?: string | null
}
export type GuideStep = 'move' | 'accept' | 'ingredients' | 'cook' | 'assemble' | 'deliver'
export interface GuideHint { step: GuideStep; index: number; title: string; detail: string; target: StationKind; gesture: Gesture; control: 'stick' | 'action' | 'discard' | 'ground' }
const INDEX: Record<GuideStep, number> = { move: 1, accept: 2, ingredients: 3, cook: 4, assemble: 5, deliver: 6 }
function hint(step: GuideStep, title: string, detail: string, target: StationKind, gesture: Gesture = 'tap', control: GuideHint['control'] = gesture === 'move' ? 'stick' : 'action'): GuideHint {
  return { step, index: INDEX[step], title, detail, target, gesture, control }
}

export class FirstOrderGuide {
  status: GuideStatus = 'active'
  private run = -1
  private arrived = false
  private orderId: number | null = null
  constructor(private store?: GuideStore) {
    try { const saved = store?.getItem(GUIDE_STORAGE_KEY); if (saved === 'done' || saved === 'skipped') this.status = saved } catch { /* Storage is optional. */ }
  }
  skip(): void { this.save('skipped') }
  replay(): void { this.orderId = null; this.arrived = false; this.save('active') }
  private save(status: GuideStatus): void {
    this.status = status
    try { this.store?.setItem(GUIDE_STORAGE_KEY, status) } catch { /* Storage is optional. */ }
  }
  delivered(event: { run: number; orderId: number; ok: boolean; complete: boolean }): void {
    if (this.status === 'active' && event.run === this.run && event.orderId === this.orderId && event.ok && event.complete) this.save('done')
  }
  observe(f: GuideFrame): GuideHint {
    if (f.run !== this.run) { this.run = f.run; this.arrived = false; this.orderId = null }
    if (f.near === 'register') this.arrived = true
    const accepted = f.customers.find(c => c.active && c.ordered && c.id === this.orderId)
      ?? f.customers.find(c => c.active && c.ordered)
    this.orderId = accepted?.id ?? null
    if (!accepted) {
      if (!this.arrived) return hint('move', '先走到前台', '拖动左侧移动。走近前台后，看右侧动作键。', 'register', 'move')
      return hint('accept', f.phase === 'open' ? '接下第一张订单' : f.phase === 'rest' ? '休息日 · 查看店铺管理' : '先开门，再接单',
        f.phase === 'open' ? '等顾客走到前台，点按接单；需求会显示在上方。' : f.phase === 'rest' ? '前台点按管理；进入下一营业日后继续制作引导。' : '前台点按，选择开门；顾客到柜台后再点按接单。', 'register')
    }
    const k = f.kitchen, c = k.carry, spec = accepted.spec
    if (c.kind === 'none' && f.groundItem) return hint('ingredients', `地面有${f.groundItem}`, '动作键点按拾取，长按清理；地面汉堡需先腾空制作台。', 'fridge', 'tap', 'ground')
    if (k.fire) return hint('cook', '先处理炉火', c.kind === 'extinguisher' ? '带着灭火器靠近烤炉，点按灭火。' : '先清空双手，去拿灭火器，再回烤炉点按灭火。', c.kind === 'extinguisher' ? 'grill' : 'extinguisher')
    if (c.kind === 'crate') return hint('ingredients', '先把货箱放回冰箱', '靠近冰箱，点按补货，再继续取料。', 'fridge')
    if (c.kind === 'stack') return hint('ingredients', '先归还手上的盘子', '靠近盘架，点按放盘子，空出双手。', 'shelf')
    if (c.kind === 'extinguisher') return hint('ingredients', '放回灭火器', '靠近灭火器原位，点按放回，再取食材。', 'extinguisher')
    if (c.kind === 'fries' || c.kind === 'drink') return hint('deliver', '先交付手中的配餐', '到出餐口点按交付，空出双手再继续制作。', 'serve')
    if (accepted.burgerVerdict?.ok) {
      const fries = accepted.friesDue
      const drink = accepted.drinkDue
      if (c.kind !== 'none') return hint('deliver', '先空出双手再做配餐', '汉堡已经交付；辅助键点按放下多余食物，空出双手再做配餐。', fries ? 'fryer' : 'drinks', 'tap', 'discard')
      if (fries || drink) return hint('deliver', fries ? '还差一份薯条' : '还差一杯饮料', fries ? '到炸锅点按开始，炸好后点按取出，再送到出餐口。' : '到饮料机点按开始，接满后点按取走，再送到出餐口。', fries ? 'fryer' : 'drinks')
    }
    const raw = (c.kind === 'patty' && c.cook === 'raw') || (c.kind === 'ingredient' && (c.ingredient === 'patty' || c.second === 'patty'))
    if (raw && k.grill.every(g => g.busy)) return hint('cook', '烤位已满 · 先空出双手', '辅助键点按放下生肉；走开一点，再空手取出已到熟度的肉饼。', 'grill', 'tap', 'discard')
    if (c.kind === 'patty') {
      if (c.cook === 'raw') return hint('cook', '把生肉饼放进锅', '走近烤炉后点按下锅；烹调会自动继续。', 'grill')
      if (c.cook !== spec.doneness) return hint('cook', '这块肉的熟度不对', `需要${COOK_LABEL[spec.doneness]}；辅助键点按放下，再对地面物品长按动作键清理。`, 'grill', 'tap', 'discard')
      if (k.assemblyOccupied && k.burger.ingredients.includes('patty') && (!k.cfg.doublePatty || k.burger.double)) return hint('assemble', '台面上的肉饼已经放满', '辅助键点按放下多余肉饼；走开或长按动作键清理，再继续制作。', 'assembly', 'tap', 'discard')
      return hint('assemble', '把熟肉放上制作台', '走近制作台，点按放入肉饼，再照订单补配料。', 'assembly')
    }
    if (c.kind === 'ingredient') {
      const held = [c.ingredient, c.second]
      if (held.some(i => i !== null && spec.banned.includes(i))) return hint('ingredients', '手中的食材是订单忌口', '辅助键点按放下忌口食材；对地面物品长按动作键清理，再取料。', 'fridge', 'tap', 'discard')
      if (c.ingredient === 'patty' || c.second === 'patty') return hint('cook', '先把生肉饼下锅', '走近烤炉点按下锅；另一只手的配料会保留。', 'grill')
      if (k.assemblyOccupied && held.every(i => i === null || k.burger.ingredients.includes(i))) return hint('assemble', '手中配料已经放过了', '辅助键点按放下多余配料；走开或长按动作键清理，再取料或端盘。', 'assembly', 'tap', 'discard')
      return hint('assemble', '把手中配料放上制作台', '靠近制作台点按放入配料；不要加入订单忌口。', 'assembly')
    }
    const verdict = judge(k.burger, spec)
    if (verdict.forbidden.length || (k.burger.cook !== null && !verdict.cookOk && !(spec.double && !k.burger.double && k.burger.cook === spec.doneness))) {
      return hint('assemble', '这份汉堡需要重做', c.kind === 'plate' ? '辅助键点按放下汉堡，再对地面物品长按动作键清理。' : '先点按端起汉堡，再用辅助键放下，长按动作键清理后重做。', 'assembly', 'tap', c.kind === 'plate' ? 'discard' : 'action')
    }
    if (c.kind === 'plate') return verdict.ok
      ? hint('deliver', '把汉堡送到出餐口', '靠近出餐口，点按交付；配餐需要另外送。', 'serve')
      : hint('assemble', '先放回制作台补齐', '靠近制作台点按放下，再按订单补齐缺少的配料。', 'assembly')
    let slot: Readonly<KitchenState['grill'][number]> | undefined
    for (const g of k.grill) if (g.busy && (!slot || g.elapsed > slot.elapsed)) slot = g
    if (slot) {
      const level = cookLevelAt(slot.elapsed, k.cfg.cook)
      if (k.plates <= 0) {
        if (k.rack.ready > 0) return hint('cook', '干盘已晾好', '到晾盘架点按取盘，再到盘架点按归还。', 'rack')
        if (k.rack.count > 0) return hint('cook', '等盘子晾干', '晾干后到晾盘架取盘，再到盘架归还。', 'rack', 'wait')
        if (k.sink.stage === 'soaked') return hint('cook', '按住刷洗盘子', '靠近洗碗池按住刷洗，刷完再等盘子晾干。', 'sink', 'hold')
        if (k.sink.stage === 'soaking') return hint('cook', '盘子正在浸泡', '浸泡完成后按住刷洗；先不要反复点按。', 'sink', 'wait')
        return hint('cook', '取肉需要干净盘子', k.dirty > 0 ? '洗碗池点按放入脏盘，再浸泡、按住刷洗、晾干归架。' : k.spare > 0 ? '冷库点选备用盘子，搬到盘架点按归还。' : '等待脏盘返回；若盘子全部摔碎，可跳过引导并重开。', k.dirty > 0 || k.spare <= 0 ? 'sink' : 'storeroom', k.dirty <= 0 && k.spare <= 0 ? 'wait' : 'tap')
      }
      const levels = ['raw', 'rare', 'medium', 'well', 'burnt']
      if (levels.indexOf(level) > levels.indexOf(spec.doneness)) return hint('cook', '肉饼已经烤过头', '空手点按取出，辅助键放下，长按动作键清理；再拿生肉饼。', 'grill')
      return hint('cook', level === spec.doneness ? '现在取出肉饼' : `等肉饼烤到${COOK_LABEL[spec.doneness]}`,
        level === spec.doneness ? '空手靠近烤炉点按取肉，接着放到制作台。' : `观察肉色和逐渐加深的烤痕，对照订单要求；点按取肉，别一直按住。`, 'grill', level === spec.doneness ? 'tap' : 'wait')
    }
    if (verdict.ok) return hint('assemble', '端起做好的汉堡', '制作台空手点按端盘，再移动到出餐口。', 'assembly')
    const missing = verdict.missing.includes('patty') ? 'patty' : verdict.missing[0] ?? 'patty'
    const empty = k.stock[INGREDIENTS.indexOf(missing)]! <= 0
    return hint('ingredients', empty ? `${INGREDIENT_LABEL[missing]}缺货了` : `去冰箱取${INGREDIENT_LABEL[missing]}`,
      empty ? '冷库点选同类货箱，搬回冰箱点按补货。' : `冰箱点按打开面板，再点选${INGREDIENT_LABEL[missing]}；${missing === 'patty' ? '肉饼要先下锅。' : '取好后到制作台点按放入。'}`, empty ? 'storeroom' : 'fridge')
  }
}
