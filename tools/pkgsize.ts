/**
 * 包体审计台。`pnpm size [构建产物目录]`
 *
 * 这里不是游戏代码，不进包体。跟 sim-cli.ts 一样局部 declare Node 的东西，
 * 不引 @types/node —— 免得 logic/ 也跟着能用 fs。
 *
 * 每次构建完跑一次。三件事：
 *   1. 总量对红线（§2.4：4096KB 红线 / 3891KB 安全线）
 *   2. 揪出孤儿 —— Cocos 增量构建不清输出目录，旧产物会一直堆着算进包体
 *   3. 算「关掉某模块能省多少」= 该模块的独占依赖，不是它自己那一个文件
 */

declare const process: { argv: string[]; exit(code?: number): void }
declare const console: { log(...args: unknown[]): void }

// @ts-expect-error Node builtin. Typed locally instead of installing @types/node,
// which would also let logic/ reach for fs/process. Same stance as sim-cli.ts.
import * as nodeFs from 'node:fs'

const { readdirSync, readFileSync, statSync, existsSync } = nodeFs as {
  readdirSync(p: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[]
  readFileSync(p: string, enc: 'utf8'): string
  statSync(p: string): { size: number }
  existsSync(p: string): boolean
}

const RED = 4096
const SAFE = 3891

/** cc.js 里 `plugin:` 前缀的走微信引擎插件，不计包体；`./` 的是本地文件，计。 */
const PLUGIN_PREFIX = 'plugin:'

// ─────────────────────────── 基础 ───────────────────────────

const join = (...xs: string[]): string => norm(xs.filter((x) => x !== '').join('/'))

function norm(p: string): string {
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      const last = out[out.length - 1]
      if (out.length > 0 && last !== '..') out.pop()
      else out.push('..')
    } else out.push(seg)
  }
  return out.join('/')
}

