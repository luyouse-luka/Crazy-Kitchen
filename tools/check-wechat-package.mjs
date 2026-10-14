import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MAIN_LIMIT = 4 * 1024 * 1024
export const SAFE_LIMIT = 3891 * 1024
export const TOTAL_LIMIT = 30 * 1024 * 1024

export function summarizePackages(files, declarations = []) {
  const packages = declarations.map(entry => {
    const root = entry.root.replaceAll('\\', '/').replace(/\/$/, '')
    if (!root || root.startsWith('/') || root.split('/').some(p => !p || p === '.' || p === '..') || root.includes(':')) {
      throw Error(`Invalid subpackage root: ${entry.root}`)
    }
    return { name: entry.name ?? root, root, bytes: 0, files: 0 }
  })
  for (const [i, a] of packages.entries()) {
    if (packages.slice(i + 1).some(b => a.root === b.root || a.root.startsWith(b.root + '/') || b.root.startsWith(a.root + '/'))) {
      throw Error(`Overlapping subpackage root: ${a.root}`)
    }
  }
  const main = { bytes: 0, files: 0 }
  for (const file of files) {
    const target = packages.find(p => file.path.startsWith(p.root + '/')) ?? main
    target.bytes += file.bytes
    target.files++
  }
  for (const p of packages) if (!p.files) throw Error(`Empty or missing subpackage: ${p.root}`)
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0)
  return { main, subpackages: packages, totalBytes, mainLimit: MAIN_LIMIT, safeLimit: SAFE_LIMIT,
    totalLimit: TOTAL_LIMIT, withinBudget: main.bytes <= MAIN_LIMIT && totalBytes <= TOTAL_LIMIT,
    withinSafetyMargin: main.bytes <= SAFE_LIMIT }
}

export function inspectWechatPackage(directory) {
  const root = resolve(directory)
  const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
  const game = read('game.json')
  const settings = read('src/settings.json')
  read('project.config.json')
  const files = []
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile()) files.push({ path: relative(root, path).replaceAll('\\', '/'), bytes: statSync(path).size })
    }
  }
  walk(root)
  for (const path of ['game.js', 'application.js', 'cocos-js/cc.js']) {
    if (!files.some(f => f.path === path && f.bytes > 0)) throw Error(`Missing startup file: ${path}`)
  }
  const report = summarizePackages(files, game.subpackages ?? [])
  const declared = new Set(report.subpackages.map(p => p.name))
  const engineNames = settings.assets.subpackages ?? []
  if (declared.size !== engineNames.length || engineNames.some(name => !declared.has(name))) {
    throw Error('game.json and engine subpackage declarations do not match')
  }
  for (const p of report.subpackages) {
    const config = read(p.root + '/config.json')
    if (config.name !== p.name) throw Error(`Bundle name mismatch: ${p.root}`)
  }
  return { ...report, orientation: game.deviceOrientation, launchScene: settings.launch.launchScene,
    remoteBundles: settings.assets.remoteBundles, debug: settings.engine.debug }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const directory = process.argv[2] ?? 'game/build/kitchen-chaos-wechat-optimized-20261014'
    const report = inspectWechatPackage(directory)
    console.log(JSON.stringify(report, null, 2))
    if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n')
    if (!report.withinBudget) process.exitCode = 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
