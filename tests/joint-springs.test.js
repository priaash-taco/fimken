import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {JointSprings,MAX_LAG} from '../src/engine/joint-springs.js';
function rig(){
  const root=new THREE.Group(),hips=new THREE.Bone(),spine=new THREE.Bone(),head=new THREE.Bone();
  root.add(hips);hips.add(spine);spine.position.y=.3;spine.add(head);head.position.y=.4;
  const bones={hips,spine,head},rest=new Map();for(const b of Object.values(bones))rest.set(b,{q:b.quaternion.clone(),p:b.position.clone()});
  return {actor:{root},bones,rest};
}
const pose=(o={})=>({hitStop:0,charge:0,beam:0,trails:[0,0,0],...o});
const turn=(b,a)=>b.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),a);
test('converges to the target within 0.3 s',()=>{
  const r=rig(),js=new JointSprings(r);turn(r.bones.spine,0);js.apply(1/60,pose(),r);
  let q;for(let i=0;i<18;i++){turn(r.bones.spine,.5);js.apply(1/60,pose(),r);q=r.bones.spine.quaternion.clone();}
  assert.ok(q.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.5))<.03);
});
test('dt 0 passes the solved pose through',()=>{
  const r=rig(),js=new JointSprings(r);turn(r.bones.spine,0);js.apply(1/60,pose(),r);
  turn(r.bones.spine,.5);js.apply(0,pose(),r);assert.ok(Math.abs(r.bones.spine.quaternion.angleTo(new THREE.Quaternion())-.5)<1e-6);
});
test('hitStop snaps; first frame snaps',()=>{
  const r=rig(),js=new JointSprings(r);turn(r.bones.spine,.4);js.apply(1/60,pose(),r);assert.ok(Math.abs(r.bones.spine.quaternion.angleTo(new THREE.Quaternion())-.4)<1e-6);
  turn(r.bones.spine,-.6);js.apply(1/60,pose({hitStop:1}),r);assert.ok(Math.abs(r.bones.spine.quaternion.angleTo(new THREE.Quaternion())-.6)<1e-6);
});
test('lag never exceeds the clamp, and overshoot stays small',()=>{
  const r=rig(),js=new JointSprings(r);turn(r.bones.head,0);js.apply(1/60,pose(),r);
  let worst=0,a=0;for(let i=0;i<120;i++){a+=.15;turn(r.bones.head,a);const t=r.bones.head.quaternion.clone();js.apply(1/60,pose(),r);worst=Math.max(worst,r.bones.head.quaternion.angleTo(t));}
  assert.ok(worst<=MAX_LAG+1e-6,'lag '+worst);
  const r2=rig(),j2=new JointSprings(r2);turn(r2.bones.head,0);j2.apply(1/60,pose(),r2);let peak=0;
  for(let i=0;i<90;i++){turn(r2.bones.head,.3);j2.apply(1/60,pose(),r2);peak=Math.max(peak,r2.bones.head.quaternion.angleTo(new THREE.Quaternion()));}
  assert.ok(peak<.3*1.1);
});
