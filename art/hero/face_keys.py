import bpy, json
from pathlib import Path
from mathutils import Vector
# Procedural expression shape keys on the Meshy face. The eyes and mouth are painted on the
# texture, so expressions come from moving the surrounding skin: brows knit and eyes narrow for
# "focus"; the jaw drops and the brow stays knitted for "shout". No blink is possible.
root=Path(__file__).resolve().parents[2];out=root/'art/hero/meshy-manual'
bpy.ops.wm.open_mainfile(filepath=str(out/'rigged-fingers.blend'),load_ui=False,use_scripts=False)
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
verts=mesh.data.vertices
def smooth(a,b,v):
    t=max(0.0,min(1.0,(v-a)/(b-a)));return t*t*(3-2*t)
def face_vertices():
    for v in verts:
        p=v.co
        if p.y<-.07 and 1.74<p.z<1.93 and abs(p.x)<.09:yield v,p
basis=mesh.shape_key_add(name='Basis',from_mix=False)
def add_key(name,displace):
    key=mesh.shape_key_add(name=name,from_mix=False);moved=0
    for v,p in face_vertices():
        d=displace(p)
        if d.length>1e-6:key.data[v.index].co=p+d;moved+=1
    return moved
EYE_Z=1.858;BROW_Z=1.882;MOUTH_Z=1.803
def focus(p):
    d=Vector((0,0,0));ax=abs(p.x);side=1 if p.x>0 else -1
    # Brows: down and inward, most at the inner ends.
    brow=smooth(1.868,1.878,p.z)*(1-smooth(1.893,1.905,p.z))*smooth(.005,.018,ax)*(1-smooth(.06,.078,ax))
    if brow>0:d+=Vector((-side*.004*brow,0,-.011*brow*(1-ax/.09)))
    # Eyes: narrow toward their centre line.
    eye=smooth(.010,.020,ax)*(1-smooth(.062,.075,ax))*(1-smooth(.012,.022,abs(p.z-EYE_Z)))
    if eye>0:d+=Vector((0,0,-(p.z-EYE_Z)*.35*eye))
    return d
def shout(p):
    d=focus(p)*.8;ax=abs(p.x)
    # Jaw and lower lip drop; the chin follows less.
    jaw=(1-smooth(1.800,1.812,p.z))*smooth(1.745,1.775,p.z)*(1-smooth(.035,.06,ax))
    if jaw>0:d+=Vector((0,.003*jaw,-.016*jaw))
    lip=(1-smooth(1.812,1.822,p.z))*smooth(1.800,1.808,p.z)*(1-smooth(.025,.045,ax))
    if lip>0:d+=Vector((0,0,.003*lip))
    return d
report={'focus':add_key('focus',focus),'shout':add_key('shout',shout)}
# Renders of each expression for review.
scene=bpy.context.scene;cam=scene.camera;cam.data.type='ORTHO';cam.data.ortho_scale=.26
scene.render.resolution_x=700;scene.render.resolution_y=700
cam.location=Vector((0,-2,1.85));cam.rotation_euler=(Vector((0,0,1.85))-cam.location).to_track_quat('-Z','Y').to_euler()
for name in ['Basis','focus','shout']:
    for key in mesh.data.shape_keys.key_blocks:key.value=1.0 if key.name==name else 0.0
    scene.render.filepath=str(out/f'face-{name.lower()}.png');bpy.ops.render.render(write_still=True)
for key in mesh.data.shape_keys.key_blocks:key.value=0.0
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(out/'rigged-face.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True,export_image_format='AUTO',export_morph=True,export_morph_normal=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'rigged-face.blend'))
(out/'face-report.json').write_text(json.dumps(report,indent=2));print('FACE_COMPLETE',json.dumps(report))
