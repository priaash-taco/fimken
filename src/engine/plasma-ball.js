import { shaderPalette } from './palette.js';
import * as THREE from 'three';
// A ball of plasma without a visible sphere: a camera-facing carrier whose radial field is
// bent by noise, so the perimeter is irregular and always moving.
//   almost-white core  ->  saturated cyan-blue body  ->  soft blue halo, plus thin ring elements.
// Used for the charge orb, the flash at the hands on release, and the glow where a beam lands.
export class PlasmaBall {
  constructor(scene, noise, { tint = 0 } = {}) {
    this.uniforms = { noiseTex: { value: noise }, time: { value: 0 }, strength: { value: 0 }, size: { value: 1 }, wobble: { value: .35 }, rings: { value: 1 }, tint: { value: tint } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float size;varying vec2 vP;void main(){vP=position.xy;vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);gl_Position=projectionMatrix*(c+vec4(position.xy*size,0.,0.));}`,
      fragmentShader: shaderPalette + `uniform sampler2D noiseTex;uniform float time,strength,wobble,rings,tint;varying vec2 vP;
        void main(){
         float r=length(vP);float a=atan(vP.y,vP.x);vec2 c=vec2(cos(a),sin(a));
         // Irregular perimeter: the radius is pushed in and out by noise sampled around the circle.
         float per=texture2D(noiseTex,c*.42+vec2(time*.17,-time*.23)).r-.5,per2=texture2D(noiseTex,c*.9+vec2(-time*.31,time*.19)).g-.5;
         float R=.5*(1.+(per*.9+per2*.5)*wobble);
         float d=r/R;
         // Turbulence inside the body: flowing, never a flat disc.
         float swirl=texture2D(noiseTex,vP*1.3+vec2(time*.21,-time*.33)).b;
         float core=smoothstep(.62,0.,d+(swirl-.5)*.25);
         float body=smoothstep(1.02,.15,d+(swirl-.5)*.3);
         float halo=exp(-pow(max(d-.45,0.)/.95,2.))*(.65+.5*per);
         // Thin circular elements: one steady, one expanding and fading.
         float steady=exp(-pow((d-.82)/.022,2.))*rings;
         float t=fract(time*.9);float pulse=exp(-pow((d-(.9+t*.9))/(.02+.03*t),2.))*(1.-t)*rings;
         vec3 haloColor=mix(p_deepBeamBlue,p_deepGiOrange,tint);
         vec3 bodyColor=mix(mix(p_kamehamehaBlue,p_kamehamehaCyan,swirl),p_sunsetOrangeHighlight,tint);
         vec3 color=haloColor*halo*1.5+bodyColor*body*2.2+p_spiritGlowWhite*pow(core,1.4)*3.6+p_spiritGlowWhite*(steady*.9+pulse*.7);
         gl_FragColor=vec4(color*strength,1.);}` }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 7; scene.add(this.mesh);
  }
  // radius is the body's world radius; the carrier is larger so the halo has room.
  update(time, position, radius, strength, wobble = .35) {
    this.mesh.visible = strength > .01; if (!this.mesh.visible) return;
    this.mesh.position.copy(position); const u = this.uniforms; u.time.value = time; u.strength.value = Math.min(1.5, strength); u.size.value = radius * 3.2; u.wobble.value = wobble;
  }
}
