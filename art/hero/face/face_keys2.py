import bpy, json, sys, math
from pathlib import Path
from mathutils import Vector
# Standard (ARKit-named) expression shape keys on the Meshy face, built procedurally from the active hero GLB.
# The eyes and mouth are painted on the texture, so every key works by moving the surrounding skin:
# lids collapse onto the eye line for a blink, brows shift, the jaw drops, mouth corners move, cheeks puff.
# Names follow the ARKit 52 set so the same expression layer drives any properly rigged face later.
#   blender -b --python art/hero/face/face_keys2.py -- <input.glb> <output.glb> <render dir>
argv=sys.argv[sys.argv.index('--')+1:];src,dst,renders=Path(argv[0]),Path(argv[1]),Path(argv[2]);renders.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
me=mesh.data
if not me.shape_keys:mesh.shape_key_add(name='Basis',from_mix=False)
basis=me.shape_keys.key_blocks['Basis']
def smooth(a,b,v):
    t=max(0.0,min(1.0,(v-a)/(b-a)));return t*t*(3-2*t)
def band(v,a,b,soft):   # 1 inside [a,b], soft falloff of width `soft` outside
    return smooth(a-soft,a,v)*(1-smooth(b,b+soft,v))
EYE_Z=1.858;BROW_Z=1.882;MOUTH_Z=1.803;NOSE_Y=-.168
face=[(v,basis.data[v.index].co.copy()) for v in me.vertices if basis.data[v.index].co.y<-.07 and 1.735<basis.data[v.index].co.z<1.935 and abs(basis.data[v.index].co.x)<.095]
def front(p):   # only skin on the front of the face, never the skull sides
    return smooth(-.10,-.125,p.y)
def side_w(p,side):  # 1 on the requested side (character's left is +x), soft across the midline
    return smooth(-.004,.004,p.x) if side>0 else 1-smooth(-.004,.004,p.x)
def add_key(name,displace):
    key=mesh.shape_key_add(name=name,from_mix=False);key.relative_key=basis;moved=0
    for v,p in face:
        d=displace(p)
        if d.length>1e-6:key.data[v.index].co=p+d;moved+=1
    return moved
def blink(side):
    def f(p):
        ax=abs(p.x);w=side_w(p,side)*front(p)*band(ax,.014,.064,.012)
        if w<=0:return Vector((0,0,0))
        upper=band(p.z,EYE_Z+.003,EYE_Z+.014,.003);lower=band(p.z,EYE_Z-.016,EYE_Z-.003,.003)
        d=Vector((0,0,0));close=EYE_Z
        if upper>0:d+=Vector((0,.0012*upper*w,(close-p.z)*.9*upper*w))
        if lower>0:d+=Vector((0,.0012*lower*w,(close-p.z)*.9*lower*w))
        return d
    return f
def eye_wide(side):
    def f(p):
        ax=abs(p.x);w=side_w(p,side)*front(p)*band(ax,.014,.064,.012)
        upper=band(p.z,EYE_Z+.003,EYE_Z+.02,.004);lower=band(p.z,EYE_Z-.02,EYE_Z-.003,.004)
        return Vector((0,0,.005*upper*w-.004*lower*w))
    return f
def squint(side):
    def f(p):
        ax=abs(p.x);w=side_w(p,side)*front(p)*band(ax,.012,.066,.01)*(1-smooth(.012,.022,abs(p.z-EYE_Z)))
        return Vector((0,0,-(p.z-EYE_Z)*.35*w))
    return f
def brow_down(side):
    def f(p):
        ax=abs(p.x);s=1 if p.x>0 else -1;w=side_w(p,side)*front(p)*band(p.z,1.870,1.900,.006)*band(ax,.006,.072,.008)
        return Vector((-s*.004*w,0,-.011*w*(1-ax/.09)))
    return f
def brow_inner_up(p):
    ax=abs(p.x);w=front(p)*band(p.z,1.870,1.902,.006)*band(ax,.004,.034,.012)
    return Vector((0,-.001*w,.010*w))
def brow_outer_up(side):
    def f(p):
        ax=abs(p.x);w=side_w(p,side)*front(p)*band(p.z,1.870,1.902,.006)*band(ax,.036,.080,.012)
        return Vector((0,0,.008*w))
    return f
