import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? 'game/assets/logic'
const engine = /\b(?:from\s*|import\s*\(|require\s*\()\s*['"]cc['"]/
let failed = false
for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.ts')) continue
  const file = join(entry.parentPath, entry.name)
  if (!engine.test(readFileSync(file, 'utf8'))) continue
  console.error(`Engine dependency: ${file}`)
  failed = true
}
if (failed) process.exitCode = 1
else console.log('OK: logic/ 零引擎依赖')
