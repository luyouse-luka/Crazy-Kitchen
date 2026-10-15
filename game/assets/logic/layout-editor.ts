import { defaultLayout, parseLayout } from './layout'
import { LAYOUT_FIXTURES } from './scene-layout'
import type { LayoutConfig, LayoutId, QuarterTurn } from './scene-layout'
import type { Vec2 } from './vec2'

export interface LayoutEdit {
  original: LayoutConfig; draft: LayoutConfig; owned: readonly string[]; selected: LayoutId | null
  history: LayoutConfig[]
  gesture: { pointer: number; id: LayoutId; start: LayoutConfig; offset: Vec2 } | null
}
export type LayoutCommand =
  | { type: 'select'; id: LayoutId }
  | { type: 'begin'; id: LayoutId; pointer: number; point: Vec2 }
  | { type: 'move'; pointer: number; point: Vec2 }
  | { type: 'end' | 'cancel-pointer'; pointer: number }
  | { type: 'rotate' | 'undo' | 'default' }
const copy = (l: LayoutConfig) => parseLayout(l)!
export function beginLayoutEdit(layout: LayoutConfig, owned: readonly string[]): LayoutEdit {
  return { original: copy(layout), draft: copy(layout), owned: [...owned], selected: null, history: [], gesture: null }
}
export function editLayout(s: LayoutEdit, c: LayoutCommand): boolean {
  const push = (before: LayoutConfig) => { s.history.push(before); if (s.history.length > 20) s.history.shift() }
  if (s.gesture) {
    if (!('pointer' in c) || c.pointer !== s.gesture.pointer) return false
    const g = s.gesture
    if (c.type === 'move') {
      if (!Number.isFinite(c.point.x) || !Number.isFinite(c.point.z)) return false
      const p = s.draft.stations[g.id], slide = LAYOUT_FIXTURES[g.id].mode === 'slide'
      const x = Math.round((c.point.x + g.offset.x) * 2) / 2, z = slide ? p.z : Math.round((c.point.z + g.offset.z) * 2) / 2
      if (p.x === x && p.z === z) return false
      p.x = x; p.z = z; return true
    }
    if (c.type === 'end') { if (JSON.stringify(g.start) !== JSON.stringify(s.draft)) push(g.start); s.gesture = null; return true }
    if (c.type === 'cancel-pointer') { s.draft = g.start; s.gesture = null; return true }
    return false
  }
  if (c.type === 'select' || c.type === 'begin') {
    const f = LAYOUT_FIXTURES[c.id]
    if (f.purchase && !s.owned.includes(f.purchase)) return false
    s.selected = c.id
    if (c.type === 'begin') {
      const p = s.draft.stations[c.id]
      s.gesture = { pointer: c.pointer, id: c.id, start: copy(s.draft), offset: { x: p.x - c.point.x, z: p.z - c.point.z } }
    }
    return true
  }
  if (c.type === 'undo') { const prev = s.history.pop(); if (!prev) return false; s.draft = prev; return true }
  if (c.type === 'default') { if (JSON.stringify(s.draft) === JSON.stringify(defaultLayout())) return false; push(copy(s.draft)); s.draft = defaultLayout(); return true }
  if (c.type === 'rotate' && s.selected && LAYOUT_FIXTURES[s.selected].mode === 'free') {
    push(copy(s.draft)); const p = s.draft.stations[s.selected]; p.quarterTurn = ((p.quarterTurn + 1) % 4) as QuarterTurn; return true
  }
  return false
}
export interface EditorViewport { width: number; height: number; inset: { left: number; right: number; top: number; bottom: number } }
export interface EditorFrame {
  buttons: Array<{ id: 'cancel' | 'save' | 'rotate' | 'undo' | 'default'; x: number; y: number; w: number; h: number }>
  work: { x: number; y: number; w: number; h: number }; orthoHeight: number; focus: Vec2
}
export function editorFrame(v: EditorViewport): EditorFrame {
  const left = v.inset.left + 16, right = v.width - v.inset.right - 16, bottom = v.inset.bottom + 16, top = v.height - v.inset.top - 16
  const w = Math.min(180, (right - left - 24) / 3), h = 88
  const button = (id: EditorFrame['buttons'][number]['id'], x: number, y: number) => ({ id, x, y, w, h })
  const work = { x: left, y: bottom + h + 48, w: right - left, h: top - bottom - 2 * h - 90 }
  return { buttons: [button('cancel', left, top - h), button('save', right - w, top - h),
    button('rotate', left, bottom), button('undo', (left + right - w) / 2, bottom), button('default', right - w, bottom)],
    work, orthoHeight: Math.max(7, 6.5 * v.height / Math.max(100, work.h), 7.5 * v.height / work.w), focus: { x: 2, z: -1 } }
}
