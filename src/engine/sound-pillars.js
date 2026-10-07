import { shaderPalette } from './palette.js';
import * as THREE from 'three';
// A ring of light columns at the edge of the arena, one per slice of the spectrum. Each column
// rises with its own frequencies, so the music is visible in the world itself: bass at one end of
// the ring, treble at the other (mirrored, so the ring has no seam). They are soft noise fields,
// not bars: the tops flicker and dissolve, and rocks and fog sit in front of them.
const COUNT = 56;
export class SoundPillars {
  constructor(scene, noise) {
    this.levels = new Float32Array(COUNT); this.kick = 0;
    const geometry = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
    const angle = new Float32Array(COUNT), radius = new Float32Array(COUNT), band = new Float32Array(COUNT), seed = new Float32Array(COUNT);
    this.bins = [];
    for (let i = 0; i < COUNT; i++) {
      angle[i] = (i + .5) / COUNT * Math.PI * 2; radius[i] = 11 + ((i * 7919) % 100) / 100 * 4; seed[i] = ((i * 2654435761) % 1000) / 1000;
      band[i] = Math.abs((i + .5) / COUNT * 2 - 1);
    }
    this.levelAttr = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1); this.levelAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('angle', new THREE.InstancedBufferAttribute(angle, 1)); geometry.setAttribute('radius', new THREE.InstancedBufferAttribute(radius, 1));
    geometry.setAttribute('band', new THREE.InstancedBufferAttribute(band, 1)); geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seed, 1));
    geometry.setAttribute('level', this.levelAttr); geometry.instanceCount = COUNT;
    this.band = band;
    this.uniforms = { noiseTex: { value: noise }, time: { value: 0 }, strength: { value: 1 } };
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute float angle;attribute float radius;attribute float band;attribute float seed;attribute float level;varying vec2 vUv;varying float vLevel;varying float vBand;varying float vSeed;
        void main(){vUv=uv;vLevel=level;vBand=band;vSeed=seed;
         vec3 base=vec3(sin(angle)*radius,-.05,cos(angle)*radius);
         vec3 toCam=normalize(vec3(cameraPosition.x-base.x,0.,cameraPosition.z-base.z)+vec3(0.,0.,1e-5));
         vec3 right=vec3(toCam.z,0.,-toCam.x);
         float h=1.+level*11.,w=.45+level*.5;
         vec3 world=base+right*position.x*w+vec3(0.,uv.y*h,0.);
         gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
      fragmentShader: shaderPalette + `uniform sampler2D noiseTex;uniform float time,strength;varying vec2 vUv;varying float vLevel;varying float vBand;varying float vSeed;
        void main(){
         float x=vUv.x*2.-1.,y=vUv.y;
         float n=texture2D(noiseTex,vec2(x*.35+vSeed*3.,y*.55-time*(.5+vLevel*1.2))).r;
         float n2=texture2D(noiseTex,vec2(x*.9+vSeed*7.,y*1.4-time*1.3)).g;
         float side=1.-smoothstep(.15,1.,abs(x+(n-.5)*.5));
         float top=1.-smoothstep(.55,1.,y+(n2-.5)*.35);
         float a=side*top*smoothstep(0.,.06,y)*(.35+.9*n);
         vec3 low=mix(p_deepBeamBlue,p_kamehamehaBlue,smoothstep(0.,.5,vBand));
         vec3 col=mix(low,mix(p_friezaPurple,p_superSaiyanGold,smoothstep(.55,1.,vBand)),smoothstep(.3,.9,vBand));
         col=mix(col,p_spiritGlowWhite,pow(1.-y,3.)*vLevel*.8);
         gl_FragColor=vec4(col*a*(.6+vLevel*1.9)*strength,1.);}` }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -6; this.mesh.visible = false; scene.add(this.mesh);
  }
  // bins: 0..255 FFT magnitudes (or null when silent); sampleRate for frequency mapping.
  update(dt, time, bins, sampleRate, effects, music) {
    this.mesh.visible = effects > .01; if (!this.mesh.visible) return;
    const hz = bins ? sampleRate / (bins.length * 2) : 1;
    this.kick = Math.max(0, this.kick - dt * 3.5); if (music?.bassHit) this.kick = 1;
    for (let i = 0; i < COUNT; i++) {
      let target = .05 + .03 * Math.sin(time * .8 + i * .9);
      if (bins) {
        // Log-spaced slice: 45 Hz at the bass end to 11 kHz at the treble end.
        const lo = 45 * Math.pow(11000 / 45, this.band[i] ** 1.0 * (1 - .04)), hi = lo * Math.pow(11000 / 45, 1 / COUNT * 2.4);
        const a = Math.max(1, Math.floor(lo / hz)), b = Math.min(bins.length, Math.max(a + 1, Math.ceil(hi / hz)));
        let peak = 0; for (let k = a; k < b; k++) peak = Math.max(peak, bins[k] / 255);
        // Highs are quieter in music, so tilt the slices up toward the treble end.
        target = Math.max(target, Math.min(1, peak ** 1.4 * (1 + this.band[i] * 1.1) + this.kick * .22 * (1 - this.band[i])));
      }
      const rate = target > this.levels[i] ? 28 : 5; this.levels[i] += (target - this.levels[i]) * (1 - Math.exp(-dt * rate));
      this.levelAttr.array[i] = this.levels[i];
    }
    this.levelAttr.needsUpdate = true; this.uniforms.time.value = time; this.uniforms.strength.value = Math.min(1, effects);
  }
}
