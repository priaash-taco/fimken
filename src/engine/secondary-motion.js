import * as THREE from 'three';
// Bone-less secondary motion. The asset has no cloth or flesh bones, so named regions of the one skinned mesh
// (sash, gi hem, trouser cuffs, wristbands, chest, thighs, upper arms) are offset in the vertex shader by a
// damped 3D spring per region, driven by the world motion of an anchor bone. Region membership is two vertex
// attributes (regionId, regionWeight); the weight falls off softly so a region's root stays on the body.
export const MAX_REGIONS = 12;
// Dynamic indexing of a uniform array in a vertex shader is very slow on Intel iGPUs; select with constant indices instead.
const SELECT = ' if (regionWeight > 0.) { vec3 ro = vec3(0.);\n' + Array.from({ length: MAX_REGIONS }, (_, i) => `  ro += regionOffset[${i}] * step(abs(regionId - ${i}.), .5);`).join('\n') + '\n transformed += ro * regionWeight; }';
const smooth =(a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// The only model-specific part. Coordinates are the mesh's local rest space (y up, +z front, +x is the L side).
// test(localPos, dominantBoneName, weightToListedBones) -> 0..1. A vertex joins the rule with the highest weight.
// Drive: w/z spring stiffness and damping ratio, max metres, kv/ka velocity and acceleration trailing gain,
// sag gravity droop in metres, wind gain for the wind vector, anchor role in rigControls.bones.
export const HERO_REGIONS = [
  { name: 'sash', bones: ['hips', 'spine', 'thighL', 'thighR'], anchor: 'hips', w: 13, z: .3, max: .04, kv: .009, ka: .0007, sag: .008, wind: .6,
    test: (p, b, wl) => wl < .6 ? 0 : smooth(1.37, 1.3, p.y) * smooth(1.14, 1.26, p.y) },
  { name: 'giHem', bones: ['spine', 'chest'], anchor: 'spine', w: 11, z: .3, max: .06, kv: .011, ka: .0009, sag: .014, wind: 1,
    test: (p, b, wl) => wl < .6 ? 0 : smooth(1.34, 1.4, p.y) * smooth(1.52, 1.42, p.y) * smooth(.03, .15, p.z) },
  ...['L', 'R'].map(s => ({ name: 'trouser' + s, bones: ['shin' + s], anchor: s === 'L' ? 'leftFoot' : 'rightFoot', w: 12, z: .32, max: .05, kv: .011, ka: .0009, sag: .01, wind: 1,
    test: (p, b, wl) => wl < .6 ? 0 : smooth(.36, .43, p.y) * smooth(.68, .5, p.y) })),
  ...['L', 'R'].map(s => ({ name: 'wrist' + s, bones: ['forearm' + s], anchor: s === 'L' ? 'leftHand' : 'rightHand', w: 24, z: .4, max: .015, kv: .0015, ka: .00025, sag: 0, wind: 0,
    test: (p, b, wl) => wl < .6 ? 0 : smooth(1.28, 1.14, p.y) })),
  { name: 'chest', bones: ['chest'], anchor: 'neck', w: 24, z: .55, max: .012, kv: 0, ka: .00045, sag: 0, wind: 0,
    test: (p, b, wl) => wl < .6 ? 0 : smooth(.1, .2, p.z) * smooth(1.34, 1.42, p.y) * smooth(1.63, 1.54, p.y) },
  ...['L', 'R'].map(s => ({ name: 'thigh' + s, bones: ['thigh' + s], anchor: s === 'L' ? 'leftLowerLeg' : 'rightLowerLeg', w: 22, z: .55, max: .012, kv: 0, ka: .0004, sag: 0, wind: 0,
    test: (p, b, wl) => wl < .6 ? 0 : smooth(.62, .8, p.y) * smooth(1.25, 1.12, p.y) })),
  ...['L', 'R'].map(s => ({ name: 'upperarm' + s, bones: ['upperarm' + s], anchor: s === 'L' ? 'leftLowerArm' : 'rightLowerArm', w: 22, z: .55, max: .01, kv: 0, ka: .0004, sag: 0, wind: 0,
    test: (p, b, wl) => wl < .6 ? 0 : smooth(1.3, 1.42, p.y) * smooth(1.72, 1.6, p.y) * .8 })),
];

// Writes per-vertex regionId and regionWeight on the mesh geometry (once) and returns { ids, weights }.
export function buildRegions(skinnedMesh, boneNames, rules) {
  const geometry = skinnedMesh.geometry;
  if (geometry.attributes.regionId) return { ids: geometry.attributes.regionId.array, weights: geometry.attributes.regionWeight.array };
  const pos = geometry.attributes.position, si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight;
  const ids = new Float32Array(pos.count), weights = new Float32Array(pos.count), p = new THREE.Vector3();
  const sets = rules.map(r => new Set(r.bones));
  for (let i = 0; i < pos.count; i++) {
    let dominant = '', best = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > best) { best = w; dominant = boneNames[si.getComponent(i, k)]; } }
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    let bestW = 0, bestId = 0;
    for (let r = 0; r < rules.length; r++) {
      if (!sets[r].has(dominant)) continue;
      let listed = 0; for (let k = 0; k < 4; k++) if (sets[r].has(boneNames[si.getComponent(i, k)])) listed += sw.getComponent(i, k);
      const w = Math.max(0, Math.min(1, rules[r].test(p, dominant, listed)));
      if (w > bestW) { bestW = w; bestId = r; }
    }
    ids[i] = bestId; weights[i] = bestW;
  }
  geometry.setAttribute('regionId', new THREE.BufferAttribute(ids, 1));
  geometry.setAttribute('regionWeight', new THREE.BufferAttribute(weights, 1));
  return { ids, weights };
}

