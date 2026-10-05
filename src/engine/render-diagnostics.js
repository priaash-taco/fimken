import * as THREE from 'three';
const filters=new Map([[THREE.NearestFilter,'Nearest'],[THREE.LinearFilter,'Linear'],[THREE.NearestMipmapNearestFilter,'Nearest / nearest mip'],[THREE.NearestMipmapLinearFilter,'Nearest / linear mip'],[THREE.LinearMipmapNearestFilter,'Linear / nearest mip'],[THREE.LinearMipmapLinearFilter,'Linear / linear mip (trilinear)']]);
export function characterTextures(model){
  const textures=new Map();
  model?.traverse(o=>{if(!o.isMesh)return;for(const m of [o.material].flat())for(const [slot,t]of Object.entries(m))if(t?.isTexture){
    if(!textures.has(t))textures.set(t,new Set());textures.get(t).add(slot);
  }});return textures;
}
export function inspectRendering(scene){
  const p=scene.pipeline,r=p.renderer,gl=r.getContext(),rect=p.canvas.getBoundingClientRect(),size=r.getDrawingBufferSize(new THREE.Vector2());
  const extension=gl.getExtension('EXT_texture_filter_anisotropic'),binding=gl.getParameter(gl.TEXTURE_BINDING_2D);
  const textures=[];
  try{for(const [t,slots]of characterTextures(scene.actor.model)){
    const gpu=r.properties.get(t).__webglTexture;let sampling=null;
    if(gpu && !t.isCubeTexture){gl.bindTexture(gl.TEXTURE_2D,gpu);sampling={minFilter:gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER),magFilter:gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER),anisotropy:extension?gl.getTexParameter(gl.TEXTURE_2D,extension.TEXTURE_MAX_ANISOTROPY_EXT):1};}
    textures.push({name:t.name,slots:[...slots],width:t.image?.width,height:t.image?.height,colorSpace:t.colorSpace||'linear data',imageType:t.image?.constructor?.name,
      compressed:Boolean(t.isCompressedTexture),generateMipmaps:t.generateMipmaps,suppliedMipLevels:t.mipmaps.length,minFilter:filters.get(t.minFilter),magFilter:filters.get(t.magFilter),anisotropy:t.anisotropy,gpuSampling:sampling,exceedsGpuTextureLimit:Math.max(t.image?.width||0,t.image?.height||0)>r.capabilities.maxTextureSize});
  }}finally{gl.bindTexture(gl.TEXTURE_2D,binding);}
  return {mode:scene.comparisonMode||'live',asset:scene.actor.definition.url,quality:p.quality,
    viewport:{css:[rect.width,rect.height],devicePixelRatio,rendererPixelRatio:r.getPixelRatio(),drawingBuffer:size.toArray(),canvas:[p.canvas.width,p.canvas.height],composer:[p.composer.readBuffer.width,p.composer.readBuffer.height],adaptiveScale:p.adaptive},
    antialiasing:{contextAntialias:gl.getContextAttributes().antialias,defaultFramebufferSamples:gl.getParameter(gl.SAMPLES),composerSamples:p.composer.readBuffer.samples,sceneUsesDefaultFramebuffer:Boolean(p.inspection),fxaa:!p.inspection&&p.fxaa.enabled},
    gpu:{maxTextureSize:r.capabilities.maxTextureSize,maxAnisotropy:r.capabilities.getMaxAnisotropy(),maxSamples:r.capabilities.maxSamples},
    treatment:{material:scene.actor.finish,celStrength:scene.actor.heroFinish?.enabled.value||0,outlineVisible:scene.actor.heroFinish?.outlines.some(o=>o.visible)||false,outlineWidth:scene.actor.heroFinish?.width.value||0,
      toneMapping:r.toneMapping===THREE.ACESFilmicToneMapping?'ACES Filmic':r.toneMapping===THREE.NoToneMapping?'None':r.toneMapping,exposure:r.toneMappingExposure,outputColorSpace:r.outputColorSpace,
      bloom:!p.inspection&&p.bloom.enabled&&p.bloom.strength>0,bloomStrength:!p.inspection?p.bloom.strength:0,heatDistortion:!p.inspection&&p.heatStrength>0,postProcessing:!p.inspection,aura:scene.vfx.root.visible,neutralLighting:Boolean(scene.lighting.inspection)},
    camera:{position:scene.camera.position.toArray(),quaternion:scene.camera.quaternion.toArray(),fov:scene.camera.fov,target:scene.controls.target.toArray()},
    pose:{time:scene.time,move:scene.director.moveId,progress:scene.director.progress,paused:scene.paused},textures};
}
export function describeRendering(d){
  return [
    `${d.mode==='sharp'?'SHARP / ORIGINAL':d.mode==='cinematic'?'CINEMATIC / SAVED SETTINGS':'LIVE RENDER'}`,
    `CSS viewport: ${d.viewport.css.join(' x ')}`,
    `Render buffer: ${d.viewport.drawingBuffer.join(' x ')} | DPR ${d.viewport.devicePixelRatio} | render ratio ${d.viewport.rendererPixelRatio.toFixed(2)}`,
    `Adaptive scale: ${d.viewport.adaptiveScale.toFixed(2)} | quality: ${d.quality}`,
    `Scene MSAA: ${d.antialiasing.sceneUsesDefaultFramebuffer?d.antialiasing.defaultFramebufferSamples:d.antialiasing.composerSamples} samples | FXAA: ${d.antialiasing.fxaa?'on':'off'}`,
    `Materials: ${d.treatment.material} | outlines: ${d.treatment.outlineVisible?'on':'off'}`,
    `Bloom / heat / aura: ${d.treatment.bloom?'on':'off'} / ${d.treatment.heatDistortion?'on':'off'} / ${d.treatment.aura?'on':'off'}`,
    `Tone mapping: ${d.treatment.toneMapping}, exposure ${d.treatment.exposure}`,
    `GPU max texture: ${d.gpu.maxTextureSize} | max anisotropy: ${d.gpu.maxAnisotropy}x`,
    ...d.textures.map(t=>`${t.slots.join(' + ')}: ${t.width} x ${t.height} | anisotropy ${t.gpuSampling?.anisotropy??t.anisotropy}x\n  ${t.minFilter}; magnify ${t.magFilter}; mipmaps ${t.generateMipmaps?'generated':t.suppliedMipLevels}; ${t.compressed?'compressed GPU texture':'uncompressed GPU texture'}`)
  ].join('\n');
}
