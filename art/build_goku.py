"""Goku rebuild: authored surfaces, cel materials, rig and local renders.
Run Blender 4.5 with --background --factory-startup --python art/build_goku.py.
"""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public'/'characters'
PREVIEW=ROOT/'art'/'previews'
PREVIEW.mkdir(exist_ok=True)
PARTS=[]
PI=math.pi

def linear(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4

def mat(name, hexcode, texture=False):
    rgb=tuple(int(hexcode[i:i+2],16)/255 for i in (0,2,4))
    m=bpy.data.materials.new(name); m.diffuse_color=(*map(linear,rgb),1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=m.diffuse_color
    bs.inputs['Roughness'].default_value=.78
    if texture:
        size=1024; y,x=np.mgrid[0:size,0:size]/size
        grain=np.random.default_rng(15).random((size,size))*.012
        value=.97+grain+.015*np.cos(x*PI*128)*np.sin(y*PI*160)
        pixels=np.ones((size,size,4),dtype=np.float32)
        pixels[:,:,:3]=np.array(rgb)[None,None,:]*value[:,:,None]
        img=bpy.data.images.new(name+' pigment',size,size)
        img.pixels.foreach_set(pixels.ravel()); img.filepath_raw=str(OUT/(name+'.png')); img.file_format='PNG'; img.save(); img.pack()
        node=m.node_tree.nodes.new('ShaderNodeTexImage'); node.image=img
        m.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
    return m

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={
 'skin':mat('skin','E8A167',True), 'skinlight':mat('skin_highlight','F2B47C'),
 'shadow':mat('skin_crease','995830'), 'ink':mat('ink','251B23'),
 'orange':mat('gi_orange','F78A16',True), 'fold':mat('gi_fold','B94F0C'),
 'blue':mat('gi_navy','163350',True), 'bluehi':mat('gi_navy_edge','264D6B'),
 'gold':mat('hair_gold','FFCF32',True), 'goldhi':mat('hair_ridge','FFE786'),
 'goldshade':mat('hair_groove','C78B0F'), 'white':mat('eye_white','FFF7D8'),
 'iris':mat('eye_turquoise','238C7D'), 'sole':mat('boot_sole','121B2E'),
}

def bind(obj,bone='chest',weights=None):
    groups={}
    for v in obj.data.vertices:
        entries=weights(v.co) if weights else {bone:1}
        for key,value in entries.items():
            if value<=0: continue
            if key not in groups: groups[key]=obj.vertex_groups.new(name=key)
            groups[key].add([v.index],value,'REPLACE')
    PARTS.append(obj); return obj

def mesh(name,vs,fs,material,bone='chest',weights=None,smooth=True):
    data=bpy.data.meshes.new(name); data.from_pydata(vs,[],fs); data.update()
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); data.materials.append(material)
    uv=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        p.use_smooth=smooth
        for li in p.loop_indices:
            v=data.vertices[data.loops[li].vertex_index].co
            uv.data[li].uv=(v.x*.24+.5,v.z*.15)
    return bind(obj,bone,weights)

def sphere(name,c,s,material,bone='chest',segments=32,rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=c)
    o=bpy.context.object; o.name=name; o.scale=s
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth=True
    return bind(o,bone)

def catmull(rows,sub=4):
    result=[]
    for i in range(len(rows)-1):
        a=np.array(rows[max(0,i-1)]); b=np.array(rows[i]); c=np.array(rows[i+1]); d=np.array(rows[min(len(rows)-1,i+2)])
        for j in range(sub):
            t=j/sub
            result.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    result.append(rows[-1]); return result

def loft(name,rows,material,bone='chest',weights=None,folds=0,n=64):
    rows=catmull(rows); vs=[]; fs=[]
    for j,(x,y,z,rx,ry) in enumerate(rows):
        u=j/(len(rows)-1)
        for i in range(n):
            a=i/n*2*PI
            fold=folds*(.55*math.sin(a*7+u*8)+.3*math.sin(a*11-u*5)+.15*math.sin(a*17+u*9))*math.sin(u*PI)
            vs.append((x+math.cos(a)*(rx+fold),y+math.sin(a)*(ry+fold*.7),z))
            if j: fs.append(((j-1)*n+i,(j-1)*n+(i+1)%n,j*n+(i+1)%n,j*n+i))
    fs += [tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]
    return mesh(name,vs,fs,material,bone,weights)

def curve(name,points,radius,material,bone='chest',taper=True):
    pts=catmull(points,5); vs=[]; fs=[]; n=8
    for j,p in enumerate(pts):
        p=Vector(p); tangent=(Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(0,j-1)])).normalized()
        normal=tangent.cross(Vector((0,1,0)))
        if normal.length<.001: normal=tangent.cross(Vector((1,0,0)))
        normal.normalize(); side=tangent.cross(normal).normalized()
        r=radius*(.12+.88*math.sin(j/(len(pts)-1)*PI)**.4) if taper else radius
        for i in range(n):
            a=i/n*2*PI; vs.append(p+normal*math.cos(a)*r+side*math.sin(a)*r)
            if j: fs.append(((j-1)*n+i,(j-1)*n+(i+1)%n,j*n+(i+1)%n,j*n+i))
    return mesh(name,vs,fs,material,bone)

