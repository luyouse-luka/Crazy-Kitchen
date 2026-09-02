/**
 * A7 layering probe. Zero `cc` imports on purpose: the same file runs under
 * Node (`pnpm a7`) and inside the WeChat build, and the two outputs must match
 * character for character. Divergence means the Cocos toolchain compiles
 * `logic/` differently from vitest — which is exactly what A7 exists to catch.
 *
 * Rule (3): this touches only the public API listed in logic/API.md.
 */

import { COOK_LEVELS, INGREDIENTS, MOODS, STATION_KINDS } from '../logic/types'
import type { CookWindows, OrderSpec } from '../logic/types'
import { addCookedPatty, addIngredient, cookLevelAt, createBurger, hasCore } from '../logic/recipe'
import { judge } from '../logic/order'
import { createRng, nextInt } from '../logic/rng'
import { LAST_DAY, difficultyForDay, starsFor } from '../logic/difficulty'
import { circleOverlapsAABB, inTriggerRange } from '../logic/collision'
import type { AABB } from '../logic/collision'
import { dist, rotateY, set } from '../logic/vec2'
import type { Vec2 } from '../logic/vec2'
import { defaultSimConfig, runDay } from '../logic/sim'

/** Grep anchor in the build artifact. Renaming it breaks the ROADMAP §A7 check. */
export const A7_MARKER = 'A7_LOGIC_LINKED_KITCHEN_CHAOS'

const WINDOWS: CookWindows = { rareAt: 4, mediumAt: 7, wellAt: 10, burntAt: 14 }

const SPEC: OrderSpec = {
  required: ['bun', 'patty', 'cheese'],
  banned: ['pickle'],
  doneness: 'medium',
  patience: 45,
}

/** One line per module, so a mismatch names the module that broke. */
export function a7Lines(): string[] {
  const out: string[] = [A7_MARKER]

  out.push(
    `types ing=${INGREDIENTS.length} cook=${COOK_LEVELS.join('/')} mood=${MOODS.length} station=${STATION_KINDS.join('/')}`,
  )

  const burger = createBurger()
  addIngredient(burger, 'bun')
  addIngredient(burger, 'cheese')
  addCookedPatty(burger, cookLevelAt(8, WINDOWS))
  out.push(`recipe core=${hasCore(burger)} cook=${burger.cook} n=${burger.ingredients.length}`)

  const v = judge(burger, SPEC)
  out.push(`order ok=${v.ok} cookOk=${v.cookOk} missing=[${v.missing}] forbidden=[${v.forbidden}]`)

  const rng = createRng(1234)
  out.push(`rng ${nextInt(rng, 100)},${nextInt(rng, 100)},${nextInt(rng, 100)},${nextInt(rng, 100)}`)

  const a: Vec2 = set({ x: 0, z: 0 }, 3, 4)
  const rot: Vec2 = rotateY({ x: 0, z: 0 }, a, Math.PI / 2)
  const box: AABB = { center: { x: 1.5, z: 1.5 }, halfX: 0.5, halfZ: 0.5 }
  out.push(
    `vec2/collision dist=${dist(a, { x: 0, z: 0 }).toFixed(3)} rot=${rot.x.toFixed(3)},${rot.z.toFixed(3)} hit=${circleOverlapsAABB({ x: 0, z: 0 }, 1.5, box)} reach=${inTriggerRange({ x: 0, z: 0 }, a, 5)}`,
  )

  const d = difficultyForDay(LAST_DAY)
  out.push(`difficulty lastDay=${d.day} stars=${d.stars.one}/${d.stars.two}/${d.stars.three} got=${starsFor(9, LAST_DAY)}`)

  const r = runDay(defaultSimConfig())
  out.push(
    `sim arrived=${r.arrived} served=${r.served} wrong=${r.wrong} timedOut=${r.timedOut} burnt=${r.burnt} peak=${r.peakConcurrent} rate=${r.completionRate.toFixed(4)}`,
  )

  return out
}
