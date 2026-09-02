import { defineConfig } from 'vitest/config'

// logic/ 住在 game/assets/ 里（Cocos 只编译 assets 下的脚本，见 ROADMAP §3.1），
// 但它零引擎依赖，所以 vitest 直接跑同一批 .ts 源文件，不需要任何中间编译步骤。
// 测试本身必须留在 assets/ 之外：Cocos 编译 assets 下的每一个 .ts，测试 import
// vitest / ajv / assets 外的 json，三样它都解析不了，构建会直接失败（2026-09-02 实测）。
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // 铁律②的内存测试要能主动触发 GC，否则读到的 heapUsed 全是 GC 时机的噪声
    pool: 'forks',
    poolOptions: { forks: { execArgv: ['--expose-gc'] } },
  },
  // game/tsconfig.json extends ./temp/tsconfig.cocos.json, which the editor generates and
  // .gitignore excludes, so a fresh clone has no temp/ and vite's lookup throws.
  // Must be a string: vite only skips the on-disk lookup when tsconfigRaw is one.
  esbuild: { tsconfigRaw: '{"compilerOptions":{"target":"es2020"}}' },
})
