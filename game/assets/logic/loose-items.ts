import type { AABB } from './collision'
import type { Carry, KitchenState } from './kitchen'
import type { Bounds } from './movement'
import type { Burger } from './types'
import type { Vec2 } from './vec2'

export const LOOSE_LIMIT = 16
export const LOOSE_REACH = .9
const RADIUS = .33
const STEP = 1 / 120
export interface LooseWorld { bounds: Bounds; blockers: readonly AABB[]; reserved: readonly AABB[] }
export interface LoosePayload { carry: Carry; burger: Burger | null; plated: boolean; stained: boolean }
export interface LooseItem {
  id: number; payload: LoosePayload; x: number; z: number; y: number
  vx: number; vz: number; vy: number; flying: boolean; impacts: number
}
export interface LooseItems { items: LooseItem[]; nextId: number }
export type LooseResult = 'ok' | 'unsupported' | 'full' | 'no-space' | 'hands-full' | 'not-near' | 'bench-occupied'

export function createLooseItems(): LooseItems { return { items: [], nextId: 1 } }
export function resetLooseItems(s: LooseItems): void { s.items.length = 0; s.nextId = 1 }
export function canSetLooseItem(k: Readonly<KitchenState>): boolean {
  return k.carry.kind === 'ingredient' || k.carry.kind === 'patty' || k.carry.kind === 'plate'
}
function overlaps(x: number, z: number, box: AABB, radius: number): boolean {
  const dx = x - Math.max(box.center.x - box.halfX, Math.min(x, box.center.x + box.halfX))
  const dz = z - Math.max(box.center.z - box.halfZ, Math.min(z, box.center.z + box.halfZ))
  return dx * dx + dz * dz < radius * radius
}
function free(x: number, z: number, w: LooseWorld, radius = RADIUS): boolean {
  const b = w.bounds
  if (x < b.xmin + radius || x > b.xmax - radius || z < b.zmin + radius || z > b.zmax - radius) return false
  for (const box of w.blockers) if (overlaps(x, z, box, radius)) return false
  for (const box of w.reserved) if (overlaps(x, z, box, radius)) return false
  return true
}
function visible(ax: number, az: number, bx: number, bz: number, w: LooseWorld): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / .04))
  for (let i = 0; i <= n; i++) if (!free(ax + (bx - ax) * i / n, az + (bz - az) * i / n, w, .015)) return false
  return true
}
function emptyHands(k: KitchenState): void {
  Object.assign(k.carry, { kind: 'none', second: null, plated: false, stained: false, count: 0, countStained: 0 })
}
function resetBurger(k: KitchenState): void {
  k.burger.ingredients.length = 0; k.burger.cook = null; k.burger.double = false; k.burger.cook2 = null
  k.burgerPlated = false; k.burgerStained = false
}

export function putLooseItem(s: LooseItems, k: KitchenState, pos: Vec2, yaw: number, thrown: boolean, w: LooseWorld): LooseResult {
  if (!canSetLooseItem(k)) return 'unsupported'
  if (s.items.length >= LOOSE_LIMIT) return 'full'
  const dx = Math.sin(yaw), dz = Math.cos(yaw)
  let x = pos.x, z = pos.z, found = false
  for (let reach = .55; reach >= .149; reach -= .1) {
    x = pos.x + dx * reach; z = pos.z + dz * reach
    if (!free(x, z, w) || !visible(pos.x, pos.z, x, z, w)) continue
    if (!thrown && s.items.some(i => !i.flying && Math.hypot(i.x - x, i.z - z) < .36)) continue
    found = true; break
  }
  if (!found) return 'no-space'
  const burger = k.carry.kind === 'plate' ? { ...k.burger, ingredients: [...k.burger.ingredients] } : null
  const payload: LoosePayload = { carry: { ...k.carry }, burger, plated: burger ? k.burgerPlated : k.carry.plated, stained: burger ? k.burgerStained : k.carry.stained }
  s.items.push({ id: s.nextId++, payload, x, z, y: thrown ? .85 : 0, vx: thrown ? dx * 5.5 : 0, vz: thrown ? dz * 5.5 : 0, vy: thrown ? 2.4 : 0, flying: thrown, impacts: 0 })
  if (burger) resetBurger(k)
  emptyHands(k)
  return 'ok'
}

export function nearestLooseItem(s: Readonly<LooseItems>, pos: Vec2, w: LooseWorld): LooseItem | null {
  let nearest: LooseItem | null = null, distance = LOOSE_REACH
  for (const item of s.items) {
    if (item.flying) continue
    const d = Math.hypot(item.x - pos.x, item.z - pos.z)
    if (d <= distance && visible(pos.x, pos.z, item.x, item.z, w)) { nearest = item; distance = d }
  }
  return nearest
}

export function pickLooseItem(s: LooseItems, k: KitchenState, pos: Vec2, w: LooseWorld): LooseResult {
  if (k.carry.kind !== 'none') return 'hands-full'
  const item = nearestLooseItem(s, pos, w)
  if (!item) return 'not-near'
  const p = item.payload
  if (p.burger && k.assemblyOccupied) return 'bench-occupied'
  if (p.burger) {
    resetBurger(k)
    k.burger.ingredients.push(...p.burger.ingredients)
    k.burger.cook = p.burger.cook; k.burger.double = p.burger.double; k.burger.cook2 = p.burger.cook2
    k.burgerPlated = p.plated; k.burgerStained = p.stained
  }
  Object.assign(k.carry, p.carry)
  s.items.splice(s.items.indexOf(item), 1)
  return 'ok'
}

export function clearLooseItem(s: LooseItems, k: KitchenState, pos: Vec2, w: LooseWorld): LooseResult {
  if (k.carry.kind !== 'none') return 'hands-full'
  const item = nearestLooseItem(s, pos, w)
  if (!item) return 'not-near'
  if (item.payload.plated && k.cfg.plates !== undefined) k.dirty++
  s.items.splice(s.items.indexOf(item), 1)
  return 'ok'
}

export function stepLooseItems(s: LooseItems, dt: number, w: LooseWorld): void {
  if (!(dt > 0) || !Number.isFinite(dt)) return
  let left = Math.min(.1, dt)
  while (left > 1e-8) {
    const h = Math.min(left, STEP); left -= h
    for (const item of s.items) {
      if (!item.flying) continue
      const x = item.x + item.vx * h, z = item.z + item.vz * h
      if (free(x, z, w)) { item.x = x; item.z = z }
      else if (item.vx !== 0 || item.vz !== 0) { item.vx = 0; item.vz = 0; item.impacts++ }
      item.vy -= 9 * h; item.y += item.vy * h
      if (item.y <= 0) { item.y = 0; item.vx = 0; item.vz = 0; item.vy = 0; item.flying = false; item.impacts++ }
    }
  }
}
