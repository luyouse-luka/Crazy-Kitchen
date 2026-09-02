/**
 * game/tsconfig.json extends ./temp/tsconfig.cocos.json, which Cocos Creator generates
 * and .gitignore excludes. On a machine without the editor (the server) vite's tsconfig
 * lookup throws before any of our code runs, so pnpm sim / pnpm a7 die on a fresh clone.
 *
 * Write a minimal stand-in only when it is missing — the editor's own copy always wins.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const dir = new URL('../game/temp/', import.meta.url)
const file = new URL('tsconfig.cocos.json', dir)

if (!existsSync(file)) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2015',
          module: 'ES2015',
          moduleResolution: 'node',
          experimentalDecorators: true,
          useDefineForClassFields: false,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
        },
      },
      null,
      2,
    )}\n`,
  )
  console.log('wrote stand-in game/temp/tsconfig.cocos.json (editor copy will replace it)')
}
