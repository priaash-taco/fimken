import * as THREE from 'three';
// The face performs with the body. Semantic expressions are turned into ARKit-named blendshape weights
// and written to whatever morph targets the model has (missing ones are ignored), so the same layer
// drives this hero's procedural keys today and a fully rigged face later.
//   blink        every 2-6 s, 120 ms down and up, one in five a double; held open during a hit-stop and at a power peak
//   focus        brows down and eyes narrowed with the move's focus, tension and power
//   shout        jaw open with the pose's shout, a bass hit or the beam release
//   accent       a quick brow raise and widened eyes on a beat or a drop (surprise), decaying fast
//   calm         a small smile when the music is quiet and the body relaxed
//   gaze         when the model has eye.L / eye.R bones (real eyeballs), the eyes dart in small saccades, lead a turn,
//                look toward the striking hand and hold dead centre during a power peak
// A little left/right asymmetry and smoothing keep it from reading as a switch.
const clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp;
export class FacePerformance {
  constructor(model, seed = 5) {
    this.model = model; this.targets = []; this.seed = seed >>> 0;
    model?.traverse(o => { if (o.morphTargetDictionary) this.targets.push(o); });
    this.eyes = []; model?.traverse(o => { if (o.isBone && /^eye.(L|R)$/.test(o.name)) this.eyes.push({ bone: o, rest: o.quaternion.clone() }); });
    this.gaze = { yaw: 0, pitch: 0, tx: 0, ty: 0, next: .8 }; this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
    this.weights = {}; this.blinkAt = 1.5 + this.random() * 2; this.blinkPhase = -1; this.doubleBlink = false; this.accent = 0; this.lastBeatCount = -1; this.state = { focus: 0, shout: 0, calm: 0 };
  }
  random() { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 4294967296; }
  get available() { const names = new Set(); for (const o of this.targets) for (const k of Object.keys(o.morphTargetDictionary)) names.add(k); return names; }
  blinkNow() { this.blinkPhase = 0; }
  get hasEyes() { return this.eyes.length > 0; }
  // Eyeballs: saccades every 0.8-2.5 s, steadier and centred as focus rises, leading a turn by the body's yaw velocity.
  updateGaze(dt, pose, hold, power) {
    if (!this.eyes.length) return;
    const g = this.gaze, calm = 1 - this.state.focus * .8;
    g.next -= dt; if (g.next <= 0 && !hold) { g.next = .8 + this.random() * 1.7; g.tx = (this.random() - .5) * .5 * calm; g.ty = (this.random() - .5) * .22 * calm; }
    const lead = clamp((pose.poseVelYaw || 0) * .18, -.3, .3), strike = (pose.trails?.[0] || 0) > .5 && pose.left ? Math.atan2(pose.left[0], Math.max(.2, pose.left[2])) * .5 : (pose.trails?.[1] || 0) > .5 && pose.right ? Math.atan2(pose.right[0], Math.max(.2, pose.right[2])) * .5 : 0;
    const targetYaw = clamp(g.tx + lead + strike, -.45, .45) * (power > .85 ? .2 : 1), targetPitch = clamp(g.ty, -.2, .2) * (power > .85 ? .2 : 1);
    // Saccades are quick (eyes jump in about 50 ms), so the follow rate is high.
    g.yaw = damp(g.yaw, targetYaw, 28, dt); g.pitch = damp(g.pitch, targetPitch, 28, dt);
    this.e.set(g.pitch, 0, -g.yaw); this.q.setFromEuler(this.e);
    for (const { bone, rest } of this.eyes) bone.quaternion.copy(rest).multiply(this.q);
  }
  update(dt, pose, music, time) {
    if (!(dt > 0) || !pose) return;
    const hold = (pose.hitStop || 0) > .5, power = pose.power || 0, s = this.state;
    s.focus = damp(s.focus, clamp((pose.focus || 0) * .9 + (pose.tension || 0) * .4 + Math.max(0, power - .5) * .8, 0, 1), 6, dt);
    const bass = music?.bassHit ? 1 : 0, release = (pose.beam || 0) > .5 && (pose.power || 0) > .8 ? .6 : 0;
    s.shout = damp(s.shout, clamp((pose.shout || 0) + bass * .5 + release, 0, 1), bass ? 30 : 7, dt);
    const quiet = music ? (music.rolling || 0) < .12 : true, relaxed = (pose.fist || 0) < .3 && power < .4 && !hold;
    s.calm = damp(s.calm, quiet && relaxed ? 1 : 0, 1.5, dt);
    // Accents: a beat lifts the brows a touch, a drop or a strong beat widens the eyes for a moment.
    if (music?.beat && music.beatCount !== this.lastBeatCount) { this.lastBeatCount = music.beatCount; this.accent = Math.max(this.accent, .35 + (music.beatStrength || 0) * .5); }
    if (music?.drop) this.accent = 1;
    this.accent *= Math.exp(-dt * 6);
    // Blink timing.
    if (this.blinkPhase < 0) { this.blinkAt -= dt; if (this.blinkAt <= 0 && !hold && power < .85) { this.blinkPhase = 0; this.doubleBlink = this.random() < .2; } }
    let blink = 0;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt; const d = .13, t = this.blinkPhase;
      blink = t < d ? Math.sin(t / d * Math.PI) : this.doubleBlink && t < d * 2.2 ? Math.max(0, Math.sin((t - d * 1.2) / d * Math.PI)) : 0;
      if (t > (this.doubleBlink ? d * 2.2 : d)) { this.blinkPhase = -1; this.blinkAt = 2 + this.random() * 4; }
    }
    this.updateGaze(dt, pose, hold, power);
    const wob = Math.sin(time * .7) * .5 + .5, asym = .85 + .3 * wob;
    const w = this.weights;
    w.eyeBlinkLeft = blink; w.eyeBlinkRight = blink;
    w.eyeSquintLeft = s.focus * .7 * asym; w.eyeSquintRight = s.focus * .7 * (1.7 - asym);
    w.browDownLeft = s.focus * .8 * asym; w.browDownRight = s.focus * .8 * (1.7 - asym);
    w.browInnerUp = clamp(this.accent * .6 + s.calm * .15 - s.focus * .3, 0, 1); w.browOuterUpLeft = this.accent * .4; w.browOuterUpRight = this.accent * .4 * (1.7 - asym);
    w.eyeWideLeft = clamp(this.accent * .5 - s.focus * .3, 0, 1); w.eyeWideRight = w.eyeWideLeft;
    w.jawOpen = clamp(s.shout, 0, 1); w.mouthPucker = clamp(s.focus * .25 - s.shout, 0, 1) * .5;
    w.mouthSmileLeft = s.calm * .35 * asym; w.mouthSmileRight = s.calm * .35 * (1.7 - asym); w.mouthFrownLeft = s.focus * .25; w.mouthFrownRight = s.focus * .25;
    w.cheekPuffLeft = 0; w.cheekPuffRight = 0;
    // Compatibility with the two original keys (used when the standard set is missing, blended down when present).
    w.focus = s.focus; w.shout = s.shout;
    for (const o of this.targets) {
      const dict = o.morphTargetDictionary, standard = 'eyeBlinkLeft' in dict;
      for (const [name, value] of Object.entries(w)) { const i = dict[name]; if (i == null) continue; o.morphTargetInfluences[i] = standard && (name === 'focus' || name === 'shout') ? value * .35 : clamp(value, 0, 1); }
    }
  }
}
