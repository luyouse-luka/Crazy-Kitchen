import {
  _decorator,
  Component,
  EventMouse,
  EventTouch,
  Game,
  Input,
  Node,
  UITransform,
  Vec2 as CCVec2,
  Widget,
  find,
  game,
  input,
  view,
} from 'cc'
import {
  DEFAULT_ACTION,
  ISO_CAMERA_YAW,
  TouchRouter,
  panelChildZone,
  screenToCanvasX,
  screenToCanvasY,
  uiRectToCaptureZone,
} from '../logic/input'
import type { CaptureZone } from '../logic/input'
import { createKitchen, discard, interact, stationInReach, stepKitchen } from '../logic/kitchen'
import type { BlockReason, KitchenState } from '../logic/kitchen'
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
  joystick: 'Canvas/UI_Joystick',
  discard: 'Canvas/UI_DiscardButton',
  panel: 'Canvas/UI_FridgePanel',
}

/** Visible size is polled, not read every frame — getVisibleSize() allocates. */
const RESIZE_POLL_SEC = 0.25

/** Touch id for the desktop mouse fallback. Real touch ids start at 0 and go up. */
const MOUSE_ID = -99

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

  @property({ tooltip: '相机绕 Y 的偏航。四个方向各推一次，前后反了就填负值（input.ts stickToWorld）' })
  cameraYaw = ISO_CAMERA_YAW

  /** Last blocked interaction. No toast node exists yet; HUD can read this later. */
  lastBlock: BlockReason = 'none'

  private router!: TouchRouter
  private kitchen!: KitchenState
  private movement!: MovementState
  private fridge: Station | null = null

  private playerNode!: Node
  private joystickNode!: Node
  private discardNode!: Node
  private panelNode!: Node
  private slotNodes: Node[] = []

  private screenW = 0
  private screenH = 0
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

  override start(): void {
    const kitchenRoot = this.need(NODES.kitchen)
    const player = this.need(NODES.player)
    const joystick = this.need(NODES.joystick)
    const discardBtn = this.need(NODES.discard)
    const panel = this.need(NODES.panel)
    if (!kitchenRoot || !player || !joystick || !discardBtn || !panel) {
      this.enabled = false
      return
    }
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

    const stations = this.readStations(kitchenRoot)
    if (stations.length === 0) {
      console.error(`[StationView] ${NODES.kitchen} 底下一个 Station_* 都没有`)
      this.enabled = false
      return
    }
    this.fridge = stations.find((s) => s.kind === 'fridge') ?? null

    this.kitchen = createKitchen({ stations, cook: { ...DEFAULT_COOK }, grillSlots: 2 })
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
    game.on(Game.EVENT_HIDE, this.onTouchCancel, this)

    console.log(
      `[StationView] ready — stations=${stations.length} slots=${this.slotNodes.length} screen=${this.screenW}x${this.screenH}`,
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

    this.router.tick(dt)
    stepKitchen(this.kitchen, dt)
    // World keeps running while the panel is open; the stick is frozen because every
    // touch lands in a capture zone, so this is a no-op then.
    stepMovement(this.movement, this.router.stick, this.cameraYaw, dt)

    if (this.panelOpen) this.tickPanel()
    else this.tickPlay()

    this.refreshZones()
    this.syncNodes()
  }

  private syncScreen(): void {
    const s = view.getVisibleSize()
    if (s.width === this.screenW && s.height === this.screenH) return
    this.screenW = s.width
    this.screenH = s.height
    this.router.setSplitX(s.width / 2)
    this.zonesKey = ''
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
      // Open only with empty hands, otherwise the player pays for a panel round trip
      // just to eat blocked('hands-full') on the way out.
      if (this.kitchen.carry.kind !== 'none') return this.report('hands-full')
      this.openPanel()
      return
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
    const key = `${this.panelOpen ? 'panel' : carrying ? 'discard' : 'none'}|${this.screenW}x${this.screenH}`
    if (key === this.zonesKey) return
    this.zonesKey = key

    // Widgets only align on active nodes, and the zone is built from the aligned position.
    this.panelNode.active = this.panelOpen
    this.discardNode.active = carrying && !this.panelOpen

    const zones: CaptureZone[] = []
    if (this.panelOpen) {
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
          uiRectToCaptureZone('discard', d.x, d.y, t.width, t.height, this.screenW, this.screenH),
        )
      }
    }
    this.router.setCaptureZones(zones)
  }

  private syncNodes(): void {
    const m = this.movement.pos
    this.playerNode.setPosition(m.x, this.playerNode.position.y, m.z)

    const stick = this.router.stick
    if (this.joystickNode.active !== stick.active) this.joystickNode.active = stick.active
    if (stick.active) {
      this.joystickNode.setPosition(
        screenToCanvasX(this.router.stickOriginX, this.screenW, this.screenH),
        screenToCanvasY(this.router.stickOriginY, this.screenH),
        0,
      )
    }
  }
}
