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
  Mesh,
  MeshRenderer,
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
  builtinResMgr,
  find,
  game,
  input,
  instantiate,
  sys,
  primitives,
  utils,
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
  scrubSink,
  releaseScrub,
  bumpStack,
  carrySpeedFactor,
  DEFAULT_WASH,
  DRINK_SEC,
  DRINK_SPILL_SEC,
  FIRE_SEC,
  FRY_BURN_SEC,
  FRY_SEC,
  STACK_SLOW,
} from '../logic/kitchen'
import type { BlockReason, InteractKind, InteractResult, KitchenState } from '../logic/kitchen'
import { createShift, resetShift, settleServe, settleSide, shiftResult, starsForShift, stepShift } from '../logic/shift'
import type { ShiftConfig, ShiftState } from '../logic/shift'
import { DOUBLE_CHANCE, DOUBLE_FROM_DAY, matchCustomer, matchSide, moodTier, orderPatienceLeft, patienceRatio, queueIndex, takeReadyOrders } from '../logic/customer'
import type { Customer, Side } from '../logic/customer'
import type { OrderSpec } from '../logic/types'
import { bank, dayFlow, finishDay, parseProgress, SAVE_KEY, serializeProgress } from '../logic/progress'
import { createLedger, earn, ledgerTotal, resetLedger } from '../logic/economy'
import type { Progress } from '../logic/progress'
import { BIG_TRAY, buy, DRINK_CHANCE, FAST_GRILL, FAST_WASH, flowFactor, FRIES_CHANCE, owns, SHOP } from '../logic/shop'
import { ListPanel } from './ShopUi'
import type { ListRow } from './ShopUi'
import { COLOR_PRICE, DECOR_ITEMS, DECOR_SLOTS, FLOOR_COLORS, paint, place, WALL_COLORS } from '../logic/decor'
import type { DecorItemId, DecorSlotId } from '../logic/decor'
import { ALL_DONE_BONUS, collectStats, DAILY_TASKS, rollTasks, TASK_REWARD, taskReward, taskStatus, taskText } from '../logic/tasks'
import type { Task, TaskStatus } from '../logic/tasks'
import { HighlightCard, TASK_CARD_W, TaskCard } from './TaskUi'
import { COOK_LABEL, COOK_LEVELS, INGREDIENT_LABEL } from '../logic/types'
import { Bubble } from './Bubble'
import { Ring } from './Ring'
import { WallCutaway } from './WallCutaway'
import { argueTap, createVent, endArgue, rantStars, ranting, rantsLeft, resetVent, startRant, stepVent, vent, VENT_HOLD_SEC, ventSpeedFactor } from '../logic/vent'
import type { Rant, VentSpot, VentState } from '../logic/vent'
import { witnessMishap } from '../logic/witness'
import type { Mishap } from '../logic/witness'
import { FEEL, Floaters, pop, popIn } from './Feel'
import { Sfx } from './Sfx'
import type { SfxName } from './Sfx'
import { addReview, averageStars, createReviewLog, REJECT_STARS, serveReview, WALKOUT_STARS } from '../logic/reviews'
import type { Review, ReviewKind, ReviewLog } from '../logic/reviews'
import { CARD_LINES } from './cardLines'
import { ComputerPanel, Toast, TOAST_H, TOAST_W } from './ReviewUi'
import { Controls } from './Controls'
import { BurgerStack } from './BurgerStack'
import type { OfferRow, ReviewLine } from './ReviewUi'
import {
  acceptDelivery,
  createDesk,
  deskBusy,
  matchDelivery,
  rejectDelivery,
  resetDesk,
  settleDelivery,
  stepDesk,
} from '../logic/delivery'
import type { Delivery, DeliveryDesk, DeskEvents } from '../logic/delivery'
import { createMovement, stepMovement, teleport } from '../logic/movement'
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
  Station_Delivery: 'delivery',
  Station_Sink: 'sink',
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
  action: 'Canvas/UI_ActionButton',
  panel: 'Canvas/UI_FridgePanel',
  time: 'Canvas/UI_HUD/Label_Time',
  score: 'Canvas/UI_HUD/Label_Score',
  orders: 'Canvas/UI_HUD/UI_Orders',
  result: 'Canvas/UI_Result',
  resultTitle: 'Canvas/UI_Result/Panel/Title',
  resultBody: 'Canvas/UI_Result/Panel/Stats',
  again: 'Canvas/UI_Result/Panel/Btn_Again',
  rack: 'Kitchen/Blockers/Block_DishRack',
  shelf: 'Kitchen/Blockers/Block_Plate',
  fryer: 'Kitchen/Blockers/Block_Fryer',
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
/** Where the carried burger rides: metres in front of the player, and height */
const HAND = { reach: 0.45, y: 1.0 }
const MOOD_FACE = ['😀', '🙂', '😐', '😡', '🤬'] as const
/** Ring colour by how much patience is left: plenty / hurry / about to go */
const RING_OK = new Color(110, 210, 110, 255)
const RING_WARN = new Color(245, 200, 70, 255)
const ASK_COLOR = new Color(255, 215, 80, 255)
/**
 * Placeholder until cards carry lines.witness (ROADMAP M4). `burnt` is copy from the V0.2 design brief;
 * the other two have no copy yet, so they are stage directions in brackets, not invented dialogue.
 */
const WITNESS_LINES: Record<Mishap, readonly string[]> = {
  burnt: ['这东西是煤炭吗？', '我突然没那么饿了。', '这家店卫生评级多少来着？'],
  stained: ['（盘子没洗干净，被看见了）'],
  crash: ['（盘子摔了一地，被看见了）'],
  vent: ['（厨师在发火，被看见了）'],
}
/** ⏳ Shouting-match copy: the first two lines are the user's, the rest are placeholders to review */
/** 🚧 Placeholder hurry-up shouts (overhead, short); the card's own wait_nudge still goes up top */
const URGE_ANGRY = ['快点行不行！', '还要多久啊！', '我赶时间！', '饿死了……']
const URGE_LATE = ['都超时了！', '我的汉堡呢？！', '还做不做了！']
const ARGUE_CHEF = ['催什么催！', '不买就滚！', '嫌慢你自己来做！', '爱吃不吃！', '门在那边！', '下次别来了！'] as const
const ARGUE_CUSTOMER = ['你什么态度！', '我要投诉你！', '什么破店！', '叫你们老板出来！', '差评！必须差评！', '走就走！'] as const
const HINT: Partial<Record<BlockReason, string>> = {
  'hands-full': '手上拿满了',
  'hands-empty': '手上没东西',
  'grill-full': '烤位满了',
  'grill-empty': '烤炉上没肉',
  'not-raw-patty': '只有生肉能下锅',
  'duplicate-ingredient': '这样已经有了',
  'no-burger': '组装台是空的',
  'incomplete-burger': '汉堡还缺面包或肉',
  'no-order': '没人点这一单',
  'out-of-stock': '卖完了，去冷库搬一箱',
  'stock-full': '冰柜还是满的',
  'no-plate': '没有干净盘子了',
  'nothing-to-wash': '没有脏盘子',
  'sink-busy': '泡好了，按住刷',
  'still-soaking': '还在泡',
  'rack-empty': '架子上没有晾好的盘子',
  'stack-full': '一趟拿不了更多了',
  'still-frying': '还在炸',
  'on-fire': '着火了！去拿灭火器',
  'still-pouring': '还在接',
  'no-fire': '没着火',
  unsupported: '这里用不上',
}
const SFX_FOR: Partial<Record<InteractKind, SfxName>> = {
  'take-ingredient': 'pick',
  'take-patty': 'pick',
  'pick-plate': 'pick',
  'take-crate': 'pick',
  'take-stack': 'pick',
  'place-patty': 'drop',
  'add-to-burger': 'drop',
  'put-plate': 'drop',
  restock: 'drop',
  soak: 'drop',
  shelve: 'drop',
  fry: 'drop',
  'take-fries': 'pick',
  'serve-fries': 'serve',
  'dump-fries': 'trash',
  'take-extinguisher': 'pick',
  'return-extinguisher': 'drop',
  extinguish: 'scrub',
  pour: 'drop',
  'take-drink': 'pick',
  'serve-drink': 'serve',
  'wipe-spill': 'scrub',
  discard: 'trash',
}
const HINT_COLOR = new Color(255, 235, 170, 255)
const GOOD_COLOR = new Color(255, 215, 80, 255)
const BAD_COLOR = new Color(255, 110, 100, 255)
/** 电脑上最多挂几张外卖单 / 同时最多做几张 */
const DELIVERY_OFFERS = 2
/** One grid step (136) right of the grid's last column */
const PLATE_SLOT_X = 340
const PANEL_GROW = 136
const DELIVERY_ACTIVE = 2
/** Riders wait just inside the door by the counter's east end, clear of the diners' standing spots. ⏳ tune by eye */
const RIDER_SPOT = [-1.1, -0.9] as const
const RIDER_GAP = 0.8
/** 外卖顾客的编号从这里起，和堂食错开（评价按编号取顾客卡） */
const DELIVERY_ID_BASE = 1000
const PLATFORM_AVATAR = 5
/** Result panel buttons side by side (again / next / shop): each this wide, centres this far apart */
const RESULT_BTN_W = 160
const RESULT_BTN_GAP = 176

/** 场景里建了几张订单卡。难度曲线的 maxConcurrent 上限是 6，卡按它备足 */
const ORDER_CARDS = 6

/** 顾客小人池。走出去的还没消失、新的已经进门，所以是在场上限的两倍 */
const FIGURES = ORDER_CARDS * 2

/** 顾客走路速度，米/秒。比厨师（4）慢得多，看得出是在溜达 */
const CUSTOMER_SPEED = 1.6

/**
 * 坐下时把人抬多高，米。Kenney 的 sit 是坐在地上（髋部离地 0.05m），长凳座面实测 0.50m，
 * 不抬的话人整个陷进凳子里。
 */
const SEAT_Y = 0.48

/** 排队时前后间距，米，沿柜台往东排 */
const QUEUE_GAP = 0.9
/** Where upset customers stand to rant: west of the queue head, against the counter. ⏳ self-chosen */
const RANT_DX = -0.6
const RANT_DZ = -0.5

/**
 * 接了单之后去哪儿等，顾客区坐标（相对 Floor_Customer 中心）。前四个是长凳（坐），
 * 后两个站着 —— 长凳在 scene 里的 Prop_Waiting，挪了长凳要跟着改这里。
 * 坐的 z 比长凳中线靠前 0.06：sit 动作的髋部在脚底后方 0.06m，这样髋部才落在座面中间。
 */
const WAIT_SPOTS: ReadonlyArray<readonly [number, number, boolean]> = [
  [-2.4, 0.94, true], [-0.8, 0.94, true], [0.8, 0.94, true], [2.4, 0.94, true],
  [3.3, -0.2, false], [2.5, -0.2, false],
]

/** Bookcase slot on the empty stretch of north wall between the fridge and the cold-room door. ⏳ tune by eye */
const WALL_N_SPOT = [7, -2.45] as const

const HUD_MARGIN = 12
const SIDE_ICON: Record<Side, string> = { fries: '🍟', drink: '🥤' }
/** Extinguisher on the north wall, east of the bookcase slot, west of the cold-room door. ⏳ tune by eye */
const EXT_SPOT = [9.3, -2.8] as const
/** Drink machine against the north wall just east of the fridge. ⏳ tune by eye */
const DRINKS_SPOT = [5.9, -2.7] as const
/** Fixed touch targets keep this far inside the safe area (ROADMAP M6) */
const SAFE_GAP = 50

