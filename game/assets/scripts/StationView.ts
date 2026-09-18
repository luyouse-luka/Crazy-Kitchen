import {
  _decorator,
  Camera,
  Component,
  EventKeyboard,
  EventMouse,
  EventTouch,
  KeyCode,
  Game,
  Input,
  Label,
  Node,
  UITransform,
  Vec2 as CCVec2,
  Vec3,
  Widget,
  find,
  game,
  input,
  view,
} from 'cc'
import {
  DEFAULT_ACTION,
  DEFAULT_STICK,
  TouchRouter,
  panelChildZone,
  screenToCanvasX,
  screenToCanvasY,
  uiRectToCaptureZone,
} from '../logic/input'
import type { CaptureZone } from '../logic/input'
import { ORTHO_HEIGHT, effectiveOrthoHeight, focusBounds, focusForPlayer } from '../logic/camera'
import type { FocusBounds } from '../logic/camera'
import {
  createKitchen,
  discard,
  interact,
  resetKitchen,
  stationInReach,
  stepKitchen,
} from '../logic/kitchen'
import type { BlockReason, KitchenState } from '../logic/kitchen'
import { createShift, resetShift, settleServe, shiftResult, stepShift, timeLeft } from '../logic/shift'
import type { ShiftState } from '../logic/shift'
import { matchCustomer } from '../logic/customer'
import type { Customer } from '../logic/customer'
import { difficultyForDay, starsFor } from '../logic/difficulty'
import { COOK_LABEL, INGREDIENT_LABEL } from '../logic/types'
import { createMovement, stepMovement } from '../logic/movement'
import type { MovementState } from '../logic/movement'
import { DEFAULT_COOK } from '../logic/recipe'
import { INGREDIENTS } from '../logic/types'
import type { Station, StationKind } from '../logic/types'

const { ccclass, property } = _decorator

/** Scene node name -> logic station kind. Names are fixed by ROADMAP §6.2. */
const STATION_KINDS: Record<string, StationKind> = {
  Station_Fridge: 'fridge',
  Station_Grill: 'grill',
  Station_Assembly: 'assembly',
  Station_Serve: 'serve',
}

/** Scene paths resolved at start. `pnpm scene` checks every one of them against the
 *  actual .scene, so a rename shows up before the editor is even opened. */
const NODES = {
  kitchen: 'Kitchen',
  player: 'Actors/Player',
  camera: 'Main Camera',
  joystick: 'Canvas/UI_Joystick',
  discard: 'Canvas/UI_DiscardButton',
  panel: 'Canvas/UI_FridgePanel',
  time: 'Canvas/UI_HUD/Label_Time',
  score: 'Canvas/UI_HUD/Label_Score',
  orders: 'Canvas/UI_HUD/UI_Orders',
  result: 'Canvas/UI_Result',
  resultTitle: 'Canvas/UI_Result/Panel/Title',
  resultBody: 'Canvas/UI_Result/Panel/Body',
  again: 'Canvas/UI_Result/Panel/Btn_Again',
}

/**
 * 一局多长，秒。M2 只要证明「有始有终有结算」这个闭环成立；
 * 正式局长是 sim 标定用的 210s（difficulty.ts 的 CALIBRATION_SEC），留给 M4 一起定。
 * 星级线会按这个时长按比例缩，见 starsFor 的第三个参数。
 */
const SHIFT_SEC = 60

/** 第几天的难度。M2 固定第 1 天，接上存档后改成读进度 */
const SHIFT_DAY = 1

/** 场景里建了几张订单卡。难度曲线的 maxConcurrent 上限是 6，卡按它备足 */
const ORDER_CARDS = 6

/** Visible size is polled, not read every frame — getVisibleSize() allocates. */
const RESIZE_POLL_SEC = 0.25

/** Touch ids for the desktop fallbacks. Real touch ids start at 0 and go up. */
const MOUSE_ID = -99
const KEY_STICK_ID = -98
const KEY_ACTION_ID = -97

