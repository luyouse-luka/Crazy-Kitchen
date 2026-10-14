"""Batch original KayKit floor modules into one mesh per decorated area."""
import copy
import json
import math
from pathlib import Path
from PIL import Image
from gltf_assets import load, bounds, matrix, mul, IDENTITY, accessor, append_accessor, pack


def build_floors(cache, out):
    source = cache / 'kaykit/KayKit-Restaurant-Bits-1.0-main/addons/kaykit_restaurant_bits/Assets/gltf/floor_kitchen.gltf'
    original, buffers = load(source)
    image = Image.open(next(source.parent.parent.rglob('restaurantbits_texture.png'))).convert('RGB')
    def linear(v):
        v /= 255
        return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
    lo, hi = bounds(original)
    parts = []
    def visit(i, parent):
        n = original['nodes'][i]
        transform = mul(parent, matrix(n))
        if 'mesh' in n:
            for primitive in original['meshes'][n['mesh']]['primitives']:
                parts.append((primitive, transform))
        for child in n.get('children', []):
            visit(child, transform)
    for i in original['scenes'][original.get('scene', 0)]['nodes']:
        visit(i, IDENTITY)
    # Dimensions follow the gameplay floors; these meshes add no collision.
    areas = [('floor-main', 9, 6.6, 9, 6), ('floor-east', 3, 6.6, 3, 6),
             ('floor-store', 3, 3, 3, 3), ('floor-customer', 9, 3, 9, 3)]
    report = []
    for name, width, depth, nx, nz in areas:
        vertices, normals, colors, indices = [], [], [], []
        dark, light = ((194,167,130),(226,206,173)) if name == 'floor-customer' else ((176,194,182),(238,232,211))
        sx, sy, sz = width / nx / (hi[0]-lo[0]), .04/(hi[1]-lo[1]), depth/nz/(hi[2]-lo[2])
        for x in range(nx):
            for z in range(nz):
                for primitive, transform in parts:
                    start = len(vertices)
                    for p in accessor(original, buffers, primitive['attributes']['POSITION']):
                        p = p + [1]
                        v = [sum(transform[r][k]*p[k] for k in range(4)) for r in range(3)]
                        vertices.append([(v[0]-lo[0])*sx-width/2+x*width/nx,
                                         (v[1]-hi[1])*sy, (v[2]-lo[2])*sz-depth/2+z*depth/nz])
                    for n in accessor(original, buffers, primitive['attributes']['NORMAL']):
                        # Source modules use a rotation and uniform scale. Apply inverse scale after rotation.
                        v = [sum(transform[r][k]*n[k] for k in range(3))/s for r,s in enumerate([sx,sy,sz])]
                        length = sum(k*k for k in v)**.5
                        normals.append([k/length for k in v])
                    for u,v in accessor(original, buffers, primitive['attributes']['TEXCOORD_0']):
                        rgb=image.getpixel((min(image.width-1,max(0,int(u*image.width))), min(image.height-1,max(0,int(v*image.height)))))
                        t=sum(rgb)/765
                        colors.append([*[linear(dark[k]*(1-t)+light[k]*t) for k in range(3)],1])
                    indices.extend([[int(row[0])+start] for row in accessor(original, buffers, primitive['indices'])])
        j = {k: copy.deepcopy(original[k]) for k in ['asset','materials','textures','images','samplers'] if k in original}
        j['materials']=[{'name':'SoftTilePalette','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'roughnessFactor':.95,'metallicFactor':0}}]
        for key in ['images','textures','samplers']: j.pop(key,None)
        j.update(accessors=[],bufferViews=[],buffers=[],nodes=[{'name':name,'mesh':0}],scenes=[{'nodes':[0]}],scene=0)
        data=[]
        attrs = {key:append_accessor(j,data,rows,typ) for key,rows,typ in [('POSITION',vertices,'VEC3'),('NORMAL',normals,'VEC3'),('COLOR_0',colors,'VEC4')]}
        index = append_accessor(j,data,indices,'SCALAR',5125)
        j['meshes']=[{'primitives':[{'attributes':attrs,'indices':index,'material':0}]}]
        pack(j,data,out/(name+'.glb'),unlit=False)
        report.append({'name':name,'collection':'restaurant','source':'floor_kitchen','size':[width,.04,depth],'modules':nx*nz})
    report.extend(build_site(out))
    report.extend(build_shadows(out))
    return report


def build_site(out):
    config=json.loads((Path(__file__).parent/'art-direction.json').read_text())
    scene=json.loads((Path(__file__).resolve().parents[1]/'game/assets/main.scene').read_text())
    floors={n['_name']:n for n in scene if n.get('_name') in dict(config['floors'])}
    report=[]
    for name in ['floor-terrace','site-boundaries']:
        vertices=[];normals=[];colors=[];indices=[]
        def face(points,rgb):
            a,b,c=points[:3]
            u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
            n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            length=sum(k*k for k in n)**.5
            if length<1e-10:return
            color=[((c/255)/12.92 if c/255<=.04045 else ((c/255+.055)/1.055)**2.4) for c in rgb]+[1]
            start=len(vertices)
            vertices.extend(points);normals.extend([[k/length for k in n]]*len(points));colors.extend([color]*len(points))
            for i in range(1,len(points)-1):indices.extend([[start],[start+i],[start+i+1]])
        def box(x,z,width,depth,bottom,top,rgb,bevel=.035):
            hx=width/2;hz=depth/2;b=min(bevel,hx/3,hz/3,(top-bottom)/3)
            def ring(y,inset):
                w=hx-inset;d=hz-inset;c=min(.04,w/3,d/3)
                return [[x+u,y,z+v] for u,v in [(-w+c,-d),(w-c,-d),(w,-d+c),(w,d-c),(w-c,d),(-w+c,d),(-w,d-c),(-w,-d+c)]]
            rings=[ring(bottom,0),ring(top-b,0),ring(top,b)]
            for low,high in zip(rings,rings[1:]):
                for i in range(8):face([low[i],high[i],high[(i+1)%8],low[(i+1)%8]],rgb)
            face(list(reversed(rings[-1])),rgb)
        if name=='floor-terrace':
            box(3,0,30,26,-.6,-.38,[119,153,110])
            for x,z,w,d in [(.2,-4.7,8.5,2.6),(-5.2,.2,1.3,6.5),(9.3,.4,1.4,10),(1,7.9,12,1.4)]:
                box(x,z,w,d,-.38,-.35,[133,164,119],.025)
        else:
            # Fascia follows the existing floors; none of these meshes adds a collision body.
            for floor in floors.values():
                p=floor['_lpos'];s=floor['_lscale']
                box(p['x'],p['z'],s['x'],s['z'],-.38,-.042,[170,143,111])
            # Public deck supports the existing NPC entry/exit positions, outside the chef's bounds.
            for x,w in [(-4.95,1.9),(6.2,2.4)]:
                box(x,5.1,w,3,-.38,0,[203,177,137])
            for x,w in [(-4.95,1.9),(6.2,2.4)]:
                for i in range(1,12):box(x,3.6+i*.25,w,.012,-.008,.002,[174,141,104],.002)
            for edge in config['boundaries']:
                x,z,w,d=edge['footprint']
                box(x,z,w,d,-.34,.12,[231,218,183])
                box(x,z,w-.035,d-.035,.12,.18,[75,124,112],.015)
                along_x=w>d
                length=max(w,d);count=max(1,math.ceil(length/1.2))
                for i in range(count+1):
                    offset=(i/count-.5)*(length-.16)
                    box(x+offset*along_x,z+offset*(not along_x),.13,.13,.16,.65,[229,216,181],.025)
                box(x,z,w if along_x else .08,.08 if along_x else d,.43,.51,[92,135,120],.02)
            for x,z,w,d in [(.1,-4.75,7.8,1.5),(-5.2,-.4,.65,4.8),(9.3,-.6,.8,7)]:
                box(x,z,w,d,-.36,-.15,[181,158,117])
                box(x,z,w-.13,d-.13,-.15,-.1,[78,118,83])
        j={'asset':{'version':'2.0'},'materials':[{'name':'Garden' if name=='floor-terrace' else 'SiteTrim','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.95}}],
           'accessors':[],'bufferViews':[],'buffers':[],'nodes':[{'name':name,'mesh':0}],'scenes':[{'nodes':[0]}],'scene':0}
        data=[]
        attrs={key:append_accessor(j,data,rows,typ) for key,rows,typ in [('POSITION',vertices,'VEC3'),('NORMAL',normals,'VEC3'),('COLOR_0',colors,'VEC4')]}
        index=append_accessor(j,data,indices,'SCALAR',5125)
        j['meshes']=[{'primitives':[{'attributes':attrs,'indices':index,'material':0}]}]
        pack(j,data,out/(name+'.glb'),unlit=False)
        report.append({'name':name,'collection':'project','source':'procedural recessed garden and floor-aligned platform edging','groundY':-.38,'barriers':config['boundaries'] if name=='site-boundaries' else []})
    return report


def build_shadows(out):
    # Static contact shadows are batched; the chef's ellipse follows its existing Shadow node.
    config=json.loads((Path(__file__).parent/'art-direction.json').read_text())
    boxes=[(-3.5,-1.25,1,3.5),(-2,-2.5,2,1),(0,-2.5,2,1),(1.5,-2.5,1,1),(2.5,-2.5,1,1),(3.5,-2.5,1,1),
           (-2.5,0,1,1),(-1.5,0,1,1),(0,0,2,1),(-2.75,3.1,3.5,1),(0,3.1,2,1),(2.25,3.1,2.5,1),
           (4.5,-.5,1,1),(7.5,.5,1,2),(7.5,2,1,1),(6.5,-5.5,1,1)]
    boxes.extend((.5+x,6.15,.9,.75) for x in [-2.4,-.8,.8,2.4])
    boxes=[(*b,0) for b in boxes]
    boxes.extend((x,z,.9*size,.9*size,y) for _,x,y,z,_,size in config['furniture'])
    report=[]
    for name,footprints in [('contact-shadows',boxes),('actor-shadow',[(0,0,1,1,0)])]:
        vertices=[];colors=[];indices=[]
        for x,z,width,depth,y in footprints:
            start=len(vertices)
            for radius,alpha in [(0,.22),(.68,.17),(1,0)]:
                for i in range(24):
                    angle=i*math.tau/24
                    vertices.append([x+math.cos(angle)*width*.62*radius,y,z+math.sin(angle)*depth*.68*radius])
                    colors.append([.16,.13,.10,alpha])
            for ring in range(2):
                for i in range(24):
                    a=start+ring*24+i;b=start+ring*24+(i+1)%24;c=a+24;d=b+24
                    indices.extend([[a],[c],[b],[b],[c],[d]])
        j={'asset':{'version':'2.0'},'materials':[{'name':'ContactShadow','alphaMode':'BLEND','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':1}}],
           'accessors':[],'bufferViews':[],'buffers':[],'nodes':[{'name':name,'mesh':0}],'scenes':[{'nodes':[0]}],'scene':0}
        data=[]
        attrs={key:append_accessor(j,data,rows,typ) for key,rows,typ in [('POSITION',vertices,'VEC3'),('COLOR_0',colors,'VEC4')]}
        index=append_accessor(j,data,indices,'SCALAR',5125)
        j['meshes']=[{'primitives':[{'attributes':attrs,'indices':index,'material':0}]}]
        pack(j,data,out/(name+'.glb'))
        report.append({'name':name,'collection':'project','source':'procedural feathered contact ellipses','ellipses':len(footprints)})
    return report
