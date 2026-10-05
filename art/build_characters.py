"""Reproducible local character workshop. Run with Blender --background --python.

All geometry, textures, rigs and clips are authored here; no API or asset downloads.
This is a stylised V1 art pass, not a reconstruction of production anime meshes.
Blender 4.5 LTS. Character definitions live beside this script in characters/.
"""
import bpy
import bmesh
import math
import json
import sys
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'characters'
PREVIEWS = ROOT / 'art' / 'previews'
OUT.mkdir(parents=True, exist_ok=True)
PREVIEWS.mkdir(parents=True, exist_ok=True)
PI = math.pi
OBJECTS = []


def rgb(value):
    return tuple(int(value[i:i+2], 16) / 255 for i in (0, 2, 4))


def linear(value):
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in value)


def material(name, color, kind='flat'):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear(rgb(color)), 1)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*linear(rgb(color)), 1)
    bs.inputs['Roughness'].default_value = .82 if kind != 'metal' else .34
    if kind == 'metal':
        bs.inputs['Metallic'].default_value = .35
    if kind in ('skin', 'cloth', 'hair'):
        size = 256
        yy, xx = np.mgrid[0:size, 0:size] / size
        rng = np.random.default_rng(23)
        grain = rng.random((size, size)) * .016
        shade = .93 + .045 * np.sin(yy * PI) + grain
        if kind == 'cloth':
            shade += .023 * np.sin(xx * PI * 128) * np.cos(yy * PI * 128)
        if kind == 'hair':
            shade += .08 * np.maximum(0, np.sin(xx * PI * 18)) ** 12
        pixels = np.ones((size, size, 4), dtype=np.float32)
        # Generated image buffers use the declared sRGB colour space on save.
        pixels[:, :, :3] = np.asarray(rgb(color))[None, None, :] * shade[:, :, None]
        img = bpy.data.images.new(name + '_paint', size, size)
        img.pixels.foreach_set(pixels.ravel())
        img.filepath_raw = str(OUT / f'{name}.png')
        img.file_format = 'PNG'
        img.save()
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = img
        mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
    return mat


def bind(obj, bone='chest', weights=None):
    if weights:
        groups = {}
        for v in obj.data.vertices:
            for name, value in weights(v.co).items():
                if value <= 0: continue
                if name not in groups: groups[name] = obj.vertex_groups.new(name=name)
                groups[name].add([v.index], value, 'REPLACE')
    else:
        obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    OBJECTS.append(obj)
    return obj


