import bpy, bmesh, json, sys, math
from pathlib import Path
from mathutils import Vector, kdtree
# Real eyes for the Meshy hero without cutting its mesh:
#   eyeballs   two spheres with a generated sclera/iris/pupil texture, set into the face so their front caps
#              sit where the painted eyes are, each weighted to a new eye.L / eye.R bone (child of head) so
#              the face layer can move the gaze;
#   eyelids    upper and lower lid patches per eye, shaped as almond rings that follow the skin surface and
#              wrap over the eyeball, in flat skin colour, weighted to head, with ARKit blendshapes
#              eyeBlink / eyeWide / eyeSquint (L/R) that slide the lid edge over the ball.
# The painted eyes end up hidden under lids and balls. Body-mesh keys that used to fake blinks are removed.
#   blender -b --python art/hero/face/build_eyes.py -- <input.glb> <output.glb> <report dir>
argv=sys.argv[sys.argv.index('--')+1:];src,dst,outdir=Path(argv[0]),Path(argv[1]),Path(argv[2]);outdir.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH');arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
me=body.data;basis=me.shape_keys.key_blocks['Basis'];co=lambda v:basis.data[v.index].co
# Measured from the texture (probe3): painted eye centres, extents and the average skin colour around them.
EYES={'L':{'cx':.040,'cz':1.861,'ix':.037,'iz':1.859},'R':{'cx':-.040,'cz':1.861,'ix':-.035,'iz':1.859}}
SKIN=(0.862,0.714,0.53,1.0);IRIS=(0.16,0.70,0.60);IRIS_DARK=(0.05,0.36,0.33);R_BALL=.019
AO,BO,AI,BI=.030,.017,.024,.0125    # outer / inner almond semi-axes (m)
# Skin depth lookup from the face vertices.
face=[(co(v),v) for v in me.vertices if co(v).y<-.09 and 1.80<co(v).z<1.93 and abs(co(v).x)<.11]
tree=kdtree.KDTree(len(face))
for i,(p,v) in enumerate(face):tree.insert(p,i)
tree.balance()
def skin_y(x,z):
    hits=tree.find_n(Vector((x,-.14,z)),5);return sum(face[i][0].y for _,i,_ in hits)/len(hits)
head_group=body.vertex_groups['head'].index
def skin_mat():
    m=bpy.data.materials.new('Eyelid skin');m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=SKIN;b.inputs['Roughness'].default_value=.75;return m
def eye_texture(side):
    # Flat front-projection texture: the sphere's UVs are set from each vertex's direction (see below), so the
    # iris is centred on the front (-y) regardless of how the primitive was built.
    S=512;img=bpy.data.images.new('eye_'+side,S,S,alpha=False);px=[0.0]*(S*S*4)
    for y in range(S):
        for x in range(S):
            u=(x+.5)/S-.5;v=(y+.5)/S-.5;rad=math.hypot(u,v);i=(y*S+x)*4
            r,g,b=0.97,0.97,0.98
            if rad<.19:
                t=rad/.19
                r,g,b=[IRIS[k]*(1-t*.55)+IRIS_DARK[k]*t*.55 for k in range(3)]
                if rad>.165:r,g,b=[c*.5 for c in (r,g,b)]
                if rad<.075:r,g,b=.03,.03,.04
                if math.hypot(u+.06,v-.075)<.032:r,g,b=1,1,1
            elif rad<.215:
                k=(rad-.19)/.025;r,g,b=[c*(1-k)+w*k for c,w in zip((.6,.6,.65),(.97,.97,.98))]
            px[i:i+4]=[r,g,b,1]
    img.pixels=px;img.pack();return img
def project_uvs(ball,center):
    uv=ball.data.uv_layers.active.data;vs=ball.data.vertices
    cen=Vector((0,0,0))
    for v in vs:cen+=v.co
    cen/=len(vs)   # the primitive's vertices are not guaranteed to sit around the object origin
    for poly in ball.data.polygons:
        for li in poly.loop_indices:
            d=vs[ball.data.loops[li].vertex_index].co-cen
            uv[li].uv=(0.5+d.x/(2*R_BALL)*.95,0.5+d.z/(2*R_BALL)*.95)
def ball_mat(side):
    m=bpy.data.materials.new('Eyeball '+side);m.use_nodes=True;nt=m.node_tree;b=nt.nodes['Principled BSDF'];b.inputs['Roughness'].default_value=.25
    t=nt.nodes.new('ShaderNodeTexImage');t.image=eye_texture(side);nt.links.new(t.outputs['Color'],b.inputs['Base Color']);return m
