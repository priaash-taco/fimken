import bpy,bmesh
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(R/'art/goku-scene.blend'),use_scripts=False)
for ob in list(bpy.data.objects):
 if ob.type=='MESH':
  bm=bmesh.new();bm.from_mesh(ob.data)
  unwanted=[]
  for face in bm.faces:
   c=face.calc_center_median();mat=ob.data.materials[face.material_index].name
   if c.z<5.71 or mat.startswith('hair_') or abs(c.x)>.66: unwanted.append(face)
  bmesh.ops.delete(bm,geom=unwanted,context='FACES');bm.to_mesh(ob.data);bm.free()
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE_NEXT';scene.render.resolution_x=2048;scene.render.resolution_y=2048;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.42,.28,.19,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.camera_add(location=(0,-12,6.29));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.44
cam.rotation_euler=(Vector((0,0,6.29))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-2,-5,8));light=bpy.context.object;light.data.energy=260;light.data.size=5
light.rotation_euler=(Vector((0,0,6.29))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(R/'art/textures/face-projection-guide.png');bpy.ops.render.render(write_still=True)
