import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionLife} from '../src/engine/motion-life.js';
const pose=(o={})=>({crouch:.1,lean:0,twist:0,bank:0,headPitch:0,headYaw:0,shoulderLift:0,shoulderDrive:0,hipShift:[0,0],left:[.2,1.3,.4],right:[-.2,1.3,.3],hitStop:0,charge:0,beam:0,power:.2,tension:0,fist:0,...o});
test('life layer lags a torso turn behind the pose, settles on it, and never stops moving',()=>{
 const life=new MotionLife(3);life.apply(pose(),1/60,0);
 const first=life.apply(pose({twist:.5}),1/60,1/60);assert.ok(first.twist<.4,'torso must not arrive on the same frame');
 let t=2/60,p;for(let i=0;i<120;i++){p=life.apply(pose({twist:.5}),1/60,t);t+=1/60;}
 assert.ok(Math.abs(p.twist-.5)<.03,'settles near the authored turn');
 const q=life.apply(pose({twist:.5}),1/60,t);assert.notEqual(q.headYaw,p.headYaw);assert.ok(Math.abs(q.left[1]-p.left[1])<.01,'wobble is small');
});
test('contacts and energy hands snap to the authored pose; paused frames pass through',()=>{
 const life=new MotionLife(5);let t=0;for(let i=0;i<30;i++){life.apply(pose(),1/60,t);t+=1/60;}
 const hit=life.apply(pose({left:[.1,1.3,.6],hitStop:1}),1/60,t);assert.deepEqual(hit.left.map(v=>+v.toFixed(3)),[.1,1.3,.6]);
 const beam=life.apply(pose({left:[.07,1.28,.49],beam:1,charge:1,power:1}),1/60,t);assert.ok(Math.abs(beam.left[2]-.49)<.012);
 const same=pose();assert.strictEqual(life.apply(same,0,t),same);
});
test('rig keeps the hands apart and out of the torso',async()=>{
 const THREE=await import('three');const {HeroRigControls,solveTwoBone}=await import('../src/engine/hero-rig-controls.js');
 const fs=await import('node:fs');const definition=JSON.parse(fs.readFileSync('src/engine/hero-asset.json','utf8'));const bytes=fs.readFileSync('public'+definition.url);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const nodes=gltf.nodes.map(n=>{const b=new THREE.Bone();b.name=THREE.PropertyBinding.sanitizeNodeName(n.name||'');if(n.translation)b.position.fromArray(n.translation);if(n.rotation)b.quaternion.fromArray(n.rotation);if(n.scale)b.scale.fromArray(n.scale);return b;});
 gltf.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
 const model=new THREE.Group();gltf.scenes[gltf.scene||0].nodes.forEach(i=>model.add(nodes[i]));model.scale.setScalar(2/2.3);
 const root=new THREE.Group();root.add(model);const rig=new HeroRigControls({root,model,definition});
 const {SHOWCASE_MOVES,samplePose}=await import('../src/engine/showcase-director.js');
 const crossed={...samplePose(SHOWCASE_MOVES.strikes.keys,0),left:[-.02,1.3,.24],right:[.02,1.3,.24],hitStop:0};
 rig.apply(crossed,1,{});const d=rig.bones.leftHand.getWorldPosition(new THREE.Vector3()).distanceTo(rig.bones.rightHand.getWorldPosition(new THREE.Vector3()));
 assert.ok(d>.15,'hands pushed apart: '+d.toFixed(3));
 const inside={...crossed,left:[.05,1.3,.02],right:[-.3,1.3,.3]};rig.apply(inside,1,{});const hand=root.worldToLocal(rig.bones.leftHand.getWorldPosition(new THREE.Vector3()));
 const r=Math.hypot(hand.x/.21,(hand.z-.02)/.18);assert.ok(r>.95,'hand kept outside the torso: '+r.toFixed(2));
});
