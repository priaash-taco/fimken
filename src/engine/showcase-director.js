import { createStagedMoves } from './staged-moves.js';
import * as THREE from 'three';

const stance = { headPitch:0,headYaw:0,shoulderDrive:0,shoulderLift:0,tension:0,leftElbow:[.85,1.02,.45],rightElbow:[-.85,1.02,.45],crouch:.045, twist:0, lean:0, lift:0, power:.22, charge:0, beam:0,
  left:[.43,.94,.13], right:[-.43,.94,.13],
  travel:[0,0],yaw:0,flip:0,fist:0,focus:.15,shout:0,hipYaw:0,pivot:0,bank:0,hipShift:[0,0],guard:0,hitStop:0,footControl:0,
  leftFoot:[0,0,0],rightFoot:[0,0,0],leftKnee:[.30,.55,1],rightKnee:[-.30,.55,1],
  leftAnkle:[0,0,0],rightAnkle:[0,0,0],trails:[0,0,0] };
const charged = { ...stance, fist:.25, focus:1, crouch:.095, twist:.14, lean:-.08, power:.9, charge:1,
  left:[.16,1.07,.31], right:[-.12,1.35,.31] };
const release = { ...stance, focus:1, shout:.5, crouch:.065, twist:.13, lean:.13, power:1, charge:1, beam:1,
  left:[.115,1.29,.39], right:[-.115,1.29,.39] };
const hover = { ...stance, lift:.38, crouch:.015, lean:-.035, power:.4,
  left:[.46,1.01,.12], right:[-.40,1.17,.25] };
const key = (at, pose, phase, shot='showcase') => ({at,pose,phase,shot});
// This sequence is choreography data. Limb IK, pivoting, trails and cue dispatch
// remain reusable; no generated clip or replacement character is involved.
const guard={...stance,crouch:.10,guard:1,fist:.55,focus:.6,footControl:1,lean:.055,
  left:[.17,1.36,.46],right:[-.15,1.30,.30],leftElbow:[.5,.55,.15],rightElbow:[-.55,.55,.05],leftFoot:[0,0,.09],rightFoot:[0,0,-.09]};
