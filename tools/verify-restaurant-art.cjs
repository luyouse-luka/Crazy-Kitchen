const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

async function main() {
  const output = process.argv[3] || 'game/temp/art-swap/verification'
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' })
  const errors = [], failed = []
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.type() + ': ' + message.text())
  })
  page.on('requestfailed', request => failed.push({ url: request.url(), error: request.failure()?.errorText }))
  try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:4178')
    await page.waitForFunction(() => !!window.cc?.find('Canvas')?.getComponent('StationView')?.playerAnim, null, { timeout: 60000 })
    await page.evaluate(async () => {
      const engine = await System.import('cc')
      engine.profiler.hideStats()
      const div = document.getElementById('GameDiv')
      Object.assign(div.style, { position: 'fixed', inset: '0', width: '1280px', height: '720px' })
      window.sv = cc.find('Canvas').getComponent('StationView')
    })
    await page.waitForTimeout(1500)
    const idle = await page.evaluate(() => ({ playing: sv.playerAnim.getState('idle').isPlaying, time: sv.playerAnim.getState('idle').time }))
    assert.equal(idle.playing, true, 'Player must enter idle on load')
    assert(idle.time > 0, 'Idle animation must advance')
    await page.screenshot({ path: path.join(output, 'kitchen.png') })
    const clips = await page.evaluate(() => {
      sv.enabled = false
      sv.playerAnim.play('walk')
      return sv.playerAnim.clips.map(clip => ({ name: clip.name, duration: clip.duration }))
    })
    await page.waitForTimeout(600)
    const walk = await page.evaluate(() => ({ playing: sv.playerAnim.getState('walk').isPlaying, time: sv.playerAnim.getState('walk').time }))
    assert.equal(walk.playing, true)
    assert(walk.time > 0, 'Walk animation must advance')
    const seats = await page.evaluate(() => {
      sv.playerAnim.play('idle')
      for (let i = 0; i < 4; i++) {
        const figure = sv.figures[i]
        figure.node.active = true
        figure.node.setPosition(sv.waitX + [-2.4, -.8, .8, 2.4][i], .48, sv.waitZ + .94)
        figure.body.setRotationFromEuler(0, 180, 0)
        figure.anim.play('sit')
      }
      for (const value of Object.values(sv)) {
        if (value?.hide && value?.follow) value.hide()
        if (Array.isArray(value)) for (const ring of value) if (ring?.hide && ring?.follow) ring.hide()
      }
      const camera = sv.cameraComp, forward = camera.node.forward
      camera.node.setWorldPosition(2 - forward.x * 24, .1 - forward.y * 24, .3 - forward.z * 24)
      camera.orthoHeight = 7.3
      return sv.figures.slice(0, 4).map(figure => ({ active: figure.node.active, clip: figure.anim.getState('sit').name }))
    })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(output, 'overview.png') })
    await page.evaluate(() => {
      const camera = sv.cameraComp, forward = camera.node.forward
      camera.node.setWorldPosition(sv.waitX - forward.x * 18, .6 - forward.y * 18, sv.waitZ + .5 - forward.z * 18)
      camera.orthoHeight = 3.6
    })
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(output, 'characters.png') })
    await page.evaluate(() => {
      sv.playerNode.setPosition(sv.waitX - 3.2, 0, sv.waitZ + .94)
      sv.playerNode.getChildByName('Model').setRotationFromEuler(0, 0, 0)
      for (let i = 0; i < 4; i++) {
        const figure = sv.figures[i]
        figure.node.setPosition(sv.waitX + [-1.6, 0, 1.6, 3.2][i], 0, sv.waitZ + .94)
        figure.body.setRotationFromEuler(0, 0, 0)
        figure.anim.play('idle')
      }
      const camera = sv.cameraComp
      camera.node.setRotationFromEuler(-18, -10, 0)
      const forward = camera.node.forward
      camera.node.setWorldPosition(sv.waitX - forward.x * 18, .9 - forward.y * 18, sv.waitZ + .94 - forward.z * 18)
      camera.orthoHeight = 3.2
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(output, 'lineup.png') })
    let burger = null
    if (process.argv.includes('--serve')) {
      await page.reload()
      await page.waitForFunction(() => !!window.cc?.find('Canvas')?.getComponent('StationView')?.playerAnim, null, { timeout: 60000 })
      const source = fs.readFileSync('tools/preview-bot.js', 'utf8')
      const anchor = "B.log.push('served@' + sv.shift.t.toFixed(0));"
      const plate = "await tap('assembly'); expectCarry('plate', 'pick-plate');"
      assert(source.includes(anchor), 'Preview bot serving anchor must exist')
      assert(source.includes(plate), 'Preview bot plate anchor must exist')
      await page.evaluate(source.replace(anchor, anchor + ' B.oneServed = true; break;').replace(plate, plate + ' B.plateReady = true; await new Promise(resolve => { B.resumePlate = resolve });'))
      await page.evaluate(() => { window.__bot.run(false) })
      await page.waitForFunction(() => window.__bot.plateReady || window.__bot.done, null, { timeout: 120000 })
      assert(await page.evaluate(() => !!__bot.plateReady), 'Chef must pick up the completed plate')
      await page.evaluate(async () => {
        window.sv = cc.find('Canvas').getComponent('StationView')
        // The bot stands at station centers; use the navigable aisle for the pose screenshot.
        sv.movement.pos.x = 0
        sv.movement.pos.z = 1.8
        sv.movement.facingYaw = 0
        ;(await System.import('cc')).profiler.hideStats()
        Object.assign(document.getElementById('GameDiv').style, { position: 'fixed', inset: '0', width: '1280px', height: '720px' })
      })
      await page.waitForTimeout(250)
      await page.evaluate(() => { sv.enabled = false })
      await page.screenshot({ path: path.join(output, 'carrying.png') })
      await page.evaluate(() => { sv.enabled = true; __bot.resumePlate() })
      await page.waitForFunction(() => window.__bot.done, null, { timeout: 120000 })
      burger = await page.evaluate(() => ({ log: __bot.log, taps: __bot.taps, error: __bot.err, served: __bot.oneServed === true }))
      assert.equal(burger.error, null)
      assert.equal(burger.served, true, 'One burger must be assembled and served')
    }
    const result = { idle, walk, clips, seats, burger, errors, failed }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n')
    assert.deepEqual(errors, [], 'Browser warnings/errors')
    assert.deepEqual(failed, [], 'Failed asset requests')
    console.log(JSON.stringify(result))
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
