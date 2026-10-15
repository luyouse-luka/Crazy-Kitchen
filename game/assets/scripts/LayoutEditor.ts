import { Camera, Color, geometry, Graphics, Label, Node, sys, UITransform, Vec3, view } from 'cc'
import { beginLayoutEdit, editLayout, editorFrame } from '../logic/layout-editor'
import type { EditorFrame, EditorViewport } from '../logic/layout-editor'
import { buildLayoutGeometry, validateLayout } from '../logic/layout'
import { LAYOUT_FIXTURES, LAYOUT_IDS } from '../logic/scene-layout'
import type { LayoutConfig, LayoutId } from '../logic/scene-layout'
import { drawPanel, UI_THEME, uiColor, uiLabel, uiNode } from './ui/UiTheme'

export interface LayoutEditorCallbacks { preview: (layout: LayoutConfig) => void; save: (layout: LayoutConfig) => boolean; cancel: () => void }
export class LayoutEditor {
  private static hinted = false
  readonly node: Node
  readonly state
  buttons: EditorFrame['buttons'] = []
  private frame!: EditorFrame
  private viewport!: EditorViewport
  private overlay: Graphics
  private status: Label
  private toolbar: Node[] = []
  private ray = new geometry.Ray()
  private uiPoint = new Vec3()
  private originalCamera: { p: Vec3; ortho: number }
  private press: { pointer: number; id: EditorFrame['buttons'][number]['id'] } | null = null
  private hint = '点工位选择 · 拖动移动 · 旋转改变朝向 · 绿色可保存'
  constructor(private parent: Node, private camera: Camera, layout: LayoutConfig, owned: readonly string[], private callbacks: LayoutEditorCallbacks) {
    this.state = beginLayoutEdit(layout, owned)
    try {
      if (sys.localStorage.getItem('kc.layoutHintSeen')) LayoutEditor.hinted = true
      else sys.localStorage.setItem('kc.layoutHintSeen', '1')
    } catch { /* Keep editing usable without preference storage. */ }
    if (LayoutEditor.hinted) this.hint = '绿色可保存 · 红色请调整'
    LayoutEditor.hinted = true
    this.originalCamera = { p: camera.node.worldPosition.clone(), ortho: camera.orthoHeight }
    this.node = uiNode(parent, 'UI_LayoutEditor')
    this.overlay = uiNode(this.node, 'Footprints').addComponent(Graphics)
    this.status = uiLabel(this.node, 'Status', 22, 1000, 60)
    for (const [id, label] of [['cancel', '取消'], ['save', '保存布局'], ['rotate', '旋转'], ['undo', '撤销'], ['default', '恢复默认']]) {
      const n = uiNode(this.node, id!, 180, 88), g = n.addComponent(Graphics)
      drawPanel(g, 180, 88, id === 'save' ? UI_THEME.accent : UI_THEME.raised)
      const l = uiLabel(n, 'Label', 24, 174, 60); l.string = label!
      if (id === 'save') l.color = uiColor(UI_THEME.surface)
      this.toolbar.push(n)
    }
  }
  resize(v: EditorViewport): void {
    this.viewport = v; this.frame = editorFrame(v); this.buttons = this.frame.buttons
    this.camera.orthoHeight = this.frame.orthoHeight
    const base = this.originalCamera.p
    const forward = this.camera.node.forward, distance = -base.y / forward.y
    this.camera.node.setWorldPosition(2 - forward.x * distance, base.y, -1 - forward.z * distance)
    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i]!, n = this.toolbar[i]!
      n.setPosition(b.x + b.w / 2 - v.width / 2, b.y + b.h / 2 - v.height / 2, 0)
      n.setScale(b.w / 180, 1, 1)
    }
    this.status.node.setPosition((v.inset.left - v.inset.right) / 2, v.height / 2 - v.inset.top - 136, 0)
    this.status.node.getComponent(UITransform)!.width = v.width - v.inset.left - v.inset.right - 32
    this.draw()
  }
  private ground(x: number, y: number) {
    const v = view.getVisibleSize(), pixels = view.getVisibleSizeInPixel()
    this.camera.screenPointToRay(x * pixels.width / v.width, y * pixels.height / v.height, this.ray)
    if (Math.abs(this.ray.d.y) < 1e-8) return null
    const t = -this.ray.o.y / this.ray.d.y
    return t < 0 ? null : { x: this.ray.o.x + this.ray.d.x * t, z: this.ray.o.z + this.ray.d.z * t }
  }
  private button(x: number, y: number) { return this.buttons.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) }
  down(pointer: number, x: number, y: number): void {
    const v = view.getVisibleSize(), pixels = view.getVisibleSizeInPixel()
    x *= v.width / pixels.width; y *= v.height / pixels.height
    if (this.state.gesture || this.press) return
    const b = this.button(x, y)
    if (b) { this.press = { pointer, id: b.id }; return }
    const p = this.ground(x, y)
    if (!p) return
    const geometry = buildLayoutGeometry(this.state.draft)
    let hit: LayoutId | null = null, distance = Infinity
    for (const id of LAYOUT_IDS) {
      const f = LAYOUT_FIXTURES[id]
      if (f.purchase && !this.state.owned.includes(f.purchase)) continue
      const box = geometry.fixtures[id], pos = box.center
      // Pick the projected top footprint, with a small touch tolerance.
      this.camera.worldToScreen(new Vec3(pos.x, .7, pos.z), this.uiPoint)
      const d = Math.hypot(this.uiPoint.x * v.width / pixels.width - x, this.uiPoint.y * v.height / pixels.height - y)
      if (d < distance && d < 42) { distance = d; hit = id }
    }
    if (hit) { editLayout(this.state, { type: 'begin', id: hit, pointer, point: p }); this.draw() }
  }
  move(pointer: number, x: number, y: number): void {
    const v = view.getVisibleSize(), pixels = view.getVisibleSizeInPixel()
    x *= v.width / pixels.width; y *= v.height / pixels.height
    const p = this.ground(x, y)
    if (p && editLayout(this.state, { type: 'move', pointer, point: p })) this.changed()
  }
  up(pointer: number): void {
    if (this.press?.pointer === pointer) {
      const id = this.press.id; this.press = null
      if (id === 'cancel') { this.callbacks.cancel(); return }
      if (id === 'save') {
        if (!validateLayout(this.state.draft, this.state.owned).ok) { this.draw(); return }
        if (!this.callbacks.save(this.state.draft)) { this.hint = '布局未保存，请重试'; this.draw() }
        return
      }
      if (editLayout(this.state, { type: id })) this.changed()
    } else if (editLayout(this.state, { type: 'end', pointer })) this.draw()
  }
  cancelPointer(pointer?: number): void {
    if (pointer === undefined || this.press?.pointer === pointer) this.press = null
    const g = this.state.gesture
    if (g && (pointer === undefined || g.pointer === pointer)) { editLayout(this.state, { type: 'cancel-pointer', pointer: g.pointer }); this.changed() }
  }
  private changed(): void { this.callbacks.preview(this.state.draft); this.draw() }
  private draw(): void {
    if (!this.viewport) return
    const checked = validateLayout(this.state.draft, this.state.owned), geometry = buildLayoutGeometry(this.state.draft)
    const g = this.overlay; g.clear(); g.lineWidth = 2
    const project = (x: number, y: number, z: number) => {
      this.camera.convertToUINode(new Vec3(x, y, z), this.parent, this.uiPoint)
      return { x: this.uiPoint.x, y: this.uiPoint.y }
    }
    g.strokeColor = new Color(160, 205, 200, 55)
    for (let x = -4; x <= 8; x += .5) { const a = project(x, .02, -3), b = project(x, .02, 3.6); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y) }
    for (let z = -3; z <= 3.6; z += .5) { const a = project(-4, .02, z), b = project(8, .02, z); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y) }
    g.stroke()
    for (const id of LAYOUT_IDS) {
      const f = LAYOUT_FIXTURES[id]
      if (f.purchase && !this.state.owned.includes(f.purchase)) continue
      const b = geometry.fixtures[id]
      g.strokeColor = id === this.state.selected ? checked.ok ? new Color(85, 240, 170) : new Color(255, 100, 100) : new Color(225, 235, 230, 150)
      g.lineWidth = id === this.state.selected ? 4 : 1
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => project(b.center.x + x! * b.halfX, .75, b.center.z + z! * b.halfZ))
      g.moveTo(corners[0]!.x, corners[0]!.y)
      for (const p of corners.slice(1)) g.lineTo(p.x, p.y)
      g.close(); g.stroke()
    }
    const selected = this.state.selected ? LAYOUT_FIXTURES[this.state.selected].label : '调整厨房布局'
    this.status.string = `${selected} · ${checked.ok ? this.hint : checked.issues[0]!.message}`
    this.status.color = checked.ok ? Color.WHITE : new Color(255, 160, 145)
  }
  destroy(): void { this.camera.node.setWorldPosition(this.originalCamera.p); this.camera.orthoHeight = this.originalCamera.ortho; this.node.active = false; this.node.destroy() }
}
