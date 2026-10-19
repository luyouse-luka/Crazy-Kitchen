import type { Carry, InteractKind } from '../logic/kitchen'

export function approachFacingYaw(current: number, target: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  const h = Math.min(.1, Math.max(0, dt))
  const limit = 10 * h
  return current + Math.max(-limit, Math.min(limit, delta * (1 - Math.exp(-18 * h))))
}

export function oneHandedCarry(c: Readonly<Carry>): boolean {
  return (c.kind === 'ingredient' && c.second === null) || (c.kind === 'patty' && !c.plated) || c.kind === 'drink'
}

export interface Point3 { x: number; y: number; z: number }
export interface ArmSolution { elbow: Point3; hand: Point3 }
export interface ChefFrame {
  running: boolean
  moving: boolean
  carrying: boolean
  scrubbing: boolean
  holding: boolean
  sinkInReach: boolean
  throwCharge?: number
}

const PICK: readonly InteractKind[] = ['take-ingredient', 'take-patty', 'pick-plate', 'take-crate', 'take-stack', 'take-fries', 'take-drink', 'take-extinguisher']
const PLACE: readonly InteractKind[] = ['place-patty', 'add-to-burger', 'put-plate', 'serve', 'serve-fries', 'serve-drink', 'shelve', 'restock', 'soak', 'return-extinguisher']
export const REACH_SEC = .3
const THROW_SEC = .28

export class ChefMotion {
  action: 'pick' | 'place' | 'scrub' | 'windup' | 'throw' | null = null
  target: Point3 | null = null
  reach = 0
  clock = 0
  carryWeight = 0
  throwProgress = 0
  throwOneHanded = false
  private elapsed = 0

  releaseThrow(oneHanded: boolean): void {
    this.action = 'throw'
    this.target = null
    this.reach = 1
    this.elapsed = this.throwProgress = 0
    this.throwOneHanded = oneHanded
  }

  notify(kind: InteractKind, target: Point3 | null): void {
    if (kind === 'blocked') return
    if (!target || (!PICK.includes(kind) && !PLACE.includes(kind))) {
      this.action = null
      this.target = null
      this.reach = 0
      return
    }
    this.action = PICK.includes(kind) ? 'pick' : 'place'
    this.target = { ...target }
    this.elapsed = 0
  }

  step(frame: ChefFrame, dt: number): void {
    if (!frame.running) { this.reset(); return }
    dt = Math.max(0, dt)
    this.clock += dt
    this.carryWeight += ((frame.carrying ? 1 : 0) - this.carryWeight) * (1 - Math.exp(-dt * 20))
    if (this.action === 'throw') {
      this.elapsed += dt
      const p = this.throwProgress = Math.min(1, this.elapsed / THROW_SEC)
      this.reach = 1 - p * p * (3 - 2 * p)
      if (p === 1) this.action = null
      return
    }
    if (frame.carrying && Number.isFinite(frame.throwCharge) && frame.throwCharge! > 0) {
      const p = Math.min(1, frame.throwCharge!)
      this.action = 'windup'
      this.target = null
      this.reach = p * p * (3 - 2 * p)
      return
    }
    if (this.action === 'windup') {
      this.action = null
      this.reach = 0
    }
    const scrub = frame.scrubbing && frame.holding && frame.sinkInReach && !frame.moving
    if (scrub) {
      this.action = 'scrub'
      this.reach = 1
      return
    }
    if (frame.moving || this.action === 'scrub') {
      this.action = null
      this.target = null
      this.reach = 0
      return
    }
    if (!this.action) return
    this.elapsed += dt
    if (this.elapsed >= REACH_SEC) {
      this.action = null
      this.target = null
      this.reach = 0
    } else this.reach = Math.sin(Math.PI * this.elapsed / REACH_SEC)
  }

  reset(): void {
    this.action = null
    this.target = null
    this.reach = this.clock = this.elapsed = this.carryWeight = 0
    this.throwProgress = 0
    this.throwOneHanded = false
  }
}

export function solveElbow(shoulder: Point3, target: Point3, upper: number, lower: number, pole: Point3, out: ArmSolution = { elbow: { x: 0, y: 0, z: 0 }, hand: { x: 0, y: 0, z: 0 } }): ArmSolution {
  let x = target.x - shoulder.x, y = target.y - shoulder.y, z = target.z - shoulder.z
  const original = Math.hypot(x, y, z)
  if (original < 1e-8) { x = 0; y = 0; z = 1 }
  const norm = original < 1e-8 ? 1 : original
  x /= norm; y /= norm; z /= norm
  const distance = Math.max(Math.abs(upper - lower) + 1e-5, Math.min(upper + lower - 1e-5, original))
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
  const across = Math.sqrt(Math.max(0, upper * upper - along * along))
  const dot = pole.x * x + pole.y * y + pole.z * z
  let px = pole.x - dot * x, py = pole.y - dot * y, pz = pole.z - dot * z
  let pn = Math.hypot(px, py, pz)
  if (pn < 1e-8) {
    const ax = Math.abs(y) < .9 ? 0 : 1, ay = 1 - ax
    const d = ax * x + ay * y
    px = ax - d * x; py = ay - d * y; pz = -d * z
    pn = Math.hypot(px, py, pz)
  }
  out.elbow.x = shoulder.x + x * along + px / pn * across
  out.elbow.y = shoulder.y + y * along + py / pn * across
  out.elbow.z = shoulder.z + z * along + pz / pn * across
  out.hand.x = shoulder.x + x * distance
  out.hand.y = shoulder.y + y * distance
  out.hand.z = shoulder.z + z * distance
  return out
}
