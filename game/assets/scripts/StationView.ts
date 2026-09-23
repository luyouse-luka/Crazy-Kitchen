import {
  _decorator,
  Camera,
  Color,
  Component,
  EventKeyboard,
  EventMouse,
  EventTouch,
  KeyCode,
  Game,
  Input,
  Label,
  Node,
  Prefab,
  ResolutionPolicy,
  SkeletalAnimation,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2 as CCVec2,
  Vec3,
  Widget,
  find,
  game,
  input,
  instantiate,
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
  grillCookLevel,
  interact,
  resetKitchen,
  stationInReach,
  stepKitchen,
} from '../logic/kitchen'
import type { BlockReason, KitchenState } from '../logic/kitchen'
import { createShift, resetShift, settleServe, shiftResult, starsForShift, stepShift } from '../logic/shift'
import type { ShiftState } from '../logic/shift'
import { matchCustomer, orderPatienceLeft, queueIndex, takeNextOrder } from '../logic/customer'
import type { Customer } from '../logic/customer'
import { difficultyForDay } from '../logic/difficulty'
import { COOK_LABEL, COOK_LEVELS, INGREDIENT_LABEL } from '../logic/types'
import { Bubble } from './Bubble'
import { createMovement, stepMovement } from '../logic/movement'
import type { MovementState } from '../logic/movement'
import { DEFAULT_COOK } from '../logic/recipe'
import { INGREDIENTS } from '../logic/types'
import type { CookLevel, Station, StationKind } from '../logic/types'
import type { AABB } from '../logic/collision'

const { ccclass, property } = _decorator

/** Scene node name -> logic station kind. Names are fixed by ROADMAP §6.2. */
const STATION_KINDS: Record<string, StationKind> = {
  Station_Fridge: 'fridge',
  Station_Grill: 'grill',
  Station_Assembly: 'assembly',
  Station_Serve: 'serve',
  Station_Storeroom: 'storeroom',
  Station_Order: 'register',
}

/** Scene paths resolved at start. `pnpm scene` checks every one of them against the
 *  actual .scene, so a rename shows up before the editor is even opened. */
const NODES = {
  kitchen: 'Kitchen',
  blockers: 'Kitchen/Blockers',
  player: 'Actors/Player',
  customers: 'Actors/Customers',
  customerFloor: 'Kitchen/Floor_Customer',
  camera: 'Main Camera',
  joystick: 'Canvas/UI_Joystick',
  discard: 'Canvas/UI_DiscardButton',
  panel: 'Canvas/UI_FridgePanel',
  time: 'Canvas/UI_HUD/Label_Time',
  score: 'Canvas/UI_HUD/Label_Score',
  orders: 'Canvas/UI_HUD/UI_Orders',
  result: 'Canvas/UI_Result',
  resultTitle: 'Canvas/UI_Result/Panel/Title',
  resultBody: 'Canvas/UI_Result/Panel/Stats',
  again: 'Canvas/UI_Result/Panel/Btn_Again',
}

/** 超时还在等的顾客，订单卡的进度条整条变成这个色 */
const LATE_BAR_COLOR = new Color(231, 76, 60, 255)

/** 火候字色。生与焦都是失败态，焦用红色报警 —— M4 的起火链从这里开始 */
const COOK_COLOR: Record<CookLevel, Color> = {
  raw: new Color(255, 160, 170, 255),
  rare: new Color(240, 130, 100, 255),
  medium: new Color(230, 170, 80, 255),
  well: new Color(190, 140, 90, 255),
  burnt: new Color(255, 60, 60, 255),
}

/** 气泡离地多高，米。玩家模型约 1.45m 高 */
const BUBBLE_Y = { carry: 1.9, grill: 1.5, bench: 1.45 }

/** 第几天的难度。M2 固定第 1 天，接上存档后改成读进度 */
const SHIFT_DAY = 1

/** 场景里建了几张订单卡。难度曲线的 maxConcurrent 上限是 6，卡按它备足 */
const ORDER_CARDS = 6

/** 顾客小人池。走出去的还没消失、新的已经进门，所以是在场上限的两倍 */
const FIGURES = ORDER_CARDS * 2

/** 顾客走路速度，米/秒。比厨师（4）慢得多，看得出是在溜达 */
const CUSTOMER_SPEED = 1.6

/** 排队时前后间距，米，沿柜台往东排 */
const QUEUE_GAP = 0.9

