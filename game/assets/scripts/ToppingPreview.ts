import { _decorator, Component, instantiate, Node, Prefab } from 'cc'
import { BurgerStack, type StackArt } from './BurgerStack'

const { ccclass, property } = _decorator

/** Isolated art preview using the production stack, without game state or saves. */
@ccclass('ToppingPreview')
export class ToppingPreview extends Component {
  @property({ type: [Prefab] })
  models: Prefab[] = []

  override start(): void {
    const art: Record<string, Node> = {}
    for (const [i, name] of ['bread', 'meat', 'cheese', 'cabbage', 'tomato', 'plate', 'onion', 'pickle', 'bacon'].entries()) {
      const model = this.models[i]
      if (!model) {
        console.error(`[ToppingPreview] Missing source: ${name}`)
        for (const n of Object.values(art)) n.destroy()
        return
      }
      art[name] = instantiate(model)
    }
    const stack = new BurgerStack(this.node, art as unknown as StackArt)
    stack.node.setScale(2.2, 2.2, 2.2)
    stack.show({ ingredients: ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon'], cook: 'medium' }, true, -.4, 0, .4)
    for (const n of Object.values(art)) n.destroy()
  }
}
