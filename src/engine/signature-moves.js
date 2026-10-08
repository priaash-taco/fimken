// Goku's signature techniques (movement bible 66-68). The energy comes from 'fx' cues (see
// signature-fx.js); the body is ordinary staged keys.
export function createSignatureMoves({ K, move, poses }) {
  const { guard, loaded, dominant, upper, p1, p2, dash } = poses;
  const fx = (at, action, extra = {}) => ({ at, type: 'fx', action, ...extra });
  // 66 Spirit Bomb: open both hands to the sky, hold while the orb grows overhead and the whole
  // body trembles, then hurl it down.
  const sky = { fist: .1, focus: 1, power: .3, crouch: 0, lean: -.06, headPitch: -.3, left: [.5, 1.85, .05], right: [-.5, 1.85, .05], leftElbow: [.9, 1.55, -.2], rightElbow: [-.9, 1.55, -.2], shoulderLift: .08, tension: .5 };
  const hurl = { fist: .8, focus: 1, shout: .7, lean: .34, twist: .1, left: [.2, 1.05, .55], right: [-.2, 1.05, .55], leftElbow: [.5, .9, .2], rightElbow: [-.5, .9, .2], shoulderDrive: .2, hitStop: 1 };
  const spiritBomb = move('Spirit Bomb', [
    K(0, guard, {}, 'guard', 'Settle', 'powerHero'), K(.6, guard, { crouch: .1, left: [.35, 1.2, .1], right: [-.35, 1.2, .1], fist: .2, focus: 1 }, 'charge', 'Open the hands to the sky', 'powerHero'),
    K(1.4, guard, { ...sky }, 'charge', 'Raise both arms', 'powerHero'), K(3.2, guard, { ...sky, tension: .8, shoulderLift: .1 }, 'charge', 'Hold as the orb grows', 'powerHero'),
    K(4.5, guard, { ...sky, tension: 1, lean: -.1, power: .5 }, 'charge', 'Strain under its weight', 'powerHero'),
    K(5.0, guard, { ...hurl }, 'punch', 'Hurl it down', 'flightWide'), K(5.07, guard, { ...hurl }, undefined, undefined, 'flightWide'),
    K(5.7, guard, { lean: .16, fist: .3 }, 'recover', 'Watch it fall', 'flightWide'), K(7.0, guard, { crouch: .14 }, 'recover', 'Catch his breath', 'flightWide'), K(7.8, guard, {})],
    [fx(.6, 'bombGrow', { duration: 3.9 }), fx(5.0, 'bombThrow', { range: 6.5 })]);
  // 67 Dragon Fist: coil low, then a rising uppercut that sends a golden dragon of energy into the sky.
  const coil = { crouch: .38, lean: .28, headPitch: .15, fist: 1, focus: 1, right: [-.2, .45, .12], rightElbow: [-.6, .6, -.2], left: [.35, 1.1, .2], twist: .3, hipYaw: .12, tension: .8, power: .5 };
  const rise = { lift: .3, right: [-.08, 1.7, .25], headPitch: -.25, shout: .7, power: .8 };
  const dragonFist = move('Dragon Fist', [
    K(0, guard, {}), K(.55, guard, { ...coil, tension: .5 }, 'guard', 'Coil low, fist at the hip'), K(1.25, guard, { ...coil, tension: 1, crouch: .42 }, 'guard', 'Hold the load'),
    K(1.45, upper, { ...rise }, 'punch', 'Rising uppercut', 'flightWide'), K(1.52, upper, { ...rise }, undefined, undefined, 'flightWide'),
    K(2.5, upper, { ...rise, hitStop: 0, trails: [0, 0, 0], lift: .35 }, 'float', 'Hold the dragon aloft', 'flightWide'), K(3.2, guard, { crouch: .14, lean: .05 }, 'recover', 'Lower the fist', 'flightWide'), K(3.9, guard, {})],
    [{ at: 1.45, type: 'impact', limb: 'rightHand', strength: .9 }, fx(1.45, 'dragonRise', { limb: 'rightHand' })]);
  // 68 Kaio-ken: bear down, the aura flares crimson with a shout, then a rush of dashing punches.
  const rush = travel => ({ travel, power: .9 });
  const kaioken = move('Kaio-ken', [
    K(0, guard, {}), K(.45, loaded, { power: .5 }, 'powerup', 'Bear down', 'powerBuild'), K(1.2, loaded, { power: .8, tension: 1, headPitch: .3 }, 'powerup', 'Gather it in', 'powerBuild'),
    K(1.6, dominant, { shout: .8, power: 1, tension: 1 }, 'powerup', 'Kaio-ken!', 'powerPeak'), K(2.3, dominant, { tension: 1, power: 1 }, 'powerup', 'Hold the flare', 'powerPeak'),
    K(2.5, dash, { power: .9, trails: [.5, .5, .5], travel: [0, .45] }, 'dash', 'Burst forward', 'strikeHero'),
    K(2.62, p1, rush([0, .6])), K(2.67, p1, rush([0, .6])), K(2.8, p2, rush([0, .75])), K(2.85, p2, rush([0, .75])),
    K(2.98, p1, rush([0, .9])), K(3.03, p1, rush([0, .9])), K(3.15, p2, rush([0, 1.05])), K(3.2, p2, rush([0, 1.05])),
    K(3.7, guard, { travel: [0, 1.05], crouch: .2, power: .4 }, 'recover', 'Aura fades'), K(4.5, guard, { travel: [0, 1.05] })],
    [fx(1.45, 'kaiokenOn'), { at: 1.6, type: 'surge', strength: 1 }, ...[[2.65, 'leftHand', .5], [2.82, 'rightHand', .55], [3.0, 'leftHand', .6], [3.17, 'rightHand', .8]].map(([at, limb, strength]) => ({ at, type: 'impact', limb, strength })), fx(3.7, 'kaiokenOff')]);
  return { spiritBomb, dragonFist, kaioken };
}
