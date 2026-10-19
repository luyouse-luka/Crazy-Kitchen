const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/12255/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
async function main() {
  const out = process.argv[3] || 'game/temp/player-feedback-verification'; fs.mkdirSync(out, {recursive:true})
  const browser = await chromium.launch({headless:true,channel:'msedge'}), page = await browser.newPage({viewport:{width:1280,height:720}})
  const errors=[],failed=[],moves=[],icons=[],throws=[]
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text())});page.on('requestfailed',r=>failed.push(r.url()))
  const snap=()=>page.evaluate(()=>({carry:{...sv.kitchen.carry},stock:[...sv.kitchen.stock],plates:sv.kitchen.plates,dirty:sv.kitchen.dirty,pos:{...sv.movement.pos},phase:sv.phase,items:JSON.parse(JSON.stringify(sv.looseItems.items))}))
  async function zone(id) {
    const p = await page.evaluate(id => {
      const q = sv.router.zones.find(z => z.id === id); if (!q) throw Error('Missing capture zone ' + id)
      const r = document.querySelector('canvas').getBoundingClientRect()
      return { x: r.left + (q.x + q.w / 2) * r.width / sv.screenW, y: r.top + (sv.screenH - q.y - q.h / 2) * r.height / sv.screenH }
    }, id)
    await page.mouse.click(p.x, p.y); await page.waitForTimeout(100)
  }
  async function button(name, hold = 0, during) {
    const p = await page.evaluate(name => {
      const n = cc.find('Canvas/' + name), v = new E.Vec3(), r = document.querySelector('canvas').getBoundingClientRect()
      n.getComponent(E.UITransform).convertToWorldSpaceAR(E.Vec3.ZERO, v)
      return { x: r.left + v.x * r.width / (sv.uiHalfW * 2), y: r.top + (sv.uiHalfH * 2 - v.y) * r.height / (sv.uiHalfH * 2) }
    }, name)
    await page.mouse.move(p.x, p.y); await page.mouse.down()
    try { await page.waitForTimeout(hold || 35); if (during) await during() } finally { await page.mouse.up() }
    await page.waitForTimeout(100)
  }
  const action = (hold = 0, during) => button('UI_ActionButton', hold, during)
  const aux = (hold = 0, during) => button('UI_DiscardButton', hold, during)
  async function walk(x, z) {
    const base = { x: 140, y: 540 }; await page.mouse.move(base.x, base.y); await page.mouse.down()
    let done = false
    try {
      const deadline = Date.now() + 12000
      while (Date.now() < deadline) {
        const q = await page.evaluate(({ x, z }) => { const p = sv.movement.pos, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), c = Math.cos(sv.cameraYaw), s = Math.sin(sv.cameraYaw), k = d ? Math.max(22, Math.min(70, d * 130)) / d : 0; return { d, x: (dx * c - dz * s) * k, y: (dx * s + dz * c) * k } }, { x, z })
        if (q.d < .075) { done = true; break }
        await page.mouse.move(base.x + q.x, base.y + q.y); await page.waitForTimeout(40)
      }
    } finally { await page.mouse.up() }
    moves.push({ x, z, done }); assert(done, `Cannot walk to ${x},${z}: ${JSON.stringify(await snap())}`)
  }
  async function fetch(...ingredients) {
    await walk(3.5, -1.55); await action()
    const names = ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon']
    for (const i of ingredients) { if (!await page.evaluate(() => sv.panelOpen)) break; await zone('slot' + names.indexOf(i)) }
    if (await page.evaluate(() => sv.panelOpen)) await zone('panel-outside')
  }
  const pose = () => page.evaluate(() => {
    const all = n => [n, ...n.children.flatMap(all)], nodes = all(sv.playerModel), bone = name => nodes.find(n => n.name === name)
    const q = name => { const r = bone(name).rotation; return [r.x, r.y, r.z, r.w] }
    const held = sv.chefActions.held[0].node
    return { moving: sv.movement.moving, yaw: sv.renderedYaw, targetYaw: sv.movement.facingYaw, leg: q('K_upperleg.l'), leftArm: q('K_upperarm.l'), rightArm: q('K_upperarm.r'),
      headY: bone('K_head').worldPosition.y, hand: { ...sv.chefActions.handAnchors[0] }, held: { ...held.worldPosition }, heldActive: held.active,
      bubble: sv.carryBubble.node.active, baked: sv.playerAnim.useBakedAnimation, hasEvaluator: !!sv.playerAnim.getState('walk')._clipEval }
  })
  const variation = (frames, key) => Math.max(...frames.map(f => 2 * Math.acos(Math.min(1, Math.abs(f[key].reduce((sum,v,i) => sum + v * frames[0][key][i], 0))))))
  async function recordWalk(name) {
    await page.mouse.move(140,540); await page.mouse.down(); await page.mouse.move(200,540)
    const frames=[]
    try { for(let i=0;i<12;i++){await page.waitForTimeout(45);frames.push(await pose());if(i===2||i===8)await page.screenshot({path:path.join(out,`${name}-${i}.png`)})} }
    finally {await page.mouse.up()}
    assert(frames.every(f=>!f.baked&&f.hasEvaluator));assert(variation(frames,'leg')>.02,'Walking must change actual leg bones')
    assert(variation(frames,'leftArm')>.02,'The free arm must swing with the real clip')
    assert(frames.every(f=>!f.bubble),'No held-food bubble may remain over the head')
    return {frames,legVariation:variation(frames,'leg'),leftArmVariation:variation(frames,'leftArm')}
  }
  async function rememberIcon(expected) {
    const data=await page.evaluate(()=>({key:sv.controls.actionShown,visibleText:cc.find('Canvas/UI_ActionButton').getComponentsInChildren(E.Label).filter(l=>l.enabledInHierarchy&&l.string).map(l=>l.string)}))
    assert.equal(data.key.split('|')[4],expected,`Expected icon ${expected}: ${data.key}`);assert.deepEqual(data.visibleText,[]);icons.push(data)
  }
  async function recordThrow(name, singleHand) {
    const before = await snap()
    await page.evaluate(() => {
      const all = n => [n, ...n.children.flatMap(all)], nodes = all(sv.playerModel)
      const bone = name => nodes.find(n => n.name === name)
      const q = name => { const r = bone(name).rotation; return [r.x, r.y, r.z, r.w] }
      window.throwFrames = []
      window.throwSample = () => {
        const m = sv.chefActions.motion
        throwFrames.push({ action: m.action, reach: m.reach, progress: m.throwProgress, singleHand: m.throwOneHanded,
          carry: sv.kitchen.carry.kind, items: sv.looseItems.items.length, aux: { ...sv.router.zone('discard') }, charge: sv.chefFrame.throwCharge,
          zones: sv.zonesKey, rightArm: q('K_upperarm.r'), leftArm: q('K_upperarm.l'),
          spine: q('K_spine'), hand: { ...sv.chefActions.handAnchors[0] } })
      }
      E.director.on(E.Director.EVENT_AFTER_DRAW, throwSample)
    })
    let frames
    try {
      await aux(35, async () => {
        await page.waitForFunction(count => sv.looseItems.items.length === count + 1, before.items.length, { timeout: 2000 })
        await page.screenshot({ path: path.join(out, `${name}-throw.png`) })
      })
      await page.waitForTimeout(320)
    } finally {
      await page.evaluate(() => E.director.off(E.Director.EVENT_AFTER_DRAW, throwSample))
      frames = await page.evaluate(() => throwFrames)
      throws.push({ name, singleHand, frames })
    }
    const windup = frames.filter(f => f.action === 'windup'), release = frames.filter(f => f.action === 'throw')
    assert(windup.length >= 2, 'A real auxiliary hold must visibly wind up')
    assert(windup.every(f => f.carry === before.carry.kind && f.items === before.items.length), 'Windup must keep food in hand')
    assert(release.length >= 2, 'A successful throw must play a follow-through')
    assert(release.every(f => f.carry === 'none' && f.singleHand === singleHand), 'Release must retain the original hand count')
    assert(variation([...windup, ...release], 'rightArm') > .08, 'Actual carrying-arm bones must move')
    assert(variation([...windup, ...release], 'spine') > .04, 'The torso must join the throw')
    if (!singleHand) assert(variation([...windup, ...release], 'leftArm') > .08, 'Both arms must move with a plated meal')
    assert.equal(await page.evaluate(() => sv.chefActions.motion.action), null)
    const after = await snap()
    assert.equal(after.items.length, before.items.length + 1)
    assert.deepEqual(after.items.at(-1).payload.carry, before.carry)
    assert.deepEqual(after.stock, before.stock); assert.equal(after.plates, before.plates); assert.equal(after.dirty, before.dirty)
  }
  try {
    await page.goto(process.argv[2]||'http://127.0.0.1:4193')
    await page.waitForFunction(()=>window.cc?.find('Canvas')?.getComponent('StationView')?.movement,null,{timeout:60000})
    await page.evaluate(async()=>{window.E=await System.import('cc');window.sv=cc.find('Canvas').getComponent('StationView');E.profiler.hideStats();Object.assign(document.getElementById('GameDiv').style,{position:'fixed',inset:'0',width:'100%',height:'100%'});E.screen.windowSize=new E.Size(innerWidth,innerHeight);sv.syncScreen()})
    await page.waitForTimeout(250)
    assert.equal(await page.evaluate(()=>sv.kitchen.cfg.singleItem),true)
    const emptyWalk=await recordWalk('empty-walk')
    await page.mouse.move(140,540);await page.mouse.down();await page.mouse.move(90,490);await page.waitForTimeout(120)
    const turning=[]
    for(let i=0;i<10;i++){turning.push(await pose());await page.waitForTimeout(20)}
    await page.mouse.move(190,590)
    for(let i=0;i<12;i++){turning.push(await pose());await page.waitForTimeout(20)}
    await page.mouse.up()
    const turnSteps=turning.slice(1).map((f,i)=>Math.abs(Math.atan2(Math.sin(f.yaw-turning[i].yaw),Math.cos(f.yaw-turning[i].yaw))))
    assert(Math.max(...turnSteps)<1.2,'Turning must not jump by 180 degrees')
    await walk(3.5,-1.55);await rememberIcon('fridge');await action();await zone('slot0')
    assert.equal(await page.evaluate(()=>sv.panelOpen),false);assert.equal((await snap()).carry.second,null)
    const single=await snap();await action();assert.equal(await page.evaluate(()=>sv.panelOpen),false);assert.deepEqual((await snap()).stock,single.stock);await rememberIcon('blocked')
    await walk(2,.2);const carryingWalk=await recordWalk('carry-walk')
    assert(carryingWalk.frames.every(f=>f.heldActive&&f.headY-f.held.y>.2),'Food must stay below the face')
    assert(carryingWalk.frames.every(f=>Math.hypot(f.held.x-f.hand.x,f.held.y-f.hand.y,f.held.z-f.hand.z)<.07),'One item must sit at the carrying palm')
    await walk(3,0);await aux();await rememberIcon('pick')
    assert(await page.evaluate(()=>sv.controls.secondaryGlyph.enabledInHierarchy&&sv.controls.secondaryHoldGlyph.enabledInHierarchy),'The ground cleanup hold must have a visible icon')
    await page.screenshot({path:path.join(out,'ground-icons.png')});await action();assert.deepEqual((await snap()).carry,single.carry)
    const beforeCancel = await snap()
    await aux(100, async () => { await page.mouse.move(30, 30) })
    assert.deepEqual((await snap()).carry, beforeCancel.carry); assert.equal((await snap()).items.length, 0)
    assert.equal(await page.evaluate(() => sv.chefActions.motion.action), null)
    await aux(100, async () => { await page.evaluate(() => E.game.emit(E.Game.EVENT_HIDE)) })
    await page.evaluate(() => E.game.emit(E.Game.EVENT_SHOW))
    assert.deepEqual((await snap()).carry, beforeCancel.carry); assert.equal((await snap()).items.length, 0)
    assert.equal(await page.evaluate(() => sv.chefActions.motion.action), null)
    await recordThrow('single-ingredient', true);await page.waitForFunction(()=>sv.looseItems.items.length===1&&!sv.looseItems.items[0].flying)
    const landing=(await snap()).items[0];await walk(landing.x,landing.z);await action(450);assert.equal((await snap()).items.length,0)
    await walk(-3.4,2.1);await rememberIcon('door');await action();await zone('row0')
    await page.waitForFunction(()=>sv.shift.flow.customers.some(c=>c.active&&!c.ordered&&c.orderWait>=sv.shift.flow.flow.takeOrder.walkInSec),null,{timeout:35000})
    await rememberIcon('order');await action()
    const spec=await page.evaluate(()=>sv.shift.flow.customers.find(c=>c.active&&c.ordered).spec)
    await fetch('patty');await walk(.5,-1.55);await rememberIcon('pan-in');await action()
    await page.waitForFunction(level=>sv.kitchen.grill[0].elapsed>=sv.kitchen.cfg.cook[{rare:'rareAt',medium:'mediumAt',well:'wellAt'}[level]],spec.doneness)
    await rememberIcon('pan-out');await action();await walk(-1.5,-1.55);await rememberIcon('assemble');await action()
    for(const i of spec.required.filter(i=>i!=='patty')){await fetch(i);assert.equal((await snap()).carry.second,null);await walk(-1.5,-1.55);await action()}
    await rememberIcon('burger');await action();await walk(2,0)
    const platedBurger = await snap()
    await recordThrow('plated-burger', false)
    await page.waitForFunction(()=>!sv.looseItems.items[0].flying)
    const burgerLanding=(await snap()).items[0];await walk(burgerLanding.x,burgerLanding.z);await action()
    assert.deepEqual((await snap()).burger,platedBurger.burger)
    await walk(-1,2.1);await rememberIcon('serve');await action()
    assert.equal(await page.evaluate(()=>sv.shift.served),1);assert.equal(await page.evaluate(()=>sv.shift.wrong),0)
    await walk(6.4,.5);await rememberIcon('wash');await page.waitForFunction(()=>sv.kitchen.dirty>0);await action();await page.waitForFunction(()=>sv.kitchen.sink.stage==='soaked');await rememberIcon('wash')
    await page.screenshot({path:path.join(out,'wash-icon.png')})
    await action(1600);await page.waitForFunction(()=>sv.kitchen.rack.ready>0);await walk(6.4,2);await rememberIcon('plate');await action();await walk(-2.5,1.5);await walk(-2.5,0);await action()
    const extras=await page.evaluate(async()=>{
      const before={...sv.kitchen.carry},checks=[]
      const frame=()=>new Promise(r=>E.director.once(E.Director.EVENT_AFTER_DRAW,r))
      for(const kind of ['fries','drink','crate','extinguisher']){
        sv.kitchen.carry.kind=kind;sv.syncNodes();await frame();await frame()
        const extra=sv.chefActions.extras.find(e=>e.kind===kind)
        checks.push({kind,visible:extra?.node.getComponentsInChildren(E.MeshRenderer).filter(r=>r.enabledInHierarchy).length??0,bubble:sv.carryBubble.node.active})
      }
      Object.assign(sv.kitchen.carry,before);sv.syncNodes();await frame();return checks
    })
    assert(extras.every(e=>e.visible>0&&!e.bubble),'Held meals and tools must have live geometry without overhead bubbles')
    const viewports=[]
    for(const[width,height]of[[1024,768],[1280,720],[1560,720],[780,360]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>{E.screen.windowSize=new E.Size(innerWidth,innerHeight);sv.syncScreen()});await page.waitForTimeout(160)
      const visibleText=await page.evaluate(()=>cc.find('Canvas/UI_ActionButton').getComponentsInChildren(E.Label).filter(l=>l.enabledInHierarchy&&l.string).map(l=>l.string))
      assert.deepEqual(visibleText,[]);await page.screenshot({path:path.join(out,`view-${width}x${height}.png`)});viewports.push({width,height,visibleText})
    }
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[])
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({emptyWalk,carryingWalk,turning,turnSteps,icons,throws,windupCancel:true,backgroundEventCancelDiagnostic:true,singleItem:true,dropPickThrow:true,served:1,wrong:0,wash:true,extrasDiagnostics:extras,viewports,moves,errors,failed},null,2))
    console.log('PASS live leg/arm animation, smooth turns, no overhead food, single-item ownership, contextual icons, drop-pick-throw and real meal/wash')
  } catch(error){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({state:await snap().catch(()=>null),throws,errors,failed,error:String(error)},null,2));throw error}
  finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