def patch(name,pts,material,bone='head',thick=.006):
    count=len(pts); vs=pts+[(x,y+thick,z) for x,y,z in pts]
    fs=[tuple(range(count)),tuple(reversed(range(count,count*2)))]
    fs += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    return mesh(name,vs,fs,material,bone,smooth=False)

def limb_weights(side,joint,upper,lower):
    def weights(p):
        w=max(0,min(1,(p.z-joint+.24)/.48)); return {upper+'.'+side:w,lower+'.'+side:1-w}
    return weights

# Neck and trapezius are substantial, with anatomical tendon accents.
loft('Neck anatomy',[(0,0,5.40,.40,.30),(0,0,5.68,.32,.29),(0,0,5.96,.28,.27),(0,0,6.19,.29,.28)],M['skin'],'neck')
for s in [-1,1]:
    curve('Neck tendon',[(s*.24,-.255,6.06),(s*.18,-.30,5.77),(s*.29,-.35,5.58)],.015,M['shadow'],'neck')

# Face uses a flattened anterior profile and a rounded skull behind it.
rows=catmull([(6.03,.12,.29,.22),(6.11,.25,.39,.28),(6.25,.39,.41,.35),(6.42,.48,.41,.40),(6.62,.50,.40,.43),(6.83,.50,.36,.44),(7.02,.44,.30,.42),(7.16,.30,.18,.32),(7.22,.08,.06,.09)],5)
vs=[]; fs=[]; n=80
for j,(z,rx,front,back) in enumerate(rows):
    for i in range(n):
        a=2*PI*i/n; xx=math.cos(a); yy=math.sin(a)
        y=-front*(1-.20*xx**2-.8*xx**8) if yy<0 else back*yy
        vs.append((rx*xx,y,z))
        if j: fs.append(((j-1)*n+i,(j-1)*n+(i+1)%n,j*n+(i+1)%n,j*n+i))
fs += [tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]
mesh('Goku facial surface',vs,fs,M['skin'],'head')
for s in [-1,1]:
    sphere('Ear outer',(s*.515,.025,6.55),(.105,.105,.205),M['skin'],'head')
    curve('Ear cartilage',[(s*.545,-.065,6.69),(s*.57,-.085,6.59),(s*.55,-.08,6.45),(s*.51,-.09,6.46)],.014,M['shadow'],'head')
    # Narrow angular eyes follow the facial surface in three dimensions.
    eye=[(s*.065,-.413,6.665),(s*.397,-.354,6.765),(s*.355,-.397,6.568),(s*.093,-.423,6.565)]
    patch('Eye silhouette',[(x*1.035,y-.009,z+(z-6.64)*.15) for x,y,z in eye],M['ink'])
    patch('Eye sclera',[(x,y-.018,z) for x,y,z in eye],M['white'])
    patch('Turquoise iris',[(s*.18,-.446,6.691),(s*.251,-.433,6.713),(s*.246,-.446,6.573),(s*.179,-.455,6.574)],M['iris'])
    curve('Iris pupil',[(s*.212,-.46,6.69),(s*.213,-.462,6.59)],.009,M['ink'],'head')
    sphere('Eye catchlight',(s*.199,-.467,6.673),(.012,.005,.016),M['white'],'head',12,8)
    patch('Golden brow',[(s*.054,-.435,6.70),(s*.11,-.429,6.80),(s*.42,-.354,6.89),(s*.398,-.374,6.785)],M['gold'])
    curve('Under eye definition',[(s*.105,-.425,6.528),(s*.29,-.408,6.523),(s*.371,-.381,6.54)],.008,M['shadow'],'head')
    curve('Cheek contour',[(s*.37,-.353,6.425),(s*.295,-.395,6.38)],.007,M['shadow'],'head')
    curve('Brow crease',[(s*.056,-.421,6.79),(s*.025,-.433,6.735)],.008,M['shadow'],'head')
