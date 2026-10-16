const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const url = process.argv[2] || 'http://127.0.0.1:4195'
const out = process.argv[3] || 'game/temp/story-ui-check'
const lines = JSON.parse(fs.readFileSync(path.join(__dirname, '../pipeline/handwritten/cards.json'), 'utf8'))
fs.mkdirSync(out, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const errors = [], checks = []
  try {
    for (const [width, height] of [[1280, 720], [1024, 768], [1560, 720], [780, 360], [587, 652]]) {
      const page = await browser.newPage({ viewport: { width, height } })
      page.on('pageerror', e => errors.push(String(e)))
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      page.on('requestfailed', r => errors.push(r.url()))
      await page.goto(url)
      await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.movement, null, { timeout: 60000 })
      await page.evaluate(async () => { window.E = await System.import('cc'); window.sv = cc.find('Canvas').getComponent('StationView') })
      const settle = () => page.waitForTimeout(300)
      const shot = async name => { await settle(); await page.screenshot({ path: path.join(out, `${width}x${height}-${name}.png`) }) }
      async function zone(id) {
        const p = await page.evaluate(id => {
          const q = sv.router.zones.find(z => z.id === id); if (!q) throw Error('Missing zone ' + id)
          const r = document.querySelector('canvas').getBoundingClientRect()
          return { x: r.left + (q.x + q.w / 2) * r.width / sv.screenW, y: r.top + (sv.screenH - q.y - q.h / 2) * r.height / sv.screenH }
        }, id)
        await page.mouse.click(p.x, p.y); await settle()
      }
      async function bounded(nodeName) {
        const b = await page.evaluate(name => {
          const node = name === 'menu' ? sv.menu.node : name === 'board' ? sv.board.node : sv.panelNode
          const r = node.getComponent(E.UITransform).getBoundingBoxToWorld(), v = E.view.getVisibleSize()
          return { x: r.x, y: r.y, w: r.width, h: r.height, vw: v.width, vh: v.height }
        }, nodeName)
        assert(b.x >= -1 && b.y >= -1 && b.x + b.w <= b.vw + 1 && b.y + b.h <= b.vh + 1, `${nodeName} outside viewport ${JSON.stringify(b)}`)
        return b
      }
      // Diagnostic setup isolates presentation scenarios from saved player progression.
      await page.evaluate(() => { sv.progress.coins = 500; sv.openMenu('shop') })
      await settle(); const shopBounds = await bounded('menu'); await shot('shop')
      const shop = await page.evaluate(() => ({ rows: sv.menuRows.map(r => ({ name: r.name, on: r.on })), buttons: sv.menu.buttons, page: sv.menu.page }))
      assert(shop.rows.length > 4 && shop.buttons.some(b => b.id === 'row0'))
      await zone('row0')
      const bought = await page.evaluate(() => ({ coins: sv.progress.coins, enabled: sv.menuRows[0].on }))
      assert.equal(bought.coins, 350); assert.equal(bought.enabled, false)
      await zone('row0'); assert.equal(await page.evaluate(() => sv.progress.coins), 350, 'Owned item must not charge twice')
      if (shop.buttons.some(b => b.id === 'menu-next')) {
        await zone('menu-next'); assert.equal(await page.evaluate(() => sv.menu.page), 1)
        await shot('shop-page2'); await zone('menu-prev'); assert.equal(await page.evaluate(() => sv.menu.page), 0)
      }
      await zone('menu-close'); assert.equal(await page.evaluate(() => sv.menuKind), null)
      await page.evaluate(() => { sv.progress.coins = 0; sv.openMenu('shop') })
      await settle(); await zone('row1'); assert.equal(await page.evaluate(() => sv.progress.coins), 0)
      await page.evaluate(() => { sv.closeMenu(); sv.openMenu('rest') }); await shot('decor')
      await zone('row0'); assert.match(await page.evaluate(() => sv.menuKind), /^slot:/); await shot('decor-slot')
      await page.evaluate(() => { sv.closeMenu(); sv.openMenu('wall') }); await shot('wall')
      await page.evaluate(() => { sv.closeMenu(); Object.assign(sv.movement.pos, { x: 3.5, z: -1.55 }); sv.openPanel(sv.kitchen.cfg.stations.find(s => s.kind === 'fridge')) })
      await settle(); await shot('fridge')
      const foods = await page.evaluate(() => sv.panelNode.getComponentsInChildren(E.Graphics).filter(g => g.node.name === 'FoodIllustration').map(g => ({ visible: g.enabledInHierarchy, shapes: g.impl.paths.length })))
      assert.equal(foods.filter(f => f.visible && f.shapes > 0).length, 8)
      await zone('slot6')
      assert.equal(await page.evaluate(() => sv.kitchen.carry.ingredient), 'pickle')
      assert.equal(await page.evaluate(() => sv.panelOpen), false, 'Single item pick must close the panel')
      const cardIndex = await page.evaluate(() => {
        sv.regularVisit = null
        sv.kitchen.carry = { kind: 'none' }; sv.phase = 'closed'
        const c = sv.shift.flow.customers[0]
        Object.assign(c, { active: true, id: 1, ordered: true, late: false, patienceMax: 60, patienceLeft: 60, orderWait: 0, friesDue: false, drinkDue: false, burgerVerdict: null, gifted: false,
          spec: { required: ['bun', 'patty', 'cheese'], banned: ['onion'], doneness: 'medium', patience: 60 } })
        sv.shift.flow.activeCount = 1; sv.uiPoll = 0; sv.syncFirstOrderUi()
        return sv.cardIndex(c.id)
      })
      await settle(); await shot('customer-arrival')
      const customerLines = lines[cardIndex].lines
      assert.equal(await page.evaluate(() => sv.modernOrders[0].story.string), `“${customerLines.greet}”`)
      const orderText = await page.evaluate(() => { const c = sv.modernOrders[0]; return [c.recipe.string, c.cook.string, c.banned.string] })
      const pos = await page.evaluate(() => ({ ...sv.movement.pos }))
      await zone('customer-card-1')
      assert.equal(await page.evaluate(() => sv.floaters.lastText), customerLines.greet)
      assert.deepEqual(await page.evaluate(() => ({ ...sv.movement.pos })), pos, 'Card click must not move the chef')
      await page.evaluate(() => { sv.shift.flow.customers[0].patienceLeft = 25; sv.uiPoll = 0 })
      await settle(); await zone('customer-card-1')
      assert.equal(await page.evaluate(() => sv.floaters.lastText), customerLines.wait_nudge)
      assert.equal(await page.evaluate(() => sv.modernOrders[0].story.string), `“${customerLines.wait_nudge}”`)
      assert.deepEqual(await page.evaluate(() => { const c = sv.modernOrders[0]; return [c.recipe.string, c.cook.string, c.banned.string] }), orderText, 'Story changes must preserve recipe, doneness and banned ingredients')
      await shot('customer-wait')
      await page.evaluate(() => { sv.shift.flow.customers[0].active = false; sv.shift.flow.activeCount = 0; sv.uiPoll = 0 })
      await page.evaluate(() => { sv.closePanel(); sv.phase = 'closed'; sv.kitchen.dirty = 2; sv.kitchen.sink.stage = 'empty'; sv.syncKitchenRings() })
      const dish = await page.evaluate(() => ({ text: sv.sinkRing.label.string, count: sv.sinkRing.count.string, visible: sv.sinkRing.dish.node.active, stage: sv.sinkRing.dishKey }))
      assert.deepEqual(dish, { text: '', count: '2', visible: true, stage: 'dirty' }); await shot('dirty')
      await page.evaluate(() => { sv.kitchen.sink.stage = 'soaking'; sv.kitchen.sink.left = 1; sv.syncKitchenRings() })
      assert.equal(await page.evaluate(() => sv.sinkRing.dishKey), 'soaking')
      await page.evaluate(() => { sv.kitchen.sink.stage = 'soaked'; sv.kitchen.sink.scrub = .5; sv.syncKitchenRings() })
      assert.equal(await page.evaluate(() => sv.sinkRing.dishKey), 'scrub'); await shot('wash')
      await page.evaluate(() => {
        sv.firstOrderUi.layout(sv.uiHalfW * 2, sv.uiHalfH * 2, true, sv.inset)
        sv.enabled = false
        sv.reviewsOpen = true
        sv.board.show(4.6, [
          { name: '熬夜程序员', stars: 5, avatar: 2, text: '编译通过，今天终于有个版本没翻车。' },
          { name: '练习生', stars: 4, avatar: 0, text: '这口有点东西，给老板投一票！' },
          { name: '班主任', stars: 2, avatar: 1, text: '说好不拖堂，怎么饭还在留堂？' },
          { name: '外星游客', stars: 5, avatar: 3, text: '地球餐饮可以，已加入银河回购清单。' },
          { name: '代驾师傅', stars: 5, avatar: 4, text: '血条回满，今晚继续接单。' },
        ])
        sv.board.syncOffers([{ text: '面包+肉饼+芝士 · 全熟 · 薯条+饮料', sec: 29 }, { text: '面包+肉饼+番茄 · 五分熟 · 不要洋葱', sec: 16 }])
      })
      await settle(); await bounded('board'); await shot('reviews')
      await page.evaluate(() => { sv.enabled = true; sv.reviewsOpen = false; sv.board.hide(); sv.kitchen.sink.stage = 'empty'; sv.showResult() })
      await shot('result')
      assert.equal(await page.evaluate(() => sv.firstOrderUi.node.active || sv.firstOrderUi.marker.active), false, 'Result must hide tutorial cards and station markers')
      if (width === 1280) {
        await page.evaluate(() => { sv.resultOpen = false; sv.resultNode.active = false; sv.progress.coins = 500; sv.openMenu('shop') })
        await settle()
        const target = await page.evaluate(() => {
          const q = sv.router.zones.find(z => z.id === 'row1'), r = document.querySelector('canvas').getBoundingClientRect()
          return { x: r.left + (q.x + q.w / 2) * r.width / sv.screenW, y: r.top + (sv.screenH - q.y - q.h / 2) * r.height / sv.screenH }
        })
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: target.x, y: target.y, id: 11 }] })
        await page.waitForTimeout(60)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await settle()
        assert.equal(await page.evaluate(() => sv.progress.coins), 250, 'Passive highlights must not swallow touch purchases')
        assert.equal(await page.evaluate(() => sv.progress.owned.includes('drinks')), true)
        await page.setViewportSize({ width: 587, height: 652 }); await page.waitForTimeout(800); await bounded('menu')
        await page.setViewportSize({ width: 780, height: 360 }); await page.waitForTimeout(800); await bounded('menu')
        assert.equal(await page.evaluate(() => sv.menu.pageSize), 4, 'An open menu must repaginate after a resize')
      }
      checks.push({ width, height, shopBounds, shopRows: shop.rows.length, bought, dish, foodGlyphs: foods.length, customer: { identity: lines[cardIndex].identity, arrival: customerLines.greet, waiting: customerLines.wait_nudge, orderText }, touchPurchaseAndResize: width === 1280 })
      await page.close()
    }
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ url, setup: 'Presentation states use diagnostic fixtures; purchases and pagination use actual pointer events.', checks, errors }, null, 2))
    console.log(`PASS story UI at ${checks.length} viewports; purchase, repeat-buy guard, pagination, decor navigation, eight food glyphs, three wash icons, modal bounds`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
