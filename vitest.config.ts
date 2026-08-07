import { defineConfig } from 'vitest/config'

// logic/ 住在 game/assets/ 里（Cocos 只编译 assets 下的脚本，见 ROADMAP §3.1），
// 但它零引擎依赖，所以 vitest 直接跑同一批 .ts 源文件，不需要任何中间编译步骤。
export default defineConfig({
  test: {
    include: ['game/assets/logic/**/__tests__/**/*.test.ts'],
    environment: 'node',
    // 铁律②的内存测试要能主动触发 GC，否则读到的 heapUsed 全是 GC 时机的噪声
    pool: 'forks',
    poolOptions: { forks: { execArgv: ['--expose-gc'] } },
  },
})
