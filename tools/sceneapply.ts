/**
 * 把 `scene-spec.ts` 的定稿数值写进 `.scene`。`pnpm scene:apply [--write]`
 *
 * 只碰**纯数值和名字** —— Transform、节点名、相机 ClearFlags、Skybox 开关。
 * 加组件、改 SizeMode、挂材质这些要动条目结构和资源引用的，不在这里做，
 * 编辑器里点比脚本安全（m2-scene-guide §2.3）。
 *
 * ⚠ 跑之前把 Cocos 关掉：编辑器内存里有一份场景，它一保存就把这里写的盖掉。
 *
 * 默认 dry-run，`--write` 才落盘。
 */

declare const process: { argv: string[]; exit(code?: number): void }
declare const console: { log(...args: unknown[]): void }

import { SPEC, UI_SPEC, RENAMES, CLEAR_SKYBOX, CLEAR_SOLID_COLOR } from './scene-spec'

// @ts-expect-error Node builtin, typed locally — same stance as pkgsize.ts.
import * as nodeFs from 'node:fs'
const { readFileSync, writeFileSync, existsSync } = nodeFs as {
  readFileSync(p: string, enc: 'utf8'): string
  writeFileSync(p: string, data: string, enc: 'utf8'): void
  existsSync(p: string): boolean
}

type Entry = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' ? v : 0)

interface Vec3Like { x: number; y: number; z: number }
const asVec = (v: unknown): Vec3Like | null => {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  if (typeof o['x'] !== 'number') return null
  return o as unknown as Vec3Like
}
const fmt = (v: Vec3Like): string => `(${v.x}, ${v.y}, ${v.z})`
const eq = (v: Vec3Like, t: [number, number, number]): boolean =>
  Math.abs(v.x - t[0]) < 1e-9 && Math.abs(v.y - t[1]) < 1e-9 && Math.abs(v.z - t[2]) < 1e-9

