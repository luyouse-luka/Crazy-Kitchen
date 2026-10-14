import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const read = path => JSON.parse(readFileSync(path, 'utf8'))
const file = 'game/assets/main.scene', scene = read(file)
const config = read('tools/art-direction.json')
const dir = 'game/assets/art/restaurant/'
const library = uuid => read(`game/library/${uuid.slice(0, 2)}/${uuid}.json`)
const v3 = (x, y, z) => ({ __type__: 'cc.Vec3', x, y, z })
const quat = (pitch, yaw) => {
  const x = pitch*Math.PI/360, y = yaw*Math.PI/360
  return { __type__: 'cc.Quat', x: Math.sin(x)*Math.cos(y), y: Math.cos(x)*Math.sin(y), z: -Math.sin(x)*Math.sin(y), w: Math.cos(x)*Math.cos(y) }
}
const find = name => scene.findIndex(n => n.__type__ === 'cc.Node' && n._name === name)
const compress = hex => {
  const b64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  return hex.slice(0,2)+hex.slice(2).match(/.{3}/g).map(v=>{const n=parseInt(v,16);return b64[n>>6]+b64[n&63]}).join('')
}
const idFor = key => compress(createHash('sha256').update('art-direction:'+key).digest('hex').slice(0,32))
const node = (name, parent, pos=[0,0,0], scale=[1,1,1], yaw=0) => {
  const id = scene.length
  scene.push({__type__:'cc.Node',_name:name,_objFlags:0,__editorExtras__:{artDirection:true},_parent:{__id__:parent},_children:[],_active:true,_components:[],_prefab:null,_lpos:v3(...pos),_lrot:quat(0,yaw),_lscale:v3(...scale),_mobility:0,_layer:scene[parent]._layer,_euler:v3(0,yaw,0),_id:idFor(name)})
  scene[parent]._children.push({__id__:id})
  return id
}
function model(key, target) {
  const meta = read(dir+key+'.glb.meta'), data = library(meta.userData.assetFinder.scenes[0])
  const root = data[0].data.__id__, offset = scene.length
  const rewrite = value => {
    if (!value || typeof value !== 'object') return value
    if (typeof value.__id__ === 'number') return {__id__:value.__id__===root?target:value.__id__+offset}
    if (Array.isArray(value)) return value.map(rewrite)
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]))
  }
  const copies = data.map((entry, index) => {
    const n = rewrite(entry)
    if (n.__type__ === 'cc.Node') n._prefab = null
    if ('__prefab' in n) n.__prefab = null
    if ('_id' in n) n._id = idFor(scene[target]._name+':'+index)
    if (n._mesh) { n._shadowCastingMode=1; n._shadowReceivingMode=1 }
    return n
  })
  scene[target]._children=copies[root]._children
  scene[target]._components=copies[root]._components
  scene.push(...copies)
}

// Remove only previously generated branches; gameplay nodes keep their identities.
for (const n of scene) if (n._children) n._children=n._children.filter(r=>!scene[r.__id__].__editorExtras__?.artDirection)
const kitchen = find('Kitchen')
for (const [name,key] of config.floors) {
  const parent=find(name), s=scene[parent]._lscale
  for (const r of scene[parent]._components) if (scene[r.__id__]._mesh) scene[r.__id__]._enabled=false
  const target=node('Tiles_'+name,parent,[0,.5,0],[1/s.x,1/s.y,1/s.z])
  model(key,target)
}
for (const parent of scene.map((n,i)=>n.__type__==='cc.Node'&&n._name.startsWith('Wall_')?i:-1).filter(i=>i>=0)) {
  for (const r of scene[parent]._components) if (scene[r.__id__]._mesh) scene[r.__id__]._enabled=false
  const name=scene[parent]._name
  const count=name==='Wall_N'?3:name==='Wall_E'?3:1
  for(let i=0;i<count;i++) {
    const alongZ=scene[parent]._lscale.z>scene[parent]._lscale.x
    const position=alongZ?[0,-.5,(i+.5)/count-.5]:[(i+.5)/count-.5,-.5,0]
    const scale=alongZ?[2,.25,1/(4*count)]:[1/(4*count),.25,2]
    const target=node('Panel_'+name+'_'+i,parent,position,scale,alongZ?90:0)
    // Scale before rotation is in the model's local axes.
    if(alongZ) scene[target]._lscale=v3(1/(4*count),.25,2)
    model(name==='Wall_N'&&i===1?'wall-window':'wall-panel',target)
  }
}
const outside=node('BistroTerrace',kitchen)
for(const r of scene[find('Floor_Outer')]._components)if(scene[r.__id__]._mesh)scene[r.__id__]._enabled=false
model('floor-terrace',node('RecessedGarden',outside))
model('site-boundaries',node('WalkableBoundary',outside))
model('contact-shadows',node('ContactShadows',kitchen,[0,.004,0]))
const shadowRoot=find('Shadow')
for(const r of scene[shadowRoot]._components)if(scene[r.__id__]._mesh)scene[r.__id__]._enabled=false
model('actor-shadow',node('ActorContactShadow',shadowRoot,[0,0,0],[10,1,10]))
config.furniture.forEach(([key,x,y,z,yaw,size],i)=>model(key,node('Terrace_'+key+'_'+i,outside,[x,y,z],[size,size,size],yaw)))

