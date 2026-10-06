import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { HeroRigControls } from './hero-rig-controls.js';
import { HeroFinish } from './hero-finish.js';
import { AnimationDirector } from './animation-director.js';
import { CharacterLook } from './character-look.js';
import { retargetLibrary, retargetHumanoidLibrary } from './retarget.js';
import { MotionLife } from './motion-life.js';

export class CharacterController {
  constructor(definition) {
    this.definition = definition;
    this.root = new THREE.Group();
    this.root.name = 'Cinematic actor';
    this.power = { value: 0 };
    this.outlines = []; 
    this.ready = this.load();
  }
  async load() {
    if (!this.definition.url) { this.clipCount = 0; return this; }
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    const asset = await loader.loadAsync(this.definition.url);
    this.vrm = asset.userData.vrm;
    this.model = asset.scene;
    this.model.updateMatrixWorld(true);
    let skinned = 0;
    const surfaces = [];
    const ramp = new THREE.DataTexture(new Uint8Array([85, 85, 85, 255, 150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]), 4, 1);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
    this.model.traverse(node => {
      if (!node.isMesh) return;
      if (node.isSkinnedMesh) { skinned++; surfaces.push(node); }
      if (this.definition.status === 'debug' && this.definition.shading === 'anime') {
        const convert = original => {
          const material = new THREE.MeshToonMaterial({ name: original.name,
            color: original.color, map: original.map, gradientMap: ramp,
            transparent: original.transparent, opacity: original.opacity,
            alphaTest: original.alphaTest, side: THREE.FrontSide });
          if (original.name.startsWith('hair_') || original.name === 'eye_turquoise') {
            const hair = original.name.startsWith('hair_');
            material.onBeforeCompile = shader => {
              shader.uniforms.heroPower = this.power;
              shader.fragmentShader = 'uniform float heroPower;\n' + shader.fragmentShader;
              const gold = hair ? 'vec3(1.0, .64, .10) * (.65 + dot(diffuseColor.rgb, vec3(.3, .5, .2)) * 1.2)' : 'vec3(.08, .65, .56)';
              shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, ' + gold + ', heroPower);');
            };
            material.customProgramCacheKey = () => 'hero-transform-' + (hair ? 'hair' : 'eye');
          }
          return material;
        };
        node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material);
      }
      node.castShadow = node.receiveShadow = true;
      node.frustumCulled = false;
      // Preserve authored MToon / PBR shading, alpha cutouts, normal maps and eyes.
      for (const mat of [node.material].flat()) {
        if (mat.map) mat.map.anisotropy = 4;
        if (mat.isMToonMaterial) {
          if (this.definition.outlineWidth != null) mat.outlineWidthFactor = this.definition.outlineWidth;
        }
      }
    });
    if (this.definition.status === 'debug' && this.definition.shading === 'anime') for (const mesh of surfaces) {
      if (![mesh.material].flat().some(m => ['gi_orange', 'gi_navy', 'hair_ink'].includes(m.name))) continue;
      const outlineGeometry = mesh.geometry.clone();
      const positions = outlineGeometry.attributes.position, normals = outlineGeometry.attributes.normal;
      for (let i = 0; i < positions.count; i++) {
        positions.setXYZ(i, positions.getX(i) + normals.getX(i) * .009,
          positions.getY(i) + normals.getY(i) * .009, positions.getZ(i) + normals.getZ(i) * .009);
      }
      const outline = new THREE.SkinnedMesh(outlineGeometry, new THREE.MeshBasicMaterial({ color: '#10121e', side: THREE.BackSide }));
      outline.name = 'Animated ink outline'; outline.position.copy(mesh.position);
      outline.quaternion.copy(mesh.quaternion); outline.scale.copy(mesh.scale);
      outline.bind(mesh.skeleton, mesh.bindMatrix); outline.frustumCulled = false;
      mesh.parent.add(outline); this.outlines.push(outline);
    }
    if (!skinned) throw new Error('This character needs a skinned skeletal rig.');
    if (this.vrm) VRMUtils.rotateVRM0(this.vrm);
    let clips = asset.animations;
    if (this.definition.animations) {
      const library = await loader.loadAsync(this.definition.animations);
      clips = this.vrm && this.definition.animationRig === 'quaternius' ? retargetLibrary(library, this.vrm)
        : this.definition.animationRig === 'quaternius-humanoid' ? retargetHumanoidLibrary(library,this.model,this.definition.bones) : library.animations;
      library.scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const m of [o.material].flat()) m.dispose(); } });
    }
    if (!clips.length && this.definition.status !== 'candidate') throw new Error('The character needs an animation library.');
    if (clips.length && !this.definition.defaultReview) {
      this.animations = new AnimationDirector(this.model, clips, this.definition.clips);
      this.animations.update(.01);
    }
    this.vrm?.update(0);
    this.model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.model);
    const scale = this.definition.height / (bounds.max.y - bounds.min.y);
    this.model.scale.setScalar(scale);
    this.model.position.y = -bounds.min.y * scale;
    this.root.rotation.y = this.definition.facing;
    this.root.add(this.model);
    this.head = this.vrm?.humanoid.getRawBoneNode('head') || this.model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(this.definition.bones?.head || 'head'));
    this.hand = this.vrm?.humanoid.getRawBoneNode('rightHand') || this.model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(this.definition.bones?.rightHand || 'handR')) || this.model.getObjectByName('hand.R');
    this.availableClips=clips;this.clipCount = clips.length;
    if(this.definition.id==='meshy-hero'){this.rigControls=new HeroRigControls(this);this.heroFinish=new HeroFinish(this.model);}
    this.look = new CharacterLook(this.model,this.definition.materialRoles);
    this.setFinish(this.definition.finish || 'authored');
    this.vrm?.springBoneManager?.reset();
    return this;
  }
  update(dt, time, state, music) {
    if (!this.animations && this.availableClips?.length) this.animations=new AnimationDirector(this.model,this.availableClips,this.definition.clips);
    if (!this.animations) return;
    this.power.value = THREE.MathUtils.damp(this.power.value, ['powerup', 'charge', 'blast', 'float'].includes(state) ? 1 : 0, 2.2, dt);
    this.animations.play(state);
    this.animations.update(dt, music);
    if (this.vrm) {
      // Facial animation is an independent layer, not baked into full-body clips.
      const blinkPhase = time % 4.7;
      this.vrm.expressionManager?.setValue('blink', blinkPhase < .16 ? Math.sin(blinkPhase / .16 * Math.PI) : 0);
      const focused=['powerup','charge','blast','punch','kick'].includes(state);
      this.focus=THREE.MathUtils.damp(this.focus||0,focused ? .36 : 0,5,dt);
      this.vrm.expressionManager?.setValue('angry',this.focus);
      this.vrm.expressionManager?.setValue('relaxed',focused?0:.08);
      if(this.vrm.lookAt) { this.vrm.lookAt.target=this.gazeTarget;this.vrm.lookAt.autoUpdate=this.finish==='cinematic' && !this.inspection; }
      this.vrm.update(dt);
    }
    // Authored pose -> life layer (lag, noise, breathing, saccades) -> rig. Paused frames (dt 0) pass the pose through.
    // Optional anime pacing: during fast action the body holds every other frame while everything else runs at full rate.
    this.frameCount=(this.frameCount||0)+1;const fastAction=this.twos&&['punch','kick','dash'].includes(state)&&dt>0;
    if(fastAction&&this.frameCount%2){this.root.updateMatrixWorld(true);return;}
    if(this.showcasePose && this.rigControls){this.life??=new MotionLife(7);this.livePose=dt>0?this.life.apply(this.showcasePose,dt,time):this.showcasePose;this.rigControls.apply(this.livePose,time,music);
      this.root.updateMatrixWorld(true);this.heroFinish?.updateSway(dt,this.anchor('head',new THREE.Vector3()),Math.max(0,(this.showcasePose.power||0)-.4));}
    // Expressions are two procedural shape keys ("focus", "shout"); they ease toward the pose.
    if(this.showcasePose){
      if(!this.morphs){this.morphs=[];this.model.traverse(o=>{if(o.morphTargetDictionary)this.morphs.push(o);});}
      this.expression??={focus:0,shout:0};
      for(const key of ['focus','shout']){
        this.expression[key]=THREE.MathUtils.damp(this.expression[key],this.showcasePose[key]||0,6,dt);
        for(const o of this.morphs){const i=o.morphTargetDictionary[key];if(i!=null)o.morphTargetInfluences[i]=this.expression[key];}
      }
    }
    this.root.updateMatrixWorld(true);
  }
  anchor(role, target = new THREE.Vector3()) {
    const defaults = { hips: 'hips', chest: 'chest', head: 'head', leftHand: 'hand.L', rightHand: 'hand.R',
      leftUpperArm: 'upperarm.L', rightUpperArm: 'upperarm.R', leftLowerArm: 'forearm.L', rightLowerArm: 'forearm.R', leftLowerLeg: 'shin.L', rightLowerLeg: 'shin.R' };
    const name = this.definition.bones?.[role] || defaults[role];
    const node = this.vrm?.humanoid.getRawBoneNode(role) || (name && this.model?.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)));
    if (node) return node.getWorldPosition(target);
    const fallback = { hips:[0,.9,0], chest:[0,1.4,0], head:[0,1.85,0], leftHand:[-.5,1,0], rightHand:[.5,1,0],
      leftUpperArm:[-.3,1.5,0], rightUpperArm:[.3,1.5,0], leftLowerLeg:[-.15,.5,0], rightLowerLeg:[.15,.5,0] };
    return target.fromArray(fallback[role] || [0,1,0]).multiplyScalar(this.definition.height/2).applyMatrix4(this.root.matrixWorld);
  }
  palm(target = new THREE.Vector3()) {
    if(this.showcasePose && this.rigControls)return target.copy(this.rigControls.center);
    const left=this.anchor('leftHand'), right=this.anchor('rightHand');
    // Generic spell clips may use either hand. Attach to the raised casting hand.
    this.castingSide=left.y>right.y+.04?'left':'right';
    return target.copy(this.castingSide==='left'?left:right);
  }
  energyDirection(target = new THREE.Vector3()) {
    if(this.showcasePose && this.rigControls)return target.copy(this.rigControls.direction);
    const side=this.castingSide || 'right';
    target.copy(this.anchor(side+'Hand')).sub(this.anchor(side+'LowerArm'));
    if(target.lengthSq()<.0001) target.set(0,0,1).applyQuaternion(this.root.quaternion);
    return target.normalize();
  }
  setFinish(mode) {
    this.finish=mode==='cinematic'?'cinematic':'authored';
    if(this.finish==='authored') this.vrm?.lookAt?.reset();
    this.look?.apply(this.finish,Boolean(this.inspection));
    this.heroFinish?.apply(this.finish==='cinematic' && !this.inspection);
  }
  setInspection(enabled) {
    this.inspection=enabled;this.look?.apply(this.finish,enabled);this.heroFinish?.apply(this.finish==='cinematic' && !enabled);
    if(enabled) this.vrm?.lookAt?.reset();
  }
  setOutline(width) { this.look?.setOutlineScale(width/.0025);this.heroFinish?.setWidth(width); }
  setQuality(anisotropy) {
    this.model?.traverse(o => { if (o.isMesh) for (const m of [o.material].flat()) for(const t of Object.values(m))if(t?.isTexture){t.anisotropy=anisotropy;t.needsUpdate=true;} });
  }
}
