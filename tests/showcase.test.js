import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {solveTwoBone} from '../src/engine/hero-rig-controls.js';
import {ShowcaseDirector,SHOWCASE_MOVES,samplePose} from '../src/engine/showcase-director.js';
function chain(){const root=new THREE.Group(),a=new THREE.Bone(),b=new THREE.Bone(),end=new THREE.Bone();root.add(a);a.add(b);b.add(end);b.position.y=1;end.position.y=1;root.rotation.set(.2,.3,-.1);root.scale.setScalar(.8);root.updateMatrixWorld(true);return {root,a,b,end};}
test('two-bone IK reaches a world target under transformed parents without stretching',()=>{
 const {a,b,end}=chain(),target=new THREE.Vector3(.7,.8,.35);solveTwoBone(a,b,end,target,new THREE.Vector3(0,0,2));
 assert.ok(end.getWorldPosition(new THREE.Vector3()).distanceTo(target)<1e-5);
 assert.equal(b.position.length(),1);assert.equal(end.position.length(),1);
});
test('IK clamps unreachable and zero-distance targets without invalid transforms',()=>{
 for(const target of [new THREE.Vector3(90,0,0),new THREE.Vector3()]){
 const {a,b,end}=chain();solveTwoBone(a,b,end,target,new THREE.Vector3(1,0,0));
 for(const bone of [a,b,end])assert.ok(bone.quaternion.toArray().every(Number.isFinite));
 assert.ok(end.getWorldPosition(new THREE.Vector3()).length()<=1.60001);
 }
});
test('beam cue fires exactly once, follows anticipation and survives a frame crossing',()=>{
 const d=new ShowcaseDirector();d.practice('blast');d.update(3.5);assert.equal(d.signals.release,false);d.update(.2);assert.equal(d.signals.release,true);assert.equal(d.state,'blast');d.update(.1);assert.equal(d.signals.release,false);
 d.update(10);assert.equal(d.signals.beam,0);assert.equal(d.state,'idle');
});
test('interruptions blend continuously, held poses remain stable and pause advances no timeline',()=>{
 const d=new ShowcaseDirector();d.practice('charge');d.update(3.4);const before=structuredClone(d.pose);d.practice('hover');assert.deepEqual(d.pose,before);d.update(2.2);const pose=structuredClone(d.pose);d.update(100);assert.deepEqual(d.pose,pose);d.update(0);assert.equal(d.signals.release,false);
});

test('VFX remain hidden during GLB loading; debris receives small transforms before becoming visible',async()=>{
 const {VFXDirector}=await import('../src/engine/vfx-director.js');const scene=new THREE.Scene(),fx=new VFXDirector(scene);
 assert.ok(scene.children.every(o=>!o.visible),'no uninitialized VFX may render while the asset loads');
 const actor={root:new THREE.Group(),anchor:(role,v=new THREE.Vector3())=>v.set(0,1,0),palm:()=>new THREE.Vector3(0,1,.3),energyDirection:()=>new THREE.Vector3(0,0,1)};
 const direction={power:1,state:'powerup',progress:.5,revision:1};
 fx.update(.016,1,actor,direction,{},.7,false);assert.equal(fx.debris.visible,true);
 const matrix=new THREE.Matrix4(),scale=new THREE.Vector3();
 for(let i=0;i<fx.debris.count;i++){fx.debris.getMatrixAt(i,matrix);scale.setFromMatrixScale(matrix);assert.ok(Math.max(scale.x,scale.y,scale.z)<.04);}
 fx.update(0,1,actor,direction,{},0,true);assert.ok(scene.children.every(o=>!o.visible),'neutral inspection hides all effect layers');
});

