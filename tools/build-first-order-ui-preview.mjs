import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import './ensure-cocos-tsconfig.mjs'
const require = createRequire(import.meta.url)
const viteRequire = createRequire(createRequire(require.resolve('vite-node')).resolve('vite'))
const { build } = viteRequire('esbuild')
await mkdir(new URL('../game/temp/', import.meta.url), { recursive: true })
await build({
  entryPoints: [new URL('./first-order-ui-preview-adapter.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
  outfile: new URL('../game/temp/first-order-ui-preview.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  bundle: true, format: 'iife', globalName: 'FirstOrderPreview', target: 'es2020',
  plugins: [{ name: 'existing-cocos-engine', setup(build) {
    build.onResolve({ filter: /^cc$/ }, () => ({ path: 'cc', namespace: 'runtime' }))
    build.onLoad({ filter: /.*/, namespace: 'runtime' }, () => ({ contents: 'module.exports = globalThis.E', loader: 'js' }))
  } }],
})
console.log('Built the exact UI sources for runtime preview; this is not a Cocos release build.')
