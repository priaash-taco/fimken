import bpy, bmesh, json, math
from pathlib import Path
from collections import defaultdict
from mathutils import Vector, Quaternion
# Adds finger bones to the existing Meshy rig. The mesh, textures and body weights are
# untouched; only vertices on the finger geometry move from the hand bone to finger bones.
# Fingers are found as separate pieces of the hand beyond the palm, so nothing is modelled.
root=Path(__file__).resolve().parents[2];out=root/'art/hero/meshy-manual'
bpy.ops.wm.open_mainfile(filepath=str(out/'rigged-refined.blend'),load_ui=False,use_scripts=False)
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
verts=mesh.data.vertices
bm=bmesh.new();bm.from_mesh(mesh.data);adjacency=defaultdict(set)
for e in bm.edges:adjacency[e.verts[0].index].add(e.verts[1].index);adjacency[e.verts[1].index].add(e.verts[0].index)
bm.free()
def components(ids):
    ids=set(ids);seen=set();found=[]
    for start in ids:
        if start in seen:continue
        stack=[start];seen.add(start);group=[]
        while stack:
            v=stack.pop();group.append(v)
            for w in adjacency[v]:
                if w in ids and w not in seen:seen.add(w);stack.append(w)
        found.append(group)
    return sorted(found,key=len,reverse=True)
KNUCKLES=[0,.40,.70,1.0];FINGERS=['thumb','index','middle','ring','pinky']
report={'sides':{}};new_bones={}
bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for side,sign in [('L',1),('R',-1)]:
    hand=arm.data.edit_bones['hand.'+side];head=hand.head.copy();axis=(hand.tail-head).normalized()
    palm_normal=Vector((-sign,0,0));lateral=axis.cross(palm_normal).normalized()*sign  # thumb side first on both hands
    group=mesh.vertex_groups['hand.'+side].index
    # Everything the hand bone influences at all, beyond the wrist: fingers may share weight with the forearm.
    members=[v.index for v in verts if any(g.group==group and g.weight>.08 for g in v.groups) and (v.co-head).dot(axis)>.03]
    along={i:(verts[i].co-head).dot(axis) for i in members}
    reach=max(along.values())
    # The four fingers are fused along their sides, so they are split by position across the
    # palm into four bands that curl together; the thumb stands clear and is found by position too.
    lat={i:(verts[i].co-head).dot(lateral) for i in members}
    tips=[i for i in members if along[i]>reach*.72];l0=min(lat[i] for i in tips);l1=max(lat[i] for i in tips);band=(l1-l0)/4
    palm_end=reach*.50
    thumb=[i for i in members if along[i]>reach*.22 and lat[i]<l0-band*.35]
    finger_zone=[i for i in members if along[i]>palm_end and lat[i]>=l0-band*.35]
    described=[]
    if len(thumb)>=30:
        points=[verts[i].co for i in thumb]
        base=min(points,key=lambda p:(p-head).dot(axis));tip=max(points,key=lambda p:(p-head).dot(axis))
        described.append({'name':'thumb','verts':thumb,'base':base,'tip':tip,'band':None})
    for k,name in enumerate(FINGERS[1:]):
        centre=l0+band*(k+.5);inside=[i for i in finger_zone if abs(lat[i]-centre)<=band*.5]
        if len(inside)<30:continue
        far=max(along[i] for i in inside)
        base=head+axis*palm_end+lateral*centre;tip=head+axis*far+lateral*centre
        # Pull the base and tip onto the finger mass so the bones run through it.
        mid=sum((verts[i].co for i in inside),Vector())/len(inside);offset=mid-(base+tip)/2;offset-=axis*offset.dot(axis);offset-=lateral*offset.dot(lateral)
        described.append({'name':name,'verts':inside,'base':base+offset,'tip':tip+offset,'band':(centre,band)})
    side_report={'cutFraction':None,'handVertices':len(members),'fingersFound':len(described),'fingers':{}}
    for finger in described:
        name=finger['name'];direction=finger['tip']-finger['base'];chain=[]
        for k in range(3):
            bone=arm.data.edit_bones.new(f'{name}.{k+1:02d}.{side}')
            bone.head=finger['base']+direction*KNUCKLES[k];bone.tail=finger['base']+direction*KNUCKLES[k+1]
            bone.parent=hand if k==0 else chain[-1];bone.use_connect=k>0;bone.align_roll(palm_normal);chain.append(bone)
        finger['bones']=[b.name for b in chain];finger['lat']=lat;finger['along']=along;new_bones[name+'.'+side]=finger
        side_report['fingers'][name]={'bones':finger['bones'],'vertices':len(finger['verts']),'length':round(direction.length,4)}
    report['sides'][side]=side_report
bpy.ops.object.mode_set(mode='OBJECT')
# Weights: each finger vertex belongs to the nearest segment of its own chain, blending across
# the knuckles, and the first part of the proximal bone fades in from the hand.
groups={g.name:g for g in mesh.vertex_groups}
def segment_param(p,a,b):
    ab=b-a;t=max(0.0,min(1.0,(p-a).dot(ab)/max(ab.length_squared,1e-9)));return t,(p-(a+ab*t)).length