test('action cue order is independent of frame rate, never repeats while paused, and finishes cleanly',()=>{
 let reference;
 for(const dt of [1/30,1/60,1/120,.1,.15,.25]){
   const d=new ShowcaseDirector();d.practice('sequence');const cues=[];
   for(let elapsed=0;elapsed<10;elapsed+=dt){d.update(dt);cues.push(...d.cues.map(c=>[c.at,c.type,c.limb]));}
   if(reference)assert.deepEqual(cues,reference);else reference=cues;
   assert.equal(cues.length,7);assert.equal(d.state,'idle');assert.equal(d.pose.beam,0);assert.equal(d.progress,1);
   d.update(0);assert.equal(d.cues.length,0);
 }
});
test('seeking does not emit impact cues; impact holds are still; a completed turn blends by the shortest angle',()=>{
 const d=new ShowcaseDirector();d.practice('sequence');d.seek(3.03);const pose=structuredClone(d.pose);assert.equal(d.cues.length,0);d.seek(3.08);for(const key of Object.keys(pose)){const a=[pose[key]].flat(),b=[d.pose[key]].flat();a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-12));}
 d.seek(9.8);d.practice('stance');d.update(.175);assert.ok(Math.abs(Math.sin(d.pose.yaw/2))<1e-8,'interruption must not add a gratuitous 180-degree turn');
});
test('actual hero rig keeps its support foot planted through the spin and remains deterministic across poses',async()=>{
 const fs=await import('node:fs');const {HeroRigControls}=await import('../src/engine/hero-rig-controls.js');
 const definition=JSON.parse(fs.readFileSync('src/engine/hero-asset.json','utf8'));const bytes=fs.readFileSync('public'+definition.url);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const nodes=gltf.nodes.map(n=>{const b=new THREE.Bone();b.name=THREE.PropertyBinding.sanitizeNodeName(n.name||'');if(n.matrix)b.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));else{if(n.translation)b.position.fromArray(n.translation);if(n.rotation)b.quaternion.fromArray(n.rotation);if(n.scale)b.scale.fromArray(n.scale);}return b;});
 gltf.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
 const model=new THREE.Group();gltf.scenes[gltf.scene||0].nodes.forEach(i=>model.add(nodes[i]));model.scale.setScalar(2/2.3);
 const root=new THREE.Group();root.add(model);const actor={root,model,definition};const rig=new HeroRigControls(actor),keys=SHOWCASE_MOVES.sequence.keys;
 rig.apply(samplePose(keys,2.4),2.4,{});const planted=rig.bones.leftFoot.getWorldPosition(new THREE.Vector3());
 for(let time=2.4;time<=3.34;time+=.02){rig.apply(samplePose(keys,time),time,{});assert.ok(rig.bones.leftFoot.getWorldPosition(new THREE.Vector3()).distanceTo(planted)<.0001,'pivot support must not slide');}
 rig.apply(samplePose(keys,3.03),3.03,{});const tip=rig.bones.rightFoot.getWorldPosition(new THREE.Vector3());assert.ok(tip.y>.8,'kick must extend at torso height');
 const transforms=[...rig.rest.keys()].map(b=>b.quaternion.toArray());rig.apply(samplePose(keys,1.49),1.49,{});rig.apply(samplePose(keys,3.03),3.03,{});
 [...rig.rest.keys()].forEach((b,i)=>b.quaternion.toArray().forEach((v,j)=>assert.ok(Math.abs(v-transforms[i][j])<1e-8)));
});


test('root motion has deterministic fixed steps, bounded acceleration and gravity landings',async()=>{
 const {HeroMotionPhysics}=await import('../src/engine/hero-motion-physics.js');const results=[];
 for(const dt of [1/30,1/120]){
  const p=new HeroMotionPhysics();
  for(let i=0;i<Math.round(2/dt);i++)p.update(dt,{x:1.1,y:.5,z:-.3},true);
  for(let i=0;i<Math.round(2/dt);i++)p.update(dt,{x:1.1,y:0,z:-.3},false);
  results.push({...p.position});assert.equal(p.position.y,0);assert.equal(p.landings,1);assert.ok(Math.abs(p.velocity.x)<.001);
  for(let i=0;i<240;i++){p.impulse(100,0,-100);p.update(1/60,{x:99,y:0,z:-99});assert.ok(Math.abs(p.position.x)<=1.4&&Math.abs(p.position.z)<=1.4);}
 }
 for(const axis of ['x','y','z'])assert.ok(Math.abs(results[0][axis]-results[1][axis])<1e-9);
});
test('automatic training varies complete moves, settles after hover, stays bounded and can be interrupted',async()=>{
 const {FreestyleDirector}=await import('../src/engine/freestyle-director.js');const d=new FreestyleDirector(214);d.practice('freestyle');const moves=new Set();
 for(let i=0;i<180*60;i++){
  d.update(1/60,{energy:.5,beatStrength:0});moves.add(d.moveId);
  assert.ok(Object.values(d.pose).flat().every(Number.isFinite));assert.ok(Math.abs(d.pose.travel[0])<=1.4&&Math.abs(d.pose.travel[1])<=1.4);assert.ok(d.pose.lift>=0&&d.pose.lift<1);
 }
 assert.ok(moves.size>=5);assert.ok(d.history.every((id,i)=>!d.history.slice(Math.max(0,i-2),i).includes(id)));
 const paused=structuredClone(d.pose);d.update(0);assert.deepEqual(d.pose,paused);
 d.practice('blast');assert.equal(d.auto,false);d.update(3.7);assert.equal(d.signals.release,true);
 d.reset();assert.equal(d.auto,false);assert.equal(d.pose.lift,0);
});

test('beam travels outward, widens through release and tapers with the pose',async()=>{
 const {beamEnvelope}=await import('../src/engine/beam-envelope.js');let last=beamEnvelope(0);
 for(let t=.05;t<=1.3;t+=.05){const next=beamEnvelope(t);assert.ok(next.radius>=last.radius);assert.ok(next.length>last.length);last=next;}
 assert.ok(beamEnvelope(.1).radius<.4);assert.ok(beamEnvelope(1).radius>1.65);assert.ok(beamEnvelope(.4).length>10);
 assert.equal(beamEnvelope(1,.5).radius,beamEnvelope(1).radius*.5);assert.equal(beamEnvelope(1,0).radius,0);assert.deepEqual(beamEnvelope(.7),beamEnvelope(.7));
});