created=[]
# Eye bones.
bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for side,E in EYES.items():
    front=min(skin_y(E['cx']+dx,E['cz']+dz) for dx in (-.02,-.012,-.004,.004,.012,.02) for dz in (-.009,0,.009))
    cy=front-.006+R_BALL
    E['center']=Vector((E['ix'],cy,E['iz']))
    eb=arm.data.edit_bones.new('eye.'+side);eb.head=E['center'];eb.tail=E['center']+Vector((0,-.02,0));eb.parent=arm.data.edit_bones['head']
bpy.ops.object.mode_set(mode='OBJECT')
def attach(obj,group_weights):
    for name,w in group_weights.items():
        g=obj.vertex_groups.new(name=name);g.add(list(range(len(obj.data.vertices))),w,'REPLACE')
    mod=obj.modifiers.new('Armature','ARMATURE');mod.object=arm;obj.parent=arm
for side,E in EYES.items():
    c=E['center']
    # --- eyeball
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,radius=R_BALL,location=c)
    ball=bpy.context.active_object;ball.name='Eyeball.'+side;ball.rotation_euler=(math.pi/2,0,0);bpy.ops.object.transform_apply(rotation=True)
    for p in ball.data.polygons:p.use_smooth=True
    project_uvs(ball,c)
    ball.data.materials.append(ball_mat(side));attach(ball,{'eye.'+side:1.0});created.append(ball)
    # --- lids: parametric almond rings following the skin and wrapping the ball
    for which,sign in (('upper',1),('lower',-1)):
        COLS,ROWS=26,5;verts=[];faces=[]
        def inner_z(xr,open_amt):   # lid edge z offset from cz at relative x, for an opening amount (1 open, 0 closed)
            if abs(xr)>=AI:return 0.0
            return sign*BI*math.sqrt(1-(xr/AI)**2)*open_amt
        def outer_z(xr):return sign*BO*math.sqrt(max(0.0,1-(xr/AO)**2))
        def point(xr,s,open_amt):   # s: 0 inner edge .. 1 outer edge
            x=E['cx']+xr;z=E['cz']+inner_z(xr,open_amt)*(1-s)+outer_z(xr)*s
            ys=skin_y(x,z)-.0022*(1-s)-.0004*s
            dx=x-c.x;dz=z-c.z;rr=(R_BALL+.0012)**2-dx*dx-dz*dz
            if rr>0:ys=min(ys,c.y-math.sqrt(rr)-.0003)
            return Vector((x,ys,z))
        xs=[-AO+2*AO*j/(COLS-1) for j in range(COLS)]
        for s_i in range(ROWS):
            s=s_i/(ROWS-1)
            for xr in xs:verts.append(point(xr,s,1.0))
        for s_i in range(ROWS-1):
            for j in range(COLS-1):
                a=s_i*COLS+j;faces.append((a,a+1,a+COLS+1,a+COLS) if sign>0 else (a,a+COLS,a+COLS+1,a+1))
        lid_me=bpy.data.meshes.new(f'Lid.{which}.{side}');lid_me.from_pydata([tuple(v) for v in verts],[],faces);lid_me.update()
        lid=bpy.data.objects.new(f'Lid.{which}.{side}',lid_me);bpy.context.scene.collection.objects.link(lid)
        for p in lid_me.polygons:p.use_smooth=True
        lid_me.materials.append(skin_mat());attach(lid,{'head':1.0});created.append(lid)
        # blendshapes: edge slides toward the centre line (blink), opens wider (wide), half closes (squint)
        lid.shape_key_add(name='Basis',from_mix=False)
        for key_name,open_amt in ((f'eyeBlink{"Left" if side=="L" else "Right"}',0.0),(f'eyeWide{"Left" if side=="L" else "Right"}',1.3),(f'eyeSquint{"Left" if side=="L" else "Right"}',0.5)):
            k=lid.shape_key_add(name=key_name,from_mix=False);idx=0
            for s_i in range(ROWS):
                s=s_i/(ROWS-1)
                for xr in xs:k.data[idx].co=point(xr,s,open_amt);idx+=1
# Drop the body keys that faked eyes under the lids (keep brows, squint on skin, jaw, mouth, cheeks).
for name in ['eyeBlinkLeft','eyeBlinkRight','eyeWideLeft','eyeWideRight']:
    kb=me.shape_keys.key_blocks.get(name)
    if kb:body.shape_key_remove(kb)
# Export everything that is skinned to the armature.
bpy.ops.object.select_all(action='DESELECT')
for o in [body,arm,*created]:o.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(dst),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_morph=True,export_morph_normal=False,export_yup=True,export_image_format='AUTO',export_apply=False)
report={'eyes':{s:{'center':[round(x,4) for x in E['center']]} for s,E in EYES.items()},'objects':[o.name for o in created],'body_keys':[k.name for k in me.shape_keys.key_blocks]}
(outdir/'eyes-report.json').write_text(json.dumps(report,indent=1));print('EYES '+json.dumps(report))
