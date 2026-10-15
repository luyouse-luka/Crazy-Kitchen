import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const snapshotFile = resolve(root, process.argv[2] ?? 'docs/difficulty-layout-2026-10-14.json')
const resultFile = resolve(root, process.argv[3] ?? 'docs/difficulty-results-2026-10-14.json')
const repeatFile = resolve(root, `docs/.calibration-repeat-${process.pid}.json`)
const badFile = resolve(root, `docs/.calibration-invalid-${process.pid}.json`)
for (const file of [repeatFile, badFile]) {
  assert(file.startsWith(root + '\\') || file.startsWith(root + '/'))
  assert(!existsSync(file), 'Do not overwrite an existing probe')
}
const cli = fileURLToPath(import.meta.resolve('vite-node/cli'))
const run = (input, mode) => spawnSync(process.execPath, [cli, 'tools/difficulty-calibrate.ts', input, repeatFile, ...(mode ? [mode] : [])], { cwd: root, encoding: 'utf8', timeout: 60000 })
try {
  const repeated = run(snapshotFile)
  assert.equal(repeated.status, 0, repeated.stderr)
  assert.equal(readFileSync(repeatFile, 'utf8'), readFileSync(resultFile, 'utf8'), 'All fixed-seed results must repeat byte for byte')
  const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'))
  writeFileSync(badFile, JSON.stringify({ ...snapshot, stations: snapshot.stations.slice(1) }))
  const invalid = run(badFile)
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stderr, /Invalid calibration layout/)
  writeFileSync(badFile, JSON.stringify({ ...snapshot, normalizedHashes: { ...snapshot.normalizedHashes, 'game/assets/logic/difficulty.ts': 'changed' } }))
  const drift = run(badFile)
  assert.notEqual(drift.status, 0)
  assert.match(drift.stderr, /Logic drift since capture: game\/assets\/logic\/difficulty.ts/)
  const result = JSON.parse(readFileSync(resultFile, 'utf8'))
  assert(Object.values(result.checks).every(value => value === true))
  assert.equal(result.rows.length, 90)
  assert.equal(result.upgrades.length, 16)
  assert.equal(result.productChanged, false)
  assert(result.rows.some(row => row.variant === 'current' && row.profile === 'learning-delay' && row.day === 5 && row.passRate < 1))
  assert(result.rows.filter(row => row.variant === 'staged' && row.day <= 5).every(row => row.passRate >= 0.95))
  assert.equal(result.fireProbe.fireAtSec, result.fireProbe.burntAtSec + 6)
  const followups = [process.argv[4], process.argv[5]].filter(Boolean).map(path => ({ path: resolve(root, path), data: JSON.parse(readFileSync(resolve(root, path), 'utf8')) }))
  for (const { path, data } of followups) {
    assert.equal(data.snapshotSha256, result.snapshotSha256)
    assert.equal(data.productChanged, false)
    assert(Object.values(data.checks).every(value => value === true))
    const mode = data.seedPurpose === 'confirmation' ? 'confirm' : 'sensitivity'
    const repeatedFollowup = run(snapshotFile, mode)
    assert.equal(repeatedFollowup.status, 0, repeatedFollowup.stderr)
    assert.equal(readFileSync(repeatFile, 'utf8'), readFileSync(path, 'utf8'), `${mode} results must repeat byte for byte`)
    const offset = mode === 'confirm' ? 32 : 0
    assert.deepEqual(data.seeds, Array.from({ length: 32 }, (_, i) => 1000 + (i + offset) * 7919))
    const selected = data.rows.filter(row => row.experiment === 'short-intro' && row.profile === 'learning-delay')
    assert.equal(selected.length, 6)
    assert(selected.filter(row => row.day <= 5).every(row => row.passRate >= 0.95))
    const firstDayBaseline = data.rows.find(row => row.experiment === 'current' && row.profile === 'learning-delay' && row.day === 1)
    assert(selected.find(row => row.day === 1).durationSec < firstDayBaseline.durationSec)
    assert.equal(selected.find(row => row.day === 1).restockTrips, 0)
    for (const profile of data.profiles) {
      const reference = data.rows.find(row => row.experiment === 'current' && row.day === 6 && row.profile === profile.name)
      for (const candidate of data.rows.filter(row => row.day === 6 && row.profile === profile.name)) {
        assert.deepEqual({ ...candidate, experiment: 'current', variant: 'current' }, reference)
      }
    }
    if (mode === 'sensitivity') for (const reference of result.rows.filter(row => row.day <= 6 && ['current', 'staged'].includes(row.variant))) {
      const candidate = data.rows.find(row => row.experiment === reference.variant && row.day === reference.day && row.profile === reference.profile)
      const { experiment, firstPaidServeSec, firstPaidServeMissing, washBatches, restockTrips, ...unchanged } = candidate
      assert.deepEqual(unchanged, reference, 'Instrumentation must not change the original simulation')
    }
  }
  if (followups.length === 2) assert(!followups[0].data.seeds.some(seed => followups[1].data.seeds.includes(seed)), 'Selection and confirmation seeds must be disjoint')

  const examples = [
    { name: 'ordinary', opening: 400, sales: 1600, tips: 160, grants: 600, ingredients: 480, rent: 600, utilities: 140, safety: 100, expectedTax: 44, expectedCash: 1396, expectedDebt: 0 },
    { name: 'skilled', opening: 400, sales: 2500, tips: 500, grants: 1200, ingredients: 750, rent: 600, utilities: 200, safety: 80, expectedTax: 137, expectedCash: 2833, expectedDebt: 0 },
    { name: 'failed', opening: 200, sales: 300, tips: 0, grants: 100, ingredients: 240, rent: 600, utilities: 80, safety: 100, expectedTax: 0, expectedCash: 0, expectedDebt: 420 },
  ]
  for (const item of examples) {
    const tax = Math.floor(Math.max(0, item.sales + item.tips - item.ingredients - item.rent - item.utilities - item.safety) * 0.1)
    const remaining = item.opening + item.sales + item.tips + item.grants - item.ingredients - item.rent - item.utilities - item.safety - tax
    assert.equal(tax, item.expectedTax)
    assert.equal(Math.max(0, remaining), item.expectedCash)
    assert.equal(Math.max(0, -remaining), item.expectedDebt)
  }
  assert.equal((6 * (10 - 3)) * 0.5 * 20, 420)
  assert.equal(examples[0].expectedCash - examples[0].grants, 796)
  assert.equal(examples[1].expectedCash - examples[1].grants, 1633)
  assert.equal(examples[2].expectedDebt + examples[2].grants, 520)
  const ordinaryBeforeBill = 400 + 1600 + 160 + 600 - 480
  const ordinaryBill = 600 + 140 + 100 + 44
  assert.equal(ordinaryBeforeBill, 2280)
  assert.equal((ordinaryBeforeBill - 300) - (ordinaryBill - 300), 1396)
  assert.equal((600 + 140 + 100) / (10 + 1 - 3), 105)
  assert.equal((600 + 140 + 100) / (10 - 3), 120)
  assert.equal((600 / 30) * (30 - 20), 200)
  console.log(JSON.stringify({ repeatable: true, invalidLayoutRejected: true, logicDriftRejected: true, simulationGates: true, sensitivityFilesVerified: followups.length,
    economicExampleArithmetic: true, economicValues: 'illustrative, pending calibration' }))
} finally {
  for (const file of [repeatFile, badFile]) if (existsSync(file)) unlinkSync(file)
}
