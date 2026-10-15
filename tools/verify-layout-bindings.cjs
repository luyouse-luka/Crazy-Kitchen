const assert=require('node:assert/strict')
const fs=require('node:fs')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/12255/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
;(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage();try{
  await page.goto(process.argv[2]||'http://127.0.0.1:4191');await page.waitForFunction(()=>window.cc?.find('Canvas')?.getComponent('StationView')?.movement)
  const result=await page.evaluate(async()=>{
    const E=await System.import('cc'),sv=cc.find('Canvas').getComponent('StationView'),d=JSON.parse(JSON.stringify(sv.progress.layout))
    const bag=cc.find('Kitchen/Props/Prop_Serve/bag_delivery/bag'),before=bag.worldPosition.clone()
    d.stations.serve.x+=1.5;sv.applyLayout(d);const serveError=E.Vec3.distance(before,bag.worldPosition)
    d.stations.drinks={x:0,z:0,quarterTurn:1};sv.applyLayout(d)
    const host=cc.find('Kitchen/Station_Drinks'),model=host.children.find(n=>n.name!=='Body')
    const desired=E.Vec3.transformMat4(new E.Vec3(),new E.Vec3(0,.582,.055),model.worldMatrix)
    const drinkError=E.Vec3.distance(desired,sv.workstationEffects.actionTarget('drinks'))
    return{serveError,drinkError}
  })
  fs.writeFileSync('game/temp/layout-bindings-result.json',JSON.stringify(result));console.log(result)
  assert(result.serveError<1e-5,'Moving serve must not move delivery mesh')
  assert(result.drinkError<1e-5,'Rotated drink target must follow actual model')
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