const jab={...guard,fist:1,focus:.9,twist:-.18,hipYaw:-.06,lean:.09,left:[.12,1.28,.39],trails:[1,0,0],hitStop:1};
const cross={...guard,fist:1,focus:.9,twist:.24,hipYaw:.09,lean:.12,right:[-.11,1.31,.41],trails:[0,1,0],hitStop:1};
const heavy={...guard,fist:1,focus:1,shout:.35,crouch:.13,twist:-.26,hipYaw:-.1,lean:.15,left:[.10,1.30,.42],trails:[1,0,0],hitStop:1};
const pivot={...guard,fist:.75,leftFoot:[0,0,0],rightFoot:[.07,.26,.16],pivot:1,hipShift:[.07,0],crouch:.08};
const chamber={...pivot,yaw:Math.PI*.76,bank:-.10,rightFoot:[.18,.50,.20],rightKnee:[-.20,1.30,.85],twist:-.18};
const kick={...chamber,yaw:Math.PI*1.42,bank:-.16,lean:.10,rightFoot:[.16,.73,.82],rightAnkle:[-.25,0,-.10],rightKnee:[-.15,1.2,.8],trails:[0,0,1],hitStop:1};
const landed={...guard,yaw:Math.PI*2,crouch:.16,lean:.12};
const dash={...guard,yaw:Math.PI*2,lift:.13,crouch:.07,lean:.25,left:[.38,1.10,-.12],right:[-.32,1.25,.20],leftFoot:[0,.11,-.16],rightFoot:[0,.06,.12],trails:[.35,.35,.4]};
const destination=[.85,.18];
const finish={...guard,travel:destination,yaw:Math.PI*2};
const sequenceCharge={...charged,travel:destination,yaw:Math.PI*2,footControl:1};
const sequenceRelease={...release,travel:destination,yaw:Math.PI*2,footControl:1};
const actionSequence={duration:9.8,cues:[
  {at:1.13,type:'impact',limb:'leftHand',strength:.35},
  {at:1.49,type:'impact',limb:'rightHand',strength:.45},
  {at:1.96,type:'impact',limb:'leftHand',strength:.65},
  {at:3.03,type:'impact',limb:'rightFoot',strength:.8},
  {at:3.58,type:'landing',strength:.35},{at:4.18,type:'landing',strength:.65},
  {at:7.22,type:'release',strength:1},
],keys:[
  key(0,stance,'guard','actionWide'),key(.55,guard,'guard','actionWide'),
  key(.94,{...guard,twist:.12,left:[.28,1.32,.14]},'punch','actionWide'),
  key(1.13,jab,'punch','actionWide'),key(1.19,jab,'punch','actionWide'),key(1.36,guard,'punch','actionWide'),
  key(1.49,cross,'punch','actionWide'),key(1.55,cross,'punch','actionWide'),
  key(1.78,{...guard,crouch:.16,twist:.22,left:[.32,1.24,.08]},'punch','actionWide'),
  key(1.96,heavy,'punch','actionWide'),key(2.04,heavy,'punch','actionWide'),key(2.24,guard,'guard','actionWide'),
  key(2.40,pivot,'kick','actionWide'),key(2.79,chamber,'kick','actionWide'),
  key(3.03,kick,'kick','actionWide'),key(3.10,kick,'kick','actionWide'),
  key(3.34,{...chamber,yaw:Math.PI*1.90,rightFoot:[.09,.35,.14]},'kick','actionWide'),
  key(3.58,landed,'land','actionWide'),key(3.76,{...guard,yaw:Math.PI*2,crouch:.18,lean:.18},'dash','actionWide'),
  key(3.85,dash,'dash','actionWide'),key(4.07,{...dash,travel:destination},'dash','actionWide'),
  key(4.18,{...finish,crouch:.22,lean:.22,hipShift:[0,.045],hitStop:1},'land','actionWide'),
  key(4.28,{...finish,crouch:.22,lean:.22,hipShift:[0,.045],hitStop:1},'land','actionWide'),
  key(4.65,finish,'guard','actionWide'),
  key(5.15,{...sequenceCharge,charge:.2,power:.35},'charge','chargeHero'),
  key(6.72,sequenceCharge,'charge','chargeHero'),key(7.05,sequenceCharge,'charge','chargeHero'),
  key(7.22,sequenceRelease,'blast','beamHero'),
  key(7.42,{...sequenceRelease,lean:-.10,crouch:.12,left:[.12,1.27,.33],right:[-.12,1.27,.33]},'blast','beamHero'),
  key(8.25,{...sequenceRelease,lean:.02},'blast','beamHero'),
  key(8.48,{...sequenceRelease,beam:0,charge:0,power:.3},'recover','beamHero'),
  key(9.35,finish,'recover','actionWide'),key(9.8,finish,'idle','actionWide'),
]};
export const SHOWCASE_MOVES = {
  sequence:actionSequence,
  stance:{duration:2,hold:true,keys:[key(0,stance,'idle'),key(2,stance,'idle')]},
  powerup:{duration:7.2,cues:[{at:1.9,type:'surge',strength:1},{at:3.8,type:'surge',strength:.55}],keys:[
    key(0,stance,'powerup'),key(.9,{...stance,crouch:.14,lean:.12,power:.32,left:[.36,1.08,.16],right:[-.36,1.08,.16]},'powerup'),
    key(1.7,{...stance,crouch:.18,lean:.16,power:.48,left:[.34,1.12,.13],right:[-.34,1.12,.13]},'powerup'),
    key(1.9,{...stance,crouch:.07,lean:-.075,power:1,left:[.49,.99,.1],right:[-.49,.99,.1]},'powerup'),
    key(2.05,{...stance,crouch:.085,lean:-.035,power:.94,left:[.48,.98,.13],right:[-.48,.98,.13]},'powerup'),
    key(5.4,{...stance,crouch:.075,lean:-.045,power:1,left:[.49,.98,.12],right:[-.49,.98,.12]},'powerup'),
    key(6.4,{...stance,power:.55},'recover'),key(7.2,stance,'idle')]},
  charge:{duration:3.4,hold:true,keys:[key(0,stance,'charge','chargeHero'),key(1.4,{...charged,charge:.25,power:.45},'charge','chargeHero'),key(3.4,charged,'charge','chargeHero')]},
  blast:{duration:6.6,cues:[{at:3.62,type:'release',strength:1}],keys:[key(0,stance,'charge','chargeHero'),key(1.6,{...charged,charge:.3,power:.5},'charge','chargeHero'),key(3.1,charged,'charge','chargeHero'),key(3.45,charged,'charge','chargeHero'),key(3.62,release,'blast','beamHero'),key(3.84,{...release,lean:-.1,crouch:.12,left:[.12,1.27,.33],right:[-.12,1.27,.33]},'blast','beamHero'),key(4.8,{...release,lean:.015},'blast','beamHero'),key(5.05,{...release,beam:0,charge:.05,power:.5},'recover','beamHero'),key(6.6,stance,'idle')]},
  hover:{duration:2.2,hold:true,keys:[key(0,stance,'float'),key(2.2,hover,'float')]},
  airborne:{duration:1.8,hold:true,keys:[key(0,stance,'float'),key(1.8,{...hover,twist:.22,left:[.35,1.40,.25],right:[-.32,1.30,.32]},'float')]},
  'charge-pose':{duration:1.5,hold:true,keys:[key(0,stance,'charge','chargeHero'),key(1.5,charged,'charge','chargeHero')]},
  'beam-pose':{duration:1.2,hold:true,keys:[key(0,stance,'idle','beamHero'),key(1.2,{...release,beam:0,charge:.2},'idle','beamHero')]},
};
Object.assign(SHOWCASE_MOVES,createStagedMoves({stance,guard,pivot,chamber,kick}));
// Monotone Hermite tangents carry velocity through ordinary pose keys. A repeated
// key naturally has zero velocity, retaining deliberate contact/anticipation holds.
function poseCurve(keys,i,time,k,j){
 const value=n=>j==null?keys[n].pose[k]:keys[n].pose[k][j];
 const slope=n=>{
  if(n<=0||n>=keys.length-1)return 0;
  const h0=keys[n].at-keys[n-1].at,h1=keys[n+1].at-keys[n].at;
  const d0=(value(n)-value(n-1))/h0,d1=(value(n+1)-value(n))/h1;
  if(d0*d1<=0)return 0;
  const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/d0+w1/d1);
 };
 const h=keys[i+1].at-keys[i].at,u=THREE.MathUtils.clamp((time-keys[i].at)/h,0,1),u2=u*u,u3=u2*u;
 const a=value(i),b=value(i+1);
 return THREE.MathUtils.clamp((2*u3-3*u2+1)*a+(u3-2*u2+u)*h*slope(i)+(-2*u3+3*u2)*b+(u3-u2)*h*slope(i+1),Math.min(a,b),Math.max(a,b));
}
// A finished somersault is the same pose as none: never unwind it during the next blend.
export const unwind=pose=>pose&&{...pose,flip:pose.flip-Math.round(pose.flip/(Math.PI*2))*Math.PI*2};
// Anime timing: a move into a contact accelerates all the way (slow wind-up, hard snap, no easing
// into the hit); a move out of a contact leaves fast and settles slowly. Everything else keeps the
// smooth curves. Poses without contacts (calm moves) are untouched.
const SNAP_IN=2.3,SETTLE_OUT=2.0;
export function samplePose(keys,time) {
 let i=0;while(i<keys.length-2&&time>=keys[i+1].at)i++;
 const a=keys[i],b=keys[i+1],span=b.at-a.at,linear=span>0?THREE.MathUtils.clamp((time-a.at)/span,0,1):1,u=THREE.MathUtils.smoothstep(time,a.at,b.at),pose={};
 const ha=a.pose.hitStop||0,hb=b.pose.hitStop||0,mode=span>.1&&hb>.5&&ha<.5?'in':span>.1&&ha>.5&&hb<.5?'out':null;
 const eased=mode==='in'?Math.pow(linear,SNAP_IN):mode==='out'?1-Math.pow(1-linear,SETTLE_OUT):linear;
 // Long free segments bulge sideways so hands travel on arcs, not straight lines.
 const arc=!mode&&span>.45?Math.sin(Math.PI*linear):0;
 for(const k of Object.keys(a.pose)){
  if(mode&&k!=='hitStop'&&!['beam','charge','power'].includes(k)){
   pose[k]=Array.isArray(a.pose[k])?a.pose[k].map((v,j)=>THREE.MathUtils.lerp(v,b.pose[k][j],eased)):THREE.MathUtils.lerp(a.pose[k],b.pose[k],eased);
  }
  else if(['power','charge','beam','hitStop','pivot','footControl','guard'].includes(k))pose[k]=THREE.MathUtils.lerp(a.pose[k],b.pose[k],u);
  else pose[k]=Array.isArray(a.pose[k])?a.pose[k].map((v,j)=>poseCurve(keys,i,time,k,j)):poseCurve(keys,i,time,k);
 }
 if(arc>0)for(const [side,sign] of [['left',1],['right',-1]]){
  if(!a.pose[side]||!b.pose[side])continue;
  const from=a.pose[side],to=b.pose[side],travel=Math.hypot(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
  if(travel>.12){const bulge=Math.min(.07,travel*.2)*arc;pose[side]=[pose[side][0]+sign*bulge*.7,pose[side][1]+bulge*.45,pose[side][2]+bulge*.25];}
 }
 return pose;
}
export class ShowcaseDirector {
  constructor(){this.revision=0;this.reset();}
  reset(){this.pose=null;this.practice('stance');}
  practice(id){
    id=id==='martial'?'stance':id;
    const move=SHOWCASE_MOVES[id];if(!move)return;
    this.from=unwind(this.pose);this.move=move;this.moveId=id;this.time=0;this.revision++;this.events=[];this.update(0);
  }
  seek(time){this.time=THREE.MathUtils.clamp(time,0,this.move.duration);this.update(0);}
  update(dt){
    const before=this.time;this.time=Math.min(this.move.duration,this.time+dt);
    this.events=[];
    this.cues=(this.move.cues||[]).filter(cue=>cue.at>before && cue.at<=this.time);
    this.events=this.cues.map(cue=>cue.type);
    this.pose=samplePose(this.move.keys,this.time);
    // Interruptions blend from the currently displayed pose, never pop back to neutral.
    if(this.from && this.time<.35){const u=THREE.MathUtils.smoothstep(this.time,0,.35);for(const k of Object.keys(this.pose))this.pose[k]=Array.isArray(this.pose[k])?this.pose[k].map((v,j)=>THREE.MathUtils.lerp(this.from[k][j],v,u)):THREE.MathUtils.lerp(this.from[k],this.pose[k],u);}
    if(this.from && this.time<.35){const u=THREE.MathUtils.smoothstep(this.time,0,.35),start=this.from.yaw||0;const raw=samplePose(this.move.keys,this.time).yaw;this.pose.yaw=THREE.MathUtils.lerp(start,start+Math.atan2(Math.sin(raw-start),Math.cos(raw-start)),u);}
    const follow=this.pose.hitStop>.99?this.pose:samplePose(this.move.keys,Math.max(0,this.time-.055));
    const head=this.pose.hitStop>.99?this.pose:samplePose(this.move.keys,Math.max(0,this.time-.095));
    this.pose.followTwist=follow.twist;this.pose.followLean=follow.lean;this.pose.headTwist=head.twist;
    if(this.from&&this.time<.35){const u=THREE.MathUtils.smoothstep(this.time,0,.35);for(const k of ['followTwist','followLean','headTwist'])this.pose[k]=THREE.MathUtils.lerp(this.from[k]??this.pose[k],this.pose[k],u);}
    const entry=[...this.move.keys].reverse().find(k=>this.time>=k.at)||this.move.keys[0];
    if(this.state!==entry.phase){this.revision++;this.state=entry.phase;}
    this.stage=entry.stage||entry.phase;
    this.shot=entry.shot;this.progress=this.time/this.move.duration;this.power=this.pose.power;
    const releaseCue=[...(this.move.cues||[])].reverse().find(c=>c.type==='release' && c.at<=this.time);
    this.signals={beamAge:releaseCue?this.time-releaseCue.at:0,charge:this.pose.charge,beam:this.pose.beam,release:this.events.includes('release'),surge:this.cues.find(c=>c.type==='surge'),impact:this.cues.find(c=>c.type==='impact'),landing:this.cues.find(c=>c.type==='landing'),trails:this.pose.trails};
  }
}
