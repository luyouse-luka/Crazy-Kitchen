import { _decorator, Component } from 'cc'
import { A7_MARKER, a7Lines } from './a7-check'

const { ccclass } = _decorator

/**
 * A7 layering probe. Drop this on any node in the scene, build, and compare the
 * devtools console against `pnpm a7`. Delete once A7 is signed off.
 */
@ccclass('A7Probe')
export class A7Probe extends Component {
  start(): void {
    for (const line of a7Lines()) console.log(line)
    console.log(`${A7_MARKER} DONE`)
  }
}
