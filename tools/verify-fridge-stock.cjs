const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const url = process.argv[2] || 'http://127.0.0.1:4197'
const out = process.argv[3] || 'game/temp/fridge-stock-check'
fs.mkdirSync(out, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [], checks = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('requestfailed', r => errors.push(r.url()))
  try {
    await page.goto(url)
    await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.fridgeContents, null, { timeout: 60000 })
    await page.evaluate(async () => {
      window.E = await System.import('cc'); window.sv = cc.find('Canvas').getComponent('StationView')
      sv.firstOrderUi.guide.skip(); sv.closeMenu(); sv.phase = 'closed'
      Object.assign(sv.movement.pos, { x: 3.5, z: -1.55 })
    })
    const counts = () => page.evaluate(() => Object.fromEntries([...sv.fridgeContents.foods].map(([k, v]) => [k, v.filter(n => n.active).length])))
    async function action() {
      const p = await page.evaluate(() => {
        const t = cc.find('Canvas/UI_ActionButton').getComponent(E.UITransform), p = t.convertToWorldSpaceAR(E.Vec3.ZERO), r = document.querySelector('canvas').getBoundingClientRect()
        return { x: r.left + p.x / sv.screenW * r.width, y: r.top + (1 - p.y / sv.screenH) * r.height }
      })
      await page.mouse.click(p.x, p.y); await page.waitForTimeout(350)
    }
    assert.equal(await page.evaluate(() => sv.fridgeContents.node.activeInHierarchy), false)
    await page.screenshot({ path: path.join(out, 'fridge-closed.png') })
    const initialStock = await page.evaluate(() => [...sv.kitchen.stock])
    assert(initialStock.every(n => n > 0), 'Initial stock must be populated')
    await action()
    assert.equal(await page.evaluate(() => sv.panelOpen && sv.fridgeContents.node.activeInHierarchy), true)
    const full = await counts(); assert.equal(Object.keys(full).length, 8)
    assert(Object.values(full).every(n => n === 4))
    assert.deepEqual(await page.evaluate(() => [...sv.kitchen.stock]), initialStock)
    assert.equal(await page.evaluate(() => sv.fridgeContents.node.parent.name), 'fridge_A')
    const renderers = await page.evaluate(() => sv.fridgeContents.node.getComponentsInChildren(E.MeshRenderer).filter(r => r.enabledInHierarchy && r.mesh).length)
    assert(renderers >= 32, 'Food clones must have live meshes')
    await page.screenshot({ path: path.join(out, 'fridge-open.png') })
    checks.push('Initial real inventory displays eight ingredient types on four shelves; opening does not change stock')
    await page.evaluate(() => { sv.kitchen.stock[6] = 2 })
    await page.waitForTimeout(80); assert.equal((await counts()).pickle, 2)
    const pick = await page.evaluate(() => {
      const q = sv.router.zones.find(z => z.id === 'slot6'), r = document.querySelector('canvas').getBoundingClientRect()
      return { x: r.left + (q.x + q.w / 2) / sv.screenW * r.width, y: r.top + (1 - (q.y + q.h / 2) / sv.screenH) * r.height }
    })
    await page.mouse.click(pick.x, pick.y); await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => sv.kitchen.stock[6]), 1)
    assert.equal(await page.evaluate(() => sv.kitchen.carry.ingredient), 'pickle')
    assert.equal((await counts()).pickle, 1)
    assert.equal(await page.evaluate(() => sv.fridgeContents.node.activeInHierarchy), false)
    await page.evaluate(() => { sv.kitchen.carry.kind = 'none' })
    await action(); assert.equal((await counts()).pickle, 1)
    checks.push('Real ingredient click consumes one model and one stock unit, closes the door, and reopening retains the count')
    await page.evaluate(() => { sv.kitchen.stock.fill(0) }); await page.waitForTimeout(80)
    assert(Object.values(await counts()).every(n => n === 0))
    await page.screenshot({ path: path.join(out, 'fridge-empty-stock.png') })
    await page.mouse.click(15, 15); await page.waitForTimeout(300)
    await page.evaluate(() => {
      sv.kitchen.carry.kind = 'crate'; sv.kitchen.carry.ingredient = 'pickle'
      const result = sv.interactAt(sv.kitchen.cfg.stations.find(s => s.kind === 'fridge'))
      if (result.kind !== 'restock') throw Error(JSON.stringify(result))
    })
    await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => sv.fridgeContents.node.activeInHierarchy), true)
    assert.equal((await counts()).pickle, 4)
    assert.equal(await page.evaluate(() => sv.kitchen.stock[6] === sv.kitchen.cfg.fridgeCap), true)
    await page.waitForTimeout(650)
    assert.equal(await page.evaluate(() => sv.fridgeContents.node.activeInHierarchy), false)
    checks.push('Exhausted types disappear; actual restock restores displayed units during the door pulse and then hides the closed interior')
    await page.evaluate(() => {
      sv.kitchen.stock.fill(20); sv.openPanel(sv.kitchen.cfg.stations.find(s => s.kind === 'fridge'))
    }); await page.waitForTimeout(350)
    assert(Object.values(await counts()).every(n => n === 4))
    assert(await page.evaluate(() => sv.kitchen.stock.every(n => n === 20)))
    await page.evaluate(() => sv.restart(sv.day)); await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => sv.fridgeContents.node.activeInHierarchy), false)
    checks.push('Display caps at four without mutating upgraded inventory; restarting hides the contents with the door')
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ url, checks, initialStock, full, renderers, errors }, null, 2))
    console.log(JSON.stringify({ checks, renderers, errors }))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
