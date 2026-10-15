const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/12255/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

async function main() {
  const out = process.argv[3] || 'game/temp/loose-items-verification'
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = [], failed = [], moves = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push(m.type() + ': ' + m.text()) })
  page.on('requestfailed', r => failed.push(r.url()))
  const snap = () => page.evaluate(() => ({ carry: { ...sv.kitchen.carry }, burger: JSON.parse(JSON.stringify(sv.kitchen.burger)), plated: sv.kitchen.burgerPlated, stained: sv.kitchen.burgerStained, stock: [...sv.kitchen.stock], plates: sv.kitchen.plates, dirty: sv.kitchen.dirty, items: JSON.parse(JSON.stringify(sv.looseItems.items)), pos: { ...sv.movement.pos }, phase: sv.phase }))
  async function zone(id) {
    const p = await page.evaluate(id => {
      const q = sv.router.zones.find(z => z.id === id); if (!q) throw Error('Missing capture zone ' + id)
      const r = document.querySelector('canvas').getBoundingClientRect()
      return { x: r.left + (q.x + q.w / 2) * r.width / sv.screenW, y: r.top + (sv.screenH - q.y - q.h / 2) * r.height / sv.screenH }
    }, id)
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(100)
  }
  async function button(name, hold = 0, during) {
    const p = await page.evaluate(name => {
      const n = cc.find('Canvas/' + name), v = new E.Vec3(), r = document.querySelector('canvas').getBoundingClientRect()
      n.getComponent(E.UITransform).convertToWorldSpaceAR(E.Vec3.ZERO, v)
      return { x: r.left + v.x * r.width / (sv.uiHalfW * 2), y: r.top + (sv.uiHalfH * 2 - v.y) * r.height / (sv.uiHalfH * 2) }
    }, name)
    await page.mouse.move(p.x, p.y); await page.mouse.down()
    try { await page.waitForTimeout(hold || 35); if (during) await during() } finally { await page.mouse.up() }
    await page.waitForTimeout(100)
  }
  const action = (hold = 0, during) => button('UI_ActionButton', hold, during)
  const aux = (hold = 0, during) => button('UI_DiscardButton', hold, during)
  async function walk(x, z) {
    const base = { x: 140, y: 540 }; await page.mouse.move(base.x, base.y); await page.mouse.down()
    let done = false
    try {
      const deadline = Date.now() + 12000
      while (Date.now() < deadline) {
        const q = await page.evaluate(({ x, z }) => { const p = sv.movement.pos, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), c = Math.cos(sv.cameraYaw), s = Math.sin(sv.cameraYaw), k = d ? Math.max(22, Math.min(70, d * 130)) / d : 0; return { d, x: (dx * c - dz * s) * k, y: (dx * s + dz * c) * k } }, { x, z })
        if (q.d < .075) { done = true; break }
        await page.mouse.move(base.x + q.x, base.y + q.y); await page.waitForTimeout(40)
      }
    } finally { await page.mouse.up() }
    moves.push({ x, z, done }); assert(done, `Cannot walk to ${x},${z}: ${JSON.stringify(await snap())}`)
  }
  async function fetch(...ingredients) {
    await walk(3.5, -1.55); await action()
    const names = ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon']
    for (const i of ingredients) {
      if (!await page.evaluate(() => sv.panelOpen)) break
      await zone('slot' + names.indexOf(i))
    }
    if (await page.evaluate(() => sv.panelOpen)) await zone('panel-outside')
  }
  async function cleanupHeld() {
    await walk(3, 0); await aux(); assert.equal((await snap()).carry.kind, 'none')
    await action(450); assert.equal((await snap()).items.length, 0)
  }
  try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:4192')
    await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.movement, null, { timeout: 60000 })
    await page.evaluate(async () => {
      window.E = await System.import('cc'); window.sv = cc.find('Canvas').getComponent('StationView'); E.profiler.hideStats()
      Object.assign(document.getElementById('GameDiv').style, { position: 'fixed', inset: '0', width: '100%', height: '100%' })
      E.screen.windowSize = new E.Size(innerWidth, innerHeight); sv.syncScreen()
    })
    await page.waitForTimeout(300)
    await fetch('bun', 'patty'); const paired = await snap()
    const singleItem = await page.evaluate(() => !!sv.kitchen.cfg.singleItem)
    assert.equal(paired.carry.second, singleItem ? null : 'patty')
    await walk(3, 0); await aux(); const dropped = await snap()
    assert.equal(dropped.items.length, 1); assert.equal(dropped.carry.kind, 'none'); assert.deepEqual(dropped.stock, paired.stock)
    assert.equal(await page.evaluate(() => sv.controls.actionText.string), '拾取')
    await walk(2.45, 0)
    await page.screenshot({ path: path.join(out, 'paired-floor.png') })
    await action(); assert.deepEqual((await snap()).carry, paired.carry)
    await walk(3, -1.4)
    const trace = []
    await aux(345, async () => {
      for (let i = 0; i < 10; i++) { trace.push((await snap()).items[0]); await page.waitForTimeout(24) }
      await page.screenshot({ path: path.join(out, 'throw.png') })
    })
    await page.waitForFunction(() => sv.looseItems.items.length === 1 && !sv.looseItems.items[0].flying)
    const landed = (await snap()).items[0]
    assert(landed.impacts >= 2, 'Wall and floor must each register an impact')
    assert(landed.z > -1.69, 'A wall-bound throw must stay outside the north counter')
    assert(trace.some(i => i?.flying && i.y > .5))
    await action(); assert.deepEqual((await snap()).carry, paired.carry); await cleanupHeld()
    assert.equal((await snap()).dirty, 0)
    await fetch('bun', 'cheese'); await walk(3, 0)
    await aux(); await action()
    const lifecycle = await page.evaluate(() => ({ nodes: sv.looseView.pool.length, renderers: cc.find('LooseItems').getComponentsInChildren(E.MeshRenderer).length }))
    for (let i = 0; i < 12; i++) { await aux(); await action() }
    assert.deepEqual(await page.evaluate(() => ({ nodes: sv.looseView.pool.length, renderers: cc.find('LooseItems').getComponentsInChildren(E.MeshRenderer).length })), lifecycle)
    await cleanupHeld()
    await walk(-3.4, 2.1); await action(); await zone('row1'); assert.equal((await snap()).phase, 'rest')
    const restClock = await page.evaluate(() => sv.kitchen.t)
    await fetch('bun'); await walk(3, 0); await aux(); await action(); await aux(); await page.waitForTimeout(250)
    assert.equal(await page.evaluate(() => sv.kitchen.t), restClock)
    await walk(-3.4, 2.1); await action()
    const layoutRow = await page.evaluate(() => sv.menuRows.findIndex(r => r.name === '调整厨房布局'))
    await zone('row' + layoutRow)
    assert.equal(await page.evaluate(() => !!sv.layoutEditor), false); assert.equal((await snap()).items.length, 1)
    const restItem = (await snap()).items[0]; await walk(restItem.x, restItem.z); await action(450)
    await walk(-3.4, 2.1); await action()
    const openRow = await page.evaluate(() => sv.menuRows.findIndex(r => r.name === '休息结束'))
    await zone('row' + openRow)
    await page.waitForFunction(() => sv.shift.flow.customers.some(c => c.active && !c.ordered && c.orderWait >= sv.shift.flow.flow.takeOrder.walkInSec), null, { timeout: 35000 })
    await action(); const spec = await page.evaluate(() => sv.shift.flow.customers.find(c => c.active && c.ordered).spec)
    await fetch('patty'); await walk(.5, -1.55); await action()
    await page.waitForFunction(level => sv.kitchen.grill[0].elapsed >= sv.kitchen.cfg.cook[{ rare: 'rareAt', medium: 'mediumAt', well: 'wellAt' }[level]], spec.doneness)
    await action(); const meat = await snap()
    assert.equal(meat.carry.kind, 'patty'); assert.equal(meat.carry.plated, true)
    await walk(2.5, 0); await aux(); const meatFloor = await snap()
    assert.equal(meatFloor.plates, meat.plates); assert.equal(meatFloor.dirty, meat.dirty)
    await action(); assert.deepEqual((await snap()).carry, meat.carry)
    await walk(-1.5, -1.55); await action()
    for (const i of spec.required.filter(i => i !== 'patty')) { await fetch(i); await walk(-1.5, -1.55); await action() }
    await action(); const burger = await snap(); assert.equal(burger.carry.kind, 'plate')
    await walk(2, 0); await aux(); const floorBurger = await snap()
    assert.deepEqual(floorBurger.items[0].payload.burger, burger.burger); assert.equal(floorBurger.plates, burger.plates); assert.equal(floorBurger.dirty, burger.dirty)
    await page.screenshot({ path: path.join(out, 'burger-floor.png') })
    await action(); assert.deepEqual((await snap()).burger, burger.burger)
    await aux(350); await page.waitForFunction(() => !sv.looseItems.items[0].flying)
    const burgerLanding = (await snap()).items[0]
    await walk(burgerLanding.x, burgerLanding.z); await action()
    assert.deepEqual((await snap()).burger, burger.burger)
    await walk(-1, 2.1); await action()
    assert.equal(await page.evaluate(() => sv.shift.served), 1); assert.equal(await page.evaluate(() => sv.shift.wrong), 0)
    assert.equal(await page.evaluate(() => sv.firstOrderUi.guide.status), 'done')
    await page.screenshot({ path: path.join(out, 'served.png') })
    await fetch('patty'); await walk(.5, -1.55); await action()
    await page.waitForFunction(() => sv.kitchen.grill[0].elapsed >= sv.kitchen.cfg.cook.mediumAt)
    await action(); await walk(6.3, .5)
    const cleanBefore = await snap(); await aux()
    await action(850, async () => {
      assert.equal((await snap()).items.length, 0)
      assert.equal((await snap()).dirty, cleanBefore.dirty + 1)
      assert.equal(await page.evaluate(() => sv.kitchen.sink.stage), 'empty', 'The same hold must not also soak or scrub at the sink')
    })
    assert.equal((await snap()).dirty, cleanBefore.dirty + 1)
    await fetch('tomato'); await walk(3, 0)
    const auxPoint = await page.evaluate(() => { const q = sv.router.zones.find(z => z.id === 'discard'); return { x: q.x + q.w / 2, y: sv.screenH - q.y - q.h / 2 } })
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...auxPoint }] })
    await page.waitForTimeout(80)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await page.waitForTimeout(120)
    assert.equal((await snap()).carry.kind, 'ingredient'); assert.equal((await snap()).items.length, 0)
    await page.evaluate(() => E.game.emit(E.Game.EVENT_HIDE)); await page.waitForTimeout(100)
    assert.equal((await snap()).carry.kind, 'ingredient'); assert.equal((await snap()).items.length, 0)
    await page.evaluate(() => E.game.emit(E.Game.EVENT_SHOW))
    const viewports = []
    for (const [width, height] of [[1024, 768], [1280, 720], [1560, 720], [780, 360]]) {
      await page.setViewportSize({ width, height }); await page.evaluate(() => { E.screen.windowSize = new E.Size(innerWidth, innerHeight); sv.syncScreen() }); await page.waitForTimeout(150)
      const controls = await page.evaluate(() => ({ verb: sv.controls.discardTitle.string, method: sv.controls.discardMethod.string, minTarget: Math.min(...['UI_DiscardButton', 'UI_ActionButton'].map(n => cc.find('Canvas/' + n).getComponent(E.UITransform).height * innerHeight / (sv.uiHalfH * 2))) }))
      assert.equal(controls.verb, '放下'); assert(controls.minTarget >= 44)
      await page.screenshot({ path: path.join(out, `view-${width}x${height}.png`) }); viewports.push({ width, height, ...controls })
    }
    await page.evaluate(() => sv.restart(sv.day))
    assert.equal((await snap()).items.length, 0); assert.equal((await snap()).carry.kind, 'none')
    assert.equal(await page.evaluate(() => sv.looseView.pool.every(v => !v.root.active && !v.ground.active)), true)
    assert.deepEqual(errors, []); assert.deepEqual(failed, [])
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ pairedTransfer: !singleItem, singleItem, wallThrow: { trace, landed }, lifecycle, restPreparation: true, editorGuard: true, platedTransfer: true, burgerThrowServe: true, served: 1, wrong: 0, singlePlateCleanup: true, noHoldFallthrough: true, touchCancel: true, backgroundCancelEvent: true, diagnosticDailyReset: true, viewports, moves, errors, failed }, null, 2))
    console.log('PASS real joystick / buttons: food drop-pick, wall throw, rest preparation, plated transfer, burger throw-pick-serve, cancellation and view reuse')
  } catch (error) {
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {})
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ state: await snap().catch(() => null), errors, failed, error: String(error) }, null, 2))
    throw error
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
