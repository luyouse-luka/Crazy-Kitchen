const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const baseline = path.resolve(process.argv[2] || '')
const baselineSha = execFileSync('git', ['rev-parse', 'be80cc6'], { encoding: 'utf8' }).trim()
const baselineScene = JSON.parse(execFileSync('git', ['show', 'be80cc6:game/assets/main.scene'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))
const out = path.resolve(process.argv[3] || 'game/temp/first-order-ui-verification')
assert(fs.existsSync(path.join(baseline, 'index.html')), 'Pass the be80cc6 baseline Web build directory')
fs.mkdirSync(out, { recursive: true })
const mime = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg' }
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = name === '/_first-order-ui.js' ? path.resolve('game/temp/first-order-ui-preview.js') : path.resolve(baseline, '.' + (name === '/' ? '/index.html' : name))
  if ((name !== '/_first-order-ui.js' && !file.startsWith(baseline + path.sep)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  const errors = [], failed = [], moves = [], stages = [], layouts = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push(m.type() + ': ' + m.text()) })
  page.on('requestfailed', r => failed.push(r.url()))
  async function install() {
    await page.goto(url)
    await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.movement, null, { timeout: 60000 })
    await page.evaluate(async () => {
      window.E = await System.import('cc'); window.sv = cc.find('Canvas').getComponent('StationView')
      E.profiler.hideStats()
      Object.assign(document.getElementById('GameDiv').style, { position: 'fixed', inset: '0', width: '100%', height: '100%' })
      E.screen.windowSize = new E.Size(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio); sv.syncScreen()
    })
    await page.addScriptTag({ url: url + '/_first-order-ui.js' })
    await page.evaluate(() => { window.preview = FirstOrderPreview.install(E, sv) })
    for (const [kind, name] of [['fridge', 'Station_Fridge'], ['assembly', 'Station_Assembly'], ['serve', 'Station_Serve']]) {
      const nodes = baselineScene.filter(n => n._name === name)
      assert.equal(nodes.length, 1, 'Baseline station anchor must exist exactly once: ' + name)
      const actual = await page.evaluate(kind => sv.kitchen.cfg.stations.find(s => s.kind === kind).pos, kind)
      assert.deepEqual(actual, { x: nodes[0]._lpos.x, z: nodes[0]._lpos.z }, 'Web build differs from confirmed baseline: ' + kind)
    }
    await page.waitForTimeout(1100)
  }
  async function screenshot(name) { await page.screenshot({ path: path.join(out, name + '.png') }) }
  async function checkpoint(name) {
    const state = await page.evaluate(() => ({ status: preview.ui.guide.status, step: preview.ui.currentHint.step, title: preview.ui.currentHint.title, target: preview.ui.currentHint.target, action: sv.actionVerb(), pos: { ...sv.movement.pos } }))
    stages.push({ name, ...state }); console.log(JSON.stringify({ checkpoint: name, ...state })); await screenshot(name)
    return state
  }
  async function zone(id) {
    const p = await page.evaluate(id => {
      const z = sv.router.zones.find(z => z.id === id); if (!z) throw Error('Missing capture zone ' + id)
      return { x: (z.x + z.w / 2) * innerWidth / sv.screenW, y: (sv.screenH - z.y - z.h / 2) * innerHeight / sv.screenH }
    }, id)
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(220)
  }
  async function walk(x, z) {
    const start = await page.evaluate(() => ({ ...sv.movement.pos }))
    const base = { x: 140, y: 535 }
    await page.mouse.move(base.x, base.y); await page.mouse.down()
    let done = false
    try {
      const until = Date.now() + 20000
      while (Date.now() < until) {
        const p = await page.evaluate(({ x, z }) => {
          const dx = x - sv.movement.pos.x, dz = z - sv.movement.pos.z, d = Math.hypot(dx, dz)
          const c = Math.cos(sv.cameraYaw), s = Math.sin(sv.cameraYaw), scale = d ? Math.max(22, Math.min(70, d * 130)) / d : 0
          return { d, x: (dx * c - dz * s) * scale, y: (dx * s + dz * c) * scale }
        }, { x, z })
        if (p.d < .065) { done = true; break }
        await page.mouse.move(base.x + p.x, base.y + p.y); await page.waitForTimeout(35)
      }
    } finally { await page.mouse.up() }
    const end = await page.evaluate(() => ({ ...sv.movement.pos }))
    moves.push({ start, target: { x, z }, end }); assert(done, `Joystick could not reach ${x}, ${z}`)
  }
  const action = async () => { await page.mouse.click(1130, 560); await page.waitForTimeout(190) }
  async function fetch(ingredient, shot = false) {
    await walk(-2.5, 0); await action()
    if (shot) await checkpoint('03-inventory')
    await zone('slot' + ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon'].indexOf(ingredient))
    if (await page.evaluate(() => sv.panelOpen)) await zone('panel-outside')
  }
  try {
    await install()
    assert.equal((await checkpoint('01-first-entry')).step, 'move')
    const before = await page.evaluate(() => ({ pos: { ...sv.movement.pos }, phase: sv.phase, carry: sv.kitchen.carry.kind }))
    await zone('guide-skip')
    assert.equal(await page.evaluate(() => preview.ui.guide.status), 'skipped')
    assert.deepEqual(await page.evaluate(() => ({ pos: { ...sv.movement.pos }, phase: sv.phase, carry: sv.kitchen.carry.kind })), before, 'Skip must not move or perform an action')
    await zone('guide-help')
    assert.equal(await page.evaluate(() => preview.ui.guide.status), 'active')
    await walk(-3.4, 2.1); await action(); await zone('row0')
    await page.waitForFunction(() => sv.shift.flow.customers.some(c => c.active && !c.ordered && c.orderWait >= sv.shift.flow.flow.takeOrder.walkInSec), null, { timeout: 35000 })
    await action()
    assert.equal((await checkpoint('02-order-accepted')).step, 'ingredients')
    const spec = await page.evaluate(() => sv.shift.flow.customers.find(c => c.active && c.ordered).spec)
    await fetch('patty', true)
    await walk(0, -1.55); await action(); await checkpoint('04-cooking')
    await page.waitForFunction(level => sv.kitchen.grill[0].elapsed >= sv.kitchen.cfg.cook[{ rare: 'rareAt', medium: 'mediumAt', well: 'wellAt' }[level]], spec.doneness)
    await action(); assert.equal((await checkpoint('05-cooked-patty')).step, 'assemble')
    await walk(-2.5, -1.5); await action()
    for (const ing of spec.required.filter(i => i !== 'patty')) { await fetch(ing); await walk(-2.5, -1.5); await action() }
    await action(); assert.equal((await checkpoint('06-ready-to-deliver')).step, 'deliver')
    await walk(-1, 2.1); await action()
    assert.equal(await page.evaluate(() => sv.shift.served), 1)
    assert.equal(await page.evaluate(() => sv.shift.wrong), 0)
    assert.equal((await checkpoint('07-first-order-complete')).status, 'done')
    const phases = await page.evaluate(() => preview.phases)
    for (const step of ['move', 'accept', 'ingredients', 'cook', 'assemble', 'deliver']) assert(phases.includes(step), 'Missing real guide step ' + step)
    await fetch('bun')
    const discardPoint = await page.evaluate(() => { const z = sv.router.zones.find(z => z.id === 'discard'); return { x: z.x + z.w / 2, y: sv.screenH - z.y - z.h / 2 } })
    await page.mouse.move(discardPoint.x, discardPoint.y); await page.mouse.down()
    try { await page.waitForFunction(() => sv.kitchen.carry.kind === 'none', null, { timeout: 3000 }) } finally { await page.mouse.up() }
    await walk(0, 1.55); await walk(6.4, .5)
    await page.waitForFunction(() => sv.kitchen.dirty > 0, null, { timeout: 20000 }); await action()
    await page.waitForFunction(() => sv.kitchen.sink.stage === 'soaked')
    await page.waitForTimeout(220)
    assert.equal(await page.evaluate(() => E.find('Canvas/UI_ActionButton/ActionMethod').getComponent(E.Label).string), '按住')
    await page.mouse.move(1130, 560); await page.mouse.down()
    try { await page.waitForFunction(() => sv.kitchen.rack.count > 0, null, { timeout: 5000 }) } finally { await page.mouse.up() }
    await page.evaluate(() => sv.restart(1))
    assert.equal(await page.evaluate(() => preview.ui.guide.status), 'done')
    await zone('guide-help'); assert.equal(await page.evaluate(() => preview.ui.currentHint.step), 'move')
    for (const [width, height] of [[1024, 768], [1280, 720], [1680, 720], [844, 390]]) {
      await page.setViewportSize({ width, height })
      await page.evaluate(() => { E.screen.windowSize = new E.Size(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio); sv.syncScreen(); preview.sync(); sv.refreshZones() })
      await page.waitForTimeout(200)
      const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, visible: preview.ui.node.active, guide: preview.ui.node.getComponent(E.UITransform).getBoundingBoxToWorld(), zones: sv.router.zones.filter(z => z.id.startsWith('guide-')), station: sv.kitchen.cfg.stations.find(s => s.kind === 'fridge').pos }))
      assert(layout.visible); assert(layout.zones.length > 0)
      for (const z of layout.zones) { assert(z.x >= 0 && z.y >= 0); assert(z.x + z.w <= width + 1 && z.y + z.h <= height + 1) }
      const button = layout.zones.find(z => z.id === 'guide-skip' || z.id === 'guide-help')
      assert(button.w >= 44 && button.h >= 44, 'Guide button must be at least 44 screen pixels')
      layouts.push(layout); await screenshot(`landscape-${width}x${height}`)
    }
    await page.setViewportSize({ width: 1280, height: 720 })
    await install()
    assert.equal(await page.evaluate(() => preview.ui.guide.status), 'active')
    assert.equal(await page.evaluate(() => preview.ui.currentHint.step), 'move')
    const result = { baseline: baselineSha, webEntrySha256: createHash('sha256').update(fs.readFileSync(path.join(baseline, 'index.html'))).digest('hex'), uiBundleSha256: createHash('sha256').update(fs.readFileSync('game/temp/first-order-ui-preview.js')).digest('hex'), mode: 'Exact UI source bundle injected into baseline Cocos Web scene; production wiring pending', moves, stages, layouts, phases, errors, failed, rulesChanged: false, completeBurger: true, skipDoesNotLeakInput: true, holdDiscardAndScrub: true, restartAndReload: true }
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n')
    assert.deepEqual(errors, [], 'Browser warnings/errors'); assert.deepEqual(failed, [], 'Asset request failures')
    console.log(JSON.stringify({ passed: true, moves: moves.length, layouts: layouts.length, errors, failed }))
  } catch (error) {
    await screenshot('failure')
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ error: String(error), errors, failed, stages, moves, state: await page.evaluate(() => ({ phase: sv.phase, pos: sv.movement.pos, lastBlock: sv.lastBlock, hint: preview?.ui.currentHint, zones: sv.router.zones })) }, null, 2))
    throw error
  } finally { await browser.close(); server.close() }
}
main().catch(e => { console.error(e); server.close(); process.exitCode = 1 })
