import * as THREE from 'three';
import { shaderPalette } from './palette.js';
import { PlasmaBeam } from './plasma-beam.js';
import { PlasmaBall } from './plasma-ball.js';
import { EnergyArcs } from './energy-arcs.js';
// Effects for Goku's signature moves, driven by 'fx' cues in a move:
//   bombGrow / bombThrow   Spirit Bomb: a huge orb gathers above his raised hands while energy streams
//                          in from far away, then he hurls it and it bursts on the ground.
//   dragonRise             Dragon Fist: a golden, serpentine column of energy climbs from his fist,
//                          with a bright head at the tip.
//   kaiokenOn / kaiokenOff The aura turns crimson (the aura reads `hue` from the shared flame).
// Everything is built from the same noise-field plasma as the beam and orb, so none of it is geometry.
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const easeOut = x => 1 - (1 - clamp01(x)) ** 3;
const INFLOW = 160;
export class SignatureFX {
  constructor(scene, noise) {
    this.orb = new PlasmaBall(scene, noise); this.halo = new PlasmaBall(scene, noise); this.blast = new PlasmaBall(scene, noise);
    this.arcs = new EnergyArcs(scene, 9, { spread: 1 });
    this.dragon = new PlasmaBeam(scene, noise); this.head = new PlasmaBall(scene, noise, { tint: 1 });
    this.bomb = { state: 'none', start: 0, duration: 3.8, flight: 0, burst: 0, pos: new THREE.Vector3(), from: new THREE.Vector3(), target: new THREE.Vector3(), dir: new THREE.Vector3(), radius: .1 };
    this.fist = { age: 99, origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0), limb: 'rightHand' };
    this.kaio = 0; this.hue = 0; this.shake = 0; this.lastMove = null; this.lastCues = null;
    this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.c = new THREE.Vector3(); this.fwd = new THREE.Vector3();
    // Energy streaming in toward the orb: points on spirals that fall inward from far away.
    const seed = new Float32Array(INFLOW * 4), position = new Float32Array(INFLOW * 3);
    for (let i = 0; i < INFLOW; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); seed.set([Math.cos(a) * r, Math.abs(u) * .9 + .1, Math.sin(a) * r, Math.random()], i * 4); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(position, 3)); geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    this.inflowUniforms = { center: { value: new THREE.Vector3() }, orbRadius: { value: 1 }, time: { value: 0 }, strength: { value: 0 } };
    this.inflow = new THREE.Points(geometry, new THREE.ShaderMaterial({ uniforms: this.inflowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 seed;uniform vec3 center;uniform float orbRadius,time,strength;varying float vA;
        void main(){float t=fract(seed.w+time*.28);float reach=9.*(1.-t)*(1.-t)+orbRadius*.75;float swirl=t*5.+seed.w*6.;
         vec3 d=seed.xyz;vec3 side=normalize(cross(d,vec3(0.,1.,0.))+vec3(1e-4));
         vec3 p=center+d*reach+side*sin(swirl)*reach*.18;
         vA=sin(t*3.14159)*strength;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(120./max(.5,-mv.z)*(.4+t*.8),1.5,14.);}`,
      fragmentShader: shaderPalette + 'varying float vA;void main(){float r=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.1,r)*vA;gl_FragColor=vec4(mix(p_kamehamehaCyan,p_spiritGlowWhite,.5)*2.4,a);}' }));
    this.inflow.frustumCulled = false; this.inflow.visible = false; this.inflow.renderOrder = 6; scene.add(this.inflow);
  }
  reset() { this.bomb.state = 'none'; this.fist.age = 99; this.kaio = 0; this.hue = 0; this.shake = 0; this.lastMove = null; this.lastCues = null; }
  facing(actor) { this.fwd.set(0, 0, 1).applyQuaternion(actor.root.quaternion); this.fwd.y = 0; return this.fwd.lengthSq() < 1e-4 ? this.fwd.set(0, 0, 1) : this.fwd.normalize(); }
  cue(cue, actor, director, camera) {
    const bomb = this.bomb;
    switch (cue.action) {
      case 'bombGrow': Object.assign(bomb, { state: 'grow', start: director.time, duration: cue.duration ?? 3.8, flight: 0, burst: 0 }); break;
      case 'bombThrow': if (bomb.state === 'grow') {
        // Down and across the camera's view, away from it, so the landing is always on screen.
        const f = this.facing(actor).clone();
        if (camera) { const right = this.b.set(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize(); const away = this.a.copy(actor.root.position).sub(camera.position).setY(0).normalize(); f.copy(right).multiplyScalar(Math.sign(f.dot(right)) || 1).addScaledVector(away, .55).normalize(); }
        bomb.dir.copy(f); bomb.from.copy(bomb.pos); bomb.target.copy(actor.root.position).addScaledVector(f, cue.range ?? 6.5).setY(0); bomb.state = 'fly'; bomb.flight = 0; } break;
      case 'dragonRise': this.fist.age = 0; this.fist.limb = cue.limb || 'rightHand'; actor.anchor(this.fist.limb, this.fist.origin); this.shake = Math.max(this.shake, .02); break;
      case 'kaiokenOn': this.kaio = 1; this.shake = Math.max(this.shake, .018); break;
      case 'kaiokenOff': this.kaio = 0; break;
    }
  }
  update(dt, time, actor, director, camera, rocks, mood, vfx) {
    if (director.moveId !== this.lastMove) { this.lastMove = director.moveId; this.lastCues = null; if (this.bomb.state === 'grow' || this.bomb.state === 'fly') this.bomb.state = 'none'; this.fist.age = 99; this.kaio = 0; }
    if (director.cues && director.cues !== this.lastCues) { this.lastCues = director.cues; for (const c of director.cues) if (c.type === 'fx') this.cue(c, actor, director, camera); }
    this.hue = THREE.MathUtils.damp(this.hue, this.kaio, 5, Math.max(dt, 1 / 60)); if (vfx?.blaze) vfx.blaze.hue = this.hue;
    this.updateBomb(dt, time, actor, director, rocks, mood, camera); this.updateFist(dt, time, actor);
  }
  updateBomb(dt, time, actor, director, rocks, mood, camera) {
    const bomb = this.bomb; let orbStrength = 0, power = 0;
    if (bomb.state === 'grow') {
      const g = clamp01((director.time - bomb.start) / bomb.duration), e = smooth(g);
      bomb.radius = .1 + 1.15 * e; bomb.pos.copy(actor.root.position).setY(actor.root.position.y + 2.8 + .5 * e + bomb.radius * .55); power = e; orbStrength = .3 + .45 * e;
    } else if (bomb.state === 'fly') {
      bomb.flight += dt; const u = clamp01(bomb.flight / .85), k = u ** 1.6;
      bomb.pos.lerpVectors(bomb.from, bomb.target, k); bomb.pos.y = THREE.MathUtils.lerp(bomb.from.y, bomb.radius * .6, k); orbStrength = 1.2; power = 1;
      if (u >= 1) { bomb.state = 'burst'; bomb.burst = 0; this.shake = Math.max(this.shake, .04); mood.flash = Math.max(mood.flash, 1.5); rocks.shatter(bomb.target.clone(), bomb.dir.clone().setY(.35), 1, 'ground'); }
    } else if (bomb.state === 'burst') {
      bomb.burst += dt; if (bomb.burst > .95) bomb.state = 'none';
    }
    const showOrb = bomb.state === 'grow' || bomb.state === 'fly', r = bomb.radius;
    this.orb.update(time, bomb.pos, r, showOrb ? orbStrength : 0, .5);
    this.halo.update(time * .7 + 3, bomb.pos, r * 1.35, showOrb ? orbStrength * .12 : 0, .7);
    this.arcs.update(time, bomb.pos, showOrb ? Math.min(1, power * 1.2) * .5 : 0, camera || { position: bomb.pos }, r * 2.4 + .3);
    const fade = bomb.state === 'burst' ? Math.max(0, 1 - bomb.burst / .95) : 0;
    this.blast.update(time, bomb.target.clone().setY(1), 1.2 + bomb.burst * 9, fade ** 1.4 * 1.5, .5);
    this.inflow.visible = bomb.state === 'grow'; this.inflowUniforms.center.value.copy(bomb.pos); this.inflowUniforms.orbRadius.value = r; this.inflowUniforms.time.value = time; this.inflowUniforms.strength.value = power;
  }
  updateFist(dt, time, actor) {
    const f = this.fist; f.age += dt; const live = f.age < 1.7;
    if (live && f.age < .3) actor.anchor(f.limb, f.origin);
    f.dir.set(0, 1, 0).addScaledVector(this.facing(actor), .18).normalize();
    const len = 16 * easeOut(f.age / .55), strength = !live ? 0 : f.age < 1.2 ? 1 : Math.max(0, 1 - (f.age - 1.2) / .5);
    this.dragon.update(time, f.origin, f.dir, strength, { length: Math.max(.1, len), radius: .85 + .12 * Math.sin(time * 9), tint: 1, wave: 1.7 });
    this.head.update(time, this.c.copy(f.origin).addScaledVector(f.dir, len), 1.05, strength * 1.1, .5);
  }
}
