"""Build the original fryer in metres, Y up, with the serving tray off the heat."""
import math
from pathlib import Path
from gltf_assets import append_accessor, pack

ROOT = Path(__file__).resolve().parents[1]


def build_fryer(out):
    positions, normals, colors, indices = [], [], [], []

    def face(points, color):
        u = [points[1][k] - points[0][k] for k in range(3)]
        v = [points[2][k] - points[0][k] for k in range(3)]
        n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        length = math.sqrt(sum(x*x for x in n))
        if length < 1e-10:
            return
        start = len(positions)
        positions.extend(points)
        normals.extend([[x/length for x in n]] * len(points))
        linear = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in color]
        colors.extend([[*linear, 1]] * len(points))
        for i in range(1, len(points)-1):
            indices.extend([[start], [start+i], [start+i+1]])

    def box(x, y, z, w, h, d, color, bevel=.008):
        b = min(bevel, w/5, h/5, d/5)

        def ring(width, depth, height):
            a, c = width/2, depth/2
            return [[x+px, y+height, z+pz] for px, pz in [
                (-a+b, -c), (a-b, -c), (a, -c+b), (a, c-b),
                (a-b, c), (-a+b, c), (-a, c-b), (-a, -c+b)]]

        rings = [ring(w-2*b, d-2*b, 0), ring(w, d, b), ring(w, d, h-b), ring(w-2*b, d-2*b, h)]
        face(rings[0], color)
        face(list(reversed(rings[-1])), color)
        for lower, upper in zip(rings, rings[1:]):
            for i in range(8):
                j = (i+1) % 8
                face([lower[i], upper[i], upper[j], lower[j]], color)

    white, steel, dark = (.83, .86, .83), (.56, .64, .66), (.14, .19, .20)
    warm, oil = (.73, .41, .22), (.34, .24, .07)
    box(0, .015, 0, .90, .07, .86, dark)
    box(0, .085, 0, .94, .80, .90, white, .018)
    box(0, .14, .457, .82, .65, .025, warm)
    box(.22, .68, .481, .15, .028, .025, steel)
    box(0, .885, 0, .96, .09, .94, steel, .014)
    # Open oil well and wire basket on the left; serving tray on the right.
    box(-.15, .975, -.035, .55, .045, .60, dark)
    box(-.15, 1.012, -.035, .43, .014, .46, oil)
    for x in [-.415, .115]:
        box(x, .975, -.035, .035, .09, .60, steel)
    for z in [-.32, .25]:
        box(-.15, .975, z, .55, .09, .035, steel)
    for z in [-.255, .185]:
        box(-.15, 1.15, z, .39, .016, .013, steel, .003)
    for x in [-.34, .04]:
        box(x, 1.15, -.035, .013, .016, .44, steel, .003)
    for i in range(7):
        z = -.245 + i * .07
        box(-.15, 1.032, z, .38, .008, .008, steel, .001)
        for x in [-.34, .04]:
            box(x, 1.036, z, .008, .12, .008, steel, .001)
    box(-.15, 1.15, .26, .027, .022, .15, steel, .003)
    box(-.15, 1.15, .375, .075, .035, .14, dark, .007)
    box(0, .98, -.405, .91, .27, .11, steel)
    box(-.17, 1.07, -.34, .20, .08, .015, dark)
    box(.16, 1.09, -.34, .045, .045, .022, warm)
    box(.32, .983, .005, .26, .025, .51, dark)
    for x in [.20, .44]:
        box(x, 1.005, .005, .014, .035, .51, steel, .003)
    for z in [-.245, .255]:
        box(.32, 1.005, z, .25, .035, .014, steel, .003)
    for i in range(5):
        box(.32, 1.009, -.18+i*.09, .22, .008, .008, steel, .001)

    j = {'asset': {'version': '2.0', 'generator': 'Kitchen Chaos original fryer'},
         'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'fryer', 'mesh': 0}],
         'accessors': [], 'bufferViews': [],
         'materials': [{'name': 'FryerMat', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': .9}}]}
    buffers = []
    attrs = {name: append_accessor(j, buffers, rows, typ) for name, rows, typ in [
        ('POSITION', positions, 'VEC3'), ('NORMAL', normals, 'VEC3'), ('COLOR_0', colors, 'VEC4')]}
    index = append_accessor(j, buffers, indices, 'SCALAR', 5125)
    j['meshes'] = [{'name': 'fryer', 'primitives': [{'attributes': attrs, 'indices': index, 'material': 0}]}]
    pack(j, buffers, out/'fryer.glb', unlit=False)
    size = [max(p[k] for p in positions)-min(p[k] for p in positions) for k in range(3)]
    return {'name': 'fryer', 'collection': 'original', 'source': 'tools/build-fryer.py', 'size': size}


if __name__ == '__main__':
    build_fryer(ROOT/'game/assets/art/restaurant')
