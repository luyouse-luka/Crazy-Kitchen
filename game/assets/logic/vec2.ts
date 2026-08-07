/**
 * XZ 平面上的二维向量。
 *
 * 玩法空间是 2D（角色在 XZ 平面移动，Y 恒定），所以 logic/ 里的坐标一律 { x, z }，
 * 不出现 Cocos 的 Vec3 —— 铁律①（ROADMAP §3.2）。
 *
 * 全部函数走 out 参数写回，不返回新对象 —— 铁律②热路径零分配（ROADMAP §2.6）。
 * 每帧要遍历顾客耐心、烤炉火候、玩家与工位距离，这里 new 一个对象就是每帧几十次分配，
 * 会触发频繁 GC → 帧时间尖刺 → 手感一卡一卡，且 draw call 完全健康时也会发生。
 */
export interface Vec2 {
  x: number
  z: number
}

export function set(out: Vec2, x: number, z: number): Vec2 {
  out.x = x
  out.z = z
  return out
}

export function copy(out: Vec2, src: Vec2): Vec2 {
  out.x = src.x
  out.z = src.z
  return out
}

export function add(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out.x = a.x + b.x
  out.z = a.z + b.z
  return out
}

export function scale(out: Vec2, a: Vec2, s: number): Vec2 {
  out.x = a.x * s
  out.z = a.z * s
  return out
}

export function lenSq(a: Vec2): number {
  return a.x * a.x + a.z * a.z
}

/** 平方距离。比大小时用这个，省一次 sqrt —— 触发范围判定每帧对每个工位都要算一次。 */
export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return dx * dx + dz * dz
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt(dist2(a, b))
}

/** 零向量归一化后仍是零向量（摇杆回中每帧都会走到这里，除零会把坐标污染成 NaN）。 */
export function normalize(out: Vec2, a: Vec2): Vec2 {
  const l2 = a.x * a.x + a.z * a.z
  if (l2 === 0) {
    out.x = 0
    out.z = 0
    return out
  }
  const inv = 1 / Math.sqrt(l2)
  out.x = a.x * inv
  out.z = a.z * inv
  return out
}

/**
 * 绕 Y 轴旋转（从上往下看为顺时针）。
 *
 * 斜 45° 固定相机的头号手感坑（ROADMAP §M2）：摇杆的 (x, y) 不能直接当世界的 (x, z)，
 * 因为相机绕 Y 轴转了 45°，玩家往上推、角色却斜着走。正解是先把输入向量按相机 yaw
 * 旋转再喂给移动（camera-relative movement）。
 *
 * out 可以就是 a 本身：先把分量取进局部变量，再写回。
 */
export function rotateY(out: Vec2, a: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  const x = a.x
  const z = a.z
  out.x = x * c + z * s
  out.z = -x * s + z * c
  return out
}