# Bridge, projecting tip and nostril planes.
mesh('Nose',[(0,-.409,6.72),(-.054,-.412,6.61),(.054,-.412,6.61),(0,-.622,6.414),(-.079,-.458,6.39),(.073,-.458,6.39),(0,-.485,6.37)],[(0,1,3),(0,3,2),(1,4,3),(2,3,5),(3,4,6),(3,6,5)],M['skin'],'head',smooth=False)
curve('Nose contour',[(.008,-.619,6.421),(.073,-.461,6.391)],.007,M['shadow'],'head')
curve('Stern mouth',[(-.145,-.414,6.235),(-.04,-.434,6.252),(.09,-.428,6.244),(.147,-.415,6.238)],.009,M['ink'],'head')
curve('Lower lip',[(-.072,-.411,6.198),(0,-.423,6.19),(.059,-.414,6.20)],.007,M['shadow'],'head')

# Swept solid hair blades: each lock has a front ridge, back volume and fine grooves.
sphere('Hair cap',(0,.07,6.98),(.51,.45,.40),M['gold'],'head',48,28)
def hair(name,points,width,depth):
    path=catmull(points,8); vs=[]; fs=[]; count=12
    cross=[(-1,0),(-.80,-.35),(-.45,-.72),(0,-1),(.45,-.72),(.8,-.35),(1,0),(.75,.55),(.35,.85),(0,1),(-.35,.85),(-.75,.55)]
    for j,p in enumerate(path):
        t=j/(len(path)-1); p=Vector(p)
        tangent=(Vector(path[min(j+1,len(path)-1)])-Vector(path[max(j-1,0)])).normalized()
        side=tangent.cross(Vector((0,-1,0))).normalized()
        if side.length<.1: side=Vector((1,0,0))
        front=side.cross(tangent).normalized()
        if front.y>0: front=-front
        shape=(math.sin((.20+.8*t)*PI)*.9+.08)*(1-t)**.25
        if j==len(path)-1: shape=.008
        for a,b in cross: vs.append(p+side*a*width*shape+front*(-b)*depth*shape)
        if j:
            for i in range(count): fs.append(((j-1)*count+i,(j-1)*count+(i+1)%count,j*count+(i+1)%count,j*count+i))
    fs += [tuple(reversed(range(count))),tuple((len(path)-1)*count+i for i in range(count))]
    mesh(name,vs,fs,M['gold'],'head',smooth=True)
    for fraction in [-.4,.4]:
        line=[]
        for j in range(2,len(path)-2):
            t=j/(len(path)-1); p=Vector(path[j]); tangent=(Vector(path[j+1])-Vector(path[j-1])).normalized()
            side=tangent.cross(Vector((0,-1,0))).normalized(); front=side.cross(tangent).normalized()
            if front.y>0: front=-front
            shape=(math.sin((.20+.8*t)*PI)*.9+.08)*(1-t)**.25
            line.append(tuple(p+side*fraction*width*shape+front*depth*shape*.76))
        curve('Hair engraved strand',line,.008,M['goldshade'],'head')
    # A narrow highlight follows the raised central ridge.
    line=[]
    for j in range(3,len(path)-3):
        t=j/(len(path)-1); p=Vector(path[j]); tangent=(Vector(path[j+1])-Vector(path[j-1])).normalized()
        side=tangent.cross(Vector((0,-1,0))).normalized(); front=side.cross(tangent).normalized()
        if front.y>0: front=-front
        shape=(math.sin((.20+.8*t)*PI)*.9+.08)*(1-t)**.25
        line.append(tuple(p+front*depth*shape*1.01))
    if line: curve('Hair ridge light',line,.012,M['goldhi'],'head')

