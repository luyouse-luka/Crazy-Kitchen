import { Controls } from '../game/assets/scripts/Controls'
import { FirstOrderUi } from '../game/assets/scripts/ui/FirstOrderUi'
import { InventorySkin, OrderCardView } from '../game/assets/scripts/ui/KitchenPanels'
import { actionPresentation } from '../game/assets/scripts/ui/UiModel'
import { stationInReach } from '../game/assets/logic/kitchen'
import { DEFAULT_ACTION } from '../game/assets/logic/input'
import { INGREDIENT_LABEL } from '../game/assets/logic/types'
import type { Customer } from '../game/assets/logic/customer'
import type { Carry } from '../game/assets/logic/kitchen'

// Preview-only bridge. Production integration belongs to StationView's owner.
export function install(E: any, sv: any) {
  let run = 1
  const action = E.find('Canvas/UI_ActionButton'), discard = E.find('Canvas/UI_DiscardButton')
  for (const host of [sv.joystickNode, action, discard]) {
    for (const child of [...host.children]) { child.removeFromParent(); child.destroy() }
  }
  sv.controls = new Controls(sv.joystickNode, action, discard)
  const ui = new FirstOrderUi(sv.node, E.sys.localStorage)
  const inventory = new InventorySkin(sv.panelNode, sv.slotNodes, sv.panelTitle)
  const cards = Array.from({ length: 6 }, () => new OrderCardView(sv.node))
  const phases: string[] = []
  let lastPoll = -1
  const modal = () => !!(sv.resultOpen || sv.menuKind || sv.reviewsOpen || sv.panelOpen)
  const frame = () => ({ kitchen: sv.kitchen, customers: sv.shift.flow.customers, near: stationInReach(sv.kitchen, sv.movement.pos)?.kind ?? null, phase: sv.phase, run })
  const sync = () => {
    const f = frame()
    ui.sync(f)
    const hint = ui.currentHint!
    if (phases[phases.length - 1] !== hint.step) phases.push(hint.step)
    const obstacles: { x: number; y: number; w: number; h: number }[] = []
    for (const s of sv.kitchen.cfg.stations) {
      const p = new E.Vec3()
      sv.cameraComp.convertToUINode(new E.Vec3(s.pos.x, .7, s.pos.z), sv.node, p)
      obstacles.push({ x: p.x - 38, y: p.y - 28, w: 76, h: 56 })
    }
    ui.layout(sv.uiHalfW * 2, sv.uiHalfH * 2, modal(), sv.inset, obstacles)
    const target = sv.kitchen.cfg.stations.find((s: { kind: string }) => s.kind === hint.target)
    if (target) {
      const p = new E.Vec3()
      sv.cameraComp.convertToUINode(new E.Vec3(target.pos.x, 1, target.pos.z), sv.node, p)
      ui.pointAt(p.x, p.y, sv.uiHalfW * 2, sv.uiHalfH * 2)
    }
    sv.controls.setContext(actionPresentation(sv.actionVerb(), f.near))
    const carry: Carry = sv.kitchen.carry
    const label = carry.kind === 'ingredient' || carry.kind === 'crate' ? INGREDIENT_LABEL[carry.ingredient] : ({ patty: '肉饼', plate: '汉堡', stack: '盘子', fries: '薯条', drink: '饮料', extinguisher: '灭火器' } as Record<string, string>)[carry.kind]
    sv.controls.setDiscardTarget(label ?? '手中物品')
    if (sv.panelOpen) { inventory.layout(sv.designH, sv.inset.bottom); inventory.sync(sv.kitchen, sv.panelStation.kind === 'storeroom') }
    sv.ordersRoot.active = false
    const active: Customer[] = sv.shift.flow.customers.filter((c: Customer) => c.active && c.ordered)
    const cols = Math.max(1, Math.min(3, active.length))
    const cardW = 280, gap = 12
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!
      card.sync(active[i] ?? null)
      card.node.active = card.node.active && !sv.resultOpen && !sv.reviewsOpen
      card.node.setPosition(-sv.uiHalfW + Math.max(20, sv.inset.left) + cardW / 2 + (i % cols) * (cardW + gap), sv.uiHalfH - 100 - Math.floor(i / cols) * 172, 0)
    }
  }
  const oldSync = sv.syncNodes.bind(sv)
  sv.syncNodes = () => {
    oldSync()
    const discard = sv.router.zone('discard')
    sv.controls.setDiscardProgress(discard?.down ? discard.heldSeconds / DEFAULT_ACTION.holdSeconds : 0)
    if (sv.shift.t - lastPoll >= .15 || sv.phase !== 'open') { sync(); lastPoll = sv.shift.t }
  }
  const refresh = sv.refreshZones.bind(sv)
  sv.refreshZones = () => {
    refresh()
    const zones = [...ui.captureZones(sv.screenW, sv.screenH, sv.designH), ...sv.router.zones.filter((z: { id: string }) => !z.id.startsWith('guide-'))]
    if (JSON.stringify(zones) !== JSON.stringify(sv.router.zones)) sv.router.setCaptureZones(zones)
  }
  const tick = sv.tickPlay.bind(sv)
  sv.tickPlay = () => {
    for (const id of ['guide-skip', 'guide-help', 'guide-body']) {
      if (sv.router.zone(id)?.tapped) { ui.tapped(id); sync(); return }
    }
    tick()
  }
  const finish = sv.finishOrder.bind(sv)
  sv.finishOrder = (c: Customer, ok: boolean, station: unknown, settle: unknown) => {
    const orderId = c.id
    finish(c, ok, station, settle)
    ui.guide.delivered({ run, orderId, ok, complete: true })
  }
  const restart = sv.restart.bind(sv)
  sv.restart = (...args: unknown[]) => { run++; lastPoll = -1; restart(...args); sync() }
  sync(); sv.zonesKey = ''; sv.refreshZones()
  return { ui, cards, inventory, phases, sync, get run() { return run } }
}
