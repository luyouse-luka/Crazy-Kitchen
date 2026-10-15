const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/12255/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
async function main() {
  const out = process.argv[3] || 'game/temp/integrated-verification'
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = [], failed = [], moves = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push(m.type() + ': ' + m.text()) })
  page.on('requestfailed', r => failed.push(r.url()))
  async function state() { return page.evaluate(() => ({ phase: sv.phase, pos: sv.movement.pos, carry: sv.kitchen.carry.kind, near: sv.actionVerb(), menu: sv.menuKind, editor: !!sv.layoutEditor, errors: sv.lastBlock })) }
  try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:4191')
    await page.waitForFunction(() => window.cc?.find('Canvas')?.getComponent('StationView')?.movement, null, { timeout: 60000 })
    await page.evaluate(async () => {
      window.E = await System.import('cc'); window.sv = cc.find('Canvas').getComponent('StationView'); E.profiler.hideStats()
      Object.assign(document.getElementById('GameDiv').style, { position: 'fixed', inset: '0', width: '100%', height: '100%' })
      E.screen.windowSize = new E.Size(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio); sv.syncScreen()
    })
    await page.waitForTimeout(300)
    assert.deepEqual(await page.evaluate(() => sv.progress.layout.stations.fridge), { x: 3.5, z: -2.5, quarterTurn: 0 })
    await page.screenshot({ path: path.join(out, 'entry.png') })
    async function zone(id) {
      const p = await page.evaluate(id => {
        const q = sv.router.zones.find(q => q.id === id); if (!q) throw Error('Missing zone ' + id)
        const canvas = document.querySelector('canvas').getBoundingClientRect()
        return { x: canvas.left + (q.x + q.w / 2) * canvas.width / sv.screenW, y: canvas.top + (sv.screenH - q.y - q.h / 2) * canvas.height / sv.screenH }
      }, id)
      await page.mouse.click(p.x, p.y); await page.waitForTimeout(110)
    }
    async function action() {
      const p = await page.evaluate(() => { const n = cc.find('Canvas/UI_ActionButton'), v = new E.Vec3(); n.getComponent(E.UITransform).convertToWorldSpaceAR(E.Vec3.ZERO, v); const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left + v.x * r.width / (sv.uiHalfW * 2), y: r.top + (sv.uiHalfH * 2 - v.y) * r.height / (sv.uiHalfH * 2) } })
      await page.mouse.click(p.x, p.y); await page.waitForTimeout(110)
    }
    async function walk(x, z) {
      const base = { x: 140, y: 540 }; await page.mouse.move(base.x, base.y); await page.mouse.down()
      let done = false
      try {
        const deadline = Date.now() + 12000
        while (Date.now() < deadline) {
          const q = await page.evaluate(({x,z}) => { const p=sv.movement.pos,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),c=Math.cos(sv.cameraYaw),s=Math.sin(sv.cameraYaw),k=d?Math.max(22,Math.min(70,d*130))/d:0;return{d,x:(dx*c-dz*s)*k,y:(dx*s+dz*c)*k} }, {x,z})
          if(q.d<.075){done=true;break} await page.mouse.move(base.x+q.x,base.y+q.y);await page.waitForTimeout(40)
        }
      } finally { await page.mouse.up() }
      moves.push({x,z,done}); assert(done, `walk ${x},${z}: ${JSON.stringify(await state())}`)
    }
    await walk(-3.4,2.1); await action(); await zone('row1'); assert.equal((await state()).phase,'rest')
    await action()
    const row = await page.evaluate(()=>sv.menuRows.findIndex(r=>r.name==='调整厨房布局'))
    assert(row>=0); await zone('row'+row); assert((await state()).editor)
    assert.equal(await page.evaluate(()=>sv.layoutEditor.buttons.length),5)
    assert(await page.evaluate(()=>cc.find('Canvas').getComponentsInChildren(E.Camera).some(c=>c.enabledInHierarchy)), 'Editor must retain a live UI camera')
    const frozen=await page.evaluate(()=>({t:sv.shift.t,pos:{...sv.movement.pos},grill:JSON.stringify(sv.kitchen.grill),day:sv.day}))
    async function editorButton(id) {
      const p=await page.evaluate(id=>{const b=sv.layoutEditor.buttons.find(b=>b.id===id),r=document.querySelector('canvas').getBoundingClientRect();return{x:r.left+(b.x+b.w/2)*r.width/(sv.uiHalfW*2),y:r.top+(sv.uiHalfH*2-b.y-b.h/2)*r.height/(sv.uiHalfH*2)}},id)
      await page.mouse.click(p.x,p.y);await page.waitForTimeout(120)
    }
    async function drag(id,x,z) {
      const coords=await page.evaluate(({id,x,z})=>{const pose=sv.layoutEditor.state.draft.stations[id],r=document.querySelector('canvas').getBoundingClientRect(),p=new E.Vec3(),q=new E.Vec3();sv.cameraComp.worldToScreen(new E.Vec3(pose.x,.7,pose.z),p);sv.cameraComp.worldToScreen(new E.Vec3(x,.7,z),q);const cv=v=>({x:r.left+v.x*r.width/sv.screenW,y:r.top+(sv.screenH-v.y)*r.height/sv.screenH});return{a:cv(p),b:cv(q)}},{id,x,z})
      await page.mouse.move(coords.a.x,coords.a.y);await page.mouse.down();await page.mouse.move(coords.b.x,coords.b.y,{steps:12});await page.mouse.up();await page.waitForTimeout(150)
      assert.equal(await page.evaluate(()=>sv.layoutEditor.state.selected),id)
    }
    const rawBefore = await page.evaluate(()=>localStorage.getItem('kc.progress'))
    await drag('assembly',6.25,-2.5); await editorButton('save'); assert((await state()).editor,'Blocked layout must not save')
    assert.equal(await page.evaluate(()=>localStorage.getItem('kc.progress')),rawBefore)
    await editorButton('undo'); await drag('fridge',4.5,-2.5)
    assert.equal(await page.evaluate(()=>sv.layoutEditor.state.history.length),1)
    await page.screenshot({path:path.join(out,'editor.png')})
    await page.waitForTimeout(300)
    assert.deepEqual(await page.evaluate(()=>({t:sv.shift.t,pos:{...sv.movement.pos},grill:JSON.stringify(sv.kitchen.grill),day:sv.day})),frozen)
    await editorButton('cancel'); assert.equal((await state()).editor,false)
    assert.deepEqual(await page.evaluate(()=>sv.progress.layout.stations.fridge),{x:3.5,z:-2.5,quarterTurn:0})
    await zone('menu-outside'); await action(); await zone('row'+row)
    await drag('fridge',4.5,-2.5)
    await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('verification quota failure')}})
    await editorButton('save');assert((await state()).editor,'Failed storage must keep the draft open')
    assert.equal(await page.evaluate(()=>sv.progress.layout.stations.fridge.x),3.5)
    await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;delete window.originalSetItem})
    await editorButton('save'); assert.equal((await state()).editor,false)
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kc.progress')).layout.stations.fridge.x),4.5)
    await page.reload(); await page.waitForFunction(()=>window.cc?.find('Canvas')?.getComponent('StationView')?.movement)
    await page.evaluate(async()=>{window.E=await System.import('cc');window.sv=cc.find('Canvas').getComponent('StationView');E.profiler.hideStats();Object.assign(document.getElementById('GameDiv').style,{position:'fixed',inset:'0',width:'100%',height:'100%'});E.screen.windowSize=new E.Size(innerWidth,innerHeight);sv.syncScreen()})
    assert.equal(await page.evaluate(()=>sv.kitchen.cfg.stations.find(s=>s.kind==='fridge').pos.x),4.5)
    await walk(-3.4,2.1);await action();await zone('row0');await page.waitForFunction(()=>sv.shift.flow.customers.some(c=>c.active&&!c.ordered&&c.orderWait>=sv.shift.flow.flow.takeOrder.walkInSec),null,{timeout:35000});await action()
    const spec=await page.evaluate(()=>sv.shift.flow.customers.find(c=>c.active&&c.ordered).spec)
    const ingredients=['bun','patty','cheese','lettuce','tomato','onion','pickle','bacon']
    async function fetch(i){await walk(4.5,-1.55);await action();if(i==='patty')await page.screenshot({path:path.join(out,'inventory.png')});await zone('slot'+ingredients.indexOf(i));if(await page.evaluate(()=>sv.panelOpen))await zone('panel-outside')}
    await fetch('patty');await walk(.5,-1.55);await action()
    await page.waitForFunction(level=>sv.kitchen.grill[0].elapsed>=sv.kitchen.cfg.cook[{rare:'rareAt',medium:'mediumAt',well:'wellAt'}[level]],spec.doneness);await action();await walk(-1.5,-1.55);await action()
    for(const i of spec.required.filter(i=>i!=='patty')){await fetch(i);await walk(-1.5,-1.55);await action()}
    await action();assert.equal((await state()).carry,'plate');await page.screenshot({path:path.join(out,'carrying.png')});await walk(-1,2.1);await action()
    assert.equal(await page.evaluate(()=>sv.shift.served),1);assert.equal(await page.evaluate(()=>sv.shift.wrong),0)
    assert.equal(await page.evaluate(()=>sv.firstOrderUi.guide.status),'done')
    await page.screenshot({path:path.join(out,'served.png')})
    await walk(6.4,.5);await page.waitForFunction(()=>sv.kitchen.dirty>0);await action();await page.waitForFunction(()=>sv.kitchen.sink.stage==='soaked')
    await page.mouse.move(1130,560);await page.mouse.down()
    try{await page.waitForFunction(()=>sv.kitchen.rack.count>0,null,{timeout:10000})}finally{await page.mouse.up()}
    await page.waitForFunction(()=>sv.kitchen.rack.ready>0);await walk(6.4,2);await action();assert.equal((await state()).carry,'stack')
    await walk(-2.5,1.5);await walk(-2.5,0);await action();assert.equal((await state()).carry,'none')
    await walk(6.25,-1.3);await walk(6.25,-4.5);await action();await zone('slot0');if(await page.evaluate(()=>sv.panelOpen))await zone('panel-outside')
    assert.equal((await state()).carry,'crate');await walk(6.25,-1.3);await walk(4.5,-1.55);await action();assert.equal((await state()).carry,'none')
    const lifecycle=await page.evaluate(async()=>{
      const root=cc.find('Kitchen'), count=()=>root.getComponentsInChildren(E.MeshRenderer).length
      const original=JSON.parse(JSON.stringify(sv.progress.layout));const base=count()
      const engineFrame=()=>new Promise(r=>E.director.once(E.Director.EVENT_AFTER_DRAW,r))
      for(let i=0;i<20;i++){const d=JSON.parse(JSON.stringify(original));d.stations.grill={x:0,z:0,quarterTurn:i%4};sv.applyLayout(d);await engineFrame()}
      sv.applyLayout(original);await engineFrame();await engineFrame()
      const all=n=>[n,...n.children.flatMap(all)],nodes=all(root)
      return{base,after:count(),pans:nodes.filter(n=>n.name.startsWith('CookingPan_')).length,effects:nodes.filter(n=>n.name==='WorkstationEffects').length,shadows:nodes.filter(n=>n.name==='LayoutContactShadows').length}
    })
    assert.equal(lifecycle.pans,2);assert.equal(lifecycle.effects,1);assert.equal(lifecycle.shadows,1);assert.equal(lifecycle.after,lifecycle.base)
    const viewports=[]
    await page.reload();await page.waitForFunction(()=>window.cc?.find('Canvas')?.getComponent('StationView')?.movement)
    await page.evaluate(async()=>{window.E=await System.import('cc');window.sv=cc.find('Canvas').getComponent('StationView');E.profiler.hideStats();Object.assign(document.getElementById('GameDiv').style,{position:'fixed',inset:'0',width:'100%',height:'100%'});E.screen.windowSize=new E.Size(innerWidth,innerHeight);sv.syncScreen()})
    await walk(-3.4,2.1);await action();await zone('row1');await action();await zone('row'+row)
    for(const [width,height] of [[1024,768],[1280,720],[1560,720],[780,360]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>{E.screen.windowSize=new E.Size(innerWidth,innerHeight);sv.syncScreen()});await page.waitForTimeout(180)
      await drag('fridge',4,-2.5);await editorButton('undo')
      const minButton=await page.evaluate(()=>Math.min(...sv.layoutEditor.buttons.map(b=>b.h*innerHeight/(sv.uiHalfH*2))))
      assert(minButton>=43.9,'Touch targets must remain at least 44 CSS pixels')
      await page.screenshot({path:path.join(out,`view-${width}x${height}.png`)});viewports.push({width,height,minButton})
    }
    await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{E.screen.windowSize=new E.Size(innerWidth,innerHeight);sv.syncScreen()});await page.waitForTimeout(150)
    const touch=await page.evaluate(()=>{
      const d=sv.layoutEditor.state.draft.stations.fridge,p=new E.Vec3();sv.cameraComp.worldToScreen(new E.Vec3(d.x,.7,d.z),p)
      const b=sv.layoutEditor.buttons.find(b=>b.id==='save')
      return{item:{x:p.x,y:sv.screenH-p.y},save:{x:b.x+b.w/2,y:sv.uiHalfH*2-b.y-b.h/2},before:JSON.stringify(sv.layoutEditor.state.draft)}
    })
    const cdp=await page.context().newCDPSession(page),one={id:1,x:touch.item.x,y:touch.item.y}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[one]})
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...one,x:one.x+30}]})
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...one,x:one.x+30},{id:2,x:touch.save.x,y:touch.save.y}]})
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(180)
    assert((await state()).editor,'Second finger must not save during a drag')
    assert.equal(await page.evaluate(()=>sv.layoutEditor.state.gesture),null)
    assert.equal(await page.evaluate(()=>JSON.stringify(sv.layoutEditor.state.draft)),touch.before)
    await page.evaluate(()=>{window.wx={getMenuButtonBoundingClientRect:()=>({left:innerWidth-150}),getSystemInfoSync:()=>({windowWidth:innerWidth})};sv.screenW=0;sv.syncScreen()})
    assert(await page.evaluate(()=>{const b=sv.layoutEditor.buttons.find(b=>b.id==='save');return b.x+b.w<=sv.uiHalfW*2-sv.capsuleRight()}),'Editor must reserve the simulated WeChat capsule area')
    await page.evaluate(()=>{delete window.wx;sv.screenW=0;sv.syncScreen()})
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[])
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({editor:true,blockedSave:true,storageFailure:true,undo:true,cancel:true,saveReload:true,frozen:true,multiTouchCancel:true,simulatedCapsule:true,served:1,wrong:0,wash:true,restock:true,lifecycle,viewports,moves,errors,failed},null,2))
    console.log('PASS editor, safety, persistence, real-input meal and guide completion')
  }catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({state:await state().catch(()=>null),errors,failed,message:String(e)},null,2));await page.screenshot({path:path.join(out,'failure.png')});throw e}finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
