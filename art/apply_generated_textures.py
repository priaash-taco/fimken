"""Apply generated material sources to the isolated rigged character study.

No API calls. Requires all four images in output/imagegen. Keeps the original
study and live actor intact; exports a sibling GLB with embedded textures.
Run with Blender --background --factory-startup --disable-autoexec --python.
"""
from pathlib import Path
import json
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'output' / 'imagegen'
OUT = ROOT / 'public' / 'studies' / 'goku-textured-v1'
PREVIEW = ROOT / 'art' / 'previews' / 'goku-textured-v1'
MATERIALS = {
    'gi_orange': ('orange-gi-source.png', .87),
    'gi_navy': ('navy-cotton-source.png', .92),
    'skin': ('warm-skin-source.png', .76),
    'hair_ink': ('ink-hair-source.png', .58),
}
for filename, _ in MATERIALS.values():
    if not (SOURCE / filename).is_file():
        raise FileNotFoundError(SOURCE / filename)
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/studies/goku-v2/goku-study.glb'))
actors = list(bpy.context.selected_objects)
report = {'status': 'material study, not final character art', 'materials': [],
          'limitations': ['Existing study geometry and UV mapping retained',
                         'Material tiles are not anatomy-specific UV painting',
                         'No native 8K generation or texture upscaling',
                         'Live scene actor has not been replaced']}
for name, (filename, roughness) in MATERIALS.items():
    material = bpy.data.materials.get(name)
    if material is None:
        raise RuntimeError('Missing character material: ' + name)
    image = bpy.data.images.load(str(SOURCE / filename), check_existing=True)
    image.colorspace_settings.name = 'sRGB'
    image.pack()
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    for link in list(shader.inputs['Base Color'].links):
        links.remove(link)
    texture = nodes.new('ShaderNodeTexImage')
    texture.name = 'Generated material source'
    texture.image = image
    texture.interpolation = 'Linear'
    texture.extension = 'REPEAT'
    links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = 0
    # Keep detail in the colour art; don't mistake colour shading for height.
    shader.inputs['Specular IOR Level'].default_value = .22
    report['materials'].append({'material': name, 'source': str(SOURCE / filename),
                                'dimensions': list(image.size), 'roughness': roughness})
bpy.ops.object.select_all(action='DESELECT')
for actor in actors:
    actor.select_set(True)
target = OUT / 'goku-textured-study.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB',
    use_selection=True, export_animations=True, export_skins=True,
    export_animation_mode='NLA_TRACKS', export_extras=True)
report['asset'] = str(target)
report['rigs'] = len([o for o in actors if o.type == 'ARMATURE'])
report['actions'] = [a.name for a in bpy.data.actions]

# Render the same PBR materials used by the exported asset, without bloom.
for actor in actors:
    if actor.animation_data:
        actor.animation_data.action = None
        for track in actor.animation_data.nla_tracks:
            track.mute = True
    if actor.type == 'ARMATURE':
        for bone in actor.pose.bones:
            bone.matrix_basis.identity()
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 1200
scene.render.resolution_y = 1500
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.06, .07, .10, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .5
points = [o.matrix_world @ Vector(p) for o in actors if o.type == 'MESH' for p in o.bound_box]
minimum = Vector(tuple(min(p[i] for p in points) for i in range(3)))
maximum = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (minimum + maximum) / 2
height = maximum.z - minimum.z
for offset, energy, tint in [((-1,-1,1.5), 300, (1,.94,.87)),
                              ((1,-.4,.9), 120, (.8,.88,1)),
                              ((.5,1,1.5), 350, (1,.92,.82))]:
    location = center + Vector(offset) * height
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.data.energy = energy * (height / 2) ** 2
    light.data.shape = 'DISK'
    light.data.size = height * .7
    light.data.color = tint
    light.rotation_euler = (center-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
scene.camera = camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = height * 1.16
for name, offset in [('front',(0,-2.7,.08)), ('three-quarter',(1.4,-2.5,.2)), ('rear',(-1,2.7,.12))]:
    camera.location = center + Vector(offset) * height
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(PREVIEW / (name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('RENDERED',name,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'art/goku-textured-study.blend'))
(PREVIEW/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('TEXTURED STUDY COMPLETE',json.dumps(report),flush=True)
