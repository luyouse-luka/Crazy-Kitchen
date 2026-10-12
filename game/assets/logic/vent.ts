/**
 * Venting (GDD §12.5, reworked 2026-09-25 with the user): an unhappy customer does not just vanish —
 * they rant at the order desk for a while, then leave their review. The chef may start a shouting match
 * there (tap to trade insults; the customer storms off) or slam the fridge anywhere: a short speed boost,
 * paid for by a worse review and by witnesses.
 * Zero Cocos (铁律①). Witness penalties stay in witness.ts; the view reports `vents` increments there.
 */

/** Long-press this long at a vent spot. Longer than the scrub hold so a sink press never vents */
export const VENT_HOLD_SEC = 0.6
export const VENT_BOOST_SEC = 4
export const VENT_SPEED = 1.3
/** ⏳ How long an upset customer rants at the desk before leaving */
export const RANT_SEC = 5
/** Arguing back costs this many review stars (floored at 0) */
export const RETORT_PENALTY = 1
/** ⏳ Taps in a shouting match before the customer storms off */
export const ARGUE_TAPS = 6
/** ⏳ Stop tapping this long and the customer gets the last word and leaves */
export const ARGUE_IDLE_SEC = 1.5

export type VentSpot = 'fridge' | 'register'

export interface Rant {
  /** Customer id, or -1 = free slot */
  id: number
  left: number
  /** The review they will leave, before any retort */
  stars: number
  retorted: boolean
  /** Answered with a thrown plate of food instead of words */
  thrown: boolean
}

export interface VentState {
  boostLeft: number
  /** Pooled; grows only when more customers rant at once than ever before */
  rants: Rant[]
  /** Event counters, read by increment like kitchen.burnt */
  vents: number
  retorts: number
  throws: number
  /** The rant being shouted back at, or null. Its timer is frozen until the match ends */
  argue: Rant | null
  /** Taps so far in the current match */
  taps: number
  idle: number
}

export function createVent(): VentState {
  return { boostLeft: 0, rants: [], vents: 0, retorts: 0, throws: 0, argue: null, taps: 0, idle: 0 }
}

export function resetVent(st: VentState): void {
  st.boostLeft = 0
  st.vents = 0
  st.retorts = 0
  st.throws = 0
  st.argue = null
  st.taps = 0
  st.idle = 0
  for (const r of st.rants) r.id = -1
}

/** An upset customer heads for the desk to rant. `stars` = the review they would leave anyway */
export function startRant(st: VentState, id: number, stars: number): void {
  let r = st.rants.find((x) => x.id < 0)
  if (!r) {
    r = { id: -1, left: 0, stars: 0, retorted: false, thrown: false }
    st.rants.push(r)
  }
  r.id = id
  r.left = RANT_SEC
  r.stars = stars
  r.retorted = false
  r.thrown = false
}

export function ranting(st: VentState, id: number): boolean {
  return st.rants.some((r) => r.id === id)
}

export function rantsLeft(st: VentState): number {
  let n = 0
  for (const r of st.rants) if (r.id >= 0) n++
  return n
}

/** Stars the rant ends with */
export function rantStars(r: Rant): number {
  return r.retorted ? Math.max(0, r.stars - RETORT_PENALTY) : r.stars
}

/** One frame. `onDone` fires as a rant ends, before its slot is freed — post the review there */
export function stepVent(st: VentState, dt: number, onDone?: (r: Rant) => void): void {
  st.boostLeft = Math.max(0, st.boostLeft - dt)
  if (st.argue) {
    st.idle += dt
    if (st.idle >= ARGUE_IDLE_SEC) endArgue(st)
  }
  for (const r of st.rants) {
    if (r.id < 0 || r === st.argue) continue
    r.left -= dt
    if (r.left > 0) continue
    onDone?.(r)
    r.id = -1
  }
}

/**
 * Vent at a spot. At the desk it opens a shouting match with the oldest rant nobody has answered —
 * the chef then taps (argueTap) and the customer storms off when it ends. Returns the rant argued with,
 * `true` for a fridge slam, `null` = nothing to vent at. The boost is paid when the match ends.
 */
export function vent(st: VentState, spot: VentSpot): Rant | true | null {
  if (spot === 'register') {
    if (st.argue) return null
    const target = unanswered(st)
    if (!target) return null
    target.retorted = true
    st.retorts++
    st.argue = target
    st.taps = 0
    st.idle = 0
    return target
  }
  boost(st)
  return true
}

/** The rant nobody has answered yet that is closest to leaving */
export function unanswered(st: VentState): Rant | null {
  let target: Rant | null = null
  for (const r of st.rants) if (r.id >= 0 && !r.retorted && (!target || r.left < target.left)) target = r
  return target
}

/**
 * Throw what is in hand at a ranting customer (2026-09-29, user: only at the desk's ranters). Same price as
 * arguing — a star off, witnesses, the boost — but they bolt at once instead of after a match. Not mid-match.
 */
export function throwAt(st: VentState): Rant | null {
  if (st.argue) return null
  const r = unanswered(st)
  if (!r) return null
  r.retorted = true
  r.thrown = true
  r.left = 0
  st.throws++
  boost(st)
  return r
}

/** One tap in the match. Returns the tap's index (picks the line), or -1 when no match is on */
export function argueTap(st: VentState): number {
  if (!st.argue) return -1
  const i = st.taps++
  st.idle = 0
  if (st.taps >= ARGUE_TAPS) endArgue(st)
  return i
}

/** Walked off, or out of taps / went quiet: the customer leaves on the next step */
export function endArgue(st: VentState): void {
  if (!st.argue) return
  st.argue.left = 0
  st.argue = null
  boost(st)
}

function boost(st: VentState): void {
  st.vents++
  st.boostLeft = VENT_BOOST_SEC
}

export function ventSpeedFactor(st: VentState): number {
  return st.boostLeft > 0 ? VENT_SPEED : 1
}
