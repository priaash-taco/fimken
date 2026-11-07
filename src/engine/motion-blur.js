import * as THREE from 'three';

// Velocity source for motion blur. The hero's skinned meshes are drawn into a half-resolution
// RG half-float target holding screen-space velocity (current minus previous clip xy/w, in uv
// units). Each vertex is skinned twice: with this frame's bone matrices and with last frame's,
// kept in a copy that is uploaded as a second data texture. The hero's vertex deformations (hair sway,
// secondary-motion regions, strike smear) are applied too, with last frame's values for the previous position,
// so the velocity lines up with the pixels the body actually covers.
const LAYER = 29, SCALE = .5, REGIONS = 12, SMEARS = 6;
const vertexShader = `
uniform mat4 prevViewProj;uniform mat4 prevModel;uniform mat4 prevBindInv;uniform highp sampler2D prevBoneTexture;
uniform vec3 hairSway;uniform vec3 hairSwayPrev;uniform vec3 regionOffset[12];uniform vec3 regionOffsetPrev[12];
uniform float smearCount;uniform vec3 smearPos[6];uniform vec3 smearVel[6];uniform float smearCountPrev;uniform vec3 smearPosPrev[6];uniform vec3 smearVelPrev[6];
attribute float sway;attribute float regionId;attribute float regionWeight;
varying vec4 vCur;varying vec4 vPrev;
vec3 deform(vec3 p,vec3 hs,float count,vec3 sp[6],vec3 sv[6],bool prev){
 p+=hs*sway;
 if(regionWeight>0.){vec3 ro=vec3(0.);for(int i=0;i<12;i++){ro+=(prev?regionOffsetPrev[i]:regionOffset[i])*step(abs(regionId-float(i)),.5);}p+=ro*regionWeight;}
 if(count>.5)for(int si=0;si<6;si++){if(float(si)>=count)break;float sl=length(sv[si]);if(sl<.0001)continue;vec3 sd=sv[si]/sl;vec3 rel=p-sp[si];float back=dot(rel,-sd);float radial=length(rel+sd*back);float sw=smoothstep(.03,.22,back)*(1.0-smoothstep(.0,.45,back))*(1.0-smoothstep(.06,.2,radial));p-=sd*min(sl*.016,.16)*sw;}
 return p;}
#include <skinning_pars_vertex>
mat4 getPrevBone(const in float i){int size=textureSize(prevBoneTexture,0).x;int j=int(i)*4;int x=j%size;int y=j/size;
 return mat4(texelFetch(prevBoneTexture,ivec2(x,y),0),texelFetch(prevBoneTexture,ivec2(x+1,y),0),texelFetch(prevBoneTexture,ivec2(x+2,y),0),texelFetch(prevBoneTexture,ivec2(x+3,y),0));}
void main(){
 vec4 p=vec4(position,1.);
 mat4 b=skinWeight.x*getBoneMatrix(skinIndex.x)+skinWeight.y*getBoneMatrix(skinIndex.y)+skinWeight.z*getBoneMatrix(skinIndex.z)+skinWeight.w*getBoneMatrix(skinIndex.w);
 mat4 q=skinWeight.x*getPrevBone(skinIndex.x)+skinWeight.y*getPrevBone(skinIndex.y)+skinWeight.z*getPrevBone(skinIndex.z)+skinWeight.w*getPrevBone(skinIndex.w);
 vec4 cur=bindMatrixInverse*b*bindMatrix*p;cur.xyz=deform(cur.xyz,hairSway,smearCount,smearPos,smearVel,false);
 vec4 prev=prevBindInv*q*bindMatrix*p;prev.xyz=deform(prev.xyz,hairSwayPrev,smearCountPrev,smearPosPrev,smearVelPrev,true);
 vCur=projectionMatrix*modelViewMatrix*cur;
 vPrev=prevViewProj*prevModel*prev;
 gl_Position=vCur;}`;
const fragmentShader = `varying vec4 vCur;varying vec4 vPrev;
void main(){vec2 v=(vCur.xy/vCur.w-vPrev.xy/max(abs(vPrev.w),1e-4))*.5;gl_FragColor=vec4(v,0.,1.);}`;

