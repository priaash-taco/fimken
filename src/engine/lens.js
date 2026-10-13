import * as THREE from 'three';
import { ENERGY_LIGHT } from './energy-light.js';
// Rendering lenses: four art directions applied to the same character and performance.
//   classic  the original look (an exact identity: nothing below changes it)
//   noir     light sculpture: near-black, a dark performer revealed by moving light
//   volume   cinematic energy: dark atmospheric world, physical key and back light, light shafts
//   chroma   motion art: black studio, reflective floor, satin cyan/violet/magenta reflections
// A lens never touches animation, choreography or audio playback. It sets lights, hero material
// uniforms, environment, grade, bloom, reflections and the colour of the energy effects. Continuous
// values glide to the new lens; things that cannot blend (hidden sky, rocks) switch behind a short
// dip to black. Each lens reads the same music differently (see `listen`).
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mixArray = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Shared by the plasma, flame and pillar shaders: gain, saturation, tint and the Chroma ramp.
export const LENS_FX = { beam: { value: 1 }, comp: { value: 0 }, gain: { value: 1 }, sat: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) }, map: { value: 0 }, phase: { value: .2 } };
export const lensFxGlsl = `uniform float lensBeam;uniform float lensComp;uniform float lensGain;uniform float lensSat;uniform vec3 lensTint;uniform float lensMap;uniform float lensPhase;
vec3 lensFx(vec3 c){float l=dot(c,vec3(.2126,.7152,.0722));vec3 g=mix(vec3(l),c,lensSat)*lensTint;
 float t=clamp(lensPhase+l*.05,0.,1.);
 vec3 ramp=mix(mix(vec3(.10,.85,1.),vec3(.52,.30,1.),smoothstep(0.,.5,t)),vec3(1.,.22,.78),smoothstep(.5,1.,t));
 vec3 m=mix(ramp*l*1.15,vec3(l),smoothstep(1.2,3.5,l));
 vec3 o=mix(g,m,lensMap)*lensGain;float hot=max(o.r,max(o.g,o.b));return o/(1.+lensComp*max(hot-1.,0.));}
`;
export const lensFxUniforms = () => ({ lensBeam: LENS_FX.beam, lensComp: LENS_FX.comp, lensGain: LENS_FX.gain, lensSat: LENS_FX.sat, lensTint: LENS_FX.tint, lensMap: LENS_FX.map, lensPhase: LENS_FX.phase });

// Hero material treatment, injected into the character's materials (see hero-finish.js).
export const HERO_LENS = {
  lensAlbedo: { value: 1 }, lensAmbient: { value: 1 }, lensCel: { value: 1 }, lensFlood: { value: 0 }, lensRim: { value: 0 }, lensRimPow: { value: 3 },
  lensRimColor: { value: new THREE.Vector3(1, 1, 1) }, lensRimDir: { value: new THREE.Vector3(0, 0, 1) }, lensSpec: { value: 1 }, lensIrid: { value: 0 },
  lensPhase: { value: .2 }, lensStripe: { value: 0 }, lensHair: { value: 0 }, lensDesat: { value: 0 }, lensTintH: { value: new THREE.Vector3(1, 1, 1) },
};
export const heroLensGlsl = 'uniform float lensAlbedo;uniform float lensAmbient;uniform float lensCel;uniform float lensFlood;uniform float lensRim;uniform float lensRimPow;uniform vec3 lensRimColor;uniform vec3 lensRimDir;uniform float lensSpec;uniform float lensIrid;uniform float lensPhase;uniform float lensStripe;uniform float lensHair;uniform float lensDesat;uniform vec3 lensTintH;\nvarying float vSway;\n';
export const heroLensFragment = `
          reflectedLight.indirectDiffuse *= mix(lensAmbient, 1.0, lensFlood);
          vec3 lensN = normalize(normal); vec3 lensV = normalize(vViewPosition); float lensNV = clamp(dot(lensN, lensV), 0.0, 1.0);
          float lensEdge = pow(1.0 - lensNV, lensRimPow); float lensSide = clamp(dot(lensN, lensRimDir) * .6 + .55, 0.0, 1.0);
          reflectedLight.directSpecular += lensRimColor * lensEdge * lensSide * lensRim;
          if (lensIrid > 0.0) {
            vec3 rr = reflect(-lensV, lensN);
            float st = smoothstep(.6, .92, sin(rr.y * 5.5 + rr.x * 3.2 + lensStripe) * .5 + .5);
            float t = clamp(lensPhase + (1.0 - lensNV) * .3 + rr.x * .1, 0.0, 1.0);
            vec3 pal = mix(mix(vec3(.10,.85,1.), vec3(.52,.30,1.), smoothstep(0., .5, t)), vec3(1., .22, .78), smoothstep(.5, 1., t));
            reflectedLight.directSpecular += pal * (st * .85 + pow(1.0 - lensNV, 2.5) * .55) * lensIrid;
          }
          reflectedLight.directSpecular *= lensSpec;
          totalEmissiveRadiance += lensRimColor * vSway * lensHair;`;

