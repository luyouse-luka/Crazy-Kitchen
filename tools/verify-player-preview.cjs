const assert = require('node:assert/strict'), fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/12255/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
;(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage(),checks=[]
  try{
    for(const[width,height]of[[587,652],[1280,720],[780,360]]){
      await page.setViewportSize({width,height});await page.goto(process.argv[2]||'http://127.0.0.1:4193')
      await page.waitForFunction(()=>window.cc?.find('Canvas')?.getComponent('StationView')?.movement)
      const data=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,canvas:{x:r.x,y:r.y,w:r.width,h:r.height},headerVisible:getComputedStyle(document.querySelector('.header')).display!=='none',profilerVisible:cc.profiler.isShowingStats()}})
      assert(data.scrollWidth<=width+1&&data.scrollHeight<=height+1,'The embedded preview must not scroll or clip the canvas')
      assert(Math.abs(data.canvas.w-width)<2&&Math.abs(data.canvas.h-height)<2,'The preview must fill its actual window without injected CSS')
      assert.equal(data.headerVisible,false);assert.equal(data.profilerVisible,false,'A player preview must hide the debug overlay');checks.push(data)
    }
    fs.writeFileSync(process.argv[3]||'game/temp/player-preview-result.json',JSON.stringify(checks,null,2));console.log('PASS unmodified preview CSS at 587x652, 1280x720 and 780x360')
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
