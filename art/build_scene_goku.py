"""Build the live Goku actor, keeping generated material sources and rigged motion.
Run: Blender --background --factory-startup --disable-autoexec --python art/build_scene_goku.py
"""
from pathlib import Path
import bpy, bmesh, math, json
import numpy as np
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/characters/goku-hero'
OUT.mkdir(parents=True,exist_ok=True)
source=(ROOT/'art/build_goku.py').read_text(encoding='utf-8')
source=source.replace("OUT=ROOT/'public'/'characters'", "OUT=ROOT/'public'/'characters'/'goku-hero'")
source=source.replace("'FFCF32'", "'101925'").replace("'FFE786'", "'334765'").replace("'C78B0F'", "'070C16'")
source=source.replace("mat('hair_gold'", "mat('hair_ink'")
source=source.replace("'F78A16'", "'E87716'").replace("'995830'", "'8B5039'")
source=source.replace("'238C7D'", "'101923'")
source=source.replace('folds=.043','folds=0').replace('folds=.062','folds=0')
scope={'__file__':str(ROOT/'art/build_goku.py')}
base,rest=source.split('# Neck and trapezius',1)
exec(compile(base,'hero-primitives','exec'),scope)
M,PARTS=scope['M'],scope['PARTS']
mesh,loft,curve,sphere,patch=[scope[k] for k in ('mesh','loft','curve','sphere','patch')]
geometry,rigcode=rest.split('# Named skeleton',1)
# Build base geometry, then replace the parts that failed the art review.
exec(compile('# Neck and trapezius'+geometry,'hero-base','exec'),scope)
remove=('Hair cap','Super Saiyan lock','Hair engraved','Hair ridge','Navy chest opening',
 'Exposed clavicle','Clavicle','Navy collar','Gi overlapping','Gi lapel','Gi right lapel',
 'Chest cloth crease','Trouser diagonal','Knee compression','Lower trouser',
 'Navy sleeve','Orange shoulder','Sleeve fold','Deltoid crease','Biceps definition',
 'Forearm tendon','Elbow fold','Neck tendon','Sash wrapped fold','Wrist wrap crease')
for obj in list(PARTS):
 if obj.name.startswith(remove):
  PARTS.remove(obj); bpy.data.objects.remove(obj,do_unlink=True)

# Shorten the neck and use a wider angular jaw, without separate muscle spheres.
for obj in PARTS:
 for v in obj.data.vertices:
  p=v.co
  if any(g.name=='head' for g in obj.vertex_groups):
   p.z-=.30
  if obj.name=='Neck anatomy':
   p.z=5.45+(p.z-5.45)*.62; p.x*=1.12
  if obj.name=='Goku facial surface':
   if p.z<6.1: p.x*=1.10
   if p.y<0: p.y-=.018*math.exp(-((p.z-6.05)/.2)**2)
  if obj.name.startswith('Golden brow'):
   p.z-=.025
  if obj.name.startswith('Muscular arm'):
   # Subtle continuous muscle contour, rather than overlapping spheres.
   s=-1 if obj.name.endswith('L') else 1
   angle=math.atan2(p.y,p.x-s*(1.02+(5.46-p.z)*.30))
   p.y-=.035*math.exp(-((p.z-4.89)/.23)**2)*max(0,-math.sin(angle))
  if obj.name.startswith('Gi torso'):
   # Long diagonal tension folds have tapered ends at the waist and chest.
   angle=math.atan2(p.y,p.x); u=max(0,min(1,(p.z-3.48)/2.02))
   envelope=math.sin(math.pi*u)**1.5
   d=0
   for i in range(10):
    line=-math.pi+i*math.pi/5+.19*math.sin(u*2.8+i)
    dist=math.atan2(math.sin(angle-line),math.cos(angle-line))
    d+=.026*math.exp(-(dist/.12)**2)*envelope
   length=max(.001,math.hypot(p.x,p.y)); p.x+=p.x/length*d; p.y+=p.y/length*d
  if obj.name.startswith('Sculpted gi trousers'):
   s=-1 if obj.name.endswith('L') else 1
   center=s*(.6-max(0,p.z-1.5)*.13)
   angle=math.atan2(p.y,p.x-center); u=max(0,min(1,(p.z-1.29)/2.18))
   d=0
   for i in range(8):
    line=-math.pi+i*math.pi/4+.24*math.sin(u*2.5+i*.3)
    dist=math.atan2(math.sin(angle-line),math.cos(angle-line))
    d+=.036*math.exp(-(dist/.13)**2)*math.sin(math.pi*u)
   # Soft compression at ankle, no repeated horizontal block shapes.
   for z,amp in [(1.48,.02),(1.7,.028),(2.1,.018)]:
    d+=amp*math.exp(-((p.z-z-.09*math.sin(angle))/.09)**2)
   length=max(.001,math.hypot(p.x-center,p.y)); p.x+=(p.x-center)/length*d; p.y+=p.y/length*d
 obj.data.update()