const camera=scene[find('Main Camera')], {pitch,yaw,distance}=config.camera
camera._lrot=quat(pitch,yaw);camera._euler=v3(pitch,yaw,0)
const p=pitch*Math.PI/180,y=yaw*Math.PI/180
camera._lpos=v3(Math.sin(y)*Math.cos(p)*distance,-Math.sin(p)*distance,Math.cos(y)*Math.cos(p)*distance)
const light=scene[find('Main Light')], lighting=config.lighting
light._lrot=quat(lighting.pitch,lighting.yaw);light._euler=v3(lighting.pitch,lighting.yaw,0)
light._lpos=v3(-5,16,8)
const sun=scene.find(n=>n.__type__==='cc.DirectionalLight')
Object.assign(sun,{_illuminanceLDR:lighting.illuminance,_shadowEnabled:false,_shadowPcf:2,_shadowBias:.001,_shadowNormalBias:.025,_shadowSaturation:.65,_shadowDistance:40,_csmLevel:1,_shadowFixedArea:true,_shadowNear:.1,_shadowFar:40,_shadowOrthoSize:22})
const ambient=scene.find(n=>n.__type__==='cc.AmbientInfo')
ambient._skyColorLDR={__type__:'cc.Vec4',x:.94,y:.97,z:1,w:1};ambient._skyIllumLDR=lighting.ambient
ambient._groundAlbedoLDR={__type__:'cc.Vec4',x:.55,y:.49,z:.42,w:1}
const shadows=scene.find(n=>n.__type__==='cc.ShadowsInfo')
Object.assign(shadows,{_enabled:false,_type:1,_size:{__type__:'cc.Vec2',x:1024,y:1024}})
for(const n of scene) {
  if(n._mesh) {n._shadowCastingMode=0;n._shadowReceivingMode=1}
  if(n.__type__==='cc.Node'&&n._name==='Shadow') n._active=true
}
// Keep the duplicate receiver cubes disabled and the ground out of the shadow caster pass.
for(const n of scene.filter(n=>n.__type__==='cc.Node'&&(n._name.startsWith('Floor')||n._name==='Shadow')))
  for(const r of n._components) if(scene[r.__id__]._mesh) scene[r.__id__]._shadowCastingMode=0

const used=new Set([0])
function mark(value) {
  if(!value||typeof value!=='object')return
  if(typeof value.__id__==='number') {if(!used.has(value.__id__)){used.add(value.__id__);mark(scene[value.__id__])}}
  else for(const v of Object.values(value))mark(v)
}
mark(scene[0])
const ids=[...used].sort((a,b)=>a-b), remap=new Map(ids.map((v,i)=>[v,i]))
function rewrite(value) {
  if(!value||typeof value!=='object')return value
  if(typeof value.__id__==='number')return {__id__:remap.get(value.__id__)}
  if(Array.isArray(value))return value.map(rewrite)
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]))
}
const output=ids.map(i=>rewrite(scene[i]))
for(const n of output)if(/^[0-9a-f]{32}$/.test(n._id??''))n._id=compress(n._id)
writeFileSync(file,JSON.stringify(output,null,2)+'\n')
console.log(`Art direction applied: ${config.floors.length} batched floors, model walls, ${config.furniture.length} exterior props, camera and lighting.`)
