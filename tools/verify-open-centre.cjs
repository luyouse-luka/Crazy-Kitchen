const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

async function main() {
  const out = process.argv[3] || 'game/temp/open-centre-verification'
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = [], failed = [], moves = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push(m.type() + ': ' + m.text()) })
  page.on('requestfailed', r => failed.push(r.url()))
  try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:4183')
    await page.waitForFunction(() => !!window.cc?.find('Canvas')?.getComponent('StationView')?.movement, null, { timeout: 60000 })
    await page.evaluate(async () => {
      window.E = await System.import('cc')
      window.sv = cc.find('Canvas').getComponent('StationView')
      E.profiler.hideStats()
      Object.assign(document.getElementById('GameDiv').style, { position: 'fixed', inset: '0', width: '100%', height: '100%' })
      E.screen.windowSize = new E.Size(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio)
      sv.syncScreen()
    })
    await page.waitForTimeout(300)
    const initial = await page.evaluate(() => ({
      fridge: sv.kitchen.cfg.stations.find(s => s.kind === 'fridge').pos,
      plates: sv.kitchen.cfg.stations.find(s => s.kind === 'shelf').pos,
      assembly: sv.kitchen.cfg.stations.find(s => s.kind === 'assembly').pos,
      serve: sv.kitchen.cfg.stations.find(s => s.kind === 'serve').pos,
      extinguisher: sv.kitchen.cfg.stations.find(s => s.kind === 'extinguisher').pos,
      utility: cc.find('Kitchen/Blockers/Wall_Utility').active,
      returnCounter: cc.find('Kitchen/Blockers/Block_Return').active,
      marker: !!sv.extinguisherRing?.node.active,
      pans: cc.find('Kitchen/Props/Prop_Grill').children.filter(n => n.name.startsWith('CookingPan_')).map(n => ({ name: n.name, position: { ...n.worldPosition }, scale: { ...n.scale }, renderers: n.getComponentsInChildren(E.MeshRenderer).filter(r => r.enabled).length })),
      hiddenCollision: sv.movement.cfg.boxes.some(b => b.center.x === 5.1 && b.center.z === -1),
      shadowCentres: (() => {
        const mesh = cc.find('Kitchen/ContactShadows').getComponentsInChildren(E.MeshRenderer).find(r => r.mesh).mesh
        const points = mesh.readAttribute(0, E.gfx.AttributeName.ATTR_POSITION)
        const centres = []
        for (let i = 0; i < points.length; i += 216) {
          let x = 0, z = 0
          for (let j = 0; j < 72; j++) { x += points[i + j * 3]; z += points[i + j * 3 + 2] }
          centres.push([x / 72, z / 72])
        }
        return centres
      })(),
    }))
    fs.writeFileSync(path.join(out, 'initial.json'), JSON.stringify(initial, null, 2) + '\n')
    assert.deepEqual(initial.fridge, { x: -3.5, z: 0 }, 'Must load the new build')
    assert.deepEqual(initial.plates, { x: -3.5, z: 1 })
    assert.deepEqual(initial.assembly, { x: -3.5, z: -1.5 })
    assert.deepEqual(initial.serve, { x: -1, z: 3.1 })
    assert.deepEqual(initial.extinguisher, { x: 4.5, z: 3.25 })
    assert.equal(initial.utility, false)
    assert.equal(initial.returnCounter, false)
    assert.equal(initial.hiddenCollision, false, 'Disabled divider must not leave an invisible wall')
    assert.equal(initial.marker, false, 'Extinguisher floating text was removed')
    assert.equal(initial.pans.length, 2, 'Both cooking slots must have pans')
    for (const pan of initial.pans) assert(pan.renderers > 0, 'Pan model must be loaded and visible')
    for (const targetZ of [0, 1, -1.5]) {
      assert(initial.shadowCentres.some(([x, z]) => Math.abs(x + 3.5) < 1e-5 && Math.abs(z - targetZ) < 1e-5), `Build must include the side-counter shadow at ${targetZ}`)
    }
    assert(!initial.shadowCentres.some(([x, z]) => Math.abs(x + 3.5) < 1e-5 && Math.abs(z + 2.5) < 1e-5), 'Old corner plate-shelf shadow must be removed')
    assert(!initial.shadowCentres.some(([x, z]) => Math.abs(x) < 1e-5 && Math.abs(z) < 1e-5), 'Empty centre must not retain the old island shadow')
    await page.screenshot({ path: path.join(out, 'kitchen.png') })

    // Browser mouse drags feed the same TouchRouter and collision update as the on-screen stick.
    async function walk(x, z) {
      const start = await page.evaluate(() => ({ ...sv.movement.pos }))
      const base = { x: 150, y: 530 }
      await page.mouse.move(base.x, base.y)
      await page.mouse.down()
      const deadline = Date.now() + 18000
      let samples = 0, blocked = 0, done = false
      try {
        while (Date.now() < deadline) {
          const info = await page.evaluate(({ x, z }) => {
            const p = sv.movement.pos, dx = x - p.x, dz = z - p.z, distance = Math.hypot(dx, dz)
            const c = Math.cos(sv.cameraYaw), s = Math.sin(sv.cameraYaw)
            const scale = distance ? Math.max(22, Math.min(70, distance * 130)) / distance : 0
            return { distance, px: (dx * c - dz * s) * scale, py: (dx * s + dz * c) * scale, blocked: sv.movement.blocked }
          }, { x, z })
          samples++; blocked += Number(info.blocked)
          if (info.distance < .065) { done = true; break }
          await page.mouse.move(base.x + info.px, base.y + info.py)
          await page.waitForTimeout(40)
        }
      } finally { await page.mouse.up() }
      const end = await page.evaluate(() => ({ ...sv.movement.pos }))
      moves.push({ start, target: { x, z }, end, samples, blocked })
      fs.writeFileSync(path.join(out, 'movement.json'), JSON.stringify(moves, null, 2) + '\n')
      assert(done, `Joystick failed to reach ${x},${z}: ${JSON.stringify(end)}`)
    }
    const action = async () => { await page.mouse.click(1130, 560); await page.waitForTimeout(90) }
    async function zone(id) {
      const p = await page.evaluate(id => {
        const q = sv.router.zones.find(q => q.id === id)
        if (!q) throw Error('Missing capture zone ' + id)
        const canvas = document.querySelector('canvas').getBoundingClientRect()
        return { x: canvas.left + (q.x + q.w / 2) * canvas.width / sv.screenW, y: canvas.top + (sv.screenH - q.y - q.h / 2) * canvas.height / sv.screenH }
      }, id)
      await page.mouse.click(p.x, p.y)
      await page.waitForTimeout(90)
    }
    const carry = async kind => assert.equal(await page.evaluate(() => sv.kitchen.carry.kind), kind)
    for (const [x, z] of [[-2.5, 1.5], [6.4, -1.5], [-2.5, -1.5], [6.4, 1.5], [6.25, -1.3], [6.25, -4.5], [6.25, -1.3], [0, 1.55]]) await walk(x, z)

    await walk(-3.4, 2.1)
    await action()
    await page.screenshot({ path: path.join(out, 'opening-menu.png') })
    fs.writeFileSync(path.join(out, 'menu.json'), JSON.stringify(await page.evaluate(() => ({ phase: sv.phase, menuKind: sv.menuKind, zones: sv.router.zones, screen: [sv.screenW, sv.screenH], canvas: document.querySelector('canvas').getBoundingClientRect().toJSON() })), null, 2))
    await zone('row0')
    assert.equal(await page.evaluate(() => sv.phase), 'open')
    await page.waitForFunction(() => sv.shift.flow.customers.some(c => c.active && !c.ordered && c.orderWait >= sv.shift.flow.flow.takeOrder.walkInSec), null, { timeout: 35000 })
    await action()
    const spec = await page.evaluate(() => sv.shift.flow.customers.find(c => c.active && c.ordered).spec)
    assert(!spec.double, 'Fresh day should use a single patty')
    const ingredients = ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon']
    async function fetch(ingredient) {
      await walk(-2.5, 0)
      await action()
      await zone('slot' + ingredients.indexOf(ingredient))
      if (await page.evaluate(() => sv.panelOpen)) await zone('panel-outside')
    }
    await fetch('patty'); await carry('patty')
    await walk(0, -1.55); await action(); await carry('none')
    await page.waitForFunction(level => sv.kitchen.grill[0].elapsed >= sv.kitchen.cfg.cook[{ rare: 'rareAt', medium: 'mediumAt', well: 'wellAt' }[level]], spec.doneness)
    await action(); await carry('patty')
    await walk(-2.5, -1.5); await action(); await carry('none')
    for (const ingredient of spec.required.filter(i => i !== 'patty')) {
      await fetch(ingredient)
      await walk(-2.5, -1.5); await action(); await carry('none')
    }
    await action(); await carry('plate')
    await page.screenshot({ path: path.join(out, 'carrying.png') })
    await walk(-1, 2.1); await action(); await carry('none')
    const serving = await page.evaluate(() => ({ served: sv.shift.served, wrong: sv.shift.wrong, t: sv.shift.t }))
    assert.equal(serving.served, 1, 'Actual joystick route must complete a burger delivery')
    assert.equal(serving.wrong, 0, 'Joystick delivery must match the actual order')

    await walk(4.5, 2.1); await walk(4.5, 2.4); await action(); await carry('extinguisher')
    await action(); await carry('none')
    assert.equal(await page.evaluate(() => !!sv.extinguisherRing?.node.active), false)
    await page.screenshot({ path: path.join(out, 'extinguisher.png') })
    await walk(6.4, .5)
    await page.waitForFunction(() => sv.kitchen.dirty > 0)
    await action()
    await page.waitForFunction(() => sv.kitchen.sink.stage === 'soaked')
    await page.mouse.move(1130, 560); await page.mouse.down()
    try { await page.waitForFunction(() => sv.kitchen.rack.count > 0, null, { timeout: 10000 }) }
    finally { await page.mouse.up() }
    await page.waitForFunction(() => sv.kitchen.rack.ready > 0)
    await walk(6.4, 2); await action(); await carry('stack')
    await walk(-2.5, 1.5); await walk(-2.5, 1); await action(); await carry('none')

    await page.evaluate(() => {
      const c = sv.cameraComp, f = c.node.forward
      sv.enabled = false
      for (const key of Object.values(sv)) if (key?.hide && key?.follow) key.hide()
      c.node.setWorldPosition(2 - f.x * 24, .2 - f.y * 24, .2 - f.z * 24)
      c.orthoHeight = 7.3
    })
    await page.waitForTimeout(200)
    await page.waitForTimeout(50)
    await page.screenshot({ path: path.join(out, 'overview.png') })
    const result = { initial, moves, serving, wash: true, extinguisherPickupReturn: true, errors, failed }
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n')
    assert.deepEqual(errors, [], 'Browser warnings/errors')
    assert.deepEqual(failed, [], 'Failed asset requests')
    console.log(JSON.stringify({ ...result, moves: moves.length }))
  } catch (error) {
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify(await page.evaluate(() => ({
      phase: sv.phase, position: sv.movement.pos, action: sv.actionVerb(), lastBlock: sv.lastBlock,
      served: sv.shift.served, wrong: sv.shift.wrong, dirty: sv.kitchen.dirty,
      returning: sv.kitchen.returning, sink: sv.kitchen.sink, rack: sv.kitchen.rack,
    })), null, 2) + '\n')
    await page.screenshot({ path: path.join(out, 'failure.png') })
    throw error
  } finally { await browser.close() }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
