/**
 * 读 Cocos `.scene` 并把它变成能对判据的数字。`pnpm scene [路径]`
 *
 * 为什么要这个：`.scene` 是扁平化的 JSON（一个数组 + `__id__` 互相引用），
 * 人读不动，但机器读得动。有了它，m2-scene-guide §11 那十条验收里
 * 原本「只能靠眼睛看」的九条，绝大多数变成机器判的 —— 包括 §0 那三条红线。
 *
 * 跟 pkgsize.ts 一样局部 declare Node 的东西，不引 @types/node。
 */

declare const process: { argv: string[]; exit(code?: number): void }
declare const console: { log(...args: unknown[]): void }

import { SPEC, UI_SPEC } from './scene-spec'

// @ts-expect-error Node builtin, typed locally — same stance as pkgsize.ts.
import * as nodeFs from 'node:fs'
const { readFileSync, existsSync } = nodeFs as {
  readFileSync(p: string, enc: 'utf8'): string
  existsSync(p: string): boolean
}

// ─────────────────────────── 反扁平化 ───────────────────────────

interface Ref { __id__: number }
type Entry = Record<string, unknown>

const isRef = (v: unknown): v is Ref =>
  typeof v === 'object' && v !== null && typeof (v as Ref).__id__ === 'number'

const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

interface Vec3 { x: number; y: number; z: number }
function vec3(v: unknown): Vec3 {
  const o = (v ?? {}) as Record<string, unknown>
  return { x: num(o['x']), y: num(o['y']), z: num(o['z']) }
}
/** -0 与浮点毛刺会让 diff 满屏噪声 */
const r3 = (n: number): number => Math.round(n * 1000) / 1000 + 0

interface SceneNode {
  name: string
  path: string
  active: boolean
  pos: Vec3
  euler: Vec3
  scale: Vec3
  comps: Entry[]
  children: SceneNode[]
}

function build(all: Entry[], id: number, parentPath: string): SceneNode {
  const e = all[id] ?? {}
  const name = str(e['_name'])
  const path = parentPath ? `${parentPath}/${name}` : name
  const kids = Array.isArray(e['_children']) ? (e['_children'] as unknown[]) : []
  const comps = Array.isArray(e['_components']) ? (e['_components'] as unknown[]) : []
  return {
    name,
    path,
    active: e['_active'] !== false,
    pos: vec3(e['_lpos']),
    euler: vec3(e['_euler']),
    scale: vec3(e['_lscale']),
    comps: comps.filter(isRef).map((r) => all[r.__id__] ?? {}),
    children: kids.filter(isRef).map((r) => build(all, r.__id__, path)),
  }
}

function walk(n: SceneNode, fn: (n: SceneNode, depth: number) => void, depth = 0): void {
  fn(n, depth)
  for (const c of n.children) walk(c, fn, depth + 1)
}

// ─────────────────────────── 定稿期望值 ───────────────────────────

const TOL = 0.001
const fmt = (v: Vec3): string => `(${r3(v.x)}, ${r3(v.y)}, ${r3(v.z)})`
const same = (v: Vec3, t: [number, number, number]): boolean =>
  Math.abs(v.x - t[0]) < TOL && Math.abs(v.y - t[1]) < TOL && Math.abs(v.z - t[2]) < TOL

// ─────────────────────────── 红线 ───────────────────────────

const PHYSICS = /Collider|RigidBody|PhysicsMaterial|CharacterController/
const CAM_PROJ = ['ORTHO', 'PERSPECTIVE']

/** cc.Camera.ClearFlag —— 编辑器显示的是名字，文件里存的是位掩码 */
const CLEAR_FLAG: Record<number, string> = {
  0: 'DONT_CLEAR',
  6: 'DEPTH_ONLY',
  7: 'SOLID_COLOR',
  14: 'SKYBOX',
}
const clearName = (v: number): string => `${CLEAR_FLAG[v] ?? '?'}(${v})`

