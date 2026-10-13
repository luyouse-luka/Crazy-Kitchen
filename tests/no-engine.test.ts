import { describe, expect, it } from 'vitest'
// @ts-expect-error Node builtin: no @types/node in the engine-independent project.
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
// @ts-expect-error Node builtin.
import { tmpdir } from 'node:os'
// @ts-expect-error Node builtin.
import { join } from 'node:path'
// @ts-expect-error Node builtin.
import { execPath } from 'node:process'
// @ts-expect-error Node builtin.
import { spawnSync } from 'node:child_process'

function check(source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'kitchen-no-engine-'))
  const file = join(dir, 'logic.ts')
  try {
    writeFileSync(file, source)
    return spawnSync(execPath, ['tools/check-no-engine.mjs', dir], { encoding: 'utf8' })
  } finally {
    unlinkSync(file)
    rmdirSync(dir)
  }
}

describe('跨平台逻辑层引擎依赖闸门', () => {
  it('允许本地模块与纯 TypeScript', () => {
    const result = check("import { judge } from './order'\nexport const n = 1\n")
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('OK:')
  })

  it.each([
    "import { Node } from 'cc'",
    'import type { Node } from "cc"',
    "export { Node } from\n'cc'",
    "const engine = import('cc')",
  ])('拒绝引擎引用：%s', (source) => {
    const result = check(source)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('logic.ts')
  })
})
