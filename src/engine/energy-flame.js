import { shaderPalette } from './palette.js';
import * as THREE from 'three';
// The body of the aura: one upright, camera-facing flame drawn behind the hero, with hard
// colour bands (cream core, gold, orange edge) and lightning bolts inside it. The hero is
// drawn in front of it, so the character stays readable at any strength.
const noise = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
export class EnergyFlame {
  constructor(scene) {
    this.uniforms = { time: { value: 0 }, strength: { value: 0 }, size: { value: new THREE.Vector2(2.6, 3.4) }, wind: { value: 0 }, flash: { value: 0 } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: `uniform vec2 size;varying vec2 vUv;
      void main(){vUv=uv;vec3 center=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
      vec3 toCamera=normalize(vec3(cameraPosition.x-center.x,0.,cameraPosition.z-center.z)+vec3(0.,0.,1e-5));
      vec3 right=vec3(toCamera.z,0.,-toCamera.x);
      vec3 world=center-toCamera*.45+right*position.x*size.x+vec3(0.,1.,0.)*(position.y+.5)*size.y;
      gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
      fragmentShader: shaderPalette + `uniform float time;uniform float strength;uniform float wind;uniform float flash;varying vec2 vUv;${noise}
      float bolt(vec2 q,float seed){float bucket=floor(time*11.+seed*5.);
       float on=step(.66,hash(vec3(bucket,seed,3.)));
       // Straight segments between random offsets give a forked, angular bolt.
       float segment=q.y*15.,zig=mix(hash(vec3(floor(segment),bucket,seed)),hash(vec3(floor(segment)+1.,bucket,seed)),fract(segment));
       float path=(hash(vec3(seed,bucket,7.))-.5)*1.2+(noise3(vec3(q.y*3.,bucket,seed))-.5)*.5+(zig-.5)*.2;
       return on*smoothstep(.016,.004,abs(q.x-path))*smoothstep(.02,.12,q.y)*(1.-smoothstep(.5,.72,q.y));}
      void main(){float y=vUv.y;vec2 q=vec2((vUv.x*2.-1.)+wind*y*y,y);
       // Each column of the flame has its own height: broad spikes with finer ones on top,
       // all travelling upward, inside an envelope that is tallest over the hero.
       float reach=abs(q.x)/(.94*mix(.42,1.,smoothstep(0.,.24,y)));
       float envelope=pow(max(0.,1.-reach*reach),.8);
       float broad=1.-abs(2.*noise3(vec3(q.x*6.5,time*1.9-y*1.5,time*.35))-1.);
       float fine=1.-abs(2.*noise3(vec3(q.x*17.,time*3.6-y*3.,4.+time*.5))-1.);
       float height=envelope*(.34+.46*broad*broad+.20*fine)*(.94+.06*sin(time*3.1));
       float flame=(1.-y/max(height,.001))*mix(.45,1.,smoothstep(0.,.6,envelope));
       float base=.02+.10*noise3(vec3(q.x*6.5,time*1.6,3.));flame*=smoothstep(base-.02,base+.03,y);
       // Peak: the whole flame flares hotter for a moment, behind the hero.
       flame+=flash*.4*smoothstep(0.,.05,flame);
       float edge=smoothstep(.0,.05,flame),warm=smoothstep(.13,.17,flame),mid=smoothstep(.30,.34,flame),core=smoothstep(.66,.71,flame);
       vec3 color=mix(p_deepGiOrange*1.5,mix(p_gokuOrange,p_sunsetOrangeHighlight,.5)*1.6,warm);color=mix(color,p_superSaiyanGold*1.9,mid);color=mix(color,mix(p_brightAuraYellow,p_auraGlowCream,.5)*2.3,core);
       float alpha=(edge*.78+warm*.08+mid*.08+core*.04)*strength;
       // Three bolts: cyan-white, violet and blue.
       float e1=bolt(q,1.),e2=bolt(q,2.7),e3=bolt(q,4.3),electric=max(e1,max(e2,e3))*strength;
       vec3 spark=(e1*mix(p_energyTeal,p_spiritGlowWhite,.6)+e2*mix(p_villainVioletGlow,p_spiritGlowWhite,.3)+e3*mix(p_kamehamehaBlue,p_spiritGlowWhite,.3))/max(e1+e2+e3,.001);
       color=mix(color,spark*3.2,electric);
       gl_FragColor=vec4(color,clamp(alpha+electric,0.,1.));}`,
    }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = -1; scene.add(this.mesh);
    // Light thrown on the ground under the hero.
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: shaderPalette + `uniform float time;uniform float strength;uniform float flash;varying vec2 vP;${noise}
      void main(){float r=length(vP),flicker=.82+.18*noise3(vec3(atan(vP.y,vP.x)*3.,r*4.-time*2.6,time));
       float glow=pow(max(0.,1.-r),2.2)*flicker;
       gl_FragColor=vec4(mix(p_armorGold,p_superSaiyanGold,glow)*1.7+p_explosionYellow*flash,glow*(strength*.55+flash*.4));}`,
    }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.visible = false; scene.add(this.ground);
  }
  update(time, power, effects, position, wind = { x: 0, z: 0 }, flash = 0, pulse = 1) {
    const strength = THREE.MathUtils.smoothstep(power, .45, .85) * effects;
    this.mesh.visible = this.ground.visible = strength > .01; if (!this.mesh.visible) return;
    this.mesh.position.copy(position); this.ground.position.set(position.x, .012, position.z); this.ground.scale.setScalar(1.5 + power * 1.3);
    this.uniforms.flash.value = flash * effects;
    this.uniforms.time.value = time; this.uniforms.strength.value = strength; this.uniforms.wind.value = wind.x * 2;
    this.uniforms.size.value.set((2.5 + power * .9) * pulse, (3.4 + power * 2.0) * pulse);
  }
}
