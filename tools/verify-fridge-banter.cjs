const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const url = process.argv[2] || 'http://127.0.0.1:4196'
const out = process.argv[3] || 'game/temp/fridge-banter-check'
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '../pipeline/handwritten/banter.json'), 'utf8'))
fs.mkdirSync(out, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [], checks = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('requestfailed', r => errors.push(r.url()))
  try {
    await page.goto(url)
    await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.movement, null, { timeout: 60000 })
    await page.evaluate(async () => { window.E = await System.import('cc'); window.sv = cc.find('Canvas').getComponent('StationView'); sv.firstOrderUi.guide.skip(); sv.closeMenu(); sv.phase = 'closed'; Object.assign(sv.movement.pos, { x: 3.5, z: -1.55 }) })
    async function action(hold = 40) {
      const p = await page.evaluate(() => {
        const t = cc.find('Canvas/UI_ActionButton').getComponent(E.UITransform), p = t.convertToWorldSpaceAR(E.Vec3.ZERO), r = document.querySelector('canvas').getBoundingClientRect()
        return { x: r.left + p.x / sv.screenW * r.width, y: r.top + (1 - p.y / sv.screenH) * r.height }
      })
      await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(hold); await page.mouse.up()
    }
    const angles = () => page.evaluate(() => sv.fridgeDoor.doors.map(d => d.node.eulerAngles.y - d.closed.y))
    const closed = await angles(); assert.equal(closed.length, 2); assert(closed.every(a => Math.abs(a) < .01))
    await page.evaluate(() => { window.doorFrames = []; const apply = sv.fridgeDoor.apply.bind(sv.fridgeDoor); sv.fridgeDoor.apply = () => { apply(); doorFrames.push(sv.fridgeDoor.pose.open) } })
    await action()
    await page.waitForTimeout(350); assert((await angles()).every(a => Math.abs(a - 100) < .01))
    const opening = await page.evaluate(() => [...doorFrames]); assert(opening.some(a => a > 0 && a < 1), 'Opening must contain intermediate animation frames')
    assert.equal(await page.evaluate(() => sv.panelOpen), true)
    await page.screenshot({ path: path.join(out, 'fridge-open.png') })
    // A real inventory click must close both the panel and the door.
    const pick = await page.evaluate(() => {
      const q = sv.router.zones.find(z => z.id === 'slot6'), r = document.querySelector('canvas').getBoundingClientRect()
      return { x: r.left + (q.x + q.w / 2) / sv.screenW * r.width, y: r.top + (1 - (q.y + q.h / 2) / sv.screenH) * r.height }
    })
    await page.mouse.click(pick.x, pick.y); await page.waitForTimeout(400)
    assert.equal(await page.evaluate(() => sv.panelOpen), false)
    assert.equal(await page.evaluate(() => sv.kitchen.carry.ingredient), 'pickle')
    assert((await angles()).every(a => Math.abs(a) < .01))
    checks.push('Actual action opens both hinged doors; ingredient click closes them and preserves single-item pick')
    await page.evaluate(() => { sv.kitchen.carry.kind = 'none' })
    await action(); await page.waitForTimeout(350); assert.equal(await page.evaluate(() => sv.panelOpen), true)
    await page.mouse.click(15, 15); await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => sv.panelOpen), false); assert((await angles()).every(a => Math.abs(a) < .01))
    checks.push('Actual click outside the inventory cancels it and closes both doors')
    const positions = await page.evaluate(() => sv.fridgeDoor.doors.map(d => ({ ...d.node.position })))
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => sv.openPanel(sv.kitchen.cfg.stations.find(s => s.kind === 'fridge')))
      await page.waitForTimeout(35)
      await page.evaluate(() => sv.closePanel())
      await page.waitForTimeout(30)
    }
    await page.waitForTimeout(350)
    assert((await angles()).every(a => Math.abs(a) < .01))
    assert.deepEqual(await page.evaluate(() => sv.fridgeDoor.doors.map(d => ({ ...d.node.position }))), positions)
    checks.push('12 interrupted open/close cycles restore the exact hinge pose without position drift')
    await page.evaluate(() => { sv.kitchen.carry.kind = 'crate'; sv.kitchen.carry.ingredient = 'pickle'; sv.kitchen.stock[6] = 0; const r = sv.interactAt(sv.kitchen.cfg.stations.find(s => s.kind === 'fridge')); if (r.kind !== 'restock') throw Error(JSON.stringify(r)) })
    await page.waitForTimeout(150); assert((await angles()).every(a => a > 30))
    await page.waitForTimeout(800); assert((await angles()).every(a => Math.abs(a) < .01))
    checks.push('Restock opens, holds, and closes without opening the picker')
    await page.evaluate(() => { sv.phase = 'open'; sv.kitchen.carry.kind = 'none' })
    await page.evaluate(() => { doorFrames.length = 0 })
    await action(730); await page.waitForTimeout(500)
    const slam = await page.evaluate(() => [...doorFrames]); assert(slam.some(a => a > 0 && a < 1))
    assert.equal(await page.evaluate(() => sv.venting.vents), 1)
    assert((await angles()).every(a => Math.abs(a) < .01))
    checks.push('Actual long press vents once and completes a door slam')
    await page.evaluate(() => {
      sv.phase = 'closed'; sv.closePanel(); sv.openPanel(sv.kitchen.cfg.stations.find(s => s.kind === 'fridge')); sv.restart(sv.day)
    })
    await page.waitForTimeout(350); assert((await angles()).every(a => Math.abs(a) < .01)); assert.equal(await page.evaluate(() => sv.panelOpen), false)
    checks.push('Restart cancels an in-flight opening tween and closes the picker')
    // Fixtures isolate shouting from order arrival randomness; taps use real input.
    await page.evaluate(() => {
      sv.phase = 'open'; sv.shift.over = false
      Object.assign(sv.movement.pos, { x: sv.registerStation.pos.x, z: sv.registerStation.pos.z - 1 })
      const c = sv.shift.flow.customers[0]; Object.assign(c, { id: 30, active: false, late: true })
      sv.tasks = [{ id: 'no-burnt', target: 0 }]; sv.kitchen.burnt = 0
      sv.rant(30, 'complain', 2, 'fallback')
      sv.kitchen.burnt = 1
      // The customer figure is only a display fixture; rating logic remains real.
      const f = sv.figures[0]; Object.assign(f, { id: 30, leaving: true, shouted: true }); f.node.active = true
      f.node.setPosition(sv.queueX - 1, 0, sv.queueZ); f.tx = f.node.position.x; f.tz = f.node.position.z
      window.spoken = []; const original = sv.floaters.spawn.bind(sv.floaters)
      sv.floaters.spawn = (...args) => { spoken.push(args[4]); return original(...args) }
    })
    await action(720); await page.waitForTimeout(100)
    assert.equal(await page.evaluate(() => sv.venting.argue?.id), 30)
    const match = await page.evaluate(() => sv.banterMatches.get(30))
    assert(bank.tasks['no-burnt'].failed.includes(match.chef[2]), 'Task matching must read failures occurring after the complaint starts')
    assert(bank.reason.late.includes(match.customer[1]))
    for (let i = 0; i < 6; i++) {
      await action(); await page.waitForTimeout(100)
      const bubbles = await page.evaluate(() => sv.floaters.pool.filter(f => f.node.active && f.channel?.startsWith('argue-')).map(f => f.channel))
      assert.equal(new Set(bubbles).size, bubbles.length, 'Rapid taps must replace the previous line for each speaker')
      assert(bubbles.length <= 2)
    }
    await page.waitForTimeout(150)
    const evidence = await page.evaluate(() => ({ spoken, match: sv.banterMatches.get(30), highlight: sv.highlight, arguing: sv.venting.argue, retorts: sv.venting.retorts, review: sv.reviews.items.filter(r => r.customerId === 30).slice(-1)[0], rant: sv.venting.rants.some(r => r.id === 30) }))
    assert.equal(evidence.arguing, null)
    for (const line of [...match.chef, ...match.customer, match.exit]) assert(evidence.spoken.includes(line.length > 13 ? line.slice(0, 13) + '\n' + line.slice(13) : line), `Not spoken: ${line}`)
    assert(evidence.highlight.quote.includes(match.chef[5])); assert(evidence.highlight.quote.includes(match.exit))
    assert.equal(evidence.retorts, 1); assert.equal(evidence.review.stars, 1); assert.equal(evidence.rant, false)
    await page.screenshot({ path: path.join(out, 'banter.png') })
    checks.push('Six real taps speak the captured role/reason/task lines; exit and highlight quote the same encounter')
    await page.evaluate(() => { sv.closePanel(); sv.openPanel(sv.kitchen.cfg.stations.find(s => s.kind === 'fridge')); sv.showResult() })
    await page.waitForTimeout(400); assert((await angles()).every(a => Math.abs(a) < .01))
    checks.push('Result closes the door and picker')
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, closed, opening, slam, match, evidence, errors }, null, 2))
    console.log(`PASS ${checks.length} fridge/banter checks`)
  } catch (e) { await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); throw e }
  finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
