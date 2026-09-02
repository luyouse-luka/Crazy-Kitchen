/**
 * 输入层：多点触摸 → 移动方向 + 交互意图。零 Cocos 依赖（铁律①）。
 *
 * 组件只做一件事：把 touch 事件拆成 (id, x, y) 喂进 TouchRouter，每帧读 stick / action。
 * 放在这一层的理由和 collision.ts 一样 —— 「两根手指同时按、拇指划过屏幕中线」
 * 这类手感 bug 能写成单测，不必每次都开编辑器上真机试。
 *
 * ROADMAP §M2 把摇杆方向映射列为「头号手感坑」，把双手同时输入列为
 * 「输入层的架构问题，不是加个按钮」—— 这个文件就是那两条的落点。
 *
 * ⚠ 坐标约定：传进来的 (x, y) 用 **Cocos `Touch.getLocation()` 的约定**
 * —— 屏幕左下角为原点，**y 向上为正**。如果组件那边取的是 y 向下的坐标系，
 * 在组件里翻好符号再传，不要改这个文件。
 */
import type { Vec2 } from './vec2'
import { rotateY } from './vec2'

// ─────────────────────────── 摇杆 ───────────────────────────

export interface StickConfig {
  /** 推到满格所需的像素距离。超出即饱和，不会继续变快 */
  radius: number
  /** 归一化后小于此值视为回中。吃掉拇指按住不动时的微抖，否则角色会自己漂 */
  deadzone: number
}

/** 真机上再调。radius 按 720 高的屏取的经验值，deadzone 偏保守。 */
export const DEFAULT_STICK: StickConfig = { radius: 90, deadzone: 0.15 }

export interface StickState {
  /** 单位方向（屏幕系，y 向上）。回中时为 (0, 0) */
  dirX: number
  dirY: number
  /** 推杆量 0..1。喂给移动速度，让轻推能走慢 —— 不做这个的话只有「不动」和「全速」两档 */
  magnitude: number
  active: boolean
}

// ─────────────────────────── 动作键 ───────────────────────────

/**
 * 一个键区分点按与长按，而不是摆两个键。
 *
 * ROADMAP §M2 把「右手一个键还是两个」留到这里定：两个键会挤占右下角，
 * 而拇指在横屏下的可达区本来就窄。取放走点按、烤炉与洗碗池走长按，一个键够用。
 */
export interface ActionConfig {
  /** 按住超过这么久（秒）算长按。真机手感待调 —— 太短会把正常点按误判成长按 */
  holdSeconds: number
}

export const DEFAULT_ACTION: ActionConfig = { holdSeconds: 0.3 }

export interface ActionState {
  /** 手指是否还按着 */
  down: boolean
  /** 按住已超过阈值。长按期间每帧都为 true（洗碗池要按住持续洗） */
  holding: boolean
  /** 本帧发生了一次点按（按下→抬起且没到长按阈值）。读一帧后自动清零 */
  tapped: boolean
  /** 本帧刚跨过长按阈值。用来播一次「开始洗碗」而不是每帧播 */
  holdStarted: boolean
  /** 按下至今的秒数 */
  heldSeconds: number
}

// ─────────────────────────── 路由 ───────────────────────────

/** 一路输入的内部记账。id 为 -1 表示这一路空着 */
interface Slot {
  id: number
  originX: number
  originY: number
  curX: number
  curY: number
}

function emptySlot(): Slot {
  return { id: -1, originX: 0, originY: 0, curX: 0, curY: 0 }
}

/**
 * 把多点触摸分派到左半屏（摇杆）与右半屏（动作键）。
 *
 * ⚠ **归属在按下那一刻定死，之后只认手指 id 不认位置。**
 * 按位置实时判归属的话，拇指从左半屏划过中线，摇杆会当场失灵、动作键会莫名触发
 * —— 横屏下左拇指外推本来就容易越过中线，这不是边缘情况。
 *
 * 一路已被占用时，后来的手指整根忽略：三指按屏不该把已在推的摇杆抢走。
 */
export class TouchRouter {
  private left = emptySlot()
  private right = emptySlot()

  readonly stick: StickState = { dirX: 0, dirY: 0, magnitude: 0, active: false }
  readonly action: ActionState = {
    down: false,
    holding: false,
    tapped: false,
    holdStarted: false,
    heldSeconds: 0,
  }

  /**
   * @param splitX 左右分界的屏幕 x（像素）。通常是屏宽的一半
   * @param stickCfg 摇杆参数
   * @param actionCfg 动作键参数
   */
  constructor(
    private splitX: number,
    private stickCfg: StickConfig = DEFAULT_STICK,
    private actionCfg: ActionConfig = DEFAULT_ACTION,
  ) {}

  /** 屏幕尺寸变了要跟着改（横屏转向、微信下拉工具栏收放都会触发） */
  setSplitX(x: number): void {
    this.splitX = x
  }

  onDown(id: number, x: number, y: number): void {
    const slot = x < this.splitX ? this.left : this.right
    if (slot.id !== -1) return // 那一路已经有手指了，忽略这根
    slot.id = id
    slot.originX = x
    slot.originY = y
    slot.curX = x
    slot.curY = y

    if (slot === this.right) {
      this.action.down = true
      this.action.heldSeconds = 0
      this.action.holding = false
    }
    this.recomputeStick()
  }

