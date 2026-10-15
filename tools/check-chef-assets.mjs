import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseline = '88b51c3'
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 })
const hash = data => crypto.createHash('sha256').update(data).digest('hex')
const protectedFiles = ['game/assets/main.scene', 'game/assets/scripts/StationView.ts', 'game/assets/scripts/WorkstationEffects.ts', 'game/assets/art/restaurant/actor-chef.glb', 'game/assets/art/restaurant/actor-chef.glb.meta']
git(['diff', '--exit-code', baseline, '--', ...protectedFiles])
const chefPath = 'game/assets/art/restaurant/actor-chef.glb'
const before = git(['show', `${baseline}:${chefPath}`]), after = fs.readFileSync(path.join(root, chefPath))
if (!before.equals(after)) throw Error('Chef GLB must stay byte-identical')
const modules = ['ChefActions', 'ChefMotion', 'CookAppearance', 'PattyVisual'].flatMap(name => [`game/assets/scripts/${name}.ts`, `game/assets/scripts/${name}.ts.meta`])
const sourceFiles = modules.map(file => ({ file, bytes: fs.statSync(path.join(root, file)).size }))
const data = JSON.parse(after.subarray(20, 20 + after.readUInt32LE(12)).toString())
const report = {
  baseline,
  protectedFilesUnchanged: protectedFiles,
  chef: { bytes: after.length, sha256: hash(after), uuid: JSON.parse(fs.readFileSync(path.join(root, chefPath + '.meta'))).uuid, bones: data.skins[0].joints.map(i => data.nodes[i].name), clips: data.animations.map(a => a.name) },
  addedModelTextureAudioBytes: 0,
  newSourceAndMetaBytes: sourceFiles.reduce((sum, f) => sum + f.bytes, 0),
  sourceFiles,
  runtimeGeometry: { sharedPattyVariants: 5, bodyTriangles: { raw: 48, otherLevels: 54 }, smokeTrianglesPerVisibleBurntPatty: 24, spongeTriangles: 12, note: 'Five shared body meshes and one shared opaque material; one smoke mesh/material per PattyVisual, drawn only when burnt. Two grill patties add up to two opaque draws. Each visible burnt patty adds one transparent draw. One sponge mesh/material adds one draw only during scrubbing. Desktop profiler and phone performance must be reported separately.' },
}
const out = process.argv[2] || 'docs/chef-actions-2026-10-15-assets.json'
fs.writeFileSync(path.resolve(root, out), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ baseline, chefBytes: after.length, unchangedChefSha256: report.chef.sha256, addedMediaBytes: 0, newSourceAndMetaBytes: report.newSourceAndMetaBytes, out }))
