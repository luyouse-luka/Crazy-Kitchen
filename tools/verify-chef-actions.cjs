const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

async function main() {
  const out = path.resolve(process.argv[3] || 'game/temp/chef-preview/verification')
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } })
  const page = await context.newPage()
  const errors = [], failed = [], checks = {}
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push(m.type() + ': ' + m.text()) })
  page.on('requestfailed', r => failed.push(r.url()))
  try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:4185')
    await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.chefActions, null, { timeout: 60000 })
    await page.evaluate(async () => {
      window.E = await System.import('cc')
      window.sv = cc.find('Canvas').getComponent('StationView')
      E.profiler.hideStats()
      Object.assign(document.getElementById('GameDiv').style, { position: 'fixed', inset: '0', width: '100%', height: '100%' })
      E.screen.windowSize = new E.Size(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio)
      sv.syncScreen()
      window.normalHeight = sv.cameraComp.orthoHeight
      window.chef = sv.chefActions
      sv.enabled = false
      window.advance = (seconds) => { for (let t = 0; t < seconds - 1e-8; t += 1 / 60) sv.update(1 / 60) }
      window.clear = () => { sv.restart(1); sv.openForBusiness(); sv.update(1 / 60) }
      window.tap = (kind, options) => {
        const s = sv.kitchen.cfg.stations.find(s => s.kind === kind)
        if (!s) throw Error('Missing station ' + kind)
        const side = ['sink', 'rack'].includes(kind) ? -.78 : ['fridge', 'assembly', 'shelf'].includes(kind) ? .78 : 0
        Object.assign(sv.movement.pos, { x: s.pos.x + side, z: s.pos.z + (kind === 'grill' ? .78 : 0) })
        sv.movement.facingYaw = kind === 'grill' ? Math.PI : -Math.PI / 2
        sv.syncNodes()
        const result = sv.interactAt(s, options)
        sv.syncNodes()
        return result.kind
      }
      window.snapshot = () => ({
        action: chef.motion.action, reach: chef.motion.reach, carrying: sv.kitchen.carry.kind,
        anchor: { ...chef.carryAnchor }, hands: chef.handAnchors.map(v => ({ ...v })),
        head: { ...sv.playerModel.getChildByPath('K_chef/K_Rogue_Rig/K_root/K_hips/K_spine/K_chest/K_head')?.worldPosition },
        walking: sv.playerWalking,
        clip: ['idle', 'walk'].map(n => ({ name: n, playing: sv.playerAnim.getState(n)?.isPlaying, time: sv.playerAnim.getState(n)?.time })),
        burger: { ...sv.burgerStack.node.worldPosition },
        visibleHeld: chef.held.filter(h => h.node.active).length,
        visiblePlates: chef.plates.filter(p => p.active).length,
        bones: chef.arms.map(a => ({ upper: { ...a.upper.worldPosition }, lower: { ...a.lower.worldPosition }, hand: { ...a.hand.worldPosition }, upperLength: a.upperLength, lowerLength: a.lowerLength })),
      })
      clear()
      window.pattyVisuals = [...chef.held.flatMap(h => h.patties), ...sv.burgerStack.patties, ...sv.workstationEffects.patties]
      window.pattyBuffers = pattyVisuals.map(p => p.positions.buffer)
    })
    checks.initial = await page.evaluate(() => ({ baked: sv.playerAnim.useBakedAnimation, pans: sv.workstationEffects.pans.length, fridge: sv.kitchen.cfg.stations.find(s => s.kind === 'fridge').pos, brushVisual: !!chef.sponge }))
    assert.equal(checks.initial.baked, false)
    assert.equal(checks.initial.pans, 2)
    assert.equal(checks.initial.brushVisual, true)
    assert.deepEqual(checks.initial.fridge, { x: -3.5, z: 0 })
    const snap = async (name, close = false) => {
      await page.evaluate(() => { sv.syncNodes(); sv.cameraComp.orthoHeight = normalHeight; for (const f of sv.floaters.pool) f.node.active = false })
      if (close) await page.evaluate(() => {
        const p = sv.playerNode.worldPosition, c = sv.cameraComp, f = c.node.forward
        c.node.setWorldPosition(p.x - f.x * 24, .8 - f.y * 24, p.z - f.z * 24)
        c.orthoHeight = 1.9
      })
      await page.waitForTimeout(220)
      await page.screenshot({ path: path.join(out, name + '.png') })
    }
    assert.equal(await page.evaluate(() => tap('fridge', { ingredient: 'patty' })), 'take-ingredient')
    await page.waitForTimeout(150)
    checks.take = await page.evaluate(() => snapshot())
    assert.equal(checks.take.action, 'pick')
    await page.evaluate(() => { advance(.4); sv.syncNodes() })
    await snap('raw-held-normal')
    await snap('raw-held-close', true)
    assert.equal(await page.evaluate(() => tap('grill')), 'place-patty')
    assert.equal(await page.evaluate(() => chef.motion.action), 'place')
    await page.evaluate(() => { advance(sv.kitchen.cfg.cook.mediumAt + .05); tap('grill'); advance(.4); sv.syncNodes() })
    await snap('cooked-held-close', true)
    checks.cookedHeld = await page.evaluate(() => snapshot())
    assert.equal(checks.cookedHeld.carrying, 'patty')
    const appearance = await page.evaluate(() => {
      const visual = chef.held[0].patties[0]
      return { cook: sv.kitchen.carry.cook, visual: visual.cook }
    })
    assert.equal(appearance.cook, appearance.visual)
    assert.equal(await page.evaluate(() => tap('assembly')), 'add-to-burger')
    await page.evaluate(() => { tap('fridge', { ingredient: 'bun' }); tap('assembly'); tap('assembly'); advance(.4); Object.assign(sv.movement.pos, { x: 1, z: .5 }); sv.movement.facingYaw = 0; sv.syncNodes() })
    await snap('plate-normal')
    await snap('plate-close', true)
    checks.plate = await page.evaluate(() => snapshot())
    assert.equal(checks.plate.carrying, 'plate')
    const p = checks.plate
    assert(Math.abs(p.burger.x - (p.hands[0].x + p.hands[1].x) / 2) < .002)
    assert(Math.abs(p.burger.y - (p.hands[0].y + p.hands[1].y) / 2 - .025) < .002)
    assert(Math.abs(p.burger.z - (p.hands[0].z + p.hands[1].z) / 2) < .002)
    for (const arm of p.bones) {
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
      assert(Math.abs(dist(arm.upper, arm.lower) - arm.upperLength) < .002)
      assert(Math.abs(dist(arm.lower, arm.hand) - arm.lowerLength) < .002)
    }
    await page.evaluate(() => { sv.movement.moving = true; sv.syncNodes() })
    await page.waitForTimeout(350)
    checks.walkingCarry = await page.evaluate(() => snapshot())
    assert(checks.walkingCarry.walking)
    assert(checks.walkingCarry.clip.find(c => c.name === 'walk').playing)
    assert.equal(checks.walkingCarry.action, null)
    await snap('plate-walk', true)
    assert.equal(await page.evaluate(() => { sv.movement.moving = false; return tap('assembly') }), 'put-plate')
    await page.evaluate(() => { advance(.4); sv.syncNodes() })
    checks.placed = await page.evaluate(() => ({ carrying: sv.kitchen.carry.kind, burger: { ...sv.burgerStack.node.worldPosition }, benchY: sv.benchTopY, station: sv.benchStation.pos }))
    assert.equal(checks.placed.carrying, 'none')
    assert.equal(checks.placed.burger.x, checks.placed.station.x)
    assert.equal(checks.placed.burger.z, checks.placed.station.z)
    assert.equal(checks.placed.burger.y, checks.placed.benchY)
    await page.evaluate(() => { clear(); sv.kitchen.dirty = 2; tap('sink'); advance(1.1); sv.router.action.holding = true; sv.update(.016) })
    await snap('scrub-close', true)
    checks.scrub = await page.evaluate(() => snapshot())
    assert.equal(checks.scrub.action, 'scrub')
    checks.scrubContactError = await page.evaluate(() => E.Vec3.distance(chef.sponge.worldPosition, chef.brushAnchor))
    assert(checks.scrubContactError < .001)
    const handsA = checks.scrub.hands
    await page.evaluate(() => advance(.1))
    await page.waitForTimeout(80)
    assert.notDeepEqual(await page.evaluate(() => snapshot().hands), handsA)
    await page.evaluate(() => { sv.router.action.holding = false; sv.update(.016) })
    assert.equal(await page.evaluate(() => chef.motion.action), null)
    checks.releaseStops = true
    await page.evaluate(() => { clear(); sv.kitchen.dirty = 2; tap('sink'); advance(1.1); sv.router.action.holding = true; sv.update(.016); sv.movement.pos.x -= 3; sv.update(.016) })
    assert.equal(await page.evaluate(() => chef.motion.action), null)
    checks.leaveStops = true
    await page.evaluate(() => clear())
    assert.equal(await page.evaluate(() => chef.motion.action), null)
    assert.equal(await page.evaluate(() => chef.held.some(h => h.node.active)), false)
    checks.restartStops = true
    await page.evaluate(() => { tap('fridge', { ingredient: 'patty' }); sv.showResult() })
    assert.equal(await page.evaluate(() => chef.motion.action), null)
    assert.equal(await page.evaluate(() => chef.held.some(h => h.node.active)), false)
    checks.closeStops = true

    checks.grillSlot = await page.evaluate(() => {
      clear(); tap('fridge', { ingredient: 'patty' }); tap('grill')
      tap('fridge', { ingredient: 'patty' }); tap('grill'); advance(1)
      tap('grill', { slot: 0 }); tap('assembly')
      tap('fridge', { ingredient: 'patty' }); tap('grill')
      const grill = sv.kitchen.cfg.stations.find(s => s.kind === 'grill')
      const result = sv.interactAt(grill)
      const target = sv.workstationEffects.actionTarget('grill', result.slot)
      return { resultSlot: result.slot, targetMatches: Math.hypot(chef.motion.target.x - target.x, chef.motion.target.y - target.y, chef.motion.target.z - target.z) < .001 }
    })
    assert.equal(checks.grillSlot.resultSlot, 1)
    assert.equal(checks.grillSlot.targetMatches, true)

    checks.levels = []
    for (const level of ['raw', 'rare', 'medium', 'well', 'burnt']) {
      const result = await page.evaluate(async level => {
        clear(); tap('fridge', { ingredient: 'patty' }); tap('grill')
        const elapsed = { raw: 0, rare: sv.kitchen.cfg.cook.rareAt, medium: sv.kitchen.cfg.cook.mediumAt, well: sv.kitchen.cfg.cook.wellAt, burnt: sv.kitchen.cfg.cook.burntAt }[level]
        advance(elapsed + .01)
        sv.workstationEffects.update(sv.kitchen, false, true, 0)
        const visual = sv.workstationEffects.patties[0], mesh = visual.renderer.mesh
        const cookOnGrill = visual.cook
        tap('grill'); advance(.4); sv.syncNodes()
        await new Promise(requestAnimationFrame)
        await new Promise(requestAnimationFrame)
        await new Promise(resolve => setTimeout(resolve, 120))
        const heldMesh = chef.held[0].patties[0].renderer.mesh
        const renderedMesh = chef.held[0].patties[0].renderer.model.subModels[0].subMesh === heldMesh.renderingSubMeshes[0]
        return { level, cookOnGrill, held: sv.kitchen.carry.cook, sameMesh: heldMesh === mesh, renderedMesh, smoke: chef.held[0].patties[0].smoke.active, meshColor: Array.from(heldMesh.readAttribute(0, 'a_color').slice(0, 4)) }
      }, level)
      checks.levels.push(result)
      assert.equal(result.cookOnGrill, level)
      assert.equal(result.held, level)
      assert.equal(result.sameMesh, true)
      assert.equal(result.renderedMesh, true)
      assert.equal(result.smoke, level === 'burnt')
      await snap(`cook-${level}-normal`)
      await snap(`cook-${level}-close`, true)
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(failed, [])
    checks.resources = await page.evaluate(() => {
      for (let i = 0; i < 20; i++) clear()
      return { pattyVisuals: pattyVisuals.length, sameSmokeBuffersAfter20Restarts: pattyVisuals.every((p, i) => p.positions.buffer === pattyBuffers[i]), valid: pattyVisuals.every(p => p.isValid) }
    })
    assert.equal(checks.resources.pattyVisuals, 8)
    assert.equal(checks.resources.sameSmokeBuffersAfter20Restarts, true)
    assert.equal(checks.resources.valid, true)
    checks.errors = errors
    checks.failedRequests = failed
    checks.note = 'Temporary isolated integration build. Pose tests teleport only for diagnostics; real-input regression is recorded separately. No phone testing.'
    fs.writeFileSync(path.join(out, 'check.json'), JSON.stringify(checks, null, 2))
    console.log(JSON.stringify(checks, null, 2))
  } catch (error) {
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ message: String(error), errors, failedRequests: failed, checks }, null, 2))
    await page.screenshot({ path: path.join(out, 'failure.png') })
    console.error(JSON.stringify({ errors, failedRequests: failed }))
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
