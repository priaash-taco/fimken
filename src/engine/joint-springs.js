import * as THREE from 'three';
// Post-IK joint layer: every controlled bone eases toward the rotation the rig just solved,
// with a small overshoot, instead of snapping to it. Elbows and knees also never lock straight.
// Runs after HeroRigControls.apply and before the matrices are refreshed. Fingers are left alone.
//
// Tuning (all constants live here):
//  FREQ        natural frequency (rad/s) per stiffness group; higher is stiffer and faster
//  DAMPING     damping ratio; .8 gives about 1.5% overshoot
//  MAX_LAG     largest angle (rad) a bone may trail its target, so limbs never fall far behind
//  SUB_STEP    integration step, same 240 Hz as motion-life.js
//  SOFT_START  interior joint angle (deg) where the soft limit starts compressing
//  SOFT_MAX    interior joint angle (deg) a fully straight limb is eased back to
export const FREQ={hips:90,torso:30,head:22,shoulder:20,arm:16,leg:100};
export const DAMPING=.8;
export const MAX_LAG=THREE.MathUtils.degToRad(12);
export const SUB_STEP=1/240;
export const SOFT_START=166;
export const SOFT_MAX=172;
const LEGS=[['leftUpperLeg','leftLowerLeg','leftFoot'],['rightUpperLeg','rightLowerLeg','rightFoot']];
const FINGER=/(Thumb|Index|Middle|Ring|Pinky|Little)/;
const groupOf=role=>{
  if(FINGER.test(role))return null;
  if(/^hips$/i.test(role))return 'hips';
  if(/^(spine|chest|upperChest)$/i.test(role))return 'torso';
  if(/^(neck|head)$/i.test(role))return 'head';
  if(/Shoulder$/.test(role))return 'shoulder';
  if(/(UpperArm|LowerArm|Hand)$/.test(role))return 'arm';
  if(/(UpperLeg|LowerLeg|Foot|Toes?)$/.test(role))return 'leg';
  return 'torso';
};
const JOINTS=[['leftUpperArm','leftLowerArm','leftHand'],['rightUpperArm','rightLowerArm','rightHand'],['leftUpperLeg','leftLowerLeg','leftFoot'],['rightUpperLeg','rightLowerLeg','rightFoot']];
const tq=new THREE.Quaternion(),tq2=new THREE.Quaternion(),tv=new THREE.Vector3(),va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),vn=new THREE.Vector3(),ve=new THREE.Vector3(),vf=new THREE.Vector3();
// Rotation vector (axis * angle, shortest way) of a quaternion.
function rotVec(q,out){
  let {x,y,z,w}=q;if(w<0){x=-x;y=-y;z=-z;w=-w;}
  const s=Math.hypot(x,y,z);if(s<1e-9)return out.set(0,0,0);
  const a=2*Math.atan2(s,w);return out.set(x,y,z).multiplyScalar(a/s);
}
function fromVec(v,out){
  const a=v.length();if(a<1e-9)return out.identity();
  return out.setFromAxisAngle(tv.copy(v).multiplyScalar(1/a),a);
}
export class JointSprings{
  constructor(rigControls){
    this.rig=rigControls;this.states=new Map();
    const role=new Map();for(const [r,b] of Object.entries(rigControls.bones))role.set(b,r);
    for(const [bone] of rigControls.rest){
      const r=role.get(bone);if(!r)continue;const g=groupOf(r);if(!g)continue;
      this.states.set(bone,{role:r,group:g,w:FREQ[g],q:bone.quaternion.clone(),v:new THREE.Vector3(),started:false});
    }
  }
  reset(){for(const s of this.states.values()){s.started=false;s.v.set(0,0,0);}}
  // Sides whose arm chain must stay exactly on the solved pose.
  exempt(pose){
    const e={all:(pose.hitStop||0)>.5,left:false,right:false};
    const energy=(pose.charge||0)>.5||(pose.beam||0)>.5;
    e.left=energy||(pose.trails?.[0]||0)>.5;e.right=energy||(pose.trails?.[1]||0)>.5;
    return e;
  }
  apply(dt,pose,rig=this.rig){
    if(!(dt>0)||!pose)return;
    const ex=this.exempt(pose),ids=Math.min(dt,.1);
    // Remember where the solve put each ankle: a lagging hip or thigh must not drag a planted foot.
    const root=this.rig.actor?.root;if(root)root.updateMatrixWorld(true);
    const pins=LEGS.map(([u,l,e])=>{const b=this.rig.bones[e];return b&&this.rig.bones[u]&&this.rig.bones[l]?{p:b.getWorldPosition(new THREE.Vector3()),q:b.getWorldQuaternion(new THREE.Quaternion())}:null;});
    for(const [bone,s] of this.states){
      const target=bone.quaternion;
      const side=s.role.startsWith('left')?'left':s.role.startsWith('right')?'right':null;
      const snap=!s.started||ex.all||(side&&s.group!=='leg'&&s.group!=='torso'&&s.group!=='head'&&ex[side]);
      if(snap){s.q.copy(target);s.v.set(0,0,0);s.started=true;continue;}
      const k=s.w*s.w,c=2*DAMPING*s.w;
      let t=ids;
      while(t>1e-9){
        const h=Math.min(t,SUB_STEP);t-=h;
        rotVec(tq.copy(target).multiply(tq2.copy(s.q).invert()),vn);// world-ish error rotation (left-multiplied)
        s.v.addScaledVector(vn,k*h).addScaledVector(s.v,-c*h);
        fromVec(vc.copy(s.v).multiplyScalar(h),tq);s.q.premultiply(tq).normalize();
      }
      // Never trail the target by more than MAX_LAG.
      const lag=s.q.angleTo(target);
      if(lag>MAX_LAG){s.q.slerp(target,1-MAX_LAG/lag);s.v.multiplyScalar(.5);}
      bone.quaternion.copy(s.q);
    }
    for(let i=0;i<LEGS.length;i++)if(pins[i])this.pinLeg(LEGS[i],pins[i]);
    this.softLimits(ex);
  }
  // Two-bone solve of one leg back onto its recorded ankle position and orientation, keeping the knee on its current side.
  pinLeg([u,l,e],pin){
    const upper=this.rig.bones[u],lower=this.rig.bones[l],foot=this.rig.bones[e];
    upper.updateWorldMatrix(true,true);
    const H=upper.getWorldPosition(va),K=lower.getWorldPosition(vb),F=foot.getWorldPosition(vc);
    const l1=K.distanceTo(H),l2=F.distanceTo(K);if(l1<1e-4||l2<1e-4)return;
    const to=ve.copy(pin.p).sub(H);const d=THREE.MathUtils.clamp(to.length(),Math.abs(l1-l2)+1e-3,l1+l2-1e-3);
    if(to.lengthSq()<1e-10)return;to.normalize();
    vf.copy(K).sub(H);vf.addScaledVector(to,-vf.dot(to));if(vf.lengthSq()<1e-10)return;vf.normalize();
    const a=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-a*a));
    const knee=tv.copy(H).addScaledVector(to,a).addScaledVector(vf,h);
    this.aim(upper,K.clone().sub(H),knee.clone().sub(H));
    lower.updateWorldMatrix(true,true);
    const K2=lower.getWorldPosition(va),F2=foot.getWorldPosition(vb);
    this.aim(lower,F2.sub(K2),ve.copy(pin.p).sub(K2));
    foot.updateWorldMatrix(true,true);
    foot.parent.getWorldQuaternion(tq2).invert();foot.quaternion.copy(tq2.multiply(pin.q));foot.updateWorldMatrix(false,true);
  }
  aim(bone,from,to){
    if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)return;
    tq.setFromUnitVectors(from.normalize(),to.normalize());bone.getWorldQuaternion(tq2);tq.multiply(tq2);
    bone.parent.getWorldQuaternion(tq2).invert();bone.quaternion.copy(tq2.multiply(tq));bone.updateWorldMatrix(false,true);
  }
  // Elbows and knees: compress the interior angle so a straight limb settles at SOFT_MAX.
  softLimits(ex){
    const root=this.rig.actor?.root;if(root)root.updateMatrixWorld(true);
    for(let i=0;i<JOINTS.length;i++){
      const [u,l,e]=JOINTS[i];const side=i%2?'right':'left';
      if(i<2&&(ex.all||ex[side]))continue;
      const upper=this.rig.bones[u],lower=this.rig.bones[l],end=this.rig.bones[e];if(!upper||!lower||!end)continue;
      upper.getWorldPosition(va);lower.getWorldPosition(vb);end.getWorldPosition(vc);
      const E=ve.copy(vc);vc.sub(vb);vb.sub(va);if(vb.lengthSq()<1e-10||vc.lengthSq()<1e-10)continue;
      vb.normalize();vc.normalize();
      const interior=180-THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(vb.dot(vc),-1,1)));
      if(interior<=SOFT_START)continue;
      const eased=SOFT_START+(Math.min(interior,180)-SOFT_START)*(SOFT_MAX-SOFT_START)/(180-SOFT_START);
      const add=THREE.MathUtils.degToRad(interior-eased);
      // Bend direction: the existing hinge, or outward for arms and forward for legs when the limb is dead straight.
      vn.crossVectors(vb,vc);
      if(vn.length()<.035){if(root)root.getWorldQuaternion(tq);if(i<2)vf.set(i?-1:1,-.6,-.2);else vf.set(0,0,1);vf.applyQuaternion(tq);vn.crossVectors(vb,vf);if(vn.lengthSq()<1e-8)continue;}
      vn.normalize();
      // Rotating the lower segment about a x b opens the deflection, i.e. bends the joint.
      lower.getWorldQuaternion(tq2);tq.setFromAxisAngle(vn,add).multiply(tq2);
      lower.parent.getWorldQuaternion(tq2).invert();lower.quaternion.copy(tq2.multiply(tq));
      lower.updateMatrixWorld(true);
      // Swing the upper segment about its own joint so the hand or foot stays where the solve put it.
      end.getWorldPosition(vc);upper.getWorldPosition(va);vc.sub(va);vb.copy(E).sub(va);
      if(vc.lengthSq()>1e-10&&vb.lengthSq()>1e-10){
        tq.setFromUnitVectors(vc.normalize(),vb.normalize());upper.getWorldQuaternion(tq2);tq.multiply(tq2);
        upper.parent.getWorldQuaternion(tq2).invert();upper.quaternion.copy(tq2.multiply(tq));upper.updateMatrixWorld(true);
      }
    }
  }
}
