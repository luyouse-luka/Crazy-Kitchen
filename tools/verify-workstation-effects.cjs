const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

async function main() {
  const output = process.argv[3] || 'game/temp/workstation-effects/verification'
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = [], requests = [], checks = {}
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()) })
  page.on('requestfailed', r => requests.push({ url: r.url(), error: r.failure()?.errorText }))
  try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:4180')
    await page.waitForFunction(() => !!window.cc?.find('Canvas')?.getComponent('StationView')?.workstationEffects, null, { timeout: 60000 })
    await page.evaluate(async () => {
      window.E = await System.import('cc')
      E.profiler.hideStats()
      Object.assign(document.getElementById('GameDiv').style, { position: 'fixed', inset: '0', width: '1280px', height: '720px' })
      window.sv = cc.find('Canvas').getComponent('StationView')
      sv.enabled = false
      window.fx = sv.workstationEffects
      window.buffers = [fx.positions.buffer, fx.colors.buffer]
      window.advance = seconds => { for (let t = 0; t < seconds; t += 1 / 60) sv.update(1 / 60) }
      window.tap = kind => {
        const s = sv.kitchen.cfg.stations.find(s => s.kind === kind)
        if (!s) throw Error('Missing station ' + kind)
        Object.assign(sv.movement.pos, s.pos)
        if (kind === 'sink') sv.movement.pos.x -= .85
        else if (['grill', 'drinks', 'fryer'].includes(kind)) sv.movement.pos.z += .85
        sv.router.action.tapped = true
        sv.update(1 / 60)
      }
      window.focus = (x, y, z, height = 2.2) => {
        const c = sv.cameraComp, f = c.node.forward
        c.node.setWorldPosition(x - f.x * 24, y - f.y * 24, z - f.z * 24)
        c.orthoHeight = height
      }
      window.snap = () => ({ active: fx.node.active, vertices: fx.used, positions: Array.from(fx.positions.slice(0, fx.used * 3)), colors: Array.from(fx.colors.slice(0, fx.used * 4)) })
      window.clear = () => {
        sv.restart(sv.day)
        sv.openForBusiness()
        sv.kitchen.cfg.drinkSec = 3
        sv.kitchen.cfg.fryerSec = 5
        sv.drinksNode.active = true
        sv.update(1 / 60)
      }
      clear()
    })
    const screenshot = async name => {
      await page.evaluate(() => { for (const f of sv.floaters.pool) f.node.active = false })
      await page.waitForTimeout(150)
      await page.screenshot({ path: path.join(output, name + '.png') })
    }
    assert.equal(await page.evaluate(() => fx.node.active), false, 'Empty kitchen must not draw effects')
    assert.equal(await page.evaluate(() => sv.fryerServing.active), false, 'Empty fryer must not display finished fries')
    assert.equal(await page.evaluate(() => cc.find('Kitchen/Props/Prop_Fryer/kitchenStoveElectric/fryer') !== null), true, 'Fryer must use the oil-well appliance')
    checks.idleHidden = true
    await page.evaluate(() => { sv.kitchen.carry.kind = 'patty'; sv.kitchen.carry.cook = 'raw'; sv.kitchen.carry.plated = false; tap('grill'); advance(.4); focus(fx.grill[0].x, 1.1, fx.grill[0].z) })
    assert.equal(await page.evaluate(() => sv.kitchen.grill[0].busy), true, 'Real grill interaction must load meat')
    const flameA = await page.evaluate(() => snap())
    await screenshot('grill')
    await page.evaluate(() => { advance(.12); focus(fx.grill[0].x, 1.1, fx.grill[0].z) })
    const flameB = await page.evaluate(() => snap())
    assert(flameA.active && flameA.vertices > 0)
    assert.notDeepEqual(flameA.positions, flameB.positions, 'Flames and heat must animate')
    checks.grillAnimated = true
    await page.evaluate(() => { advance(sv.kitchen.cfg.cook.burntAt); focus(fx.grill[0].x, 1.1, fx.grill[0].z) })
    const burnt = await page.evaluate(() => snap())
    assert.notDeepEqual(burnt.colors, flameB.colors, 'Burnt meat must change colour and emit smoke')
    await page.evaluate(() => { advance(sv.kitchen.cfg.fireSec + .2); focus(fx.grill[0].x, 1.2, fx.grill[0].z) })
    assert.equal(await page.evaluate(() => sv.kitchen.fire), true)
    await screenshot('fire')
    await page.evaluate(() => { tap('extinguisher'); tap('grill') })
    assert.equal(await page.evaluate(() => sv.kitchen.fire), false, 'Extinguisher must end the large fire')
    checks.burnAndExtinguish = true

    await page.evaluate(() => { clear(); sv.kitchen.dirty = 2; tap('sink'); focus(fx.basin.x, .85, fx.basin.z, 1.8) })
    assert.equal(await page.evaluate(() => sv.kitchen.sink.stage), 'soaking')
    const soaking = await page.evaluate(() => snap())
    await screenshot('sink-soaking')
    await page.evaluate(() => { advance(1.05); focus(fx.basin.x, .85, fx.basin.z, 1.8) })
    const soaked = await page.evaluate(() => snap())
    assert.equal(await page.evaluate(() => sv.kitchen.sink.stage), 'soaked')
    assert(soaked.vertices < soaking.vertices, 'Passive soaking must stop its water stream when done')
    await page.evaluate(() => { sv.router.action.holding = true; sv.update(1 / 60); focus(fx.basin.x, .85, fx.basin.z, 1.8) })
    const scrub = await page.evaluate(() => snap())
    assert(scrub.vertices > soaked.vertices, 'Holding scrub must add moving sponge and stream')
    await screenshot('sink-scrubbing')
    await page.evaluate(() => { sv.router.action.holding = false; sv.update(1 / 60) })
    assert.equal(await page.evaluate(() => fx.used), soaked.vertices, 'Releasing scrub must immediately stop its stream and sponge')
    await page.evaluate(() => {
      sv.router.action.holding = true
      for (let i = 0; i < 500 && sv.kitchen.sink.stage !== 'empty'; i++) sv.update(1 / 60)
      sv.router.action.holding = false
      sv.update(1 / 60)
    })
    assert.equal(await page.evaluate(() => sv.kitchen.sink.stage), 'empty', 'Real scrub interaction must complete')
    await page.evaluate(() => advance(2.1))
    assert.equal(await page.evaluate(() => fx.node.active), false, 'Finished drying must leave no residual effect')
    checks.washStartHoldReleaseFinish = true

    await page.evaluate(() => { clear(); tap('drinks'); advance(.5); focus(fx.drinks.x, 1.6, fx.drinks.z, 1.65) })
    assert.equal(await page.evaluate(() => sv.kitchen.drinks.stage), 'pouring')
    const early = await page.evaluate(() => snap())
    await screenshot('drink-pouring')
    await page.evaluate(() => { advance(1); focus(fx.drinks.x, 1.6, fx.drinks.z, 1.65) })
    const later = await page.evaluate(() => snap())
    assert.notDeepEqual(early.positions, later.positions, 'Drink surface must rise with actual fill progress')
    await page.evaluate(() => advance(1.6))
    assert.equal(await page.evaluate(() => sv.kitchen.drinks.stage), 'ready')
    assert((await page.evaluate(() => fx.used)) < later.vertices, 'Full cup must stop pouring')
    await page.evaluate(() => tap('drinks'))
    assert.equal(await page.evaluate(() => sv.kitchen.carry.kind), 'drink')
    assert.equal(await page.evaluate(() => fx.node.active), false, 'Taking drink must remove machine cup')
    await page.evaluate(() => { sv.kitchen.carry.kind = 'none'; tap('drinks'); advance(8.2); focus(fx.drinks.x, 1.6, fx.drinks.z, 1.65) })
    assert.equal(await page.evaluate(() => sv.kitchen.drinks.stage), 'spilled')
    await screenshot('drink-spilled')
    await page.evaluate(() => tap('drinks'))
    assert.equal(await page.evaluate(() => fx.node.active), false, 'Wiping spill must remove puddle')
    checks.drinkFillReadyTakeSpillWipe = true

    await page.evaluate(() => { clear(); tap('fryer'); advance(.5); focus(fx.fryer.x, 1.1, fx.fryer.z, 1.8) })
    assert.equal(await page.evaluate(() => sv.kitchen.fryer.stage), 'frying')
    assert.equal(await page.evaluate(() => sv.fryerServing.active), false, 'Fries packet must not appear while frying')
    const frying = await page.evaluate(() => snap())
    await screenshot('fryer')
    await page.evaluate(() => advance(4.6))
    assert.equal(await page.evaluate(() => sv.kitchen.fryer.stage), 'ready')
    assert.equal(await page.evaluate(() => sv.fryerServing.active), true, 'Finished fries must appear on the side tray')
    await page.evaluate(() => focus(fx.fryer.x + .15, 1.1, fx.fryer.z, 1.8))
    await screenshot('fryer-ready')
    assert((await page.evaluate(() => fx.used)) < frying.vertices, 'Fryer bubbles must stop after cooking')
    await page.evaluate(() => advance(8.1))
    assert.equal(await page.evaluate(() => sv.kitchen.fryer.stage), 'burnt')
    assert.equal(await page.evaluate(() => sv.fryerServing.active), false, 'Burnt basket must not show finished fries')
    await page.evaluate(() => tap('fryer'))
    assert.equal(await page.evaluate(() => fx.node.active), false)
    checks.fryerBoilReadyBurntDiscard = true
    await page.evaluate(() => { tap('fryer'); advance(5.1); tap('fryer') })
    assert.equal(await page.evaluate(() => sv.kitchen.carry.kind), 'fries')
    assert.equal(await page.evaluate(() => sv.fryerServing.active), false, 'Taking fries must clear the tray')
    checks.fryerTrayEmptyFryingReadyBurntTake = true

    await page.evaluate(() => {
      clear()
      for (let i = 0; i < 2; i++) {
        sv.kitchen.carry.kind = 'patty'
        sv.kitchen.carry.cook = 'raw'
        sv.kitchen.carry.plated = false
        tap('grill')
      }
      sv.kitchen.dirty = 2
      tap('sink')
      tap('fryer')
      tap('drinks')
      advance(1.1)
    })
    checks.simultaneousVertices = await page.evaluate(() => fx.used)
    assert(checks.simultaneousVertices > flameA.vertices + frying.vertices, 'Several real stations must animate together')
    assert(checks.simultaneousVertices <= 6144, 'Simultaneous effects must fit the fixed mesh')
    const getRender = () => page.evaluate(() => ({ calls: E.director.root.device.numDrawCalls, triangles: E.director.root.device.numTris }))
    await page.evaluate(() => { for (const f of sv.floaters.pool) f.node.active = false })
    await page.waitForTimeout(150)
    const activeRender = await getRender()
    await page.evaluate(() => fx.hide())
    await page.waitForTimeout(150)
    const hiddenRender = await getRender()
    checks.renderOverhead = { calls: activeRender.calls - hiddenRender.calls, triangles: activeRender.triangles - hiddenRender.triangles }
    assert.equal(checks.renderOverhead.calls, 1, 'All effects must use one draw call together')

    checks.resourceReuse = await page.evaluate(() => buffers[0] === fx.positions.buffer && buffers[1] === fx.colors.buffer)
    assert(checks.resourceReuse, 'Effects must reuse their mesh buffers')
    await page.evaluate(() => { tap('drinks'); sv.restart(sv.day) })
    assert.equal(await page.evaluate(() => fx.node.active), false, 'Restart must clear immediately')
    await page.evaluate(() => { clear(); tap('drinks'); sv.showResult() })
    assert.equal(await page.evaluate(() => fx.node.active), false, 'Closing must clear immediately')
    checks.restartAndClosingClear = true
    checks.anchors = await page.evaluate(() => ({ sink: fx.sink, basin: fx.basin, grill: fx.grill, drinks: fx.drinks, fryer: fx.fryer }))
    assert.equal(errors.length, 0, JSON.stringify(errors))
    assert.equal(requests.length, 0, JSON.stringify(requests))
    fs.writeFileSync(path.join(output, 'check.json'), JSON.stringify({ checks, errors, requests }, null, 2) + '\n')
    console.log(JSON.stringify({ checks, errors, requests }, null, 2))
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
