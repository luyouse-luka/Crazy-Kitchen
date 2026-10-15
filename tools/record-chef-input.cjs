const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const temp = path.join(root, 'game/temp/chef-preview')
fs.mkdirSync(temp, { recursive: true })
let source = fs.readFileSync(path.join(__dirname, 'verify-open-centre.cjs'), 'utf8')
const from = '  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })'
if (source.split(from).length !== 2 || source.split('} finally { await browser.close() }').length !== 2) throw Error('Real-input verifier has changed; review recording wrapper')
source = source.replace(from, `  const videoContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } })
  const page = await videoContext.newPage()`)
source = source.replace('} finally { await browser.close() }', '} finally { await videoContext.close(); await browser.close() }')
const runner = path.join(temp, 'record-real-input.cjs')
fs.writeFileSync(runner, source)
const result = spawnSync(process.execPath, [runner, process.argv[2] || 'http://127.0.0.1:4185', process.argv[3] || path.join(temp, 'recorded-input')], { cwd: root, stdio: 'inherit' })
fs.unlinkSync(runner)
process.exitCode = result.status ?? 1
