import { shaderPalette } from './palette.js';
import * as THREE from 'three';
// A fan of thin needle-shaped rays from one point: the starburst of a released beam and the
// streaks thrown off a charge orb. Each ray is one triangle (two base corners, one apex) that
// turns to face the camera in the vertex shader; length, width, angle and flicker come from a
// hash of its seed, so nothing is stored per frame. White-hot at the root, through cyan to
// blue-violet at the tip.
export class RayFan {
  constructor(scene, { count = 120, spherical = false } = {}) {
    const seed = new Float32Array(count * 3), corner = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { seed[i * 3 + k] = i + .5; corner[i * 3 + k] = k; }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 9), 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 1)); geometry.setAttribute('corner', new THREE.BufferAttribute(corner, 1));
    this.uniforms = { origin: { value: new THREE.Vector3() }, forward: { value: new THREE.Vector3(0, 0, 1) }, right: { value: new THREE.Vector3(1, 0, 0) }, up: { value: new THREE.Vector3(0, 1, 0) },
      time: { value: 0 }, strength: { value: 0 }, cone: { value: .5 }, length: { value: 5 }, width: { value: .08 }, spherical: { value: spherical ? 1 : 0 } };
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `uniform vec3 origin;uniform vec3 forward;uniform vec3 right;uniform vec3 up;uniform float time;uniform float cone;uniform float length;uniform float width;uniform float spherical;
      attribute float seed;attribute float corner;varying float vT;varying float vSeed;varying float vFlick;
      float h(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
      void main(){float s=seed;
       float flick=.55+.45*sin(time*(9.+h(s+1.)*14.)+h(s+2.)*6.2831);
       float theta=h(s+3.)*6.2831853;
       float polar=spherical>.5?acos(1.-2.*h(s+4.)):pow(h(s+4.),1.35)*cone;
       vec3 dir=normalize(forward*cos(polar)+(right*cos(theta)+up*sin(theta))*sin(polar));
       float len=length*(.4+.8*h(s+5.))*(.72+.28*flick),w=width*(.5+h(s+6.));
       vec3 side=normalize(cross(dir,normalize(cameraPosition-origin))+vec3(1e-5));
       vec3 pos=origin+(corner>1.5?dir*len:side*w*(corner<.5?-1.:1.));
       vT=corner>1.5?1.:0.;vSeed=s;vFlick=flick;gl_Position=projectionMatrix*viewMatrix*vec4(pos,1.);}`,
      fragmentShader: shaderPalette + `uniform float strength;varying float vT;varying float vSeed;varying float vFlick;
      void main(){vec3 col=mix(p_spiritGlowWhite*3.2,p_kamehamehaCyan*2.3,smoothstep(0.,.3,vT));
       col=mix(col,mix(p_kamehamehaBlue,mix(p_deepBeamBlue,p_friezaPurple,.6),fract(vSeed*7.))*2.1,smoothstep(.28,1.,vT));
       gl_FragColor=vec4(col,pow(1.-vT,1.9)*vFlick*strength);}` }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 4; scene.add(this.mesh);
  }
  update(time, origin, forward, strength, { length = 5, cone = .5, width = .08 } = {}) {
    this.mesh.visible = strength > .01; if (!this.mesh.visible) return;
    const u = this.uniforms; u.origin.value.copy(origin); u.forward.value.copy(forward).normalize();
    u.right.value.crossVectors(u.forward.value, Math.abs(u.forward.value.y) > .95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    u.up.value.crossVectors(u.right.value, u.forward.value).normalize();
    u.time.value = time; u.strength.value = Math.min(1, strength); u.length.value = length; u.cone.value = cone; u.width.value = width;
  }
}
