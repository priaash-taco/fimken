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
  solveLeg(side,foot,p){
    const root=this.actor.root,sign=side==='left'?1:-1;
    solveTwoBone(this.bones[side+'UpperLeg'],this.bones[side+'LowerLeg'],this.bones[side+'Foot'],root.localToWorld(foot.clone()),root.localToWorld(p[side+'Knee']?new THREE.Vector3(...p[side+'Knee']):new THREE.Vector3(sign*.30,.55,1)));
    const footBone=this.bones[side+'Foot'];
    footBone.quaternion.copy(footBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion())).multiply(this.footRotations[side]));
    if(p[side+'Ankle'])footBone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...p[side+'Ankle'])));
    footBone.updateWorldMatrix(true,true);
  }
  // Pushes the hand and foot targets (root space) apart from each other and from the body.
  separateLimbs(p,hands,feet){
    const root=this.actor.root,at=name=>root.worldToLocal(this.bones[name].getWorldPosition(new THREE.Vector3()));
    const seg=(a,b,r)=>({a:at(a),b:at(b),r});
    const closest=(a0,a1,b0,b1)=>{const d1=a1.clone().sub(a0),d2=b1.clone().sub(b0),r=a0.clone().sub(b0);const A=Math.max(d1.dot(d1),1e-9),E=Math.max(d2.dot(d2),1e-9),F=d2.dot(r),B=d1.dot(d2),C=d1.dot(r),den=A*E-B*B;
      let sN=den>1e-9?THREE.MathUtils.clamp((B*F-C*E)/den,0,1):0;let tN=THREE.MathUtils.clamp((B*sN+F)/E,0,1);sN=THREE.MathUtils.clamp((B*tN-C)/A,0,1);return [a0.clone().addScaledVector(d1,sN),b0.clone().addScaledVector(d2,tN)];};
    const strikeL=(p.trails?.[0]||0)>.5,strikeR=(p.trails?.[1]||0)>.5,kick=(p.trails?.[2]||0)>.5;
    const shape={left:this.fitHand('left'),right:this.fitHand('right')};
    const torso=seg('hips','neck',.19),head={c:at('head').add(new THREE.Vector3(0,.09,0)),r:.12};
    const limb={};
    for(const side of ['left','right']){limb[side]={forearm:seg(side+'LowerArm',side+'Hand',.05),upperArm:seg(side+'UpperArm',side+'LowerArm',.06),thigh:seg(side+'UpperLeg',side+'LowerLeg',.09),shin:seg(side+'LowerLeg',side+'Foot',.07),hand:{c:hands[side].clone().add(shape[side].offset),r:shape[side].radius}};}
    // Push `target` so the segment or sphere `mine` clears `other` by their radii.
    const clear=(target,mine,other,weight=1)=>{if(weight<=0)return;let pa,pb;
      if(mine.c)pa=mine.c.clone();else pa=null;
      if(mine.c&&other.c){pa=mine.c.clone();pb=other.c.clone();}
      else if(mine.c){[pb,pa]=closest(other.a,other.b,mine.c,mine.c);}
      else if(other.c){[pa,pb]=closest(mine.a,mine.b,other.c,other.c);}
      else [pa,pb]=closest(mine.a,mine.b,other.a,other.b);
      const gap=pa.clone().sub(pb),minimum=mine.r+other.r;if(gap.length()>=minimum)return;
      if(gap.lengthSq()<1e-8)gap.set(0,0,1);const deficit=minimum-gap.length();gap.normalize();target.addScaledVector(gap,deficit*weight);
      if(this.debugSeparate)this.debugSeparate.push({mine:mine.c?'sphere':'seg',other:other.c?'sphere':'seg',pa:pa.toArray().map(x=>+x.toFixed(2)),pb:pb.toArray().map(x=>+x.toFixed(2)),deficit:+deficit.toFixed(3),weight});};
    const rebuild=()=>{for(const side of ['left','right'])limb[side].hand.c=hands[side].clone().add(shape[side].offset);};
    for(let pass=0;pass<2;pass++){
      for(const side of ['left','right']){const other=side==='left'?'right':'left',L=limb[side],O=limb[other];
        const keepHand=(side==='left'?strikeL:strikeR)&&!(side==='left'?strikeR:strikeL),handW=keepHand?0:(side==='left'?strikeL:strikeR)===(side==='left'?strikeR:strikeL)?.5:1;
        // Hands and forearms: off the torso, the head, the thighs, and the other arm.
        clear(hands[side],L.hand,torso,handW||1);clear(hands[side],L.forearm,torso,handW||1);
        clear(hands[side],L.hand,head,handW||1);clear(hands[side],L.forearm,head,handW||1);
        for(const leg of ['left','right']){clear(hands[side],L.hand,limb[leg].thigh,handW||1);clear(hands[side],L.forearm,limb[leg].thigh,handW||1);}
        clear(hands[side],L.hand,O.hand,handW);clear(hands[side],L.hand,O.forearm,handW);clear(hands[side],L.forearm,O.forearm,handW);clear(hands[side],L.forearm,O.upperArm,handW);
        rebuild();
        // Legs: the free (lifted) leg gives way to the planted one; a kicking foot keeps its mark.
        const lifted=(p[side+'Foot']?.[1]||0)>(p[other+'Foot']?.[1]||0),footW=kick&&lifted?0:lifted?1:.3;
        clear(feet[side],L.shin,O.shin,footW);clear(feet[side],L.shin,O.thigh,footW);clear(feet[side],L.thigh,O.thigh,footW*.5);
        clear(feet[side],{c:feet[side].clone(),r:.08},{c:feet[other].clone(),r:.08},footW);
      }
    }
  }
  // Arm IK, wrist aim within a human bend, and the fist curl, for one hand target in root space.
  solveArm(side,hand,p){
    const root=this.actor.root,sign=side==='left'?1:-1;
    const pole=root.localToWorld(new THREE.Vector3(...(p[side+'Elbow']||[sign*.85,1.02,.45])));
    solveTwoBone(this.bones[side+'UpperArm'],this.bones[side+'LowerArm'],this.bones[side+'Hand'],root.localToWorld(hand.clone()),pole);
    // Orient the existing hand geometry toward the energy centre; fingers only curl as a group.
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
    wrist.updateWorldMatrix(true,true);
    if(curl>.001&&this.fingers[side]?.length){const handQ=wrist.getWorldQuaternion(new THREE.Quaternion());
      for(const joint of this.fingers[side]){
        const turn=new THREE.Quaternion().setFromAxisAngle(joint.axis.clone().applyQuaternion(handQ),joint.angle*curl).multiply(joint.bone.getWorldQuaternion(new THREE.Quaternion()));
        joint.bone.quaternion.copy(joint.bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(turn));joint.bone.updateWorldMatrix(false,true);
      }}
  }
  // A sphere around the posed hand: centre offset from the wrist and radius, in root space.
  fitHand(side){
    const root=this.actor.root,wrist=this.bones[side+'Hand'];
    const points=[wrist,...['Index','Middle','Ring','Pinky','Thumb'].map(f=>this.bones[side+f+'Distal']).filter(Boolean)].map(b=>root.worldToLocal(b.getWorldPosition(new THREE.Vector3())));
    const mid=points.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/points.length);
    return {offset:mid.clone().sub(points[0]),radius:THREE.MathUtils.clamp(Math.max(...points.map(q=>q.distanceTo(mid)))+.045,.09,.16)};
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
    // Squash and stretch (applied after every solve, see the end of apply): compress with crouch depth, stretch with vertical speed.
    const dtSS=this.lastTime==null?0:Math.min(.1,Math.max(0,time-this.lastTime));this.lastTime=time;
    const vy=dtSS>0?(p.lift-(this.lastLift??p.lift))/dtSS:0;this.lastLift=p.lift;
    this.stretch=THREE.MathUtils.damp(this.stretch||0,THREE.MathUtils.clamp(vy*.018-p.crouch*.16,-.075,.06),14,Math.max(dtSS,1e-3));
    root.scale.set(1,1,1);
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
    // Hand targets with their idle drift. Authored poses keep the hands clear of each other and
    // the body; the life layer's lag and wobble can briefly push them over, so a keep-out
    // follows: solve the arms once, fit a sphere to each hand's wrist and fingertips as posed,
    // push the spheres apart and out of the torso, then solve again. Same input, same output.
    const hands={},feet={};
    for(const side of ['left','right']){const sign=side==='left'?1:-1;const hand=new THREE.Vector3(...p[side]);hand.y+=breathing+tremor+Math.sin(time*1.9+sign*.65)*.008*idle;hand.z+=Math.sin(time*1.65+sign)*.008*idle;hands[side]=hand;
      const foot=this.feet[side].clone();if(!p.footControl){foot.y+=(side==='left'?.09:.015)*hoverWeight;foot.z+=(side==='left'?.10:-.07)*hoverWeight;}
      if(p[side+'Foot'])foot.add(new THREE.Vector3(...p[side+'Foot']));feet[side]=foot;}
    // Self-collision: solve every limb once, build capsules from the posed bones, push the
    // hand and foot targets until no limb overlaps another or the body, then solve again.
    // Stateless, so the same pose always gives the same result.
    for(const side of ['left','right']){this.solveLeg(side,feet[side],p,hoverWeight);this.solveArm(side,hands[side],p);}
    this.separateLimbs(p,hands,feet);
    for(const side of ['left','right']){this.solveLeg(side,feet[side],p,hoverWeight);this.solveArm(side,hands[side],p);}
    // Squash and stretch last, so IK never sees a skewed root. The root shifts so the support foot
    // (or the point between both feet) stays exactly where the unscaled pose put it.
    {const sy=1+this.stretch,sxz=1/Math.sqrt(sy),anchor=(p.pivot||0)>.5?this.feet.left:this.feet.left.clone().add(this.feet.right).multiplyScalar(.5);
     root.scale.set(sxz,sy,sxz);root.position.add(new THREE.Vector3(anchor.x*(1-sxz),anchor.y*(1-sy),anchor.z*(1-sxz)).applyAxisAngle(Y,root.rotation.y));}
    root.updateMatrixWorld(true);
    this.center.copy(this.bones.leftHand.getWorldPosition(new THREE.Vector3())).add(this.bones.rightHand.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
    // Aimed slightly down, so the beam meets the ground in the distance.
    this.direction.set(0,-.03,1).applyQuaternion(root.quaternion).normalize();
    this.center.addScaledVector(this.direction,.065);
  }
}