function main(): void {
  const arg = process.argv[2]
  // 大小写两种都试 —— Linux 区分，编辑器建出来的实际是 main.scene
  const candidates = arg ? [arg] : ['game/assets/main.scene', 'game/assets/Main.scene', 'game/assets/test.scene']
  const file = candidates.find((f) => existsSync(f))
  if (!file) {
    console.log('找不到场景文件。试过：', candidates.join(' / '))
    process.exit(1)
    return
  }

  const all = JSON.parse(readFileSync(file, 'utf8')) as Entry[]
  const sceneEntry = all.findIndex((e) => e['__type__'] === 'cc.Scene')
  if (sceneEntry < 0) {
    console.log('这不是一个 .scene（没有 cc.Scene 条目）：', file)
    process.exit(1)
    return
  }
  const root = build(all, sceneEntry, '')
  console.log(`场景 ${file}  —— ${all.length} 条目\n`)

  // ── 层级树
  console.log('── 层级')
  walk(root, (n, d) => {
    const kinds = n.comps.map((c) => str(c['__type__']).replace(/^cc\./, '')).join(' + ')
    const flag = n.active ? '' : '  [active=false]'
    console.log('  ' + '  '.repeat(d) + (d === 0 ? '' : '└ ') + n.name + (kinds ? `  <${kinds}>` : '') + flag)
  })

  // ── Transform
  console.log('\n── Transform（本地坐标）')
  console.log('  节点'.padEnd(26), 'Position'.padEnd(24), 'Rotation'.padEnd(22), 'Scale')
  walk(root, (n, d) => {
    if (d === 0) return
    console.log('  ' + n.path.padEnd(24), fmt(n.pos).padEnd(24), fmt(n.euler).padEnd(22), fmt(n.scale))
  })

  // ── 相机 / 光
  console.log('\n── 相机与光')
  walk(root, (n) => {
    for (const c of n.comps) {
      const t = str(c['__type__'])
      if (t === 'cc.Camera') {
        const proj = num(c['_projection'])
        console.log(`  ${n.path}  Projection=${CAM_PROJ[proj] ?? proj}  OrthoHeight=${r3(num(c['_orthoHeight']))}` +
          `  Near=${num(c['_near'])}  Far=${num(c['_far'])}  ClearFlags=${clearName(num(c['_clearFlags']))}`)
      }
      if (t === 'cc.DirectionalLight') {
        console.log(`  ${n.path}  Illuminance=${num(c['_illuminance'])}  ShadowEnabled=${c['_shadowEnabled'] === true}`)
      }
    }
  })

  // ── UI
  const uiRows: string[] = []
  walk(root, (n) => {
    let size = ''
    let widget = ''
    let sprite = ''
    for (const c of n.comps) {
      const t = str(c['__type__'])
      if (t === 'cc.UITransform') {
        const cs = (c['_contentSize'] ?? {}) as Record<string, unknown>
        size = `${r3(num(cs['width']))} × ${r3(num(cs['height']))}`
      }
      if (t === 'cc.Sprite') {
        // SizeMode TRIMMED/RAW 会把 contentSize 顶回图片尺寸，自定义大小前必须切 CUSTOM
        const mode = ['CUSTOM', 'TRIMMED', 'RAW'][num(c['_sizeMode'])] ?? '?'
        sprite = `Sprite SizeMode=${mode}`
      }
      if (t === 'cc.Widget') {
        // Cocos 只存位掩码 _alignFlags，没有 _isAlignTop 那些布尔字段
        const f = num(c['_alignFlags'])
        const on: string[] = []
        if (f & 1) on.push(`top=${r3(num(c['_top']))}`)
        if (f & 4) on.push(`bottom=${r3(num(c['_bottom']))}`)
        if (f & 8) on.push(`left=${r3(num(c['_left']))}`)
        if (f & 32) on.push(`right=${r3(num(c['_right']))}`)
        if (f & 2) on.push('midY')
        if (f & 16) on.push('centerX')
        widget = on.length > 0 ? `Widget ${on.join(' ')}` : 'Widget 无对齐'
      }
    }
    if (size || widget || sprite) {
      uiRows.push(`  ${n.path.padEnd(30)} ${size.padEnd(14)} ${sprite.padEnd(18)} ${widget}${n.active ? '' : '   [active=false]'}`)
    }
  })
  if (uiRows.length > 0) {
    console.log('\n── UI（UITransform 尺寸 / Sprite / Widget）')
    console.log(uiRows.join('\n'))
  }
  const noUiTransform: string[] = []
  const canvas = root.children.find((c) => c.comps.some((x) => str(x['__type__']) === 'cc.Canvas'))
  if (canvas) {
    walk(canvas, (n, d) => {
      if (d === 0) return
      if (n.comps.some((c) => str(c['__type__']) === 'cc.Camera')) return
      if (!n.comps.some((c) => str(c['__type__']) === 'cc.UITransform')) noUiTransform.push(n.path)
    })
  }
  if (noUiTransform.length > 0) {
    console.log('  ⚠ Canvas 底下缺 UITransform（UI 系统不认这些节点）：', noUiTransform.join(' '))
  }

  // ── 场景全局
  const globalOf = (type: string): Entry => all.find((e) => e['__type__'] === type) ?? {}
  const skybox = globalOf('cc.SkyboxInfo')
  const shadows = globalOf('cc.ShadowsInfo')
  console.log('\n── 场景全局')
  console.log(`  Skybox enabled=${skybox['_enabled'] === true}  envmap=${skybox['_envmap'] === null || skybox['_envmap'] === undefined ? 'null' : '有贴图'}  useHDR=${skybox['_useHDR'] === true}`)
  console.log(`  Shadows enabled=${shadows['_enabled'] === true}`)

  // ── 红线（§0）
  console.log('\n── §0 三条红线')
  const red: string[] = []
  walk(root, (n) => {
    for (const c of n.comps) {
      const t = str(c['__type__'])
      if (PHYSICS.test(t)) red.push(`红线1 物理组件：${n.path} 上挂了 ${t}`)
    }
  })
  walk(root, (n) => {
    for (const c of n.comps) {
      if (str(c['__type__']) === 'cc.DirectionalLight' && c['_shadowEnabled'] === true) {
        red.push(`红线2 实时阴影：${n.path} 的 Shadow Enabled 勾上了`)
      }
    }
  })
  if (shadows['_enabled'] === true) red.push('红线2 实时阴影：场景 Shadows 启用了')
  walk(root, (n) => {
    for (const c of n.comps) {
      if (str(c['__type__']) === 'cc.Camera' && num(c['_clearFlags']) === 14) {
        red.push(`红线3 ${n.path} 的 ClearFlags = SKYBOX —— 这就是天空盒被拉进包里的源头，改 SOLID_COLOR`)
      }
    }
  })
  if (skybox['_envmap'] != null) red.push('红线3 Skybox 指定了 cubemap（约 850KB）')
  if (skybox['_enabled'] === true && skybox['_useHDR'] === true) red.push('红线3 Skybox 开了 HDR')
  if (red.length === 0) console.log('  OK：无物理组件、无实时阴影、Skybox 无贴图')
  else for (const r of red) console.log('  ✗', r)

  // ── 与 §2.3 对比
  console.log('\n── 与 §2.3 定稿对比')
  const seen = new Set<string>()
  const diffs: string[] = []
  walk(root, (n) => {
    const spec = SPEC[n.name]
    if (!spec) return
    seen.add(n.name)
    if (spec.pos && !same(n.pos, spec.pos)) diffs.push(`  ${n.name} Position ${fmt(n.pos)} ≠ 定稿 (${spec.pos.join(', ')})`)
    if (spec.scale && !same(n.scale, spec.scale)) diffs.push(`  ${n.name} Scale ${fmt(n.scale)} ≠ 定稿 (${spec.scale.join(', ')})`)
  })
  walk(root, (n) => {
    const ui = UI_SPEC[n.name]
    if (!ui) return
    seen.add(n.name)
    let size: [number, number] | null = null
    let mode = -1
    for (const c of n.comps) {
      const t = str(c['__type__'])
      if (t === 'cc.UITransform') {
        const cs = (c['_contentSize'] ?? {}) as Record<string, unknown>
        size = [num(cs['width']), num(cs['height'])]
      }
      if (t === 'cc.Sprite') mode = num(c['_sizeMode'])
    }
    if (ui.size && size && (size[0] !== ui.size[0] || size[1] !== ui.size[1])) {
      diffs.push(`  ${n.name} 尺寸 ${size[0]}×${size[1]} ≠ 定稿 ${ui.size[0]}×${ui.size[1]}`)
    }
    if (ui.sizeMode !== undefined && mode >= 0 && mode !== ui.sizeMode) {
      diffs.push(`  ${n.name} Sprite SizeMode 不是 CUSTOM —— 填的尺寸会被图片顶回去`)
    }
    if (ui.pos && !same(n.pos, ui.pos)) {
      diffs.push(`  ${n.name} Position ${fmt(n.pos)} ≠ 定稿 (${ui.pos.join(', ')})`)
    }
  })

  const missing = [...Object.keys(SPEC), ...Object.keys(UI_SPEC)].filter((k) => !seen.has(k))
  const noScale = Object.entries(SPEC).filter(([, v]) => !v.scale).map(([k]) => k)
  if (missing.length > 0) console.log('  场景里还没有：', missing.join(' '))
  if (diffs.length > 0) console.log(diffs.join('\n'))
  if (missing.length === 0 && diffs.length === 0) console.log('  OK：Position / Scale 与 §2.3 完全一致')
  console.log('  （不检查 Scale 的：' + noScale.join(' ') + ' —— 内置几何体默认尺寸不在工程里，编辑器里量）')

  // ── 反向生成 layoutcheck 的输入
  const placed: string[] = []
  walk(root, (n) => {
    if (!n.name.startsWith('Station_')) return
    placed.push(`  { name: '${n.name}', x: ${r3(n.pos.x)}, z: ${r3(n.pos.z)}, w: ${r3(n.scale.x)}, d: ${r3(n.scale.z)} },`)
  })
  if (placed.length > 0) {
    console.log('\n── 贴进 tools/layoutcheck.ts 的 PLACED（场景实测值）')
    console.log('const PLACED: Placed[] = [\n' + placed.join('\n') + '\n]')
  }

  if (red.length > 0) process.exit(1)
}

main()
