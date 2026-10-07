import * as THREE from 'three';
import { PALETTE, shaderPalette } from './palette.js';
import { rockGeometry } from './rock-geometry.js';
import { celBands } from './environment-director.js';
// A boulder the hero can break. It is a prop driven by 'rock' cues in a move:
//   spawn  the boulder pushes up out of the ground in front of him
//   grab   he lifts it; it follows his hands
//   throw  it leaves his hands as a tumbling projectile and shatters where it lands
//   smash  it bursts where it stands (a punch or kick landed)
//   ground no boulder: a slam into the floor throws rubble up from under his fists
// Shattering throws faceted chunks that tumble, bounce and settle, plus soft dust that rolls out
// and fades. The point of the last shatter is reported so the scene can mark the ground there.
const CHUNKS = 64, PUFFS = 12, GRAVITY = -9.8, STEP = 1 / 60;
const rand = (() => { let s = 7; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export class RockSmash {
  constructor(scene, noise) {
    this.state = 'none'; this.age = 0; this.radius = .5; this.grab = 0; this.shattered = null; this.lastCues = null; this.lastMove = null;
    this.pos = new THREE.Vector3(); this.ground = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.spin = new THREE.Vector3(); this.quat = new THREE.Quaternion();
    this.fwd = new THREE.Vector3(); this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.tmp = new THREE.Vector3(); this.axis = new THREE.Vector3(); this.dq = new THREE.Quaternion(); this.m = new THREE.Matrix4(); this.s = new THREE.Vector3();
    const base = new THREE.Color(PALETTE.rockBrown).lerp(new THREE.Color(PALETTE.softBlack), .2).multiplyScalar(1.2);
    const bodyMaterial = new THREE.MeshStandardMaterial({ roughness: .95, flatShading: true, vertexColors: true, color: base }); celBands(bodyMaterial);
    this.shapes = [3, 11, 23].map((seed, i) => rockGeometry({ detail: 4, taper: .08 + i * .08, seed, roughness: .4 + i * .04 }));
    this.boulder = new THREE.Mesh(this.shapes[0], bodyMaterial); this.boulder.visible = false; this.boulder.castShadow = true; this.boulder.frustumCulled = false; scene.add(this.boulder);
    const chunkMaterial = new THREE.MeshStandardMaterial({ roughness: .95, flatShading: true, vertexColors: true }); celBands(chunkMaterial);
    this.chunks = new THREE.InstancedMesh(rockGeometry({ detail: 1, roughness: .5, seed: 2 }), chunkMaterial, CHUNKS);
    this.chunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.chunks.frustumCulled = false; this.chunks.castShadow = true; scene.add(this.chunks);
    this.bits = Array.from({ length: CHUNKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), axis: new THREE.Vector3(0, 1, 0), spin: 0, size: 0, life: 99, max: 4 }));
    const tint = new THREE.Color();
    for (let i = 0; i < CHUNKS; i++) { this.chunks.setColorAt(i, tint.set(PALETTE.rockBrown).lerp(new THREE.Color(PALETTE.debrisBrown), rand()).lerp(new THREE.Color(PALETTE.softBlack), .15 + rand() * .2).multiplyScalar(1.9 + rand() * .5)); this.bits[i].size = 0; }
    this.paint();
    // Dust: soft noise-dissolved puffs, normally blended so they read as smoke and earth, not light.
    this.puffs = Array.from({ length: PUFFS }, (_, i) => {
      const uniforms = { noiseTex: { value: noise }, age: { value: 1 }, seed: { value: i * .37 } };
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false,
        vertexShader: 'uniform float age;varying vec2 vP;void main(){vP=position.xy;vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);float size=.5+age*1.5;gl_Position=projectionMatrix*(c+vec4(position.xy*size,0.,0.));}',
        fragmentShader: shaderPalette + `uniform sampler2D noiseTex;uniform float age,seed;varying vec2 vP;
          void main(){float r=length(vP);float n=texture2D(noiseTex,vP*.7+seed+age*.15).r;float n2=texture2D(noiseTex,vP*1.7-seed).g;
           float d=r+(n-.5)*.75+(n2-.5)*.25;float a=smoothstep(1.,.3,d)*smoothstep(1.,.55,r)*pow(1.-age,1.6)*.5;
           vec3 col=mix(p_debrisBrown*1.25,p_auraGlowCream*.55,.3+.3*n);gl_FragColor=vec4(col,a);}` }));
      mesh.visible = false; mesh.renderOrder = 5; mesh.frustumCulled = false; scene.add(mesh);
      return { mesh, uniforms, v: new THREE.Vector3(), age: 1, life: 1 };
    });
  }
  paint() { this.chunks.instanceColor.needsUpdate = true; for (let i = 0; i < CHUNKS; i++) { this.m.makeScale(0, 0, 0); this.chunks.setMatrixAt(i, this.m); } this.chunks.instanceMatrix.needsUpdate = true; }
  reset() { this.state = 'none'; this.boulder.visible = false; this.shattered = null; this.lastCues = null; this.lastMove = null; for (const b of this.bits) { b.life = 99; b.size = 0; } for (const p of this.puffs) { p.age = 1; p.mesh.visible = false; } this.paint(); }
  // Where the hero faces on the floor.
  facing(actor) { this.fwd.set(0, 0, 1).applyQuaternion(actor.root.quaternion); this.fwd.y = 0; return this.fwd.lengthSq() < 1e-4 ? this.fwd.set(0, 0, 1) : this.fwd.normalize(); }
  spawn(actor, distance, size) {
    const f = this.facing(actor); this.ground.copy(actor.root.position); this.ground.y = 0; this.ground.addScaledVector(f, distance);
    this.radius = size; this.state = 'ground'; this.age = 0; this.grab = 0; this.quat.setFromEuler(new THREE.Euler(rand() * .3, rand() * 6.28, rand() * .3));
    this.boulder.geometry = this.shapes[Math.floor(rand() * 3)]; this.boulder.visible = true; this.puff(this.ground, 3, .5, .6);
  }
  puff(point, count, spread, rise) {
    let made = 0;
    for (const p of this.puffs) { if (made >= count) break; if (p.age < 1) continue;
      const a = rand() * 6.283; p.mesh.position.copy(point).add(this.tmp.set(Math.cos(a) * spread * .5, .1, Math.sin(a) * spread * .5)); p.v.set(Math.cos(a) * spread, rise * (.6 + rand() * .6), Math.sin(a) * spread);
      p.age = 0; p.life = .9 + rand() * .7; p.uniforms.seed.value = rand() * 5; p.mesh.visible = true; made++; }
  }
  shatter(point, dir, strength, kind) {
    const boulder = kind === 'boulder', n = boulder ? 42 : 30, scale = boulder ? this.radius / .5 : .65;
    for (let i = 0, spawned = 0; i < CHUNKS && spawned < n; i++) { const b = this.bits[i]; if (b.life < b.max) continue; spawned++;
      this.a.set(rand() - .5, rand() * .8 + .1, rand() - .5).normalize();
      b.p.copy(point).addScaledVector(this.a, boulder ? this.radius * .55 * rand() : .25); if (!boulder) { b.p.y = .08; }
      b.size = (boulder ? .07 + rand() * rand() * .2 : .05 + rand() * .13) * scale;
      if (boulder) b.v.copy(this.a).multiplyScalar((1.5 + rand() * 4) * (.5 + strength * .6)).addScaledVector(dir, (2.5 + rand() * 7) * strength);
      else { this.b.set(this.a.x, 0, this.a.z).normalize(); b.v.copy(this.b).multiplyScalar(2.5 + rand() * 5).setY(3 + rand() * 6.5); }
      b.v.y += 1.5 + rand() * 3; b.axis.set(rand() - .5, rand() - .5, rand() - .5).normalize(); b.spin = (3 + rand() * 12) * (rand() < .5 ? -1 : 1); b.q.setFromAxisAngle(b.axis, rand() * 6.28); b.life = 0; b.max = 3.2 + rand() * 2.2; }
    this.puff(point, boulder ? 8 : 7, boulder ? 2.2 : 3.2, 1.1); this.shattered = { point: point.clone().setY(0), strength: Math.min(1, .55 + strength * .45) };
    if (boulder) { this.boulder.visible = false; this.state = 'none'; }
  }
  cue(cue, actor) {
    switch (cue.action) {
      case 'spawn': this.spawn(actor, cue.distance ?? 1, cue.size ?? .5); break;
      case 'grab': if (this.state === 'ground') { this.state = 'held'; this.grab = 0; } break;
      case 'throw': if (this.state === 'held') { const f = this.facing(actor).clone(); this.state = 'flying';
        // Arc across the camera's view, toward whichever side is nearer his facing, so the landing is always on screen.
        if (this.camera) { const right = this.b.set(1, 0, 0).applyQuaternion(this.camera.quaternion); right.y = 0; right.normalize(); const away = this.a.copy(actor.root.position).sub(this.camera.position).setY(0).normalize(); f.copy(right).multiplyScalar(Math.sign(f.dot(right)) || 1).addScaledVector(away, .55).normalize(); }
        this.vel.copy(f).multiplyScalar(cue.speed ?? 9).setY(cue.lift ?? 3.4); this.spin.set(rand() * 5, rand() * 3, rand() * 7); } break;
      case 'smash': if (this.state !== 'none') this.shatter(this.pos.clone().setY(Math.max(.3, this.pos.y)), this.facing(actor).clone().setY(.25), cue.strength ?? 1, 'boulder'); break;
      case 'ground': this.shatter(this.tmp.copy(actor.root.position).addScaledVector(this.facing(actor), cue.reach ?? .55).setY(0).clone(), this.fwd, cue.strength ?? 1, 'ground'); break;
    }
  }
  update(dt, actor, director, camera) {
    this.camera = camera;
    if (director.moveId !== this.lastMove) { if (this.state !== 'none') { this.state = 'none'; this.boulder.visible = false; } this.lastMove = director.moveId; this.lastCues = null; }
    if (director.cues && director.cues !== this.lastCues) { this.lastCues = director.cues; for (const c of director.cues) if (c.type === 'rock') this.cue(c, actor); }
    if (dt <= 0) return;
    for (let left = Math.min(dt, .2); left > 1e-5; left -= STEP) this.step(Math.min(STEP, left), actor);
    this.draw(actor);
  }
  step(dt, actor) {
    this.age += dt;
    if (this.state === 'ground') this.pos.copy(this.ground).setY(this.radius * .62);
    if (this.state === 'held') {
      this.grab = Math.min(1, this.grab + dt / .5);
      this.a.copy(actor.anchor('leftHand')).add(actor.anchor('rightHand', this.b)).multiplyScalar(.5).y += this.radius * 1.35;
      this.tmp.copy(this.ground).setY(this.radius * .62); this.pos.copy(this.tmp).lerp(this.a, smooth(0, 1, this.grab));
    } else if (this.state === 'flying') {
      this.vel.y += GRAVITY * dt; this.pos.addScaledVector(this.vel, dt);
      this.axis.copy(this.spin); const w = this.axis.length(); if (w > 1e-4) { this.dq.setFromAxisAngle(this.axis.divideScalar(w), w * dt); this.quat.premultiply(this.dq); }
      if (this.pos.y < this.radius * .65) { const dir = this.vel.clone().normalize().setY(.2); this.shatter(this.pos.clone(), dir, .8, 'boulder'); }
    }
    for (const b of this.bits) { if (b.life >= b.max) continue; b.life += dt; b.v.y += GRAVITY * dt; b.p.addScaledVector(b.v, dt);
      if (b.p.y < b.size * .5) { b.p.y = b.size * .5; if (Math.abs(b.v.y) > .9) b.v.y *= -.34; else b.v.y = 0; b.v.x *= .62; b.v.z *= .62; b.spin *= .55; }
      this.dq.setFromAxisAngle(b.axis, b.spin * dt); b.q.premultiply(this.dq); }
    for (const p of this.puffs) { if (p.age >= 1) continue; p.age += dt / p.life; p.mesh.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-dt * 2.2)); if (p.age >= 1) p.mesh.visible = false; p.uniforms.age.value = Math.min(1, p.age); }
  }
  draw() {
    if (this.boulder.visible) {
      const emerge = this.state === 'ground' ? smooth(0, .35, this.age) : 1, r = this.radius * (.55 + .45 * emerge);
      this.boulder.position.copy(this.pos); if (this.state === 'ground') this.boulder.position.y -= (1 - emerge) * this.radius * .8;
      this.boulder.quaternion.copy(this.quat); this.boulder.scale.set(r, r * .82, r);
    }
    for (let i = 0; i < CHUNKS; i++) { const b = this.bits[i], fade = 1 - smooth(b.max - .9, b.max, b.life), s = b.life >= b.max ? 0 : b.size * fade;
      this.m.compose(b.p, b.q, this.s.set(s, s * .8, s)); this.chunks.setMatrixAt(i, this.m); }
    this.chunks.instanceMatrix.needsUpdate = true;
  }
}
