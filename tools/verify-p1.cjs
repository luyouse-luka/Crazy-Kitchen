const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const url = process.argv[2] || 'http://127.0.0.1:4198'
const out = process.argv[3] || 'game/temp/p1-browser'
fs.mkdirSync(out, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = [], checks = [], visits = [], bounds = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('requestfailed', r => errors.push(r.url()))
  async function boot() {
    await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.movement, null, { timeout: 60000 })
    await page.evaluate(async () => {
      window.E = await System.import('cc'); window.sv = cc.find('Canvas').getComponent('StationView')
      E.profiler.hideStats(); sv.firstOrderUi.guide.skip()
      Object.assign(document.getElementById('GameDiv').style, { position: 'fixed', inset: '0', width: '100%', height: '100%' })
      E.screen.windowSize = new E.Size(innerWidth, innerHeight); sv.syncScreen()
    })
  }
  async function zone(id) {
    await page.waitForTimeout(120)
    const p = await page.evaluate(id => {
      const q = sv.router.zones.find(z => z.id === id)
      if (!q) throw Error('Missing input zone ' + id)
      const r = document.querySelector('canvas').getBoundingClientRect()
      return { x: r.left + (q.x + q.w / 2) / sv.screenW * r.width, y: r.top + (1 - (q.y + q.h / 2) / sv.screenH) * r.height }
    }, id)
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(180)
  }
  async function action() {
    const p = await page.evaluate(() => {
      const n = cc.find('Canvas/UI_ActionButton'), p = n.getComponent(E.UITransform).convertToWorldSpaceAR(E.Vec3.ZERO)
      const r = document.querySelector('canvas').getBoundingClientRect(), v = E.view.getVisibleSize()
      return { x: r.left + p.x / v.width * r.width, y: r.top + (1 - p.y / v.height) * r.height }
    })
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(220)
  }
  async function boundsAt(width, height) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => { E.screen.windowSize = new E.Size(innerWidth, innerHeight); sv.syncScreen() })
    await page.waitForTimeout(600)
    const b = await page.evaluate(() => {
      const v = E.view.getVisibleSize()
      return [sv.nextNode.parent, sv.highlightCard.node, sv.recapCard.node, sv.regularCard.node].map(n => {
        const r = n.getComponent(E.UITransform).getBoundingBoxToWorld()
        const labels = n.getComponentsInChildren(E.Label).filter(l => l.node.activeInHierarchy).map(l => ({ text: l.string, width: l.node.getComponent(E.UITransform).width, height: l.node.getComponent(E.UITransform).height }))
        return { name: n.name, x: r.x, y: r.y, w: r.width, h: r.height, vw: v.width, vh: v.height, labels }
      })
    })
    for (const r of b) assert(r.x >= -1 && r.y >= -1 && r.x + r.w <= r.vw + 1 && r.y + r.h <= r.vh + 1, `Result card outside viewport ${JSON.stringify(r)}`)
    bounds.push({ width, height, cards: b })
    await page.screenshot({ path: path.join(out, `result-${width}x${height}.png`) })
  }
  try {
    await page.goto(url); await boot()
    await page.evaluate(() => { localStorage.removeItem('kc.progress') })
    await page.reload(); await boot()
    for (let chapter = 1; chapter <= 3; chapter++) {
      assert.equal(await page.evaluate(() => sv.regularVisit.chapter), chapter)
      await page.evaluate(() => { sv.openMenu('open'); sv.shift.cfg.customers = 1; sv.shift.flow.flow.maxArrivals = 1 })
      assert.match(await page.evaluate(() => sv.menuRows[0].desc), /阿星/)
      await zone('row0')
      await page.waitForFunction(() => sv.shift.flow.customers.some(c => c.active && c.id === 1))
      await page.evaluate(() => {
        const c = sv.shift.flow.customers.find(c => c.active && c.id === 1)
        c.orderWait = sv.shift.flow.flow.takeOrder.walkInSec + .1
        const s = sv.registerStation; Object.assign(sv.movement.pos, { x: s.pos.x, z: s.pos.z - 1 })
      })
      await action()
      assert.equal(await page.evaluate(() => sv.shift.flow.customers.find(c => c.id === 1).ordered), true)
      const arrival = await page.evaluate(() => ({ name: sv.nameOf(1), lines: sv.linesOf(1), spec: JSON.parse(JSON.stringify(sv.shift.flow.customers.find(c => c.id === 1).spec)) }))
      assert.equal(arrival.name, '阿星')
      if (chapter > 1) assert.match(arrival.lines.greet, /上回吃得挺好/)
      await zone('customer-card-1')
      const speech = await page.evaluate(greet => {
        const f = sv.floaters.pool.find(f => f.node.active && f.label.string.replace(/\n/g, '') === greet)
        if (!f) throw Error('Missing diner greeting bubble')
        const r = f.node.getComponent(E.UITransform).getBoundingBoxToWorld(), v = E.view.getVisibleSize()
        return { text: f.label.string, x: r.x, y: r.y, w: r.width, h: r.height, vw: v.width, vh: v.height }
      }, arrival.lines.greet)
      assert(speech.x >= 0 && speech.y >= 0 && speech.x + speech.w <= speech.vw && speech.y + speech.h <= speech.vh, 'Diner greeting must fit the screen')
      assert(speech.text.split('\n').every(row => Array.from(row).length <= 13))
      await page.screenshot({ path: path.join(out, `chapter-${chapter}-order.png`) })
      // The fixture shortens each shift and supplies a meal; input, judgement, review, banking and saving are real.
      await page.evaluate(wrong => {
        const c = sv.shift.flow.customers.find(c => c.active && c.id === 1)
        if (wrong && !c.spec.required.includes('cheese')) c.spec.required.push('cheese')
        Object.assign(sv.kitchen.burger, { ingredients: c.spec.required.filter(i => !wrong || i !== 'cheese'), cook: c.spec.doneness, double: !!c.spec.double, cook2: c.spec.doneness })
        sv.kitchen.carry.kind = 'plate'
        Object.assign(sv.movement.pos, { x: -1, z: 2.1 })
      }, chapter === 3)
      await action()
      await page.waitForFunction(() => sv.resultOpen, null, { timeout: 15000 })
      const state = await page.evaluate(() => ({ day: sv.day, nextDay: sv.progress.day, stars: sv.progress.best[sv.day - 1], resultOpen: sv.resultOpen,
        buttons: sv.nextNode.parent.children.filter(n => n.active && n.name.startsWith('Btn_')).map(n => ({ name: n.name, text: n.getChildByName('Label').getComponent(E.Label).string })),
        zones: sv.router.zones.map(z => z.id), memory: sv.progress.regular, coins: sv.progress.coins, served: sv.shift.served, wrong: sv.shift.wrong, reviews: sv.reviewLines, result: sv.resultBody.string, recap: { evidence: sv.recapCard.title.string, action: sv.recapCard.quote.string }, story: { title: sv.regularCard.title.string, text: sv.regularCard.quote.string } }))
      assert.equal(state.resultOpen, true)
      assert.equal(state.nextDay, state.day + 1)
      assert.deepEqual(state.buttons, [{ name: 'Btn_NextDay', text: '下一天' }, { name: 'Btn_Shop', text: '商店' }])
      assert(state.zones.includes('next')); assert(!state.zones.includes('again'))
      assert(!/重打|再来一局|拿到一颗星/.test(state.result))
      assert.equal(state.memory.chapter, chapter)
      assert(state.story.title.includes(['第一次来', '又见面了', '老位置见'][chapter - 1]))
      assert(!/练习生|试镜|候补|舞台/.test(JSON.stringify({ arrival, story: state.story })))
      assert.equal(state.memory.outcome, chapter === 3 ? 'bad' : 'good')
      assert.equal(state.wrong, chapter === 3 ? 1 : 0)
      assert(state.reviews.some(r => r.name === '阿星' && r.text.includes(chapter === 3 ? '缺芝士' : '及时送齐')))
      assert.match(state.result, /餐费.*小费.*收入/)
      if (chapter === 1) assert.match(arrival.lines.greet, /规矩立住.*不烧心/)
      if (chapter === 3) { assert.equal(state.stars, 0); assert.match(state.recap.evidence, /错单 1/); assert.match(state.recap.action, /缺芝士/) }
      await page.evaluate(() => { sv.showResult(); sv.showResult() })
      assert.equal(await page.evaluate(() => sv.progress.coins), state.coins, 'Repeated closing must not bank twice')
      visits.push({ chapter, arrival, speech, state })
      await page.screenshot({ path: path.join(out, `chapter-${chapter}-result.png`) })
      if (chapter < 3) await zone('next')
    }
    checks.push('Three actual input-driven diner handoffs use the recurring identity, chapter-specific dialogue, factual verdict, final review and saved chapter')
    checks.push('Repeated closing does not duplicate coins or advance story; correct and missing-cheese outcomes have matching reviews and recaps')
    for (const [w, h] of [[1280, 720], [1024, 768], [780, 360], [587, 652], [1560, 720]]) await boundsAt(w, h)
    checks.push('Result summary and all three side cards fit five window sizes, including resizing an open result')
    await zone('next')
    assert.equal(await page.evaluate(() => sv.day), 4, 'A zero-star shift must continue to day four')
    assert.equal(await page.evaluate(() => sv.regularVisit), null, 'Completed story must not restart on the next day')
    const memory = await page.evaluate(() => sv.progress.regular)
    await page.evaluate(() => sv.startRest())
    assert.deepEqual(await page.evaluate(() => sv.progress.regular), memory)
    await page.reload(); await boot()
    assert.deepEqual(await page.evaluate(() => sv.progress.regular), memory)
    assert.equal(await page.evaluate(() => sv.day), 4)
    checks.push('Zero-star closing offers only next-day/shop, saves day four, and never exposes replay; next-day, rest and reload preserve story memory')
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('kc.progress')); p.day = 2
      p.regular = { chapter: 1, lastDay: 1, outcome: 'bad' }
      localStorage.setItem('kc.progress', JSON.stringify(p))
    })
    await page.reload(); await boot()
    assert.match(await page.evaluate(() => sv.linesOf(1).greet), /上回没吃痛快/)
    checks.push('Reloaded previous bad service selects the authored bad-memory greeting')
    await page.evaluate(() => {
      sv.openForBusiness()
      const c = sv.shift.flow.customers[0]
      Object.assign(c, { active: true, id: 1, ordered: true, late: false, patienceLeft: 100, patienceMax: 100 })
      sv.shift.flow.activeCount = 1
      window.beforeWitness = c.patienceLeft
      sv.mishap('stained')
    })
    const witness = await page.evaluate(() => ({ before: beforeWitness, after: sv.shift.flow.customers[0].patienceLeft, line: sv.reviewLines.at(-1), highlight: sv.highlight }))
    assert(witness.after < witness.before); assert.match(witness.line.text, /盘子还脏|盘子没洗净/)
    assert.equal(witness.line.stars, 0); assert(witness.highlight.quote.includes(witness.line.text))
    checks.push('A witnessed dirty plate uses the selected customer response, reduces real patience, adds no rating and quotes the same line in the highlight')
    await page.evaluate(() => {
      const c = sv.shift.flow.customers[0]; c.patienceLeft = 20
      const s = sv.registerStation; Object.assign(sv.movement.pos, { x: s.pos.x, z: s.pos.z - 1 })
    })
    const button = await page.evaluate(() => {
      const n = cc.find('Canvas/UI_ActionButton'), p = n.getComponent(E.UITransform).convertToWorldSpaceAR(E.Vec3.ZERO)
      const r = document.querySelector('canvas').getBoundingClientRect(), v = E.view.getVisibleSize()
      return { x: r.left + p.x / v.width * r.width, y: r.top + (1 - p.y / v.height) * r.height }
    })
    await page.mouse.move(button.x, button.y); await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up()
    const provoked = await page.evaluate(() => ({ count: sv.shift.flow.provoked, reason: sv.reviewReasons.get(1), response: sv.banterMatches.get(1)?.customer[1] }))
    assert.equal(provoked.count, 1); assert.match(provoked.reason, /被厨师怼走/)
    const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '../pipeline/handwritten/banter.json'), 'utf8'))
    assert(bank.reason.provoked.includes(provoked.response))
    checks.push('Actual long press provoking an ordered diner uses the chef-provocation reason pool instead of claiming no order was taken')
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ url, setup: 'Diagnostic one-diner shifts, supplied meals and incident fixtures; menu, ordering, card click, delivery to diner, result buttons and provocation use real mouse input. Not human playthrough or device validation.', checks, visits, bounds, witness, provoked, errors }, null, 2))
    console.log(`PASS ${checks.length} P1 integration groups`)
  } catch (e) { await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); throw e }
  finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
