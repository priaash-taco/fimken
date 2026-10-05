"""Bake deterministic original cosmic textures locally; no network or API spend."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
out=Path('public/environment/cosmos');out.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(719)
def noise(w,h,octaves=7):
    a=np.zeros((h,w),dtype=np.float32);weight=0
    for i in range(octaves):
        n=2**(i+2);v=rng.integers(0,256,(max(2,n//2),n),dtype=np.uint8)
        v=np.array(Image.fromarray(v).resize((w,h),Image.Resampling.BICUBIC),dtype=np.float32)/255
        gain=.58**i;a+=v*gain;weight+=gain
    return a/weight
w,h=4096,2048
x=np.linspace(0,1,w,dtype=np.float32)[None,:];y=np.linspace(0,1,h,dtype=np.float32)[:,None]
f=noise(w,h);g=noise(w,h)
band=np.exp(-((y-.49-.12*np.sin(x*11)-.04*np.cos(x*27)+(f-.5)*.12)/.105)**2)
wisps=np.clip((f-.27)*2,0,1)*band
veins=np.clip((g-.42)*4,0,1)**1.7
rgb=np.zeros((h,w,3),dtype=np.float32);rgb[:]=[2,3,10]
for k,c in enumerate([53,27,98]):rgb[:,:,k]+=wisps*c
for k,c in enumerate([22,50,80]):rgb[:,:,k]+=wisps*veins*c
rgb*=1-np.clip((g-.53)*3,0,.64)[:,:,None]
image=Image.fromarray(np.uint8(np.clip(rgb,0,255)));d=ImageDraw.Draw(image)
for i in range(11000):
    sx=int(rng.integers(w));sy=int(rng.integers(h));v=int(rng.integers(60,205));r=0 if i<10400 else 1
    d.ellipse((sx-r,sy-r,sx+r,sy+r),fill=(int(v*.83),int(v*.9),v))
for i in range(65):
    sx=int(rng.integers(w));sy=int(rng.integers(h));d.line((sx-3,sy,sx+3,sy),fill=(105,125,165));d.line((sx,sy-3,sx,sy+3),fill=(105,125,165));d.point((sx,sy),fill=(245,246,255))
image.save(out/'nebula-stars.jpg',quality=94,subsampling=0)
w,h=2048,1024
terrain=noise(w,h,8);mare=noise(w,h,4)
relief=terrain*.25+.4;albedo=100+terrain*65+mare*45
for i in range(650):
    cx=int(rng.integers(80,w-80));cy=int(rng.integers(80,h-80));r=int(np.clip(rng.lognormal(2.1,.8),3,65))
    yy,xx=np.mgrid[-r:r+1,-r:r+1];d=np.sqrt(xx**2+yy**2)/r
    rim=np.exp(-((d-.86)/.065)**2);bowl=np.maximum(0,1-(d/.86)**2)**2
    relief[cy-r:cy+r+1,cx-r:cx+r+1]+=.045*rim-.035*bowl
    albedo[cy-r:cy+r+1,cx-r:cx+r+1]+=3*rim-4*bowl
Image.fromarray(np.uint8(np.clip(relief*255,0,255))).save(out/'moon-height.png')
rgb=np.stack([albedo*.87,albedo*.89,albedo*.93],axis=-1);Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(out/'moon-albedo.jpg',quality=95)
surface=noise(1024,512,8);rgb=np.stack([np.full_like(surface,255),95+surface*155,12+surface*85],axis=-1);Image.fromarray(np.uint8(rgb)).save(out/'sun-surface.jpg',quality=95)
print('Baked 4096 x 2048 cosmic backdrop, lunar albedo/height, and solar surface.')