// One damped spring step, substepped. Mutates state { x, v } toward target.
export function stepSpring(state, target, w, z, dt) {
  const steps = Math.max(1, Math.ceil(dt * 240)), h = Math.min(dt, .1) / steps, a = new THREE.Vector3();
  for (let i = 0; i < steps; i++) { a.copy(target).sub(state.x).multiplyScalar(w * w).addScaledVector(state.v, -2 * z * w); state.v.addScaledVector(a, h); state.x.addScaledVector(state.v, h); }
}

export class SecondaryMotion {
  constructor(model, rules = HERO_REGIONS) {
    this.model = model; this.rules = rules; this.enabled = true;
    this.offsets = Array.from({ length: MAX_REGIONS }, () => new THREE.Vector3());
    this.uniform = { value: this.offsets };
    this.states = rules.map(() => ({ x: new THREE.Vector3(), v: new THREE.Vector3() }));
    this.prevPos = rules.map(() => new THREE.Vector3()); this.prevVel = rules.map(() => new THREE.Vector3());
    this.started = false;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? .3 : 1;
    
    model.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { const n = o.skeleton.bones.map(b => b.name); buildRegions(o, n, rules); } });
    this.tmp = new THREE.Vector3(); this.world = new THREE.Vector3(); this.accelV = new THREE.Vector3();
  }
  // Adds the region offset to a vertex shader source (after skinning). Needs attributes regionId/regionWeight.
  inject(vertexShader) {
    return 'uniform vec3 regionOffset[' + MAX_REGIONS + '];\nattribute float regionId;\nattribute float regionWeight;\n'
      + vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n' + SELECT);
  }
  patch(shader) { shader.uniforms.regionOffset = this.uniform; shader.vertexShader = this.inject(shader.vertexShader); }
  // bones: role -> Object3D map. wind: optional {x,y,z} (y is an updraft, e.g. the aura). dt 0 leaves everything unchanged.
  update(dt, bones, root, wind) {
    if (!(dt > 0) || !bones) return;
    const q = this.model.getWorldQuaternion(new THREE.Quaternion()).invert(), scale = this.model.getWorldScale(this.tmp).x || 1, k = this.reduced;
    for (let i = 0; i < this.rules.length; i++) {
      const r = this.rules[i], bone = bones[r.anchor], s = this.states[i];
      if (!bone) continue;
      bone.getWorldPosition(this.world);
      if (!this.started) { this.prevPos[i].copy(this.world); this.prevVel[i].set(0, 0, 0); }
      const vel = this.tmp.copy(this.world).sub(this.prevPos[i]).divideScalar(dt).clampLength(0, 7);
      const accel = this.accelV.copy(vel).sub(this.prevVel[i]).divideScalar(dt).clampLength(0, 80);
      this.prevPos[i].copy(this.world); this.prevVel[i].copy(vel);
      const target = vel.multiplyScalar(-r.kv).addScaledVector(accel, -r.ka);
      target.y -= r.sag; if (wind && r.wind) { target.x += (wind.x || 0) * .01 * r.wind; target.z += (wind.z || 0) * .01 * r.wind; target.y += (wind.y || 0) * .01 * r.wind; }
      target.multiplyScalar(k).clampLength(0, r.max * k);
      stepSpring(s, target, r.w, r.z, dt);
      s.x.clampLength(0, r.max * k * 1.15);
      this.offsets[i].copy(s.x).applyQuaternion(q).divideScalar(scale);
    }
    this.started = true;
  }
}