const IDENTITY = {
  exposure: .9, bloom: 1, sat: 1, contrast: 1, vignette: 0, black: 0, shadow: [0, 0, 0], shafts: 0, mirror: 0,
  fogScale: 1, fogMix: 0, fogColor: [.03, .03, .08], floorMix: 0, floorColor: [.02, .02, .03], floorRough: .92, floorMetal: 0, floorOpacity: .72, dust: 1,
  fill: 1, key: 1, rim: 1, floorLight: 1, energy: 1, orb: 1, keyColor: [1, 1, 1], keyMix: 0, rimColor: [1, 1, 1], rimMix: 0, sweep: 0,
  albedo: 1, ambient: 1, cel: 1, rimStr: 0, rimPow: 3, heroRim: [1, 1, 1], spec: 1, irid: 0, hair: 0, ink: 1, floodK: 0, heroDesat: 0, heroTint: [1, 1, 1], pillars: 1, rays: 0,
  fxGain: 1, fxSat: 1, fxTint: [1, 1, 1], fxMap: 0, fxComp: 0, fxBeam: 1, contact: 0, energyColor: [1, 1, 1], energyMix: 0,
};
const lens = (p, d) => ({ p: { ...IDENTITY, ...p }, d: { sky: 'all', rocks: true, haze: true, ...d } });
export const LENSES = {
  classic: lens({}, {}),
  noir: lens({
    exposure: .74, bloom: .4, sat: .5, contrast: 1.3, vignette: .62, black: .022, shadow: [-.002, 0, .01],
    fogScale: 1.6, fogMix: 1, fogColor: [.004, .005, .009], floorMix: 1, floorColor: [.006, .006, .009], floorRough: .85, floorMetal: 0, floorOpacity: .5, dust: .5,
    fill: .03, key: .34, rim: 4.4, floorLight: .06, energy: 1.8, orb: 1.5, keyColor: [.8, .88, 1], keyMix: 1, rimColor: [.82, .9, 1], rimMix: .75, sweep: 2.8,
    albedo: .18, ambient: .08, cel: .15, rimStr: 2.6, rimPow: 2.8, heroRim: [.8, .9, 1], spec: 1.8, hair: .22, ink: 0, floodK: 1, heroDesat: .35, heroTint: [.85, .92, 1], pillars: 0,
    fxGain: .8, fxSat: .5, fxTint: [.88, .96, 1.12], fxComp: 1.2, fxBeam: .6, contact: 0, energyColor: [.9, .95, 1], energyMix: .8,
  }, { sky: 'none', rocks: false, haze: false }),
  volume: lens({
    exposure: .8, bloom: .75, sat: 1.05, contrast: 1.2, vignette: .42, black: .008, shadow: [0, .004, .016], shafts: 1,
    fogScale: 2.6, fogMix: .9, fogColor: [.03, .04, .075], floorMix: 1, floorColor: [.018, .017, .022], floorRough: .85, floorMetal: 0, floorOpacity: .85, dust: 1.7,
    fill: .14, key: 1.4, rim: 4.6, floorLight: .3, energy: 2.2, orb: 1.4, keyColor: [1, .84, .64], keyMix: .85, rimColor: [.5, .72, 1], rimMix: 1, rays: .7,
    albedo: .86, ambient: .3, cel: .45, rimStr: 2.2, rimPow: 2.5, heroRim: [.55, .78, 1], spec: 1.25, ink: .45, floodK: .12, pillars: .8,
    fxGain: 1, fxSat: 1.05, fxTint: [1.03, 1, .97], fxComp: .9, fxBeam: .68, contact: .6,
  }, { sky: 'dark', rocks: true, haze: true }),
  chroma: lens({
    exposure: .88, bloom: .7, sat: .95, contrast: 1.15, vignette: .3, black: .012, shadow: [.01, 0, .02], mirror: .85,
    fogScale: 1.3, fogMix: 1, fogColor: [.006, .004, .014], floorMix: 1, floorColor: [.004, .004, .008], floorRough: .95, floorMetal: 0, floorOpacity: 1, dust: .2,
    fill: .12, key: .5, rim: 1.1, floorLight: .04, energy: 1.2, orb: 1.2, keyColor: [.75, .78, 1], keyMix: 1, rimColor: [.2, .85, 1], rimMix: .8, sweep: .35,
    albedo: .5, ambient: .3, cel: .12, rimStr: 1.1, rimPow: 3, heroRim: [.3, .85, 1], spec: .9, irid: .42, ink: 0, floodK: .2, heroDesat: .96, heroTint: [.58, .66, .85], pillars: .3,
    fxGain: .95, fxSat: .9, fxTint: [1, 1, 1], fxMap: 1, fxComp: 1, fxBeam: .68, contact: .3, energyColor: [.3, .8, 1], energyMix: 1,
  }, { sky: 'none', rocks: false, haze: false }),
};
export const LENS_NAMES = Object.keys(LENSES);
const cloneParams = source => Object.fromEntries(Object.entries(source).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
const blend = (cur, target, k) => { for (const key of Object.keys(cur)) cur[key] = Array.isArray(cur[key]) ? mixArray(cur[key], target[key], k) : cur[key] + (target[key] - cur[key]) * k; };
// Cyan, violet, magenta: the only colours Chroma moves between.
const ramp = t => { t = clamp(t); const a = [.10, .85, 1], b = [.52, .30, 1], c = [1, .22, .78]; return t < .5 ? mixArray(a, b, t * 2) : mixArray(b, c, (t - .5) * 2); };

// A soft dark pool under the feet so the figure sits in the space instead of floating on it.
class ContactShadow {
  constructor(scene) {
    this.uniforms = { strength: { value: 0 } };
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.ShaderMaterial({ uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float strength;varying vec2 vP;void main(){float r=length(vP);gl_FragColor=vec4(0.,0.,0.,pow(max(0.,1.-r),1.7)*strength);}' }));
    this.mesh.rotation.x = -Math.PI / 2; this.mesh.renderOrder = -7; this.mesh.visible = false; scene.add(this.mesh);
  }
  update(position, strength) { this.mesh.visible = strength > .01; this.mesh.position.set(position.x, .02, position.z); this.mesh.scale.setScalar(.95); this.uniforms.strength.value = strength; }
}

export class LensController {
  constructor({ scene, world, lighting, pipeline, getActor, getPillars }) {
    Object.assign(this, { scene, world, lighting, pipeline, getActor, getPillars });
    this.name = 'classic'; this.inspection = false; this.time = 0; this.cur = cloneParams(IDENTITY); this.fade = { phase: 'idle', t: 0, pending: null, value: 1 };
    this.a = { bass: 0, mids: 0, highs: 0, energy: 0, accent: 0, build: 0, drop: 0, phase: .2, stripe: 0, flood: 0, chroma: 0 };
    this.sweep = new THREE.DirectionalLight('#cfe0ff', 0); scene.add(this.sweep, this.sweep.target);
    this.contact = new ContactShadow(scene);
    this.base = null; this.fogBase = null; this.floorBase = null; this.keyTouched = false; this.rimBase = null;
    this.c = new THREE.Color(); this.v = new THREE.Vector3(); this.w = new THREE.Vector3();
  }
  // Instant (used at start-up and for ?lens=).
  set(name) { if (!LENSES[name]) return; this.name = name; this.fade = { phase: 'idle', t: 0, pending: null, value: 1 }; this.commit(this.inspection ? 'classic' : name); }
  // Live switch: fade down, swap what cannot blend, fade up.
  select(name) { if (!LENSES[name] || (name === this.name && this.fade.phase === 'idle')) return; this.fade.pending = name; if (this.fade.phase !== 'out') { this.fade.phase = 'out'; this.fade.t = 0; } }
  setInspection(flag) { this.inspection = Boolean(flag); this.commit(flag ? 'classic' : this.name); if (flag) this.cur = cloneParams(IDENTITY); }
  commit(name) {
    const d = LENSES[name].d, world = this.world, cosmos = world.cosmos;
    for (const mesh of [world.spires, ...(world.spireVariants || []), world.rubble]) if (mesh) mesh.visible = d.rocks;
    if (world.haze) world.haze.visible = d.haze;
    if (cosmos) {
      cosmos.lensHidden = d.sky === 'none'; cosmos.root.visible = !this.inspection && !cosmos.lensHidden;
      const dark = d.sky === 'dark';
      cosmos.sky.material.color.setScalar(dark ? .1 : 1);
      for (const part of [cosmos.atmosphere, cosmos.sun, cosmos.corona]) if (part) part.visible = !dark;
      if (cosmos.stars) cosmos.stars.material.opacity = dark ? .5 : .7;
    }
  }
  listen(dt, music, director, mood, effects) {
    const a = this.a, r = x => 1 - Math.exp(-dt * x), m = music || {}, levels = mood?.levels || {};
    a.bass += ((m.bass || 0) - a.bass) * r(6); a.mids += ((m.mids || 0) - a.mids) * r(5); a.highs += ((m.highs || 0) - a.highs) * r(5); a.energy += ((m.energy || 0) - a.energy) * r(4);
    if (m.beat || m.bassHit) a.accent = 1; a.accent *= Math.exp(-dt * 9);
    a.build += (((m.section === 'build' || m.crescendo) ? 1 : 0) - a.build) * r(1.4);
    if (m.drop) a.drop = 1; a.drop *= Math.exp(-dt * 2.2);
    const flood = Math.max(levels.powerUp || 0, levels.release || 0, (levels.charge || 0) * .7, (levels.impact || 0) * .5) * effects;
    a.flood += (flood - a.flood) * r(8);
    return { m, levels, power: director?.power || 0 };
  }
  update(dt, { music, director, mood, effects = 1, camera, hero }) {
    dt = clamp(dt, 0, .1); this.time += dt;
    const f = this.fade;
    if (f.phase === 'out') { f.t += dt / .28; f.value = 1 - smooth(0, 1, f.t); if (f.t >= 1) { this.name = f.pending; this.commit(this.inspection ? 'classic' : this.name); f.phase = 'in'; f.t = 0; } }
    else if (f.phase === 'in') { f.t += dt / .55; f.value = smooth(0, 1, f.t); if (f.t >= 1) { f.phase = 'idle'; f.value = 1; } }
    const eff = this.inspection ? 'classic' : this.name, cur = this.cur;
    blend(cur, LENSES[eff].p, this.inspection ? 1 : 1 - Math.exp(-dt * 3.2));
    const { m, levels, power } = this.listen(dt, music, director, mood, effects), a = this.a, r = x => 1 - Math.exp(-dt * x);
    a.chroma += ((eff === 'chroma' ? 1 : 0) - a.chroma) * r(2.5);
    // What the music does in each lens.
    const dyn = { key: 1, rim: 1, energy: 1, exposure: 0, fog: 0, shafts: 0, rays: 0, sweep: cur.sweep, albedo: 0, ambient: 0, irid: 1 };
    let keyColor = cur.keyColor, rimColor = cur.rimColor, heroRim = cur.heroRim, sweepColor = [.81, .88, 1];
    if (eff === 'noir') {
      // Bass lifts the key, transients flick the rim, sustained intensity slowly reveals more of the figure.
      dyn.key = 1 + a.bass * .8; dyn.rim = 1 + a.accent * .7 + a.bass * .2; dyn.sweep = cur.sweep * (.3 + a.bass * 1.1 + a.energy * .5) + a.accent * .8;
      const detail = clamp((m.longTerm || 0) * 1.4) * .28; dyn.albedo = detail; dyn.ambient = detail * .6;
    } else if (eff === 'volume') {
      // Bass and builds lift the energy light and the air; a drop is one controlled strike.
      dyn.energy = 1 + a.bass * .5 + a.build * .3; dyn.key = 1 + a.build * .25; dyn.rim = 1 + a.build * .2 + a.drop * .4; dyn.fog = a.build * .008 + a.drop * .01; dyn.exposure = a.drop * .2;
      dyn.rays = cur.rays * (1 + a.bass * .5 + a.build * .6 + a.drop * 1.2 + (levels.release || 0)) * effects;
      dyn.shafts = cur.shafts * clamp(.08 + Math.max(0, power - .3) * .7 + a.bass * .25 + a.drop * .9 + (levels.release || 0) * .6, 0, 1) * effects;
    } else if (eff === 'chroma') {
      // Frequency balance moves the colour; bass sets the weight; highs run the reflection.
      const target = clamp(.1 + a.mids * .6 + a.highs * 1 - a.bass * .12 + .1 * Math.sin(this.time * .07)); a.phase += (target - a.phase) * r(.7); a.stripe += dt * (.5 + a.highs * 3.5);
      dyn.rim = 1 + a.bass * .5 + a.accent * .15; dyn.key = 1 + a.bass * .3; dyn.irid = .85 + a.highs * .35;
      keyColor = mixArray([.75, .78, 1], ramp(a.phase * .5), .5); rimColor = ramp(a.phase * .6 + .02); heroRim = rimColor; sweepColor = ramp(.45 + a.phase * .45);
    }
    const flood = a.flood * cur.floodK, L = this.lighting, position = hero || new THREE.Vector3();
    // Lights: every intensity is assigned fresh each frame by the scene, so these multiply once.
    this.base ??= { key: L.key.color.clone(), energy: L.energy.color.clone() }; this.rimBase ??= L.rim.position.clone();
    L.fill.intensity *= cur.fill; L.key.intensity *= cur.key * dyn.key; L.rim.intensity *= cur.rim * dyn.rim; L.floorLight.intensity *= cur.floorLight; L.energy.intensity *= cur.energy * dyn.energy; L.orb.intensity *= cur.orb;
    ENERGY_LIGHT.strength.value *= cur.energy * dyn.energy;
    if (cur.keyMix > .002 && !this.inspection) { L.key.color.copy(this.base.key).lerp(this.c.fromArray(keyColor), cur.keyMix); this.keyTouched = true; }
    else if (this.keyTouched && !this.inspection) { L.key.color.copy(this.base.key); this.keyTouched = false; }
    if (cur.energyMix > .002 && !this.inspection) { L.energy.color.copy(this.base.energy).lerp(this.c.fromArray(cur.energyColor), cur.energyMix); this.energyTouched = true; }
    else if (this.energyTouched) { L.energy.color.copy(this.base.energy); this.energyTouched = false; }
    if (cur.rimMix > .002 && !this.inspection) L.rim.color.lerp(this.c.fromArray(rimColor), cur.rimMix);
    if (a.chroma > .002) { const az = 2.4 + a.mids * .8 + Math.sin(this.time * .1) * .6; this.v.set(position.x + Math.sin(az) * 3.2, 3, position.z - Math.cos(az) * 3); L.rim.position.lerpVectors(this.rimBase, this.v, a.chroma); this.rimMoved = true; }
    else if (this.rimMoved) { L.rim.position.copy(this.rimBase); this.rimMoved = false; }
    // The sweep light: a soft, slow light that travels around the figure and reveals one region at a time.
    const az = this.time * .22 + a.mids * .5, side = eff === 'chroma' ? -1 : 1;
    this.sweep.position.set(position.x + Math.sin(az) * 3.2, position.y + 1.2 + (Math.sin(this.time * .31) * .5 + .5) * 2.2, position.z + Math.cos(az) * 3.2 * side);
    this.sweep.target.position.set(position.x, position.y + 1.1, position.z); this.sweep.color.fromArray(sweepColor); this.sweep.intensity = this.inspection ? 0 : dyn.sweep;
    // Hero material uniforms.
    const H = HERO_LENS;
    H.lensAlbedo.value = cur.albedo + dyn.albedo; H.lensAmbient.value = cur.ambient + dyn.ambient; H.lensCel.value = cur.cel; H.lensFlood.value = clamp(flood);
    H.lensRim.value = cur.rimStr * dyn.rim; H.lensRimPow.value = cur.rimPow; H.lensRimColor.value.fromArray(heroRim); H.lensSpec.value = cur.spec; H.lensIrid.value = cur.irid * dyn.irid;
    H.lensDesat.value = cur.heroDesat; H.lensTintH.value.fromArray(cur.heroTint); H.lensPhase.value = a.phase; H.lensStripe.value = a.stripe; H.lensHair.value = cur.hair * (.6 + a.accent * .8 + (power > .5 ? .5 : 0));
    if (camera) { const source = eff === 'volume' || eff === 'classic' ? L.rim.position : this.sweep.position; H.lensRimDir.value.copy(this.w.copy(source).sub(position).normalize().transformDirection(camera.matrixWorldInverse)); }
    const actor = this.getActor?.(); actor?.heroFinish?.setLensInk(cur.ink > .05 || this.inspection, this.inspection ? 1 : Math.max(.2, cur.ink));
    // Energy effects share one colour treatment.
    LENS_FX.gain.value = cur.fxGain * (1 + (eff === 'volume' ? a.bass * .08 : 0)); LENS_FX.sat.value = cur.fxSat; LENS_FX.tint.value.fromArray(cur.fxTint); LENS_FX.map.value = cur.fxMap; LENS_FX.comp.value = cur.fxComp; LENS_FX.beam.value = cur.fxBeam; LENS_FX.phase.value = a.phase;
    // Environment.
    const sc = this.scene, world = this.world;
    if (sc.fog && !this.inspection) {
      sc.fog.density = sc.fog.density * cur.fogScale + dyn.fog;
      if (cur.fogMix > .002) { this.fogBase ??= sc.fog.color.clone(); sc.fog.color.copy(this.fogBase).lerp(this.c.fromArray(cur.fogColor), cur.fogMix); if (sc.background?.isColor) sc.background.copy(sc.fog.color); }
      else if (this.fogBase) { sc.fog.color.copy(this.fogBase); if (sc.background?.isColor) sc.background.copy(this.fogBase); this.fogBase = null; }
    }
    const floor = world.floor?.material;
    if (floor && cur.floorMix > .002) {
      this.floorBase ??= { rough: floor.roughness, metal: floor.metalness, opacity: floor.opacity }; const k = cur.floorMix;
      floor.color.lerp(this.c.fromArray(cur.floorColor), k); floor.roughness = this.floorBase.rough + (cur.floorRough - this.floorBase.rough) * k;
      floor.metalness = this.floorBase.metal + (cur.floorMetal - this.floorBase.metal) * k; floor.opacity = this.floorBase.opacity + (cur.floorOpacity - this.floorBase.opacity) * k;
    } else if (floor && this.floorBase) { Object.assign(floor, { roughness: this.floorBase.rough, metalness: this.floorBase.metal, opacity: this.floorBase.opacity }); this.floorBase = null; }
    if (world.dust && cur.dust !== 1) world.dust.material.opacity *= cur.dust;
    this.contact.update(position, cur.contact * (1 - flood * .5));
    const pillars = this.getPillars?.(); if (pillars) pillars.uniforms.strength.value *= cur.pillars;
    // Post: exposure, bloom, grade, shafts, floor reflection and the transition dip.
    const P = this.pipeline;
    P.renderer.toneMappingExposure = cur.exposure + dyn.exposure;
    P.lensBloom = cur.bloom; P.lensSat = cur.sat; P.lensShadow = cur.shadow; P.lensBlack = cur.black; P.lensVig = cur.vignette; P.shafts = dyn.shafts;
    P.contrast = (P.contrast || 1) * cur.contrast; P.fade = f.value; P.rays = dyn.rays; P.shaftWorld.copy(L.rim.position); P.mirrorWorld.set(position.x, 0, position.z); P.mirror = cur.mirror;
  }
}