/** Where the synthetic fingers press. Left half for the stick; upper right for the action
 *  key, clear of the action and discard buttons which both sit bottom-right. */
const KEY_STICK_ORIGIN = [0.25, 0.4]
const KEY_ACTION_POINT = [0.75, 0.8]

/**
 * Wires logic/ to the scene: touch -> TouchRouter -> movement + kitchen -> nodes.
 *
 * Drop it on Canvas. Every node is looked up by the names in docs/m2-scene-guide.md §2.1;
 * a missing one disables the component with a console error rather than failing quietly.
 */
@ccclass('StationView')
export class StationView extends Component {
  @property({ tooltip: '工位方块半径之外还能够着多少米。手感旋钮，真机上调' })
  reach = 0.7

  /** Last blocked interaction. No toast node exists yet; HUD can read this later. */
  lastBlock: BlockReason = 'none'

  /**
   * Read off Main Camera, never guessed: stickToWorld maps screen-up onto
   * (-sin yaw, -cos yaw), and the camera's own forward on XZ is (-sin eulerY, -cos eulerY),
   * so the two are equal exactly when yaw === eulerY in radians. Hardcoding +45 against a
   * -45 camera is a clean 90 degree error — W walks left — and rotating the camera later
   * would silently break movement again.
   */
  private cameraYaw = 0

  private router!: TouchRouter
  private kitchen!: KitchenState
  private movement!: MovementState
  private fridge: Station | null = null

  private playerNode!: Node
  private cameraNode!: Node
  private cameraComp!: Camera
  /** Camera position when focus sits at the origin — i.e. whatever the scene was saved with. */
  private camOffset = new Vec3()
  private camBounds: FocusBounds = focusBounds(ORTHO_HEIGHT, 16 / 9)
  private camFocus = { x: 0, z: 0 }
  private joystickNode!: Node
  private discardNode!: Node
  private panelNode!: Node
  private slotNodes: Node[] = []

  private shift!: ShiftState
  private orderCards: Node[] = []
  private orderTexts: Label[] = []
  private orderBars: Node[] = []
  /** 每张卡当前画的是哪位顾客。只在换人时重算文本，省掉每帧的字符串拼接（铁律②） */
  private orderShown: number[] = []
  private timeLabel!: Label
  private scoreLabel!: Label
  private resultNode!: Node
  private resultTitle!: Label
  private resultBody!: Label
  private againNode!: Node
  private resultOpen = false
  /** 上一帧画出来的秒数与分数。Label.string 每次赋值都会重排，值没变就别碰 */
  private shownSec = -1
  private shownScore = -1

  private screenW = 0
  private screenH = 0
  /** Visible design-unit height. Fit Width shrinks it below 720, and the capture-zone
   *  scale is screenH / designH — hardcoding 720 misses on every non-16:9 device. */
  private designH = 720
  private resizeIn = 0
  private panelOpen = false
  /** Which zone set is currently published. setCaptureZones voids in-flight fingers, so
   *  it must run on change only — every frame would kill the discard hold. */
  private zonesKey = ''
  private touchPoint = new CCVec2()
  /** Real touches win: on a phone the mouse path never runs, so the two cannot double up. */
  private sawTouch = false
  private mouseDown = false
  private loggedInput = false
  private keys = { w: false, a: false, s: false, d: false }
  private keyStickDown = false
  private spaceDown = false

