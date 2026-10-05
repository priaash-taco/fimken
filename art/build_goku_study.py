"""Independent character-art study; does not overwrite the live actor or assets.

Blender --background --factory-startup --disable-autoexec --python this_file
Optional: -- --draft (smaller contact renders)
"""
from pathlib import Path
import math, sys, json, faulthandler
faulthandler.enable()
faulthandler.dump_traceback_later(90, repeat=True)
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'studies' / 'goku-v2'
PREVIEW = ROOT / 'art' / 'previews' / 'goku-v2'
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW.mkdir(parents=True, exist_ok=True)

# Reuse the existing mesh/rig construction primitives, in isolated output paths.
# The revision below changes authored geometry, not the illustration reference.
source = (ROOT / 'art' / 'build_goku.py').read_text(encoding='utf-8')
source = source.replace("OUT=ROOT/'public'/'characters'", "OUT=ROOT/'public'/'studies'/'goku-v2'")
source = source.replace("PREVIEW=ROOT/'art'/'previews'", "PREVIEW=ROOT/'art'/'previews'/'goku-v2'")
source = source.replace("folds=.043", "folds=.008").replace("folds=.062", "folds=.008")
# A quieter, warmer base allows actual light and sculpted planes to carry form.
source = source.replace("'FFCF32'", "'11151F'").replace("'FFE786'", "'344F74'")
source = source.replace("'C78B0F'", "'080C14'").replace("'E8A167'", "'DEA477'")
source = source.replace("mat('hair_gold'", "mat('hair_ink'")
source = source.replace("'995830'", "'815437'").replace("'F78A16'", "'DB690E'")
source = source.replace("'B94F0C'", "'803613'").replace("'163350'", "'122238'")
prefix, remainder = source.split('# Neck and trapezius', 1)
scope = {'__file__': str(ROOT / 'art' / 'build_goku.py')}
exec(compile(prefix, 'goku-base-primitives', 'exec'), scope)
M, PARTS = scope['M'], scope['PARTS']
mesh, loft, curve, sphere = [scope[key] for key in ('mesh', 'loft', 'curve', 'sphere')]

# Surface-following folds, with localized compression rather than global ripples.
original_loft = loft
def sculpted_loft(name, rows, material, bone='chest', weights=None, folds=0, n=64):
    obj = original_loft(name, rows, material, bone, weights, folds, n)
    if name.startswith(('Sculpted gi trousers', 'Gi torso')):
        is_leg = name.startswith('Sculpted')
        side = -1 if name.endswith('L') else 1
        for vert in obj.data.vertices:
            x, y, z = vert.co
            if is_leg:
                center = side * (.60 - max(0, z-1.5)*.13)
                angle = math.atan2(y, x-center)
                u = (z-1.29)/2.18
                displacement = 0
                for i in range(9):
                    line = -math.pi + i*.72 + .28*math.sin(u*3.8+i)
                    distance = math.atan2(math.sin(angle-line), math.cos(angle-line))
                    taper = max(0, math.sin(max(0,min(1,u))*math.pi)) ** .6
                    displacement += .047 * math.exp(-(distance/.115)**2) * taper
                    displacement -= .022 * math.exp(-((distance-.17)/.16)**2) * taper
                # Gathered ankle and compression folds around the knee.
                for level, width, amplitude, slope in [(1.46,.055,.045,.10),(1.66,.075,.038,-.1),(1.89,.06,.035,.10),(2.14,.10,.030,-.1)]:
                    displacement += amplitude*math.exp(-((z-level-slope*math.sin(angle))/width)**2)
                dx,dy = x-center,y
            else:
                angle=math.atan2(y,x); u=(z-3.48)/2.02
                dx,dy=x,y
                displacement=0
                for i in range(12):
                    line=-math.pi+i*math.pi/6+.27*math.sin(u*2.8+i*.3)
                    distance=math.atan2(math.sin(angle-line), math.cos(angle-line))
                    envelope=max(0,1-u)**.55*min(1,max(0,u)*8)
                    displacement += .039*math.exp(-(distance/.085)**2)*envelope
                    displacement -= .014*math.exp(-((distance-.14)/.13)**2)*envelope
            length=max(.001,math.hypot(dx,dy))
            vert.co.x+=dx/length*displacement
            vert.co.y+=dy/length*displacement
    return obj
scope['loft'] = sculpted_loft

geometry_code, rest = remainder.split('# Named skeleton', 1)
exec(compile('# Neck and trapezius'+geometry_code, 'goku-v2-surfaces', 'exec'), scope)

# Remove the raised line tubes that made the old study look like a plastic toy.
remove_prefixes = ('Hair engraved strand', 'Hair ridge light', 'Cheek contour',
    'Under eye definition', 'Chest cloth crease', 'Trouser diagonal crease',
    'Knee compression fold', 'Lower trouser fold', 'Navy collar ridge',
    'Gi overlapping lapel', 'Gi lapel inner shadow', 'Gi right lapel')
