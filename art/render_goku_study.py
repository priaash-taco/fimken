"""Render the saved isolated study without rebuilding/exporting the rig."""
import bpy
from pathlib import Path
from mathutils import Vector
root = Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(root/'art'/'goku-study-v2.blend'), use_scripts=False)
scene=bpy.context.scene
scene.render.resolution_x=900; scene.render.resolution_y=1100
camera=scene.camera
for name,position,target,scale in [
    ('front',(0,-18,5.3),(0,0,4),8.65),
    ('three-quarter',(10,-17,6.3),(0,0,4),8.65),
    ('rear',(-7,18,6.2),(0,0,4),8.65),
    ('face',(3.8,-17,7),(0,0,6.05),3.75),
]:
    camera.location=position; camera.data.ortho_scale=scale
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(root/'art'/'previews'/'goku-v2'/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('RENDER VERIFIED',name,flush=True)