export class MotionVelocity {
  constructor() {
    this.target = new THREE.WebGLRenderTarget(1, 1, { format: THREE.RGFormat, type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
    this.prevViewProj = { value: new THREE.Matrix4() };
    this.viewProj = new THREE.Matrix4(); this.invViewProj = new THREE.Matrix4(); this.reproj = new THREE.Matrix4();
    this.camPos = new THREE.Vector3(); this.camQuat = new THREE.Quaternion(); this.valid = false;
    this.states = new Map(); this.meshes = []; this.age = 1e9; this.clear = new THREE.Color();
    // Deformation uniforms shared with the hero materials (set per frame by the renderer) and last frame's copies.
    this.deform = null; this.zero3 = { value: new THREE.Vector3() }; this.zeroN = { value: Array.from({ length: REGIONS }, () => new THREE.Vector3()) }; this.zeroS = { value: Array.from({ length: SMEARS }, () => new THREE.Vector3()) }; this.zeroF = { value: 0 };
    this.prev = { hairSway: { value: new THREE.Vector3() }, regionOffset: { value: Array.from({ length: REGIONS }, () => new THREE.Vector3()) }, smearCount: { value: 0 }, smearPos: { value: Array.from({ length: SMEARS }, () => new THREE.Vector3()) }, smearVel: { value: Array.from({ length: SMEARS }, () => new THREE.Vector3()) } };
  }
  setSize(width, height) { this.target.setSize(Math.max(1, Math.floor(width * SCALE)), Math.max(1, Math.floor(height * SCALE))); }
  // The hero's visible body meshes, not the ink hull or energy glow copies.
  collect(root) {
    this.meshes.length = 0;
    root?.traverse(o => { if (o.isSkinnedMesh && o.visible && !/ink|glow/i.test(o.name) && o.material?.side !== THREE.BackSide && o.skeleton) this.meshes.push(o); });
  }
  state(mesh) {
    if (mesh.skeleton.boneTexture === null) mesh.skeleton.computeBoneTexture();
    let s = this.states.get(mesh);
    if (!s) {
      const data = new Float32Array(mesh.skeleton.boneMatrices.length), tex = new THREE.DataTexture(data, Math.round(Math.sqrt(data.length / 4)), Math.round(Math.sqrt(data.length / 4)), THREE.RGBAFormat, THREE.FloatType);
      tex.needsUpdate = true;
      const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, side: THREE.DoubleSide, uniforms: { hairSway: this.zero3, hairSwayPrev: this.prev.hairSway, regionOffset: this.zeroN, regionOffsetPrev: this.prev.regionOffset, smearCount: this.zeroF, smearPos: this.zeroS, smearVel: this.zeroS, smearCountPrev: this.prev.smearCount, smearPosPrev: this.prev.smearPos, smearVelPrev: this.prev.smearVel, prevViewProj: this.prevViewProj, prevModel: { value: new THREE.Matrix4() }, prevBindInv: { value: new THREE.Matrix4() }, prevBoneTexture: { value: tex } } });
      s = { data, tex, material, fresh: true }; this.states.set(mesh, s);
    }
    return s;
  }
  // Draws hero velocity into the target. Returns the camera reprojection matrix (current clip -> previous clip).
  render(renderer, scene, camera, root, dt) {
    camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse.copy(camera.matrixWorld).invert());
    // A camera cut must not smear: restart the history when the view jumped.
    camera.matrixWorld.decompose(this.camPos, this.camQuat, new THREE.Vector3());
    if (this.lastPos && (this.lastPos.distanceTo(this.camPos) > 2.5 || this.lastQuat.angleTo(this.camQuat) > .35)) this.valid = false;
    (this.lastPos ||= new THREE.Vector3()).copy(this.camPos); (this.lastQuat ||= new THREE.Quaternion()).copy(this.camQuat);
    if (!this.valid) { this.prevViewProj.value.copy(this.viewProj); for (const s of this.states.values()) s.fresh = true; }
    this.invViewProj.copy(this.viewProj).invert(); this.reproj.multiplyMatrices(this.prevViewProj.value, this.invViewProj);
    this.age += 1; if (this.age > 45 || !this.meshes.length) { this.collect(root); this.age = 0; }
    const saved = [], layers = camera.layers.mask, background = scene.background, shadowAuto = renderer.shadowMap.autoUpdate, clearAlpha = renderer.getClearAlpha(), prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(this.clear);
    // Current deformation uniforms come straight from the hero materials; a fresh history copies them into the previous set too.
    const d = this.deform, cur = { hairSway: d?.sway || this.zero3, regionOffset: d?.regions || this.zeroN, smearCount: d?.smear?.count || this.zeroF, smearPos: d?.smear?.pos || this.zeroS, smearVel: d?.smear?.vel || this.zeroS };
    if (!this.valid) this.copyDeform(cur);
    for (const mesh of this.meshes) {
      const s = this.state(mesh); const u = s.material.uniforms; u.hairSway = cur.hairSway; u.regionOffset = cur.regionOffset; u.smearCount = cur.smearCount; u.smearPos = cur.smearPos; u.smearVel = cur.smearVel;
      if (s.fresh) { s.data.set(mesh.skeleton.boneMatrices.length === s.data.length ? mesh.skeleton.boneMatrices : s.data); s.material.uniforms.prevModel.value.copy(mesh.matrixWorld); s.material.uniforms.prevBindInv.value.copy(mesh.bindMatrixInverse); s.fresh = false; }
      s.tex.needsUpdate = true;
      saved.push(mesh, mesh.material); mesh.material = Array.isArray(mesh.material) ? mesh.material.map(() => s.material) : s.material; mesh.layers.enable(LAYER);
    }
    scene.background = null; renderer.shadowMap.autoUpdate = false; camera.layers.set(LAYER);
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(scene, camera);
    camera.layers.mask = layers; scene.background = background; renderer.shadowMap.autoUpdate = shadowAuto; renderer.setClearColor(this.clear, clearAlpha); renderer.setRenderTarget(prevTarget);
    for (let i = 0; i < saved.length; i += 2) { const mesh = saved[i]; mesh.material = saved[i + 1]; mesh.layers.disable(LAYER); const s = this.states.get(mesh); s.data.set(mesh.skeleton.boneMatrices); s.material.uniforms.prevModel.value.copy(mesh.matrixWorld); s.material.uniforms.prevBindInv.value.copy(mesh.bindMatrixInverse); }
    this.prevViewProj.value.copy(this.viewProj); this.valid = true; this.copyDeform(cur);
    return this.reproj;
  }
  copyDeform(cur) {
    const p = this.prev; p.hairSway.value.copy(cur.hairSway.value); p.smearCount.value = cur.smearCount.value;
    for (let i = 0; i < REGIONS; i++) p.regionOffset.value[i].copy(cur.regionOffset.value[i] || p.regionOffset.value[i]);
    for (let i = 0; i < SMEARS; i++) { p.smearPos.value[i].copy(cur.smearPos.value[i] || p.smearPos.value[i]); p.smearVel.value[i].copy(cur.smearVel.value[i] || p.smearVel.value[i]); }
  }
  invalidate() { this.valid = false; }
}