locks=[
 ([(.02,.16,7.10),(.10,.18,7.70),(-.10,.16,8.47)],.32,.20),
 ([(.26,.16,7.05),(.53,.15,7.61),(.48,.12,8.35)],.35,.21),
 ([(-.25,.17,7.02),(-.50,.18,7.55),(-.70,.17,8.23)],.32,.19),
 ([(.42,.14,6.87),(.80,.17,7.40),(1.05,.15,7.96)],.32,.17),
 ([(-.44,.16,6.89),(-.83,.18,7.31),(-1.08,.16,7.91)],.31,.17),
 ([(.46,.15,6.64),(.83,.24,6.99),(1.26,.2,7.37)],.26,.16),
 ([(-.46,.17,6.62),(-.86,.26,6.94),(-1.25,.22,7.35)],.26,.16),
 ([(.38,.36,6.56),(.64,.62,6.78),(.98,.63,7.05)],.22,.15),
 ([(-.38,.36,6.56),(-.64,.62,6.78),(-.99,.62,7.03)],.22,.15),
 ([(0,.37,6.88),(0,.69,7.39),(.02,.77,7.97)],.29,.19),
 ([(.19,-.24,7.02),(.28,-.46,7.39),(.05,-.32,8.0)],.29,.20),
 ([(-.19,-.24,7.04),(-.35,-.45,7.45),(-.56,-.25,7.98)],.28,.18),
 ([(-.30,-.25,6.98),(-.51,-.49,6.95),(-.39,-.61,6.62)],.21,.13),
 ([(.07,-.34,7.12),(-.12,-.55,7.04),(-.12,-.64,6.70)],.22,.13),
 ([(.34,-.22,7.02),(.52,-.42,6.92),(.51,-.50,6.54)],.20,.13),
]
for i,(points,w,d) in enumerate(locks): hair('Super Saiyan lock %02d'%i,points,w,d)

# Torso: wide chest, tapered waist, an open navy collar and a crossing orange gi.
loft('Gi torso',[(0,0,3.48,.48,.33),(0,0,3.70,.54,.36),(0,0,4.03,.64,.39),(0,0,4.48,.84,.45),(0,0,4.95,.96,.48),(0,0,5.30,.99,.44),(0,0,5.50,.76,.37)],M['orange'],folds=.043)
# Neck opening laid over the curved chest, folded cloth has actual volume.
patch('Navy chest opening',[(-.70,-.335,5.51),(-.39,-.462,5.12),(.04,-.512,4.60),(.63,-.378,5.44),(.31,-.355,5.63),(-.31,-.355,5.63)],M['blue'],'chest',.04)
patch('Exposed clavicle',[(-.30,-.38,5.63),(0,-.461,5.22),(.33,-.38,5.63)],M['skin'],'chest',.025)
for s in [-1,1]:
    curve('Clavicle',[(s*.12,-.443,5.43),(s*.26,-.419,5.49),(s*.35,-.384,5.49)],.012,M['shadow'])
    curve('Navy collar ridge',[(s*.34,-.381,5.63),(s*.37,-.437,5.36),(s*.18,-.488,5.12),(.04,-.524,4.66)],.035,M['bluehi'])