for obj in list(PARTS):
    if obj.name.startswith(remove_prefixes):
        PARTS.remove(obj); bpy.data.objects.remove(obj, do_unlink=True)

# Anatomical proportions: shorten the exposed neck and give the jaw more mass.
for obj in PARTS:
    name=obj.name
    for vert in obj.data.vertices:
        p=vert.co
        if name.startswith(('Neck anatomy','Neck tendon')):
            p.z=5.53+(p.z-5.53)*.48
            p.x*=1.12
        elif any(group.name=='head' for group in obj.vertex_groups):
            p.z-=.34
        if name.startswith('Goku facial surface'):
            # More decisive jaw corners and a less flat cheek plane.
            if p.z<6.11: p.x*=1.1
            if p.y<0: p.y-=.025*math.exp(-((p.z-6.07)/.13)**2)
        if name.startswith(('Eye silhouette','Eye sclera','Turquoise iris','Iris pupil','Eye catchlight')):
            p.z=6.28+(p.z-6.28)*.64
        if name.startswith('Golden brow'):
            p.z-=.034
        if name.startswith('Nose') and p.y<-.46:
            p.y=-.46+(p.y+.46)*.66
        if name.startswith('Ear'):
            p.z=6.21+(p.z-6.21)*.83
        if name.startswith('Super Saiyan lock'):
            # Tighter clumps, more depth and a less fan-shaped silhouette.
            p.x*=.88; p.y*=1.18
            p.z=6.48+(p.z-6.48)*.86
    obj.data.update()

# Rebuild the open collar so it is a folded garment surface, not floating strips.
for obj in list(PARTS):
    if obj.name.startswith(('Navy chest opening','Exposed clavicle','Clavicle')):
        PARTS.remove(obj); bpy.data.objects.remove(obj, do_unlink=True)

def chest_y(x,z):
    radius=.37+.10*math.exp(-((z-4.95)/.7)**2)
    width=.98 if z>4.8 else .84
    return -radius*math.sqrt(max(.05,1-(x/width)**2))-.025

def cloth_strip(name, path, width, material):
    rows=scope['catmull'](path,6); vs=[]; fs=[]
    for j,(x,z) in enumerate(rows):
        prev=rows[max(0,j-1)]; nxt=rows[min(len(rows)-1,j+1)]
        tx,tz=nxt[0]-prev[0],nxt[1]-prev[1]; ln=max(.001,math.hypot(tx,tz))
        for k in range(9):
            v=k/8; dx=-tz/ln*(v-.5)*width; dz=tx/ln*(v-.5)*width
            xx,zz=x+dx,z+dz
            vs.append((xx,chest_y(xx,zz)-math.sin(v*math.pi)*.038,zz))
            if j and k: fs.append(((j-1)*9+k-1,(j-1)*9+k,j*9+k,j*9+k-1))
    return mesh(name,vs,fs,material,'chest')

# A curved triangular navy undershirt follows the torso beneath the crossed lapels.
vs=[]; fs=[]; count=32
for j in range(count):
    u=j/(count-1); z=4.60+u*.96; width=.025+u*.63
    for k in range(count):
        x=(k/(count-1)*2-1)*width
        vs.append((x,chest_y(x,z)-.009,z))
        if j and k: fs.append(((j-1)*count+k-1,(j-1)*count+k,j*count+k,j*count+k-1))
mesh('Fitted navy undershirt',vs,fs,M['blue'])
cloth_strip('Folded left lapel',[(-.76,5.48),(-.47,5.12),(-.16,4.70),(.31,4.14)],.16,M['orange'])
cloth_strip('Folded right lapel',[(.76,5.48),(.52,5.17),(.23,4.83),(.02,4.64)],.16,M['orange'])

# Add a real trapezius transition and defined muscle masses to the upper body.
for side in (-1,1):
    trap=sphere('Trapezius volume',(side*.40,.045,5.54),(.38,.27,.20),M['skin'],'neck',40,24)
    # Mesh coordinates are already in world space; rotating the object would
    # swing this muscle around the world origin and create shoulder protrusions.
    suffix='L' if side<0 else 'R'
    # Small overlapping forms break the uniform cylindrical arm silhouette.
    sphere('Deltoid anterior',(side*1.21,-.20,5.03),(.235,.23,.31),M['skin'],'upperarm.'+suffix,40,24)
    sphere('Biceps belly',(side*1.30,-.20,4.80),(.245,.22,.34),M['skin'],'upperarm.'+suffix,40,24)
    sphere('Triceps long head',(side*1.26,.18,4.92),(.24,.23,.38),M['skin'],'upperarm.'+suffix,40,24)

# Give individual hair clumps fine longitudinal facets instead of raised tubes.
for obj in PARTS:
    if not obj.name.startswith('Super Saiyan lock'): continue
    obj.data.materials.clear()
    for key in ('gold','goldshade','goldhi'): obj.data.materials.append(M[key])
    for face in obj.data.polygons:
        cross_index=face.index%12
        face.material_index=1 if cross_index in (0,6,7,8) else 2 if cross_index==3 else 0
        face.use_smooth=True

