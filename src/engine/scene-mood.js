import * as THREE from 'three';
// The scene as a whole has a state, like an anime cut: Calm, PowerUp, Charge, BeamRelease,
// Impact, Recovery. The state is read from the choreography each frame and each level eases
// in fast and out slowly, so lighting, sky, fog, grading, dust and ground effects all move
// together instead of each effect reacting on its own.
const NAMES=['calm','powerUp','charge','release','impact','recovery'];
export class SceneMood {
  constructor(){this.state='calm';this.levels=Object.fromEntries(NAMES.map(n=>[n,n==='calm'?1:0]));this.flash=0;this.impactAge=99;this.impactStrength=0;this.impactPoint=new THREE.Vector3();this.sinceIntense=99;}
  update(dt,director,music,heroPosition,beamEnd){
    const sig=director.signals||{},state=director.state,power=director.power||0;
    if(sig.release)this.flash=Math.max(this.flash,1);
    // A hard landing or a heavy hit marks the ground under the hero; the beam marks where it lands.
    const landing=sig.landing?.strength||0,hit=sig.impact?.strength||0;
    if(landing>.55||hit>.75){this.impactAge=0;this.impactStrength=Math.max(landing,hit);this.impactPoint.copy(heroPosition);this.impactPoint.y=0;}
    if(sig.release&&beamEnd){this.impactAge=-.25;this.impactStrength=1;this.impactPoint.copy(beamEnd);this.impactPoint.y=0;}
    let next='calm';
    if(state==='blast'&&(sig.beam||0)>.3)next='release';
    else if(state==='charge'&&(sig.charge||0)>.2)next='charge';
    else if(state==='powerup'||power>.62)next='powerUp';
    else if(this.impactAge>=0&&this.impactAge<1.0)next='impact';
    else if(this.sinceIntense<2.2||state==='recover')next='recovery';
    if(next==='release'||next==='powerUp'||next==='charge'||next==='impact')this.sinceIntense=0;else this.sinceIntense+=dt;
    this.state=next;
    for(const n of NAMES){const target=n===next?1:0,rate=target>this.levels[n]?(n==='release'||n==='impact'?14:5):(n==='impact'?2.5:1.6);this.levels[n]=THREE.MathUtils.damp(this.levels[n],target,rate,dt);}
    this.flash*=Math.exp(-dt*14);this.impactAge+=dt;
    return this;
  }
  // Convenience numbers the rest of the scene reads.
  get darken(){const l=this.levels;return l.charge*.22+l.release*.34+l.impact*.12;}
  get contrast(){const l=this.levels;return 1+l.powerUp*.1+l.charge*.08+l.release*.3+l.impact*.14;}
  get dustLift(){const l=this.levels;return l.powerUp*.7+l.charge*.35+l.release*.5+l.impact;}
}
