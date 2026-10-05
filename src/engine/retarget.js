import * as THREE from 'three';

const bones = {
  'DEF-hips': 'hips', 'DEF-spine.001': 'spine', 'DEF-spine.002': 'chest',
  'DEF-spine.003': 'upperChest', 'DEF-neck': 'neck', 'DEF-head': 'head',
};
for (const [suffix, side] of [['L', 'left'], ['R', 'right']]) {
  for (const [source, target] of Object.entries({
    shoulder: 'Shoulder', upper_arm: 'UpperArm', forearm: 'LowerArm', hand: 'Hand',
    thigh: 'UpperLeg', shin: 'LowerLeg', foot: 'Foot', toe: 'Toes',
  })) bones[`DEF-${source}.${suffix}`] = side + target;
  for (const [finger, target] of Object.entries({ f_index: 'Index', f_middle: 'Middle', f_ring: 'Ring', f_pinky: 'Little', thumb: 'Thumb' })) {
    for (let i = 1; i <= 3; i++) {
      const part = finger === 'thumb' ? ['Metacarpal', 'Proximal', 'Distal'][i - 1] : ['Proximal', 'Intermediate', 'Distal'][i - 1];
      bones[`DEF-${finger}.0${i}.${suffix}`] = side + target + part;
    }
  }
}

// Rest-space retargeting onto VRM's normalized humanoid, preserving source clips.
// The source has a Z-up armature root, so hips translation must be transformed too.
export function retargetLibrary(asset, vrm) {
  asset.scene.updateMatrixWorld(true);
  const hips = asset.scene.getObjectByName('DEF-hips');
  const sourceHeight = hips.getWorldPosition(new THREE.Vector3()).y;
  const targetHips = vrm.humanoid.getNormalizedBoneNode('hips');
  const targetHeight = targetHips.getWorldPosition(new THREE.Vector3()).y;
  const ratio = targetHeight / sourceHeight;
  const origin = hips.getWorldPosition(new THREE.Vector3());
  return asset.animations.filter(clip => clip.name !== 'A_TPose').map(clip => {
    const tracks = [];
    for (const track of clip.tracks) {
      const split = track.name.lastIndexOf('.');
      const sourceName = track.name.slice(0, split), property = track.name.slice(split + 1);
      // GLTFLoader sanitizes dots in node names.
      const source = asset.scene.getObjectByName(sourceName);
      const boneName = bones[sourceName] || Object.entries(bones).find(([name]) => THREE.PropertyBinding.sanitizeNodeName(name) === sourceName)?.[1];
      const target = boneName && vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!source || !target) continue;
      if (property === 'quaternion') {
        const inverseRest = source.getWorldQuaternion(new THREE.Quaternion()).invert();
        const parentRest = source.parent.getWorldQuaternion(new THREE.Quaternion());
        const values = new Float32Array(track.values.length), q = new THREE.Quaternion();
        for (let i = 0; i < values.length; i += 4) {
          q.fromArray(track.values, i).premultiply(parentRest).multiply(inverseRest).normalize().toArray(values, i);
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(`${target.name}.quaternion`, track.times, values));
      } else if (property === 'position' && boneName === 'hips') {
        const values = new Float32Array(track.values.length), p = new THREE.Vector3();
        for (let i = 0; i < values.length; i += 3) {
          p.fromArray(track.values, i).applyMatrix4(source.parent.matrixWorld).sub(origin).multiplyScalar(ratio);
          // Remove forward locomotion; world movement belongs to scene choreography.
          p.set(0, p.y + targetHips.position.y, 0).toArray(values, i);
        }
        tracks.push(new THREE.VectorKeyframeTrack(`${target.name}.position`, track.times, values));
      }
    }
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  });
}


// Rest-space retargeting for externally imported GLBs with explicit humanoid mappings.
// Each asset keeps its own joint positions, bone axes, geometry and skin weights.
export function retargetHumanoidLibrary(asset, model, mapping) {
  asset.scene.updateMatrixWorld(true);model.updateMatrixWorld(true);
  const targetNode=role=>mapping[role] && model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(mapping[role]));
  const sourceHips=asset.scene.getObjectByName('DEF-hips'),targetHips=targetNode('hips');
  if(!sourceHips || !targetHips) throw new Error('Humanoid retargeting requires real mapped hip bones.');
  const origin=sourceHips.getWorldPosition(new THREE.Vector3());
  const ratio=targetHips.getWorldPosition(new THREE.Vector3()).y/origin.y;
  const hipRest=targetHips.position.clone();
  const targetParentInverse=targetHips.parent.matrixWorld.clone().invert();
  const targetOrigin=targetHips.getWorldPosition(new THREE.Vector3());
  // Establish matching reference directions (source T-pose versus imported A-pose).
  // Both Blender armatures use local +Y along each bone. Preserve roll, while
  // aligning reference directions so lowered source arms do not lower twice.
  const references=new Map();
  for(const [sourceName,role] of Object.entries(bones)) {
    const source=asset.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(sourceName)),target=targetNode(role);
    if(!source || !target) continue;
    const s=source.getWorldQuaternion(new THREE.Quaternion()),t=target.getWorldQuaternion(new THREE.Quaternion());
    const from=new THREE.Vector3(0,1,0).applyQuaternion(t),to=new THREE.Vector3(0,1,0).applyQuaternion(s);
    references.set(target,new THREE.Quaternion().setFromUnitVectors(from,to).multiply(t));
  }
  const clips=[];
  for(const clip of asset.animations.filter(c=>c.name!=='A_TPose')) {
    const tracks=[];
    for(const track of clip.tracks) {
      const split=track.name.lastIndexOf('.'),sourceName=track.name.slice(0,split),property=track.name.slice(split+1);
      const role=bones[sourceName] || Object.entries(bones).find(([name])=>THREE.PropertyBinding.sanitizeNodeName(name)===sourceName)?.[1];
      const source=asset.scene.getObjectByName(sourceName),target=targetNode(role);
      if(!source || !target) continue;
      if(property==='quaternion') {
        const sourceRestInverse=source.getWorldQuaternion(new THREE.Quaternion()).invert();
        const sourceParentRest=source.parent.getWorldQuaternion(new THREE.Quaternion());
        const targetRest=references.get(target) || target.getWorldQuaternion(new THREE.Quaternion());
        const targetParentRestInverse=(references.get(target.parent)?.clone() || target.parent.getWorldQuaternion(new THREE.Quaternion())).invert();
        const values=new Float32Array(track.values.length),q=new THREE.Quaternion();
        for(let i=0;i<values.length;i+=4) {
          q.fromArray(track.values,i).premultiply(sourceParentRest).multiply(sourceRestInverse).multiply(targetRest).premultiply(targetParentRestInverse).normalize().toArray(values,i);
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(target.name+'.quaternion',track.times,values));
      } else if(property==='position' && role==='hips') {
        const values=new Float32Array(track.values.length),v=new THREE.Vector3();
        for(let i=0;i<values.length;i+=3) {
          v.fromArray(track.values,i).applyMatrix4(source.parent.matrixWorld).sub(origin).multiplyScalar(ratio);
          v.set(0,v.y,0).add(targetOrigin).applyMatrix4(targetParentInverse);
          if(!Number.isFinite(v.y)) v.copy(hipRest);
          v.toArray(values,i);
        }
        tracks.push(new THREE.VectorKeyframeTrack(target.name+'.position',track.times,values));
      }
    }
    if(tracks.length) clips.push(new THREE.AnimationClip(clip.name,clip.duration,tracks));
  }
  return clips;
}