# Build the existing skeleton and clips, but save only to the isolated study.
rig_code, _ = rest.split('# Convert preview materials',1)
rig_code=rig_code.replace("rig['art_revision']='supersaiyan-rebuild-1'", "rig['art_revision']='anatomy-study-2'")
# Export later after adjusting the rest skeleton and clearing the preview pose.
rig_code=rig_code[:rig_code.index('bpy.ops.export_scene.gltf')]
exec(compile('# Named skeleton'+rig_code,'goku-v2-rig','exec'),scope)
rig,surface=scope['rig'],scope['surface']
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks: track.mute=True
for pb in rig.pose.bones: pb.rotation_euler=(0,0,0)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
rig.data.edit_bones['neck'].tail.z-=.34
rig.data.edit_bones['head'].head.z-=.34
rig.data.edit_bones['head'].tail.z-=.34
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()

bpy.ops.object.select_all(action='DESELECT'); surface.select_set(True); rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'goku-study.glb'),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_skins=True,export_extras=True)
# Export evaluates animation; explicitly reset before the neutral multi-view study.
print('EXPORT FINISHED; resetting pose', flush=True)
rig.animation_data_clear()
for pb in rig.pose.bones: pb.rotation_euler=(0,0,0)
bpy.context.view_layer.update()
print('NEUTRAL POSE READY', flush=True)

# Restrained cel materials with broad authored colour regions and contact shading.
for key,material in M.items():
    print('PREVIEW MATERIAL', key, flush=True)
    color=material.diffuse_color[:]
    nodes=material.node_tree.nodes; links=material.node_tree.links; nodes.clear()
    diffuse=nodes.new('ShaderNodeBsdfDiffuse'); diffuse.inputs['Color'].default_value=(1,1,1,1)
    to_rgb=nodes.new('ShaderNodeShaderToRGB'); links.new(diffuse.outputs[0],to_rgb.inputs[0])
    ramp=nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation='EASE'
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
    bands=[(0,.22),(.22,.29),(.27,.57),(.50,.69),(.55,1.0),(.88,1.12)]
    for i,(position,factor) in enumerate(bands):
        e=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(position)
        e.position=position
        e.color=tuple(min(1,c*factor) for c in color[:3])+(1,)
    links.new(to_rgb.outputs[0],ramp.inputs[0])
    ao=nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value=.20
    mix=nodes.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=.65
    links.new(ramp.outputs[0],mix.inputs[1]); links.new(ao.outputs['Color'],mix.inputs[2])
    emission=nodes.new('ShaderNodeEmission'); links.new(mix.outputs[0],emission.inputs[0])
    output=nodes.new('ShaderNodeOutputMaterial'); links.new(emission.outputs[0],output.inputs[0])

scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE_NEXT'
print('PREVIEW MATERIALS READY', flush=True)
scene.world.color=(.035,.035,.035); scene.view_settings.view_transform='Standard'
scene.render.resolution_x=900 if '--draft' in sys.argv else 1600
scene.render.resolution_y=1100 if '--draft' in sys.argv else 2000
scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
world=scene.world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.028,.034,.047,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0))
ground=bpy.context.object
floor=bpy.data.materials.new('Neutral studio'); floor.diffuse_color=(.042,.05,.062,1)
ground.data.materials.append(floor)
for loc,power,size,color in [((-4,-6,10),900,4,(1.,.88,.73)),((4,-2,6),140,5,(.70,.82,1.)),((2,4,9),1100,3,(1.,.81,.50))]:
    bpy.ops.object.light_add(type='AREA',location=loc); light=bpy.context.object
    light.data.energy=power; light.data.shape='DISK'; light.data.size=size; light.data.color=color
    light.rotation_euler=(Vector((0,0,4.5))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-18,5)); camera=bpy.context.object; scene.camera=camera
camera.data.type='ORTHO'; camera.data.ortho_scale=8.65
def render(name,position,target=(0,0,4.0),scale=8.65):
    camera.location=position; camera.data.ortho_scale=scale
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(PREVIEW/(name+'.png')); bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art'/'goku-study-v2.blend'))
render('front',(0,-18,5.3))
render('three-quarter',(10,-17,6.3))
render('rear',(-7,18,6.2))
render('face',(3.8,-17,7.0),(0,0,6.05),3.75)
report={'status':'unaccepted character study','vertices':len(surface.data.vertices),'polygons':len(surface.data.polygons),
    'source':'local geometry authoring, no projected illustration','asset':str(OUT/'goku-study.glb'),
    'limitations':['Uses the previous basic animation rig','Preview cel shader differs from exported PBR shading','Not yet accepted against the reference']}
(PREVIEW/'report.json').write_text(json.dumps(report,indent=2))
print('CHARACTER STUDY COMPLETE',json.dumps(report))
