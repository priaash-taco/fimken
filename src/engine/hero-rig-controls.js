import * as THREE from 'three';
const Y=new THREE.Vector3(0,1,0);
// Analytic two-bone IK: an explicit pole controls elbow/knee direction; unreachable
// targets are clamped instead of stretching the mesh or producing NaN rotations.
export function solveTwoBone(a,b,end,target,pole,weight=1){
  a.updateWorldMatrix(true,true);
  const origin=a.getWorldPosition(new THREE.Vector3()), middle=b.getWorldPosition(new THREE.Vector3()), tip=end.getWorldPosition(new THREE.Vector3());
  const l1=origin.distanceTo(middle),l2=middle.distanceTo(tip);
  if(l1<1e-6||l2<1e-6)return;
  const axis=target.clone().sub(origin),distance=THREE.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+1e-5,l1+l2-1e-5);
  if(axis.lengthSq()<1e-10)axis.set(0,0,1);axis.normalize();
  const bend=pole.clone().sub(origin).addScaledVector(axis,-pole.clone().sub(origin).dot(axis));
  if(bend.lengthSq()<1e-8)bend.crossVectors(axis,Math.abs(axis.y)<.9?Y:new THREE.Vector3(1,0,0));
  bend.normalize();
  const x=(l1*l1-l2*l2+distance*distance)/(2*distance),h=Math.sqrt(Math.max(0,l1*l1-x*x));
  const elbow=origin.clone().addScaledVector(axis,x).addScaledVector(bend,h);
  aimBone(a,b,elbow,weight);aimBone(b,end,origin.clone().addScaledVector(axis,distance),weight);
}
function aimBone(bone,child,target,weight){
  bone.updateWorldMatrix(true,true);
  const origin=bone.getWorldPosition(new THREE.Vector3());
  const delta=new THREE.Quaternion().setFromUnitVectors(child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize(),target.clone().sub(origin).normalize());
  const world=delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  const local=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world);
  bone.quaternion.slerp(local,weight);bone.updateWorldMatrix(false,true);
}
export class HeroRigControls {
  constructor(actor){
    this.actor=actor;this.bones={};this.rest=new Map();
    for(const [role,name]of Object.entries(actor.definition.bones||{})){
      const b=actor.model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
      if(b){this.bones[role]=b;this.rest.set(b,{q:b.quaternion.clone(),p:b.position.clone()});}
    }
    actor.root.updateMatrixWorld(true);
    this.footRotations={};for(const side of ['left','right'])this.footRotations[side]=actor.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(this.bones[side+'Foot'].getWorldQuaternion(new THREE.Quaternion()));
    this.feet={};for(const side of ['left','right'])this.feet[side]=actor.root.worldToLocal(this.bones[side+'Foot'].getWorldPosition(new THREE.Vector3()));
    // Finger chains with the axis each joint folds about, kept in the hand's own frame so a
    // curl always closes toward the palm whatever the wrist is doing.
    this.fingers={};
    for(const side of ['left','right']){
      const hand=this.bones[side+'Hand'];if(!hand)continue;
      const handInverse=hand.getWorldQuaternion(new THREE.Quaternion()).invert(),palm=new THREE.Vector3(side==='left'?-1:1,0,0).applyQuaternion(actor.root.getWorldQuaternion(new THREE.Quaternion())),chain=[];
      for(const finger of ['Thumb','Index','Middle','Ring','Pinky'])(finger==='Thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal']).forEach((part,i)=>{
        const bone=this.bones[side+finger+part];if(!bone)return;
        const from=bone.children[0]?bone:bone.parent,to=bone.children[0]||bone;
        const direction=to.getWorldPosition(new THREE.Vector3()).sub(from.getWorldPosition(new THREE.Vector3())).normalize();
        chain.push({bone,axis:direction.cross(palm).normalize().applyQuaternion(handInverse),angle:[.5,.8,.5][i]*(finger==='Thumb'?.6:1)});
      });
      this.fingers[side]=chain;
    }
    this.center=new THREE.Vector3();this.direction=new THREE.Vector3(0,0,1);
    actor.root.rotation.order='YXZ'; // pitch (flips, flight) happens about the hero's own side-to-side axis
  }
  rotate(role,x,y,z){
    const bone=this.bones[role];if(!bone)return;
    bone.updateWorldMatrix(true,false);
    const rootQ=this.actor.root.getWorldQuaternion(new THREE.Quaternion());
    const delta=rootQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z))).multiply(rootQ.invert());
    const q=delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
    bone.updateWorldMatrix(false,true);
  }
  apply(p,time,music){
    // Restore every controlled transform before composing the new pose: no frame-to-frame drift.
    for(const [b,r]of this.rest){b.quaternion.copy(r.q);b.position.copy(r.p);}
    const actor=this.actor,root=actor.root;
    const free=(1-(p.hitStop||0))*(1-(p.pivot||0)),idle=free*(1-p.charge);
    const breathing=Math.sin(time*2.2)*.008*free;
    const sway=Math.sin(time*1.65)*.012*idle;
    const hoverWeight=THREE.MathUtils.smoothstep(p.lift,0,.15);
    const tremor=Math.sin(time*19)*Math.sin(time*13)*.003*Math.max(p.tension||0,Math.max(0,p.power-.5))*(1-(p.hitStop||0));
    root.rotation.y=(actor.definition.facing||0)+(p.yaw||0);
    const pivot=this.feet.left.clone(),rotated=pivot.clone().applyAxisAngle(Y,p.yaw||0);
    root.position.x=(p.travel?.[0]||0)+(pivot.x-rotated.x)*(p.pivot||0);
    root.position.z=(p.travel?.[1]||0)+(pivot.z-rotated.z)*(p.pivot||0);
    root.position.y=p.lift+Math.sin(time*1.8)*.025*hoverWeight;
    // Somersault about the body's centre, a metre above the feet.
    const flip=p.flip||0;root.rotation.x=-flip;root.position.y+=1-Math.cos(flip);root.position.z+=Math.sin(flip)*Math.cos(root.rotation.y);root.position.x+=Math.sin(flip)*Math.sin(root.rotation.y);
    root.updateMatrixWorld(true);
    const hips=this.bones.hips;
    const hipWorld=hips.getWorldPosition(new THREE.Vector3());hipWorld.y-=p.crouch-breathing;
    // Weight and balance: when a foot lifts, the hips move over the planted one and the free
    // hip drops; a forward lean moves the hips back to stay over the feet. Grounded only.
    const grounded=1-hoverWeight,liftL=Math.max(0,(p.leftFoot?.[1]||0)-.02),liftR=Math.max(0,(p.rightFoot?.[1]||0)-.02);
    const support=THREE.MathUtils.clamp((liftL-liftR)*5,-1,1)*grounded;
    hipWorld.add(new THREE.Vector3((p.hipShift?.[0]||0)+sway-support*.045,0,(p.hipShift?.[1]||0)-p.lean*.05*grounded).applyQuaternion(root.quaternion));
    hips.position.copy(hips.parent.worldToLocal(hipWorld));
    this.rotate('hips',0,(p.hipYaw||0)+sway*.5,-sway*.6+support*.07);
    this.rotate('spine',p.lean*.45,p.twist*.4,(p.bank||0)*.4+sway*.4);
    this.rotate('chest',(p.followLean??p.lean)*.55+breathing*.5,(p.followTwist??p.twist)*.6,tremor+(p.bank||0)*.6+sway*.6);
    this.rotate('head',-p.lean*.25+breathing*.25+(p.headPitch||0),-(p.headTwist??p.twist)*.6+(p.headYaw||0),sway*.2);
    for(const side of ['left','right']){const sign=side==='left'?1:-1;this.rotate(side+'Shoulder',0,sign*((p[side][2]-.13)*.18+(p.shoulderDrive||0)),-sign*(p.charge*.04+Math.max(0,p[side][1]-1.15)*.10+(p.shoulderLift||0)));}
    root.updateMatrixWorld(true);
    // Hand targets with their idle drift, then two keep-outs: hands never pass through each
    // other, and never sink into the torso. Authored poses already respect both; the life
    // layer's lag and wobble can briefly push them over, so this catches that.
    const hands={};
    for(const side of ['left','right']){const sign=side==='left'?1:-1;const hand=new THREE.Vector3(...p[side]);hand.y+=breathing+tremor+Math.sin(time*1.9+sign*.65)*.008*idle;hand.z+=Math.sin(time*1.65+sign)*.008*idle;hands[side]=hand;}
    const apart=hands.left.clone().sub(hands.right),minimum=.18;
    if(apart.length()<minimum){const push=(minimum-apart.length())/2;if(apart.lengthSq()<1e-8)apart.set(1,0,0);apart.normalize();hands.left.addScaledVector(apart,push);hands.right.addScaledVector(apart,-push);}
    for(const hand of [hands.left,hands.right]){
      if(hand.y>.85&&hand.y<1.55){const dx=hand.x/.21,dz=(hand.z-.02)/.18,r=Math.hypot(dx,dz);if(r<1&&r>1e-6){hand.x=dx/r*.21;hand.z=.02+dz/r*.18;}}
    }
    for(const side of ['left','right']){
      const sign=side==='left'?1:-1;
      const foot=this.feet[side].clone();if(!p.footControl){foot.y+=(side==='left'?.09:.015)*hoverWeight;foot.z+=(side==='left'?.10:-.07)*hoverWeight;}
      if(p[side+'Foot'])foot.add(new THREE.Vector3(...p[side+'Foot']));
      solveTwoBone(this.bones[side+'UpperLeg'],this.bones[side+'LowerLeg'],this.bones[side+'Foot'],root.localToWorld(foot),root.localToWorld(p[side+'Knee']?new THREE.Vector3(...p[side+'Knee']):new THREE.Vector3(sign*.30,.55,1)));
      const footBone=this.bones[side+'Foot'];
      footBone.quaternion.copy(footBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion())).multiply(this.footRotations[side]));
      if(p[side+'Ankle'])footBone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...p[side+'Ankle'])));
      const hand=hands[side];
      const pole=root.localToWorld(new THREE.Vector3(...(p[side+'Elbow']||[sign*.85,1.02,.45])));
      solveTwoBone(this.bones[side+'UpperArm'],this.bones[side+'LowerArm'],this.bones[side+'Hand'],root.localToWorld(hand),pole);
      // The source has wrist bones but no finger joints. Orient the existing hand
      // geometry toward the energy center; never pretend to articulate fingers.
      const wrist=this.bones[side+'Hand'];
      const direction=new THREE.Vector3(sign*.25,-1,.1).normalize();
      direction.lerp(new THREE.Vector3(0,.85,.35).normalize(),p.guard||0).normalize();
      const cup=new THREE.Vector3(-sign*.45,side==='left'?.5:-.5,.8).normalize();
      direction.lerp(cup,THREE.MathUtils.smoothstep(p.charge,0,.30)).normalize();
      direction.applyQuaternion(root.quaternion);
      const current=wrist.getWorldQuaternion(new THREE.Quaternion());
      // The hand stays in line with the forearm and only bends at the wrist within a human
      // range. Aiming it freely made the rigid fingers and thumb swing around the arm.
      const along=Y.clone().applyQuaternion(current),bend=along.angleTo(direction),limit=THREE.MathUtils.lerp(.3,.7,THREE.MathUtils.smoothstep(p.charge,0,.30));
      const axis=along.clone().cross(direction);
      const q=(axis.lengthSq()<1e-8?new THREE.Quaternion():new THREE.Quaternion().setFromAxisAngle(axis.normalize(),Math.min(bend,limit))).multiply(current);
      wrist.quaternion.copy(wrist.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
      // Fist: fold each finger joint about its knuckle axis. The fingers are fused in the
      // mesh, so they close together; individual fingers are not posed.
      const curl=p.fist||0;
      if(curl>.001&&this.fingers[side]?.length){wrist.updateWorldMatrix(true,true);const handQ=wrist.getWorldQuaternion(new THREE.Quaternion());
        for(const joint of this.fingers[side]){
          const turn=new THREE.Quaternion().setFromAxisAngle(joint.axis.clone().applyQuaternion(handQ),joint.angle*curl).multiply(joint.bone.getWorldQuaternion(new THREE.Quaternion()));
          joint.bone.quaternion.copy(joint.bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(turn));joint.bone.updateWorldMatrix(false,true);
        }}
    }
    root.updateMatrixWorld(true);
    this.center.copy(this.bones.leftHand.getWorldPosition(new THREE.Vector3())).add(this.bones.rightHand.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
    // Aimed slightly down, so the beam meets the ground in the distance.
    this.direction.set(0,-.03,1).applyQuaternion(root.quaternion).normalize();
    this.center.addScaledVector(this.direction,.065);
  }
}