def geo(name, vertices, faces, mat, bone='chest', weights=None, uvs=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    if uvs:
        layer = data.uv_layers.new(name='UVMap')
        for face in data.polygons:
            for index in face.loop_indices:
                layer.data[index].uv = uvs[data.loops[index].vertex_index]
    for face in data.polygons: face.use_smooth = True
    return bind(obj, bone, weights)


def ellipsoid(name, center, scale, mat, bone='chest', segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth = True
    return bind(obj, bone)


def loft(name, rows, mat, bone='chest', count=40, weights=None, folds=0):
    # Each row: x, y, z, width, depth. Closed sections share vertices.
    vs, fs, uv = [], [], []
    for j, (x, y, z, rx, ry) in enumerate(rows):
        for k in range(count + 1):
            a = k / count * 2 * PI
            ripple = 1 + folds * math.sin(a * 9 + j * .55) * math.sin(j / max(1, len(rows)-1) * PI)
            vs.append((x + math.cos(a) * rx * ripple, y + math.sin(a) * ry * ripple, z))
            uv.append((k / count, j / max(1, len(rows)-1)))
            if j:
                v = j * (count + 1) + k
                if k < count: fs.append((v, v+1, v-count, v-count-1))
    fs.append(tuple(reversed(range(count))))
    fs.append(tuple((len(rows)-1) * (count+1) + k for k in range(count)))
    return geo(name, vs, fs, mat, bone, weights, uv)


def tube(name, points, radius, mat, bone='chest', taper=None, sides=10):
    vs, fs, uv = [], [], []
    for j, point in enumerate(points):
        p = Vector(point)
        tangent = Vector(points[min(j+1, len(points)-1)]) - Vector(points[max(0, j-1)])
        tangent.normalize()
        n = tangent.cross(Vector((0, 1, 0)))
        if n.length < .01: n = tangent.cross(Vector((1, 0, 0)))
        n.normalize()
        b = tangent.cross(n).normalized()
        r = radius * (taper[j] if taper else 1)
        for k in range(sides+1):
            a = k/sides*2*PI
            vs.append(p + n * math.cos(a) * r + b * math.sin(a) * r)
            uv.append((k/sides, j/(len(points)-1)))
            if j and k < sides:
                v = j*(sides+1)+k
                fs.append((v, v+1, v-sides, v-sides-1))
    fs.append(tuple(reversed(range(sides))))
    fs.append(tuple((len(points)-1)*(sides+1)+k for k in range(sides)))
    return geo(name, vs, fs, mat, bone, uvs=uv)


def patch(name, points, mat, bone='chest'):
    # Slightly thickened angular shapes retain their shape from side views.
    front = [tuple(p) for p in points]
    back = [(x, y+.035, z) for x, y, z in points]
    n = len(front)
    faces = [tuple(range(n)), tuple(reversed(range(n, n*2)))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    return geo(name, front+back, faces, mat, bone)


def ring(name, center, width, depth, thickness, mat, bone):
    x,y,z = center
    return loft(name, [(x,y,z-thickness/2,width,depth),(x,y,z+thickness/2,width,depth)], mat, bone)


def limb_weights(side, joint, lower, upper):
    def weights(p):
        blend = max(0, min(1, (p.z-joint+.18)/.36))
        return {f'{upper}.{side}': blend, f'{lower}.{side}': 1-blend}
    return weights


def make_rig(feline):
    data = bpy.data.armatures.new('Humanoid')
    rig = bpy.data.objects.new('Armature', data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name, head, tail, parent=None):
        b=data.edit_bones.new(name); b.head=head; b.tail=tail
        if parent: b.parent=data.edit_bones[parent]
    bone('hips',(0,0,2.8),(0,0,3.3))
    bone('chest',(0,0,3.3),(0,0,4.65),'hips')
    bone('neck',(0,0,4.65),(0,0,5.08),'chest')
    bone('head',(0,0,5.08),(0,0,5.85),'neck')
    for s,label in [(-1,'L'),(1,'R')]:
        shoulder=.62 if feline else .76
        bone('upperarm.'+label,(s*shoulder,0,4.53),(s*.96,0,3.8),'chest')
        bone('forearm.'+label,(s*.96,0,3.8),(s*1.11,-.04,3.12),'upperarm.'+label)
        bone('hand.'+label,(s*1.11,-.04,3.12),(s*1.12,-.06,2.83),'forearm.'+label)
        bone('thigh.'+label,(s*.30,0,2.85),(s*.43,0,1.67),'hips')
        bone('shin.'+label,(s*.43,0,1.67),(s*.48,0,.55),'thigh.'+label)
        bone('foot.'+label,(s*.48,0,.55),(s*.48,-.5,.25),'shin.'+label)
    if feline:
        for i in range(6):
            bone(f'tail{i}',(i*.18,.25+i*.35,2.85-i*.08),((i+1)*.18,.6+i*.35,2.77-i*.08),'hips' if i==0 else f'tail{i-1}')
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.select_set(False)
    return rig


def face(m, feline):
    if feline:
        rows=[(0,0,5.05,.12,.14),(0,0,5.13,.23,.22),(0,0,5.3,.32,.26),(0,0,5.52,.36,.27),(0,.01,5.74,.33,.25),(0,.03,5.94,.25,.19),(0,.03,6.02,.06,.05)]
    else:
        rows=[(0,0,5.04,.12,.15),(0,0,5.11,.25,.25),(0,0,5.25,.34,.3),(0,0,5.44,.405,.31),(0,.015,5.62,.405,.32),(0,.035,5.8,.365,.31),(0,.05,5.96,.25,.23),(0,.05,6.01,.04,.04)]
    loft('Sculpted head',rows,m['skin'],'head',48)
    for s in [-1,1]:
        if feline:
            # Ears: a volumetric outer shell and recessed inner cartilage.
            patch('Ear silhouette',[(s*.13,.03,5.8),(s*.24,.09,6.77),(s*.40,.09,6.7),(s*.44,.02,5.76)],m['skin'],'head')
            patch('Ear inner',[(s*.24,-.011,5.97),(s*.28,.036,6.56),(s*.35,.026,6.52),(s*.36,-.02,5.96)],m['ear'],'head')
            eye=[(s*.075,-.267,5.54),(s*.30,-.217,5.60),(s*.265,-.262,5.43),(s*.13,-.302,5.43)]
        else:
            ellipsoid('Ear',(s*.413,.012,5.45),(.09,.075,.165),m['skin'],'head')
            tube('Ear cartilage',[(s*.43,-.06,5.52),(s*.47,-.06,5.47),(s*.43,-.068,5.36)],.012,m['shadow'],'head')
            eye=[(s*.055,-.318,5.53),(s*.31,-.259,5.58),(s*.29,-.295,5.43),(s*.075,-.333,5.43)]
        patch('Eye ink',[(x*1.04,y-.01,z+(z-5.50)*.14) for x,y,z in eye],m['ink'],'head')
        patch('Eye white',[(x,y-.021,z) for x,y,z in eye],m['yellow'] if feline else m['white'],'head')
        ellipsoid('Pupil',(s*.17,-.341 if not feline else -.312,5.49),(.026 if feline else .038,.015,.073 if feline else .053),m['ink'],'head',16,10)
        if not feline:
            patch('Brow',[(s*.046,-.332,5.56),(s*.32,-.263,5.65),(s*.33,-.257,5.60),(s*.073,-.343,5.52)],m['hair'],'head')
            tube('Cheek definition',[(s*.29,-.279,5.32),(s*.19,-.318,5.28)],.008,m['shadow'],'head')
        else:
            tube('Cat brow',[(s*.06,-.279,5.56),(s*.18,-.265,5.63),(s*.30,-.22,5.64)],.024,m['shadow'],'head')
            ellipsoid('Muzzle',(s*.11,-.255,5.24),(.16,.105,.1),m['skin'],'head')
    if feline:
        patch('Cat nose',[(-.077,-.363,5.35),(.077,-.363,5.35),(0,-.386,5.29)],m['shadow'],'head')
        tube('Mouth', [(-.14,-.321,5.2),(0,-.353,5.18),(.14,-.321,5.2)],.01,m['ink'],'head')
    else:
        geo('Nose',[(-.045,-.3,5.5),(.045,-.3,5.5),(0,-.435,5.34),(-.054,-.337,5.31),(.054,-.337,5.31)],[(0,2,1),(0,3,2),(2,4,1),(3,4,2)],m['skin'],'head')
        tube('Mouth',[(-.12,-.293,5.19),(0,-.322,5.18),(.12,-.293,5.20)],.009,m['ink'],'head')
        tube('Lower lip',[(-.047,-.302,5.135),(.055,-.302,5.135)],.006,m['shadow'],'head')
        # A dark mass underneath individually shaped angular locks.
        ellipsoid('Hair foundation',(0,.09,5.79),(.425,.345,.37),m['hair'],'head',32,20)
        locks=[((-.27,-.04,5.80),(-.90,.08,6.03),.23),((-.29,.05,5.93),(-.76,.16,6.42),.24),((-.10,.04,6.01),(-.29,.12,6.68),.245),((.09,.04,6.03),(.35,.14,6.68),.25),((.29,.07,5.98),(.78,.12,6.36),.26),((.34,.09,5.80),(.90,.12,5.97),.24),((-.25,-.24,5.91),(-.31,-.37,5.55),.155),((-.03,-.30,5.96),(-.10,-.405,5.61),.16),((.17,-.27,5.98),(.30,-.35,5.55),.19),((.33,-.12,5.83),(.41,-.25,5.48),.14),((-.32,.27,5.65),(-.60,.49,5.64),.19),((.32,.27,5.65),(.58,.49,5.67),.19)]
        for index,(a,b,w) in enumerate(locks):
            middle=Vector(a).lerp(Vector(b),.5)+Vector((0,-.015,.075))
            tube(f'Hair lock {index}',[a,middle,b],w,m['hair'],'head',[.9,.75,.013],sides=6)


def body(m, feline):
    chest=.52 if feline else .69
    loft('Torso',[(0,0,2.83,.33,.25),(0,0,3.03,.37,.27),(0,0,3.3,.35 if feline else .43,.255),(0,0,3.7,.38 if feline else .51,.28),(0,0,4.1,chest,.34),(0,0,4.40,chest+.045,.31),(0,0,4.58,chest*.77,.24),(0,0,4.7,.23,.18)],m['skin'] if feline else m['cloth'],count=48,folds=0 if feline else .016)
    loft('Neck',[(0,0,4.59,.17,.17),(0,0,4.87,.155,.16),(0,0,5.13,.16,.16)],m['skin'],'neck',32)
    if not feline:
        # Blue undershirt collar with exposed clavicles; orange wrapping lapels.
        patch('Undershirt',[(-.45,-.275,4.59),(0,-.371,3.75),(.45,-.275,4.59),(.23,-.21,4.71),(-.23,-.21,4.71)],m['trim'])
        patch('Chest skin',[(-.20,-.273,4.62),(0,-.346,4.16),(.20,-.273,4.62)],m['skin'])
        tube('Left collar',[(-.43,-.29,4.64),(-.25,-.35,4.26),(.13,-.38,3.63)],.045,m['cloth'])
        tube('Right collar',[(.44,-.29,4.64),(.21,-.35,4.2),(.02,-.38,3.96)],.045,m['cloth'])
        for s in [-1,1]:
            for j in range(3):
                tube('Gi seam',[(s*(.55-j*.1),-.24,4.04-j*.15),(s*(.31-j*.08),-.30,3.62-j*.13),(s*.22,-.29,3.29)],.012,m['fold'])
        ring('Blue sash',(0,0,3.0),.415,.295,.28,m['trim'],'hips')
        ellipsoid('Sash knot',(.15,-.32,3.02),(.135,.09,.12),m['trim'],'hips')
        patch('Sash end',[(.17,-.34,3.0),(.31,-.36,2.92),(.41,-.37,2.39),(.22,-.37,2.50)],m['trim'],'hips')
    else:
        # Layered Egyptian collar with a blue face and double gold rim.
        loft('Collar',[(0,0,4.34,.66,.34),(0,0,4.44,.64,.34),(0,0,4.73,.25,.20),(0,0,4.78,.24,.20)],m['trim'])
        ring('Collar lower gold',(0,0,4.36),.665,.345,.075,m['gold'],'chest')
        ring('Collar neck gold',(0,0,4.755),.25,.20,.06,m['gold'],'chest')
        patch('Collar black panel',[(-.30,-.331,4.5),(0,-.383,4.16),(.30,-.331,4.5),(0,-.263,4.75)],m['ink'])
        patch('Collar white diamond',[(0,-.39,4.64),(.13,-.39,4.47),(0,-.40,4.3),(-.13,-.39,4.47)],m['white'])
        patch('Collar orange diamond',[(0,-.413,4.58),(.078,-.413,4.47),(0,-.415,4.36),(-.078,-.413,4.47)],m['orange'])
        for s in [-1,1]:
            tube('Chest line',[(s*.34,-.251,4.08),(s*.12,-.298,4.05)],.01,m['shadow'])
        ring('Waist belt',(0,0,2.98),.42,.30,.18,m['trim'],'hips')
        ring('Belt rim',(0,0,3.07),.43,.31,.06,m['gold'],'hips')
        patch('Apron border',[(-.34,-.35,3.05),(.34,-.35,3.05),(.31,-.40,2.12),(0,-.42,1.92),(-.31,-.40,2.12)],m['white'],'hips')
        patch('Apron', [(-.29,-.39,3.02),(.29,-.39,3.02),(.26,-.43,2.17),(0,-.45,1.995),(-.26,-.43,2.17)],m['ink'],'hips')
        patch('Apron diamond',[(0,-.456,2.89),(.17,-.456,2.58),(0,-.456,2.29),(-.17,-.456,2.58)],m['trim'],'hips')
    for s,label in [(-1,'L'),(1,'R')]:
        upper='upperarm.'+label; lower='forearm.'+label; hand='hand.'+label
        rad=.13 if feline else .26
        rows=[(s*(.6 if feline else .72),0,4.53,rad,rad),(s*.78,0,4.38,rad*1.19,rad*1.17),(s*.87,0,4.11,rad*1.05,rad),(s*.96,0,3.81,rad*.71,rad*.73),(s*1.0,-.015,3.64,rad*.95,rad*.88),(s*1.07,-.035,3.37,rad*.70,rad*.68),(s*1.11,-.04,3.11,rad*.51,rad*.56)]
        loft('Arm '+label,rows,m['skin'],upper,36,limb_weights(label,3.81,'forearm','upperarm'))
        if not feline:
            loft('Short sleeve '+label,[(s*.68,0,4.58,.31,.32),(s*.79,0,4.40,.355,.345),(s*.84,0,4.20,.33,.33)],m['cloth'],upper,32,folds=.015)
            ring('Blue sleeve rim',(s*.84,0,4.195),.335,.335,.07,m['trim'],upper)
            tube('Bicep crease',[(s*.84,-.227,4.11),(s*.94,-.182,3.95)],.009,m['shadow'],upper)
        ring('Wrist cuff',(s*1.10,-.04,3.19),rad*.68,rad*.69,.22,m['gold'] if feline else m['trim'],lower)
        ellipsoid('Fist',(s*1.13,-.055,2.93),(.13 if feline else .18,.14 if feline else .18,.22),m['skin'],hand)
        for finger in range(4):
            x=s*1.13+(finger-1.5)*(.056 if feline else .075)
            ellipsoid('Knuckle',(x,-.165 if feline else -.20,2.99),(.032 if feline else .043,.054,.08),m['skin'],hand,16,10)
        ellipsoid('Thumb',(s*.99,-.13,2.96),(.058,.10,.13),m['skin'],hand)
        pants=[(s*.30,0,2.94,.30,.30),(s*.34,0,2.69,.39 if feline else .38,.37),(s*.39,0,2.31,.43 if feline else .35,.35),(s*.43,0,1.86,.39 if feline else .30,.30),(s*.45,0,1.62,.31,.27),(s*.47,0,1.3,.32 if feline else .26,.265),(s*.48,0,.97,.27 if feline else .23,.22),(s*.48,0,.79,.19,.18)]
        loft('Trousers '+label,pants,m['cloth'],'thigh.'+label,40,limb_weights(label,1.67,'shin','thigh'),folds=.055)
        for j in range(3):
            tube('Trouser fold',[(s*(.29+j*.10),-.32,2.6),(s*(.31+j*.1),-.29,2.31),(s*(.34+j*.09),-.26,2.08)],.01,m['fold'],'thigh.'+label)
        if feline:
            loft('Lower leg',[(s*.48,0,.85,.16,.16),(s*.48,0,.5,.12,.13),(s*.48,-.04,.26,.13,.18)],m['skin'],'shin.'+label)
            ring('Ankle gold',(s*.48,0,.70),.18,.18,.15,m['gold'],'shin.'+label)
            ellipsoid('Cat foot',(s*.48,-.16,.22),(.18,.36,.16),m['skin'],'foot.'+label)
            for j in range(3): ellipsoid('Toe',(s*.48+(j-1)*.10,-.42,.20),(.065,.12,.11),m['skin'],'foot.'+label,16,10)
        else:
            loft('Boot upper',[(s*.48,0,.96,.22,.205),(s*.48,0,.78,.23,.21),(s*.48,0,.43,.18,.22),(s*.48,-.10,.24,.21,.34)],m['trim'],'shin.'+label,32)
            ellipsoid('Boot foot',(s*.48,-.20,.23),(.23,.44,.20),m['trim'],'foot.'+label)
            loft('Boot sole',[(s*.48,-.20,.07,.235,.45),(s*.48,-.20,.13,.24,.45)],m['ink'],'foot.'+label,32)
            ring('Boot orange rim',(s*.48,0,.92),.225,.215,.07,m['cloth'],'shin.'+label)
            tube('Boot piping',[(s*.48,-.218,.92),(s*.48,-.225,.55),(s*.48,-.41,.29),(s*.48,-.60,.23)],.021,m['cloth'],'foot.'+label)
    if feline:
        points=[(i*.09,.25+i*.175,2.85-i*.04) for i in range(13)]
        tail=tube('Tail',points,.092,m['skin'],'tail0',[1-i*.0375 for i in range(13)],sides=16)
        tail.vertex_groups.clear()
        for i in range(6): tail.vertex_groups.new(name=f'tail{i}')
        for v in tail.data.vertices:
            u=max(0,min(5,(v.co.y-.25)/.35-.5)); a=int(u); b=min(5,a+1)
            tail.vertex_groups[a].add([v.index],1-(u-a),'REPLACE')
            if a!=b: tail.vertex_groups[b].add([v.index],u-a,'REPLACE')
        ellipsoid('Tail tip',(1.08,2.35,2.37),(.055,.072,.055),m['skin'],'tail5',16,10)


def animate(rig, feline):
    for pb in rig.pose.bones: pb.rotation_mode='XYZ'
    specs={'hover':48,'charge':48,'rush':24,'clash':48,'recover':36,'punch':24,'kick':30,'dodge':24}
    if not feline: specs.update({'move':48,'powerup':72,'blast':48})
    for state,length in specs.items():
        rig.animation_data_create()
        action=bpy.data.actions.new(state)
        rig.animation_data.action=action
        for frame in range(1,length+2,3):
            u=(frame-1)/length; wave=math.sin(u*PI*2); pulse=math.sin(min(1,u)*PI)
            for pb in rig.pose.bones:
                pb.rotation_euler=(0,0,0); pb.location=(0,0,0)
            p=rig.pose.bones
            p['chest'].rotation_euler.x=.018*wave
            p['head'].rotation_euler.z=.025*wave
            for s,label in [(-1,'L'),(1,'R')]:
                a=p['upperarm.'+label]; f=p['forearm.'+label]
                a.rotation_euler.z=s*(.08+.018*wave)
                f.rotation_euler.x=-.18
                p['thigh.'+label].rotation_euler.x=.04*s
                if state=='powerup':
                    a.rotation_euler.x=-.12; a.rotation_euler.z=s*(.18+.14*pulse)
                    f.rotation_euler.x=-.35-.25*pulse
                    p['thigh.'+label].rotation_euler.z=s*.12
                    p['shin.'+label].rotation_euler.x=.1
                    p['chest'].rotation_euler.x=-.04*pulse
                    p['head'].rotation_euler.x=-.1*pulse
                elif state=='move':
                    a.rotation_euler.x=-.6+s*.14*wave; f.rotation_euler.x=-1.2
                    p['thigh.'+label].rotation_euler.x=s*.28*wave
                    p['shin.'+label].rotation_euler.x=.18+max(0,s*wave)*.3
                    p['chest'].rotation_euler.y=.07*wave
                elif state=='charge':
                    a.rotation_euler.x=-.55; a.rotation_euler.z=s*.33
                    f.rotation_euler.x=-1.3+.04*wave
                    p['chest'].rotation_euler.x=.07
                elif state in ('clash','blast'):
                    a.rotation_euler.x=-1.32; a.rotation_euler.z=s*.26
                    f.rotation_euler.x=-.20+.025*wave
                    p['chest'].rotation_euler.x=.12
                    p['head'].rotation_euler.x=-.10
                elif state=='rush':
                    a.rotation_euler.x=.45 if s<0 else -1.4
                    f.rotation_euler.x=-1.1 if s<0 else -.20
                    p['chest'].rotation_euler.x=.35
                    p['shin.'+label].rotation_euler.x=.65 if s<0 else .15
                elif state=='punch':
                    a.rotation_euler.x=-.6-(1.0*pulse if s>0 else 0)
                    f.rotation_euler.x=-1.3+(1.15*pulse if s>0 else 0)
                    p['chest'].rotation_euler.y=.3*pulse
                elif state=='kick':
                    a.rotation_euler.x=-.5; f.rotation_euler.x=-1.15
                    if s>0:
                        p['thigh.'+label].rotation_euler.x=-1.35*pulse
                        p['shin.'+label].rotation_euler.x=.35*pulse
                elif state=='dodge':
                    p['chest'].rotation_euler.z=.3*pulse
                    a.rotation_euler.x=-.7; f.rotation_euler.x=-1.4
                elif state=='recover':
                    a.rotation_euler.x=-.35*(1-u); f.rotation_euler.x=-.4*(1-u)
            if feline:
                for i in range(6):
                    p[f'tail{i}'].rotation_euler.z=.14*math.sin(u*PI*2-i*.7)
                    p[f'tail{i}'].rotation_euler.x=.05*math.cos(u*PI*2-i*.6)
            for pb in p:
                pb.keyframe_insert('rotation_euler',frame=frame,group=pb.name)
        # Explicit NLA tracks let glTF export each action as an independent clip.
        track=rig.animation_data.nla_tracks.new(); track.name=state
        track.strips.new(state,1,action)
        track.mute=True
    rig.animation_data.action=None
    for pb in rig.pose.bones: pb.rotation_euler=(0,0,0)


def build(definition):
    global OBJECTS
    OBJECTS=[]
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    feline=definition['species']=='feline'; palette=definition['palette']; tag=definition['id']
    m={key:material(tag+'_'+key,palette[key],kind) for key,kind in [('skin','skin'),('shadow','flat'),('cloth','cloth'),('trim','cloth'),('hair','hair')]}
    m.update({key:material(tag+'_'+key,c,kind) for key,c,kind in [('ink','151629','flat'),('white','F5F0E3','flat'),('gold','E4BC65','metal'),('yellow','F3DB6F','flat'),('ear','603A78','flat'),('orange','EE8645','flat'),('fold','283C73' if feline else 'AB451B','flat')]})
    body(m,feline); face(m,feline)
    rig=make_rig(feline)
    # Merge components into one skinned mesh, preserving material slots and groups.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in OBJECTS: obj.select_set(True)
    bpy.context.view_layer.objects.active=OBJECTS[0]
    bpy.ops.object.join()
    mesh=bpy.context.object; mesh.name=definition['name']+'_Surface'
    bm=bmesh.new(); bm.from_mesh(mesh.data)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(mesh.data); bm.free()
    modifier=mesh.modifiers.new('Deform','ARMATURE'); modifier.object=rig
    mesh.parent=rig
    animate(rig,feline)
    bpy.context.scene.render.fps=24
    bpy.context.scene.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); mesh.select_set(True)
    rig['character_id']=tag; rig['generator']='Fimken local character workshop v1'
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{tag}.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_skins=True,export_morph=True,export_extras=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art'/f'{tag}.blend'))
    # Neutral preview: no aura or bloom hiding the anatomy.
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24
    scene.render.resolution_x=900; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
    scene.world.color=(.055,.04,.085)
    bpy.ops.object.camera_add(location=(8,-17,7.5))
    camera=bpy.context.object; camera.rotation_euler=(Vector((0,0,3.5))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=8.2; scene.camera=camera
    for position,power,size,color in [((3,-7,10),1700,6,(1,.9,.78)),((-6,-4,6),1000,5,(.55,.65,1)),((2,5,7),1800,4,(.69,.46,1))]:
        bpy.ops.object.light_add(type='AREA',location=position)
        light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=size; light.data.color=color
        light.rotation_euler=(Vector((0,0,3.5))-light.location).to_track_quat('-Z','Y').to_euler()
    scene.view_settings.view_transform='Standard'
    scene.render.filepath=str(PREVIEWS/f'{tag}.png')
    bpy.ops.render.render(write_still=True)
    print(f'CHARACTER COMPLETE: {tag}, vertices={len(mesh.data.vertices)}, bones={len(rig.data.bones)}')


args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for path in sorted((ROOT/'art'/'characters').glob('*.json')):
    if not args or path.stem in args: build(json.loads(path.read_text()))