curve('Gi overlapping lapel',[(-.78,-.324,5.55),(-.52,-.443,5.12),(-.21,-.51,4.61),(.26,-.459,4.15)],.065,M['orange'])
curve('Gi lapel inner shadow',[(-.69,-.357,5.50),(-.44,-.465,5.09),(-.12,-.522,4.60),(.26,-.472,4.17)],.017,M['fold'])
curve('Gi right lapel',[(.79,-.32,5.5),(.59,-.409,5.19),(.34,-.491,4.85),(.07,-.53,4.64)],.065,M['orange'])
for s in [-1,1]:
    for j in range(3):
        curve('Chest cloth crease',[(s*(.86-j*.15),-.26-j*.05,4.78-j*.07),(s*(.70-j*.14),-.355-j*.04,4.40-j*.07),(s*.41,-.334,3.78+j*.1)],.012,M['fold'])
# Broad pleated sash with separate folded tails.
loft('Sash',[(0,0,3.39,.52,.37),(0,0,3.52,.58,.40),(0,0,3.68,.55,.39),(0,0,3.79,.52,.36)],M['blue'],'hips',folds=.012)
for j in range(4):
    curve('Sash wrapped fold',[(-.48,-.18,3.47+j*.066),(-.28,-.359,3.46+j*.068),(0,-.407,3.44+j*.07),(.35,-.314,3.43+j*.08),(.5,-.15,3.46+j*.08)],.011,M['bluehi'],'hips')
sphere('Sash knot',(.32,-.38,3.52),(.17,.115,.17),M['blue'],'hips')
patch('Sash long tail',[(.30,-.43,3.52),(.47,-.43,3.49),(.56,-.43,2.60),(.35,-.47,2.69)],M['blue'],'hips',.045)
patch('Sash short tail',[(.25,-.44,3.52),(.35,-.45,3.43),(.19,-.46,2.94),(.03,-.46,2.98)],M['blue'],'hips',.04)
curve('Sash tail fold',[(.39,-.482,3.42),(.43,-.47,3.01),(.46,-.472,2.72)],.012,M['bluehi'],'hips')

