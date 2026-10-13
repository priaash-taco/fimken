// Converts CMU motion-capture BVH clips (art/mocap/cmu, free to use) into short moves in the rig's own
// pose parameters, written to src/engine/mocap/clips.json and art/mocap/targets.json (expected joint
// positions, used by scripts/check-mocap.mjs to measure how closely the rig follows the capture).
//
// How it maps: forward kinematics gives world joint positions. The pelvis ground point is the root, the
// pelvis heading is `yaw`, and everything else is expressed in that frame and scaled to the rig by
// segment (legs, torso, arms separately: the rig's arms are shorter than a human's relative to its body).
// Hands, feet and elbows become IK targets; torso lean, twist, bank, crouch, lift and head angles are
// derived the same way the rig applies them. Each long clip is sliced into short moves around its
// strongest strikes, with an impact cue at the peak.
//   node scripts/convert-mocap.mjs
import * as THREE from 'three';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RIG = { hipsRest: .899, ankleRest: .148, shoulderY: 1.267, legLen: .88, armLen: .433, torsoLen: .4, shoulderHalf: .242, feetDefault: { left: [.27, .148, -.004], right: [-.27, .148, -.004] } };
const FPS = 30;

// ---- BVH
function parseBvh(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean); let i = 0; const joints = [], stack = []; let channelsTotal = 0;
  while (i < lines.length && !lines[i].startsWith('MOTION')) {
    const t = lines[i].split(/\s+/);
    if (t[0] === 'ROOT' || t[0] === 'JOINT') { const j = { name: t[1], parent: stack.at(-1) ?? -1, offset: [0, 0, 0], channels: [] }; joints.push(j); stack.push(joints.length - 1); }
    else if (t[0] === 'End') { stack.push(-2); }
    else if (t[0] === 'OFFSET' && stack.at(-1) >= 0) joints[stack.at(-1)].offset = t.slice(1).map(Number);
    else if (t[0] === 'CHANNELS') { const j = joints[stack.at(-1)]; j.channels = t.slice(2); j.base = channelsTotal; channelsTotal += j.channels.length; }
    else if (t[0] === '}') stack.pop();
    i++;
  }
  const frames = Number(lines[i + 1].split(/\s+/)[1]), frameTime = Number(lines[i + 2].split(/\s+/).at(-1));
  const data = lines.slice(i + 3, i + 3 + frames).map(l => l.split(/\s+/).map(Number));
  return { joints, frames, frameTime, data };
}
const AXIS = { X: V(1, 0, 0), Y: V(0, 1, 0), Z: V(0, 0, 1) };
function worldFrames(bvh) {
  const index = Object.fromEntries(bvh.joints.map((j, k) => [j.name, k])), out = [];
  for (const row of bvh.data) {
    const mats = new Array(bvh.joints.length);
    bvh.joints.forEach((j, k) => {
      const m = new THREE.Matrix4(), local = new THREE.Matrix4().makeTranslation(...j.offset);
      let rot = new THREE.Matrix4();
      j.channels.forEach((c, n) => {
        const v = row[j.base + n];
        if (c.endsWith('position')) local.setPosition(local.elements[12] + (c[0] === 'X' ? v : 0), local.elements[13] + (c[0] === 'Y' ? v : 0), local.elements[14] + (c[0] === 'Z' ? v : 0));
        else rot = rot.multiply(new THREE.Matrix4().makeRotationAxis(AXIS[c[0]], THREE.MathUtils.degToRad(v)));
      });
      local.multiply(rot); mats[k] = j.parent >= 0 ? m.multiplyMatrices(mats[j.parent], local) : m.copy(local);
    });
    out.push({ P: name => V().setFromMatrixPosition(mats[index[name]]), M: name => mats[index[name]] });
  }
  return out;
}
const dist = (a, b) => a.distanceTo(b);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const headingOf = f => Math.atan2(f.x, f.z);

