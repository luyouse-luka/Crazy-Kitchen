import { COOK_LABEL, INGREDIENT_LABEL } from '../../logic/types'
import type { Ingredient, OrderSpec, StationKind } from '../../logic/types'

export type Gesture = 'tap' | 'hold' | 'wait' | 'move'
export type ActionIcon = 'move' | 'fridge' | 'pan-in' | 'pan-out' | 'burger' | 'assemble' | 'serve' | 'order' | 'box' | 'wash' | 'plate' | 'fire' | 'drink' | 'fryer' | 'door' | 'gear' | 'talk' | 'wait' | 'blocked' | 'pick' | 'place' | 'throw' | 'trash'
export interface ActionPresentation { target: string; verb: string; gesture: Gesture; enabled: boolean; icon?: ActionIcon; secondaryIcon?: ActionIcon }
export function groundPresentation(name: string, occupied: boolean): ActionPresentation {
  return { target: name, verb: occupied ? '先腾空台面' : '拾取', gesture: 'tap', enabled: true, icon: occupied ? 'blocked' : 'pick', secondaryIcon: 'trash' }
}
const ACTION_ICONS: Record<string, ActionIcon> = {
  取料: 'fridge', 补货: 'box', 下锅: 'pan-in', 取肉: 'pan-out', 端盘: 'burger', 放下: 'place', 组装: 'assemble', 上菜: 'serve', 交外卖: 'box',
  接单: 'order', 狂点骂: 'talk', 长按怼: 'talk', 开门: 'door', 装修: 'gear', 搬箱: 'box', 按住刷: 'wash', 泡碗: 'wash', 泡着: 'wait',
  拿盘子: 'plate', 放盘子: 'plate', 灭火: 'fire', 着火了: 'fire', 放回: 'fire', 灭火器: 'fire', 取饮料: 'drink', 接饮料: 'drink', 接着: 'wait', 擦干净: 'wash',
  取薯条: 'fryer', 下薯条: 'fryer', 炸着: 'wait', 倒掉: 'trash', 先放下: 'blocked', 拾取: 'pick',
}
export const STATION_NAME: Record<StationKind, string> = {
  fridge: '冰箱', grill: '烤炉', assembly: '制作台', serve: '出餐口', register: '前台',
  storeroom: '冷库', sink: '洗碗池', rack: '晾盘架', shelf: '盘架', delivery: '外卖口',
  fryer: '炸锅', extinguisher: '灭火器', drinks: '饮料机',
}
export const GESTURE_LABEL: Record<Gesture, string> = { tap: '点按', hold: '按住', wait: '等待', move: '拖动移动' }
const LEGACY: Record<string, [StationKind, string, Gesture]> = {
  先放下: ['fridge', '先放下手中物品', 'wait'],
  取料: ['fridge', '选择食材', 'tap'], 补货: ['fridge', '放入货箱', 'tap'],
  下锅: ['grill', '放入肉饼', 'tap'], 取肉: ['grill', '取出肉饼', 'tap'],
  灭火: ['grill', '灭火', 'tap'], 着火了: ['grill', '先拿灭火器', 'move'],
  端盘: ['assembly', '端起汉堡', 'tap'], 放下: ['assembly', '放回台面', 'tap'], 组装: ['assembly', '放入配料', 'tap'],
  上菜: ['serve', '交付餐点', 'tap'], 交外卖: ['delivery', '交付外卖', 'tap'],
  接单: ['register', '接单', 'tap'], 狂点骂: ['register', '继续回怼', 'tap'], 长按怼: ['register', '回怼顾客', 'hold'],
  开门: ['register', '准备开门', 'tap'], 装修: ['register', '店铺管理', 'tap'], 搬箱: ['storeroom', '选择货箱', 'tap'],
  按住刷: ['sink', '刷洗盘子', 'hold'], 泡着: ['sink', '正在浸泡', 'wait'], 泡碗: ['sink', '放入脏盘', 'tap'],
  拿盘子: ['rack', '取出盘子', 'tap'], 放盘子: ['shelf', '归还盘子', 'tap'],
  放回: ['extinguisher', '放回灭火器', 'tap'], 灭火器: ['extinguisher', '拿起灭火器', 'tap'],
  取饮料: ['drinks', '取走饮料', 'tap'], 接着: ['drinks', '正在接饮料', 'wait'],
  擦干净: ['drinks', '清理溢出', 'tap'], 接饮料: ['drinks', '开始接饮料', 'tap'],
  取薯条: ['fryer', '取出薯条', 'tap'], 炸着: ['fryer', '正在炸制', 'wait'],
  倒掉: ['fryer', '清理焦薯条', 'tap'], 下薯条: ['fryer', '开始炸制', 'tap'],
}