function setVec(v: Vec3Like, t: [number, number, number]): void {
  v.x = t[0]
  v.y = t[1]
  v.z = t[2]
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const write = args.includes('--write')
  const file = args.find((a) => !a.startsWith('--')) ??
    ['game/assets/main.scene', 'game/assets/Main.scene'].find((f) => existsSync(f))
  if (!file || !existsSync(file)) {
    console.log('找不到场景文件')
    process.exit(1)
    return
  }

  const raw = readFileSync(file, 'utf8')
  const all = JSON.parse(raw) as Entry[]

  // 活性守卫：先证明「原样读进来再写出去」是逐字节无损的。
  // 不是的话，下面的 diff 会混进一堆无关的浮点/格式噪声，改动就不可复核了。
  if (JSON.stringify(all, null, 2) !== raw) {
    console.log('✗ JSON 往返不是无损的 —— 这个脚本会引入无关 diff，中止。')
    process.exit(1)
    return
  }

  const changes: string[] = []

  // ── 改名
  for (const e of all) {
    if (e['__type__'] !== 'cc.Node') continue
    const to = RENAMES[str(e['_name'])]
    if (to) {
      changes.push(`改名  ${str(e['_name'])} → ${to}`)
      e['_name'] = to
    }
  }

  // ── Transform
  for (const e of all) {
    if (e['__type__'] !== 'cc.Node') continue
    const spec = SPEC[str(e['_name'])]
    if (!spec) continue
    const name = str(e['_name'])
    if (spec.pos) {
      const p = asVec(e['_lpos'])
      if (p && !eq(p, spec.pos)) {
        changes.push(`位置  ${name.padEnd(18)} ${fmt(p)} → (${spec.pos.join(', ')})`)
        setVec(p, spec.pos)
      }
    }
    if (spec.scale) {
      const sc = asVec(e['_lscale'])
      if (sc && !eq(sc, spec.scale)) {
        changes.push(`缩放  ${name.padEnd(18)} ${fmt(sc)} → (${spec.scale.join(', ')})`)
        setVec(sc, spec.scale)
      }
    }
  }

  // ── UI：UITransform 的尺寸 + Sprite 的 SizeMode
  // 两者必须一起改：SizeMode 不是 CUSTOM 时，编辑器一加载就拿图片尺寸把 contentSize 顶回去，
  // 只改尺寸等于没改。（在 JSON 里两个字段谁先谁后无所谓，都是静态数据。）
  for (const e of all) {
    if (e['__type__'] !== 'cc.Node') continue
    const name = str(e['_name'])
    const ui = UI_SPEC[name]
    if (!ui) continue
    const comps = Array.isArray(e['_components']) ? (e['_components'] as unknown[]) : []
    const own = comps
      .filter((r): r is { __id__: number } => typeof r === 'object' && r !== null && typeof (r as { __id__?: unknown }).__id__ === 'number')
      .map((r) => all[r.__id__])
      .filter((c): c is Entry => c !== undefined)

    if (ui.pos) {
      const p = asVec(e['_lpos'])
      if (p && !eq(p, ui.pos)) {
        changes.push(`位置  ${name.padEnd(18)} ${fmt(p)} → (${ui.pos.join(', ')})`)
        setVec(p, ui.pos)
      }
    }
    for (const c of own) {
      if (c['__type__'] === 'cc.Sprite' && ui.sizeMode !== undefined && num(c['_sizeMode']) !== ui.sizeMode) {
        const was = ['CUSTOM', 'TRIMMED', 'RAW'][num(c['_sizeMode'])] ?? '?'
        changes.push(`UI    ${name.padEnd(18)} Sprite SizeMode ${was} → CUSTOM`)
        c['_sizeMode'] = ui.sizeMode
      }
      if (c['__type__'] === 'cc.UITransform' && ui.size) {
        const cs = c['_contentSize'] as Record<string, unknown> | undefined
        if (cs && (num(cs['width']) !== ui.size[0] || num(cs['height']) !== ui.size[1])) {
          changes.push(`UI    ${name.padEnd(18)} 尺寸 ${num(cs['width'])}×${num(cs['height'])} → ${ui.size[0]}×${ui.size[1]}`)
          cs['width'] = ui.size[0]
          cs['height'] = ui.size[1]
        }
      }
    }
  }

  // ── 红线：主相机的 ClearFlags
  for (const e of all) {
    if (e['__type__'] !== 'cc.Camera') continue
    if (num(e['_clearFlags']) !== CLEAR_SKYBOX) continue
    changes.push('红线3 Main Camera ClearFlags SKYBOX(14) → SOLID_COLOR(7)')
    e['_clearFlags'] = CLEAR_SOLID_COLOR
  }

  // ── 红线：Skybox 的三张 cubemap（约 850KB）
  const sky = all.find((e) => e['__type__'] === 'cc.SkyboxInfo')
  if (sky) {
    if (sky['_enabled'] === true) {
      changes.push('红线3 Skybox enabled → false')
      sky['_enabled'] = false
    }
    if (sky['_useHDR'] === true) {
      changes.push('红线3 Skybox useHDR → false')
      sky['_useHDR'] = false
    }
    for (const k of ['_envmap', '_envmapHDR', '_envmapLDR']) {
      if (sky[k] != null) {
        changes.push(`红线3 Skybox ${k} 的 cubemap 引用 → null`)
        sky[k] = null
      }
    }
  }

  if (changes.length === 0) {
    console.log('场景已经和 scene-spec.ts 一致，无改动。')
    return
  }
  console.log(`${file} —— ${changes.length} 处：\n`)
  for (const c of changes) console.log('  ' + c)

  if (!write) {
    console.log('\n（dry-run。加 --write 落盘，先确认 Cocos 编辑器是关着的）')
    return
  }
  writeFileSync(file, JSON.stringify(all, null, 2), 'utf8')
  console.log('\n已写入。编辑器里重新打开场景即可看到；跑 pnpm scene 复核。')
}

main()
