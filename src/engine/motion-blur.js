import * as THREE from 'three';

// Velocity source for motion blur. The hero's skinned meshes are drawn into a half-resolution
// RG half-float target holding screen-space velocity (current minus previous clip xy/w, in uv
// units). Each vertex is skinned twice: with this frame's bone matrices and with last frame's,
// kept in a copy that is uploaded as a second data texture. Hair sway is ignored.
const LAYER = 29, SCALE = .5;
const vertexShader = `
uniform mat4 prevViewProj;uniform mat4 prevModel;uniform mat4 prevBindInv;uniform highp sampler2D prevBoneTexture;
varying vec4 vCur;varying vec4 vPrev;
#include <skinning_pars_vertex>
mat4 getPrevBone(const in float i){int size=textureSize(prevBoneTexture,0).x;int j=int(i)*4;int x=j%size;int y=j/size;
 return mat4(texelFetch(prevBoneTexture,ivec2(x,y),0),texelFetch(prevBoneTexture,ivec2(x+1,y),0),texelFetch(prevBoneTexture,ivec2(x+2,y),0),texelFetch(prevBoneTexture,ivec2(x+3,y),0));}
void main(){
 vec4 p=vec4(position,1.);
 mat4 b=skinWeight.x*getBoneMatrix(skinIndex.x)+skinWeight.y*getBoneMatrix(skinIndex.y)+skinWeight.z*getBoneMatrix(skinIndex.z)+skinWeight.w*getBoneMatrix(skinIndex.w);
 mat4 q=skinWeight.x*getPrevBone(skinIndex.x)+skinWeight.y*getPrevBone(skinIndex.y)+skinWeight.z*getPrevBone(skinIndex.z)+skinWeight.w*getPrevBone(skinIndex.w);
 vec4 cur=bindMatrixInverse*b*bindMatrix*p;
 vec4 prev=prevBindInv*q*bindMatrix*p;
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
      const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, side: THREE.DoubleSide, uniforms: { prevViewProj: this.prevViewProj, prevModel: { value: new THREE.Matrix4() }, prevBindInv: { value: new THREE.Matrix4() }, prevBoneTexture: { value: tex } } });
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
    for (const mesh of this.meshes) {
      const s = this.state(mesh);
      if (s.fresh) { s.data.set(mesh.skeleton.boneMatrices.length === s.data.length ? mesh.skeleton.boneMatrices : s.data); s.material.uniforms.prevModel.value.copy(mesh.matrixWorld); s.material.uniforms.prevBindInv.value.copy(mesh.bindMatrixInverse); s.fresh = false; }
      s.tex.needsUpdate = true;
      saved.push(mesh, mesh.material); mesh.material = Array.isArray(mesh.material) ? mesh.material.map(() => s.material) : s.material; mesh.layers.enable(LAYER);
    }
    scene.background = null; renderer.shadowMap.autoUpdate = false; camera.layers.set(LAYER);
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(scene, camera);
    camera.layers.mask = layers; scene.background = background; renderer.shadowMap.autoUpdate = shadowAuto; renderer.setClearColor(this.clear, clearAlpha); renderer.setRenderTarget(prevTarget);
    for (let i = 0; i < saved.length; i += 2) { const mesh = saved[i]; mesh.material = saved[i + 1]; mesh.layers.disable(LAYER); const s = this.states.get(mesh); s.data.set(mesh.skeleton.boneMatrices); s.material.uniforms.prevModel.value.copy(mesh.matrixWorld); s.material.uniforms.prevBindInv.value.copy(mesh.bindMatrixInverse); }
    this.prevViewProj.value.copy(this.viewProj); this.valid = true;
    return this.reproj;
  }
  invalidate() { this.valid = false; }
}
