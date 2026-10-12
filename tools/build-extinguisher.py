"""Build the original kitchen prop in Blender. Run with --background --python this_file.

Metres, Z up in Blender / Y up in GLB. Editable parts stay in the .blend;
the export joins them into one mesh with flat-colour materials and no textures.
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art-source' / 'fire-extinguisher.blend'
EXPORT = ROOT / 'game/assets/art/kitchen/fireExtinguisher.glb'
RENDER = ROOT / 'art-source/fire-extinguisher.png'
for path in (SOURCE, EXPORT, RENDER):
    path.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, rgb, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = 0.75
    return mat


red = material('BottleRed', (0.72, 0.025, 0.035))
black = material('HoseBlack', (0.035, 0.04, 0.045))
silver = material('ValveSilver', (0.48, 0.52, 0.56), 0.3)
white = material('LabelWhite', (0.9, 0.88, 0.8))
yellow = material('SafetyYellow', (0.95, 0.62, 0.03))
parts = []


def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj


def cylinder(name, radius, depth, pos, mat, vertices=12, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                        location=pos, rotation=rotation)
    return finish(bpy.context.object, name, mat)


def box(name, size, pos, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = size
    return finish(obj, name, mat)


def tube(name, a, b, radius, mat):
    delta = Vector(b) - Vector(a)
    obj = cylinder(name, radius, delta.length, (Vector(a) + Vector(b)) / 2, mat, 6)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj


# Rounded silhouette built from six rings, rather than subdivision surfaces.
rings = [(0, .125), (.035, .16), (.51, .16), (.56, .14), (.61, .075), (.62, .055)]
verts = [(r * math.cos(i * math.tau / 12), r * math.sin(i * math.tau / 12), z)
         for z, r in rings for i in range(12)]
faces = [tuple(reversed(range(12)))]
for ring in range(len(rings) - 1):
    for i in range(12):
        j = (i + 1) % 12
        faces.append((ring * 12 + i, ring * 12 + j, (ring + 1) * 12 + j, (ring + 1) * 12 + i))
faces.append(tuple(range((len(rings) - 1) * 12, len(rings) * 12)))
mesh = bpy.data.meshes.new('BottleBody')
mesh.from_pydata(verts, [], faces)
obj = bpy.data.objects.new('Bottle', mesh)
bpy.context.collection.objects.link(obj)
finish(obj, 'Bottle', red)

cylinder('BaseBoot', .164, .035, (0, 0, .0175), black)
cylinder('Valve', .046, .075, (0, 0, .6575), silver)
box('HandleLower', (.2, .055, .026), (-.035, 0, .716), black)
box('HandleUpper', (.21, .045, .024), (-.03, 0, .775), black)
box('HandleJoin', (.028, .05, .06), (.06, 0, .746), black)
cylinder('SafetyPin', .014, .11, (0, 0, .7), yellow, 8, (math.pi / 2, 0, 0))
cylinder('GaugeRim', .04, .02, (0, -.07, .673), silver, 12, (math.pi / 2, 0, 0))
cylinder('GaugeFace', .031, .006, (0, -.083, .673), white, 12, (math.pi / 2, 0, 0))
box('GaugeNeedle', (.008, .004, .037), (0, -.088, .679), black)

hose = [( .045, .012, .69), (.19, .012, .68), (.255, .012, .60),
        (.27, .012, .46), (.265, .012, .31), (.22, .012, .23)]
for i, (a, b) in enumerate(zip(hose, hose[1:])):
    tube(f'Hose_{i}', a, b, .017, black)
tube('Nozzle', hose[-1], (.2, .012, .165), .025, black)

box('Label', (.17, .009, .19), (0, -.157, .355), white)
# A simple red flame symbol, readable at game-camera size without text/texture.
mesh = bpy.data.meshes.new('FlameSymbol')
mesh.from_pydata([(-.045, -.163, .32), (.045, -.163, .32), (.012, -.163, .40),
                 (-.004, -.163, .365), (-.025, -.163, .385)], [], [(0, 1, 2, 3, 4)])
obj = bpy.data.objects.new('FlameSymbol', mesh)
bpy.context.collection.objects.link(obj)
finish(obj, 'FlameSymbol', red)
box('LabelStripe', (.11, .003, .015), (0, -.164, .285), red)

# Bake every part's transform: the asset contract can inspect actual GLB bounds.
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Preserve independently editable parts in the source, plus a useful preview camera.
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.background_type = 'WORLD'
scene.world.color = (.12, .14, .17)
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
bpy.ops.object.camera_add(location=(1.3, -2.2, 1.3))
camera = bpy.context.object
camera.rotation_euler = (Vector((0.04, 0, .4)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.15
scene.camera = camera
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
scene.render.filepath = str(RENDER)
bpy.ops.render.render(write_still=True)

# One exported mesh; separate materials retain the bottle / hose / label colours.
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
bpy.context.object.name = 'FireExtinguisher'
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format='GLB', use_selection=True,
                          export_yup=True, export_animations=False, export_cameras=False,
                          export_lights=False)
print(f'EXPORTED {EXPORT} ({EXPORT.stat().st_size} bytes)')