interface MenuRow extends ListRow {
  run: () => void
}

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
  /** 上菜后先走到出餐口取餐，再出门 */
  pickup: boolean
  clip: string
  /** Already shouted on reaching the rant spot */
  shouted: boolean
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

  @property({ tooltip: '站着时头顶离脚底多少米（耐心圈贴在这里）。手感旋钮，预览里对着看' })
  headStandY = 1.45

  @property({ tooltip: '坐在长凳上时头顶离人物节点多少米（节点已抬了 SEAT_Y）' })
  headSitY = 0.76

  @property({ tooltip: '顾客走到点单台后等多少秒没人接单就走人（差评）' })
  orderPatienceSec = 25

  @property({ tooltip: '一局来几位顾客，接待完就结算' })
  customersPerShift = 10

  @property({ tooltip: '一开局有几个干净盘子。每做一个汉堡占一个，堂食吃完脏着送回洗碗池' })
  plateCount = 6

  @property({ tooltip: '冷库里的备用干净盘子（摔碎后去这里领一摞）' })
  sparePlates = 4

  @property({ tooltip: '顾客超时后再等多少秒就走人（差评）' })
  lateLeaveSec = 20

  @property({ tooltip: '外卖单隔多少秒来一张（挂在点单台电脑上）' })
  deliveryIntervalSec = 40

  @property({ tooltip: '外卖单挂在电脑上多少秒没人理就算拒单' })
  deliveryOfferSec = 15

  @property({ tooltip: '接了外卖后多少秒内要放上外卖取餐口' })
  deliveryDeadlineSec = 75

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
  private panelW = 0
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
  /** Bottom-right buttons with their scene offsets, pushed in past a notch */
  private edgeWidgets: { w: Widget; right: number; bottom: number }[] = []
  /** Screen edges hidden by a notch / rounded corner, design units */
  private inset = { left: 0, right: 0, top: 0, bottom: 0 }
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
  /** 每位在场顾客头顶的耐心圈，下标同 flow.customers */
  private customerRings: Ring[] = []
  private seenBurnt = 0
  private seenBurntFries = 0
  private seenFires = 0
  private witnessLine = 0
  /** 各圈上的顾客已经催过单了（id），同一位只催一次 */
  private nudged: number[] = []
  /** Delivery riders; `id` = the accepted delivery's id */
  private riders: Figure[] = []
  private riderRings: Ring[] = []
  private highlightCard!: HighlightCard
  /** The day's most outrageous moment so far; a bigger score replaces it. null = a quiet day */
  private highlight: { score: number; title: string; quote: string } | null = null
  /** Lines traded in the current shouting match, for the highlight */
  private argueCount = 0
  private urgedLate: number[] = []
  private reviews: ReviewLog = createReviewLog()
  /** 与 reviews.items 同序的台词，评价列表直接读 */
  private reviewLines: ReviewLine[] = []
  private toast!: Toast
  private board!: ComputerPanel
  private reviewsOpen = false
  private desk!: DeliveryDesk
  private deliverySeed = 1
  /** 电脑面板上第 i 行对应的外卖单（null = 这行空着） */
  private offerRows: (Delivery | null)[] = []
  private offerView: (OfferRow | null)[] = []
  private offerMask = ''
  private seenOffer = 1
  private registerRing!: Ring
  private deliveryRing!: Ring
  private registerStation: Station | null = null
  private deliveryStation: Station | null = null
  private deliveryCards: Node[] = []
  private deliveryTexts: Label[] = []
  private deliveryBars: Node[] = []
  private deliveryShown: number[] = []
  private controls!: Controls
  private plateRing!: Ring
  private sinkRing!: Ring
  private rackRing!: Ring
  private platePos = { x: 0, z: 0 }
  /** Plate models on the shelf, bottom first; the first `kitchen.plates` are shown */
  private plateModels: Node[] = []
  private shownPlates = -1
  private rackPos = { x: 0, z: 0 }
  private sinkStation: Station | null = null
  /** 顾客从西边进门、东边出门（玩家视角左进右出） */
  private exitX = 0
  private toastX = 0
  private toastY = 0
  private ordersRoot!: Node
  private ordersY = 0
  /** 出餐口的 x；顾客取餐站在柜台外 queueZ 那条线上 */
  private pickupX = 0
  private playerAnim: SkeletalAnimation | null = null
  private playerModel: Node | null = null
  private playerWalking = false
  private carryBubble!: Bubble
  private grillRings: Ring[] = []
  private benchBubble!: Bubble
  private burgerStack: BurgerStack | null = null
  private benchTopY = 1
  private grillStation: Station | null = null
  private benchStation: Station | null = null
  private iconBuf: (SpriteFrame | null)[] = []
  private resultNode!: Node
  private resultTitle!: Label
  private resultBody!: Label
  private againNode!: Node
  private resultOpen = false
  private nextNode: Node | null = null
  private shopNode: Node | null = null
  /** One list panel for the shop, the counter menu and decorating; `menuKind` says which it shows */
  private menu!: ListPanel
  private menuKind: string | null = null
  private menuRows: MenuRow[] = []
  /** closed = day not started yet (choose at the counter), rest = rest day, no customers */
  private phase: 'closed' | 'open' | 'rest' = 'closed'
  /** Runtime holders for each decor slot's model */
  private decorSlots = new Map<DecorSlotId, Node>()
  private decorTemplates = new Map<DecorItemId, Node>()
  private wallRenderers: MeshRenderer[] = []
  private floorRenderers: MeshRenderer[] = []
  /** Result text above the money line, which changes as the shop spends */
  private resultHead = ''
  private fryerStation: Station | null = null
  private drinksStation: Station | null = null
  private drinksNode: Node | null = null
  private drinksRing!: Ring
  private seenSpills = 0
  private fryerRing!: Ring
  private progress!: Progress
  /** 正在打的是第几天（重打旧的一天时小于 progress.day） */
  private day = 1
  private passed = false
  private sfx!: Sfx
  private floaters!: Floaters
  private shakeLeft = 0
  private shakeAmp = 0
  private seenCrash = 0
  private seenStained = 0
  private seenArrived = 0
  private rackWasDrying = false
  private scrubbing = false
  private scrubTick = 0
  private baseSpeed = 0
  private spawn = { x: 0, z: 0 }
  private cutaway: WallCutaway | null = null
  private venting = createVent()
  private ledger = createLedger()
  private tasks: Task[] = []
  private taskState: TaskStatus[] = []
  /** Last status + text drawn per line, so the card only redraws on change */
  private taskShown: string[] = []
  private taskCard!: TaskCard
  private ventedThisPress = false
  /** Customer id in the shouting match last frame, -1 = none */
  private arguing = -1
  private seenVents = 0
  /** Review each ranting customer leaves when done: kind + line, before any retort */
  private rantReview = new Map<number, { kind: ReviewKind; text: string }>()

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
    StationView.flattenPlaceholders(this.node)
    this.resultNode = result
    this.highlightCard = new HighlightCard(result)
    this.againNode = again
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
    this.buildPlateSlot(panel)
    this.panelW = panel.getComponent(UITransform)?.width ?? 0
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
    const rackNode = this.need(NODES.rack)
    const shelfNode = this.need(NODES.shelf)
    const fryerNode = this.need(NODES.fryer)
    if (!rackNode || !shelfNode || !fryerNode) {
      this.enabled = false
      return
    }
    // Rack and shelf are counters that already block the way; they only gain a trigger range
    const rack = this.toStation(rackNode, 'rack')
    const shelf = this.toStation(shelfNode, 'shelf')
    // The fryer counter is scenery until bought: the kitchen offers nothing there without cfg.fryerSec
    this.fryerStation = this.toStation(fryerNode, 'fryer')
    stations.push(rack, shelf, this.fryerStation)
    // Extinguisher on the north wall by the cold-room door; drink machine east of the fridge, shown once bought
    const ext = this.colourBlock(kitchenRoot, 'Station_Extinguisher', EXT_SPOT[0], EXT_SPOT[1], 0.5, 0.5, utils.createMesh(primitives.cylinder(0.24, 0.24, 0.6)), 0.55, new Color(220, 40, 40, 255))
    if (ext) stations.push(this.toStation(ext, 'extinguisher'))
    this.drinksNode = this.colourBlock(kitchenRoot, 'Station_Drinks', DRINKS_SPOT[0], DRINKS_SPOT[1], 0.8, 0.6, utils.createMesh(primitives.box({ width: 1, height: 1.1, length: 1 })), 0.55, new Color(70, 170, 210, 255))
    if (this.drinksNode) {
      this.drinksStation = this.toStation(this.drinksNode, 'drinks')
      stations.push(this.drinksStation)
    }
    this.platePos = shelf.pos
    this.rackPos = rack.pos
    this.grillStation = stations.find((s) => s.kind === 'grill') ?? null
    this.benchStation = stations.find((s) => s.kind === 'assembly') ?? null
    const register = stations.find((s) => s.kind === 'register')
    if (!register) {
      console.error(`[StationView] ${NODES.kitchen} 底下没有 Station_Order（点单台）`)
      this.enabled = false
      return
    }
    // Diners order and pick up at the counter beside the computer, not in front of it
    const counter = kitchenRoot.getChildByPath('Blockers/Block_CounterW')
    this.queueX = counter ? counter.worldPosition.x : register.pos.x
    if (this.ingredientIcons.length !== INGREDIENTS.length || !this.plateIcon) {
      console.error(`[StationView] ingredientIcons 要 ${INGREDIENTS.length} 张（顺序同 INGREDIENTS），plateIcon 要设`)
      this.enabled = false
      return
    }
    // Index 1 = right after the Canvas camera, so every panel and the result mask draw over it
    const world = new Node('UI_World')
    world.layer = this.node.layer
    // convertToUINode leaves `out` untouched when the target has no UITransform — every bubble
    // then kept its stale position and the rings drifted up by their own offset each frame
    world.addComponent(UITransform)
    this.node.insertChild(world, 1)
    this.carryBubble = new Bubble(world, 'Carry', INGREDIENTS.length + 1)
    for (let i = 0; i < 2; i++) this.grillRings.push(new Ring(world, `Grill_${i}`, 18))
    this.benchBubble = new Bubble(world, 'Bench', INGREDIENTS.length)
    this.buildBurgerStack(kitchenRoot)
    this.buildPlateModels(kitchenRoot)
    for (let i = 0; i < ORDER_CARDS; i++) {
      this.customerRings.push(new Ring(world, `Customer_${i}`))
      this.nudged.push(-1)
      this.urgedLate.push(-1)
    }
    this.floaters = new Floaters(world)
    this.sfx = new Sfx(this.node)
    this.board = new ComputerPanel(this.node, DELIVERY_OFFERS)
    for (let i = 0; i < DELIVERY_OFFERS; i++) {
      this.offerRows.push(null)
      this.offerView.push(null)
    }
    for (let i = 0; i < DELIVERY_ACTIVE; i++) this.riderRings.push(new Ring(world, `Rider_${i}`))
    this.registerRing = new Ring(world, 'Register')
    this.deliveryRing = new Ring(world, 'Delivery')
    this.registerStation = register
    this.deliveryStation = stations.find((s) => s.kind === 'delivery') ?? null
    this.buildDeliveryCards(ordersRoot)
    this.taskCard = new TaskCard(ordersRoot.parent ?? this.node, DAILY_TASKS, TASK_REWARD, ALL_DONE_BONUS)
    this.ordersRoot = ordersRoot
    this.ordersY = ordersRoot.position.y
    // The strip above the diner order row: anything lower covers the kitchen
    const action = this.need(NODES.action)
    for (const n of [action, discardBtn]) {
      const w = n?.getComponent(Widget)
      if (w) this.edgeWidgets.push({ w, right: w.right, bottom: w.bottom })
    }
    if (action) this.controls = new Controls(joystick, action, discardBtn)
    this.plateRing = new Ring(world, 'Plates')
    this.sinkRing = new Ring(world, 'Sink')
    this.rackRing = new Ring(world, 'Rack')
    this.fryerRing = new Ring(world, 'Fryer')
    this.drinksRing = new Ring(world, 'Drinks')
    this.sinkStation = stations.find((s) => s.kind === 'sink') ?? null
    this.toast = new Toast(this.node)
    timeLabel.node.active = false
    scoreLabel.node.active = false
    this.pickupX = this.queueX

    this.kitchen = createKitchen({
      stations,
      cook: { ...DEFAULT_COOK },
      grillSlots: 2,
      fridgeCap: this.fridgeCap,
      plates: this.plateCount,
      sparePlates: this.sparePlates,
      fireSec: FIRE_SEC,
      doublePatty: true,
    })
    this.progress = parseProgress(StationView.load())
    this.applyUpgrades()
    this.day = this.progress.day
    // 每次进游戏换一批单；同一次游戏里重打同一天出的是同一批（seed 不变）
    const seed = (Date.now() & 0x7fffffff) || 1
    this.deliverySeed = (seed ^ 0x5bd1e995) >>> 0 || 1
    this.desk = createDesk(
      {
        intervalSec: this.deliveryIntervalSec,
        offerSec: this.deliveryOfferSec,
        deadlineSec: this.deliveryDeadlineSec,
        maxOffers: DELIVERY_OFFERS,
        maxActive: DELIVERY_ACTIVE,
      },
      dayFlow(this.day, this.arrivalSec).orders,
      this.deliverySeed,
    )
    this.shift = createShift(this.shiftConfig(this.day, seed))
    this.resultNode.active = false
    this.buildResultButtons()
    this.menu = new ListPanel(this.node, DECOR_SLOTS.length + 3)
    this.buildDecor(kitchenRoot)
    const blockers = this.need(NODES.blockers)
    this.cutaway = new WallCutaway(blockers ? [kitchenRoot, blockers] : [kitchenRoot])
    this.movement = createMovement({ stations, boxes: blockers ? StationView.readBoxes(blockers) : [] })
    this.baseSpeed = this.movement.cfg.speed
    this.spawn = { x: this.movement.pos.x, z: this.movement.pos.z }
    this.router = new TouchRouter(view.getVisibleSize().width / 2, undefined, DEFAULT_ACTION)
    this.syncScreen()
    this.openDay()

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
      if (kind) out.push(this.toStation(child, kind))
    }
    return out
  }

  /**
   * A station with no model yet: a coloured primitive on the floor at (x, z). The host's scale is the station box
   * (sx × sz); the body is the mesh inside it. ⏳ swap for art when it arrives
   */
  private colourBlock(kitchenRoot: Node, name: string, x: number, z: number, sx: number, sz: number, mesh: Mesh, y: number, color: Color): Node | null {
    // Not the wall / floor material: decorating repaints every renderer sharing those
    const mat = kitchenRoot.getChildByName('Station_Grill')?.getComponent(MeshRenderer)?.sharedMaterial
    if (!mat) {
      console.warn(`[StationView] 找不到 Station_Grill 的材质，${name} 没摆出来`)
      return null
    }
    const host = new Node(name)
    host.layer = kitchenRoot.layer
    kitchenRoot.addChild(host)
    host.setWorldPosition(x, 0, z)
    host.setScale(sx, 1, sz)
    const body = new Node('Body')
    body.layer = kitchenRoot.layer
    host.addChild(body)
    body.setPosition(0, y, 0)
    const mr = body.addComponent(MeshRenderer)
    mr.mesh = mesh
    mr.setSharedMaterial(mat, 0)
    mr.getMaterialInstance(0)?.setProperty('mainColor', color)
    return host
  }

  private toStation(node: Node, kind: StationKind): Station {
    const p = node.worldPosition
    const s = node.worldScale
    const halfX = Math.abs(s.x) / 2
    const halfZ = Math.abs(s.z) / 2
    return {
      id: node.name,
      kind,
      pos: { x: p.x, z: p.z },
      box: { center: { x: p.x, z: p.z }, halfX, halfZ },
      triggerRange: Math.max(halfX, halfZ) + this.reach,
    }
  }

  private shiftConfig(day: number, seed: number): ShiftConfig {
    const d = dayFlow(day, this.arrivalSec)
    return {
      seed,
      customers: this.customersPerShift,
      flow: {
        ...d.flow,
        intervalSec: d.flow.intervalSec * flowFactor(this.progress),
        intervalJitter: this.arrivalJitter,
        lateLeaveSec: this.lateLeaveSec,
        // 走进来要多久由场景几何算，不是拍的：接单的时机要和小人真走到柜台对上
        takeOrder: {
          walkInSec: Math.hypot(this.queueX - this.doorX, this.queueZ - this.doorZ) / CUSTOMER_SPEED,
          patienceSec: this.orderPatienceSec,
        },
      },
      orders: {
        ...d.orders,
        friesChance: owns(this.progress, 'fryer') ? FRIES_CHANCE : 0,
        drinkChance: owns(this.progress, 'drinks') ? DRINK_CHANCE : 0,
        doubleChance: day >= DOUBLE_FROM_DAY ? DOUBLE_CHANCE : 0,
      },
    }
  }

  /** Bought upgrades → kitchen config. Read at the start of every day */
  private applyUpgrades(): void {
    const p = this.progress
    const cfg = this.kitchen.cfg
    const g = owns(p, 'fast-grill') ? FAST_GRILL : 1
    cfg.cook = { rareAt: DEFAULT_COOK.rareAt * g, mediumAt: DEFAULT_COOK.mediumAt * g, wellAt: DEFAULT_COOK.wellAt * g, burntAt: DEFAULT_COOK.burntAt * g }
    const w = owns(p, 'fast-wash') ? FAST_WASH : 1
    cfg.wash = { soakSec: DEFAULT_WASH.soakSec * w, scrubSec: DEFAULT_WASH.scrubSec * w, drySec: DEFAULT_WASH.drySec * w, returnSec: DEFAULT_WASH.returnSec }
    const tray = owns(p, 'big-tray')
    cfg.stackMax = tray ? BIG_TRAY.max : undefined
    cfg.stackSlow = tray ? BIG_TRAY.slow : undefined
    cfg.fryerSec = owns(p, 'fryer') ? FRY_SEC : undefined
    cfg.drinkSec = owns(p, 'drinks') ? DRINK_SEC : undefined
    if (this.drinksNode) this.drinksNode.active = cfg.drinkSec !== undefined
  }

  /** Storeroom-only ninth slot: spare plates. A column right of the 4×2 grid; the panel widens rightward to hold it */
  private buildPlateSlot(panel: Node): void {
    const src = this.slotNodes[this.slotNodes.length - 1]!
    const slot = instantiate(src)
    slot.name = 'Slot_Plates'
    panel.addChild(slot)
    slot.setPosition(PLATE_SLOT_X, 0, 0)
    const icon = slot.getChildByName('Icon')!.getComponent(Sprite)!
    icon.spriteFrame = this.plateIcon
    icon.grayscale = false
    slot.active = false
    this.slotNodes.push(slot)
    this.slotIcons.push(icon)
    this.slotCounts.push(slot.getChildByName('Count')!.getComponent(Label)!)
  }

  /** Next-day and shop buttons, cloned from Btn_Again so they match whatever the scene styles it as */
  private buildResultButtons(): void {
    const again = this.againNode
    const t = again.getComponent(UITransform)
    if (t) t.width = RESULT_BTN_W
    const clone = (name: string, text: string): Node => {
      const n = instantiate(again)
      n.name = name
      again.parent!.addChild(n)
      const l = n.getChildByName('Label')?.getComponent(Label)
      if (l) l.string = text
      return n
    }
    this.nextNode = clone('Btn_Next', '下一天')
    this.shopNode = clone('Btn_Shop', '商店')
  }

  /**
   * Scene UI still uses the engine's default_sprite, which stretches into a dark blob over button text.
   * Flat colour until real art lands (M6). packable=false: the white texture has no image source and crashes the dynamic atlas.
   */
  private static flattenPlaceholders(root: Node): void {
    const flat = new SpriteFrame()
    flat.texture = builtinResMgr.get('white-texture')
    flat.packable = false
    for (const s of root.getComponentsInChildren(Sprite)) {
      if (s.spriteFrame?.name !== 'default_sprite') continue
      s.sizeMode = Sprite.SizeMode.CUSTOM
      s.spriteFrame = flat
    }
  }

  private static load(): string | null {
    try {
      return sys.localStorage.getItem(SAVE_KEY)
    } catch {
      return null
    }
  }

  private static save(p: Progress): void {
    try {
      sys.localStorage.setItem(SAVE_KEY, serializeProgress(p))
    } catch (e) {
      console.warn('[StationView] 存档写不进去', e)
    }
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
    this.doorX = floor.position.x + floor.scale.x / 2 + 1.5
    this.exitX = floor.position.x - floor.scale.x / 2 - 1.5
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
      this.figures.push({ node, body, anim: body.getComponent(SkeletalAnimation), id: -1, tx: 0, tz: 0, seat: -1, leaving: false, pickup: false, clip: '', shouted: false })
    }
    // Delivery riders: one per accepted order, last models first so they rarely match the diner beside them
    for (let i = 0; i < DELIVERY_ACTIVE; i++) {
      const node = new Node(`Rider_${i}`)
      const body = instantiate(this.customerModels[this.customerModels.length - 1 - (i % this.customerModels.length)]!)
      body.setScale(model.scale)
      node.addChild(body)
      node.addChild(instantiate(shadow))
      node.active = false
      root.addChild(node)
      this.riders.push({ node, body, anim: body.getComponent(SkeletalAnimation), id: -1, tx: 0, tz: 0, seat: -1, leaving: false, pickup: false, clip: '', shouted: false })
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
    if (this.panelOpen || this.reviewsOpen || (dx === 0 && dy === 0)) {
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
      // 打烊后世界停住，只剩结算面板上的按钮
      if (this.menuKind) this.tickMenu()
      else if (this.router.zone('again')?.tapped) this.restart(this.day)
      else if (this.passed && this.router.zone('next')?.tapped) this.restart(this.day + 1)
      else if (this.router.zone('shop')?.tapped) this.openMenu('shop')
    } else {
      this.syncKeyStick()
      // Before opening and on a rest day the shop is frozen: only walking and the counter menu
      if (this.phase === 'open') {
        stepKitchen(this.kitchen, dt)
        stepShift(this.shift, dt, this.onWalkOut)
        stepVent(this.venting, dt, this.onRantDone)
        this.desk.open = !this.shift.over && this.shift.flow.arrived < this.customersPerShift
        stepDesk(this.desk, dt, this.deskEvents)
      }
      // World keeps running while the panel is open; the stick is frozen because every
      // touch lands in a capture zone, so this is a no-op then.
      this.movement.cfg.speed = this.baseSpeed * carrySpeedFactor(this.kitchen) * ventSpeedFactor(this.venting)
      stepMovement(this.movement, this.router.stick, this.cameraYaw, dt)
      if (this.movement.blocked) bumpStack(this.kitchen, this.movement.impact)
      this.tickEvents()
      this.syncTasks(false)
      if (this.menuKind) this.tickMenu()
      else if (this.reviewsOpen) this.tickComputer()
      else if (this.panelOpen) this.tickPanel()
      else this.tickPlay()
    }
    this.router.tick(dt)

    // Accepted deliveries still count after the last diner leaves
    if (this.shift.over && !deskBusy(this.desk) && rantsLeft(this.venting) === 0 && !this.resultOpen) {
      this.showResult()
      return
    }

    this.refreshZones()
    if (this.resultOpen) return
    this.syncNodes()
    this.syncHud()
    this.toast.tick(dt, this.toastX, this.toastY)
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
    // Same formulas as the engine's SafeArea component; with no notch the rect is the visible area and all insets are 0
    const safe = sys.getSafeAreaRect()
    this.inset = {
      left: Math.max(0, safe.x),
      right: Math.max(0, vs.width - safe.x - safe.width),
      top: Math.max(0, vs.height - safe.y - safe.height),
      bottom: Math.max(0, safe.y),
    }
    for (const e of this.edgeWidgets) {
      e.w.right = Math.max(e.right, this.inset.right + SAFE_GAP)
      e.w.bottom = Math.max(e.bottom, this.inset.bottom + SAFE_GAP)
      e.w.updateAlignment()
    }
    this.layoutHud()

    // Ortho height comes from the real aspect, not from the editor value: a near-square
    // screen needs a wider frame, otherwise following throws the grill off-screen (`pnpm cam`).
    const aspect = px.width / px.height
    const h = effectiveOrthoHeight(aspect)
    this.cameraComp.orthoHeight = h
    this.camBounds = focusBounds(h, aspect)
  }

  /**
   * Task card in the top-right corner; the order row and the review popup share what is left of the top strip,
   * shrinking only when the screen is too narrow for both
   */
  private layoutHud(): void {
    const t = this.taskCard
    const left = Math.max(HUD_MARGIN, this.inset.left)
    const right = Math.max(HUD_MARGIN, this.inset.right)
    const top = Math.max(HUD_MARGIN, this.inset.top)
    t.node.setPosition(this.uiHalfW - right - TASK_CARD_W / 2, this.uiHalfH - top - t.height / 2, 0)
    const avail = this.uiHalfW * 2 - left - right - TASK_CARD_W - HUD_MARGIN
    const row = this.ordersRoot.getComponent(UITransform)?.width ?? 1120
    const k = Math.min(1, avail / row)
    const cx = -this.uiHalfW + left + avail / 2
    this.ordersRoot.setScale(k, k, 1)
    this.ordersRoot.setPosition(cx, this.ordersY, 0)
    const kt = Math.min(1, avail / TOAST_W)
    this.toast.node.setScale(kt, kt, 1)
    const cardH = this.orderCards[0]!.getComponent(UITransform)?.height ?? 96
    this.toastX = cx
    this.toastY = this.ordersY + (cardH * k) / 2 + 4 + (TOAST_H * kt) / 2
  }

  private tickPlay(): void {
    if (this.phase !== 'open') {
      if (this.router.action.tapped && stationInReach(this.kitchen, this.movement.pos)?.kind === 'register') {
        this.openMenu(this.phase === 'rest' ? 'rest' : 'open')
      }
      return
    }
    if (this.router.zone('discard')?.holdStarted) {
      this.act(discard(this.kitchen))
      return
    }
    if (this.tickArgue()) return
    if (this.tryVent()) return
    if (this.router.action.holding && stationInReach(this.kitchen, this.movement.pos)?.kind === 'sink') {
      this.scrub()
      return
    }
    if (this.scrubbing) {
      this.scrubbing = false
      if (releaseScrub(this.kitchen) && this.sinkStation) {
        const s = this.sinkStation
        this.floaters.spawn(this.cameraComp, s.pos.x, BUBBLE_Y.bench, s.pos.z, '没刷干净就上架了', BAD_COLOR, 26)
      }
    }
    if (!this.router.action.tapped) return

    const station = stationInReach(this.kitchen, this.movement.pos)
    if (!station) return
    const held = this.kitchen.carry.kind
    if (station.kind === 'fridge') {
      // 抱着箱子点冰柜就是补货，不用开面板
      if (held === 'crate') return this.act(interact(this.kitchen, this.movement.pos, station))
      // 手上拿着生料也让开 —— 点错一样食材不该逼玩家先跑一趟垃圾桶。
      // 盘子例外，换食材等于把整个汉堡扔了，那一下要玩家自己按 discard。
      if (held === 'plate' || held === 'stack') return this.report('hands-full')
      this.openPanel(station)
      return
    }
    if (station.kind === 'register') {
      // 一下接完柜台前所有人：排队的人多时逐个按太磨，接单本身也不该是难点
      if (takeReadyOrders(this.shift.flow) > 0) return this.sfx.play('pick')
      // Nobody waiting: the counter computer shows the reviews
      this.openReviews()
      return
    }
    if (station.kind === 'delivery') {
      const d = matchDelivery(this.desk, this.kitchen.burger)
      const r = interact(this.kitchen, this.movement.pos, station, { spec: d?.spec })
      if (r.kind === 'serve' && d && r.verdict) {
        const rv = serveReview(r.verdict.ok, false, d.max > 0 ? d.left / d.max : 0)
        const line = CARD_LINES[(DELIVERY_ID_BASE + d.id) % CARD_LINES.length]!
        this.review(DELIVERY_ID_BASE + d.id, rv.kind, rv.stars, rv.kind === 'praise' ? line.praise : line.complain)
        settleDelivery(this.desk, d, r.verdict.ok)
        return this.served(station, r.verdict.ok, false, rv.stars)
      }
      return this.act(r, r.reason === 'hands-empty' ? '先端上做好的汉堡' : r.reason === 'no-order' ? '没有要送的外卖' : undefined)
    }
    if (station.kind === 'storeroom') {
      if (held !== 'none') return this.report('hands-full')
      this.openPanel(station)
      return
    }
    if (station.kind === 'serve') {
      if (held === 'fries' || held === 'drink') {
        const side: Side = held === 'fries' ? 'fries' : 'drink'
        const c = matchSide(this.shift.flow, side)
        const r = interact(this.kitchen, this.movement.pos, station, { spec: c?.spec })
        if ((r.kind === 'serve-fries' || r.kind === 'serve-drink') && c) {
          const v = c.burgerVerdict
          const otherDue = side === 'fries' ? c.drinkDue : c.friesDue
          if (v && !otherDue) return this.finishOrder(c, v.ok, station, () => settleSide(this.shift, c, side))
          settleSide(this.shift, c, side)
          return this.halfServed(station, `${SIDE_ICON[side]} 到了，还差${StationView.stillDue(c)}`)
        }
        return this.act(r, r.reason === 'no-order' ? (side === 'fries' ? '没人点薯条' : '没人点饮料') : undefined)
      }
      // 谁接这一盘是玩法规则，不在组件里挑：logic 先找吃得下的，找不到砸给最急的那位
      const c = matchCustomer(this.shift.flow, this.kitchen.burger)
      const r = interact(this.kitchen, this.movement.pos, station, { spec: c?.spec })
      if (r.kind === 'serve' && c && r.verdict) {
        const v = r.verdict
        if (v.ok && (c.friesDue || c.drinkDue)) {
          settleServe(this.shift, c, v)
          return this.halfServed(station, `🍔 到了，还差${StationView.stillDue(c)}`)
        }
        return this.finishOrder(c, v.ok, station, () => settleServe(this.shift, c, v))
      }
      return this.act(r, r.reason === 'hands-empty' ? '先端上做好的汉堡' : undefined)
    }
    this.act(interact(this.kitchen, this.movement.pos, station))
  }

  /** Holding the action key at the sink: scrub, with a brush sound every so often and a cheer when done */
  private scrub(): void {
    const k = this.kitchen
    this.scrubbing = scrubSink(k, game.deltaTime)
    if (!this.scrubbing) return
    this.scrubTick -= game.deltaTime
    if (this.scrubTick <= 0) {
      this.scrubTick = FEEL.scrubTickSec
      this.sfx.play('scrub', 0.8)
    }
    if (k.sink.stage === 'empty' && this.sinkStation) {
      this.scrubbing = false
      const s = this.sinkStation
      this.floaters.spawn(this.cameraComp, s.pos.x, BUBBLE_Y.bench, s.pos.z, '✨ 洗干净了', GOOD_COLOR)
      this.sfx.play('ready')
    }
  }

  /** A diner's order is complete: review (or rant), then `settle` releases them. Review is read before settling */
  private finishOrder(c: Customer, ok: boolean, station: Station, settle: () => void): void {
    const rv = serveReview(ok, c.late, patienceRatio(this.shift.flow, c))
    const line = CARD_LINES[c.id % CARD_LINES.length]!
    const upset = rv.kind !== 'praise'
    if (upset) this.rant(c.id, rv.kind, rv.stars, line.complain)
    else this.review(c.id, rv.kind, rv.stars, line.praise)
    const late = c.late
    const fries = c.spec.fries === true
    const drink = c.spec.drink === true
    settle()
    for (const f of this.figures) if (f.id === c.id && !f.leaving) f.pickup = !upset
    this.served(station, ok, late, rv.stars, fries, drink)
  }

  /** Half of a burger-and-fries order handed over; the diner keeps waiting */
  private halfServed(station: Station, text: string): void {
    this.sfx.play('drop')
    this.floaters.spawn(this.cameraComp, station.pos.x, BUBBLE_Y.grill, station.pos.z, text, HINT_COLOR, 28)
  }

  /** A plate handed over: sound plus a word over the counter */
  /** What this diner is still waiting for, burger first */
  private static stillDue(c: Customer): string {
    const due: string[] = []
    if (!c.burgerVerdict) due.push('汉堡')
    if (c.friesDue) due.push('薯条')
    if (c.drinkDue) due.push('饮料')
    return due.join('、')
  }

  private served(station: Station, ok: boolean, late: boolean, stars: number, fries = false, drink = false): void {
    this.sfx.play(ok && !late ? 'serve' : 'wrong')
    const got = earn(this.ledger, ok, late, stars, station.kind === 'delivery', fries, drink)
    const text = !ok ? '上错了' : late ? '超时 免单' : `${'★'.repeat(stars)}  +¥${got}`
    this.floaters.spawn(this.cameraComp, station.pos.x, BUBBLE_Y.grill, station.pos.z, text, ok && !late ? GOOD_COLOR : BAD_COLOR, 34)
  }

  private act(r: InteractResult, hint?: string): void {
    if (r.kind === 'blocked') return this.report(r.reason, hint)
    const s = SFX_FOR[r.kind]
    if (s) this.sfx.play(s)
  }

  private tickPanel(): void {
    for (let i = 0; i < this.slotNodes.length; i++) {
      if (!this.router.zone(`slot${i}`)?.tapped) continue
      const station = this.panelStation
      this.closePanel()
      if (!station) return this.report('unsupported')
      if (i === INGREDIENTS.length) {
        const r = interact(this.kitchen, this.movement.pos, station, { plates: true })
        return this.act(r, r.reason === 'out-of-stock' ? '备用盘子领完了' : undefined)
      }
      // Picking closes the panel, even when refused — except after a first topping, so the
      // second hand is one more tap (tap outside to leave with just the one)
      const r = interact(this.kitchen, this.movement.pos, station, { ingredient: INGREDIENTS[i]! })
      this.act(r)
      const c = this.kitchen.carry
      if (r.kind === 'take-ingredient' && station.kind === 'fridge' && c.kind === 'ingredient' && c.second === null) {
        this.openPanel(station)
      }
      return
    }
    if (this.router.zone('panel-outside')?.tapped) {
      this.sfx.play('tap')
      this.closePanel()
    }
  }

  private openPanel(station: Station): void {
    this.panelStation = station
    const fridge = station.kind === 'fridge'
    this.panelTitle.string = fridge ? '冰柜' : '冷库 · 抱一箱回冰柜补满'
    // Stock only moves on a pick or a restock, never while the panel is up — draw it once here
    const stock = this.kitchen.stock
    for (let i = 0; i < INGREDIENTS.length; i++) {
      this.slotCounts[i]!.string = `${stock[i]}/${this.fridgeCap}`
      this.slotIcons[i]!.grayscale = fridge && stock[i]! <= 0
    }
    const plates = this.slotNodes[INGREDIENTS.length]!
    plates.active = !fridge
    this.slotCounts[INGREDIENTS.length]!.string = `盘子 ${this.kitchen.spare}`
    this.slotIcons[INGREDIENTS.length]!.grayscale = this.kitchen.spare <= 0
    // Grow rightward only, so the grid stays where the thumb learned it
    const t = this.panelNode.getComponent(UITransform)
    if (t) {
      t.width = fridge ? this.panelW : this.panelW + PANEL_GROW
      t.anchorX = fridge ? 0.5 : this.panelW / 2 / (this.panelW + PANEL_GROW)
    }
    if (!this.panelOpen) {
      popIn(this.panelNode)
      this.sfx.play('tap')
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

  /** A refused action: a short hint over the chef's head. Walking out of reach is not worth a word */
  private report(reason: BlockReason, hint?: string): void {
    this.lastBlock = reason
    if (reason === 'none' || reason === 'out-of-range') return
    console.log(`[StationView] blocked: ${reason}`)
    const text = hint ?? HINT[reason]
    if (!text) return
    this.sfx.play('deny', 0.7)
    const m = this.movement.pos
    this.floaters.spawn(this.cameraComp, m.x, BUBBLE_Y.carry + 0.4, m.z, text, HINT_COLOR, 26)
  }

  // ─────────────────────────── logic → 场景 ───────────────────────────

  private refreshZones(): void {
    const carrying = this.kitchen.carry.kind !== 'none'
    const mode = this.resultOpen
      ? 'result'
      : this.reviewsOpen
        ? 'reviews'
        : this.panelOpen
          ? 'panel'
          : carrying
            ? 'discard'
            : 'none'
    const key = `${mode}|${this.reviewsOpen ? this.offerMask : ''}|${this.panelStation?.kind}|${this.passed}|${this.menuKind}:${this.menuRows.length}|${this.screenW}x${this.screenH}`
    if (key === this.zonesKey) return
    this.zonesKey = key

    // Widgets only align on active nodes, and the zone is built from the aligned position.
    this.panelNode.active = this.panelOpen && !this.resultOpen
    this.discardNode.active = carrying && !this.panelOpen && !this.reviewsOpen && !this.resultOpen

    const zones: CaptureZone[] = []
    if (this.menuKind) {
      const p = this.menu.node.position
      for (const b of this.menu.buttons) {
        zones.push(panelChildZone(b.id, p.x, p.y, b.x, b.y, b.w, b.h, this.screenW, this.screenH, this.designH))
      }
      zones.push({ id: 'menu-outside', x: 0, y: 0, w: this.screenW, h: this.screenH })
    } else if (this.resultOpen) {
      const btns: [string, Node | null][] = [['again', this.againNode], ['next', this.passed ? this.nextNode : null], ['shop', this.shopNode]]
      for (const [id, n] of btns) {
        const t = n?.getComponent(UITransform)
        const p = n?.parent
        if (!n || !t || !p) continue
        zones.push(
          panelChildZone(id, p.position.x, p.position.y, n.position.x, n.position.y, t.width, t.height,
            this.screenW, this.screenH, this.designH),
        )
      }
      // 兜底吞掉其余触摸：打烊了还能走路会让人以为局没结束
      zones.push({ id: 'result-outside', x: 0, y: 0, w: this.screenW, h: this.screenH })
    } else if (this.reviewsOpen) {
      const p = this.board.node.position
      for (const b of this.board.buttons) {
        const row = Number(b.id.slice(6))
        if (!this.offerRows[row]) continue
        zones.push(panelChildZone(b.id, p.x, p.y, b.x, b.y, b.w, b.h, this.screenW, this.screenH, this.designH))
      }
      // Last, so the buttons win the hit test
      zones.push({ id: 'reviews-outside', x: 0, y: 0, w: this.screenW, h: this.screenH })
    } else if (this.panelOpen) {
      const p = this.panelNode.position
      for (let i = 0; i < this.slotNodes.length; i++) {
        const slot = this.slotNodes[i]!
        const t = slot.getComponent(UITransform)
        if (!t || !slot.active) continue
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

  /**
   * Things the logic counted since last frame. Mishaps → witnesses lose a mood tier (logic/witness.ts)
   * and the speaker's remark pops up top; each also gets its sound and a word on the spot.
   */
  private tickEvents(): void {
    const k = this.kitchen
    const cam = this.cameraComp
    const cs = this.shift.flow.customers
    while (this.seenBurnt < k.burnt) {
      this.seenBurnt++
      this.mishap('burnt')
      const g = this.grillStation
      if (g) this.floaters.spawn(cam, g.pos.x, BUBBLE_Y.grill, g.pos.z, '🔥 糊了', BAD_COLOR)
      this.markHighlight(20, '烤糊了一块肉', '厨房里飘着一股焦味')
      this.sfx.play('burnt')
      this.shake(FEEL.shakeSmall)
    }
    if (this.seenFires < k.fires) {
      this.seenFires = k.fires
      const g = this.grillStation
      if (g) this.floaters.spawn(cam, g.pos.x, BUBBLE_Y.grill + 0.4, g.pos.z, '🔥 着火了！去拿灭火器', BAD_COLOR, 34)
      this.mishap('burnt')
      this.sfx.play('crash')
      this.shake(FEEL.shakeBig)
      this.markHighlight(90, '烤炉着火了', '一块烤糊的肉没人管，整个烤炉烧了起来')
    }
    if (this.seenSpills < k.spills) {
      this.seenSpills = k.spills
      const d = this.drinksStation
      if (d) this.floaters.spawn(cam, d.pos.x, BUBBLE_Y.grill, d.pos.z, '💦 饮料洒了', BAD_COLOR)
      this.sfx.play('wrong')
    }
    if (this.seenBurntFries < k.burntFries) {
      this.seenBurntFries = k.burntFries
      const f = this.fryerStation
      if (f) this.floaters.spawn(cam, f.pos.x, BUBBLE_Y.grill, f.pos.z, '🔥 薯条炸糊了', BAD_COLOR)
      this.sfx.play('burnt')
    }
    while (this.seenCrash < k.crashed) {
      this.seenCrash++
      this.mishap('crash')
      const m = this.movement.pos
      this.floaters.spawn(cam, m.x, BUBBLE_Y.carry, m.z, '💥 盘子全摔了', BAD_COLOR)
      this.markHighlight(50, '一整摞盘子摔了个粉碎', '端着一摞盘子迎面撞上了墙')
      this.sfx.play('crash')
      this.shake(FEEL.shakeBig)
    }
    while (this.seenStained < k.stainedServed) {
      this.seenStained++
      this.mishap('stained')
    }
    while (this.seenVents < this.venting.vents) {
      this.seenVents++
      this.mishap('vent')
    }
    const drying = k.rack.count > 0
    if (this.rackWasDrying && !drying) {
      this.floaters.spawn(cam, this.rackPos.x, BUBBLE_Y.bench, this.rackPos.z, '🍽 晾好了', GOOD_COLOR)
      this.sfx.play('ready')
    }
    this.rackWasDrying = drying
    if (this.shift.flow.arrived > this.seenArrived) {
      this.seenArrived = this.shift.flow.arrived
      this.sfx.play('ding', 0.6)
    }
    // Hurry-ups: once when a diner first turns 😡 (their card line up top plus a shout overhead), once more on going late
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!
      if (!c.active || !c.ordered) continue
      if (this.nudged[i] !== c.id && moodTier(this.shift.flow, c) >= 3) {
        this.nudged[i] = c.id
        this.review(c.id, 'witness', 0, CARD_LINES[c.id % CARD_LINES.length]!.wait_nudge)
        this.urge(c.id, URGE_ANGRY)
      }
      if (this.urgedLate[i] !== c.id && c.late) {
        this.urgedLate[i] = c.id
        this.urge(c.id, URGE_LATE)
      }
    }
  }

  private urge(id: number, lines: readonly string[]): void {
    const f = this.figureOf(id)
    if (!f) return
    const p = f.node.position
    const head = p.y + (p.y > 0 ? this.headSitY : this.headStandY)
    this.floaters.spawn(this.cameraComp, p.x, head + 0.45, p.z, lines[id % lines.length]!, BAD_COLOR, 26)
    this.sfx.play('deny', 0.6)
  }

  private mishap(kind: Mishap): void {
    const who = witnessMishap(this.shift.flow, kind)
    const lines = WITNESS_LINES[kind]
    if (who) this.review(who.id, 'witness', 0, lines[this.witnessLine++ % lines.length]!)
  }

  private shake(amp: number): void {
    this.shakeAmp = Math.max(amp, this.shakeLeft > 0 ? this.shakeAmp : 0)
    this.shakeLeft = FEEL.shakeSec
  }

  private readonly onWalkOut = (c: Customer): void => {
    const line = CARD_LINES[c.id % CARD_LINES.length]!.complain
    this.rant(c.id, 'walkout', WALKOUT_STARS, line)
    this.markHighlight(30, `「${StationView.nameOf(c.id)}」没人接单，气走了`, `临走前说：「${line}」`)
  }

  /** An upset customer: rant at the desk first, review on the way out (logic/vent.ts) */
  private rant(id: number, kind: ReviewKind, stars: number, text: string): void {
    this.rantReview.set(id, { kind, text })
    startRant(this.venting, id, stars)
  }

  private toRantSpot(f: Figure): void {
    const i = Math.max(0, this.venting.rants.findIndex((r) => r.id === f.id))
    f.pickup = false
    f.tx = this.queueX + RANT_DX * (i + 1)
    f.tz = this.queueZ + RANT_DZ
  }

  /** Long press at the fridge or at a ranting customer: vent (logic/vent.ts). True = this press is spent on it */
  private tryVent(): boolean {
    const a = this.router.action
    if (!a.down) this.ventedThisPress = false
    if (!a.down || this.ventedThisPress || a.heldSeconds < VENT_HOLD_SEC) return false
    const st = stationInReach(this.kitchen, this.movement.pos)
    const spot: VentSpot | null = st?.kind === 'fridge' ? 'fridge' : st?.kind === 'register' ? 'register' : null
    if (!spot || !st) return false
    this.ventedThisPress = true
    const r = vent(this.venting, spot)
    const m = this.movement.pos
    if (r === null) {
      this.report('unsupported', '没人在前台发火')
      return true
    }
    this.floaters.spawn(this.cameraComp, m.x, BUBBLE_Y.carry, m.z, r === true ? '💢 砰！' : '💢 狂点对骂！', BAD_COLOR, 30)
    if (r === true) this.markHighlight(60, '狠狠摔了一下冰柜门', '「砰！」整个后厨都听见了')
    this.sfx.play(r === true ? 'trash' : 'wrong')
    this.shake(FEEL.shakeSmall)
    return true
  }

  /** In a shouting match: every tap trades a line; walking off ends it. True = this frame belongs to the match */
  private tickArgue(): boolean {
    const r = this.venting.argue
    // Ends in logic (last tap, gone quiet, walked off); the storm-off shows the frame after
    if (this.arguing >= 0 && r?.id !== this.arguing) {
      this.argueEnded(this.arguing)
      this.arguing = -1
    }
    if (!r) return false
    const id = r.id
    this.arguing = id
    if (stationInReach(this.kitchen, this.movement.pos)?.kind !== 'register') {
      endArgue(this.venting)
      return false
    }
    if (!this.router.action.tapped) return true
    const i = argueTap(this.venting)
    this.argueCount = i + 1
    const m = this.movement.pos
    // Alternate sides so rapid taps do not stack on one spot
    const dx = i % 2 === 0 ? -0.35 : 0.35
    this.floaters.spawn(this.cameraComp, m.x + dx, BUBBLE_Y.carry + 0.2, m.z, ARGUE_CHEF[i % ARGUE_CHEF.length]!, HINT_COLOR, 28)
    const f = this.figureOf(id)
    if (f) {
      const p = f.node.position
      this.floaters.spawn(this.cameraComp, p.x - dx, this.headStandY + 0.5, p.z, ARGUE_CUSTOMER[i % ARGUE_CUSTOMER.length]!, BAD_COLOR, 26)
    }
    this.sfx.play('wrong', 0.6)
    this.shake(FEEL.shakeSmall)
    return true
  }

  private argueEnded(id: number): void {
    const n = this.argueCount
    this.argueCount = 0
    if (n > 0) {
      const last = n - 1
      this.markHighlight(100 + n * 10, `和「${StationView.nameOf(id)}」对骂了 ${n} 回合`, `你：「${ARGUE_CHEF[last % ARGUE_CHEF.length]}」\n对方：「${ARGUE_CUSTOMER[last % ARGUE_CUSTOMER.length]}」然后摔门走了`)
    }
    const f = this.figureOf(id)
    if (f) this.floaters.spawn(this.cameraComp, f.node.position.x, this.headStandY + 0.9, f.node.position.z, '（摔门走了）', BAD_COLOR, 26)
    this.sfx.play('trash')
  }

  private markHighlight(score: number, title: string, quote: string): void {
    if (this.highlight && this.highlight.score >= score) return
    this.highlight = { score, title, quote }
  }

  private static nameOf(customerId: number): string {
    return CARD_LINES[customerId % CARD_LINES.length]!.identity
  }

  private figureOf(id: number): Figure | null {
    for (const f of this.figures) if (f.id === id) return f
    return null
  }

  private readonly onRantDone = (r: Rant): void => {
    const rv = this.rantReview.get(r.id)
    this.rantReview.delete(r.id)
    if (rv) this.review(r.id, r.retorted ? 'complain' : rv.kind, rantStars(r), r.retorted ? `${rv.text}（还跟厨师对骂了一场）` : rv.text)
    for (const f of this.figures) {
      if (f.id !== r.id || !f.leaving) continue
      f.tx = this.exitX
      f.tz = this.doorZ
    }
  }

  private review(customerId: number, kind: ReviewKind, stars: number, text: string): void {
    const card = customerId % CARD_LINES.length
    const r: Review = { customerId, kind, stars, t: this.shift.t }
    addReview(this.reviews, r)
    const name = CARD_LINES[card]!.identity + (customerId >= DELIVERY_ID_BASE ? '（外卖）' : '')
    const line: ReviewLine = { name, avatar: card, stars, text }
    this.reviewLines.push(line)
    if (this.reviewLines.length > this.reviews.cap) this.reviewLines.shift()
    this.toast.push(line)
  }

  private openReviews(): void {
    const newest: ReviewLine[] = []
    for (let i = this.reviewLines.length - 1; i >= 0; i--) newest.push(this.reviewLines[i]!)
    this.board.show(averageStars(this.reviews), newest)
    popIn(this.board.node)
    this.sfx.play('tap')
    this.reviewsOpen = true
    this.syncOffers()
    this.router.cancelAll()
  }

  /** Map desk offers onto panel rows and redraw; the mask feeds the zone key */
  private syncOffers(): void {
    let j = 0
    let mask = ''
    for (const d of this.desk.slots) {
      if (d.status !== 'offer' || j >= this.offerRows.length) continue
      this.offerRows[j] = d
      const v = this.offerView[j] ?? { text: '', sec: 0 }
      v.text = StationView.specText(d.spec)
      v.sec = Math.ceil(d.left)
      this.offerView[j] = v
      j++
    }
    for (let i = 0; i < this.offerRows.length; i++) {
      if (i >= j) {
        this.offerRows[i] = null
        this.offerView[i] = null
      }
      mask += this.offerRows[i] ? '1' : '0'
    }
    this.offerMask = mask
    this.board.syncOffers(this.offerView)
  }

  private tickComputer(): void {
    for (let i = 0; i < this.offerRows.length; i++) {
      const d = this.offerRows[i]
      if (!d) continue
      if (this.router.zone(`accept${i}`)?.tapped) {
        if (acceptDelivery(this.desk, d)) this.sfx.play('pick')
        else this.report('hands-full', `外卖同时最多做 ${DELIVERY_ACTIVE} 单`)
        return this.syncOffers()
      }
      if (this.router.zone(`reject${i}`)?.tapped) {
        this.sfx.play('tap')
        rejectDelivery(this.desk, d)
        this.review(DELIVERY_ID_BASE + d.id, 'reject', REJECT_STARS, '外卖单被拒了')
        return this.syncOffers()
      }
    }
    if (this.router.zone('reviews-outside')?.tapped) {
      this.sfx.play('tap')
      return this.closeReviews()
    }
    this.syncOffers()
  }

  private readonly deskEvents: DeskEvents = {
    onExpire: (d) => this.review(DELIVERY_ID_BASE + d.id, 'reject', REJECT_STARS, '外卖单挂了半天没人接'),
    onLate: (d) => this.review(DELIVERY_ID_BASE + d.id, 'walkout', WALKOUT_STARS, '骑手等不到餐，单子作废了'),
  }

  /** Two extra HUD cards for accepted deliveries, cloned from Order_0 */
  private buildDeliveryCards(root: Node): void {
    const src = this.orderCards[0]!
    const h = src.getComponent(UITransform)?.height ?? 80
    for (let i = 0; i < DELIVERY_ACTIVE; i++) {
      const card = instantiate(src)
      card.name = `Delivery_${i}`
      root.addChild(card)
      // Left column under the diner row
      card.setPosition(this.orderCards[0]!.position.x, -(h + 12) * (i + 1), 0)
      card.active = false
      this.deliveryCards.push(card)
      this.deliveryTexts.push(card.getChildByName('Text')!.getComponent(Label)!)
      this.deliveryBars.push(card.getChildByName('Bar')!)
      this.deliveryShown.push(-1)
    }
  }

  /** Rings over the counter computer (offers waiting) and the takeaway shelf (orders due) */
  private syncDeliveryRings(): void {
    const cam = this.cameraComp
    const soonest = (status: Delivery['status']): number => {
      let k = 2
      for (const d of this.desk.slots) if (d.status === status && d.max > 0) k = Math.min(k, d.left / d.max)
      return k
    }
    const r = this.registerStation
    const offer = soonest('offer')
    if (r && offer <= 1) {
      this.registerRing.show(offer, StationView.ringColor(offer), '🛵')
      this.registerRing.follow(cam, r.pos.x, BUBBLE_Y.grill, r.pos.z, this.uiHalfW, this.uiHalfH)
    } else this.registerRing.hide()
    const s = this.deliveryStation
    const due = soonest('accepted')
    if (s && due <= 1) {
      this.deliveryRing.show(due, StationView.ringColor(due), '🛍')
      this.deliveryRing.follow(cam, s.pos.x, BUBBLE_Y.grill, s.pos.z, this.uiHalfW, this.uiHalfH)
    } else this.deliveryRing.hide()
    if (this.desk.nextId !== this.seenOffer) {
      this.seenOffer = this.desk.nextId
      this.toast.push({ name: '外卖平台', avatar: PLATFORM_AVATAR, stars: 0, text: '新外卖单，去点单台电脑接单' })
    }
  }

  private closeReviews(): void {
    this.reviewsOpen = false
    this.board.hide()
    this.router.cancelAll()
  }

  /** What a tap (or hold) on the action key would do here, shown on the key */
  private actionVerb(): string {
    const st = stationInReach(this.kitchen, this.movement.pos)
    if (!st) return ''
    if (this.phase !== 'open') return st.kind === 'register' ? (this.phase === 'rest' ? '装修' : '开门') : ''
    const k = this.kitchen
    const held = k.carry.kind
    switch (st.kind) {
      case 'fridge':
        return held === 'crate' ? '补货' : '取料'
      case 'grill':
        if (k.fire) return held === 'extinguisher' ? '灭火' : '着火了'
        return held === 'patty' && k.carry.cook === 'raw' ? '下锅' : '取肉'
      case 'assembly':
        return held === 'none' ? '端盘' : held === 'plate' ? '放下' : '组装'
      case 'serve':
        return '上菜'
      case 'delivery':
        return '交外卖'
      case 'register':
        return this.venting.argue ? '狂点骂' : rantsLeft(this.venting) > 0 ? '长按怼' : '接单'
      case 'storeroom':
        return '搬箱'
      case 'sink':
        return k.sink.stage === 'soaked' ? '按住刷' : k.sink.stage === 'soaking' ? '泡着' : '泡碗'
      case 'rack':
        return '拿盘子'
      case 'shelf':
        return held === 'stack' ? '放盘子' : ''
      case 'extinguisher':
        return held === 'extinguisher' ? '放回' : '灭火器'
      case 'drinks':
        return k.drinks.stage === 'ready' ? '取饮料' : k.drinks.stage === 'pouring' ? '接着' : k.drinks.stage === 'spilled' ? '擦干净' : '接饮料'
      case 'fryer':
        return k.fryer.stage === 'ready' ? '取薯条' : k.fryer.stage === 'frying' ? '炸着' : k.fryer.stage === 'burnt' ? '倒掉' : '下薯条'
      default:
        return ''
    }
  }

  /** Clean plates over the shelf, the sink's soak/scrub progress, the rack drying */
  private syncKitchenRings(): void {
    const k = this.kitchen
    const cam = this.cameraComp
    if (k.plates !== this.shownPlates && this.plateModels.length > 0) {
      this.shownPlates = k.plates
      for (let i = 0; i < this.plateModels.length; i++) this.plateModels[i]!.active = i < k.plates
    }
    if (k.plates !== Infinity) {
      const fill = Math.min(1, k.plates / this.plateCount)
      this.plateRing.show(fill, StationView.ringColor(fill), '🍽')
      this.plateRing.follow(cam, this.platePos.x, BUBBLE_Y.bench, this.platePos.z, this.uiHalfW, this.uiHalfH)
    }
    const s = this.sinkStation
    if (s) {
      const sink = k.sink
      const w = k.cfg.wash ?? DEFAULT_WASH
      if (sink.stage === 'soaking') this.sinkRing.show(1 - sink.left / w.soakSec, ASK_COLOR, '💧')
      else if (sink.stage === 'soaked') this.sinkRing.show(sink.scrub, RING_OK, '🧽')
      else if (k.dirty > 0) this.sinkRing.show(-1, RING_OK, `脏${k.dirty}`, LATE_BAR_COLOR)
      else this.sinkRing.hide()
      if (sink.stage !== 'empty' || k.dirty > 0) this.sinkRing.follow(cam, s.pos.x, BUBBLE_Y.bench, s.pos.z, this.uiHalfW, this.uiHalfH)
    }
    if (k.rack.count > 0) this.rackRing.show(1 - k.rack.left / (k.cfg.wash ?? DEFAULT_WASH).drySec, RING_OK, `${k.rack.count}`)
    // Dried and waiting to be carried over: the number in the "come and get it" colour
    else if (k.rack.ready > 0) this.rackRing.show(-1, RING_OK, `🍽${k.rack.ready}`, ASK_COLOR)
    else this.rackRing.hide()
    if (k.rack.count > 0 || k.rack.ready > 0) {
      this.rackRing.follow(cam, this.rackPos.x, BUBBLE_Y.bench, this.rackPos.z, this.uiHalfW, this.uiHalfH)
    }
    const fr = this.fryerStation
    const fs = k.cfg.fryerSec
    if (fr && fs !== undefined && k.fryer.stage !== 'empty') {
      if (k.fryer.stage === 'frying') this.fryerRing.show(1 - k.fryer.left / fs, ASK_COLOR, '🍟')
      else if (k.fryer.stage === 'burnt') this.fryerRing.show(1, BAD_COLOR, '🔥')
      else {
        // Ready: the ring drains towards burning
        const left = k.fryer.left / FRY_BURN_SEC
        this.fryerRing.show(left, StationView.ringColor(left), '🍟')
      }
      this.fryerRing.follow(cam, fr.pos.x, BUBBLE_Y.grill, fr.pos.z, this.uiHalfW, this.uiHalfH)
    } else this.fryerRing.hide()
    const dm = this.drinksStation
    const ds = k.cfg.drinkSec
    if (dm && ds !== undefined && k.drinks.stage !== 'empty') {
      if (k.drinks.stage === 'pouring') this.drinksRing.show(1 - k.drinks.left / ds, ASK_COLOR, '🥤')
      else if (k.drinks.stage === 'spilled') this.drinksRing.show(1, BAD_COLOR, '💦')
      else {
        const left = k.drinks.left / DRINK_SPILL_SEC
        this.drinksRing.show(left, StationView.ringColor(left), '🥤')
      }
      this.drinksRing.follow(cam, dm.pos.x, BUBBLE_Y.grill, dm.pos.z, this.uiHalfW, this.uiHalfH)
    } else this.drinksRing.hide()
  }

  private static ringColor(k: number): Readonly<Color> {
    return k > 0.5 ? RING_OK : k > 0.25 ? RING_WARN : LATE_BAR_COLOR
  }

  /** 订单卡文本。只在换人时调用，不在每帧热路径上 */
  private static orderText(c: Customer): string {
    if (c.burgerVerdict) return `🍔 已上\n等 ${c.friesDue ? '🍟 薯条 ' : ''}${c.drinkDue ? '🥤 饮料' : ''}`.trimEnd()
    const fries = c.spec.fries ? (c.friesDue ? ' +薯条' : ' 🍟已上') : ''
    const drink = c.spec.drink ? (c.drinkDue ? ' +饮料' : ' 🥤已上') : ''
    return StationView.specText(c.spec, '\n', fries + drink)
  }

  private static specText(spec: OrderSpec, sep = ' ', tail = ''): string {
    const req = spec.required.map((i) => INGREDIENT_LABEL[i]).join(' ')
    const ban = spec.banned.length > 0 ? `${sep}忌 ${spec.banned.map((i) => INGREDIENT_LABEL[i]).join(' ')}` : ''
    return `${spec.double ? '双层 ' : ''}${req}${sep}${COOK_LABEL[spec.doneness]}${tail}${ban}`
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
    else if (carry.kind === 'fries') {
      if (this.carryBubble.show(600, buf, 0, '🍟 薯条', GOOD_COLOR)) pop(this.carryBubble.node)
    } else if (carry.kind === 'drink') {
      if (this.carryBubble.show(602, buf, 0, '🥤 饮料', GOOD_COLOR)) pop(this.carryBubble.node)
    } else if (carry.kind === 'extinguisher') {
      if (this.carryBubble.show(601, buf, 0, '🧯 灭火器', BAD_COLOR)) pop(this.carryBubble.node)
    } else if (carry.kind === 'ingredient') {
      buf[0] = this.icon(carry.ingredient)
      const n = carry.second === null ? 1 : 2
      if (carry.second !== null) buf[1] = this.icon(carry.second)
      const key = 100 + INGREDIENTS.indexOf(carry.ingredient) * 10 + (carry.second === null ? 9 : INGREDIENTS.indexOf(carry.second))
      if (this.carryBubble.show(key, buf, n, '', Color.WHITE)) pop(this.carryBubble.node)
    } else if (carry.kind === 'crate') {
      buf[0] = this.icon(carry.ingredient)
      if (this.carryBubble.show(400 + INGREDIENTS.indexOf(carry.ingredient), buf, 1, '整箱', Color.WHITE)) pop(this.carryBubble.node)
    } else if (carry.kind === 'stack') {
      for (let i = 0; i < carry.count; i++) buf[i] = this.plateIcon
      const heavy = carry.count > (k.cfg.stackSlow ?? STACK_SLOW)
      if (this.carryBubble.show(500 + carry.count, buf, carry.count, heavy ? '太重了 · 别撞墙' : '', heavy ? BAD_COLOR : Color.WHITE)) {
        pop(this.carryBubble.node)
      }
    } else if (carry.kind === 'patty') {
      const n = carry.plated ? 2 : 1
      buf[0] = this.plateIcon
      buf[n - 1] = this.icon('patty')
      const caption = COOK_LABEL[carry.cook] + (carry.stained ? ' · 脏盘' : '')
      if (this.carryBubble.show(200 + n * 10 + COOK_LEVELS.indexOf(carry.cook) + (carry.stained ? 50 : 0), buf, n, caption, COOK_COLOR[carry.cook])) {
        pop(this.carryBubble.node)
      }
    } else {
      const cook = k.burger.cook
      // The 3D stack already shows what is on it: doneness caption only
      const n = this.burgerStack ? 0 : k.burger.ingredients.length + 1
      if (n > 0) {
        this.fillBurger(1)
        buf[0] = this.plateIcon
      }
      const redrawn = this.carryBubble.show(
        300 + k.burger.ingredients.length * 10 + (cook ? COOK_LEVELS.indexOf(cook) : 9),
        buf,
        n,
        cook ? COOK_LABEL[cook] : '',
        cook ? COOK_COLOR[cook] : Color.WHITE,
      )
      if (redrawn) pop(this.carryBubble.node)
    }
    if (carry.kind !== 'none') this.carryBubble.follow(cam, m.x, BUBBLE_Y.carry, m.z, this.uiHalfW, this.uiHalfH)

    const g = this.grillStation
    if (g) {
      const w = k.cfg.cook
      for (let i = 0; i < this.grillRings.length; i++) {
        const ring = this.grillRings[i]!
        const slot = k.grill[i]
        if (k.fire) {
          ring.show(1, BAD_COLOR, '🔥')
          ring.follow(cam, g.pos.x, BUBBLE_Y.grill, g.pos.z, this.uiHalfW, this.uiHalfH, (i - 0.5) * 64)
          continue
        }
        if (!slot || !slot.busy) {
          ring.hide()
          continue
        }
        const lv = grillCookLevel(k, i)
        const fs = k.cfg.fireSec
        // Full ring = burnt, so the arc racing towards 12 o'clock is the warning; once burnt it drains towards the fire
        if (lv === 'burnt' && fs !== undefined) ring.show(Math.max(0, 1 - (slot.elapsed - w.burntAt) / fs), BAD_COLOR, COOK_LABEL[lv])
        else ring.show(slot.elapsed / w.burntAt, COOK_COLOR[lv], COOK_LABEL[lv])
        ring.follow(cam, g.pos.x, BUBBLE_Y.grill, g.pos.z, this.uiHalfW, this.uiHalfH, (i - 0.5) * 64)
      }
    }

    const b = this.benchStation
    if (b) {
      if (!k.assemblyOccupied) this.benchBubble.hide()
      else {
        const n = this.burgerStack ? 0 : k.burger.ingredients.length
        if (n > 0) this.fillBurger(0)
        const cook = k.burger.cook
        const redrawn = this.benchBubble.show(
          k.burger.ingredients.length * 10 + (cook ? COOK_LEVELS.indexOf(cook) : 9),
          buf,
          n,
          cook ? COOK_LABEL[cook] : '',
          cook ? COOK_COLOR[cook] : Color.WHITE,
        )
        if (redrawn) pop(this.benchBubble.node)
        this.benchBubble.follow(cam, b.pos.x, BUBBLE_Y.bench, b.pos.z, this.uiHalfW, this.uiHalfH)
      }
    }

    const bs = this.burgerStack
    if (bs) {
      const burger = k.burger
      if (carry.kind === 'plate') {
        const yaw = this.movement.facingYaw
        bs.show(burger, k.burgerPlated, m.x + Math.sin(yaw) * HAND.reach, HAND.y, m.z + Math.cos(yaw) * HAND.reach)
      } else if (k.assemblyOccupied && b) bs.show(burger, false, b.pos.x, this.benchTopY, b.pos.z)
      else bs.hide()
    }
  }

  /** Decor slots take over the scene's own plants: a holder at each original's spot, the originals become templates */
  private buildDecor(kitchenRoot: Node): void {
    const props = kitchenRoot.getChildByName('Props')
    const plants = props?.getChildByName('Prop_Waiting')?.children.filter((c) => c.name === 'pottedPlant') ?? []
    const left = plants.find((c) => c.worldPosition.x < 0)
    const right = plants.find((c) => c.worldPosition.x > 0)
    const small = props?.getChildByPath('Prop_Serve/plantSmall1')
    const book = props?.getChildByPath('Prop_Shelf_0/bookcaseOpen')
    if (!props || !left || !right || !small || !book) {
      console.warn('[StationView] 装饰模板没找齐（等候区两盆盆栽 / 出餐台小盆栽 / 库房书架），装修不生效')
      return
    }
    this.decorTemplates.set('plant', left).set('plant-small', small).set('bookcase', book)
    const spots: Record<DecorSlotId, Vec3> = {
      'wait-left': left.worldPosition.clone(),
      'wait-right': right.worldPosition.clone(),
      counter: small.worldPosition.clone(),
      'wall-n': new Vec3(WALL_N_SPOT[0], 0, WALL_N_SPOT[1]),
    }
    for (const sl of DECOR_SLOTS) {
      const h = new Node(`Decor_${sl.id}`)
      h.layer = props.layer
      props.addChild(h)
      h.setWorldPosition(spots[sl.id])
      this.decorSlots.set(sl.id, h)
    }
    left.active = false
    right.active = false
    small.active = false
    const wallMat = kitchenRoot.getChildByName('Wall_N')?.getComponent(MeshRenderer)?.sharedMaterial
    const floorMat = kitchenRoot.getChildByName('Floor')?.getComponent(MeshRenderer)?.sharedMaterial
    for (const mr of kitchenRoot.getComponentsInChildren(MeshRenderer)) {
      if (wallMat && mr.sharedMaterial === wallMat) this.wallRenderers.push(mr)
      else if (floorMat && mr.sharedMaterial === floorMat) this.floorRenderers.push(mr)
    }
    this.applyDecor()
  }

  private applyDecor(): void {
    const d = this.progress.decor
    for (const sl of DECOR_SLOTS) {
      const h = this.decorSlots.get(sl.id)
      const want = d.placed[sl.id]
      if (!h || (h.children[0]?.name ?? null) === want) continue
      h.destroyAllChildren()
      const tpl = want ? this.decorTemplates.get(want) : undefined
      if (!want || !tpl) continue
      const n = instantiate(tpl)
      n.name = want
      n.active = true
      h.addChild(n)
      n.setPosition(0, 0, 0)
      n.setRotationFromEuler(0, 0, 0)
    }
    const w = WALL_COLORS[d.wall]!.rgb
    const f = FLOOR_COLORS[d.floor]!.rgb
    for (const mr of this.wallRenderers) mr.material?.setProperty('mainColor', new Color(w[0], w[1], w[2], 255))
    for (const mr of this.floorRenderers) mr.material?.setProperty('mainColor', new Color(f[0], f[1], f[2], 255))
  }

  /** Shelf stack from the scene's Prop_Plate plates: extra ones cloned at the same spacing, up to every plate there is */
  private buildPlateModels(kitchenRoot: Node): void {
    const root = kitchenRoot.getChildByPath('Props/Prop_Plate')
    const own = root ? root.children.filter((c) => c.name === 'plate').sort((a, b) => a.position.y - b.position.y) : []
    if (own.length < 2) {
      console.warn('[StationView] Props/Prop_Plate 底下的盘子少于 2 个，盘子堆不随数量变化')
      return
    }
    const step = own[1]!.position.y - own[0]!.position.y
    const base = own[0]!
    while (own.length < this.plateCount + this.sparePlates) {
      const n = instantiate(base)
      root!.addChild(n)
      n.setPosition(base.position.x, base.position.y + step * own.length, base.position.z)
      own.push(n)
    }
    this.plateModels = own
  }

  /** Layer art is cloned from food props already in the scene, so no new asset wiring is needed */
  private buildBurgerStack(kitchenRoot: Node): void {
    const find = (p: string): Node | null => kitchenRoot.getChildByPath(`Props/${p}`)
    const benchPlate = find('Prop_AssemblyPlate/plate')
    const art = {
      bread: find('Prop_Crates/bread'),
      meat: find('Prop_Crates/meat-raw'),
      cheese: find('Prop_Crates/cheese'),
      cabbage: find('Prop_Crates/cabbage'),
      tomato: find('Prop_Crates/tomato'),
      plate: benchPlate,
    }
    for (const [k, v] of Object.entries(art)) {
      if (!v) {
        console.warn(`[StationView] 汉堡叠层缺素材 ${k}，退回平铺图标`)
        return
      }
    }
    this.burgerStack = new BurgerStack(kitchenRoot.scene, art as { [K in keyof typeof art]: Node })
    // Sits on the bench's decor plate
    this.benchTopY = benchPlate!.worldPosition.y + 0.02
  }

  /**
   * 顾客小人：进门 → 排队 → 接单后去长凳 → 离店走出去。位置是纯表现，规则全在 customer.ts；
   * 小人按顾客 id 认人，不按槽位 —— 槽位一空就会被新来的复用，而走的那位还在路上。
   */
  /** A rider walks in when a delivery is accepted, waits outside the pickup counter, and leaves once it is settled either way */
  private syncRiders(dt: number): void {
    const pick = this.deliveryStation
    if (!pick) return
    for (const r of this.riders) {
      if (r.id >= 0 && !r.leaving && !this.desk.slots.some((d) => d.status === 'accepted' && d.id === r.id)) {
        r.leaving = true
        r.tx = this.doorX
        r.tz = this.doorZ
      }
    }
    for (const d of this.desk.slots) {
      if (d.status !== 'accepted' || this.riders.some((r) => r.id === d.id)) continue
      const r = this.riders.find((x) => x.id < 0)
      if (!r) break
      r.id = d.id
      r.leaving = false
      r.node.active = true
      r.node.setPosition(this.doorX, 0, this.doorZ)
      const i = this.riders.indexOf(r)
      r.tx = this.doorX + RIDER_SPOT[0]
      r.tz = this.doorZ + RIDER_SPOT[1] + RIDER_GAP * i
    }
    for (const r of this.riders) {
      if (r.id < 0) continue
      const p = r.node.position
      const dx = r.tx - p.x
      const dz = r.tz - p.z
      const d = Math.hypot(dx, dz)
      const step = CUSTOMER_SPEED * dt
      let clip = 'idle'
      if (d > step) {
        r.node.setPosition(p.x + (dx / d) * step, 0, p.z + (dz / d) * step)
        r.body.setRotationFromEuler(0, (Math.atan2(dx, dz) * 180) / Math.PI, 0)
        clip = 'walk'
      } else if (r.leaving) {
        r.id = -1
        r.leaving = false
        r.node.active = false
        continue
      } else {
        r.node.setPosition(r.tx, 0, r.tz)
        r.body.setRotationFromEuler(0, -90, 0) // facing the counter, west
      }
      if (clip !== r.clip) {
        r.clip = clip
        r.anim?.crossFade(clip, 0.15)
      }
    }
    for (let i = 0; i < this.riders.length; i++) {
      const r = this.riders[i]!
      const ring = this.riderRings[i]
      const d = r.id >= 0 && !r.leaving ? this.desk.slots.find((x) => x.id === r.id) : undefined
      if (!ring) continue
      if (!d || !r.node.active) {
        ring.hide()
        continue
      }
      const k = d.max > 0 ? Math.max(0, d.left / d.max) : 0
      ring.show(k, StationView.ringColor(k), '🛵')
      const p = r.node.position
      ring.follow(this.cameraComp, p.x, p.y + this.headStandY, p.z)
    }
  }

  private syncCustomers(): void {
    const dt = game.deltaTime
    this.syncRiders(dt)
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
      f.tx = f.pickup ? this.pickupX : this.exitX
      f.tz = f.pickup ? this.queueZ : this.doorZ
      if (ranting(this.venting, f.id)) this.toRantSpot(f)
    }
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!
      const b = this.customerRings[i]!
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
        f.pickup = false
        f.shouted = false
        f.seat = -1
        f.clip = ''
        f.node.setPosition(this.doorX, 0, this.doorZ)
        f.node.active = true
      }
      if (!c.ordered) {
        const k = queueIndex(flow, c)
        f.tx = this.queueX + k * QUEUE_GAP
        f.tz = this.queueZ
        // Walking in: just the "!" so the player sees someone is coming; the ring starts at the counter
        const walking = orderPatienceLeft(flow, c) >= this.orderPatienceSec
        const left = patienceRatio(flow, c)
        b.show(walking ? -1 : left, StationView.ringColor(left), '❗', ASK_COLOR)
      } else {
        const left = patienceRatio(flow, c)
        b.show(c.late ? 1 : left, c.late ? LATE_BAR_COLOR : StationView.ringColor(left), MOOD_FACE[moodTier(flow, c)])
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
      const p = f.node.position
      const head = f.clip === 'sit' ? this.headSitY : this.headStandY
      // Not pinned to the screen edge: the ring belongs to the head, off-screen with it
      b.follow(this.cameraComp, p.x, p.y + head, p.z)
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
        if (f.pickup && f.leaving) {
          f.pickup = false
          f.tx = this.exitX
          f.tz = this.doorZ
          continue
        }
        if (f.leaving && ranting(this.venting, f.id)) {
          if (!f.shouted) {
            f.shouted = true
            this.floaters.spawn(this.cameraComp, p.x, this.headStandY + 0.3, p.z, '😡 投诉！', BAD_COLOR, 28)
          }
          f.body.setRotationFromEuler(0, 180, 0)
          if (f.clip !== 'idle') {
            f.clip = 'idle'
            f.anim?.crossFade('idle', 0.15)
          }
          continue
        }
        if (f.leaving) {
          f.id = -1
          f.leaving = false
          f.node.active = false
          continue
        }
        const sit = f.seat >= 0 && WAIT_SPOTS[f.seat]![2]
        f.node.setPosition(f.tx, sit ? SEAT_Y : 0, f.tz)
        f.body.setRotationFromEuler(0, 180, 0) // 面朝柜台（北）
        clip = sit ? 'sit' : 'idle'
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
    let j = 0
    for (const d of this.desk.slots) {
      if (d.status !== 'accepted' || j >= this.deliveryCards.length) continue
      const card = this.deliveryCards[j]!
      if (!card.active) card.active = true
      if (this.deliveryShown[j] !== d.id) {
        this.deliveryShown[j] = d.id
        this.deliveryTexts[j]!.string = `🛵 ${StationView.specText(d.spec, '\n')}`
        pop(card, 1.1)
      }
      this.deliveryBars[j]!.setScale(d.max > 0 ? Math.max(0, d.left / d.max) : 0, 1, 1)
      j++
    }
    for (; j < this.deliveryCards.length; j++) {
      if (this.deliveryCards[j]!.active) this.deliveryCards[j]!.active = false
      this.deliveryShown[j] = -1
    }
    this.syncDeliveryRings()

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
      // Key carries the sides too, so handing over part of an order redraws the card
      const shown = c.id * 8 + (c.friesDue ? 1 : 0) + (c.drinkDue ? 2 : 0) + (c.burgerVerdict ? 4 : 0)
      if (this.orderShown[i] !== shown) {
        this.orderShown[i] = shown
        this.orderTexts[i]!.string = StationView.orderText(c)
        pop(card, 1.1)
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
    // The HUD stops syncing once the result is up; without this the last order card stays frozen behind it
    this.syncHud()
    this.resultOpen = true
    this.panelOpen = false
    if (this.reviewsOpen) this.closeReviews()
    this.toast.clear()
    this.router.cancelAll()

    const r = shiftResult(this.shift)
    const stars = starsForShift(r)
    this.passed = finishDay(this.progress, this.day, stars)
    const takings = ledgerTotal(this.ledger)
    const states = this.syncTasks(true)
    const done = states.filter((x) => x === 'done').length
    const reward = taskReward(states)
    bank(this.progress, takings + reward)
    StationView.save(this.progress)
    this.resultTitle.string = `第 ${this.day} 天  ${stars > 0 ? '★'.repeat(stars) : '打烊'}`
    this.resultHead =
      `来客 ${r.arrived}    好评 ${r.served}\n` +
      `超时免单 ${r.lateServed}    上错 ${r.wrong}\n` +
      `没人接单走了 ${r.walkedOut}    等太久走了 ${r.leftLate}    摔碎盘子 ${this.kitchen.broken}\n` +
      `外卖 送达 ${this.desk.delivered}  做错 ${this.desk.wrong}  超时 ${this.desk.late}  拒 ${this.desk.rejected}\n` +
      `好评率 ${Math.round(r.goodRate * 100)}%` + (stars === 0 ? '    拿到一颗星才能进下一天' : '') +
      `\n今日收入 ¥${takings}（小费 ¥${this.ledger.tips}）` +
      `\n今日任务 完成 ${done}/${states.length}  奖励 ¥${reward}` + (done === states.length ? '（含全部完成奖励）' : '')
    this.syncResultMoney()
    const again = this.againNode
    const againLabel = again.getChildByName('Label')?.getComponent(Label)
    if (againLabel) againLabel.string = this.passed ? '重打这一天' : '再来一局'
    if (this.nextNode) this.nextNode.active = this.passed
    const row = [again, this.passed ? this.nextNode : null, this.shopNode].filter((n): n is Node => !!n)
    for (let i = 0; i < row.length; i++) row[i]!.setPosition((i - (row.length - 1) / 2) * RESULT_BTN_GAP, again.position.y, 0)
    const h = this.highlight
    this.highlightCard.show(h ? h.title : '今天风平浪静', h ? h.quote : '没吵架、没着火、没摔盘子，难得的一天')
    const panel = again.parent
    const pw = panel?.getComponent(UITransform)?.width ?? 520
    this.highlightCard.node.setPosition((panel?.position.x ?? 0) + pw / 2 + 16 + this.highlightCard.width / 2, panel?.position.y ?? 0, 0)
    this.resultNode.active = true
    if (again.parent) popIn(again.parent)
    this.sfx.play('result')
    this.zonesKey = ''
    this.refreshZones()
    console.log(`[StationView] 打烊 — day=${this.day} ${JSON.stringify(r)} stars=${stars} passed=${this.passed}`)
  }

  private syncResultMoney(): void {
    this.resultBody.string = `${this.resultHead}    存款 ¥${this.progress.coins}`
  }

  private openMenu(kind: string): void {
    this.sfx.play('tap')
    this.menuKind = kind
    this.refreshMenu()
    popIn(this.menu.node)
    this.router.cancelAll()
  }

  private refreshMenu(): void {
    if (!this.menuKind) return
    const { title, rows } = this.buildMenu(this.menuKind)
    this.menuRows = rows
    this.menu.show(title, rows)
    this.zonesKey = ''
  }

  private closeMenu(): void {
    this.menuKind = null
    this.menuRows = []
    this.menu.hide()
    this.router.cancelAll()
  }

  private tickMenu(): void {
    for (let i = 0; i < this.menuRows.length; i++) {
      if (!this.router.zone(`row${i}`)?.tapped) continue
      const r = this.menuRows[i]!
      if (r.on) r.run()
      else this.sfx.play('deny', 0.7)
      return
    }
    if (this.router.zone('menu-outside')?.tapped) {
      this.sfx.play('tap')
      this.closeMenu()
    }
  }

  /** A purchase went through: save, cheer, redraw the money */
  private spent(): void {
    StationView.save(this.progress)
    this.sfx.play('serve')
    if (this.resultOpen) this.syncResultMoney()
  }

  private buildMenu(kind: string): { title: string; rows: MenuRow[] } {
    const p = this.progress
    const coins = p.coins
    const money = `存款 ¥${coins} · 点空白处关闭`
    if (kind === 'shop') {
      // Bought items take effect from the next day started (applyUpgrades in restart)
      return {
        title: `商店 · ${money}`,
        rows: SHOP.map((it) => {
          const have = owns(p, it.id)
          return {
            name: `${it.name}  ¥${it.price}`,
            desc: it.desc,
            btn: have ? '已拥有' : coins >= it.price ? '购买' : '钱不够',
            on: !have && coins >= it.price,
            run: () => {
              if (buy(p, it.id) === 'ok') this.spent()
              this.refreshMenu()
            },
          }
        }),
      }
    }
    if (kind === 'open') {
      return {
        title: `第 ${this.day} 天 · 还没开门`,
        rows: [
          { name: '开门营业', desc: '顾客开始上门', btn: '开门', on: true, run: () => this.openForBusiness() },
          { name: '今天打烊休息', desc: '今天不开门，可以装修店面；不算天数', btn: '休息', on: true, run: () => this.startRest() },
        ],
      }
    }
    if (kind === 'rest') {
      const rows: MenuRow[] = DECOR_SLOTS.map((sl) => {
        const cur = p.decor.placed[sl.id]
        return {
          name: `${sl.name}：${cur ? DECOR_ITEMS.find((x) => x.id === cur)!.name : '空着'}`,
          desc: '换一样摆设',
          btn: '换',
          on: true,
          run: () => this.openMenu(`slot:${sl.id}`),
        }
      })
      rows.push(
        { name: `墙面颜色：${WALL_COLORS[p.decor.wall]!.name}`, desc: `每换一次 ¥${COLOR_PRICE}`, btn: '换', on: true, run: () => this.openMenu('wall') },
        { name: `地板颜色：${FLOOR_COLORS[p.decor.floor]!.name}`, desc: `每换一次 ¥${COLOR_PRICE}`, btn: '换', on: true, run: () => this.openMenu('floor') },
        { name: '休息结束', desc: `开门营业第 ${this.day} 天`, btn: '开门', on: true, run: () => this.openForBusiness() },
      )
      return { title: `休息日 · ${money}`, rows }
    }
    if (kind === 'wall' || kind === 'floor') {
      const list = kind === 'wall' ? WALL_COLORS : FLOOR_COLORS
      return {
        title: `${kind === 'wall' ? '墙面' : '地板'}颜色 · ${money}`,
        rows: list.map((c, i) => {
          const cur = p.decor[kind] === i
          return {
            name: c.name,
            desc: '',
            btn: cur ? '当前' : coins >= COLOR_PRICE ? `¥${COLOR_PRICE}` : '钱不够',
            on: !cur && coins >= COLOR_PRICE,
            run: () => {
              if (paint(p, kind, i) === 'ok') {
                this.spent()
                this.applyDecor()
              }
              this.openMenu('rest')
            },
          }
        }),
      }
    }
    const slot = DECOR_SLOTS.find((x) => `slot:${x.id}` === kind)!
    const cur = p.decor.placed[slot.id]
    const choices: (DecorItemId | null)[] = [null, ...slot.allowed]
    return {
      title: `${slot.name} · ${money}`,
      rows: choices.map((id) => {
        const it = id ? DECOR_ITEMS.find((x) => x.id === id)! : null
        const have = !it || p.decor.owned.includes(it.id)
        const afford = have || coins >= it!.price
        return {
          name: it ? it.name : '空着',
          desc: !it ? '什么都不摆' : have ? '已经买过，摆上不要钱' : `¥${it.price}，买一次哪个位子都能摆`,
          btn: cur === id ? '当前' : !afford ? '钱不够' : have ? (it ? '摆上' : '撤掉') : '买下',
          on: cur !== id && afford,
          run: () => {
            if (place(p, slot.id, id) === 'ok') {
              if (have) this.sfx.play('drop')
              else this.spent()
              StationView.save(p)
              this.applyDecor()
            }
            this.openMenu('rest')
          },
        }
      }),
    }
  }

  private openForBusiness(): void {
    this.closeMenu()
    this.phase = 'open'
    this.taskCard.node.active = true
    this.floaters.spawnAt(0, 60, `第 ${this.day} 天 · 开门营业！`, GOOD_COLOR, 44)
    this.zonesKey = ''
  }

  private startRest(): void {
    this.closeMenu()
    this.phase = 'rest'
    this.taskCard.node.active = false
    this.floaters.spawnAt(0, 60, '今天休息 · 去前台装修', GOOD_COLOR, 40)
    this.zonesKey = ''
  }

  /** The day's opening banner */
  private openDay(): void {
    this.phase = 'closed'
    this.taskCard.node.active = true
    this.floaters.spawnAt(0, 60, `第 ${this.day} 天 · 去前台开门`, GOOD_COLOR, 44)
    this.tasks = rollTasks(this.day, this.customersPerShift, owns(this.progress, 'fryer'))
    this.taskState = this.tasks.map((): TaskStatus => 'open')
    this.taskShown = this.tasks.map(() => '')
    this.syncTasks(false)
  }

  /** Re-reads the day's counters into the task card. `closed` settles open tasks. A task done mid-shift pops a floater */
  private syncTasks(closed: boolean): TaskStatus[] {
    const s = collectStats(shiftResult(this.shift), this.kitchen, this.desk, this.ledger)
    for (let i = 0; i < this.tasks.length; i++) {
      const t = this.tasks[i]!
      const st = taskStatus(t, s, closed)
      if (!closed && st === 'done' && this.taskState[i] === 'open') this.floaters.spawnAt(0, 20, `✔ 任务完成 +¥${TASK_REWARD}`, GOOD_COLOR, 36)
      this.taskState[i] = st
      const text = taskText(t, s)
      if (this.taskShown[i] !== st + text) {
        this.taskShown[i] = st + text
        this.taskCard.set(i, text, st)
      }
    }
    return this.taskState
  }

  /** Start `day` over: the same day replays the same orders (seed unchanged), a new day tightens the flow */
  private restart(day: number): void {
    this.sfx.play('tap')
    this.day = day
    this.passed = false
    this.resultOpen = false
    this.resultNode.active = false
    if (this.menuKind) this.closeMenu()
    this.applyUpgrades()
    const cfg = this.shiftConfig(day, this.shift.cfg.seed)
    resetShift(this.shift, cfg)
    this.desk.orders = cfg.orders
    resetDesk(this.desk, this.deliverySeed)
    this.seenOffer = 1
    resetKitchen(this.kitchen)
    resetVent(this.venting)
    resetLedger(this.ledger)
    this.rantReview.clear()
    this.seenVents = 0
    this.ventedThisPress = false
    this.arguing = -1
    this.argueCount = 0
    this.highlight = null
    teleport(this.movement, this.spawn.x, this.spawn.z)
    this.seenBurnt = 0
    this.seenBurntFries = 0
    this.seenSpills = 0
    this.seenFires = 0
    this.seenCrash = 0
    this.seenStained = 0
    this.seenArrived = 0
    this.rackWasDrying = false
    this.scrubbing = false
    this.shakeLeft = 0
    this.nudged.fill(-1)
    this.urgedLate.fill(-1)
    for (const f of [...this.figures, ...this.riders]) {
      f.id = -1
      f.pickup = false
      f.leaving = false
      f.node.active = false
    }
    this.seatOwner.fill(-1)
    for (let i = 0; i < this.orderShown.length; i++) this.orderShown[i] = -1
    this.router.cancelAll()
    this.zonesKey = ''
    this.openDay()
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
    this.cutaway?.update(m.x, m.z, game.deltaTime)
    let sx = 0
    let sz = 0
    if (this.shakeLeft > 0) {
      this.shakeLeft -= game.deltaTime
      const a = (this.shakeAmp * Math.max(0, this.shakeLeft)) / FEEL.shakeSec
      sx = Math.sin(this.shift.t * 90) * a
      sz = Math.cos(this.shift.t * 77) * a
    }
    this.cameraNode.setPosition(
      this.camFocus.x + this.camOffset.x + sx,
      this.camOffset.y,
      this.camFocus.z + this.camOffset.z + sz,
    )

    this.syncBubbles()
    this.syncCustomers()

    this.syncKitchenRings()
    const stick = this.router.stick
    if (this.controls) {
      this.controls.syncStick(stick.dirX, stick.dirY, stick.magnitude)
      this.controls.setPressed(this.router.action.down)
      this.controls.setAction(this.actionVerb())
    }
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