# True sleeve surfaces following the upper arm axis, with open cuffs.
def sleeve(name,points,radii,material,side):
 vs=[]; fs=[]; n=48
 for j,point in enumerate(points):
  tangent=(Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])).normalized()
  across=Vector((0,1,0)); other=tangent.cross(across).normalized()
  for i in range(n):
   a=i*math.tau/n
   r=radii[j]*(1+.017*math.cos(a*5))
   vs.append(Vector(point)+across*math.sin(a)*r+other*math.cos(a)*r)
   if j: fs.append(((j-1)*n+i,(j-1)*n+(i+1)%n,j*n+(i+1)%n,j*n+i))
 return mesh(name,vs,fs,material,'upperarm.'+side)
for s,side in [(-1,'L'),(1,'R')]:
 sleeve('Orange shoulder cloth '+side,[(s*.70,0,5.35),(s*.90,0,5.32),(s*1.08,0,5.22),(s*1.19,0,5.09)], [.34,.39,.41,.405],M['orange'],side)
 sleeve('Navy sleeve cuff '+side,[(s*1.09,0,5.20),(s*1.21,0,5.05),(s*1.25,0,4.94)],[.397,.403,.385],M['blue'],side)

# Tailored V-neck follows the torso instead of floating as a flat triangle.
vs=[]; fs=[]; rows=28; cols=24
for j in range(rows+1):
 t=j/rows; z=4.73+t*.81; width=.025+t*.58
 for i in range(cols+1):
  x=(i/cols*2-1)*width
  y=-.482*math.sqrt(max(.08,1-(x/1.01)**2))-.025
  vs.append((x,y,z))
  if i and j:
   a=(j-1)*(cols+1)+i-1; fs.append((a,a+1,a+cols+2,a+cols+1))
mesh('Curved navy V neck',vs,fs,M['blue'])
# Narrow folded edge, contiguous with the garment and curved over the chest.
for s in [-1,1]:
 vs=[]; fs=[]
 for j in range(33):
  t=j/32; z=4.71+t*.85; x=s*(.025+t*.59)
  for k in range(3):
   xx=x+s*k*.028; y=-.487*math.sqrt(max(.1,1-(xx/1.02)**2))-.027-.012*math.sin(k*math.pi/2)
   vs.append((xx,y,z))
  if j:
   a=(j-1)*3; fs.extend([(a,a+1,a+4,a+3),(a+1,a+2,a+5,a+4)])
 mesh('Folded lapel '+str(s),vs,fs,M['orange'])

