import bpy,json,math
from pathlib import Path
from mathutils import Vector,Quaternion
from mathutils.kdtree import KDTree
import numpy as np
root=Path(__file__).resolve().parents[2];out=root/'art/hero/meshy-manual'
bpy.ops.wm.open_mainfile(filepath=str(out/'rigged.blend'),load_ui=False,use_scripts=False)
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
# Smooth the imported mesh's skin-weight field across disconnected cloth seams.
# Positions, UVs, materials and topology are unchanged.
verts=mesh.data.vertices;groups=list(mesh.vertex_groups);weights=np.zeros((len(verts),len(groups)),dtype=np.float32)
tree=KDTree(len(verts))
for v in verts:
 tree.insert(v.co,v.index)
 for g in v.groups:weights[v.index,g.group]=g.weight
tree.balance();links=[]
for v in verts:
 near=tree.find_range(v.co,.025)
 near=sorted(near,key=lambda item:item[2])[:32]
 ids=np.array([item[1] for item in near]);dist=np.array([item[2] for item in near]);w=np.exp(-(dist/.012)**2);w/=w.sum();links.append((ids,w))
for _ in range(3):
 new=weights.copy()
 for i,(ids,w) in enumerate(links):new[i]=np.sum(weights[ids]*w[:,None],axis=0)
 weights=new
head=mesh.vertex_groups['head'].index
for v in verts:
 w=weights[v.index]
 if v.co.z>1.80 and abs(v.co.x)<.36:w[:]=0;w[head]=1
 ids=np.argsort(w)[-4:];total=float(w[ids].sum())
 for old in list(v.groups):groups[old.group].remove([v.index])
 for i in ids:
  if w[i]>.0001:groups[i].add([v.index],float(w[i]/total),'REPLACE')
scene=bpy.context.scene;cam=scene.camera
# Diagnostic bends about known model-space axes, transformed to local bone axes.
def pose(changes):
 for b in arm.pose.bones:
  b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion()
 for name,(axis,angle) in changes.items():
  b=arm.pose.bones[name];rest=b.bone.matrix_local.to_quaternion();b.rotation_quaternion=rest.inverted()@Quaternion(axis,angle)@rest
 bpy.context.view_layer.update()
arm.animation_data_clear()
# Retain only a genuine subtle idle in the processed mesh; motion library is retargeted by the app.
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
arm.animation_data_create();action=bpy.data.actions.new('Idle_Breathe');arm.animation_data.action=action
for frame,angle in [(1,0),(46,.008),(91,0)]:
 pose({'chest':((1,0,0),angle)})
 for b in arm.pose.bones:b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name)
track=arm.animation_data.nla_tracks.new();track.name='Idle_Breathe';track.strips.new('Idle_Breathe',1,action);track.mute=True;arm.animation_data.action=None;pose({});scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(out/'rigged.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True,export_image_format='AUTO')
for label,pos,changes in [('rig-shoulder-refined',(0,-5,1.2),{'upperarm.L':((0,1,0),-.9),'forearm.L':((1,0,0),-.8)}),('rig-knee-refined',(3,-4,1.2),{'thigh.R':((1,0,0),-.55),'shin.R':((1,0,0),.75)})]:
 pose(changes);cam.location=pos;cam.rotation_euler=(Vector((0,0,1.15))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
pose({});bpy.ops.wm.save_as_mainfile(filepath=str(out/'rigged-refined.blend'))
p=out/'rig-report.json';d=json.loads(p.read_text());d['weightRefinement']='Spatial seam blending; 3 passes, 25mm neighbourhood, maximum 4 weights. No mesh position/UV/material changes.';d['limitations']=[x for x in d['limitations'] if 'canonical' not in x];p.write_text(json.dumps(d,indent=2))
print('WEIGHT_REFINEMENT_COMPLETE')