// ---- per-frame solve
function solve(frames, name) {
  const first = frames[0], leg = dist(first.P('LeftUpLeg'), first.P('LeftLeg')) + dist(first.P('LeftLeg'), first.P('LeftFoot'));
  const arm = dist(first.P('LeftArm'), first.P('LeftForeArm')) + dist(first.P('LeftForeArm'), first.P('LeftHand'));
  const torso = dist(first.P('Hips'), first.P('Neck'));
  const kLeg = RIG.legLen / leg, kArm = RIG.armLen / arm;
  const shoulderWidth = dist(first.P('LeftArm'), first.P('RightArm')), kWidth = (RIG.shoulderHalf * 2) / shoulderWidth;
  const above = frames.map(f => f.P('Hips').y - Math.min(f.P('LeftFoot').y, f.P('RightFoot').y)).sort((a, b) => a - b), standing = above[Math.floor(above.length * .9)];
  // Planted ankle height: the median of the lower ankle over the clip.
  const lows = frames.map(f => Math.min(f.P('LeftFoot').y, f.P('RightFoot').y)).sort((a, b) => a - b), plantedAnkle = lows[Math.floor(lows.length * .35)];
  const rows = []; let prevYaw = null, unwrap = 0;
  for (const f of frames) {
    const hips = f.P('Hips'), lU = f.P('LeftUpLeg'), rU = f.P('RightUpLeg');
    const L = lU.clone().sub(rU).setY(0).normalize(), fwd = L.clone().cross(V(0, 1, 0)).normalize();
    let yaw = headingOf(fwd); if (prevYaw != null) { const d = wrap(yaw - prevYaw); unwrap += d; } else unwrap = yaw; prevYaw = yaw;
    const toLocal = p => p.clone().sub(V(hips.x, 0, hips.z)).applyAxisAngle(V(0, 1, 0), -yaw);
    const sh = { left: f.P('LeftArm'), right: f.P('RightArm') };
    const chestL = sh.left.clone().sub(sh.right).setY(0).normalize(), chestHeading = headingOf(chestL.clone().cross(V(0, 1, 0)).normalize());
    const twist = wrap(chestHeading - yaw);
    const neck = toLocal(f.P('Neck')), hipsL = toLocal(hips), v = neck.clone().sub(hipsL);
    const lean = Math.atan2(v.z, v.y), bank = -Math.atan2(v.x, v.y);
    const minAnkle = Math.min(f.P('LeftFoot').y, f.P('RightFoot').y), grounded = Math.max(minAnkle, plantedAnkle);
    const lift = Math.max(0, minAnkle - plantedAnkle - .35) * kLeg;
    const crouch = .05 + kLeg * (standing - (hips.y - minAnkle));
    const out = { yaw: unwrap, twist, lean, bank, crouch, lift };
    for (const side of ['left', 'right']) {
      const S = toLocal(sh[side]), cap = side === 'left' ? 'Left' : 'Right';
      const E = toLocal(f.P(cap + 'ForeArm')), W = toLocal(f.P(cap + 'Hand'));
      const ss = V(S.x * kWidth, S.y * kLeg, S.z * kLeg);
      out[side] = ss.clone().addScaledVector(W.clone().sub(S), kArm).toArray(); out[side + 'Elbow'] = ss.clone().addScaledVector(E.clone().sub(S), kArm).toArray();
      const A = toLocal(f.P(cap + 'Foot')), hipsAbove = hipsL.y;
      const abs = V(kLeg * (A.x - hipsL.x), RIG.ankleRest + kLeg * (A.y - plantedAnkle), kLeg * (A.z - hipsL.z));
      out[side + 'FootAbs'] = abs.toArray(); out[side + 'Foot'] = abs.clone().sub(V(...RIG.feetDefault[side])).toArray();
    }
    // Head: forward vector from the head joint's orientation, relative to the pelvis frame.
    const hf = V(0, 0, 1).transformDirection(f.M('Head')).applyAxisAngle(V(0, 1, 0), -yaw);
    out.headHeading = Math.atan2(hf.x, hf.z); out.headPitchAbs = -Math.asin(THREE.MathUtils.clamp(hf.y, -1, 1));
    out.travel = [hips.x, hips.z]; out.speedPoints = { leftHand: f.P('LeftHand'), rightHand: f.P('RightHand'), leftFoot: f.P('LeftFoot'), rightFoot: f.P('RightFoot') };
    out.headYaw = wrap(out.headHeading - 0) - .4 * twist; out.headPitch = out.headPitchAbs - .75 * lean;
    rows.push(out);
  }
  // Start facing +z with the root at the origin of its own path.
  const y0 = rows[0].yaw, t0 = rows[0].travel.slice();
  for (const r of rows) { const dx = r.travel[0] - t0[0], dz = r.travel[1] - t0[1]; const c = Math.cos(-y0), s = Math.sin(-y0); r.travel = [(dx * c + dz * s) * kLeg, (-dx * s + dz * c) * kLeg]; r.yaw -= y0; }
  return { rows, kLeg };
}