  override start(): void {
    const kitchenRoot = this.need(NODES.kitchen)
    const camera = this.need(NODES.camera)
    const player = this.need(NODES.player)
    const joystick = this.need(NODES.joystick)
    const discardBtn = this.need(NODES.discard)
    const panel = this.need(NODES.panel)
    const ordersRoot = this.need(NODES.orders)
    const result = this.need(NODES.result)
    const again = this.need(NODES.again)
    const timeLabel = this.label(NODES.time)
    const scoreLabel = this.label(NODES.score)
    const resultTitle = this.label(NODES.resultTitle)
    const resultBody = this.label(NODES.resultBody)
    if (
      !kitchenRoot || !camera || !player || !joystick || !discardBtn || !panel ||
      !ordersRoot || !result || !again || !timeLabel || !scoreLabel || !resultTitle || !resultBody
    ) {
      this.enabled = false
      return
    }
    this.resultNode = result
    this.againNode = again
    this.timeLabel = timeLabel
    this.scoreLabel = scoreLabel
    this.resultTitle = resultTitle
    this.resultBody = resultBody
    this.cameraYaw = (camera.eulerAngles.y * Math.PI) / 180
    const camComp = camera.getComponent(Camera)
    if (!camComp) {
      console.error(`[StationView] ${NODES.camera} 上没有 cc.Camera`)
      this.enabled = false
      return
    }
    this.cameraNode = camera
    this.cameraComp = camComp
    // Read off the node, not from the constant: moving the camera in the editor keeps
    // working, and `pnpm cam` is what stops logic/camera.ts drifting from the scene.
    this.camOffset.set(camera.position)
    this.playerNode = player
    this.joystickNode = joystick
    this.discardNode = discardBtn
    this.panelNode = panel

    for (let i = 0; i < INGREDIENTS.length; i++) {
      const slot = panel.getChildByName(`Slot_${i}`)
      if (!slot) {
        console.error(`[StationView] ${NODES.panel} 底下没有 Slot_${i}`)
        this.enabled = false
        return
      }
      this.slotNodes.push(slot)
    }

    for (let i = 0; i < ORDER_CARDS; i++) {
      const card = ordersRoot.getChildByName(`Order_${i}`)
      const text = card?.getChildByName('Text')?.getComponent(Label)
      const bar = card?.getChildByName('Bar')
      if (!card || !text || !bar) {
        console.error(`[StationView] ${NODES.orders} 底下的 Order_${i} 结构不对（要 Text + Bar）`)
        this.enabled = false
        return
      }
      this.orderCards.push(card)
      this.orderTexts.push(text)
      this.orderBars.push(bar)
      this.orderShown.push(-1)
    }

    const stations = this.readStations(kitchenRoot)
    if (stations.length === 0) {
      console.error(`[StationView] ${NODES.kitchen} 底下一个 Station_* 都没有`)
      this.enabled = false
      return
    }
    this.fridge = stations.find((s) => s.kind === 'fridge') ?? null

    this.kitchen = createKitchen({ stations, cook: { ...DEFAULT_COOK }, grillSlots: 2 })
    const day = difficultyForDay(SHIFT_DAY)
    this.shift = createShift({
      // 每次进游戏换一批单，但同一局内可复现。M4 接存档后改成从存档读
      seed: (Date.now() & 0x7fffffff) || 1,
      durationSec: SHIFT_SEC,
      flow: day.flow,
      orders: day.orders,
    })
    this.resultNode.active = false
    this.movement = createMovement({ stations })
    this.router = new TouchRouter(view.getVisibleSize().width / 2, undefined, DEFAULT_ACTION)
    this.syncScreen()

    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this)
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this)
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this)
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this)
    // Desktop preview: the global input does not turn mouse into touch, and without this
    // the editor preview looks dead while the phone build works.
    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this)
    input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this)
    input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this)
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this)
    game.on(Game.EVENT_HIDE, this.onTouchCancel, this)

    console.log(
      `[StationView] ready — stations=${stations.length} slots=${this.slotNodes.length}` +
        ` screen=${this.screenW}x${this.screenH} cameraYaw=${camera.eulerAngles.y}°` +
        ` orthoHeight=${this.cameraComp.orthoHeight.toFixed(2)}`,
    )
  }

  override onDestroy(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this)
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this)
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this)
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this)
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this)
    input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this)
    input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this)
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this)
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this)
    game.off(Game.EVENT_HIDE, this.onTouchCancel, this)
  }

  // ─────────────────────────── 场景 → logic ───────────────────────────

  /**
   * Stations come from the nodes, never from a second table of numbers: a box drawn in
   * the editor and an AABB written in code drift, and the symptom ("stuck on an invisible
   * wall" / "can't reach a counter I'm touching") looks nothing like a size mismatch.
   * Guide §8 — Cube mesh is 1m, so worldScale is metres.
   */
  private readStations(root: Node): Station[] {
    const out: Station[] = []
    for (const child of root.children) {
      const kind = STATION_KINDS[child.name]
      if (!kind) continue
      const p = child.worldPosition
      const s = child.worldScale
      const halfX = Math.abs(s.x) / 2
      const halfZ = Math.abs(s.z) / 2
      out.push({
        id: child.name,
        kind,
        pos: { x: p.x, z: p.z },
        box: { center: { x: p.x, z: p.z }, halfX, halfZ },
        triggerRange: Math.max(halfX, halfZ) + this.reach,
      })
    }
    return out
  }

  private need(path: string): Node | null {
    const n = find(path)
    if (!n) console.error(`[StationView] 场景里找不到 ${path}（名字见 m2-scene-guide §2.1）`)
    return n
  }

  private label(path: string): Label | null {
    const n = this.need(path)
    if (!n) return null
    const l = n.getComponent(Label)
    if (!l) console.error(`[StationView] ${path} 上没有 cc.Label`)
    return l
  }

  // ─────────────────────────── 触摸 ───────────────────────────

  private route(e: EventTouch, fn: (id: number, x: number, y: number) => void): void {
    const touches = e.getTouches()
    if (touches && touches.length > 0) {
      for (const t of touches) {
        t.getLocation(this.touchPoint)
        fn(t.getID(), this.touchPoint.x, this.touchPoint.y)
      }
      return
    }
    const t = e.touch
    if (!t) return
    t.getLocation(this.touchPoint)
    fn(t.getID(), this.touchPoint.x, this.touchPoint.y)
  }

  private onTouchStart(e: EventTouch): void {
    this.sawTouch = true
    this.firstInput('touch')
    this.route(e, (id, x, y) => this.router.onDown(id, x, y))
  }

  private onTouchMove(e: EventTouch): void {
    this.route(e, (id, x, y) => this.router.onMove(id, x, y))
  }

  private onTouchEnd(e: EventTouch): void {
    this.route(e, (id) => this.router.onUp(id))
  }

  private onTouchCancel(): void {
    this.mouseDown = false
    this.router.cancelAll()
  }

  private onMouseDown(e: EventMouse): void {
    if (this.sawTouch) return
    this.firstInput('mouse')
    this.mouseDown = true
    e.getLocation(this.touchPoint)
    this.router.onDown(MOUSE_ID, this.touchPoint.x, this.touchPoint.y)
  }

  private onMouseMove(e: EventMouse): void {
    if (this.sawTouch || !this.mouseDown) return
    e.getLocation(this.touchPoint)
    this.router.onMove(MOUSE_ID, this.touchPoint.x, this.touchPoint.y)
  }

  private onMouseUp(): void {
    if (this.sawTouch || !this.mouseDown) return
    this.mouseDown = false
    this.router.onUp(MOUSE_ID)
  }

  // ── 键盘（只为桌面预览好操作；真机上没人按，这几条路径不存在）

  private keyFlag(code: number, down: boolean): boolean {
    if (code === KeyCode.KEY_W) this.keys.w = down
    else if (code === KeyCode.KEY_A) this.keys.a = down
    else if (code === KeyCode.KEY_S) this.keys.s = down
    else if (code === KeyCode.KEY_D) this.keys.d = down
    else return false
    return true
  }

  private onKeyDown(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.SPACE) {
      if (this.spaceDown) return
      this.spaceDown = true
      this.firstInput('keyboard')
      this.router.onDown(
        KEY_ACTION_ID,
        this.screenW * KEY_ACTION_POINT[0]!,
        this.screenH * KEY_ACTION_POINT[1]!,
      )
      return
    }
    if (this.keyFlag(e.keyCode, true)) this.firstInput('keyboard')
  }

  private onKeyUp(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.SPACE) {
      if (!this.spaceDown) return
      this.spaceDown = false
      this.router.onUp(KEY_ACTION_ID)
      return
    }
    this.keyFlag(e.keyCode, false)
  }

  /**
   * WASD -> a synthetic finger on the left half, so the keys go through the same router,
   * deadzone and camera mapping as a real thumb. Nothing downstream knows the difference.
   */
  private syncKeyStick(): void {
    let dx = 0
    let dy = 0
    if (this.keys.a) dx -= 1
    if (this.keys.d) dx += 1
    if (this.keys.s) dy -= 1
    if (this.keys.w) dy += 1
    // The panel freezes movement anyway, and the full-screen cancel zone would swallow
    // this press and close the panel on a stray W.
    if (this.panelOpen || (dx === 0 && dy === 0)) {
      if (this.keyStickDown) {
        this.keyStickDown = false
        this.router.onUp(KEY_STICK_ID)
      }
      return
    }
    const ox = this.screenW * KEY_STICK_ORIGIN[0]!
    const oy = this.screenH * KEY_STICK_ORIGIN[1]!
    const len = Math.sqrt(dx * dx + dy * dy)
    // radius exactly saturates magnitude, so a key press is always a full push
    const r = DEFAULT_STICK.radius
    if (!this.keyStickDown) {
      this.keyStickDown = true
      this.router.onDown(KEY_STICK_ID, ox, oy)
    }
    this.router.onMove(KEY_STICK_ID, ox + (dx / len) * r, oy + (dy / len) * r)
  }

  /** One line the first time anything arrives — tells a dead preview from a dead component. */
  private firstInput(src: string): void {
    if (this.loggedInput) return
    this.loggedInput = true
    console.log(`[StationView] first input via ${src}`)
  }

  // ─────────────────────────── 每帧 ───────────────────────────

  override update(dt: number): void {
    this.resizeIn -= dt
    if (this.resizeIn <= 0) {
      this.resizeIn = RESIZE_POLL_SEC
      this.syncScreen()
    }

    // 打烊后世界停住，只剩「再来一局」一个去处
    if (this.resultOpen) {
      if (this.router.zone('again')?.tapped) this.restart()
      this.router.tick(dt)
      this.refreshZones()
      return
    }

    this.syncKeyStick()
    stepKitchen(this.kitchen, dt)
    stepShift(this.shift, dt)
    // World keeps running while the panel is open; the stick is frozen because every
    // touch lands in a capture zone, so this is a no-op then.
    stepMovement(this.movement, this.router.stick, this.cameraYaw, dt)

    // Read the pulses BEFORE tick(), never after: touch events land between frames and
    // tick() clears last frame's pulses on the way in, so reading after it never sees a
    // tap. holdStarted still works (tick produces it), so the symptom is "walks fine,
    // long-press fine, taps dead" — which looks like one unwired button, not an ordering bug.
    if (this.panelOpen) this.tickPanel()
    else this.tickPlay()
    this.router.tick(dt)

    if (this.shift.over) {
      this.showResult()
      return
    }

    this.refreshZones()
    this.syncNodes()
    this.syncHud()
  }

  private syncScreen(): void {
    // Touch coords are physical pixels, getVisibleSize() is design units. Under Fit Width
    // the two differ by the view scale, so zones built from design units miss on device.
    const px = view.getVisibleSizeInPixel()
    if (px.width === this.screenW && px.height === this.screenH) return
    this.screenW = px.width
    this.screenH = px.height
    this.designH = view.getVisibleSize().height
    this.router.setSplitX(px.width / 2)
    this.zonesKey = ''

    // Ortho height comes from the real aspect, not from the editor value: a near-square
    // screen needs a wider frame, otherwise following throws the grill off-screen (`pnpm cam`).
    const aspect = px.width / px.height
    const h = effectiveOrthoHeight(aspect)
    this.cameraComp.orthoHeight = h
    this.camBounds = focusBounds(h, aspect)
  }

  private tickPlay(): void {
    if (this.router.zone('discard')?.holdStarted) {
      this.report(discard(this.kitchen).reason)
      return
    }
    if (!this.router.action.tapped) return

    const station = stationInReach(this.kitchen, this.movement.pos)
    if (!station) return
    if (station.kind === 'fridge') {
      // 手上拿着生料也让开 —— 点错一样食材不该逼玩家先跑一趟垃圾桶。
      // 盘子例外，换食材等于把整个汉堡扔了，那一下要玩家自己按 discard。
      if (this.kitchen.carry.kind === 'plate') return this.report('hands-full')
      this.openPanel()
      return
    }
    if (station.kind === 'serve') {
      // 谁接这一盘是玩法规则，不在组件里挑：logic 先找吃得下的，找不到砸给最急的那位
      const c = matchCustomer(this.shift.flow, this.kitchen.burger)
      const r = interact(this.kitchen, this.movement.pos, station, { spec: c?.spec })
      if (r.kind === 'serve' && c && r.verdict) settleServe(this.shift, c, r.verdict)
      return this.report(r.reason)
    }
    this.report(interact(this.kitchen, this.movement.pos, station).reason)
  }

  private tickPanel(): void {
    for (let i = 0; i < this.slotNodes.length; i++) {
      if (!this.router.zone(`slot${i}`)?.tapped) continue
      const fridge = this.fridge
      this.closePanel()
      if (!fridge) return this.report('unsupported')
      // Picking always closes the panel — one tap, even when the pick is refused.
      this.report(
        interact(this.kitchen, this.movement.pos, fridge, { ingredient: INGREDIENTS[i]! }).reason,
      )
      return
    }
    if (this.router.zone('panel-outside')?.tapped) this.closePanel()
  }

  private openPanel(): void {
    this.panelOpen = true
    // Freezes the stick: the thumb still on screen is dropped and cannot re-arm, since
    // the next press lands on the full-screen cancel zone.
    this.router.cancelAll()
  }

  private closePanel(): void {
    this.panelOpen = false
    this.router.cancelAll()
  }

  private report(reason: BlockReason): void {
    this.lastBlock = reason
    if (reason !== 'none') console.log(`[StationView] blocked: ${reason}`)
  }

  // ─────────────────────────── logic → 场景 ───────────────────────────

  private refreshZones(): void {
    const carrying = this.kitchen.carry.kind !== 'none'
    const mode = this.resultOpen ? 'result' : this.panelOpen ? 'panel' : carrying ? 'discard' : 'none'
    const key = `${mode}|${this.screenW}x${this.screenH}`
    if (key === this.zonesKey) return
    this.zonesKey = key

    // Widgets only align on active nodes, and the zone is built from the aligned position.
    this.panelNode.active = this.panelOpen && !this.resultOpen
    this.discardNode.active = carrying && !this.panelOpen && !this.resultOpen

    const zones: CaptureZone[] = []
    if (this.resultOpen) {
      const t = this.againNode.getComponent(UITransform)
      const p = this.againNode.parent
      const a = this.againNode.position
      if (t && p) {
        zones.push(
          panelChildZone('again', p.position.x, p.position.y, a.x, a.y, t.width, t.height,
            this.screenW, this.screenH, this.designH),
        )
      }
      // 兜底吞掉其余触摸：打烊了还能走路会让人以为局没结束
      zones.push({ id: 'result-outside', x: 0, y: 0, w: this.screenW, h: this.screenH })
    } else if (this.panelOpen) {
      const p = this.panelNode.position
      for (let i = 0; i < this.slotNodes.length; i++) {
        const slot = this.slotNodes[i]!
        const t = slot.getComponent(UITransform)
        if (!t) continue
        zones.push(
          panelChildZone(
            `slot${i}`,
            p.x,
            p.y,
            slot.position.x,
            slot.position.y,
            t.width,
            t.height,
            this.screenW,
            this.screenH,
            this.designH,
          ),
        )
      }
      // Last, so slots win the hit test: anywhere else cancels.
      zones.push({ id: 'panel-outside', x: 0, y: 0, w: this.screenW, h: this.screenH })
    } else if (carrying) {
      this.discardNode.getComponent(Widget)?.updateAlignment()
      const t = this.discardNode.getComponent(UITransform)
      const d = this.discardNode.position
      if (t) {
        zones.push(
          uiRectToCaptureZone('discard', d.x, d.y, t.width, t.height, this.screenW, this.screenH, this.designH),
        )
      }
    }
    this.router.setCaptureZones(zones)
  }

  /** 订单卡文本。只在换人时调用，不在每帧热路径上 */
  private static orderText(c: Customer): string {
    const req = c.spec.required.map((i) => INGREDIENT_LABEL[i]).join(' ')
    const ban =
      c.spec.banned.length > 0
        ? `\n忌 ${c.spec.banned.map((i) => INGREDIENT_LABEL[i]).join(' ')}`
        : ''
    return `${req}\n${COOK_LABEL[c.spec.doneness]}${ban}`
  }

  private syncHud(): void {
    const sec = Math.ceil(timeLeft(this.shift))
    if (sec !== this.shownSec) {
      this.shownSec = sec
      this.timeLabel.string = `${sec}`
    }
    if (this.shift.served !== this.shownScore) {
      this.shownScore = this.shift.served
      this.scoreLabel.string = `完成 ${this.shift.served}`
    }

    const cs = this.shift.flow.customers
    for (let i = 0; i < this.orderCards.length; i++) {
      const c = i < cs.length ? cs[i] : undefined
      const card = this.orderCards[i]!
      const on = c !== undefined && c.active
      if (card.active !== on) card.active = on
      if (!on || !c) {
        this.orderShown[i] = -1
        continue
      }
      if (this.orderShown[i] !== c.id) {
        this.orderShown[i] = c.id
        this.orderTexts[i]!.string = StationView.orderText(c)
      }
      // Bar 的锚点在左端，所以缩 x 就是从左往右退
      const k = c.patienceMax > 0 ? c.patienceLeft / c.patienceMax : 0
      this.orderBars[i]!.setScale(k > 0 ? k : 0, 1, 1)
    }
  }

  private showResult(): void {
    this.resultOpen = true
    this.panelOpen = false
    this.router.cancelAll()

    const r = shiftResult(this.shift)
    const stars = starsFor(r.served, SHIFT_DAY, SHIFT_SEC)
    this.resultTitle.string = stars > 0 ? '★'.repeat(stars) : '打烊'
    this.resultBody.string =
      `来客 ${r.arrived}    完成 ${r.served}\n` +
      `上错 ${r.wrong}    跑单 ${r.timedOut}\n` +
      `完成率 ${Math.round(r.completionRate * 100)}%`
    this.resultNode.active = true
    this.zonesKey = ''
    this.refreshZones()
    console.log(`[StationView] 打烊 — ${JSON.stringify(r)} stars=${stars}`)
  }

  private restart(): void {
    this.resultOpen = false
    this.resultNode.active = false
    resetShift(this.shift)
    resetKitchen(this.kitchen)
    this.shownSec = -1
    this.shownScore = -1
    for (let i = 0; i < this.orderShown.length; i++) this.orderShown[i] = -1
    this.router.cancelAll()
    this.zonesKey = ''
  }

  private syncNodes(): void {
    const m = this.movement.pos
    this.playerNode.setPosition(m.x, this.playerNode.position.y, m.z)

    focusForPlayer(this.camFocus, m, this.camBounds)
    this.cameraNode.setPosition(
      this.camFocus.x + this.camOffset.x,
      this.camOffset.y,
      this.camFocus.z + this.camOffset.z,
    )

    const stick = this.router.stick
    if (this.joystickNode.active !== stick.active) this.joystickNode.active = stick.active
    if (stick.active) {
      this.joystickNode.setPosition(
        screenToCanvasX(this.router.stickOriginX, this.screenW, this.screenH, this.designH),
        screenToCanvasY(this.router.stickOriginY, this.screenH, this.designH),
        0,
      )
    }
  }
}
