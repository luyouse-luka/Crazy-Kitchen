const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

;(async () => {
  const out = process.argv[3] || 'game/temp/art-direction/verification'
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors=[], failed=[]
  page.on('pageerror', e=>errors.push(String(e)))
  page.on('console', m=>{if(['warning','error'].includes(m.type()))errors.push(m.type()+': '+m.text())})
  page.on('requestfailed', r=>failed.push(r.url()))
  try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:4180')
    await page.waitForFunction(()=>!!window.cc?.find('Canvas')?.getComponent('StationView')?.cutaway, null, {timeout:60000})
    await page.evaluate(async()=>{
      window.E=await System.import('cc');E.profiler.hideStats()
      window.sv=cc.find('Canvas').getComponent('StationView')
      Object.assign(document.getElementById('GameDiv').style,{position:'fixed',inset:'0',width:'100%',height:'100%'})
    })
    await page.waitForTimeout(800)
    await page.screenshot({path:out+'/kitchen.png'})
    const normal=await page.evaluate(()=>({drawCalls:E.director.root.device.numDrawCalls, triangles:E.director.root.device.numTris, shadows:E.director.getScene().globals.shadows.enabled}))
    assert.equal(normal.shadows,false,'Project prohibits realtime shadow maps')
    const boundaries=await page.evaluate(()=>{
      const garden=cc.find('Kitchen/BistroTerrace/RecessedGarden')
      const rail=cc.find('Kitchen/BistroTerrace/WalkableBoundary')
      if(!garden||!rail)throw Error('Walkable boundary scene anchors missing')
      const renderers=garden.getComponentsInChildren(E.MeshRenderer)
      return {railMeshes:rail.getComponentsInChildren(E.MeshRenderer).filter(r=>r.enabled&&r.mesh).length,
        gardenTop:Math.max(...renderers.map(r=>r.model.worldBounds.center.y+r.model.worldBounds.halfExtents.y)),
        oldGroundEnabled:cc.find('Kitchen/Floor_Outer').getComponent(E.MeshRenderer).enabled}
    })
    assert(boundaries.railMeshes>0,'Boundary mesh must be loaded and visible')
    assert(boundaries.gardenTop<-.34,'Garden must stay clearly below the walkable floor')
    assert.equal(boundaries.oldGroundEnabled,false,'Old coplanar background must not cover the recessed garden')
    const points=JSON.parse(fs.readFileSync('game/temp/art-direction/navigation.json','utf8'))
    const fade=await page.evaluate(points=>{
      sv.enabled=false
      const walls=sv.cutaway.walls
      const before=walls.map(w=>({name:w.node.name,position:[...Object.values(w.node.position)],scale:[...Object.values(w.node.scale)]}))
      const d=sv.cameraComp.node.forward.clone().multiplyScalar(-1)
      function intersects(b,p,y) {
        let near=0,far=Infinity
        for(const [o,dir,min,max] of [[p.x,d.x,b.minX,b.maxX],[y,d.y,b.minY,b.maxY],[p.z,d.z,b.minZ,b.maxZ]]) {
          if(Math.abs(dir)<1e-9){if(o<min||o>max)return false;continue}
          let a=(min-o)/dir,c=(max-o)/dir;if(a>c)[a,c]=[c,a]
          near=Math.max(near,a);far=Math.min(far,c);if(near>far)return false
        }
        return true
      }
      const p=points.find(p=>walls.some(w=>w.surfaces.length&&[.3,1.2].some(y=>intersects(w.box,p,y))))
      if(!p)throw Error('No reachable occluded point found')
      sv.movement.pos.x=p.x;sv.movement.pos.z=p.z;sv.playerNode.setPosition(p.x,0,p.z)
      for(let i=0;i<20;i++)sv.cutaway.update(p.x,p.z,1/60)
      const faded=walls.filter(w=>w.k<1).map(w=>({name:w.node.name,opacity:w.k,surfaces:w.surfaces.map(s=>({alpha:s.renderer.getRenderMaterial(s.slot).getProperty('mainColor').a,depthWrite:s.renderer.getRenderMaterial(s.slot).passes[0].depthStencilState.depthWrite}))}))
      const after=walls.map(w=>({name:w.node.name,position:[...Object.values(w.node.position)],scale:[...Object.values(w.node.scale)]}))
      const f=sv.cameraComp.node.forward
      sv.cameraComp.node.setWorldPosition(p.x-f.x*20,.5-f.y*20,p.z-f.z*20);sv.cameraComp.orthoHeight=3
      return {point:p,before,after,faded}
    },points)
    assert(fade.faded.length>0,'Fade positive anchor')
    assert.deepEqual(fade.after,fade.before,'Walls must never sink, scale or move')
    for(const w of fade.faded){assert.equal(w.opacity,.22);assert(w.surfaces.length>0);for(const s of w.surfaces){assert.equal(s.alpha,56);assert.equal(s.depthWrite,false)}}
    await page.waitForTimeout(200)
    await page.screenshot({path:out+'/wall-fade.png'})
    const restored=await page.evaluate(()=>{
      for(let i=0;i<20;i++)sv.cutaway.update(0,1.55,1/60)
      return sv.cutaway.walls.map(w=>({name:w.node.name,k:w.k,alpha:w.surfaces.map(s=>s.renderer.getRenderMaterial(s.slot).getProperty('mainColor').a)}))
    })
    for(const w of restored){assert.equal(w.k,1);for(const a of w.alpha)assert.equal(a,255)}
    const recolor=await page.evaluate(()=>{
      sv.progress.decor.wall=2;sv.progress.decor.floor=2;sv.applyDecor();sv.cutaway.update(0,1.55,1/60)
      return {wall:sv.wallRenderers.filter(m=>m.enabled).map(m=>m.material.getProperty('mainColor').toHEX()),floor:sv.floorRenderers.filter(m=>m.enabled).map(m=>m.material.getProperty('mainColor').toHEX())}
    })
    assert(recolor.wall.length>0&&recolor.floor.length>0,'Decor must reach the visible model surfaces')
    assert(recolor.wall.every(c=>c.startsWith('c8e6d7')))
    assert(recolor.floor.every(c=>c.startsWith('b9cde1')))
    await page.evaluate(()=>{
      sv.progress.decor.wall=0;sv.progress.decor.floor=0;sv.applyDecor()
      sv.movement.pos.x=0;sv.movement.pos.z=1.55;sv.playerNode.setPosition(0,0,1.55)
      for(const key of Object.values(sv))if(key?.hide&&key?.follow)key.hide()
      const camera=sv.cameraComp,f=camera.node.forward
      camera.node.setWorldPosition(2-f.x*24,.2-f.y*24,.2-f.z*24);camera.orthoHeight=7.3
    })
    await page.waitForTimeout(250)
    await page.screenshot({path:out+'/overview.png'})
    for(const [name,x,z] of [['west-edge',-3.65,1.55],['east-front-edge',6.25,3.25]]) {
      await page.evaluate(({x,z})=>{
        sv.movement.pos.x=x;sv.movement.pos.z=z;sv.playerNode.setPosition(x,0,z)
        for(let i=0;i<20;i++)sv.cutaway.update(x,z,1/60)
        const c=sv.cameraComp,f=c.node.forward
        c.node.setWorldPosition(x-f.x*20,.5-f.y*20,z-f.z*20);c.orthoHeight=3.6
      },{x,z})
      await page.waitForTimeout(200)
      await page.screenshot({path:out+'/'+name+'.png'})
    }
    const aspects=[]
    for(const [width,height] of [[960,720],[1560,720]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(250)
      await page.evaluate(({width,height})=>{
        Object.assign(document.getElementById('GameDiv').style,{width:width+'px',height:height+'px'})
        E.screen.windowSize=new E.Size(width*devicePixelRatio,height*devicePixelRatio)
        sv.enabled=true;sv.syncScreen()
      },{width,height})
      await page.waitForTimeout(1400)
      aspects.push(await page.evaluate(()=>({aspect:sv.cameraComp.camera.aspect,height:sv.cameraComp.orthoHeight})))
      await page.screenshot({path:out+`/aspect-${width}.png`})
    }
    assert(Math.abs(aspects[0].aspect-4/3)<.001)
    assert(Math.abs(aspects[1].aspect-1560/720)<.001)
    assert(aspects[0].height>aspects[1].height,'Camera adapts to the viewport width')
    const result={normal,boundaries,fade,restored,recolor,aspects,errors,failed}
    fs.writeFileSync(out+'/direction-result.json',JSON.stringify(result,null,2)+'\n')
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[])
    console.log(JSON.stringify({normal,boundaries,fadePoint:fade.point,faded:fade.faded,aspects,errors,failed}))
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