// ---- resample to 30 fps with a box filter
function resample(rows, srcFps) {
  const step = srcFps / FPS, out = [], n = Math.floor(rows.length / step), keys = ['yaw', 'twist', 'lean', 'bank', 'crouch', 'lift', 'headYaw', 'headPitch'];
  const avg = (a, b, fn) => { let s = 0, c = 0; for (let k = a; k < b; k++) { s += fn(rows[k]); c++; } return s / c; };
  const avgArr = (a, b, key) => [0, 1, 2].map(i => avg(a, b, r => r[key][i]));
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, Math.round(i * step - step / 2)), b = Math.min(rows.length, Math.round(i * step + step / 2) + 1), o = { t: i / FPS };
    for (const k of keys) o[k] = avg(a, b, r => r[k]);
    for (const k of ['left', 'right', 'leftElbow', 'rightElbow', 'leftFoot', 'rightFoot', 'leftFootAbs', 'rightFootAbs']) o[k] = avgArr(a, b, k);
    o.travel = [0, 1].map(j => avg(a, b, r => r.travel[j]));
    o.points = rows[Math.min(rows.length - 1, Math.round(i * step))].speedPoints; o.pointsPrev = rows[Math.max(0, Math.round(i * step - step))].speedPoints;
    out.push(o);
  }
  return out;
}