/**
 * 接了单之后去哪儿等，顾客区坐标（相对 Floor_Customer 中心）。前四个是长凳（坐），
 * 后两个站着 —— 长凳在 scene 里的 Prop_Waiting，挪了长凳要跟着改这里。
 */
const WAIT_SPOTS: ReadonlyArray<readonly [number, number, boolean]> = [
  [-2.4, 1.0, true], [-0.8, 1.0, true], [0.8, 1.0, true], [2.4, 1.0, true],
  [3.3, -0.2, false], [2.5, -0.2, false],
]

interface Figure {
  node: Node
  body: Node
  anim: SkeletalAnimation | null
  /** 对应顾客的 id；-1 = 空闲 */
  id: number
  tx: number
  tz: number
  /** WAIT_SPOTS 下标；-1 = 没占座 */
  seat: number
  leaving: boolean
  clip: string
}

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

  @property({ type: [Prefab], tooltip: '顾客外形，按站位轮换' })
  customerModels: Prefab[] = []

  @property({ type: [SpriteFrame], tooltip: '食材图标，顺序同 INGREDIENTS' })
  ingredientIcons: SpriteFrame[] = []

  @property({ type: SpriteFrame, tooltip: '盘子图标（手上端着汉堡时显示）' })
  plateIcon: SpriteFrame | null = null

  @property({ tooltip: '冰柜每样食材最多放几份。空了要去库房抱一箱回来补满' })
  fridgeCap = 4

  @property({ tooltip: '顾客走到点单台后等多少秒没人接单就走人（差评）' })
  orderPatienceSec = 25

  @property({ tooltip: '一局来几位顾客，接待完就结算' })
  customersPerShift = 10

  @property({ tooltip: '顾客平均隔多少秒来一位。真人局专用，模拟器仍按难度表' })
  arrivalSec = 30

  @property({ tooltip: '到达间隔的随机幅度，0.5 = 在 50%–150% 之间' })
  arrivalJitter = 0.5

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
  /** Which station the open panel picks for — fridge takes one, storeroom hands a crate */
  private panelStation: Station | null = null
  private slotIcons: Sprite[] = []
  private slotCounts: Label[] = []
  private panelTitle!: Label
  private uiHalfW = Infinity
  private uiHalfH = Infinity

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
  private orderBarSprites: Sprite[] = []
  /** 进度条在场景里的原色，准时状态下用它 */
  private barColor = new Color()
  private barLate: boolean[] = []
  /** 每张卡当前画的是哪位顾客。只在换人时重算文本，省掉每帧的字符串拼接（铁律②） */
  private orderShown: number[] = []
  private figures: Figure[] = []
  private seatOwner: number[] = WAIT_SPOTS.map(() => -1)
  /** 顾客区中心、进出口，世界坐标 */
  private waitX = 0
  private waitZ = 0
  private doorX = 0
  private doorZ = 0
  /** 排队第一位站的位置 */
  private queueX = 0
  private queueZ = 0
  /** 每位在场顾客头顶的「等点单」气泡，下标同 flow.customers */
  private orderBubbles: Bubble[] = []
  private playerAnim: SkeletalAnimation | null = null
  private playerModel: Node | null = null
  private playerWalking = false
  private carryBubble!: Bubble
  private grillBubble!: Bubble
  private benchBubble!: Bubble
  private grillStation: Station | null = null
  private benchStation: Station | null = null
  private grillKey = -1
  private iconBuf: (SpriteFrame | null)[] = []
  private timeLabel!: Label
  private scoreLabel!: Label
  private resultNode!: Node
  private resultTitle!: Label
  private resultBody!: Label
  private againNode!: Node
  private resultOpen = false
  /** 上一帧画出来的来客数与好评数。Label.string 每次赋值都会重排，值没变就别碰 */
  private shownArrived = -1
  private shownScore = -1

  private screenW = 0
  private screenH = 0
  /** Visible design-unit height. Fit Width grows it past 720 on narrow screens, and the
   *  capture-zone scale is screenH / designH — hardcoding 720 misses there. */
  private designH = 720
  private fitHeight: boolean | null = null
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
    const customersRoot = this.need(NODES.customers)
    const customerFloor = this.need(NODES.customerFloor)
    const result = this.need(NODES.result)
    const again = this.need(NODES.again)
    const timeLabel = this.label(NODES.time)
    const scoreLabel = this.label(NODES.score)
    const resultTitle = this.label(NODES.resultTitle)
    const resultBody = this.label(NODES.resultBody)
    if (
      !kitchenRoot || !camera || !player || !joystick || !discardBtn || !panel ||
      !ordersRoot || !customersRoot || !customerFloor || !result || !again || !timeLabel || !scoreLabel || !resultTitle || !resultBody
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
      const icon = slot.getChildByName('Icon')?.getComponent(Sprite)
      if (!icon) {
        console.error(`[StationView] ${NODES.panel}/Slot_${i} 底下没有带 Sprite 的 Icon`)
        this.enabled = false
        return
      }
      this.slotNodes.push(slot)
      this.slotIcons.push(icon)
      this.slotCounts.push(StationView.addLabel(slot, 'Count', 24, 0, -42))
    }
    this.panelTitle = StationView.addLabel(panel, 'Title', 28, 0, 144 + 26)

    for (let i = 0; i < ORDER_CARDS; i++) {
      const card = ordersRoot.getChildByName(`Order_${i}`)
      const text = card?.getChildByName('Text')?.getComponent(Label)
      const bar = card?.getChildByName('Bar')
      const barSprite = bar?.getComponent(Sprite)
      if (!card || !text || !bar || !barSprite) {
        console.error(`[StationView] ${NODES.orders} 底下的 Order_${i} 结构不对（要 Text + Bar）`)
        this.enabled = false
        return
      }
      this.orderCards.push(card)
      this.orderTexts.push(text)
      this.orderBars.push(bar)
      this.orderBarSprites.push(barSprite)
      this.barLate.push(false)
      if (i === 0) this.barColor.set(barSprite.color)
      this.orderShown.push(-1)
    }

    if (!this.buildCustomers(player, customersRoot, customerFloor)) {
      this.enabled = false
      return
    }

    const stations = this.readStations(kitchenRoot)
    if (stations.length === 0) {
      console.error(`[StationView] ${NODES.kitchen} 底下一个 Station_* 都没有`)
      this.enabled = false
      return
    }
    this.grillStation = stations.find((s) => s.kind === 'grill') ?? null
    this.benchStation = stations.find((s) => s.kind === 'assembly') ?? null
    const register = stations.find((s) => s.kind === 'register')
    if (!register) {
      console.error(`[StationView] ${NODES.kitchen} 底下没有 Station_Order（点单台）`)
      this.enabled = false
      return
    }
    this.queueX = register.pos.x
    if (this.ingredientIcons.length !== INGREDIENTS.length || !this.plateIcon) {
      console.error(`[StationView] ingredientIcons 要 ${INGREDIENTS.length} 张（顺序同 INGREDIENTS），plateIcon 要设`)
      this.enabled = false
      return
    }
    // Index 1 = right after the Canvas camera, so every panel and the result mask draw over it
    const world = new Node('UI_World')
    world.layer = this.node.layer
    this.node.insertChild(world, 1)
    this.carryBubble = new Bubble(world, 'Carry', INGREDIENTS.length + 1)
    this.grillBubble = new Bubble(world, 'Grill', 0)
    this.benchBubble = new Bubble(world, 'Bench', INGREDIENTS.length)
    for (let i = 0; i < ORDER_CARDS; i++) this.orderBubbles.push(new Bubble(world, `Order_${i}`, 0))

    this.kitchen = createKitchen({ stations, cook: { ...DEFAULT_COOK }, grillSlots: 2, fridgeCap: this.fridgeCap })
    const day = difficultyForDay(SHIFT_DAY)
    this.shift = createShift({
      // 每次进游戏换一批单，但同一局内可复现。M4 接存档后改成从存档读
      seed: (Date.now() & 0x7fffffff) || 1,
      customers: this.customersPerShift,
      flow: {
        ...day.flow,
        intervalSec: this.arrivalSec,
        intervalJitter: this.arrivalJitter,
        // 走进来要多久由场景几何算，不是拍的：接单的时机要和小人真走到柜台对上
        takeOrder: {
          walkInSec: Math.hypot(this.queueX - this.doorX, this.queueZ - this.doorZ) / CUSTOMER_SPEED,
          patienceSec: this.orderPatienceSec,
        },
      },
      orders: day.orders,
    })
    this.resultNode.active = false
    const blockers = this.need(NODES.blockers)
    this.movement = createMovement({ stations, boxes: blockers ? StationView.readBoxes(blockers) : [] })
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

  /** Same cube-is-metres rule as readStations, for things that only block the way. */
  private static readBoxes(root: Node): AABB[] {
    return root.children.map((c) => {
      const p = c.worldPosition
      const s = c.worldScale
      return { center: { x: p.x, z: p.z }, halfX: Math.abs(s.x) / 2, halfZ: Math.abs(s.z) / 2 }
    })
  }

  private static addLabel(parent: Node, name: string, size: number, x: number, y: number): Label {
    const n = new Node(name)
    n.layer = parent.layer
    parent.addChild(n)
    n.setPosition(x, y, 0)
    const l = n.addComponent(Label)
    l.fontSize = size
    l.lineHeight = size + 2
    l.enableOutline = true
    l.outlineWidth = 3
    l.outlineColor = Color.BLACK
    return l
  }

  /**
   * 顾客按 `customerModels` 轮换实例化，编辑器里的 `Customers` 保持空（m2-scene-guide §2.2）。
   * 进出口在顾客区西边外 1.5m；尺寸跟玩家的 `Model` 走，玩家和顾客才是同一比例的人。
   */
  private buildCustomers(player: Node, root: Node, floor: Node): boolean {
    const model = player.getChildByName('Model')
    const shadow = player.getChildByName('Shadow')
    if (!model || !shadow || this.customerModels.length === 0) {
      console.error(`[StationView] 要有 ${NODES.player}/Model、${NODES.player}/Shadow，且 customerModels 至少一个`)
      return false
    }
    this.playerModel = model
    this.playerAnim = model.getComponent(SkeletalAnimation)

    this.waitX = floor.position.x
    this.waitZ = floor.position.z
    this.doorX = floor.position.x - floor.scale.x / 2 - 1.5
    this.doorZ = floor.position.z
    this.queueZ = floor.position.z - floor.scale.z / 2 + 1
    for (let i = 0; i < FIGURES; i++) {
      const node = new Node(`Customer_${i}`)
      const body = instantiate(this.customerModels[i % this.customerModels.length]!)
      body.setScale(model.scale)
      node.addChild(body)
      node.addChild(instantiate(shadow))
      node.active = false
      root.addChild(node)
      this.figures.push({ node, body, anim: body.getComponent(SkeletalAnimation), id: -1, tx: 0, tz: 0, seat: -1, leaving: false, clip: '' })
    }
    return true
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

    // Read the pulses BEFORE tick(), never after: touch events land between frames and
    // tick() clears last frame's pulses on the way in, so reading after it never sees a
    // tap. holdStarted still works (tick produces it), so the symptom is "walks fine,
    // long-press fine, taps dead" — which looks like one unwired button, not an ordering bug.
    //
    // 只有这一处 tick()，所有读都排在它前面 —— 分支里各调一次的话，`pnpm scene` 那条
    // 顺序判据只认第一处，剩下的静默失守。
    if (this.resultOpen) {
      // 打烊后世界停住，只剩「再来一局」一个去处
      if (this.router.zone('again')?.tapped) this.restart()
    } else {
      this.syncKeyStick()
      stepKitchen(this.kitchen, dt)
      stepShift(this.shift, dt)
      // World keeps running while the panel is open; the stick is frozen because every
      // touch lands in a capture zone, so this is a no-op then.
      stepMovement(this.movement, this.router.stick, this.cameraYaw, dt)
      if (this.panelOpen) this.tickPanel()
      else this.tickPlay()
    }
    this.router.tick(dt)

    if (this.shift.over && !this.resultOpen) {
      this.showResult()
      return
    }

    this.refreshZones()
    if (this.resultOpen) return
    this.syncNodes()
    this.syncHud()
  }

  private syncScreen(): void {
    // Touch coords are physical pixels, getVisibleSize() is design units. They differ by
    // the view scale, so zones built from design units miss on device.
    const px = view.getVisibleSizeInPixel()
    if (px.width === this.screenW && px.height === this.screenH) return
    this.screenW = px.width
    this.screenH = px.height

    // Keep the whole design box on screen: wider than 16:9 extends sideways (Fit Height),
    // narrower would clip the order row under Fit Height, so it extends upward instead.
    const d = view.getDesignResolutionSize()
    const dw = d.width
    const dh = d.height
    const fitHeight = px.width * dh >= px.height * dw
    if (fitHeight !== this.fitHeight) {
      this.fitHeight = fitHeight
      view.setDesignResolutionSize(dw, dh, fitHeight ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH)
    }
    const vs = view.getVisibleSize()
    this.designH = vs.height
    this.uiHalfW = vs.width / 2
    this.uiHalfH = vs.height / 2
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
    const held = this.kitchen.carry.kind
    if (station.kind === 'fridge') {
      // 抱着箱子点冰柜就是补货，不用开面板
      if (held === 'crate') return this.report(interact(this.kitchen, this.movement.pos, station).reason)
      // 手上拿着生料也让开 —— 点错一样食材不该逼玩家先跑一趟垃圾桶。
      // 盘子例外，换食材等于把整个汉堡扔了，那一下要玩家自己按 discard。
      if (held === 'plate') return this.report('hands-full')
      this.openPanel(station)
      return
    }
    if (station.kind === 'register') {
      const c = takeNextOrder(this.shift.flow)
      return this.report(c ? 'none' : 'no-order')
    }
    if (station.kind === 'storeroom') {
      if (held !== 'none') return this.report('hands-full')
      this.openPanel(station)
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
      const station = this.panelStation
      this.closePanel()
      if (!station) return this.report('unsupported')
      // Picking always closes the panel — one tap, even when the pick is refused.
      this.report(
        interact(this.kitchen, this.movement.pos, station, { ingredient: INGREDIENTS[i]! }).reason,
      )
      return
    }
    if (this.router.zone('panel-outside')?.tapped) this.closePanel()
  }

  private openPanel(station: Station): void {
    this.panelStation = station
    const fridge = station.kind === 'fridge'
    this.panelTitle.string = fridge ? '冰柜' : '冷库 · 抱一箱回冰柜补满'
    // Stock only moves on a pick or a restock, never while the panel is up — draw it once here
    const stock = this.kitchen.stock
    for (let i = 0; i < this.slotCounts.length; i++) {
      this.slotCounts[i]!.string = `${stock[i]}/${this.fridgeCap}`
      this.slotIcons[i]!.grayscale = fridge && stock[i]! <= 0
    }
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

  private icon(i: string): SpriteFrame | null {
    return this.ingredientIcons[INGREDIENTS.indexOf(i as (typeof INGREDIENTS)[number])] ?? null
  }

  /** 手上 / 烤炉 / 组装台各一个气泡。key 编码状态，没变就不重画（铁律②：这里每帧都跑） */
  private syncBubbles(): void {
    const cam = this.cameraComp
    const k = this.kitchen
    const buf = this.iconBuf
    const m = this.movement.pos
    const carry = k.carry
    if (carry.kind === 'none') this.carryBubble.hide()
    else if (carry.kind === 'ingredient') {
      buf[0] = this.icon(carry.ingredient)
      this.carryBubble.show(100 + INGREDIENTS.indexOf(carry.ingredient), buf, 1, '', Color.WHITE)
    } else if (carry.kind === 'crate') {
      buf[0] = this.icon(carry.ingredient)
      this.carryBubble.show(400 + INGREDIENTS.indexOf(carry.ingredient), buf, 1, '整箱', Color.WHITE)
    } else if (carry.kind === 'patty') {
      buf[0] = this.icon('patty')
      this.carryBubble.show(200 + COOK_LEVELS.indexOf(carry.cook), buf, 1, COOK_LABEL[carry.cook], COOK_COLOR[carry.cook])
    } else {
      this.fillBurger(1)
      buf[0] = this.plateIcon
      const cook = k.burger.cook
      this.carryBubble.show(
        300 + k.burger.ingredients.length * 10 + (cook ? COOK_LEVELS.indexOf(cook) : 9),
        buf,
        k.burger.ingredients.length + 1,
        cook ? COOK_LABEL[cook] : '',
        cook ? COOK_COLOR[cook] : Color.WHITE,
      )
    }
    if (carry.kind !== 'none') this.carryBubble.follow(cam, m.x, BUBBLE_Y.carry, m.z, this.uiHalfW, this.uiHalfH)

    const g = this.grillStation
    if (g) {
      let key = 0
      for (let i = 0; i < k.grill.length; i++) {
        key = key * 6 + (k.grill[i]!.busy ? COOK_LEVELS.indexOf(grillCookLevel(k, i)) + 1 : 0)
      }
      if (key === 0) this.grillBubble.hide()
      else {
        if (key !== this.grillKey) {
          this.grillKey = key
          let text = ''
          let worst: CookLevel = 'raw'
          for (let i = 0; i < k.grill.length; i++) {
            const lv = grillCookLevel(k, i)
            if (i > 0) text += '  '
            text += k.grill[i]!.busy ? COOK_LABEL[lv] : '空'
            if (k.grill[i]!.busy && COOK_LEVELS.indexOf(lv) > COOK_LEVELS.indexOf(worst)) worst = lv
          }
          this.grillBubble.show(key, buf, 0, text, COOK_COLOR[worst])
        }
        this.grillBubble.follow(cam, g.pos.x, BUBBLE_Y.grill, g.pos.z, this.uiHalfW, this.uiHalfH)
      }
    }

    const b = this.benchStation
    if (b) {
      if (!k.assemblyOccupied) this.benchBubble.hide()
      else {
        this.fillBurger(0)
        const cook = k.burger.cook
        this.benchBubble.show(
          k.burger.ingredients.length * 10 + (cook ? COOK_LEVELS.indexOf(cook) : 9),
          buf,
          k.burger.ingredients.length,
          cook ? COOK_LABEL[cook] : '',
          cook ? COOK_COLOR[cook] : Color.WHITE,
        )
        this.benchBubble.follow(cam, b.pos.x, BUBBLE_Y.bench, b.pos.z, this.uiHalfW, this.uiHalfH)
      }
    }
  }

  /**
   * 顾客小人：进门 → 排队 → 接单后去长凳 → 离店走出去。位置是纯表现，规则全在 customer.ts；
   * 小人按顾客 id 认人，不按槽位 —— 槽位一空就会被新来的复用，而走的那位还在路上。
   */
  private syncCustomers(): void {
    const dt = game.deltaTime
    const flow = this.shift.flow
    const cs = flow.customers
    for (const f of this.figures) {
      if (f.id < 0 || f.leaving) continue
      let here = false
      for (const c of cs) if (c.active && c.id === f.id) here = true
      if (here) continue
      f.leaving = true
      if (f.seat >= 0) this.seatOwner[f.seat] = -1
      f.seat = -1
      f.tx = this.doorX
      f.tz = this.doorZ
    }
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!
      const b = this.orderBubbles[i]!
      if (!c.active) {
        b.hide()
        continue
      }
      let f: Figure | null = null
      for (const g of this.figures) if (g.id === c.id && !g.leaving) f = g
      if (!f) {
        for (const g of this.figures) if (g.id < 0) f = g
        if (!f) continue
        f.id = c.id
        f.leaving = false
        f.seat = -1
        f.clip = ''
        f.node.setPosition(this.doorX, 0, this.doorZ)
        f.node.active = true
      }
      if (!c.ordered) {
        const k = queueIndex(flow, c)
        f.tx = this.queueX + k * QUEUE_GAP
        f.tz = this.queueZ
        const left = orderPatienceLeft(flow, c)
        const sec = Math.ceil(left)
        // 走到柜台之前不显示：那段不倒计时
        if (left >= this.orderPatienceSec) b.hide()
        else b.show(sec, this.iconBuf, 0, `点单 ${sec}`, sec <= 8 ? LATE_BAR_COLOR : Color.WHITE)
        if (left < this.orderPatienceSec) b.follow(this.cameraComp, f.node.position.x, BUBBLE_Y.carry, f.node.position.z, this.uiHalfW, this.uiHalfH)
      } else {
        b.hide()
        if (f.seat < 0) {
          const s = this.seatOwner.indexOf(-1)
          if (s >= 0) {
            this.seatOwner[s] = c.id
            f.seat = s
          }
        }
        const spot = f.seat >= 0 ? WAIT_SPOTS[f.seat]! : null
        f.tx = spot ? this.waitX + spot[0] : this.queueX
        f.tz = spot ? this.waitZ + spot[1] : this.queueZ
      }
    }
    for (const f of this.figures) {
      if (f.id < 0) continue
      const p = f.node.position
      const dx = f.tx - p.x
      const dz = f.tz - p.z
      const d = Math.hypot(dx, dz)
      const step = CUSTOMER_SPEED * dt
      let clip: string
      if (d > step) {
        f.node.setPosition(p.x + (dx / d) * step, 0, p.z + (dz / d) * step)
        f.body.setRotationFromEuler(0, (Math.atan2(dx, dz) * 180) / Math.PI, 0)
        clip = 'walk'
      } else {
        if (f.leaving) {
          f.id = -1
          f.leaving = false
          f.node.active = false
          continue
        }
        f.node.setPosition(f.tx, 0, f.tz)
        f.body.setRotationFromEuler(0, 180, 0) // 面朝柜台（北）
        clip = f.seat >= 0 && WAIT_SPOTS[f.seat]![2] ? 'sit' : 'idle'
      }
      if (clip !== f.clip) {
        f.clip = clip
        f.anim?.crossFade(clip, 0.15)
      }
    }
  }

  /** 把当前汉堡的食材图标写进 iconBuf[from..] */
  private fillBurger(from: number): void {
    const ing = this.kitchen.burger.ingredients
    for (let i = 0; i < ing.length; i++) this.iconBuf[from + i] = this.icon(ing[i]!)
  }

  private syncHud(): void {
    const arrived = this.shift.flow.arrived
    if (arrived !== this.shownArrived) {
      this.shownArrived = arrived
      this.timeLabel.string = `顾客 ${arrived}/${this.customersPerShift}`
    }
    if (this.shift.served !== this.shownScore) {
      this.shownScore = this.shift.served
      this.scoreLabel.string = `好评 ${this.shift.served}`
    }

    const cs = this.shift.flow.customers
    for (let i = 0; i < this.orderCards.length; i++) {
      const c = i < cs.length ? cs[i] : undefined
      const card = this.orderCards[i]!
      // 没接单之前需求是看不见的 —— 要玩家去点单台问
      const on = c !== undefined && c.active && c.ordered
      if (card.active !== on) card.active = on
      if (!on || !c) {
        this.orderShown[i] = -1
        continue
      }
      if (this.orderShown[i] !== c.id) {
        this.orderShown[i] = c.id
        this.orderTexts[i]!.string = StationView.orderText(c)
      }
      // 超时的整条变红，比「空条」一眼更好认：这位还在等，但已经拿不到钱了
      if (this.barLate[i] !== c.late) {
        this.barLate[i] = c.late
        this.orderBarSprites[i]!.color = c.late ? LATE_BAR_COLOR : this.barColor
      }
      // Bar 的锚点在左端，所以缩 x 就是从左往右退
      const k = c.late ? 1 : c.patienceMax > 0 ? c.patienceLeft / c.patienceMax : 0
      this.orderBars[i]!.setScale(k > 0 ? k : 0, 1, 1)
    }
  }

  private showResult(): void {
    this.resultOpen = true
    this.panelOpen = false
    this.router.cancelAll()

    const r = shiftResult(this.shift)
    const stars = starsForShift(r)
    this.resultTitle.string = stars > 0 ? '★'.repeat(stars) : '打烊'
    this.resultBody.string =
      `来客 ${r.arrived}    好评 ${r.served}\n` +
      `超时免单 ${r.lateServed}    上错 ${r.wrong}\n` +
      `没人接单走了 ${r.walkedOut}\n` +
      `好评率 ${Math.round(r.goodRate * 100)}%`
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
    this.shownArrived = -1
    this.shownScore = -1
    for (const f of this.figures) {
      f.id = -1
      f.node.active = false
    }
    this.seatOwner.fill(-1)
    for (let i = 0; i < this.orderShown.length; i++) this.orderShown[i] = -1
    this.router.cancelAll()
    this.zonesKey = ''
  }

  private syncNodes(): void {
    const m = this.movement.pos
    this.playerNode.setPosition(m.x, this.playerNode.position.y, m.z)
    if (this.playerModel) {
      this.playerModel.setRotationFromEuler(0, (this.movement.facingYaw * 180) / Math.PI, 0)
      if (this.playerWalking !== this.movement.moving) {
        this.playerWalking = this.movement.moving
        this.playerAnim?.crossFade(this.playerWalking ? 'walk' : 'idle', 0.15)
      }
    }

    focusForPlayer(this.camFocus, m, this.camBounds)
    this.cameraNode.setPosition(
      this.camFocus.x + this.camOffset.x,
      this.camOffset.y,
      this.camFocus.z + this.camOffset.z,
    )

    this.syncBubbles()
    this.syncCustomers()

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
