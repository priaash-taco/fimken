from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
rng=np.random.default_rng(942)
w,h=2048,1024
fine=Image.fromarray(rng.integers(0,256,(512,1024),dtype=np.uint8)).resize((w,h),Image.Resampling.BICUBIC)
grain=np.array(fine.filter(ImageFilter.GaussianBlur(.7)),dtype=np.float32)/255
coarse=np.array(Image.fromarray(rng.integers(0,256,(32,64),dtype=np.uint8)).resize((w,h),Image.Resampling.BICUBIC),dtype=np.float32)/255
field=.68+grain*.24+coarse*.18
spots=np.zeros((h,w),dtype=np.float32)
y,x=np.mgrid[0:h,0:w]
for i in range(17):
 cx=rng.uniform(0,w);cy=h*.5+rng.choice([-1,1])*rng.uniform(55,170);r=rng.uniform(5,20)
 d=((x-cx)/r)**2+((y-cy)/(r*.75))**2
 spots+=np.exp(-d*2)*.75+np.exp(-d*.33)*.13
 for j in range(3):
  dx=rng.uniform(-r*2,r*2);dy=rng.uniform(-r,r)
  spots+=np.exp(-(((x-cx-dx)/(r*.22))**2+((y-cy-dy)/(r*.22))**2))*.40
v=np.clip(field-spots,.06,1)
rgb=np.stack([v*255,v**1.18*226,v**1.5*144],axis=-1)
Image.fromarray(np.uint8(rgb)).save('public/environment/cosmos/solar-photosphere.jpg',quality=96,subsampling=0)
print('Baked solar granulation, active regions and sunspot groups.')
