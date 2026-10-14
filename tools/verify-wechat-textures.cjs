const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

async function main() {
  const root = path.resolve(process.argv[2] || 'game/build/kitchen-chaos-wechat-optimized-20261014')
  const output = process.argv[3] || 'game/temp/wechat-optimize/texture-check.json'
  const cleanup = process.argv.includes('--cleanup')
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const errors = []
  try {
    const page = await browser.newPage()
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', error => errors.push(String(error)))
    await page.route('**/src/settings.json', async route => {
      const settings = await (await route.fetch()).json()
      settings.engine.macros = { ...settings.engine.macros, CLEANUP_IMAGE_CACHE: cleanup }
      settings.launch.launchScene = ''
      settings.assets.preloadBundles = []
      await route.fulfill({ json: settings })
    })
    await page.route('**/__wechat_textures__/**', async route => {
      const relative = new URL(route.request().url()).pathname.split('/__wechat_textures__/')[1]
      const file = path.resolve(root, decodeURIComponent(relative))
      assert(file.startsWith(root + path.sep))
      const types = { '.json': 'application/json', '.png': 'image/png', '.bin': 'application/octet-stream' }
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Missing probe asset' })
      await route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' })
    })
    await page.goto('http://127.0.0.1:4180/')
    await page.waitForFunction(() => window.cc?.game?.inited, null, { timeout: 60000 })
    const config = JSON.parse(fs.readFileSync(path.join(root, 'subpackages/main/config.json'), 'utf8'))
    const textures = fs.readdirSync('game/assets/art/restaurant').filter(file => file.endsWith('.glb.meta')).flatMap(file => {
      const meta = JSON.parse(fs.readFileSync('game/assets/art/restaurant/' + file, 'utf8'))
      return Object.values(meta.subMetas).filter(sub => sub.importer === 'texture').map(sub => ({ name: file, uuid: sub.uuid }))
    })
    const result = await page.evaluate(async ({ config, textures, cleanup }) => {
      const c = await System.import('cc')
      c.macro.CLEANUP_IMAGE_CACHE = cleanup
      const bundle = new c.AssetManager.Bundle()
      config.base = location.origin + '/__wechat_textures__/subpackages/main/'
      bundle.init(config)
      c.assetManager.bundles.add(bundle.name, bundle)
      const loaded = []
      for (const texture of textures) {
        if (!bundle.getAssetInfo(texture.uuid)) continue
        const entry = await new Promise(resolve => c.assetManager.loadAny({ uuid: texture.uuid, bundle: bundle.name }, (error, asset) => {
          resolve({ ...texture, error: error?.message || null, width: asset?.width || 0, height: asset?.height || 0, gpuTexture: !!asset?.getGFXTexture?.() })
        }))
        loaded.push(entry)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return { engine: c.VERSION, cleanup, textures: loaded }
    }, { config, textures, cleanup })
    result.errors = errors
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
    const invalid = result.textures.filter(texture => texture.error || !texture.width || !texture.height || !texture.gpuTexture)
    console.log(JSON.stringify({ cleanup, tested: result.textures.length, invalid, errors }, null, 2))
    assert(result.textures.length > 20, 'Probe must exercise the packaged textures')
    assert.equal(invalid.length, 0, 'Every shared atlas texture must retain image data until upload')
    assert.equal(errors.length, 0, 'Texture load must not report engine errors')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
