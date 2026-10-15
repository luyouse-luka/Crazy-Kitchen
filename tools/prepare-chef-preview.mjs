import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'game/temp/chef-preview')
const project = path.join(out, 'project')
const changes = []
fs.mkdirSync(project, { recursive: true })
for (const part of ['assets', 'settings', 'build-templates', 'package.json', 'tsconfig.json']) {
  const src = path.join(root, 'game', part)
  if (fs.existsSync(src)) fs.cpSync(src, path.join(project, part), { recursive: true })
}

function patch(file, edit) {
  const original = path.join(root, 'game', file), target = path.join(project, file)
  let text = fs.readFileSync(original, 'utf8').replaceAll('\r\n', '\n')
  const replace = (from, to) => {
    if (text.split(from).length !== 2) throw Error(`Expected one integration anchor: ${file}: ${from.slice(0, 70)}`)
    text = text.replace(from, to)
  }
  edit(replace, (from, to, count) => {
    if (text.split(from).length !== count + 1) throw Error(`Unexpected shared-source revision: ${file}: ${from}`)
    text = text.replaceAll(from, to)
  })
  fs.writeFileSync(target, text)
  changes.push({ path: `game/${file}`, sha256: crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex') })
  const diff = spawnSync('git', ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--ignore-space-at-eol', '--', original, target], { encoding: 'utf8' })
  if (![0, 1].includes(diff.status)) throw Error(diff.stderr)
  const lines = diff.stdout.replaceAll('\r\n', '\n').split('\n')
  const first = lines.findIndex(l => l.startsWith('@@'))
  return `diff --git a/game/${file} b/game/${file}\n--- a/game/${file}\n+++ b/game/${file}\n` + lines.slice(first).join('\n')
}

let diff = patch('assets/scripts/StationView.ts', (replace, all) => {
  replace("import { BurgerStack }", "import { ChefActions } from './ChefActions'\nimport { BurgerStack }")
  replace('  private playerAnim: SkeletalAnimation | null = null', `  private playerAnim: SkeletalAnimation | null = null
  private chefActions: ChefActions | null = null
  private chefFrame = { running: false, moving: false, carrying: false, scrubbing: false, holding: false, sinkInReach: false }`)
  replace('    for (const n of Object.values(toppings)) n.destroy()', `    this.chefActions = this.playerModel!.addComponent(ChefActions)
    this.chefActions.configure(this.playerModel!, kitchenRoot.scene, {
      ...art as { [K in keyof typeof art]: Node }, ...toppings,
    }, {
      fries: find('Prop_Fryer/fries'),
      drink: find('Prop_Drinks/cup'),
    })
    this.chefActions.bindBurger(this.burgerStack)
    for (const n of Object.values(toppings)) n.destroy()`)
  all('interact(this.kitchen, this.movement.pos, station', 'this.interactAt(station', 7)
  replace('  private act(r: InteractResult, hint?: string): void {', `  private interactAt(station: Station, options?: Parameters<typeof interact>[3]): InteractResult {
    const k = this.kitchen
    const result = interact(k, this.movement.pos, station, options)
    let target = this.workstationEffects?.actionTarget(station.kind, Math.max(0, result.slot)) ?? null
    if (station.kind === 'assembly') {
      const plate = this.playerNode.scene.getChildByPath('Kitchen/Props/Prop_AssemblyPlate/plate')
      target = plate ? new Vec3(plate.worldPosition.x, this.benchTopY, plate.worldPosition.z) : null
    }
    if (!target) {
      const m = this.movement.pos, dx = m.x - station.pos.x, dz = m.z - station.pos.z
      target = new Vec3(station.pos.x + Math.sign(dx) * Math.min(Math.abs(dx), station.box.halfX), .82,
        station.pos.z + Math.sign(dz) * Math.min(Math.abs(dz), station.box.halfZ))
    }
    this.chefActions?.notify(result.kind, target)
    if (result.kind !== 'blocked') this.movement.facingYaw = Math.atan2(target.x - this.movement.pos.x, target.z - this.movement.pos.z)
    return result
  }

  private act(r: InteractResult, hint?: string): void {`)
  replace("    const s = SFX_FOR[r.kind]", "    if (r.kind === 'discard') this.chefActions?.notify('discard', null)\n    const s = SFX_FOR[r.kind]")
  replace('    this.syncBubbles()\n    this.syncCustomers()', `    const frame = this.chefFrame
    frame.running = this.phase === 'open' && !this.resultOpen
    frame.moving = this.movement.moving
    frame.carrying = this.kitchen.carry.kind !== 'none'
    frame.scrubbing = this.scrubbing && this.kitchen.sink.stage === 'soaked'
    frame.holding = this.router.action.holding && !this.panelOpen && !this.reviewsOpen && !this.menuKind
    frame.sinkInReach = stationInReach(this.kitchen, this.movement.pos)?.kind === 'sink'
    this.chefActions?.sync(this.kitchen, frame, game.deltaTime, this.workstationEffects?.actionTarget('sink') ?? null)
    this.syncBubbles()
    this.syncCustomers()`)
  replace('        bs.show(burger, k.burgerPlated, m.x + Math.sin(yaw) * HAND.reach, HAND.y, m.z + Math.cos(yaw) * HAND.reach)', `        const anchor = this.chefActions?.carryAnchor
        bs.show(burger, k.burgerPlated, anchor?.x ?? m.x + Math.sin(yaw) * HAND.reach,
          anchor?.y ?? HAND.y, anchor?.z ?? m.z + Math.cos(yaw) * HAND.reach)`)
  all('    this.workstationEffects?.hide()', '    this.workstationEffects?.hide()\n    this.chefActions?.reset()', 2)
  replace('    this.workstationEffects?.destroy()', '    this.workstationEffects?.destroy()\n    this.chefActions?.destroy()')
  replace('  private onTouchCancel(): void {', '  private onTouchCancel(): void {\n    this.chefActions?.reset()')
})

diff += patch('assets/scripts/WorkstationEffects.ts', (replace) => {
  replace("import { Color,", "import { PattyVisual } from './PattyVisual'\nimport type { StationKind } from '../logic/types'\nimport { Color,")
  replace('  private pans: Node[] = []', '  private pans: Node[] = []\n  private patties: PattyVisual[] = []\n  private scrubTarget!: Vec3')
  replace("    this.basin = anchor('Prop_Sink_0', 'kitchenSink', 0, 1.27, -.08)", "    this.basin = anchor('Prop_Sink_0', 'kitchenSink', 0, 1.27, -.08)\n    this.scrubTarget = new Vec3(this.basin.x, this.basin.y + .055, this.basin.z)")
  replace("    this.node = new Node('WorkstationEffects')", `    this.patties = this.grill.map(p => {
      const patty = PattyVisual.create(parent, .34, .032)
      patty.node.setWorldPosition(p.x, p.y + .06, p.z)
      patty.node.active = false
      return patty
    })
    this.node = new Node('WorkstationEffects')`)
  replace('  hide(): void { this.node.active = false }', `  hide(): void {
    this.node.active = false
    for (const patty of this.patties) patty.node.active = false
  }

  actionTarget(kind: StationKind, slot = 0): Vec3 | null {
    if (kind === 'sink') return this.scrubTarget
    const p = kind === 'grill' ? this.grill[slot] : kind === 'drinks' ? this.drinks : kind === 'fryer' ? this.fryer : kind === 'rack' ? this.rack : null
    return p ? new Vec3(p.x, p.y + (kind === 'grill' ? .065 : 0), p.z) : null
  }`)
  replace('        this.box(p.x + Math.sin(t * 24) * .10, p.y + .044, p.z + Math.cos(t * 12) * .055, .095, .04, .055, SPONGE)\n', '')
  replace('      if (!slot?.busy && !k.fire) continue', `      const visual = this.patties[i]!
      visual.node.active = !!slot?.busy
      if (slot?.busy) visual.setCook(grillCookLevel(k, i))
      if (!slot?.busy && !k.fire) continue`)
  replace(`      if (slot?.busy) {
        this.disc(p.x, p.y + .06, p.z, .17, .032, burnt ? BURNT : slot.elapsed < k.cfg.cook.rareAt ? RAW : COOKED)
        for (let j = -1; j <= 1; j++) this.box(p.x + j * .065, p.y + .078, p.z, .017, .003, .22, BURNT)
      }`, '')
  replace('      this.puffs(p, t, burnt || k.fire ? SMOKE : STEAM, k.fire ? .95 : .48, 6)', '      if (!burnt || k.fire) this.puffs(p, t, k.fire ? SMOKE : STEAM, k.fire ? .95 : .48, 6)')
  replace('    for (const pan of this.pans) pan.destroy()', '    for (const pan of this.pans) pan.destroy()\n    for (const patty of this.patties) patty.node.destroy()')
  for (const line of ["const RAW: Tint = [.65, .17, .11, 1]\n", "const COOKED: Tint = [.28, .09, .035, 1]\n", "const BURNT: Tint = [.045, .032, .025, 1]\n", "const SPONGE: Tint = [.95, .75, .07, 1]\n"]) replace(line, '')
})

fs.writeFileSync(path.join(root, 'docs/chef-actions-public.patch'), diff)
fs.writeFileSync(path.join(out, 'baseline.json'), JSON.stringify({ baseline: '88b51c3', project, publicSources: changes }, null, 2))
fs.writeFileSync(path.join(out, 'tsconfig-check.json'), JSON.stringify({ extends: '../../../tsconfig.json', include: ['project/assets/**/*.ts', '../../../types/**/*.ts'] }, null, 2))
const config = JSON.parse(fs.readFileSync(path.join(root, 'tools/build-wechat.json')))
for (const [platform, name] of [['web-desktop', 'chef-actions-web'], ['wechatgame', 'chef-actions-wechat']]) {
  const c = { ...config, platform, outputName: name, buildPath: path.join(out, 'build').replaceAll('\\', '/') }
  if (platform === 'web-desktop') { c.debug = true; c.mainBundleCompressionType = 'merge_dep' }
  fs.writeFileSync(path.join(out, `${platform}.json`), JSON.stringify(c, null, 2))
}
console.log(JSON.stringify({ project, patch: 'docs/chef-actions-public.patch', publicSources: changes }, null, 2))
