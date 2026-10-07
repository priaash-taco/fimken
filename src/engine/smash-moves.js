// Goku's rock-breaking and ground-shaking moves (movement bible 61-65). Rock behaviour comes from
// 'rock' cues (see rock-smash.js); body choreography is ordinary staged keys.
export function createSmashMoves({ K, move, poses }) {
  const { guard, air, heavyLoad, heavyHit, loaded } = poses;
  const crouchLow = { crouch: .3, lean: .22, headPitch: .12 };
  const rock = (at, action, extra = {}) => ({ at, type: 'rock', action, ...extra });
  // 61 Boulder punch: a boulder rises from the ground, he sets his feet, loads the right fist and
  // drives one straight punch through it.
  const boulderPunch = move('Boulder punch', [
    K(0, guard, {}), K(.5, guard, { crouch: .14, headYaw: .1 }, 'guard', 'Size up the boulder'),
    K(.95, heavyLoad, {}, 'guard', 'Feet widen, fist loads by the ribs'), K(1.35, heavyLoad, { crouch: .23, tension: .8 }, 'guard', 'Hold the load'),
    K(1.52, heavyHit, { shout: .6 }), K(1.58, heavyHit, { shout: .6 }),
    K(1.95, heavyHit, { lean: .27, twist: .44, hitStop: 0, trails: [0, .3, 0] }, 'recover', 'Overshoot through the rubble'), K(2.6, guard, { travel: [0, .18] }, 'idle', 'Settle'), K(3.1, guard, { travel: [0, .18] })],
    [rock(.02, 'spawn', { distance: 1.2, size: .52 }), { at: 1.52, type: 'impact', limb: 'rightHand', strength: 1 }, rock(1.52, 'smash', { strength: 1 })]);
  // 62 Boulder kick: weight on the left leg, chamber the knee, drive a straight kick through the stone.
  const kickBase = { lean: -.14, left: [.45, 1.0, .15], right: [-.3, 1.28, .15] };
  const boulderKick = move('Boulder kick', [
    K(0, guard, {}), K(.45, guard, { crouch: .14, leftFoot: [.05, .04, .18], headYaw: .12 }, 'guard', 'Plant the support foot'),
    K(.78, guard, { ...kickBase, crouch: .12, rightFoot: [0, .5, .25], rightKnee: [-.2, 1.25, .9] }, 'kick', 'Chamber the knee'),
    K(.9, guard, { ...kickBase, lean: -.2, rightFoot: [0, .62, .8], rightKnee: [-.2, 1.0, .85], rightAnkle: [-.3, 0, 0], trails: [0, 0, 1], hitStop: 1, shout: .5 }),
    K(.97, guard, { ...kickBase, lean: -.2, rightFoot: [0, .62, .8], rightKnee: [-.2, 1.0, .85], rightAnkle: [-.3, 0, 0], trails: [0, 0, 1], hitStop: 1 }),
    K(1.3, guard, { crouch: .14, rightFoot: [0, .3, .1], rightKnee: [-.2, 1.2, .5] }), K(1.9, guard, {}), K(2.4, guard, {})],
    [rock(.02, 'spawn', { distance: 1.35, size: .5 }), { at: .9, type: 'impact', limb: 'rightFoot', strength: 1 }, rock(.9, 'smash', { strength: 1 })]);
  // 63 Ground pound: spring up, fists together overhead, then drive both fists into the floor so
  // the ground bursts upward around him.
  const raised = { fist: 1, focus: 1, lift: .95, lean: -.1, left: [.2, 1.75, .05], right: [-.2, 1.75, .05], leftElbow: [.5, 1.5, -.1], rightElbow: [-.5, 1.5, -.1] };
  const slam = { fist: 1, focus: 1, shout: .7, crouch: .42, lean: .32, headPitch: .22, left: [.18, .38, .38], right: [-.18, .38, .38], leftElbow: [.55, .6, .1], rightElbow: [-.55, .6, .1], hitStop: 1 };
  const groundPound = move('Ground pound', [
    K(0, guard, {}), K(.4, guard, { crouch: .26, left: [.3, .8, -.05], right: [-.3, .8, -.05] }, 'guard', 'Crouch to spring'),
    K(.75, air, { ...raised, lift: .8 }, 'float', 'Leap, fists together overhead'), K(1.05, air, { ...raised }, 'float', 'Hang at the top'),
    K(1.3, guard, { ...slam, lift: .1 }, 'punch', 'Drive both fists into the floor'), K(1.37, guard, { ...slam, lift: 0 }), K(1.44, guard, { ...slam }),
    K(2.0, guard, { crouch: .3, lean: .2, headPitch: .1, left: [.3, .6, .3], right: [-.3, .6, .3] }, 'recover', 'Rise out of the crater'), K(2.7, guard, {}), K(3.2, guard, {})],
    [{ at: 1.37, type: 'landing', strength: 1 }, rock(1.37, 'ground', { strength: 1, reach: .5 })]);
  // 64 Rock throw: lift the boulder from the ground over his head, then hurl it so it breaks on landing.
  const scoop = { ...crouchLow, crouch: .38, lean: .3, left: [.28, .5, .35], right: [-.28, .5, .35], leftElbow: [.7, .55, .1], rightElbow: [-.7, .55, .1], fist: .3 };
  const overhead = { fist: .4, crouch: .12, lean: -.14, headPitch: -.08, left: [.3, 1.6, .15], right: [-.3, 1.6, .15], leftElbow: [.8, 1.4, -.1], rightElbow: [-.8, 1.4, -.1], tension: .7 };
  const rockThrow = move('Rock throw', [
    K(0, guard, {}), K(.45, guard, { ...scoop }, 'guard', 'Squat and take the boulder'), K(.8, guard, { ...scoop }),
    K(1.35, guard, { ...overhead }, 'guard', 'Heave it overhead'), K(1.75, guard, { ...overhead, lean: -.22, twist: -.2 }, 'guard', 'Lean back to throw', 'flightWide'),
    K(2.0, guard, { fist: .3, lean: .26, twist: .25, shout: .5, left: [.25, 1.3, .55], right: [-.25, 1.3, .55], leftElbow: [.5, 1.1, .2], rightElbow: [-.5, 1.1, .2], shoulderDrive: .2, hitStop: 1 }),
    K(2.06, guard, { fist: .3, lean: .26, twist: .25, left: [.25, 1.3, .55], right: [-.25, 1.3, .55], hitStop: 1 }, undefined, undefined, 'flightWide'), K(2.5, guard, { lean: .12 }, 'recover', 'Watch it land', 'flightWide'), K(3.4, guard, {}, undefined, undefined, 'flightWide'), K(3.9, guard, {})],
    [rock(.02, 'spawn', { distance: .95, size: .46 }), rock(.7, 'grab'), rock(2.0, 'throw', { speed: 5.4, lift: 2.8 })]);
  // 65 Dive punch: rise above the boulder, drop fist-first and hit it from above.
  const dive = { fist: 1, focus: 1, shout: .6, lean: .5, headPitch: -.2, right: [-.1, .9, .5], left: [.3, 1.1, .1], rightElbow: [-.6, .8, .2], trails: [0, 1, 0] };
  const divePunch = move('Dive punch', [
    K(0, guard, {}), K(.4, guard, { crouch: .24 }, 'guard', 'Crouch to launch'), K(.85, air, { lift: .95, right: [-.3, 1.5, -.25], rightElbow: [-.8, 1.4, -.4], fist: 1, lean: -.05 }, 'float', 'Rise above it, fist drawn back'),
    K(1.3, air, { lift: .95, right: [-.3, 1.5, -.25], rightElbow: [-.8, 1.4, -.4], fist: 1, lean: -.08 }), K(1.55, guard, { ...dive, lift: .4 }, 'punch', 'Plunge fist first'),
    K(1.66, guard, { ...dive, lift: 0, crouch: .38, hitStop: 1, lean: .42 }), K(1.73, guard, { ...dive, lift: 0, crouch: .38, hitStop: 1, lean: .42 }),
    K(2.3, guard, { crouch: .32, lean: .26, right: [-.2, .6, .4], headPitch: .1 }, 'recover', 'Rise from the crater'), K(3.0, guard, {}), K(3.5, guard, {})],
    [rock(.02, 'spawn', { distance: .95, size: .52 }), { at: 1.66, type: 'impact', limb: 'rightHand', strength: 1 }, { at: 1.66, type: 'landing', strength: 1 }, rock(1.66, 'smash', { strength: 1.1 })]);
  return { boulderPunch, boulderKick, groundPound, rockThrow, divePunch };
}