  onMove(id: number, x: number, y: number): void {
    if (this.left.id === id) {
      this.left.curX = x
      this.left.curY = y
      this.recomputeStick()
    } else if (this.right.id === id) {
      this.right.curX = x
      this.right.curY = y
    }
    // 不属于任何一路的手指（第三根、或按下时那一路已满）直接丢掉
  }

  onUp(id: number): void {
    if (this.left.id === id) {
      this.left.id = -1
      this.recomputeStick()
    } else if (this.right.id === id) {
      this.right.id = -1
      // 没到长按阈值就抬手 → 这是一次点按
      if (!this.action.holding) this.action.tapped = true
      this.action.down = false
      this.action.holding = false
      this.action.heldSeconds = 0
    }
  }

  /**
   * 触摸被系统抢走（来电、微信侧滑返回、切后台）。
   *
   * 必须有这条：这些情况下 onUp 不一定会来，不清状态的话摇杆会永久卡在最后的方向上，
   * 玩家回到游戏发现角色一直往一边走。组件里挂 TOUCH_CANCEL 和 onHide。
   */
  cancelAll(): void {
    this.left = emptySlot()
    this.right = emptySlot()
    this.stick.dirX = 0
    this.stick.dirY = 0
    this.stick.magnitude = 0
    this.stick.active = false
    this.action.down = false
    this.action.holding = false
    this.action.tapped = false
    this.action.holdStarted = false
    this.action.heldSeconds = 0
  }

  /**
   * 每帧调一次，在读 action 之前。
   *
   * tapped / holdStarted 是**单帧脉冲**：这里先清掉上一帧的，本帧内产生的留到下次调用前
   * 都读得到。组件的 update 里先 tick 再读，顺序反了会漏掉点按。
   */
  tick(dt: number): void {
    this.action.tapped = false
    this.action.holdStarted = false
    if (this.action.down) {
      this.action.heldSeconds += dt
      if (!this.action.holding && this.action.heldSeconds >= this.actionCfg.holdSeconds) {
        this.action.holding = true
        this.action.holdStarted = true
      }
    }
  }

  /** 浮动原点：按下处即摇杆中心，拇指不用去够固定位置 —— 横屏单手时差别很明显 */
  private recomputeStick(): void {
    const s = this.stick
    if (this.left.id === -1) {
      s.dirX = 0
      s.dirY = 0
      s.magnitude = 0
      s.active = false
      return
    }
    s.active = true
    const dx = this.left.curX - this.left.originX
    const dy = this.left.curY - this.left.originY
    const l2 = dx * dx + dy * dy
    if (l2 === 0) {
      s.dirX = 0
      s.dirY = 0
      s.magnitude = 0
      return
    }
    const l = Math.sqrt(l2)
    // 先归一化再 clamp，不是「除以 radius」—— 后者在斜推到角落时会算出 >1 的量
    const m = l / this.stickCfg.radius
    if (m < this.stickCfg.deadzone) {
      s.dirX = 0
      s.dirY = 0
      s.magnitude = 0
      return
    }
    const inv = 1 / l
    s.dirX = dx * inv
    s.dirY = dy * inv
    s.magnitude = m > 1 ? 1 : m
  }
}

// ─────────────────────────── 相机相对映射 ───────────────────────────

/** 斜 45° 相机绕 Y 轴的偏航角（弧度）。符号见 stickToWorld 的说明 */
export const ISO_CAMERA_YAW = Math.PI / 4

/**
 * 摇杆方向 → 世界移动方向（ROADMAP §M2 的头号手感坑）。
 *
 * 不能把摇杆的 (x, y) 直接当世界的 (x, z)：相机绕 Y 转了 45°，
 * 玩家往上推、角色却斜着走。正解是先按相机 yaw 旋转再喂给移动。
 *
 * 屏幕「上」对应世界 -z（Cocos 默认相机朝 -z 看），所以先取 { x: dirX, z: -dirY }。
 *
 * ⚠ **yaw 的符号真机上验一次，别靠推理。** 四个方向各推一次看角色往哪走；
 * 前后反了就把传进来的 yaw 取负，左右反了说明相机是往另一边转的。
 * 这里锁死的是「先旋转再移动」这个结构，不是某个具体符号。
 *
 * out 可以就是复用的临时对象 —— 每帧调用，别在调用处 new（铁律②）。
 */
export function stickToWorld(out: Vec2, stick: StickState, cameraYaw: number): Vec2 {
  out.x = stick.dirX
  out.z = -stick.dirY
  return rotateY(out, out, cameraYaw)
}

/**
 * 摇杆 → 本帧位移。magnitude 参与进来，轻推走慢。
 *
 * 回中时写入零向量并返回 false，调用方可以据此跳过碰撞解算。
 */
export function stickToVelocity(
  out: Vec2,
  stick: StickState,
  cameraYaw: number,
  speed: number,
): boolean {
  if (stick.magnitude === 0) {
    out.x = 0
    out.z = 0
    return false
  }
  stickToWorld(out, stick, cameraYaw)
  const v = speed * stick.magnitude
  out.x *= v
  out.z *= v
  return true
}
