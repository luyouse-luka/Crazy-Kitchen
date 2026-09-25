import { AudioClip, AudioSource, Node, resources } from 'cc'

/** File names under assets/resources/sfx (tools/gen-sfx.py) */
export type SfxName =
  | 'pick'
  | 'drop'
  | 'trash'
  | 'serve'
  | 'wrong'
  | 'deny'
  | 'burnt'
  | 'crash'
  | 'ding'
  | 'tap'
  | 'scrub'
  | 'ready'
  | 'result'

/**
 * One-shot sound effects, loaded from the resources bundle so no scene wiring is needed.
 * Sound is never load-bearing: a missing bundle or clip just stays silent.
 */
export class Sfx {
  private src: AudioSource
  private clips = new Map<string, AudioClip>()

  constructor(host: Node) {
    this.src = host.addComponent(AudioSource)
    if (!resources) {
      console.warn('[Sfx] no resources bundle — muted')
      return
    }
    resources.loadDir('sfx', AudioClip, (err, list) => {
      if (err) {
        console.warn(`[Sfx] load failed — muted: ${err.message}`)
        return
      }
      for (const c of list) this.clips.set(c.name, c)
    })
  }

  play(name: SfxName, volume = 1): void {
    const c = this.clips.get(name)
    if (c) this.src.playOneShot(c, volume)
  }
}