export function actionPresentation(verb: string, station?: StationKind | null): ActionPresentation {
  const known = LEGACY[verb]
  const gesture = known?.[2] ?? (verb ? 'tap' : 'move')
  return {
    target: station ? STATION_NAME[station] : known ? STATION_NAME[known[0]] : verb ? '当前工位' : '附近无工位',
    verb: known?.[1] ?? (verb || '走近工位'), gesture, enabled: !!verb && gesture !== 'wait' && gesture !== 'move',
    icon: ACTION_ICONS[verb] ?? (verb ? 'pick' : 'move'),
  }
}

export function inventoryPresentation(ingredient: Ingredient, count: number, cap: number) {
  return { name: INGREDIENT_LABEL[ingredient], empty: count <= 0,
    count: count <= 0 ? '缺货' : !Number.isFinite(count) ? '库存充足' : `剩余 ${count}${Number.isFinite(cap) ? ` / ${cap}` : ''}` }
}

export function orderPresentation(spec: OrderSpec) {
  return {
    recipe: spec.required.map(i => INGREDIENT_LABEL[i] + (i === 'patty' && spec.double ? '×2' : '')).join(' · '),
    cook: COOK_LABEL[spec.doneness], banned: spec.banned.length ? `不要 ${spec.banned.map(i => INGREDIENT_LABEL[i]).join(' · ')}` : '',
    sides: [spec.fries ? '薯条' : '', spec.drink ? '饮料' : ''].filter(Boolean).join(' + '),
  }
}

export interface UiRect { x: number; y: number; w: number; h: number }
export interface UiInsets { left: number; right: number; top: number; bottom: number }
export function overlaps(a: UiRect, b: UiRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function guideLayout(width: number, height: number, safe: UiInsets = { left: 0, right: 0, top: 0, bottom: 0 }, obstacles: readonly UiRect[] = []) {
  const bottom = -height / 2 + Math.max(18, safe.bottom + 12)
  const leftControl = { x: -width / 2, y: -height / 2, w: 260 + safe.left, h: 280 + safe.bottom }
  const rightControl = { x: width / 2 - 300 - safe.right, y: -height / 2, w: 300 + safe.right, h: 450 + safe.bottom }
  const left = leftControl.x + leftControl.w + 12
  const right = rightControl.x - 12
  const w = Math.min(560, right - left)
  let card = { x: (left + right - w) / 2, y: bottom, w, h: 148 }
  let collapsed = w < 440 || obstacles.some(r => overlaps(r, card))
  if (collapsed) {
    const candidates = [
      { x: -80, y: bottom, w: 160, h: 88 },
      { x: -width / 2 + Math.max(18, safe.left + 12), y: height / 2 - Math.max(214, safe.top + 214), w: 160, h: 88 },
      { x: -width / 2 + Math.max(18, safe.left + 12), y: height / 2 - Math.max(360, safe.top + 360), w: 160, h: 88 },
    ]
    const fit = candidates.find(c => !obstacles.some(r => overlaps(r, c)) && !overlaps(c, leftControl) && !overlaps(c, rightControl))
    card = fit ?? candidates[0]!
    return { card, skip: { ...card }, leftControl, rightControl, collapsed, hidden: !fit }
  }
  return { card, skip: { x: card.x + card.w - 120, y: card.y + 30, w: 100, h: 88 }, leftControl, rightControl, collapsed, hidden: false }
}