for s,side in [(-1,'L'),(1,'R')]:
    upper='upperarm.'+side; lower='forearm.'+side; hand='hand.'+side
    # Continuous muscle silhouette: deltoid, biceps, elbow and extensor mass.
    rows=[(s*1.02,0,5.46,.29,.29),(s*1.16,0,5.28,.41,.40),(s*1.26,-.015,5.01,.40,.36),(s*1.36,-.02,4.75,.34,.33),(s*1.42,-.015,4.49,.25,.25),(s*1.49,-.04,4.30,.34,.31),(s*1.56,-.075,4.01,.30,.27),(s*1.62,-.11,3.69,.22,.22),(s*1.64,-.11,3.49,.20,.20)]
    loft('Muscular arm '+side,rows,M['skin'],upper,limb_weights(side,4.49,'upperarm','forearm'))
    curve('Deltoid crease',[(s*1.02,-.30,5.28),(s*1.23,-.369,5.1),(s*1.39,-.257,4.89)],.013,M['shadow'],upper)
    curve('Biceps definition',[(s*1.10,-.259,4.91),(s*1.20,-.321,4.72),(s*1.39,-.247,4.56)],.012,M['shadow'],upper)
    curve('Forearm tendon',[(s*1.41,-.298,4.22),(s*1.49,-.283,4.02),(s*1.56,-.221,3.81)],.01,M['shadow'],lower)
    curve('Elbow fold',[(s*1.25,-.201,4.50),(s*1.41,-.267,4.46),(s*1.54,-.214,4.48)],.01,M['shadow'],lower)
    # Short fitted navy sleeve under the broad orange shoulder.
    loft('Navy sleeve '+side,[(s*.92,0,5.54,.34,.35),(s*1.09,0,5.39,.44,.435),(s*1.20,0,5.16,.425,.41)],M['blue'],upper)
    loft('Orange shoulder '+side,[(s*.83,.01,5.56,.29,.36),(s*1.00,.005,5.46,.43,.46),(s*1.10,.01,5.34,.445,.455)],M['orange'],upper,folds=.01)
    curve('Sleeve fold',[(s*.86,-.345,5.46),(s*1.02,-.415,5.39),(s*1.20,-.405,5.30)],.012,M['fold'],upper)
    loft('Wrist wrap '+side,[(s*1.60,-.10,3.84,.245,.245),(s*1.635,-.11,3.61,.236,.236),(s*1.65,-.11,3.49,.225,.225)],M['blue'],lower,folds=.007)
    for j in range(2): curve('Wrist wrap crease',[(s*1.44,-.20,3.56+j*.10),(s*1.62,-.35,3.57+j*.10),(s*1.81,-.20,3.58+j*.10)],.009,M['bluehi'],lower)
    # A closed hand with individually curled fingers and thumb pad.
    sphere('Fist palm '+side,(s*1.66,-.10,3.26),(.255,.21,.285),M['skin'],hand)
    for i in range(4):
        xx=s*1.66+(i-1.5)*.105
        sphere('Curled finger',(xx,-.255,3.27),(.061,.13,.16),M['skin'],hand,20,14)
        curve('Finger crease',[(xx-.025,-.373,3.29),(xx+.027,-.373,3.29)],.006,M['shadow'],hand)
    sphere('Thumb pad',(s*1.45,-.20,3.32),(.115,.15,.21),M['skin'],hand,24,16)
    curve('Thumb fold',[(s*1.44,-.336,3.42),(s*1.48,-.353,3.31),(s*1.54,-.348,3.25)],.007,M['shadow'],hand)
    # Loose, folded trousers transition to tall navy boots.
    rows=[(s*.32,0,3.47,.37,.36),(s*.40,0,3.25,.47,.44),(s*.47,0,2.91,.48,.44),(s*.51,0,2.58,.435,.40),(s*.55,0,2.20,.38,.355),(s*.57,0,1.97,.335,.32),(s*.59,0,1.73,.38,.33),(s*.60,0,1.48,.31,.28),(s*.60,0,1.29,.245,.23)]
    loft('Sculpted gi trousers '+side,rows,M['orange'],'thigh.'+side,limb_weights(side,1.97,'thigh','shin'),folds=.062)
    for j in range(4):
        curve('Trouser diagonal crease',[(s*(.30+j*.14),-.34,3.12-j*.06),(s*(.35+j*.12),-.424,2.91-j*.08),(s*(.45+j*.08),-.355,2.60-j*.10)],.012,M['fold'],'thigh.'+side)
    curve('Knee compression fold',[(s*.31,-.12,2.16),(s*.54,-.345,2.04),(s*.81,-.16,2.10)],.013,M['fold'],'thigh.'+side)
    curve('Lower trouser fold',[(s*.35,-.14,1.64),(s*.58,-.306,1.53),(s*.82,-.13,1.49)],.012,M['fold'],'shin.'+side)
    loft('Boot '+side,[(s*.60,0,1.36,.265,.25),(s*.60,0,1.13,.29,.25),(s*.60,0,.75,.255,.255),(s*.60,-.05,.38,.25,.31)],M['blue'],'shin.'+side)
    sphere('Boot toe '+side,(s*.60,-.24,.29),(.29,.53,.25),M['blue'],'foot.'+side)
    loft('Boot sole '+side,[(s*.60,-.24,.065,.292,.52),(s*.60,-.24,.14,.305,.54)],M['sole'],'foot.'+side)
    loft('Boot gold rim '+side,[(s*.60,0,1.29,.27,.26),(s*.60,0,1.36,.275,.263)],M['orange'],'shin.'+side)
    curve('Boot piping',[(s*.60,-.26,1.32),(s*.60,-.267,.80),(s*.60,-.34,.45),(s*.60,-.72,.29)],.022,M['orange'],'foot.'+side,taper=False)

# Chest emblem is vector geometry on the curved gi, not a screenshot projection.
sphere('Chest badge border',(.62,-.417,4.91),(.20,.018,.215),M['ink'])
sphere('Chest badge',(.62,-.438,4.91),(.174,.012,.188),M['white'])
# Hand-authored strokes evoke the small embroidered kanji badge.
for line in [[(.51,5.01),(.53,4.83)],[(.49,4.96),(.56,4.96)],[(.58,5.04),(.72,5.04)],[(.60,4.99),(.59,4.94),(.72,4.94)],[(.66,5.04),(.66,4.94)],[(.59,4.9),(.72,4.9),(.72,4.80),(.59,4.80),(.59,4.9)]]:
    curve('Badge embroidery',[(x,-.455,z) for x,z in line],.010,M['ink'],taper=False)

