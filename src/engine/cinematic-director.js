import * as THREE from 'three';
const SHOTS = {
  powerHero:{from:[.75,1.5,5.6],to:[.65,1.5,5.4],aim:[0,1.25,0],fov:35},
  // Power-up: push in on the bowed head while energy builds, then drop low and wide for the peak.
  powerBuild:{from:[1.0,1.3,3.3],to:[.6,1.12,2.2],aim:[0,1.5,0],fov:34},
  powerPeak:{from:[.8,.62,4.4],to:[.55,.5,3.9],aim:[0,1.22,0],fov:40},
  actionWide:{from:[1.8,1.42,5.3],to:[1.8,1.42,5.3],aim:[.3,1.0,.12],fov:34},
  showcase:{from:[.85,1.25,4.7],to:[.7,1.28,4.6],aim:[0,1.03,0],fov:32},
  // Charge: close on the cupped hands at the rear hip. Impact: down the beam to where it lands.
  chargeHero:{from:[-1.9,1.4,3.0],to:[-1.35,1.25,2.1],aim:[-.12,1.12,.1],fov:33},
  // Combat follows the hero from a low three-quarter angle; hover looks up at him.
  strikeHero:{from:[3.4,1.25,2.5],to:[3.1,1.15,2.2],aim:[0,1.12,.3],fov:35},
  hoverHero:{from:[1.5,.5,4.3],to:[.9,.35,3.8],aim:[0,1.25,0],fov:38},
  heroClose:{from:[.7,1.55,2.3],to:[.4,1.6,1.55],aim:[0,1.62,0],fov:30},
  flightWide:{fixed:true,from:[.6,1.5,6.6],to:[-.4,1.7,6.2],aim:[0,1.45,0],fov:42},
  beamImpact:{from:[-6.2,2.3,4.2],to:[-6.6,2.5,4.6],aim:[0,1.3,8.6],fov:42},
  beamHero:{from:[-3.2,1.4,3.6],to:[-3.4,1.4,3.8],aim:[0,1.12,.35],fov:36},
  hero: { from: [.9, 1.35, 5.1], to: [.65, 1.4, 4.9], aim: [0, 1.05, 0], fov: 32 },
  push: { from: [.65, 1.45, 3.9], to: [.4, 1.5, 2.95], aim: [0, 1.45, 0], fov: 32 },
  impact: { from: [-2.5, 1.55, 3.6], to: [-2.6, 1.55, 3.8], aim: [0, 1.25, .2], fov: 36 },
  close: { from: [.62, 1.72, 2.55], to: [.55, 1.72, 2.50], aim: [0, 1.65, 0], fov: 29 },
  orbit: { from: [2.8, 1.65, 3.6], to: [.8, 1.65, 4], aim: [0, 1.2, 0], fov: 34 },
  side: { from: [-2.9, 1.4, 3.4], to: [-2.8, 1.4, 3.4], aim: [0, 1.15, 0], fov: 32 },
  rise: { from: [.7, 1.1, 4.6], to: [1, 1.2, 4.9], aim: [0, 1.15, 0], fov: 36 },
  wide: { from: [2.2, 2.2, 7.9], to: [2.5, 2.5, 8.5], aim: [0, 1.0, 0], fov: 36 },
  settle: { from: [.85, 1.4, 5.0], to: [.9, 1.35, 4.3], aim: [0, 1.2, 0], fov: 32 },
};
const UP=new THREE.Vector3(0,1,0);
export class CinematicDirector {
  constructor(camera, controls) { this.camera = camera; this.controls = controls; this.position = new THREE.Vector3(); this.target = new THREE.Vector3(); this.revision = -1; }
  update(dt, direction, actorPosition, view = 'training', snap = false) {
    const shot = SHOTS[view === 'portrait' ? 'close' : direction.shot] || SHOTS.hero;
    const p = THREE.MathUtils.smoothstep(direction.progress || 0, 0, 1);
    this.position.fromArray(shot.from).lerp(new THREE.Vector3().fromArray(shot.to), p);
    if (this.camera.aspect < .85) this.position.multiplyScalar(1.45);
    const fixed=direction.shot==='actionWide'||shot.fixed, heading=direction.heading||0;
    this.target.fromArray(shot.aim);
    if(!fixed){this.position.applyAxisAngle(UP,heading).add(actorPosition);this.target.applyAxisAngle(UP,heading).add(actorPosition);}
    const first = this.revision === -1;
    // Move continuously between action cameras. Phase changes never cut the view.
    if (snap || first) { this.camera.position.copy(this.position); this.controls.target.copy(this.target); }
    else { this.camera.position.lerp(this.position, 1 - Math.exp(-dt * 2.4)); this.controls.target.lerp(this.target, 1 - Math.exp(-dt * 3.2)); }
    this.camera.fov = snap||first?shot.fov:THREE.MathUtils.damp(this.camera.fov,shot.fov,3,dt); this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);
    this.revision = direction.revision;
  }
}
