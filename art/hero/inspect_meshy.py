import bpy, json, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
out=root/'art/hero/meshy-manual';out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'public/characters/Meshy_AI_super_saiyan_goku_mod_1004173344_image-to-3d-texture.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
coords=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector(tuple(min(v[i] for v in coords) for i in range(3)));hi=Vector(tuple(max(v[i] for v in coords) for i in range(3)))
scale=2.3/(hi.z-lo.z);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
for o in meshes:
 for v in o.data.vertices: v.co=(o.matrix_world@v.co-center)*scale
 o.matrix_world.identity()
 o.name='Canonical hero source';o.data.name='Meshy authored geometry'
info={'boundsBefore':[list(lo),list(hi)],'scale':scale,'meshes':[{'name':o.name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons)} for o in meshes],'images':[{'name':im.name,'size':list(im.size)} for im in bpy.data.images]}
(out/'blender-inspection.json').write_text(json.dumps(info,indent=2))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.32,.32,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
scene.view_settings.view_transform='AgX'
for name,pos,power,size in [('Key',(-3,-4,5),500,4),('Fill',(3,-2,3),250,3)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Inspection camera');cam=bpy.data.objects.new('Inspection camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=2.65
for label,pos in [('front',(0,-5,1.2)),('side',(5,0,1.2)),('back',(0,5,1.2))]:
 cam.location=pos;cam.rotation_euler=(Vector((0,0,1.15))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'source-inspection.blend'))
print('INSPECTION_COMPLETE',json.dumps(info))
