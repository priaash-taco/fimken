"""Inspect an imported Blender character without running its embedded scripts.

Run with Blender --background --factory-startup --disable-autoexec --python
art/inspect_goku_asset.py -- path/to/model.blend path/to/report.json
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source, destination = [Path(value).resolve() for value in args[:2]]
if source.suffix.lower() != '.blend':
    raise ValueError('Expected an artist-supplied .blend file')

bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
objects = []
for obj in bpy.data.objects:
    item = {
        'name': obj.name, 'type': obj.type,
        'location': list(obj.location), 'dimensions': list(obj.dimensions),
        'hide_render': obj.hide_render,
        'collections': [collection.name for collection in obj.users_collection],
    }
    if obj.type == 'MESH':
        corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        item.update({
            'vertices': len(obj.data.vertices), 'polygons': len(obj.data.polygons),
            'bounds': [[min(v[i] for v in corners), max(v[i] for v in corners)] for i in range(3)],
            'materials': [material.name if material else None for material in obj.data.materials],
            'shape_keys': [key.name for key in obj.data.shape_keys.key_blocks] if obj.data.shape_keys else [],
            'modifiers': [{'name': mod.name, 'type': mod.type} for mod in obj.modifiers],
        })
    if obj.type == 'ARMATURE':
        item['bones'] = [{'name': bone.name, 'deform': bone.use_deform} for bone in obj.data.bones]
        item['properties'] = {key: str(obj[key])[:500] for key in obj.keys()}
    if obj.animation_data:
        item['drivers'] = [{
            'path': driver.data_path, 'expression': driver.driver.expression,
        } for driver in obj.animation_data.drivers]
    objects.append(item)

report = {
    'source': str(source), 'blender': bpy.app.version_string,
    'scene': {'engine': bpy.context.scene.render.engine, 'camera': bpy.context.scene.camera.name if bpy.context.scene.camera else None},
    'objects': objects,
    'materials': [{
        'name': material.name,
        'nodes': [{'name': node.name, 'type': node.bl_idname} for node in material.node_tree.nodes] if material.use_nodes else [],
    } for material in bpy.data.materials],
    'images': [{'name': img.name, 'path': img.filepath, 'packed': bool(img.packed_file), 'size': list(img.size)} for img in bpy.data.images],
    'actions': [action.name for action in bpy.data.actions],
    'embedded_texts': [{'name': text.name, 'auto_run': text.use_module, 'content': text.as_string()} for text in bpy.data.texts],
}
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report, indent=2), encoding='utf-8')
print('Inspection saved to', destination)
