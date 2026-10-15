import { expect, it } from 'vitest'
import { beginLayoutEdit, editLayout, editorFrame } from '../game/assets/logic/layout-editor'
import { defaultLayout } from '../game/assets/logic/layout'

it('owns a gesture, snaps one moved device and records one undo', () => {
  const s = beginLayoutEdit(defaultLayout(), [])
  editLayout(s, { type: 'begin', id: 'fridge', pointer: 1, point: { x: 3.5, z: -2.5 } })
  editLayout(s, { type: 'move', pointer: 2, point: { x: 0, z: 0 } })
  expect(s.draft).toEqual(s.original)
  editLayout(s, { type: 'move', pointer: 1, point: { x: 4.12, z: -.26 } })
  editLayout(s, { type: 'default' })
  editLayout(s, { type: 'end', pointer: 1 })
  expect(s.draft.stations.fridge).toEqual({ x: 4, z: -.5, quarterTurn: 0 })
  expect(s.draft.stations.extinguisher.z).toBe(3.25); expect(s.history).toHaveLength(1)
  editLayout(s, { type: 'undo' }); expect(s.draft).toEqual(s.original)
})
it('rolls back cancelled touches and protects locked and sliding fixtures', () => {
  const s = beginLayoutEdit(defaultLayout(), [])
  expect(editLayout(s, { type: 'select', id: 'fryer' })).toBe(false)
  editLayout(s, { type: 'begin', id: 'fridge', pointer: 1, point: { x: 3.5, z: -2.5 } })
  editLayout(s, { type: 'move', pointer: 1, point: { x: 0, z: 0 } })
  editLayout(s, { type: 'cancel-pointer', pointer: 1 }); expect(s.draft).toEqual(s.original); expect(s.history).toHaveLength(0)
  editLayout(s, { type: 'select', id: 'register' }); expect(editLayout(s, { type: 'rotate' })).toBe(false)
  editLayout(s, { type: 'begin', id: 'register', pointer: 1, point: { x: -3.5, z: 3.1 } })
  editLayout(s, { type: 'move', pointer: 1, point: { x: -2, z: 0 } }); editLayout(s, { type: 'end', pointer: 1 })
  expect(s.draft.stations.register.z).toBe(3.1)
})
it('limits history and restores defaults as one undoable operation', () => {
  const s = beginLayoutEdit(defaultLayout(), [])
  editLayout(s, { type: 'select', id: 'grill' })
  for (let i = 0; i < 25; i++) editLayout(s, { type: 'rotate' })
  expect(s.history).toHaveLength(20)
  const before = JSON.stringify(s.draft)
  editLayout(s, { type: 'default' }); expect(s.draft).toEqual(s.original)
  editLayout(s, { type: 'undo' }); expect(JSON.stringify(s.draft)).toBe(before)
})
it('fits five separate touch targets within every safe viewport', () => {
  for (const [width, height] of [[1024, 768], [1280, 720], [1560, 720]]) {
    const f = editorFrame({ width: width!, height: height!, inset: { left: 25, right: 180, top: 50, bottom: 20 } })
    expect(f.buttons).toHaveLength(5); expect(f.work.h).toBeGreaterThan(100)
    for (const b of f.buttons) { expect(b.w).toBeGreaterThanOrEqual(88); expect(b.x).toBeGreaterThanOrEqual(25); expect(b.x + b.w).toBeLessThanOrEqual(width! - 180) }
  }
})