# Broad, asymmetric base-form Goku locks; individual locks carry directional UVs.
sphere('Ink hair cap',(0,.07,6.67),(.515,.46,.43),M['gold'],'head',48,28)
def lock(points,width,depth,index):
 path=scope['catmull'](points,8); vs=[]; fs=[]; n=12
 for j,point in enumerate(path):
  t=j/(len(path)-1); p=Vector(point)
  tangent=(Vector(path[min(j+1,len(path)-1)])-Vector(path[max(0,j-1)])).normalized()
  side=tangent.cross(Vector((0,-1,0))).normalized()
  if side.length<.1: side=Vector((1,0,0))
  front=side.cross(tangent).normalized()
  shape=(1-t)**.62*(.7+.5*math.sin(t*math.pi))
  if j==len(path)-1: shape=.002
  for i in range(n):
   angle=i*math.tau/n
   vs.append(p+side*math.cos(angle)*width*shape+front*math.sin(angle)*depth*shape)
   if j: fs.append(((j-1)*n+i,(j-1)*n+(i+1)%n,j*n+(i+1)%n,j*n+i))
 obj=mesh('Authored hair lock %02d'%index,vs,fs,M['gold'],'head')
 obj.data.materials.append(M['goldshade']); obj.data.materials.append(M['goldhi'])
 for poly in obj.data.polygons:
  # Broad facet shading; highlights stay dark blue, never white or metallic.
  face=poly.index%n
  poly.material_index=1 if face in (7,8,9) else 2 if face==2 else 0
  for li in poly.loop_indices:
   vertex=obj.data.loops[li].vertex_index
   obj.data.uv_layers.active.data[li].uv=((vertex%n)/n,vertex//n/(len(path)-1))
locks=[
 ([(0,.15,6.90),(-.25,.13,7.36),(-.60,.1,7.75)],.30,.20),
 ([(.22,.15,6.82),(.46,.10,7.25),(.57,.08,7.69)],.32,.20),
 ([(-.31,.13,6.78),(-.79,.12,7.13),(-1.15,.12,7.40)],.34,.19),
 ([(-.45,.16,6.60),(-.98,.14,6.78),(-1.36,.15,7.03)],.32,.18),
 ([(.4,.16,6.65),(.89,.18,6.94),(1.22,.18,7.36)],.34,.21),
 ([(.44,.20,6.43),(.86,.25,6.55),(1.19,.28,6.86)],.29,.18),
 ([(-.43,.32,6.41),(-.84,.44,6.46),(-1.13,.50,6.67)],.24,.18),
 ([(.13,.38,6.72),(.30,.67,7.05),(.26,.90,7.40)],.32,.24),
 ([(-.22,.36,6.70),(-.48,.68,6.97),(-.71,.82,7.17)],.30,.20),
 ([(.38,.36,6.38),(.68,.58,6.40),(.89,.70,6.56)],.25,.18),
 ([(0,.38,6.35),(0,.68,6.25),(0,.86,6.40)],.25,.18),
 ([(-.3,-.22,6.81),(-.49,-.45,6.62),(-.36,-.56,6.30)],.24,.16),
 ([(.04,-.29,6.99),(-.19,-.48,6.82),(-.08,-.62,6.38)],.26,.19),
 ([(.28,-.26,6.88),(.42,-.44,6.66),(.26,-.58,6.26)],.25,.16),
 ([(.42,-.10,6.70),(.56,-.24,6.50),(.48,-.39,6.20)],.17,.12),
]
for i,(p,w,d) in enumerate(locks): lock(p,w,d,i)

# Source textures applied before export. Cloth gets fine material-scale UVs.
for name,file,rough in [('orange','orange-gi',.88),('blue','navy-cotton',.91),('skin','warm-skin',.83),('gold','ink-hair',.75)]:
 mat=M[name]; shader=mat.node_tree.nodes.get('Principled BSDF')
 for link in list(shader.inputs['Base Color'].links): mat.node_tree.links.remove(link)
 image=bpy.data.images.load(str(ROOT/'output/imagegen'/(file+'-source.png')),check_existing=True)
 image.colorspace_settings.name='sRGB'; image.pack()
 node=mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image=image
 mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
 shader.inputs['Roughness'].default_value=rough; shader.inputs['Specular IOR Level'].default_value=.16
for obj in PARTS:
 if obj.name.startswith('Authored hair'): continue
 if obj.data.materials[0] in (M['orange'],M['blue']):
  uv=obj.data.uv_layers.active
  for poly in obj.data.polygons:
   axis=max(range(3),key=lambda i:abs(poly.normal[i]))
   for li in poly.loop_indices:
    p=obj.data.vertices[obj.data.loops[li].vertex_index].co
    uv.data[li].uv=([p.y*.8,p.z*.8] if axis==0 else [p.x*.8,p.z*.8] if axis==1 else [p.x*.8,p.y*.8])

# Retain authored skeletal actions; improve the neutral stance and hip motion.
rigcode='# Named skeleton'+rigcode
rigcode=rigcode[:rigcode.index('# Convert preview materials')]
rigcode=rigcode.replace("bone('neck',(0,0,5.53),(0,0,6.05),'chest')", "bone('neck',(0,0,5.53),(0,0,5.75),'chest')")
rigcode=rigcode.replace("bone('head',(0,0,6.05),(0,0,7.08),'neck')", "bone('head',(0,0,5.75),(0,0,6.78),'neck')")
rigcode=rigcode.replace("a.rotation_euler.z=s*.045; f.rotation_euler.x=-.10", "a.rotation_euler.z=s*.075; f.rotation_euler.x=-.18")
rigcode=rigcode.replace("'supersaiyan-rebuild-1'", "'scene-pass-1'")
rigcode=rigcode.replace("OUT/'goku.glb'", "OUT/'goku-scene.glb'")
exec(compile(rigcode,'hero-rig','exec'),scope)
rig=scope['rig']; rig.animation_data.action=None
for track in rig.animation_data.nla_tracks: track.mute=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/goku-scene.blend'))
print('LIVE GOKU BUILT',len(scope['surface'].data.vertices),'vertices',flush=True)
