// Life on top of the authored poses: nothing in a body ever stops or arrives all at once.
// Each frame the sampled pose passes through four layers before the rig applies it:
//  - chain lag: hips lead, torso follows a few frames behind, hands and head after that,
//    each settling with a small damped bounce instead of easing to a dead stop;
//  - layered noise: slow, continuous wobble on every joint, different per side, finer and
//    quicker as the pose tenses;
//  - whole-body breathing: shoulders, arms, head and hip weight all move with the breath;
//  - saccades: the head re-aims in small quick steps every few seconds, not one smooth turn.
// Contacts, cues and energy hands are exempt: a hit lands on its frame and the beam stays
// anchored to the hands.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
class Spring{
  constructor(value=0,frequency=20,damping=.75){this.x=value;this.v=0;this.w=frequency;this.z=damping;this.started=false;}
  step(target,dt){
    if(!this.started){this.x=target;this.v=0;this.started=true;return this.x;}
    let t=clamp(dt,0,.1);
    while(t>0){const h=Math.min(t,1/240);this.v+=(this.w*this.w*(target-this.x)-2*this.z*this.w*this.v)*h;this.x+=this.v*h;t-=h;}
    return this.x;
  }
  reset(){this.started=false;}
}
// Scalar channels and the lag of each: hips react first, hands and head last.
const LAG={crouch:34,lean:16,twist:14,bank:16,headPitch:12,headYaw:22,shoulderLift:14,shoulderDrive:16,hipShift0:26,hipShift1:26};
const HAND_LAG=15;
export class MotionLife{
  constructor(seed=1){
    this.seed=seed>>>0;this.springs={};for(const k of Object.keys(LAG))this.springs[k]=new Spring(0,LAG[k],.72);
    this.hands={left:[0,1,2].map(()=>new Spring(0,HAND_LAG,.68)),right:[0,1,2].map(()=>new Spring(0,HAND_LAG,.68))};
    this.saccade={yaw:0,pitch:0,next:1.5,target:[0,0]};this.phase=this.random()*100;
    // Per-performance asymmetry: each side runs at its own scale and phase.
    this.sideScale={left:.94+this.random()*.12,right:.94+this.random()*.12};this.sidePhase={left:this.random()*7,right:this.random()*7};
  }
  random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
  reset(){for(const s of Object.values(this.springs))s.reset();for(const side of ['left','right'])for(const s of this.hands[side])s.reset();}
  // Sum of incommensurate sines: continuous, never repeating within a performance.
  wobble(t,k,speed=1){return (Math.sin(t*.61*speed+k*1.7)*.5+Math.sin(t*1.37*speed+k*3.1)*.3+Math.sin(t*2.93*speed+k*.9)*.2);}
  apply(p,dt,time){
    if(!(dt>0))return p;
    const t=time+this.phase,hold=p.hitStop||0,energy=Math.max(p.charge||0,p.beam||0);
    const precise=Math.max(hold,energy>.5?1:0);          // contacts and energy hands snap to the pose
    const free=1-hold,tense=Math.max(p.tension||0,Math.max(0,(p.power||0)-.5)*2,(p.fist||0)*.5);
    // Breathing: one cycle every 3.2 s at rest, quicker when tense.
    const breath=Math.sin(t*(1.95+tense*1.2))*free;
    const amp=(1-.5*tense)*free;
    const lagged=(key,value,snap)=>{const s=this.springs[key];if(!s)return value;const x=s.step(value,dt);return snap?value:x;};
    const out={...p};
    // Chain lag on torso, head and shoulders.
    out.crouch=lagged('crouch',p.crouch,hold>.5)+breath*.004*amp;
    out.lean=lagged('lean',p.lean,hold>.5)+this.wobble(t,1)*.012*amp;
    out.twist=lagged('twist',p.twist,hold>.5)+this.wobble(t,2)*.010*amp;
    out.bank=lagged('bank',p.bank||0,hold>.5)+this.wobble(t,3)*.008*amp;
    out.shoulderLift=lagged('shoulderLift',p.shoulderLift||0,hold>.5)+breath*.012*amp+this.wobble(t,4,1.3)*.006*amp;
    out.shoulderDrive=lagged('shoulderDrive',p.shoulderDrive||0,hold>.5);
    out.hipShift=[lagged('hipShift0',p.hipShift?.[0]||0,hold>.5)+this.wobble(t,5,.4)*.014*amp,lagged('hipShift1',p.hipShift?.[1]||0,hold>.5)+this.wobble(t,6,.4)*.006*amp];
    // Head: re-aims in saccades, leads turns, breathes a little.
    this.saccade.next-=dt;
    if(this.saccade.next<=0){this.saccade.next=1.2+this.random()*3;this.saccade.target=[(this.random()-.5)*.12,(this.random()-.5)*.06];}
    this.saccade.yaw+=(this.saccade.target[0]-this.saccade.yaw)*Math.min(1,dt*14);this.saccade.pitch+=(this.saccade.target[1]-this.saccade.pitch)*Math.min(1,dt*14);
    out.headYaw=lagged('headYaw',p.headYaw||0,hold>.5)+this.saccade.yaw*amp+this.wobble(t,7,.8)*.02*amp;
    out.headPitch=lagged('headPitch',p.headPitch||0,hold>.5)+this.saccade.pitch*amp+breath*.01*amp+this.wobble(t,8,.7)*.015*amp;
    // Hands follow a few frames behind the shoulders and drift with the breath; fine tremor when tense.
    for(const side of ['left','right']){
      const sign=side==='left'?1:-1,k=this.sidePhase[side],scale=this.sideScale[side];
      const tremor=Math.sin(t*23+k)*Math.sin(t*17+k*2)*.004*tense*free;
      out[side]=p[side].map((v,i)=>{const x=this.hands[side][i].step(v,dt);const base=precise>.5?v:x;
        const drift=i===0?sign*breath*.006:i===1?breath*.008:breath*.004;
        return base+(drift+this.wobble(t+k,10+i,.9)*.006*scale)*amp+(i===1?tremor:tremor*.5);});
    }
    // Follow-through channels the director already derives stay consistent with the lagged torso.
    if(out.followTwist!=null)out.followTwist=out.twist;if(out.followLean!=null)out.followLean=out.lean;if(out.headTwist!=null)out.headTwist=out.twist;
    return out;
  }
}
