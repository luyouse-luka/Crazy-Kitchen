"""Adapt official KayKit Adventurers Free 2.0 to the restaurant actor contract."""
import copy
import io
import math
from pathlib import Path

from PIL import Image
from gltf_assets import accessor, append_accessor, bounds, load, matrix, mul, pack, qi, qm, IDENTITY
from fetch_adventurers import SHA256, URL

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'game/temp/adventurers/source/KayKit_Adventurers_2.0_FREE'
OUT = ROOT / 'game/assets/art/restaurant'
SCALE = .875 / 2.178328037261963


def normalized(v):
    length = math.sqrt(sum(x*x for x in v))
    return [x/length for x in v]


def between(a, b):
    a, b = normalized(a), normalized(b)
    dot = sum(x*y for x, y in zip(a, b))
    if dot < -.99999:
        return [1, 0, 0, 0]
    return normalized([a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0], 1+dot])


def transforms(nodes):
    parents = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    matrices, rotations = {}, {}
    def visit(i):
        if i in matrices:
            return
        p = parents.get(i)
        if p is not None:
            visit(p)
        matrices[i] = mul(matrices[p] if p is not None else IDENTITY, matrix(nodes[i]))
        rotations[i] = qm(rotations[p] if p is not None else [0, 0, 0, 1], nodes[i].get('rotation', [0, 0, 0, 1]))
    for i in range(len(nodes)):
        visit(i)
    return parents, matrices, rotations


def animate(j, buffers):
    names = {n['name']: i for i, n in enumerate(j['nodes'])}
    animations = []
    for file, source_name, name in [('General', 'Idle_A', 'idle'), ('MovementBasic', 'Walking_A', 'walk')]:
        source, data = load(SOURCE / f'Animations/gltf/Rig_Medium/Rig_Medium_{file}.glb')
        original = next(a for a in source['animations'] if a['name'] == source_name)
        animation = {'name': name, 'channels': [], 'samplers': []}
        for channel in original['channels']:
            bone = source['nodes'][channel['target']['node']]['name']
            if bone not in names:
                raise ValueError(f'Missing animation bone {bone}')
            sampler = original['samplers'][channel['sampler']]
            times = accessor(source, data, sampler['input'])
            values = accessor(source, data, sampler['output'])
            if all(row == values[0] for row in values):
                times, values = [times[0], times[-1]], [values[0], values[-1]]
            animation['channels'].append({'sampler': len(animation['samplers']), 'target': {'node': names[bone], 'path': channel['target']['path']}})
            animation['samplers'].append({'input': append_accessor(j, buffers, times, 'SCALAR'),
                                         'output': append_accessor(j, buffers, values, source['accessors'][sampler['output']]['type']),
                                         'interpolation': sampler.get('interpolation', 'LINEAR')})
        animations.append(animation)

    # Author the seated pose in world space so different bone orders share the same seat height.
    pose = copy.deepcopy(j['nodes'])
    for channel in animations[0]['channels']:
        sampler = animations[0]['samplers'][channel['sampler']]
        pose[channel['target']['node']][channel['target']['path']] = accessor(j, buffers, sampler['output'])[0]
    def point(m, i):
        return [m[i][r][3] for r in range(3)]
    def aim(bone, child, direction):
        parents, matrices, rotations = transforms(pose)
        i, c = names[bone], names[child]
        start, end = point(matrices, i), point(matrices, c)
        delta = between([end[k]-start[k] for k in range(3)], direction)
        pose[i]['rotation'] = qm(qi(rotations[parents[i]]), qm(delta, rotations[i]))
    for side in ['l', 'r']:
        aim('upperleg.'+side, 'lowerleg.'+side, [0, 0, 1])
        aim('lowerleg.'+side, 'foot.'+side, [0, -1, 0])
        aim('foot.'+side, 'toes.'+side, [0, 0, 1])
    _, matrices, _ = transforms(pose)
    pose[names['hips']]['translation'][1] -= matrices[names['upperleg.l']][1][3]
    seated = {'name': 'sit', 'channels': [], 'samplers': []}
    time = append_accessor(j, buffers, [[0], [1]], 'SCALAR')
    for i in j['skins'][0]['joints']:
        for key, typ, default in [('translation', 'VEC3', [0, 0, 0]), ('rotation', 'VEC4', [0, 0, 0, 1]), ('scale', 'VEC3', [1, 1, 1])]:
            value = pose[i].get(key, default)
            seated['channels'].append({'sampler': len(seated['samplers']), 'target': {'node': i, 'path': key}})
            seated['samplers'].append({'input': time, 'output': append_accessor(j, buffers, [value, value], typ), 'interpolation': 'LINEAR'})
    j['animations'] = animations + [seated]


