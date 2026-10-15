import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const root = resolve('game/build'), directory = resolve(process.argv[2] || 'game/build/player-feedback-web')
if (!directory.startsWith(root + sep)) throw Error('Preview must be inside game/build')
const css = readFileSync('game/build-templates/web-desktop/style.css', 'utf8')
const hash = createHash('sha256').update(css).digest('hex').slice(0, 12)
const file = `preview-style-${hash}.css`, index = resolve(directory, 'index.html')
const html = readFileSync(index, 'utf8')
const pattern = /href="\.\/(?:style|preview-style-[a-f0-9]+)\.css"/
if (!pattern.test(html)) throw Error('Missing desktop stylesheet link')
const application = readFileSync(resolve(directory, 'application.js'), 'utf8')
if (!application.includes('this.showFPS = true;')) throw Error('Missing desktop profiler setting')
const playerApplication = application.replace('this.showFPS = true;', 'this.showFPS = false;')
const appHash = createHash('sha256').update(playerApplication).digest('hex').slice(0, 12)
const appFile = `preview-application-${appHash}.js`
const entry = readFileSync(resolve(directory, 'index.js'), 'utf8')
if (!entry.includes('./application.js')) throw Error('Missing desktop application import')
const playerEntry = entry.replace('./application.js', `./${appFile}`)
const entryHash = createHash('sha256').update(playerEntry).digest('hex').slice(0, 12), entryFile = `preview-index-${entryHash}.js`
const entryPattern = /System\.import\('\.\/(?:index|preview-index-[a-f0-9]+)\.js'\)/
if (!entryPattern.test(html)) throw Error('Missing desktop entry import')
writeFileSync(resolve(directory, file), css)
writeFileSync(resolve(directory, appFile), playerApplication)
writeFileSync(resolve(directory, entryFile), playerEntry)
writeFileSync(index, html.replace(pattern, `href="./${file}"`).replace(entryPattern, `System.import('./${entryFile}')`))
console.log(JSON.stringify({ directory, stylesheet: file, previewVersion: `${hash}-${entryHash}` }))
