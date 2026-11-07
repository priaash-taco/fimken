import bpy, json, sys
from pathlib import Path
root=Path(bpy.path.abspath('//')) if bpy.data.filepath else Path.cwd()
src=Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');arm=next((o for o in bpy.context.scene.objects if o.type=='ARMATURE'),None)
me=mesh.data;head=mesh.vertex_groups.get('head')
hi=head.index if head else -1
pts=[v.co for v in me.vertices if any(g.group==hi and g.weight>.6 for g in v.groups)]
def bbox(ps):
    if not ps:return None
    return [[round(min(p[i] for p in ps),3),round(max(p[i] for p in ps),3)] for i in range(3)]
face=[v.co for v in me.vertices if v.co.y<-.07 and 1.74<v.co.z<1.93 and abs(v.co.x)<.09]
report={'mesh':mesh.name,'verts':len(me.vertices),'polys':len(me.polygons),'armature':arm.name if arm else None,'bones':len(arm.data.bones) if arm else 0,
 'shape_keys':[k.name for k in me.shape_keys.key_blocks] if me.shape_keys else [],'head_bbox':bbox(pts),'head_verts':len(pts),'face_box_verts':len(face),
 'face_bbox':bbox(face),'images':[i.name for i in bpy.data.images],'materials':[m.name for m in me.materials],'dims':[round(x,3) for x in mesh.dimensions],'rot':[round(x,3) for x in mesh.rotation_euler],'scale':[round(x,3) for x in mesh.scale]}
# z histogram of face box in 5 mm bands with mean y (depth) to find brow ridge, eye socket, nose, mouth
bands={}
for p in face:
    k=round(p.z*200)/200;bands.setdefault(k,[]).append(p.y)
report['face_profile']={str(k):[len(v),round(sum(v)/len(v),4),round(min(v),4)] for k,v in sorted(bands.items())}
print('PROBE '+json.dumps(report))