function walk(root: string, rel = ''): string[] {
  const out: string[] = []
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`
    if (e.isDirectory()) out.push(...walk(root, r))
    else out.push(r)
  }
  return out
}

const kb = (n: number): string => (n / 1024).toFixed(1).padStart(9)

// ─────────────────────────── uuid 解压 ───────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const HEX = '0123456789abcdef'

/** Cocos 的 22 字符短 uuid → 完整 uuid。config.json 存短的，磁盘上是长的。 */
function decodeUuid(short: string): string {
  if (short.length !== 22) return short
  const out: string[] = [short[0]!, short[1]!]
  for (let i = 2; i < 22; i += 2) {
    const lhs = B64.indexOf(short[i]!)
    const rhs = B64.indexOf(short[i + 1]!)
    out.push(HEX[lhs >> 2]!, HEX[((lhs & 3) << 2) | (rhs >> 4)]!, HEX[rhs & 0xf]!)
  }
  const s = out.join('').slice(0, 32)
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

// ─────────────────────────── 引用图 ───────────────────────────

const JS_REF = /["'](\.{1,2}\/[^"']+?\.(?:js|json|wasm|bin))["']/g

interface Graph {
  files: Set<string>
  edges: Map<string, Set<string>>
}

function buildGraph(root: string, files: string[]): Graph {
  const set = new Set(files)
  const edges = new Map<string, Set<string>>()
  const has = (p: string): boolean => set.has(p)

  for (const f of files) {
    const to = new Set<string>()
    if (f.endsWith('.js') || f.endsWith('.json')) {
      const txt = readFileSync(join(root, f), 'utf8')
      const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : ''
      for (const m of txt.matchAll(JS_REF)) {
        const t = join(dir, m[1]!)
        if (has(t)) to.add(t)
      }
    }
    edges.set(f, to)
  }

  // bundle config.json → import/ 与 native/ 下被索引的资源
  for (const b of ['internal', 'main']) {
    const cfgP = `assets/${b}/config.json`
    if (!has(cfgP)) continue
    const cfg = JSON.parse(readFileSync(join(root, cfgP), 'utf8')) as {
      uuids: string[]
      packs?: Record<string, number[]>
    }
    const to = edges.get(cfgP)!
    const wanted = new Set<string>(Object.keys(cfg.packs ?? {}))
    const native = new Set<string>()
    for (const u of cfg.uuids) {
      // split only on the FIRST '@' — suffixes stack (uuid@b47c0@40c10 is one cubemap face)
      const at = u.indexOf('@')
      const core = at === -1 ? u : u.slice(0, at)
      const suffix = at === -1 ? '' : u.slice(at)
      wanted.add(core)
      wanted.add(decodeUuid(core))
      native.add(decodeUuid(core) + suffix)
    }
    for (const f of files) {
      if (!f.startsWith(`assets/${b}/`)) continue
      const base = f.slice(f.lastIndexOf('/') + 1)
      const stem = base.replace(/\.[^.]+$/, '')
      if (f.includes('/import/') && wanted.has(stem)) to.add(f)
      if (f.includes('/native/') && native.has(stem)) to.add(f)
    }
    if (has(`assets/${b}/index.js`)) to.add(`assets/${b}/index.js`)
  }

  return { files: set, edges }
}

function reachFrom(g: Graph, roots: string[]): Set<string> {
  const seen = new Set<string>()
  const q = roots.filter((r) => g.files.has(r))
  for (const r of q) seen.add(r)
  while (q.length > 0) {
    const p = q.pop()!
    for (const t of g.edges.get(p) ?? []) {
      if (!seen.has(t)) {
        seen.add(t)
        q.push(t)
      }
    }
  }
  return seen
}

const ENTRY = [
  // project.private.config.json is written by the WeChat devtools, not by a build, and
  // is not uploaded. Counted as live anyway: 0.6 KB the wrong way is a rounding error,
  // while calling it an orphan tells you to delete a file you need locally.
  'game.js', 'game.json', 'project.config.json', 'project.private.config.json',
  'application.js', 'first-screen.js',
  'web-adapter.js', 'engine-adapter.js', 'logo.png', 'slogan.png',
  'src/settings.json', 'src/import-map.js', 'src/polyfills.bundle.js',
  'src/system.bundle.js', 'src/effect.bin', 'src/chunks/bundle.js',
  'cocos-js/cc.js', 'assets/internal/config.json', 'assets/main/config.json',
]

/**
 * 运行时按路径拼接加载的 wasm，静态扫不到。胶水在 import-map 里走插件就说明还在用。
 * 判据放这儿是为了别让下一轮审计把它当孤儿删掉 —— 删了 mesh 解码会挂。
 */
const DYNAMIC = [/meshopt_decoder\..*\.wasm$/]

// ─────────────────────────── cc.js 模块划分 ───────────────────────────

interface CcSplit { plugin: string[]; local: string[] }

function parseCc(root: string): CcSplit | undefined {
  const p = join(root, 'cocos-js/cc.js')
  if (!existsSync(p)) return undefined
  const txt = readFileSync(p, 'utf8')
  const m = /System\.register\(\[([\s\S]*?)\]/.exec(txt)
  if (m === null) return undefined
  const ids = [...m[1]!.matchAll(/["']([^"']+)["']/g)].map((x) => x[1]!)
  return {
    plugin: ids.filter((i) => i.startsWith(PLUGIN_PREFIX)),
    local: ids.filter((i) => i.startsWith('./')),
  }
}

/** 只有 `entry` 能到达的文件 —— 关掉这个模块能省的真实量。 */
function exclusiveTo(g: Graph, entry: string, siblings: string[]): string[] {
  const mine = reachFrom(g, [entry])
  const others = reachFrom(g, siblings.filter((s) => s !== entry))
  return [...mine].filter((f) => !others.has(f))
}

// ─────────────────────────── main ───────────────────────────

function main(): void {
  const root = process.argv[2] ?? '../wechatgame'
  if (!existsSync(root)) {
    console.log(`找不到构建产物目录：${root}`)
    process.exit(1)
    return
  }

  const files = walk(root)
  const size = (f: string): number => statSync(join(root, f)).size
  const total = files.reduce((s, f) => s + size(f), 0)
  const g = buildGraph(root, files)
  const reach = reachFrom(g, ENTRY)

  const orphan = files
    .filter((f) => !reach.has(f) && !DYNAMIC.some((re) => re.test(f)))
    .sort((a, b) => size(b) - size(a))
  const dead = orphan.reduce((s, f) => s + size(f), 0)
  const live = total - dead

  const bucket = (pre: string): number =>
    files.filter((f) => f.startsWith(pre) && !orphan.includes(f)).reduce((s, f) => s + size(f), 0)

  const engine = bucket('cocos-js/')
  const assets = bucket('assets/')
  const src = bucket('src/')
  const shell = live - engine - assets - src

  const liveKb = live / 1024
  const verdict = liveKb > RED ? '❌ 超红线' : liveKb > SAFE ? '⚠ 越过安全线' : '✅ 达标'

  console.log(`\n疯狂后厨 · 微信小游戏包体审计   ${root}\n`)
  console.log(`  有效包体   ${kb(live)} KB   ${verdict}   红线 ${RED} / 安全线 ${SAFE}`)
  console.log(`    引擎 cocos-js  ${kb(engine)} KB`)
  console.log(`    资源 assets    ${kb(assets)} KB`)
  console.log(`    脚本 src       ${kb(src)} KB`)
  console.log(`    外壳/适配      ${kb(shell)} KB`)

  const cc = parseCc(root)
  if (cc !== undefined && cc.plugin.length === 0 && cc.local.length === 0) {
    // Monolithic cc.js: the build did not split the engine into modules, so there is
    // no module list to read. Silence here would look like "nothing detected".
    console.log(
      `\n  引擎模块   cc.js 是单体（${kb(engine)} KB），没有模块清单 —— 微信引擎插件没开，引擎整个进主包`,
    )
  } else if (cc !== undefined) {
    console.log(`\n  引擎模块   ${cc.plugin.length} 个走插件（不计包体） · ${cc.local.length} 个本地（计包体）`)
    const localEntries = cc.local.map((i) => join('cocos-js', i))
    const rows = localEntries
      .map((e) => {
        const excl = exclusiveTo(g, e, localEntries)
        return { e, bytes: excl.reduce((s, f) => s + (g.files.has(f) ? size(f) : 0), 0), n: excl.length }
      })
      .sort((a, b) => b.bytes - a.bytes)
    for (const r of rows) {
      console.log(`    ${kb(r.bytes)} KB  ${r.e.replace('cocos-js/', '')}   (独占 ${r.n} 个文件)`)
    }
  }

  if (orphan.length > 0) {
    console.log(`\n  ⚠ 孤儿 ${orphan.length} 个 · ${kb(dead)} KB —— 旧构建残留，Cocos 不清输出目录`)
    for (const f of orphan) console.log(`    ${kb(size(f))} KB  ${f}`)
    console.log(`\n    删掉输出目录重新构建，或直接删这些文件。`)
  } else {
    console.log(`\n  孤儿 0 个 ✓`)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  console.log(`\n  趋势记录  ${stamp}  ${Math.round(liveKb)} KB  (engine ${Math.round(engine / 1024)} / assets ${Math.round(assets / 1024)})\n`)
}

main()
