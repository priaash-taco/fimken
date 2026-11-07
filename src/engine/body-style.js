import * as THREE from 'three';
// Whole-body performance on top of the authored/captured pose, before the rig solves it:
//   balance        the centre of mass is kept over the support (the planted foot or the point between both
//                  feet) by shifting the hips, so leans and reaches look carried rather than hung in space;
//   hips lead      a turn starts in the hips, the torso follows, the head gets there first;
//   gaze           the head looks where the body is about to go: ahead of a turn, into travel, at the striking hand;
//   exaggeration   one dial (0..1) that pushes the pose away from neutral the way anime does: deeper twist and
//                  lean, lower crouch at extremes, reaches that go further, held poses that stay a touch longer.
// Every term is smoothed so nothing here can pop. Pose values are the rig's own channels (root space, metres).
const clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const FEET = { left: [.27, .148, -.004], right: [-.27, .148, -.004] };
export const STYLE = {
  balanceGain: .55, balanceMax: .07, leanToCom: .22, handToCom: .05, footToCom: .09,
  hipLead: .12, hipLeadMax: .22, torsoFollow: .35, headLead: .30, headLeadMax: .40, gazeTravel: .45, gazeStrike: .35, gazeMax: .55,
  exTwist: .55, exLean: .45, exBank: .5, exCrouch: .35, exReach: .14, exStrike: .18, exHold: .5,
};
export class BodyStyle {
  constructor() { this.exaggeration = .35; this.enabled = true; this.shift = { x: 0, z: 0 }; this.lead = 0; this.gaze = 0; this.yawVel = 0; this.travelDir = 0; this.travelSpeed = 0; }
  // pose: the live pose (mutated in place and returned). vel: the director's pose velocity (same channel names).
  apply(pose, vel, dt) {
    if (!pose || !(dt > 0) || !this.enabled) return pose;
    const e = clamp(this.exaggeration, 0, 1), v = vel || {};
    // --- Exaggeration: push torso channels away from zero and reaches away from the chest.
    if (e > 0) {
      pose.twist *= 1 + STYLE.exTwist * e; pose.lean *= 1 + STYLE.exLean * e; pose.bank = (pose.bank || 0) * (1 + STYLE.exBank * e);
      if (pose.crouch > .1) pose.crouch += (pose.crouch - .1) * STYLE.exCrouch * e;
      const striking = Math.max(pose.trails?.[0] || 0, pose.trails?.[1] || 0);
      for (const side of ['left', 'right']) {
        const h = pose[side]; if (!h) continue;
        const dx = h[0], dz = h[2], reach = Math.hypot(dx, dz); if (reach < .05) continue;
        const k = (STYLE.exReach + STYLE.exStrike * striking) * e * Math.min(1, reach / .45);
        pose[side] = [dx * (1 + k), h[1] + (h[1] - 1.1) * .25 * e * Math.min(1, reach / .45), dz * (1 + k)];
      }
    }
    // --- Balance: estimate the centre of mass in root space and keep it over the support.
    const lift = pose.lift || 0, lf = pose.leftFoot || [0, 0, 0], rf = pose.rightFoot || [0, 0, 0];
    const plantedL = lift < .03 && lf[1] < .05, plantedR = lift < .03 && rf[1] < .05;
    if (plantedL || plantedR) {
      const L = [FEET.left[0] + lf[0], FEET.left[2] + lf[2]], R = [FEET.right[0] + rf[0], FEET.right[2] + rf[2]];
      const support = plantedL && plantedR ? [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2] : plantedL ? L : R;
      // Mass proxy: hips at the origin, torso lean moves mass forward, bank sideways, reaching hands and a lifted foot pull it along.
      let cx = -(pose.bank || 0) * STYLE.leanToCom * .5, cz = (pose.lean || 0) * STYLE.leanToCom;
      for (const side of ['left', 'right']) { const h = pose[side]; if (h) { cx += h[0] * STYLE.handToCom; cz += h[2] * STYLE.handToCom; } }
      if (!plantedL) { cx += (FEET.left[0] + lf[0]) * STYLE.footToCom; cz += lf[2] * STYLE.footToCom; }
      if (!plantedR) { cx += (FEET.right[0] + rf[0]) * STYLE.footToCom; cz += rf[2] * STYLE.footToCom; }
      // The hips shift toward the support by a fraction of the error; a one-footed stance shifts more.
      const gain = STYLE.balanceGain * (plantedL && plantedR ? .6 : 1);
      const tx = clamp((support[0] - cx) * gain, -STYLE.balanceMax, STYLE.balanceMax), tz = clamp((support[1] - cz) * gain, -STYLE.balanceMax, STYLE.balanceMax);
      this.shift.x = damp(this.shift.x, tx, 6, dt); this.shift.z = damp(this.shift.z, tz, 6, dt);
    } else { this.shift.x = damp(this.shift.x, 0, 4, dt); this.shift.z = damp(this.shift.z, 0, 4, dt); }
    pose.hipShift = [(pose.hipShift?.[0] || 0) + this.shift.x, (pose.hipShift?.[1] || 0) + this.shift.z];
    // --- Hips lead the turn, the torso trails it a little, the head arrives first.
    this.yawVel = damp(this.yawVel, v.yaw || 0, 10, dt);
    this.lead = damp(this.lead, clamp(this.yawVel * STYLE.hipLead, -STYLE.hipLeadMax, STYLE.hipLeadMax), 8, dt);
    pose.hipYaw = (pose.hipYaw || 0) + this.lead; pose.twist -= this.lead * STYLE.torsoFollow;
    // --- Gaze: ahead of the turn, into the direction of travel, toward the striking hand.
    const tv = v.travel || [0, 0], c = Math.cos(-(pose.yaw || 0)), s = Math.sin(-(pose.yaw || 0));
    const vx = tv[0] * c - tv[1] * s, vz = tv[0] * s + tv[1] * c, speed = Math.hypot(vx, vz);  // travel velocity in the body's frame
    this.travelSpeed = damp(this.travelSpeed, speed, 6, dt);
    if (speed > .4) this.travelDir = damp(this.travelDir, wrap(Math.atan2(vx, vz)), 6, dt); else this.travelDir = damp(this.travelDir, 0, 3, dt);
    const strikeL = pose.trails?.[0] || 0, strikeR = pose.trails?.[1] || 0;
    const toHand = strikeL > .5 && pose.left ? Math.atan2(pose.left[0], Math.max(.2, pose.left[2])) : strikeR > .5 && pose.right ? Math.atan2(pose.right[0], Math.max(.2, pose.right[2])) : 0;
    const gazeTarget = clamp(this.yawVel * STYLE.headLead, -STYLE.headLeadMax, STYLE.headLeadMax) + clamp(this.travelDir * STYLE.gazeTravel * Math.min(1, this.travelSpeed / 1.2), -STYLE.gazeMax, STYLE.gazeMax) + toHand * STYLE.gazeStrike;
    this.gaze = damp(this.gaze, clamp(gazeTarget, -STYLE.gazeMax, STYLE.gazeMax), 12, dt);
    pose.headYaw = (pose.headYaw || 0) + this.gaze;
    return pose;
  }
}
