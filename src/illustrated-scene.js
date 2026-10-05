import * as THREE from 'three';
import { AudioAnalyzer, MusicState } from './engine/music-state.js';

// The painting is the source of detail. Only its light, atmosphere and framing
// move: this is an illustrated scene, not a reconstructed or rigged character.
export class IllustratedScene {
  constructor(canvas, audio) {
    Object.assign(this, { canvas, audio, time: 0, sensitivity: .65, effects: .65,
      view: 'training', quality: 'balanced', environment: 'nebula', power: 0 });
    this.paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.autoCamera = !this.paused;
    this.analyzer = new AudioAnalyzer(); this.music = new MusicState();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene(); this.camera = new THREE.Camera();
    this.uniforms = {
      art: { value: null }, aspect: { value: 1 }, time: { value: 0 },
      power: { value: 0 }, effects: { value: .65 }, drift: { value: 0 },
      portrait: { value: 0 }, blue: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        uniform sampler2D art;
        uniform float aspect,time,power,effects,drift,portrait,blue;
        varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          // Crop unused sky, retaining hair, feet and the painted reflection.
          float zoom=1.+portrait*.22+drift*(.008+.008*sin(time*.09));
          float span=mix(1140.,1080.,1.-smoothstep(.5,1.,aspect))/zoom;
          vec2 p=vec2((vUv.x-.53)*aspect*span/1024.+.665,
            1.-(350.+(1.-vUv.y)*span)/1536.);
          p.x+=drift*sin(time*.07)*.003;
          p.y+=drift*sin(time*.11)*.0015;
          // Extend only the empty left-hand sky/water, never mirror the actor.
          float skyX=.04+.24*(.5+.5*sin(vUv.x*3.14159));
          vec3 bg=texture2D(art,vec2(skyX,p.y)).rgb;
          vec3 painted=texture2D(art,clamp(p,vec2(0.),vec2(1.))).rgb;
          float edge=smoothstep(0.,.18,p.x)*(1.-smoothstep(.87,1.,p.x));
          vec3 c=mix(bg,painted,edge);
          float gold=smoothstep(.07,.3,painted.r-painted.b)*smoothstep(.25,.7,painted.g);
          float electric=smoothstep(.12,.35,painted.b-painted.r)*smoothstep(.4,.85,painted.b);
          float filament=.5+.5*sin(p.y*130.-time*3.8+sin(p.x*80.)*3.);
          float grain=hash(floor(p*vec2(1024.,1536.)));
          float sparkle=pow(max(0.,sin(time*2.+grain*90.)),22.);
          float pulse=.35+.3*sin(time*1.6)+power;
          // Selective emission from the existing intricate painted filaments.
          c+=edge*effects*(gold*vec3(1.,.62,.17)*(.035+filament*.075+sparkle*.09)*pulse
            +electric*vec3(.12,.45,1.)*(.025+.12*power));
          c*=vec3(1.-blue*.025,1.,1.+blue*.055);
          float vignette=1.-.18*smoothstep(.3,.85,length((vUv-.5)*vec2(1.,.7)));
          gl_FragColor=vec4(c*vignette,1.);
        }`,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    const positions = new Float32Array(220 * 3), seeds = new Float32Array(220);
    for (let i = 0; i < 220; i++) {
      positions[i * 3] = Math.sin(i * 42.137) * .95;
      positions[i * 3 + 1] = (i * .61803398875) % 1;
      seeds[i] = (i * .754877666) % 1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    this.dustMaterial = new THREE.ShaderMaterial({
      uniforms: { time: this.uniforms.time, power: this.uniforms.power, effects: this.uniforms.effects,
        aspect: this.uniforms.aspect, ratio: { value: 1 } },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float seed; uniform float time,power,aspect,ratio;
        varying float opacity; varying float tint;
        void main(){float y=fract(position.y+time*(.014+seed*.016));
        float x=position.x+sin(time*.25+seed*20.+y*4.)*.07;
        gl_Position=vec4(x/aspect+.06,y*2.-1.,0.,1.);
        gl_PointSize=(.8+seed*2.)*ratio;
        opacity=sin(y*3.14159)*(.25+seed*.45)*(1.+power*.5);
        tint=seed;}`,
      fragmentShader: `uniform float effects; varying float opacity,tint;
        void main(){float d=length(gl_PointCoord-.5)*2.;
        float a=pow(max(0.,1.-d),2.);
        gl_FragColor=vec4(mix(vec3(1.,.57,.18),vec3(.45,.7,1.),step(.91,tint)),a*opacity*effects);}`,
    });
    this.dust = new THREE.Points(geometry, this.dustMaterial); this.dust.frustumCulled = false;
    this.scene.add(this.dust);
    this.ready = new THREE.TextureLoader().loadAsync('/artwork/goku-energy.png').then(texture => {
      // Work in the original display-referred painting colours, without tone mapping.
      texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      this.uniforms.art.value = texture; this.loaded = true;
      canvas.dataset.artworkResolution = `${texture.image.width}×${texture.image.height}`;
    }).catch(error => { this.onerror?.(`The artwork could not load: ${error.message}`); });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas); this.resize();
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.contextLost = true; this.audio.stop();
      this.onerror?.('The graphics connection was lost. Reload to restore the artwork.');
    });
    this.renderer.setAnimationLoop(now => this.frame(now));
  }
  setQuality(value) { this.quality = value; this.resize(); }
  setEnvironment(value) { this.environment = value; this.uniforms.blue.value = value === 'eclipse' ? 1 : 0; }
  resetCamera() { this.time = 0; }
  resetTraining() { this.time = 0; this.music.reset(); this.power = 0; }
  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    const maxPixels = this.quality === 'high' ? 3840 * 2160 : this.quality === 'low' ? 1920 * 1080 : 2560 * 1440;
    const ratio = Math.min(devicePixelRatio, this.quality === 'low' ? 1 : 2, Math.sqrt(maxPixels / (width * height)));
    this.renderer.setPixelRatio(ratio); this.renderer.setSize(width, height, false);
    this.uniforms.aspect.value = width / height; this.dustMaterial.uniforms.ratio.value = ratio;
    this.dust.geometry.setDrawRange(0, this.quality === 'low' ? 90 : 220);
    this.canvas.dataset.resolution = `${this.canvas.width}×${this.canvas.height}`;
  }
  frame(now) {
    const dt = Math.min(.05, (now - (this.last ?? now)) / 1000); this.last = now;
    if (document.hidden || this.suspended || !this.loaded || this.contextLost) return;
    if (!this.paused) {
      this.time += dt;
      this.music.update(dt, this.analyzer.analyse(this.audio.spectrum(), this.audio.context?.sampleRate || 44100, this.sensitivity), this.audio.mode !== 'idle');
      this.power += (Math.min(1, this.music.energy + this.music.beatStrength * .45) - this.power) * (1 - Math.exp(-dt * 5));
    }
    this.uniforms.time.value = this.time; this.uniforms.power.value = this.power;
    this.uniforms.effects.value = this.effects; this.uniforms.drift.value = this.autoCamera ? 1 : 0;
    this.uniforms.portrait.value = this.view === 'portrait' ? 1 : 0;
    this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.ready = 'true'; this.canvas.dataset.section = this.music.section;
    this.canvas.dataset.time = this.time.toFixed(3); this.canvas.dataset.power = this.power.toFixed(3);
  }
}
