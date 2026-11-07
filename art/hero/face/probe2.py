import bpy, json, sys
from mathutils import Vector
src=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');me=mesh.data
basis=me.shape_keys.key_blocks['Basis'] if me.shape_keys else None
co=lambda v:(basis.data[v.index].co if basis else v.co)
# Eye region geometry: sample the surface in a grid over the face front to find eye sockets (depth) and the
# painted eye extents cannot be read from geometry, so dump depth profile rows across x at several z, plus UVs
# of face vertices so the eye texture location can be read from the image.
uv=me.uv_layers.active.data
rows={}
for z in [1.846,1.852,1.858,1.864,1.870]:
    pts=[]
    for v in me.vertices:
        p=co(v)
        if abs(p.z-z)<.003 and p.y<-.12 and abs(p.x)<.09:pts.append((round(p.x,3),round(p.y,4)))
    pts.sort();rows[str(z)]=pts[::max(1,len(pts)//30)]
# UV of vertices near the assumed eye centres (x=+-.03, z=1.858) and mouth (z=1.803)
def near(x,z,r=.006):
    out=[]
    for poly in me.polygons:
        for li in poly.loop_indices:
            v=me.vertices[me.loops[li].vertex_index];p=co(v)
            if abs(p.x-x)<r and abs(p.z-z)<r and p.y<-.12:out.append((round(uv[li].uv.x,4),round(uv[li].uv.y,4)))
    return out[:6]
report={'rows':rows,'uv_eyeL':near(.03,1.858),'uv_eyeR':near(-.03,1.858),'uv_mouth':near(0,1.803),'uv_brow':near(.03,1.882),'image_sizes':{i.name:list(i.size) for i in bpy.data.images}}
print('PROBE2 '+json.dumps(report))