test('energy springs smooth a step, remain stable at low frame rates and converge equally',async()=>{
 const {EnergySpring}=await import('../src/engine/energy-motion.js');const results=[];
 for(const dt of [1/30,1/120,.25]){
  const spring=new EnergySpring();const first=spring.step(1,dt,11);assert.ok(first>0&&first<1);
  let previous=first;for(let i=1;i<Math.round(2/dt);i++){spring.step(1,dt,11);assert.ok(spring.value>=previous&&spring.value<=1);previous=spring.value;}
  results.push(spring.value);assert.ok(Math.abs(spring.value-1)<1e-6);
 }
 assert.ok(Math.max(...results)-Math.min(...results)<1e-10);
});
test('energy follows movement with bounded lag, freezes on pause and resets on seek',async()=>{
 const {EnergyMotion}=await import('../src/engine/energy-motion.js');const m=new EnergyMotion();m.update(0,0,.22,0,{x:0,y:0,z:0});
 for(let i=1;i<=60;i++)m.update(1/60,i/60,1,1,{x:i/60,y:0,z:0});
 assert.ok(m.wind.x<-.02&&m.wind.x>=-.14);const before=[m.power.value,m.charge.value,m.wind.x];m.update(0,1,0,0,{x:1,y:0,z:0},true);assert.deepEqual([m.power.value,m.charge.value,m.wind.x],before);
 for(let i=61;i<=180;i++)m.update(1/60,i/60,.22,0,{x:1,y:0,z:0});assert.ok(Math.abs(m.wind.x)<1e-6);assert.ok(m.charge.value<1e-6);
 m.reset();m.update(0,.6,.8,.5,{x:0,y:0,z:0},true);assert.equal(m.power.value,.8);assert.equal(m.charge.value,.5);assert.equal(m.wind.x,0);
});
test('beam deformation leaves its emitter anchored and never accumulates geometry drift',async()=>{
 const {deformBeam,beamSection}=await import('../src/engine/energy-motion.js');const geometry=new THREE.CylinderGeometry(.3,.18,1,48,32,true),rest=geometry.attributes.position.array.slice();
 deformBeam(geometry,2.4);const snapshot=geometry.attributes.position.array.slice();deformBeam(geometry,9);deformBeam(geometry,2.4);assert.deepEqual(geometry.attributes.position.array,snapshot);
 for(let i=0;i<rest.length;i+=3){assert.equal(snapshot[i+1],rest[i+1]);if(rest[i+1]===-.5){assert.equal(snapshot[i],rest[i]);assert.equal(snapshot[i+2],rest[i+2]);}}
 for(let t=0;t<20;t+=.2)for(let u=0;u<=1;u+=.05){const s=beamSection(u,t);assert.ok(Math.abs(s.x)<.019&&Math.abs(s.z)<.013);assert.ok(s.width>.95&&s.width<1.05);}
});


test('pose interpolation carries continuous velocity through ordinary keys without overshooting',()=>{
 const keys=[0,1,2,3].map((at,i)=>({at,pose:{twist:[0,.2,.5,.6][i],left:[i*.1,i*.2,i*.3]}}));
 const e=1e-4,a=samplePose(keys,1-e),b=samplePose(keys,1),c=samplePose(keys,1+e);
 const before=(b.twist-a.twist)/e,after=(c.twist-b.twist)/e;
 assert.ok(before>.15);assert.ok(Math.abs(before-after)<.001);
 for(let t=0;t<3;t+=.01){const i=Math.floor(t),p=samplePose(keys,t);assert.ok(p.twist>=keys[i].pose.twist&&p.twist<=keys[i+1].pose.twist);}
});


test('staged moves have complete finite poses and dispatch each cue once at different playback rates',()=>{
 const ids=['powerup','charge','blast','dash','strikes','heavy','flying','spin','hover','airborne','reaction','transformation'];
 for(const id of ids){
  const move=SHOWCASE_MOVES[id];assert.equal(move.duration,move.keys.at(-1).at);
  for(let i=0;i<move.keys.length;i++){assert.ok(move.keys[i].stage);if(i)assert.ok(move.keys[i].at>move.keys[i-1].at);}
  for(const dt of [1/30,1/120,.13]){
   const d=new ShowcaseDirector();d.practice(id);const cues=[];
   for(let t=0;t<move.duration+.5;t+=dt){d.update(dt);cues.push(...d.cues.map(c=>c.at));assert.ok(Object.values(d.pose).flat().every(Number.isFinite),id);}
   assert.deepEqual(cues,move.cues.map(c=>c.at));assert.equal(d.progress,1);
   const end=structuredClone(d.pose);d.update(0);assert.deepEqual(d.pose,end);assert.equal(d.cues.length,0);
  }
 }
});
