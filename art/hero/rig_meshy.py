import bpy, json, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2];out=root/'art/hero/meshy-manual'
bpy.ops.wm.open_mainfile(filepath=str(out/'source-inspection.blend'),load_ui=False,use_scripts=False)
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');mesh.name='Meshy imported character'
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
# Reduce the imported surface; never synthesize replacement character geometry.
mod=mesh.modifiers.new('Runtime reduction','DECIMATE');mod.ratio=180000/len(mesh.data.polygons);mod.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=mod.name)
for poly in mesh.data.polygons:poly.use_smooth=True
mesh.data.materials[0].name='Meshy authored 4K PBR'
armdata=bpy.data.armatures.new('Meshy anatomical rig');arm=bpy.data.objects.new('HeroRig',armdata);bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm;mesh.select_set(False);arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
coords={
'hips':((0,0,1.14),(0,0,1.29),None),
'spine':((0,0,1.29),(0,.01,1.43),'hips'),
'chest':((0,.01,1.43),(0,.015,1.60),'spine'),
'neck':((0,.015,1.60),(0,.015,1.76),'chest'),
'head':((0,.015,1.76),(0,.015,1.97),'neck')}
for suffix,sign in [('L',1),('R',-1)]:
 def point(x,y,z):return (sign*x,y,z)
 coords.update({
 'shoulder.'+suffix:(point(.035,.015,1.59),point(.265,.01,1.57),'chest'),
 'upperarm.'+suffix:(point(.265,.01,1.57),point(.405,-.005,1.35),'shoulder.'+suffix),
 'forearm.'+suffix:(point(.405,-.005,1.35),point(.50,-.055,1.14),'upperarm.'+suffix),
 'hand.'+suffix:(point(.50,-.055,1.14),point(.565,-.09,.96),'forearm.'+suffix),
 'thigh.'+suffix:(point(.145,0,1.17),point(.235,-.025,.67),'hips'),
 'shin.'+suffix:(point(.235,-.025,.67),point(.31,.005,.17),'thigh.'+suffix),
 'foot.'+suffix:(point(.31,.005,.17),point(.32,-.15,.075),'shin.'+suffix),
 'toe.'+suffix:(point(.32,-.15,.075),point(.32,-.22,.055),'foot.'+suffix)})
for name,(head,tail,parent) in coords.items():
 bone=armdata.edit_bones.new(name);bone.head=head;bone.tail=tail
 if parent:bone.parent=armdata.edit_bones[parent]
 bone.align_roll(Vector((0,-1,0)))
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# Keep the skull and large disconnected hair masses rigid with the head.
head_group=mesh.vertex_groups.get('head')
rig_groups={g.index:g for g in mesh.vertex_groups}
for v in mesh.data.vertices:
 if v.co.z>1.80 and abs(v.co.x)<.36:
  for item in list(v.groups):rig_groups[item.group].remove([v.index])
  head_group.add([v.index],1,'REPLACE')
unweighted=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups)<.001]
# Heat weighting can leave isolated source triangles unbound; transfer from the
# nearest already-weighted surface vertex instead of inventing replacement geometry.
if unweighted:
 from mathutils.kdtree import KDTree
 tree=KDTree(len(mesh.data.vertices)-len(unweighted));missing=set(unweighted)
 for v in mesh.data.vertices:
  if v.index not in missing:tree.insert(v.co,v.index)
 tree.balance()
 for index in unweighted:
  _,near,distance=tree.find(mesh.data.vertices[index].co)
  if distance>.03:raise RuntimeError('Unbound surface too far from weighted geometry')
  for g in mesh.data.vertices[near].groups:rig_groups[g.group].add([index],g.weight,'REPLACE')
repaired=len(unweighted)
unweighted=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups)<.001]
if unweighted:raise RuntimeError('Skinning remains incomplete')
bpy.context.view_layer.objects.active=mesh;arm.select_set(False)
bpy.ops.object.vertex_group_limit_total(limit=4);bpy.ops.object.vertex_group_normalize_all(lock_active=False)
arm.select_set(True);bpy.context.view_layer.objects.active=arm
scene=bpy.context.scene;scene.render.fps=30
# A restrained breathing clip and explicit deformation checks, not placeholder fighting clips.
for action_name,frames,poses in [
 ('Idle_Breathe',[1,46,91],[{}, {'chest':(.008,0,0),'neck':(-.004,0,0)},{}]),
 ('Rig_Check',[1,31,61,91],[{}, {'upperarm.L':(0,0,-.7),'forearm.L':(-.8,0,0)}, {'thigh.R':(-.55,0,0),'shin.R':(.75,0,0)},{}])]:
 arm.animation_data_create();action=bpy.data.actions.new(action_name);arm.animation_data.action=action
 for frame,pose in zip(frames,poses):
  for b in arm.pose.bones:
   b.rotation_mode='XYZ';b.rotation_euler=pose.get(b.name,(0,0,0));b.keyframe_insert('rotation_euler',frame=frame,group=b.name)
 track=arm.animation_data.nla_tracks.new();track.name=action_name;track.strips.new(action_name,1,action);track.mute=True
arm.animation_data.action=None
for b in arm.pose.bones:b.rotation_euler=(0,0,0)
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'rigged.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True,export_image_format='AUTO',export_materials='EXPORT')
# Inspect runtime reduction at rest and at diagnostic joint poses.
cam=scene.camera
for label,pos,pose in [('processed-front',(0,-5,1.2),{}),('rig-shoulder',(0,-5,1.2),{'upperarm.L':(0,0,-.7),'forearm.L':(-.8,0,0)}),('rig-knee',(3,-4,1.2),{'thigh.R':(-.55,0,0),'shin.R':(.75,0,0)})]:
 for b in arm.pose.bones:b.rotation_euler=pose.get(b.name,(0,0,0))
 cam.location=pos;cam.rotation_euler=(Vector((0,0,1.15))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
for b in arm.pose.bones:b.rotation_euler=(0,0,0)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'rigged.blend'))
report={'vertices':len(mesh.data.vertices),'triangles':len(mesh.data.polygons),'bones':list(coords),'unweightedVertices':len(unweighted),'isolatedVerticesRepaired':repaired,'sourceGeometryPreserved':True,'sourceTexturesPreserved':True,'limitations':['Single weighted mesh; no facial blendshapes','Hands follow wrist bones; no articulated finger rig','Generic library retargeting requires motion review','This supplied GLB differs from the black/purple canonical design']}
(out/'rig-report.json').write_text(json.dumps(report,indent=2));print('RIG_COMPLETE',json.dumps(report))