# Named skeleton keeps the app's animation interface while the anatomy is new.
data=bpy.data.armatures.new('Goku anatomy rig'); rig=bpy.data.objects.new('Armature',data)
bpy.context.collection.objects.link(rig); bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=data.edit_bones.new(name); b.head=head; b.tail=tail
    if parent: b.parent=data.edit_bones[parent]
bone('hips',(0,0,3.3),(0,0,3.75))
bone('chest',(0,0,3.75),(0,0,5.53),'hips')
bone('neck',(0,0,5.53),(0,0,6.05),'chest')
bone('head',(0,0,6.05),(0,0,7.08),'neck')
for s,side in [(-1,'L'),(1,'R')]:
    bone('upperarm.'+side,(s*1.02,0,5.40),(s*1.42,-.015,4.49),'chest')
    bone('forearm.'+side,(s*1.42,-.015,4.49),(s*1.64,-.11,3.49),'upperarm.'+side)
    bone('hand.'+side,(s*1.64,-.11,3.49),(s*1.66,-.12,3.02),'forearm.'+side)
    bone('thigh.'+side,(s*.34,0,3.48),(s*.57,0,1.97),'hips')
    bone('shin.'+side,(s*.57,0,1.97),(s*.60,0,.44),'thigh.'+side)
    bone('foot.'+side,(s*.60,0,.44),(s*.60,-.6,.24),'shin.'+side)
