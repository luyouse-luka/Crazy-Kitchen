const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

async function main() {
  const out = process.argv[3] || 'game/temp/p0/ui'
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true })
  const errors = [], failed = [], checks = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('requestfailed', r => failed.push(r.url()))
  const check = (name, pass, data) => checks.push({ name, pass, data })
  try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:4194')
    await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.movement, null, { timeout: 60000 })
    await page.evaluate(async () => { window.E = await System.import('cc'); window.sv = cc.find('Canvas').getComponent('StationView') })
    const simulation = JSON.parse(fs.readFileSync('docs/p0-single-item-results.json', 'utf8'))
    const references = [...simulation.rows.filter(r => r.profile === 'precise-script'), ...simulation.upgrades]
    for (const row of references) {
      const actual = await page.evaluate(({ day, seed, owned }) => {
        const previous = sv.progress
        try {
          sv.progress = { ...previous, owned }
          return { ...sv.shiftConfig(day, seed), deliveryEnabled: sv.deliveryEnabled.call({ day }) }
        } finally { sv.progress = previous }
      }, { day: row.day, seed: row.config.seed, owned: row.owned })
      const { progress, ...expected } = row.config
      assert.deepEqual(actual, expected, `Built runtime must match simulation day ${row.day}/${row.owned}`)
    }
    const rules = await page.evaluate(() => ({ singleItem: sv.kitchen.cfg.singleItem, doublePatty: sv.kitchen.cfg.doublePatty }))
    check('built-runtime-matches-simulation-policy', references.length === 30 && rules.singleItem && rules.doublePatty, { configurations: references.length, rules })
    const cdp = await page.context().newCDPSession(page)
    const action = await page.evaluate(() => {
      const p = cc.find('Canvas/UI_ActionButton').worldPosition, r = document.querySelector('canvas').getBoundingClientRect()
      return { x: r.left + p.x / (sv.uiHalfW * 2) * r.width, y: r.bottom - p.y / (sv.uiHalfH * 2) * r.height }
    })
    const left = { id: 1, x: 140, y: 540 }, moved = { ...left, x: 200 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [moved] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [moved, { id: 2, ...action }] })
    await page.waitForTimeout(100)
    const dual = await page.evaluate(() => ({ stick: sv.router.stick.magnitude, action: sv.router.action.down }))
    check('real-browser-two-finger-input', dual.stick > 0 && dual.action, dual)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await page.waitForTimeout(80)
    const cancelled = await page.evaluate(() => ({ stick: sv.router.stick.magnitude, action: sv.router.action.down, tap: sv.router.action.tapped }))
    check('touch-cancel-clears-without-tap', cancelled.stick === 0 && !cancelled.action && !cancelled.tap, cancelled)

    await page.keyboard.down('w'); await page.keyboard.down('Space'); await page.waitForTimeout(100)
    const held = await page.evaluate(() => ({ key: sv.keys.w, space: sv.spaceDown }))
    assert(held.key && held.space, 'Keyboard cancellation test requires held keys')
    await page.evaluate(() => E.game.emit(E.Game.EVENT_HIDE))
    const hidden = await page.evaluate(() => ({ keys: { ...sv.keys }, space: sv.spaceDown, stickDown: sv.keyStickDown, action: sv.router.action.down }))
    check('hide-clears-keyboard-latches', !Object.values(hidden.keys).some(Boolean) && !hidden.space && !hidden.stickDown && !hidden.action, hidden)
    await page.evaluate(() => E.game.emit(E.Game.EVENT_SHOW))
    await page.keyboard.up('w'); await page.keyboard.up('Space')
    await page.keyboard.down('Space')
    const resumed = await page.evaluate(() => sv.router.action.down)
    check('action-can-be-pressed-after-hide', resumed)
    await page.keyboard.up('Space')

    for (const [width, height] of [[1024, 768], [1280, 720], [1560, 720], [780, 360]]) {
      await page.setViewportSize({ width, height })
      await page.reload()
      await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.movement)
      await page.evaluate(async () => { window.E = await System.import('cc'); window.sv = cc.find('Canvas').getComponent('StationView') })
      await page.waitForTimeout(200)
      const data = await page.evaluate(() => {
        const rect = n => { const p = n.worldPosition, t = n.getComponent(E.UITransform), s = n.worldScale
          return { x: p.x - t.width * s.x / 2, y: p.y - t.height * s.y / 2, w: t.width * s.x, h: t.height * s.y } }
        return { width: sv.uiHalfW * 2, height: sv.uiHalfH * 2,
          action: rect(cc.find('Canvas/UI_ActionButton')), aux: rect(cc.find('Canvas/UI_DiscardButton')),
          task: rect(sv.taskCard.node), safe: { ...sv.inset } }
      })
      const inBounds = r => r.x >= -1 && r.y >= -1 && r.x + r.w <= data.width + 1 && r.y + r.h <= data.height + 1
      check(`controls-in-window-${width}x${height}`, [data.action, data.aux, data.task].every(inBounds), data)
      check(`controls-target-at-least-44px-${width}x${height}`, [data.action, data.aux].every(r => Math.min(r.w * width / data.width, r.h * height / data.height) >= 44), { action: data.action, aux: data.aux })
      await page.screenshot({ path: path.join(out, `${width}x${height}.png`) })
    }
    const safe = await page.evaluate(() => {
      const original = E.sys.getSafeAreaRect, wx = globalThis.wx
      try {
        E.sys.getSafeAreaRect = () => new E.Rect(40, 20, sv.uiHalfW * 2 - 80, sv.uiHalfH * 2 - 50)
        globalThis.wx = { getMenuButtonBoundingClientRect: () => ({ left: innerWidth - 90 }), getSystemInfoSync: () => ({ windowWidth: innerWidth }) }
        sv.screenW = 0; sv.syncScreen()
        const p = sv.taskCard.node.worldPosition, t = sv.taskCard.node.getComponent(E.UITransform)
        return { inset: { ...sv.inset }, right: p.x + t.width / 2, limit: sv.uiHalfW * 2 - sv.capsuleRight() }
      } finally { E.sys.getSafeAreaRect = original; globalThis.wx = wx; sv.screenW = 0; sv.syncScreen() }
    })
    check('injected-safe-area-and-wechat-capsule', safe.inset.left === 40 && safe.inset.bottom === 20 && safe.right <= safe.limit + 1, safe)
    check('no-browser-errors-or-failed-requests', !errors.length && !failed.length, { errors, failed })
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, injected: ['Game.EVENT_HIDE lifecycle event', 'safe area and WeChat capsule geometry'] }, null, 2))
    assert(checks.every(c => c.pass), checks.filter(c => !c.pass).map(c => c.name).join(', '))
    console.log(`PASS ${checks.length} input and UI checks`)
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
