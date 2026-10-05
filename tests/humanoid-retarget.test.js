import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {retargetHumanoidLibrary} from '../src/engine/retarget.js';
test('rest-space GLB retargeting aligns different bind-pose directions without changing rig proportions',()=>{
 const source=new THREE.Group(),hips=new THREE.Bone(),arm=new THREE.Bone();hips.name='DEF-hips';hips.position.y=1;arm.name='DEF-upper_armL';arm.rotation.z=.4;hips.add(arm);source.add(hips);
 const target=new THREE.Group(),tHips=new THREE.Bone(),tArm=new THREE.Bone();tHips.name='hips';tHips.position.y=1.2;tArm.name='upperarmL';tArm.rotation.x=.7;tHips.add(tArm);target.add(tHips);
 const rest=tArm.quaternion.clone();
 const clip=new THREE.AnimationClip('Rest',1,[new THREE.QuaternionKeyframeTrack(arm.name+'.quaternion',[0,1],[...arm.quaternion.toArray(),...arm.quaternion.toArray()]),new THREE.VectorKeyframeTrack('DEF-hips.position',[0,1],[0,1,0,0,1.1,0])]);
 const result=retargetHumanoidLibrary({scene:source,animations:[clip]},target,{hips:'hips',leftUpperArm:'upperarm.L'});
 const q=new THREE.Quaternion().fromArray(result[0].tracks[0].values);assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(q).distanceTo(new THREE.Vector3(0,1,0).applyQuaternion(arm.quaternion))<1e-6);
 assert.ok(Math.abs(result[0].tracks[1].values[4]-1.32)<1e-6);
 assert.ok(tArm.quaternion.angleTo(rest)<1e-6);assert.equal(tHips.position.y,1.2);
});