def mesh(j, buffers, chef=False):
    view = j['bufferViews'][j['images'][0]['bufferView']]
    image = Image.open(io.BytesIO(buffers[view.get('buffer', 0)][view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']])).convert('RGB')
    arrays = {key: [] for key in ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0', 'COLOR_0']}
    indices, mesh_nodes = [], []
    head_top = 0
    def linear(value):
        return value/12.92 if value <= .04045 else ((value+.055)/1.055)**2.4
    for node in j['nodes']:
        if 'mesh' not in node:
            continue
        mesh_nodes.append(node)
        name = node['name']
        excluded = name.endswith('_Quiver') or (chef and name.endswith('_Cape'))
        if not excluded:
            for primitive in j['meshes'][node['mesh']]['primitives']:
                values = {key: accessor(j, buffers, index) for key, index in primitive['attributes'].items()}
                offset = len(arrays['POSITION'])
                for key in ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']:
                    arrays[key].extend(values[key])
                if name.endswith('_Head'):
                    head_top = max(p[1] for p in values['POSITION'])
                for uv in values['TEXCOORD_0']:
                    rgb = [x/255 for x in image.getpixel((min(image.width-1, max(0, int(uv[0]*image.width))), min(image.height-1, max(0, int(uv[1]*image.height)))))]
                    if chef and name.endswith('_Body'):
                        rgb = [.94, .93, .88]
                    elif chef and '_Arm' in name and rgb[1] > rgb[0]*.85 and rgb[2] > rgb[0]*.85:
                        rgb = [.94, .93, .88]
                    arrays['COLOR_0'].append([*[linear(v) for v in rgb], 1])
                indices.extend(offset+row[0] for row in accessor(j, buffers, primitive['indices']))
        del node['mesh']
        node.pop('skin', None)

    if chef:
        joint = next(i for i, n in enumerate(j['skins'][0]['joints']) if j['nodes'][n]['name'] == 'head')
        def puff(center, radii):
            offset = len(arrays['POSITION'])
            rings, segments = 8, 12
            for y in range(rings+1):
                phi = math.pi*y/rings
                for x in range(segments+1):
                    theta = 2*math.pi*x/segments
                    normal = [math.sin(phi)*math.cos(theta), math.cos(phi), math.sin(phi)*math.sin(theta)]
                    arrays['POSITION'].append([center[k]+radii[k]*normal[k] for k in range(3)])
                    arrays['NORMAL'].append(normalized([normal[k]/radii[k] for k in range(3)]))
                    arrays['JOINTS_0'].append([joint, 0, 0, 0])
                    arrays['WEIGHTS_0'].append([1, 0, 0, 0])
                    arrays['COLOR_0'].append([.94, .93, .88, 1])
            for y in range(rings):
                for x in range(segments):
                    a = offset+y*(segments+1)+x
                    indices.extend([a, a+1, a+segments+1, a+1, a+segments+2, a+segments+1])
        puff([0, head_top+.01, 0], [.33, .09, .29])
        for x, z in [(-.15, 0), (.15, 0), (0, .14), (0, -.14)]:
            puff([x, head_top+.15, z], [.22, .20, .22])

    attributes = {key: append_accessor(j, buffers, rows, 'VEC3' if key in ['POSITION', 'NORMAL'] else 'VEC4', 5123 if key == 'JOINTS_0' else 5126) for key, rows in arrays.items()}
    j['meshes'] = [{'name': 'Character', 'primitives': [{'attributes': attributes, 'indices': append_accessor(j, buffers, [[v] for v in indices], 'SCALAR', 5125), 'material': 0}]}]
    mesh_nodes[0].update(mesh=0, skin=0)
    j['materials'] = [{'name': 'CharacterPalette', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': .85}}]
    for key in ['images', 'textures', 'samplers']:
        j.pop(key, None)


def build_characters():
    result = []
    for name, source in [('chef', 'Rogue'), ('barbarian', 'Barbarian'), ('knight', 'Knight'), ('mage', 'Mage'), ('ranger', 'Ranger')]:
        j, buffers = load(SOURCE / f'Characters/gltf/{source}.glb')
        mesh(j, buffers, chef=name == 'chef')
        animate(j, buffers)
        lo, hi = bounds(j)
        # The player camera contract includes the added hat in its 1.75 m visual height.
        scale = .875 / (hi[1]-lo[1]) if name == 'chef' else SCALE
        for node in j['nodes']:
            node['name'] = 'K_' + node['name']
        roots = j['scenes'][j.get('scene', 0)]['nodes']
        j['nodes'].append({'name': 'K_'+name, 'children': roots, 'scale': [scale]*3})
        j['scenes'] = [{'name': name, 'nodes': [len(j['nodes'])-1]}]
        j['scene'] = 0
        lo, hi = bounds(j)
        pack(j, buffers, OUT / f'actor-{name}.glb', unlit=False)
        result.append({'name': name, 'source': source, 'collection': 'KayKit Adventurers Free 2.0', 'url': URL, 'archiveSha256': SHA256,
                       'height': hi[1]-lo[1], 'animations': {'idle': 'Idle_A', 'walk': 'Walking_A', 'sit': 'Project-authored seated pose'},
                       'adaptation': 'White tunic, removed cape and project-authored chef hat' if name == 'chef' else ('Removed quiver' if name == 'ranger' else 'Original costume')})
    (OUT / 'LICENSE-KayKit-adventurers.txt').write_bytes((SOURCE / 'License.txt').read_bytes())
    return result
