import bpy, json, sys
src=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');me=mesh.data
basis=me.shape_keys.key_blocks['Basis'];co=lambda v:basis.data[v.index].co
mat=me.materials[0];tex=None
for n in mat.node_tree.nodes:
    if n.type=='TEX_IMAGE' and n.outputs['Color'].is_linked:
        for l in n.outputs['Color'].links:
            if l.to_socket.name=='Base Color':tex=n.image
img=tex;W,H=img.size;px=img.pixels[:]
def sample(u,v):
    x=min(W-1,max(0,int(u*W)));y=min(H-1,max(0,int(v*H)));i=(y*W+x)*4;return px[i],px[i+1],px[i+2]
uv=me.uv_layers.active.data
eye=[];skin=[]
for poly in me.polygons:
    for li in poly.loop_indices:
        v=me.vertices[me.loops[li].vertex_index];p=co(v)
        if p.y<-.11 and 1.835<p.z<1.885 and abs(p.x)<.075:
            r,g,b=sample(uv[li].uv.x,uv[li].uv.y)
            lum=(r+g+b)/3
            white=r>.75 and g>.75 and b>.75
            green=g>.45 and g>r*1.25 and b>r*0.9
            dark=lum<.22
            if white or green or dark:eye.append((round(p.x,4),round(p.y,4),round(p.z,4),'w' if white else 'g' if green else 'd'))
            elif .3<lum<.95 and r>g>b:skin.append((r,g,b))
def box(pts):
    if not pts:return None
    xs=[p[0] for p in pts];ys=[p[1] for p in pts];zs=[p[2] for p in pts]
    return {'n':len(pts),'x':[round(min(xs),4),round(max(xs),4)],'y':[round(min(ys),4),round(max(ys),4)],'z':[round(min(zs),4),round(max(zs),4)],'cx':round(sum(xs)/len(xs),4),'cy':round(sum(ys)/len(ys),4),'cz':round(sum(zs)/len(zs),4)}
L=[p for p in eye if p[0]>.008];R=[p for p in eye if p[0]<-.008]
sk=[sum(c[i] for c in skin)/len(skin) for i in range(3)] if skin else None
report={'image':img.name,'size':[W,H],'eyeL':box(L),'eyeR':box(R),'eyeL_green':box([p for p in L if p[3]=='g']),'eyeR_green':box([p for p in R if p[3]=='g']),'eyeL_white':box([p for p in L if p[3]=='w']),'eyeR_white':box([p for p in R if p[3]=='w']),'skin_rgb':[round(c,3) for c in sk] if sk else None,'skin_samples':len(skin)}
print('PROBE3 '+json.dumps(report))
