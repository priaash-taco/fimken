import * as THREE from 'three';
// Anime smear. Part 1: forearm/shin (and upper arm/thigh) bones stretch along their axis while a hand or foot
// moves fast. Part 2: the same tracked velocities feed HeroFinish.smear so nearby vertices trail behind the tip.
export const SMEAR_TUNING = { stretchSpeed: 4, strikeSpeed: 5, fullSpeed: 8, lower: 1.22, upper: 1.08, decay: .09, filter: .03, smearSpeed: 3.5, smearFade: .06, teleport: 1 };
const LIMBS = [
  { tip: 'leftHand', lower: 'leftLowerArm', upper: 'leftUpperArm', trail: 0 },
  { tip: 'rightHand', lower: 'rightLowerArm', upper: 'rightUpperArm', trail: 1 },
  { tip: 'leftFoot', lower: 'leftLowerLeg', upper: 'leftUpperLeg', trail: 2 },
  { tip: 'rightFoot', lower: 'rightLowerLeg', upper: 'rightUpperLeg', trail: 2 },
];
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export class MotionSmear {
  constructor(actor) {
    this.actor = actor;
    this.enabled = !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.state = LIMBS.map(() => ({ prev: new THREE.Vector3(), has: false, vel: new THREE.Vector3(), stretch: 0, smear: 0, dir: new THREE.Vector3(), speed: 0 }));
    this.rootPrev = new THREE.Vector3(); this.rootHas = false;
    this.scaled = new Set(); this.pinned = new Set(); this.tmp = new THREE.Vector3(); this.inv = new THREE.Matrix4(); this.mesh = null;
  }
  get bones() { return this.actor.rigControls?.bones; }
  resetScales() {
    if (!this.scaled.size && !this.pinned.size) return false;
    for (const b of this.scaled) b.scale.set(1, 1, 1);
    for (const c of this.pinned) { c.matrixAutoUpdate = true; c.updateMatrix(); }
    this.scaled.clear(); this.pinned.clear(); return true;
  }
  // Stretch only along the axis pointing to the bone's child, so thickness is preserved.
  stretchBone(bone, k) {
    if (!bone || k <= 1) return;
    const child = bone.children.find(c => c.isBone || c.isObject3D);
    const axis = child && child.position.lengthSq() > 1e-8 ? child.position.clone().normalize() : new THREE.Vector3(0, 1, 0);
    bone.scale.set(1 + (k - 1) * axis.x * axis.x, 1 + (k - 1) * axis.y * axis.y, 1 + (k - 1) * axis.z * axis.z);
    this.scaled.add(bone);
    // Children would inherit the stretch and shear (mangled fingers, squashed boots). Give each child an exact
    // local matrix that cancels the parent's scale: world = (P * S) * (S^-1 * T * R * Sc) = P * T * R * Sc.
    this.inv.makeScale(1 / bone.scale.x, 1 / bone.scale.y, 1 / bone.scale.z);
    for (const c of bone.children) if (c.isBone) { c.matrixAutoUpdate = false; c.matrix.compose(c.position, c.quaternion, c.scale).premultiply(this.inv); this.pinned.add(c); }
  }
  update(dt, pose) {
    const bones = this.bones, root = this.actor.root;
    if (!bones || !root) return;
    const changed = this.resetScales();
    if (changed) root.updateMatrixWorld(true);
    const fx = this.actor.heroFinish?.smear;
    const valid = dt > 0 && dt < 1;
    const rp = root.getWorldPosition(this.tmp);
    const teleported = this.rootHas && rp.distanceTo(this.rootPrev) > SMEAR_TUNING.teleport;
    this.rootPrev.copy(rp); this.rootHas = true;
    const T = SMEAR_TUNING;
    let count = 0;
    if (!this.mesh && this.actor.model) this.actor.model.traverse(o => { if (!this.mesh && o.isSkinnedMesh) this.mesh = o; });
    if (this.mesh) this.inv.copy(this.mesh.matrixWorld).invert();
    const meshScale = this.mesh ? this.mesh.matrixWorld.getMaxScaleOnAxis() || 1 : 1;
    LIMBS.forEach((limb, i) => {
      const s = this.state[i], tip = bones[limb.tip];
      if (!tip) return;
      const pos = tip.getWorldPosition(new THREE.Vector3());
      if (!s.has || teleported) { s.prev.copy(pos); s.has = true; s.vel.set(0, 0, 0); s.stretch = 0; s.smear = 0; return; }
      if (!valid) { s.prev.copy(pos); return; }
      const raw = pos.clone().sub(s.prev).divideScalar(dt); s.prev.copy(pos);
      s.vel.lerp(raw, 1 - Math.exp(-dt / T.filter));
      const speed = s.vel.length();
      const trail = pose?.trails?.[limb.trail] || 0, hit = pose?.hitStop || 0;
      const gated = speed > T.strikeSpeed || ((trail > 0 || hit > 0) && speed > T.stretchSpeed);
      const target = this.enabled && gated ? smooth(T.stretchSpeed, T.fullSpeed, speed) : 0;
      s.stretch = Math.max(target, s.stretch - dt / T.decay);
      const st = this.enabled && speed > T.smearSpeed ? smooth(T.smearSpeed, T.smearSpeed + 2.5, speed) : 0;
      s.smear = Math.max(st, s.smear - dt / T.smearFade);
      if (st > 0) { s.dir.copy(s.vel).normalize(); s.speed = speed; }
      if (s.stretch > 0) {
        this.stretchBone(bones[limb.lower], 1 + (T.lower - 1) * s.stretch);
        this.stretchBone(bones[limb.upper], 1 + (T.upper - 1) * s.stretch);
      }
      if (fx && s.smear > .001 && count < fx.pos.value.length) {
        fx.pos.value[count].copy(pos).applyMatrix4(this.inv);
        fx.vel.value[count].copy(s.dir).transformDirection(this.inv).multiplyScalar(s.speed * s.smear / meshScale);
        count++;
      }
    });
    if (fx) fx.count.value = count;
    if (this.scaled.size) root.updateMatrixWorld(true);
  }
}
