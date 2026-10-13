"""Original low-poly burger toppings, Blender 4.5+, metres and Z up.

The source keeps individual parts arranged for inspection; each GLB is centred.
Run from the repository root with blender --background --python this_file.
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art-source/burger-toppings.blend'
RENDER = ROOT / 'art-source/burger-toppings.png'
EXPORT = ROOT / 'game/assets/art/food'
SOURCE.parent.mkdir(parents=True, exist_ok=True)
EXPORT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
# Keep repeat generation from leaving a Blender backup beside the source.
bpy.context.preferences.filepaths.save_version = 0


def material(name, rgb):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .85
    return mat


purple = material('OnionPurple', (.58, .22, .53))
onion_white = material('OnionWhite', (.94, .82, .94))
skin = material('PickleSkin', (.17, .34, .055))
flesh = material('PickleFlesh', (.51, .66, .17))
seed = material('PickleSeed', (.82, .83, .44))
meat = material('BaconMeat', (.62, .20, .13))
fat = material('BaconFat', (.94, .74, .53))
models = {}
parts = []
offset = 0


def finish(obj, name, mat):
    obj.name = name
    obj.location.x += offset
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj


def ring(name, radius, tube, mat, z):
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=6,
                                     major_radius=radius, minor_radius=tube,
                                     location=(0, 0, z))
    return finish(bpy.context.object, name, mat)


def cylinder(name, radius, depth, x, y, z, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=depth,
                                        location=(x, y, z))
    return finish(bpy.context.object, name, mat)


offset = -.43
# Two open rings; the lower half is purple, upper half is pale flesh.
for i, radius in enumerate((.14, .093)):
    obj = ring(f'OnionRing_{i}', radius, .012, purple, .010392304845413264)
    obj.data.materials.append(onion_white)
    for poly in obj.data.polygons:
        if poly.center.z > .003 and math.hypot(poly.center.x, poly.center.y) < radius + .002:
            poly.material_index = 1
models['onion'] = (parts, offset)
parts = []
offset = 0
for i, (x, y) in enumerate(((-.065, -.05), (.065, -.05), (0, .057))):
    lift = i * .003
    cylinder(f'PickleSliceSkin_{i}', .079, .012, x, y, .006 + lift, skin)
    cylinder(f'PickleSliceFace_{i}', .068, .002, x, y, .013 + lift, flesh)
    for j in range(4):
        angle = j * math.pi / 2 + i * .45
        obj = cylinder(f'PickleSeed_{i}_{j}', .008, .001,
                       x + math.cos(angle) * .033, y + math.sin(angle) * .033, .0145 + lift, seed)
        obj.scale = (1, .45, 1)
models['pickle'] = (parts, offset)
parts = []
offset = .43


def strip(name, y, width, mat, bottom, thickness):
    vertices = []
    # Irregular edges and a shallow wave give the slices a cooked shape.
    for j in range(7):
        x = -.145 + j * .29 / 6
        wave = .003 * (1 - math.cos(j * math.pi))
        shift = .005 * math.sin(j * 1.6)
        vertices.extend([(x, y + shift - width / 2, bottom + wave),
                         (x, y + shift + width / 2, bottom + wave),
                         (x, y + shift - width / 2, bottom + wave + thickness),
                         (x, y + shift + width / 2, bottom + wave + thickness)])
    faces = [(0, 2, 3, 1), (24, 25, 27, 26)]
    for j in range(6):
        a, b = j * 4, (j + 1) * 4
        faces.extend([(a, a + 1, b + 1, b), (a + 2, b + 2, b + 3, a + 3),
                      (a, b, b + 2, a + 2), (a + 1, a + 3, b + 3, b + 1)])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, name, mat)


for i, y in enumerate((-.095, 0, .095)):
    strip(f'BaconStrip_{i}', y, .061, meat, 0, .009)
    strip(f'BaconFatStripe_{i}', y - .008, .016, fat, .0092, .001)
models['bacon'] = (parts, offset)

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.background_type = 'WORLD'
scene.world.color = (.12, .14, .17)
scene.render.resolution_x = 1200
scene.render.resolution_y = 600
scene.render.resolution_percentage = 100
bpy.ops.object.camera_add(location=(.18, -1.3, 1.6))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .01)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.55
scene.camera = camera
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
scene.render.filepath = str(RENDER)
bpy.ops.render.render(write_still=True)

for name, (objects, model_offset) in models.items():
    bpy.ops.object.select_all(action='DESELECT')
    copies = []
    for obj in objects:
        copy = obj.copy()
        copy.data = obj.data.copy()
        bpy.context.collection.objects.link(copy)
        copy.location.x -= model_offset
        copy.select_set(True)
        copies.append(copy)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    for layer in list(joined.data.uv_layers):
        joined.data.uv_layers.remove(layer)
    path = EXPORT / f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_yup=True, export_animations=False, export_cameras=False,
                              export_lights=False)
    bpy.data.objects.remove(joined, do_unlink=True)
    print(f'EXPORTED {path} ({path.stat().st_size} bytes)')
