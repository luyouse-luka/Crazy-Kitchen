"""Small glTF helpers shared by the deterministic asset importers."""
import base64
import copy
import json
import math
import struct

def mul(a, b):
    return [[sum(a[r][k] * b[k][c] for k in range(4)) for c in range(4)] for r in range(4)]


def qm(a, b):
    x,y,z,w = a; X,Y,Z,W = b
    return [w*X+x*W+y*Z-z*Y, w*Y-x*Z+y*W+z*X, w*Z+x*Y-y*X+z*W, w*W-x*X-y*Y-z*Z]


def qi(q):
    return [-q[0], -q[1], -q[2], q[3]]


def matrix(n):
    if 'matrix' in n:
        a = n['matrix']; return [[a[c*4+r] for c in range(4)] for r in range(4)]
    x,y,z,w = n.get('rotation', [0,0,0,1]); s = n.get('scale', [1,1,1]); t = n.get('translation', [0,0,0])
    m = [[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w,t[0]], [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w,t[1]], [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y,t[2]], [0,0,0,1]]
    for r in range(3):
        for c in range(3): m[r][c] *= s[c]
    return m


IDENTITY = matrix({})


def bounds(j):
    lo = [math.inf]*3; hi = [-math.inf]*3
    def visit(i, parent):
        n = j['nodes'][i]; m = mul(parent, matrix(n))
        if 'mesh' in n:
            for p in j['meshes'][n['mesh']]['primitives']:
                a = j['accessors'][p['attributes']['POSITION']]
                for corner in range(8):
                    v = [a['max' if corner & (1 << k) else 'min'][k] for k in range(3)] + [1]
                    for r in range(3):
                        value = sum(m[r][k]*v[k] for k in range(4)); lo[r] = min(lo[r], value); hi[r] = max(hi[r], value)
        for c in n.get('children', []): visit(c, m)
    for i in j['scenes'][j.get('scene',0)]['nodes']: visit(i, IDENTITY)
    return lo, hi


def load(path):
    if path.suffix == '.glb':
        payload = path.read_bytes()
        length = struct.unpack_from('<I', payload, 12)[0]
        return json.loads(payload[20:20+length]), [payload[28+length:]]
    j = json.loads(path.read_text()); buffers = []
    for b in j['buffers']:
        u = b['uri']; buffers.append(base64.b64decode(u.split(',',1)[1]) if u.startswith('data:') else (path.parent/u).read_bytes())
    return j, buffers


def accessor(j, buffers, i):
    a=j['accessors'][i]; v=j['bufferViews'][a['bufferView']]
    count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
    size=struct.calcsize('<'+fmt*count); offset=v.get('byteOffset',0)+a.get('byteOffset',0)
    return [list(struct.unpack_from('<'+fmt*count,buffers[v.get('buffer',0)],offset+k*v.get('byteStride',size))) for k in range(a['count'])]


def append_accessor(j, buffers, rows, typ, component=5126):
    width=len(rows[0]);fmt={5126:'f',5125:'I',5123:'H'}[component];payload=struct.pack('<'+fmt*(len(rows)*width),*[v for row in rows for v in row])
    vi=len(j['bufferViews']); j['bufferViews'].append({'buffer':len(buffers),'byteOffset':0,'byteLength':len(payload)})
    buffers.append(payload); ai=len(j['accessors'])
    j['accessors'].append({'bufferView':vi,'componentType':component,'count':len(rows),'type':typ,'min':[min(r[k] for r in rows) for k in range(width)],'max':[max(r[k] for r in rows) for k in range(width)]})
    return ai


def pack(j, buffers, path, unlit=True):
    used=set()
    for mesh in j['meshes']:
        for p in mesh['primitives']:
            used.update(p['attributes'].values())
            if 'indices' in p: used.add(p['indices'])
    for skin in j.get('skins',[]): used.add(skin['inverseBindMatrices'])
    for a in j.get('animations',[]):
        for s in a['samplers']: used.update([s['input'],s['output']])
    remap={old:new for new,old in enumerate(sorted(used))}; blob=bytearray(); acc=[]; views=[]; dedup={}
    for old in sorted(used):
        a=copy.deepcopy(j['accessors'][old]); v=copy.deepcopy(j['bufferViews'][a['bufferView']]); data=buffers[v.get('buffer',0)][v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
        blob.extend(b'\0'*(-len(blob)%4)); v['buffer']=0
        if data not in dedup:dedup[data]=len(blob);blob.extend(data)
        v['byteOffset']=dedup[data];a['bufferView']=len(views);views.append(v);acc.append(a)
    for mesh in j['meshes']:
        for p in mesh['primitives']:
            p['attributes']={k:remap[v] for k,v in p['attributes'].items()}
            if 'indices' in p:p['indices']=remap[p['indices']]
    for skin in j.get('skins',[]):skin['inverseBindMatrices']=remap[skin['inverseBindMatrices']]
    for a in j.get('animations',[]):
        for s in a['samplers']:
            for k in ['input','output']:s[k]=remap[s[k]]
    j['accessors']=acc;j['bufferViews']=views;j['buffers']=[{'byteLength':len(blob)}]
    if unlit:
        j['extensionsUsed']=sorted(set(j.get('extensionsUsed',[])+['KHR_materials_unlit']))
        for m in j['materials']:m.setdefault('extensions',{})['KHR_materials_unlit']={}
    data=json.dumps(j,separators=(',',':')).encode();data+=b' '*(-len(data)%4);blob.extend(b'\0'*(-len(blob)%4))
    path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(data)+len(blob))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(blob),0x004e4942)+blob)
