import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const BLOOM_SCALE = .5;
export const QUALITY = Object.freeze({
  low: { ratio: 1, maxPixels: 1920 * 1080, shadow: 1024, particles: 180, bloom: false, anisotropy: 2 },
  balanced: { ratio: 1.5, maxPixels: 2560 * 1440, shadow: 2048, particles: 400, bloom: true, anisotropy: 16 },
  high: { ratio: 2, maxPixels: 3840 * 2160, shadow: 2048, particles: 720, bloom: true, anisotropy: 16 },
});

export class CinematicRenderer {
  constructor(canvas, scene, camera) {
    this.scene = scene; this.camera = camera;
    this.canvas = canvas; this.quality = 'high'; this.adaptive = 1; this.frameTime = 16.7;
    // The cinematic path draws one full-screen triangle to the canvas, so canvas multisampling adds
    // nothing there and its resolve drops frames at large sizes. Direct rendering
    // (inspection and debug URLs) keeps it.
    const query = new URLSearchParams(location.search), direct = query.get('inspection') === '1' || query.has('debug');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: direct, preserveDrawingBuffer:true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .9;
    this.renderer.shadowMap.enabled = true;
    // Hard-edged, graphic ground shadows rather than soft physical ones.
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
    this.composer = new EffectComposer(this.renderer,target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.heatWorld = new THREE.Vector3(0,1,0); this.heatProjection = new THREE.Vector3();
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .22, .18, 2.4);
    this.composer.addPass(this.bloom);
    // The blur chain starts one octave lower (see resize), so each level takes the weight
    // of the next-finer original level and the glow keeps its original spread.
    const r=this.bloom.radius, weights=[1,.8,.6,.4,.2].map(x=>x+(1.2-2*x)*r);
    this.bloom.compositeMaterial.uniforms.bloomFactors.value=[weights[0]+weights[1],weights[2],weights[3],weights[4],0].map(w=>(w-1.2*r)/(1-2*r));
    // Heat haze, grade, tone mapping and sRGB conversion share one full-screen pass.
    // The arithmetic and its order match the former separate passes.
    this.finish = new ShaderPass(new THREE.RawShaderMaterial({
      uniforms: { tDiffuse:{value:null}, toneMappingExposure:{value:1}, warmth:{value:.03}, cold:{value:0}, darken:{value:0}, contrast:{value:1}, flash:{value:0}, time:{value:0}, strength:{value:0}, speed:{value:0}, center:{value:new THREE.Vector2(.5,.5)}, radius:{value:new THREE.Vector2(.1,.25)} },
      vertexShader:'precision highp float;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;attribute vec3 position;attribute vec2 uv;varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`precision highp float;
      uniform sampler2D tDiffuse;uniform float warmth;uniform float cold;uniform float darken;uniform float contrast;uniform float flash;uniform float time;uniform float strength;uniform float speed;uniform vec2 center;uniform vec2 radius;varying vec2 vUv;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      void main(){vec2 uv=vUv;
      if(strength>0.){vec2 p=(vUv-center)/radius;float d=length(p);
       float ring=smoothstep(.88,1.10,d)*(1.-smoothstep(1.45,1.9,d));
       float flow=sin(vUv.y*160.-time*5.+sin(vUv.x*93.+time)*2.);
       uv=clamp(vUv+vec2(flow,sin(vUv.x*117.+time*3.)*.3)*.0012*strength*ring,vec2(.001),vec2(.999));}
      vec3 c=texture2D(tDiffuse,uv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));
      c=mix(vec3(l),c,1.04);c*=vec3(1.+warmth,1.,1.-warmth*.55);
      c=mix(c,c*vec3(.72,.84,1.25)+vec3(0.,.01,.05)*l,cold);
      // Attack treatment: the frame edges fall away, contrast rises, a release whites out for a beat.
      float edgeFall=smoothstep(.12,.72,length((vUv-.5)*vec2(1.,.85)));
      c*=1.-darken*edgeFall;c=max((c-.14)*contrast+.14,0.);c=mix(c,vec3(1.,.97,.9)*1.3,flash*.28);
      // Speed lines: thin streaks racing in from the frame edge while the hero moves fast.
      if(speed>0.){vec2 s=vUv-.5;float lane=floor(atan(s.y,s.x)*38.),pick=fract(sin(lane*91.7)*43758.5);
       float streak=step(.80,pick)*smoothstep(.20+pick*.12,.62,length(s))*step(.35,fract(length(s)*3.-time*7.-pick*5.));
       c+=vec3(.75,.88,1.)*streak*speed*.85;}
      float v=1.-.22*smoothstep(.22,.74,length((vUv-.5)*vec2(1.,.8)));
      c=ACESFilmicToneMapping(max(c*v,vec3(0.)));
      gl_FragColor=sRGBTransferOETF(vec4(c,1.));}`,
    }));
    this.composer.addPass(this.finish);
    this.fxaa = new ShaderPass({...FXAAShader,fragmentShader:FXAAShader.fragmentShader.replace('_SubpixelBlending = 1.0','_SubpixelBlending = 0.35')});
    this.composer.addPass(this.fxaa);
    this.sampleAge = 0; this.raiseAge = 0; this.raiseDelay = 12; this.gpuMs = null; this.heatStrength = 0;
  }
  setSharpDebug(enabled) {this.sharpDebug=enabled;this.resize();}
  setQuality(name) { this.quality = QUALITY[name] ? name : 'balanced'; this.adaptive = 1; this.raiseAge = 0; this.resize(); }
  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    const preset = QUALITY[this.quality];
    const gpuLimit=Math.min(this.renderer.capabilities.maxTextureSize,this.renderer.getContext().getParameter(this.renderer.getContext().MAX_RENDERBUFFER_SIZE));
    const ratio = this.sharpDebug ? Math.min(Math.max(2,devicePixelRatio),Math.sqrt(3840*2160/(width*height)),gpuLimit/width,gpuLimit/height) : Math.min(this.quality==='high'?Math.max(1.5,devicePixelRatio):devicePixelRatio, preset.ratio, Math.sqrt(preset.maxPixels / (width * height)));
    // Adaptive work targets may resize; the presented canvas must remain intact.
    if(this.renderer.getPixelRatio()!==ratio || this.canvas.width!==Math.floor(width*ratio) || this.canvas.height!==Math.floor(height*ratio)){
      this.renderer.setPixelRatio(ratio);this.renderer.setSize(width,height,false);
    }
    const postRatio=this.sharpDebug?ratio:ratio*this.adaptive;
    this.composer.setPixelRatio(postRatio);this.composer.setSize(width,height);
    // Glow is low-frequency: its blur chain starts from half of the internal resolution.
    this.bloom.setSize(width*postRatio*BLOOM_SCALE,height*postRatio*BLOOM_SCALE);
    this.fxaa.uniforms.resolution.value.set(1/(width*postRatio),1/(height*postRatio));
    this.bloom.enabled = preset.bloom;
    this.fxaa.enabled=true;
    this.canvas.dataset.resolution = `${Math.round(width * ratio)}×${Math.round(height * ratio)}`;
    this.canvas.dataset.renderScale = this.adaptive.toFixed(2);
  }
  // Hold 60 fps. Internal resolution is shed when the GPU cannot keep up and returned
  // only when measured GPU time shows room, so the two thresholds cannot oscillate.
  // Only the composer buffers change; the presented canvas keeps its size.
  govern(dt) {
    if (!(dt > 0 && dt < .5)) return;
    this.frameTime += (dt * 1000 - this.frameTime) * (1 - Math.exp(-dt / .4));
    this.sampleAge += dt; this.raiseAge += dt;
    if (this.sampleAge < 1) return;
    this.sampleAge = 0; this.canvas.dataset.fps = String(Math.round(1000 / this.frameTime));
    if (this.comparing || this.sharpDebug) return;
    const old = this.adaptive, gpu = this.gpuMs, floor = this.quality === 'high' ? .5 : .6;
    if (this.frameTime > 19.5 && (gpu == null || gpu > 11)) {
      this.adaptive = Math.max(floor, old * THREE.MathUtils.clamp(Math.sqrt(gpu == null ? 16 / this.frameTime : 13 / gpu), .7, .95));
      // Without GPU timing, wait progressively longer before trying a higher resolution again.
      if (this.raised) this.raiseDelay = Math.min(240, this.raiseDelay * 2);
      this.raised = false; this.raiseAge = 0;
    } else if (old < 1 && this.frameTime < 18.5) {
      const next = Math.min(1, old + .1);
      if (gpu != null ? gpu * (next / old) ** 2 < 10.5 && this.raiseAge > 2 : this.raiseAge > this.raiseDelay) { this.adaptive = next; this.raised = true; this.raiseAge = 0; }
    }
    if (old !== this.adaptive) this.resize();
  }
  render(dt, power, effects, sceneTime = 0) {
    // Resize BEFORE drawing: changing canvas dimensions clears the framebuffer.
    this.govern(dt);
    this.heatProjection.copy(this.heatWorld).project(this.camera);
    const finish = this.finish.uniforms;
    finish.center.value.set(this.heatProjection.x*.5+.5,this.heatProjection.y*.5+.5);
    const radius=.65/(Math.tan(THREE.MathUtils.degToRad(this.camera.fov*.5))*Math.max(1,this.camera.position.distanceTo(this.heatWorld)));
    finish.radius.value.set(radius*.62/this.camera.aspect,radius);
    this.heatStrength = this.quality!=='low' && effects>.001 && power>.3 ? effects*(power-.3) : 0;
    finish.strength.value=this.heatStrength; finish.time.value=sceneTime;
    finish.toneMappingExposure.value=this.renderer.toneMappingExposure; finish.cold.value=this.cold||0; finish.speed.value=this.speed||0; finish.darken.value=this.darken||0; finish.contrast.value=this.contrast||1; finish.flash.value=this.flash||0;
    const energy = Math.max(0, power - .25) / .75;
    this.bloom.strength = (.18 + energy * .2) * effects;
    this.bloom.radius = .18 + energy * .22;
    if (this.inspection) this.renderer.render(this.scene, this.camera);
    else this.composer.render();
    this.canvas.dataset.postprocessing = String(!this.inspection);
  }
}
