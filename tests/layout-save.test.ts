import { expect, it } from 'vitest'
import { newProgress, parseProgress, progressWithLayout, persistProgress, serializeProgress } from '../game/assets/logic/progress'
import { defaultLayout } from '../game/assets/logic/layout'

it('migrates old saves and repairs only invalid layouts', () => {
  for (const v of [1, 2, 3]) {
    const p = parseProgress(JSON.stringify({ v, day: 7, best: [3, 2], coins: 80, owned: ['fryer'], layout: { version: 1, stations: {} } }))
    expect(p.day).toBe(7); expect(p.coins).toBe(80); expect(p.owned).toEqual(['fryer'])
    expect(p.layout).toEqual(defaultLayout())
  }
  const p = newProgress(); p.layout.stations.fridge = { x: 4.5, z: 0, quarterTurn: 0 }
  expect(parseProgress(serializeProgress(p)).layout).toEqual(p.layout)
  p.layout.stations.assembly = { x: 6.25, z: -2.5, quarterTurn: 0 }
  expect(parseProgress(serializeProgress(p)).layout).toEqual(defaultLayout())
})
it('writes atomically once without mutating the original', () => {
  const p = newProgress(), d = defaultLayout(); d.stations.fridge.x = 4.5
  const next = progressWithLayout(p, d); d.stations.fridge.x = 0
  let writes = 0
  expect(persistProgress(next, () => { writes++; throw Error('quota') })).toBe(false)
  expect(writes).toBe(1); expect(p.layout).toEqual(defaultLayout()); expect(next.layout.stations.fridge.x).toBe(4.5)
})