// ---- strikes: peaks of limb speed, away from other peaks
function limbSpeed(rows, limb, k) { return rows.map((r, i) => i ? r.points[limb].distanceTo(r.pointsPrev[limb]) * FPS * k : 0); }
function findPeaks(rows, limbs, kind, k, want) {
  const peaks = [];
  for (const limb of limbs) {
    const s = limbSpeed(rows, limb, k), smooth = s.map((_, i) => (s[i - 1] ?? s[i] + s[i] + (s[i + 1] ?? s[i])) / 3);
    for (let i = 3; i < s.length - 3; i++) if (s[i] > 2.2 && s[i] >= Math.max(...s.slice(i - 3, i + 4))) peaks.push({ t: i / FPS, i, limb, speed: s[i], kind });
  }
  peaks.sort((a, b) => b.speed - a.speed); const chosen = [];
  for (const p of peaks) if (chosen.every(c => Math.abs(c.t - p.t) > 2.2)) chosen.push(p);
  return chosen.slice(0, want);
}
const round = (x, n = 3) => +x.toFixed(n);
const roundArr = a => a.map(x => round(x));
const CLIPS = [
  // file, kind, label, how many to keep, fist
  ['135_04', 'kick', 'Karate front kick', 3, .8], ['135_07', 'kick', 'Karate roundhouse', 3, .8], ['135_11', 'kick', 'Karate side kick', 3, .8],
  ['135_09', 'punch', 'Karate lunge punch', 3, 1], ['135_05', 'block', 'Karate down block', 2, .9], ['135_10', 'block', 'Karate knife-hand block', 2, .1],
  ['144_13', 'punch', 'Punch sequence', 2, 1], ['144_20', 'punch', 'Punch combination', 2, 1], ['144_05', 'kick', 'Front kick', 2, .8], ['144_26', 'block', 'Blocks', 2, .9],
  ['144_14', 'punch', 'Left punch sequence', 2, 1], ['144_21', 'punch', 'Punch sequence B', 2, 1], ['144_06', 'kick', 'Front kicks', 2, .8], ['144_09', 'kick', 'Left front kick', 2, .8],
  ['144_07', 'block', 'Left blocks', 2, .9], ['144_27', 'block', 'Right blocks', 2, .9],
  ['76_01', 'punch', 'Backstep and punch', 2, 1], ['76_02', 'punch', 'Feint and strike', 2, 1], ['76_03', 'block', 'Dodge an attacker', 2, .8], ['76_11', 'block', 'Quick backsteps', 2, .7], ['76_04', 'flow', 'Guard stance', 1, .8],
  ['127_29', 'block', 'Duck under', 1, .5], ['127_13', 'block', 'Side step', 1, .5], ['127_14', 'block', 'Side step', 1, .5], ['127_05', 'block', 'Quick stop', 1, .5],
  ['118_01', 'jump', 'Jump', 1, .3], ['118_05', 'jump', 'Jump', 1, .3], ['118_10', 'jump', 'Jump', 1, .3], ['118_15', 'jump', 'Jump', 1, .3],
  ['16_03', 'jump', 'High jump', 1, .3], ['16_05', 'jump', 'Forward jump', 1, .3], ['85_01', 'jump', 'Twisting jump', 2, .4], ['127_21', 'jump', 'Run, jump and stop', 1, .3],
  ['135_01', 'flow', 'Bassai kata', 5, .9], ['135_02', 'flow', 'Empi kata', 4, .9], ['135_06', 'flow', 'Heian kata', 4, .9],
  ['12_04', 'flow', 'Tai chi', 8, .2], ['42_01', 'flow', 'Full stretch', 2, .2], ['85_04', 'flow', 'Fancy footwork', 3, .4],
];
const MAX_TRAVEL = 1.6, clips = [], targets = {}, counters = {};
const reachable = r => [r.left, r.right].every(h => h[1] > .3 && h[1] < 2.1 && Math.hypot(h[0], h[2]) < 1.1) && r.crouch > -.15 && r.crouch < .6 && Math.abs(r.lean) < 1.25 && Math.abs(r.twist) < 1.25;
for (const [file, kind, label, want, fist] of CLIPS) {
  const bvh = parseBvh(readFileSync(`art/mocap/cmu/${file}.bvh`, 'utf8')), srcFps = Math.round(1 / bvh.frameTime);
  const frames = worldFrames(bvh), { rows: raw, kLeg } = solve(frames, file), rows = resample(raw, srcFps);
  const strike = kind === 'kick' || kind === 'punch' || kind === 'block';
  const limbs = kind === 'kick' ? ['leftFoot', 'rightFoot'] : ['leftHand', 'rightHand'];
  const speeds = ['leftHand', 'rightHand', 'leftFoot', 'rightFoot'].map(l => limbSpeed(rows, l, kLeg));
  // The calmest moment in a range: little limb speed and both feet down.
  const calm = i => { let s = 0, n = 0; for (let k = Math.max(0, i - 3); k <= Math.min(rows.length - 1, i + 3); k++) { s += speeds.reduce((a, sp) => a + sp[k], 0) + 6 * (rows[k].leftFootAbs[1] + rows[k].rightFootAbs[1] - .296); n++; } return s / n; };
  const pick = (from, to) => { let best = Math.max(0, Math.min(rows.length - 1, from)), bestScore = Infinity; for (let i = Math.max(0, from); i <= Math.min(rows.length - 1, to); i++) { const sc = calm(i); if (sc < bestScore) { bestScore = sc; best = i; } } return best; };
  const slices = [];
  if (strike) {
    for (const pk of findPeaks(rows, limbs, kind, kLeg, want * 2).sort((x, y) => x.t - y.t)) slices.push({ start: pick(pk.i - Math.round(2.2 * FPS), pk.i - Math.round(.5 * FPS)), end: pick(pk.i + Math.round(.9 * FPS), pk.i + Math.round(2 * FPS)), peak: pk });
  } else if (kind === 'jump') {
    const peaks = [];
    for (let i = 4; i < rows.length - 4; i++) if (rows[i].lift > .1 && rows[i].lift >= Math.max(...rows.slice(i - 4, i + 5).map(r => r.lift))) peaks.push({ i, lift: rows[i].lift });
    peaks.sort((x, y) => y.lift - x.lift);
    const chosen = []; for (const pk of peaks) if (chosen.every(c => Math.abs(c.i - pk.i) > 2.2 * FPS)) chosen.push(pk);
    for (const pk of chosen.slice(0, want * 2).sort((x, y) => x.i - y.i)) { let land = pk.i; while (land < rows.length - 1 && rows[land].lift > .03) land++; slices.push({ start: pick(pk.i - Math.round(2 * FPS), pk.i - Math.round(.6 * FPS)), end: pick(land + Math.round(.3 * FPS), land + Math.round(1.6 * FPS)), jump: { land, height: pk.lift } }); }
  } else {
    for (let k = 0; k < want * 2; k++) { const center = Math.round((k + .5) * rows.length / (want * 2)), start = pick(center - 15, center + 15); slices.push({ start, end: pick(start + Math.round(3.2 * FPS), start + Math.round(4.8 * FPS)) }); }
  }
  let kept = 0;
  for (const sl of slices) {
    if (kept >= want || sl.end - sl.start < 30) continue;
    const seg = rows.slice(sl.start, sl.end + 1);
    if (!seg.every(reachable)) continue;
    if (seg.some(r => Math.hypot(r.travel[0] - seg[0].travel[0], r.travel[1] - seg[0].travel[1]) > MAX_TRAVEL)) continue;
    const y0 = seg[0].yaw, tx = seg[0].travel[0], tz = seg[0].travel[1], c0 = Math.cos(-y0), s0 = Math.sin(-y0), maxSpeed = sl.peak?.speed || 1;
    const keys = seg.map((r, k) => {
      const trails = [0, 0, 0], idx = sl.start + k;
      if (sl.peak) for (const [slot, limb, n] of [[0, 'leftHand', 0], [1, 'rightHand', 1], [2, 'leftFoot', 2], [2, 'rightFoot', 3]]) if (kind !== 'block' && limbs.includes(limb) && speeds[n][idx] > .6 * maxSpeed) trails[slot] = 1;
      return { at: round(k / FPS, 3), yaw: round(r.yaw - y0), twist: round(r.twist), lean: round(r.lean), bank: round(r.bank), crouch: round(r.crouch), lift: round(r.lift), headYaw: round(r.headYaw), headPitch: round(r.headPitch),
        left: roundArr(r.left), right: roundArr(r.right), leftElbow: roundArr(r.leftElbow), rightElbow: roundArr(r.rightElbow), leftFoot: roundArr(r.leftFoot), rightFoot: roundArr(r.rightFoot),
        travel: roundArr([(r.travel[0] - tx) * c0 + (r.travel[1] - tz) * s0, -(r.travel[0] - tx) * s0 + (r.travel[1] - tz) * c0]), trails, fist };
    });
    const letter = String.fromCharCode(65 + (counters[label] = (counters[label] ?? -1) + 1)), id = `${file}_${kept}`;
    const cues = sl.peak && kind !== 'block' ? [{ at: round((sl.peak.i - sl.start) / FPS, 3), type: 'impact', limb: sl.peak.limb, strength: round(Math.min(1, .45 + sl.peak.speed / 12), 2) }]
      : sl.jump ? [{ at: round((sl.jump.land - sl.start) / FPS, 3), type: 'landing', strength: round(Math.min(1, .4 + sl.jump.height * 1.2), 2) }] : [];
    clips.push({ id, label: `${label} ${letter}`, kind, duration: round(seg.length / FPS - 1 / FPS, 3), keys, cues });
    targets[id] = seg.map(r => ({ left: roundArr(r.left), right: roundArr(r.right), leftFoot: roundArr(r.leftFootAbs), rightFoot: roundArr(r.rightFootAbs) }));
    kept++;
  }
  console.log(file.padEnd(8), kind.padEnd(6), `${kept}/${want} kept (${slices.length} candidates)`);
}
mkdirSync('src/engine/mocap', { recursive: true });
writeFileSync('src/engine/mocap/clips.json', JSON.stringify({ source: 'CMU Graphics Lab Motion Capture Database (free for any use), BVH conversion by Bruce Hahn, retargeted by scripts/convert-mocap.mjs', fps: FPS, clips }));
writeFileSync('art/mocap/targets.json', JSON.stringify(targets));
console.log(clips.length + ' moves, ' + clips.reduce((n, c) => n + c.keys.length, 0) + ' keys');
