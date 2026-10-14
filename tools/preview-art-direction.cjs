const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

;(async () => {
  const out = 'game/temp/art-polish'
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push(m.type() + ': ' + m.text()) })
  try {
    await page.goto('http://127.0.0.1:4178')
    await page.waitForFunction(() => !!window.cc?.find('Canvas')?.getComponent('StationView')?.playerAnim)
    await page.evaluate(async () => {
      window.E = await System.import('cc')
      E.profiler.hideStats()
      Object.assign(document.getElementById('GameDiv').style, { position: 'fixed', inset: '0', width: '1280px', height: '720px' })
      window.sv = cc.find('Canvas').getComponent('StationView')
      sv.enabled = false
      for (const value of Object.values(sv)) {
        if (value?.hide && value?.follow) value.hide()
        if (Array.isArray(value)) for (const ring of value) if (ring?.hide && ring?.follow) ring.hide()
      }
    })
    await page.waitForTimeout(300)
    await page.screenshot({ path: out + '/before.png' })
    console.log(await page.evaluate(() => {
      const scene = E.director.getScene(), cache = new Map()
      for (const mr of scene.getComponentsInChildren(E.MeshRenderer)) {
        if (mr.node.name === 'Shadow') continue
        for (let i = 0; i < mr.sharedMaterials.length; i++) {
          const old = mr.getRenderMaterial(i)
          if (!old) continue
          let material = cache.get(old)
          if (!material) {
            material = new E.Material()
            material.initialize({ effectName: 'builtin-standard', defines: { USE_ALBEDO_MAP: !!old.getProperty('mainTexture'), USE_VERTEX_COLOR: !!old.passes[0].defines.USE_VERTEX_COLOR } })
            for (const key of ['mainTexture', 'mainColor']) {
              const value = old.getProperty(key)
              if (value) material.setProperty(key, value)
            }
            material.setProperty('roughness', .9)
            material.setProperty('metallic', 0)
            material.setProperty('specularIntensity', .15)
            cache.set(old, material)
          }
          mr.setSharedMaterial(material, i)
        }
      }
      const globals = scene.globals
      globals.ambient.skyColor = new E.Vec4(.9, .94, 1, 1)
      globals.ambient.skyIllum = .55
      globals.ambient.groundAlbedo = new E.Vec4(.45, .4, .35, 1)
      const sun = scene.getComponentInChildren(E.DirectionalLight)
      sun.node.setRotationFromEuler(-55, -25, 0)
      sun.illuminance = 1.2
      return { materials: cache.size, effect: E.EffectAsset.get('builtin-standard')?.name }
    }))
    await page.waitForTimeout(1200)
    await page.screenshot({ path: out + '/lighting.png' })
    for (const [yaw, pitch] of [[-35, -42], [-25, -45], [-15, -48]]) {
      await page.evaluate(({ yaw, pitch }) => {
        const camera = sv.cameraComp
        camera.node.setRotationFromEuler(pitch, yaw, 0)
        const f = camera.node.forward
        camera.node.setWorldPosition(.8 - f.x * 20, .2 - f.y * 20, 1.1 - f.z * 20)
        camera.orthoHeight = 4.4
      }, { yaw, pitch })
      await page.waitForTimeout(250)
      await page.screenshot({ path: out + `/camera${-yaw}.png` })
    }
    fs.writeFileSync(out + '/preview-errors.json', JSON.stringify(errors, null, 2))
    console.log(JSON.stringify(errors))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
