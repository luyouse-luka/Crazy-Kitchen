"""Original low-poly drinks dispenser. Blender 4.5+, metres, Z up.

Run from the repository root with blender --background --python this_file.
The editable source preserves individual parts; GLB uses one joined mesh.
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art-source/drinks-machine.blend'
EXPORT = ROOT / 'game/assets/art/kitchen/drinksMachine.glb'
RENDER = ROOT / 'art-source/drinks-machine.png'
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
    shader.inputs['Roughness'].default_value = .75
    return mat


blue = material('MachineBlue', (.06, .39, .57))
white = material('CabinetWhite', (.82, .87, .89))
black = material('RecessBlack', (.035, .045, .055))
silver = material('TraySilver', (.46, .53, .57), .3)
parts = []


def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj


def box(name, size, pos, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('SmallEdgeChamfer', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 1
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, name, mat)


def cylinder(name, radius, depth, pos, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=depth,
                                        location=pos, rotation=rotation)
    return finish(bpy.context.object, name, mat)


# Freestanding cabinet, opening faces Blender -Y / Cocos +Z (the kitchen aisle).
box('Base', (.70, .48, .05), (0, 0, .025), black)
box('LowerCabinet', (.68, .46, .50), (0, 0, .30), white, .012)
box('FrontDoor', (.57, .015, .40), (0, -.232, .30), blue, .008)
box('DoorHandle', (.11, .022, .018), (.15, -.25, .43), silver)
box('BackSupport', (.54, .17, .31), (0, .14, .705), white)
box('LeftPillar', (.07, .46, .31), (-.305, 0, .705), blue)
box('RightPillar', (.07, .46, .31), (.305, 0, .705), blue)
box('PourBayBack', (.54, .008, .28), (0, .05, .705), black)
box('Head', (.72, .50, .24), (0, 0, .98), blue, .012)
box('FrontPanel', (.63, .012, .16), (0, -.249, .98), white, .006)
box('IconPlate', (.21, .006, .12), (-.17, -.258, .98), blue)
cylinder('PourButton', .035, .012, (.17, -.262, .98), black, (math.pi / 2, 0, 0))
cylinder('ButtonFace', .025, .004, (.17, -.27, .98), silver, (math.pi / 2, 0, 0))
cylinder('NozzleMount', .045, .024, (0, -.055, .855), black)
cylinder('Nozzle', .027, .066, (0, -.055, .81), silver)
cylinder('NozzleTip', .016, .009, (0, -.055, .7725), black)
box('DripTray', (.54, .32, .034), (0, -.09, .557), silver, .006)
box('TrayRecess', (.46, .25, .004), (0, -.09, .576), black)
for i in range(6):
    box(f'TrayGrille_{i}', (.42, .012, .004), (0, -.185 + i * .037, .579), silver)

# Cup pictogram, no text or external texture and no permanently full drink.
mesh = bpy.data.meshes.new('CupIcon')
mesh.from_pydata([(-.207, -.262, .941), (-.133, -.262, .941),
                 (-.121, -.262, 1.012), (-.219, -.262, 1.012)], [], [(0, 1, 2, 3)])
obj = bpy.data.objects.new('CupIcon', mesh)
bpy.context.collection.objects.link(obj)
finish(obj, 'CupIcon', white)
box('CupRimIcon', (.108, .002, .012), (-.17, -.263, 1.015), white)

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

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
bpy.ops.object.camera_add(location=(1.7, -2.4, 1.6))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .55)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.6
scene.camera = camera
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
scene.render.filepath = str(RENDER)
bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
bpy.context.object.name = 'DrinksMachine'
# Plain colours use no UVs; avoid exporting unused channels.
for layer in list(bpy.context.object.data.uv_layers):
    bpy.context.object.data.uv_layers.remove(layer)
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format='GLB', use_selection=True,
                          export_yup=True, export_animations=False, export_cameras=False,
                          export_lights=False)
print(f'EXPORTED {EXPORT} ({EXPORT.stat().st_size} bytes)')