def jaw_open(p):
    ax=abs(p.x);jaw=band(p.z,1.745,1.800,.012)*(1-smooth(.035,.062,ax))*front(p)
    lip=band(p.z,1.800,1.810,.004)*(1-smooth(.025,.045,ax))*front(p)
    return Vector((0,.003*jaw,-.017*jaw))+Vector((0,0,.003*lip))
def mouth_corner(side,up):
    def f(p):
        ax=abs(p.x);s=1 if p.x>0 else -1;w=side_w(p,side)*front(p)*band(p.z,1.790,1.816,.006)*band(ax,.018,.050,.010)
        cheek=side_w(p,side)*front(p)*band(p.z,1.815,1.842,.008)*band(ax,.028,.072,.012)
        if up:return Vector((s*.004*w,0,.006*w))+Vector((0,-.002*cheek,.003*cheek))
        return Vector((-s*.002*w,0,-.005*w))
    return f
def pucker(p):
    ax=abs(p.x);w=front(p)*band(p.z,1.793,1.813,.006)*(1-smooth(.018,.036,ax))
    return Vector((-p.x*.35*w,-.004*w,0))
def cheek_puff(side):
    def f(p):
        ax=abs(p.x);s=1 if p.x>0 else -1;w=side_w(p,side)*front(p)*band(p.z,1.800,1.846,.010)*band(ax,.028,.088,.012)
        return Vector((s*.006*w,-.003*w,0))
    return f
KEYS={'eyeBlinkLeft':blink(1),'eyeBlinkRight':blink(-1),'eyeWideLeft':eye_wide(1),'eyeWideRight':eye_wide(-1),'eyeSquintLeft':squint(1),'eyeSquintRight':squint(-1),
 'browDownLeft':brow_down(1),'browDownRight':brow_down(-1),'browInnerUp':brow_inner_up,'browOuterUpLeft':brow_outer_up(1),'browOuterUpRight':brow_outer_up(-1),
 'jawOpen':jaw_open,'mouthSmileLeft':mouth_corner(1,True),'mouthSmileRight':mouth_corner(-1,True),'mouthFrownLeft':mouth_corner(1,False),'mouthFrownRight':mouth_corner(-1,False),
 'mouthPucker':pucker,'cheekPuffLeft':cheek_puff(1),'cheekPuffRight':cheek_puff(-1)}
report={name:add_key(name,fn) for name,fn in KEYS.items() if name not in me.shape_keys.key_blocks}
# Review renders: front close-up of the face per key, with the authored texture (workbench, fast).
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='FLAT';scene.display.shading.color_type='TEXTURE'
cam_data=bpy.data.cameras.new('cam');cam=bpy.data.objects.new('cam',cam_data);scene.collection.objects.link(cam);scene.camera=cam
cam_data.type='ORTHO';cam_data.ortho_scale=.24;scene.render.resolution_x=600;scene.render.resolution_y=600
cam.location=Vector((0,-2,1.84));cam.rotation_euler=(Vector((0,0,1.84))-cam.location).to_track_quat('-Z','Y').to_euler()
for name in ['Basis','eyeBlinkLeft','browInnerUp','jawOpen','mouthSmileLeft','cheekPuffLeft']:
    for key in me.shape_keys.key_blocks:key.value=1.0 if key.name==name else 0.0
    if name=='eyeBlinkLeft':me.shape_keys.key_blocks['eyeBlinkRight'].value=1.0
    if name=='mouthSmileLeft':me.shape_keys.key_blocks['mouthSmileRight'].value=1.0
    if name=='cheekPuffLeft':me.shape_keys.key_blocks['cheekPuffRight'].value=1.0
    scene.render.filepath=str(renders/f'face-{name}.png');bpy.ops.render.render(write_still=True)
for key in me.shape_keys.key_blocks:key.value=0.0
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(dst),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_morph=True,export_morph_normal=False,export_yup=True,export_image_format='AUTO',export_apply=False)
(renders/'face-report.json').write_text(json.dumps({'moved':report,'keys':[k.name for k in me.shape_keys.key_blocks]},indent=1))
print('FACE2 '+json.dumps(report))
