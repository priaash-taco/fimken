import { shaderPalette } from './palette.js';
import * as THREE from 'three';
// The beam is one continuous energetic mass, not a tube with lines on it. An invisible camera-facing
// ribbon carries a noise field that is stretched along the beam and scrolls away from the hands:
//   a very thin white-hot core, a dense cyan body, and a soft irregular plasma envelope whose
//   silhouette is bent by noise, so its thickness and edge change continuously.
// Detail (streaks) comes from the same noise at lower strength, so it merges into the body.
export class PlasmaBeam {
  constructor(scene, noise) {
    this.uniforms = { noiseTex: { value: noise }, time: { value: 0 }, strength: { value: 0 }, origin: { value: new THREE.Vector3() }, dir: { value: new THREE.Vector3(0, 0, 1) },
      length: { value: 10 }, carrier: { value: 1 }, radius: { value: .5 }, tint: { value: 0 }, wave: { value: 0 } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 1, 1, 32), new THREE.ShaderMaterial({ uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `uniform vec3 origin;uniform vec3 dir;uniform float length;uniform float carrier;varying float vU;varying float vV;
        void main(){float v=position.y+.5;vec3 P=origin+dir*(v*length);vec3 side=normalize(cross(dir,normalize(cameraPosition-P))+vec3(1e-5));
         vU=position.x;vV=v;gl_Position=projectionMatrix*viewMatrix*vec4(P+side*position.x*carrier,1.);}`,
      fragmentShader: shaderPalette + `uniform sampler2D noiseTex;uniform float time,strength,length,carrier,radius,tint,wave;varying float vU;varying float vV;
        void main(){
         float s=vV*length;                                   // metres from the hands
         float w0=radius/carrier;                             // half-width of the body, as a fraction of the carrier
         // The beam starts narrow at the hands and opens up; noise keeps the opening irregular.
         float open=mix(.22,1.,smoothstep(0.,3.2,s));
         vec2 warp=texture2D(noiseTex,vec2(vU*.6+.13,s*.045-time*.55)).rg-.5;
         float edge=texture2D(noiseTex,vec2(vU*1.5+.4,s*.13-time*1.9)).g;
         float flow=texture2D(noiseTex,vec2(vU*1.1,s*.07-time*1.2)).r;
         float streak=texture2D(noiseTex,vec2(vU*4.2,s*.03-time*1.05)).a;   // stretched along the beam
         float off=wave*sin(s*.9-time*5.)*smoothstep(0.,2.5,s)/carrier;   // serpent: the whole centreline swims side to side
         float x=vU-off+warp.x*.42*w0*open;
         float w=w0*open*(1.+(edge-.5)*.55+(flow-.5)*.35);
         float r=abs(x)/max(w,.02);
         float core=exp(-pow(r/(.1+.05*flow),2.));
         float bodyField=smoothstep(.98,.12,r)*(.78+.5*streak+.25*flow);
         float envelope=smoothstep(1.7,.5,r+(edge-.5)*.7)*(.55+.45*flow);
         vec3 cDeep=mix(p_deepBeamBlue,p_deepGiOrange,tint),cBlue=mix(p_kamehamehaBlue,p_superSaiyanGold,tint),cCyan=mix(p_kamehamehaCyan,p_brightAuraYellow,tint);
         vec3 color=cDeep*envelope*.9+mix(cDeep,cBlue,flow)*bodyField*1.0+cCyan*bodyField*bodyField*.55+p_spiritGlowWhite*core*1.8;
         // Ends: grows out of the hands, thins away in the distance.
         color*=smoothstep(0.,.015,vV)*(1.-smoothstep(.55,1.,vV));
         gl_FragColor=vec4(color*strength,1.);}` }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 3; scene.add(this.mesh);
  }
  update(time, origin, direction, strength, { length = 10, radius = .5, tint = 0, wave = 0 } = {}) {
    this.mesh.visible = strength > .01; if (!this.mesh.visible) return;
    const u = this.uniforms; u.origin.value.copy(origin); u.dir.value.copy(direction).normalize();
    u.time.value = time; u.strength.value = Math.min(.8, strength); u.length.value = length; u.radius.value = radius; u.tint.value = tint; u.wave.value = wave; u.carrier.value = radius * 1.9 + .35 + wave;
  }
}
