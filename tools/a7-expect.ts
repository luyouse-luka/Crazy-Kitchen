/**
 * A7 expected output. `pnpm a7`
 *
 * Prints exactly what A7Probe must print inside the WeChat build. Not game code,
 * so Node globals are declared locally the same way sim-cli.ts does them.
 */
import { A7_MARKER, a7Lines } from '../game/assets/scripts/a7-check'

declare const console: { log(...args: unknown[]): void }

for (const line of a7Lines()) console.log(line)
console.log(`${A7_MARKER} DONE`)