chains={key:[arm.data.bones[n] for n in finger['bones']] for key,finger in new_bones.items()}
def chain_weights(p,bones):
    best=[]
    for k,b in enumerate(bones):
        t,d=segment_param(p,b.head_local,b.tail_local);best.append((d,k,t))
    best.sort();d0,k0,t0=best[0];weights={k0:1.0}
    if t0>.8 and k0<2:weights={k0:1-(t0-.8)*2.5,k0+1:(t0-.8)*2.5}
    elif t0<.2 and k0>0:weights={k0:.5+t0*2.5,k0-1:.5-t0*2.5}
    hand_share=1-t0/.35 if k0==0 and t0<.35 else 0.0
    return weights,hand_share
for side in ['L','R']:
    hand_group=groups['hand.'+side];fingers=[f for key,f in new_bones.items() if key.endswith('.'+side)]
    for f in fingers:
        for n in f['bones']:
            if n not in groups:groups[n]=mesh.vertex_groups.new(name=n)
    assigned={}
    for f in fingers:
        for i in f['verts']:assigned.setdefault(i,[]).append(f)
    for i,owners in assigned.items():
        p=verts[i].co;total={}
        if owners[0]['band'] is None and len(owners)==1:share=[(owners[0],1.0)]
        else:
            # Weight across the finger bands by lateral distance, so neighbours bend together.
            banded=[f for f in owners if f['band'] is not None];share=[]
            for f in banded:
                centre,band=f['band'];d=abs(f['lat'][i]-centre)/band;share.append((f,max(0.0,1-d)**1.5+.05))
            s_total=sum(w for _,w in share);share=[(f,w/s_total) for f,w in share]
        hand_total=0.0
        for f,w in share:
            weights,hand_share=chain_weights(p,chains[f['name']+'.'+side]);hand_total+=hand_share*w
            for k,wk in weights.items():
                name=f['bones'][k];total[name]=total.get(name,0)+wk*(1-hand_share)*w
        for item in list(verts[i].groups):mesh.vertex_groups[item.group].remove([i])
        for name,w in total.items():
            if w>.001:groups[name].add([i],w,'REPLACE')
        if hand_total>.001:hand_group.add([i],hand_total,'REPLACE')
# Smooth the new weights across the hand so knuckles bend without creases: same spatial
# blend as the body seam fix, limited to vertices the hand or fingers influence.
import numpy as np
from mathutils.kdtree import KDTree
group_list=list(mesh.vertex_groups);finger_groups={g.index for g in group_list if g.name.split('.')[0] in FINGERS or g.name.startswith('hand.')}
region=[v.index for v in verts if any(g.group in finger_groups for g in v.groups)]
weights=np.zeros((len(region),len(group_list)),dtype=np.float32);lookup={i:n for n,i in enumerate(region)}
tree=KDTree(len(region))
for n,i in enumerate(region):
    tree.insert(verts[i].co,n)
    for g in verts[i].groups:weights[n,g.group]=g.weight
tree.balance();links=[]
for n,i in enumerate(region):
    near=sorted(tree.find_range(verts[i].co,.014),key=lambda item:item[2])[:24]
    ids=np.array([item[1] for item in near]);dist=np.array([item[2] for item in near]);w=np.exp(-(dist/.007)**2);w/=w.sum();links.append((ids,w))
for _ in range(2):
    new=weights.copy()
    for n,(ids,w) in enumerate(links):new[n]=np.sum(weights[ids]*w[:,None],axis=0)
    weights=new
for n,i in enumerate(region):
    w=weights[n];ids=np.argsort(w)[-4:];total=float(w[ids].sum())
    for old in list(verts[i].groups):group_list[old.group].remove([i])
    for k in ids:
        if w[k]>.0001:group_list[k].add([i],float(w[k]/total),'REPLACE')
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
bpy.ops.object.vertex_group_limit_total(limit=4);bpy.ops.object.vertex_group_normalize_all(lock_active=False)
unweighted=[v.index for v in verts if sum(g.weight for g in v.groups)<.001]
if unweighted:raise RuntimeError(f'{len(unweighted)} vertices lost their weights')
# Close-up renders: open hands at rest, then every finger curled, to judge the deformation.
scene=bpy.context.scene;cam=scene.camera
def pose(curl):
    for b in arm.pose.bones:
        b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion()
        for name,angle in [('.01.',.5),('.02.',.8),('.03.',.5)]:
            if name in b.name and b.name.split('.')[0] in FINGERS:
                a=angle*curl*(.6 if b.name.startswith('thumb') else 1)
                b.rotation_quaternion=Quaternion((1,0,0),a)  # local X is the knuckle axis (roll aligned to the palm normal)
    bpy.context.view_layer.update()
hand=arm.data.bones['hand.L'];focus=(hand.head_local+hand.tail_local)/2
cam.data.type='PERSP';scene.render.resolution_x=900;scene.render.resolution_y=900
for label,curl in [('fingers-open',0),('fingers-fist',1)]:
    pose(curl);cam.location=focus+Vector((.42,-.42,.06));cam.rotation_euler=(focus-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.lens=85;scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
pose(0);scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(out/'rigged-fingers.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True,export_image_format='AUTO')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'rigged-fingers.blend'))
report['bones']=len(arm.data.bones);(out/'finger-report.json').write_text(json.dumps(report,indent=2))
print('FINGERS_COMPLETE',json.dumps(report))