bpy.ops.object.mode_set(mode='OBJECT'); rig.select_set(False)
bpy.ops.object.select_all(action='DESELECT')
for obj in PARTS: obj.select_set(True)
bpy.context.view_layer.objects.active=PARTS[0]; bpy.ops.object.join(); surface=bpy.context.object; surface.name='Goku_rebuilt_surface'
bm=bmesh.new(); bm.from_mesh(surface.data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(surface.data); bm.free()
mod=surface.modifiers.new('Skin deformation','ARMATURE'); mod.object=rig; surface.parent=rig

# Deliberate poses and eased strikes; no moving character geometry at runtime.
for pb in rig.pose.bones: pb.rotation_mode='XYZ'
specs={'hover':72,'move':48,'powerup':72,'charge':60,'blast':60,'punch':30,'kick':36,'dodge':30,'recover':48,'rush':30,'clash':60}
for state,length in specs.items():
    rig.animation_data_create(); action=bpy.data.actions.new(state); rig.animation_data.action=action
    for frame in range(1,length+2,3):
        u=(frame-1)/length; wave=math.sin(u*2*PI)
        # Fast extension, a short hold and controlled return.
        pulse=math.sin(min(1,max(0,(u-.12)/.75))*PI)**.65
        p=rig.pose.bones
        for pb in p: pb.rotation_euler=(0,0,0)
        p['chest'].rotation_euler.x=.008*wave
        for s,side in [(-1,'L'),(1,'R')]:
            a=p['upperarm.'+side]; f=p['forearm.'+side]
            a.rotation_euler.z=s*.045; f.rotation_euler.x=-.10
            p['thigh.'+side].rotation_euler.z=s*.035
            if state=='powerup':
                a.rotation_euler.z=s*(.08+.14*math.sin(u*PI)); f.rotation_euler.x=-.24
                p['thigh.'+side].rotation_euler.z=s*.11
                p['chest'].rotation_euler.x=-.045*math.sin(u*PI)
                p['head'].rotation_euler.x=-.06*math.sin(u*PI)
            elif state=='charge':
                a.rotation_euler.x=-.55; a.rotation_euler.z=s*.26
                f.rotation_euler.x=-1.25; p['chest'].rotation_euler.y=-.10
            elif state in ('blast','clash'):
                a.rotation_euler.x=-1.40; a.rotation_euler.z=s*.23
                f.rotation_euler.x=-.12; p['chest'].rotation_euler.x=.12
                p['head'].rotation_euler.x=-.10
            elif state in ('move','rush'):
                a.rotation_euler.x=-.45+s*.17*wave; f.rotation_euler.x=-1.3
                p['thigh.'+side].rotation_euler.x=s*.22*wave
                p['shin.'+side].rotation_euler.x=.13+max(0,s*wave)*.25
            elif state=='punch':
                a.rotation_euler.x=-.55-(1.0*pulse if s>0 else 0)
                f.rotation_euler.x=-1.30+(1.18*pulse if s>0 else 0)
                p['chest'].rotation_euler.y=.18*pulse
            elif state=='kick':
                a.rotation_euler.x=-.45; f.rotation_euler.x=-1.15
                if s>0: p['thigh.'+side].rotation_euler.x=-1.40*pulse; p['shin.'+side].rotation_euler.x=.28*pulse
            elif state=='dodge':
                p['chest'].rotation_euler.z=.22*pulse
                a.rotation_euler.x=-.5; f.rotation_euler.x=-1.25
            elif state=='recover':
                a.rotation_euler.x=-.2*(1-u); f.rotation_euler.x=-.35*(1-u)
        for pb in p: pb.keyframe_insert('rotation_euler',frame=frame,group=pb.name)
    track=rig.animation_data.nla_tracks.new(); track.name=state; track.strips.new(state,1,action); track.mute=True
rig.animation_data.action=None
for pb in rig.pose.bones: pb.rotation_euler=(0,0,0)
bpy.context.scene.render.fps=24; bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT'); surface.select_set(True); rig.select_set(True)
rig['character_id']='goku'; rig['art_revision']='supersaiyan-rebuild-1'
bpy.ops.export_scene.gltf(filepath=str(OUT/'goku.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_skins=True,export_extras=True)

# Convert preview materials to a light-responsive cel ramp after exporting PBR colours.
for material in M.values():
    color=material.diffuse_color[:]
    nodes=material.node_tree.nodes; links=material.node_tree.links
    nodes.clear(); diffuse=nodes.new('ShaderNodeBsdfDiffuse'); diffuse.inputs['Color'].default_value=(1,1,1,1)
    to_rgb=nodes.new('ShaderNodeShaderToRGB'); links.new(diffuse.outputs[0],to_rgb.inputs[0])
    ramp=nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation='CONSTANT'
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
    for index,(position,factor) in enumerate([(0,.33),(.32,.62),(.57,.88),(.85,1.1)]):
        e=ramp.color_ramp.elements[0] if index==0 else ramp.color_ramp.elements.new(position)
        e.position=position; e.color=tuple(min(1,c*factor) for c in color[:3])+(1,)
    links.new(to_rgb.outputs[0],ramp.inputs[0]); emission=nodes.new('ShaderNodeEmission'); links.new(ramp.outputs[0],emission.inputs[0])
    output=nodes.new('ShaderNodeOutputMaterial'); links.new(emission.outputs[0],output.inputs[0])
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE_NEXT'
scene.world.color=(.055,.055,.055); scene.view_settings.view_transform='Standard'
scene.render.resolution_x=1300; scene.render.resolution_y=1500; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=True
bpy.ops.object.camera_add(location=(3.8,-15,7.8)); camera=bpy.context.object; scene.camera=camera
camera.rotation_euler=(Vector((0,0,5.95))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=5.4
for loc,power,size in [((-4,-6,10),1100,4),((4,-2,6),300,5),((2,4,9),1300,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc); light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=size
    light.rotation_euler=(Vector((0,0,5))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art'/'goku-rebuild.blend'))
scene.render.filepath=str(PREVIEW/'goku-rebuild-closeup.png'); bpy.ops.render.render(write_still=True)
camera.location=(-9,-14,6.5); camera.rotation_euler=(Vector((0,0,4.25))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.ortho_scale=9.4
scene.render.filepath=str(PREVIEW/'goku-rebuild-full.png'); bpy.ops.render.render(write_still=True)
print('REBUILD COMPLETE',len(surface.data.vertices),'vertices',len(surface.data.polygons),'polygons')
