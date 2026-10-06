import { paletteColor, shaderPalette } from './palette.js';
import * as THREE from 'three';
// A camera-facing burst with hard colour bands and rays: the star at the beam's source and
// the fireball where it lands. Colours run from the centre outward.
const noise = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
export class EnergyBurst {
  constructor(scene, { colors, rays = .5, speed = 3, smoke = null, additive = false, detail = 1, intensity = 1, soft = false }) {
    this.uniforms = { time: { value: 0 }, strength: { value: 0 }, size: { value: 1 }, rays: { value: rays }, speed: { value: speed }, additive: { value: additive ? 1 : 0 }, detail: { value: detail }, soft: { value: soft ? 1 : 0 },
      c0: { value: paletteColor(colors[0], 2.6 * intensity) }, c1: { value: paletteColor(colors[1], 2 * intensity) }, c2: { value: paletteColor(colors[2], 1.6 * intensity) },
      smoke: { value: paletteColor(smoke || colors[2], smoke ? .55 : 0) } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `uniform float size;varying vec2 vP;
      void main(){vP=position.xy;vec4 center=modelViewMatrix*vec4(0.,0.,0.,1.);gl_Position=projectionMatrix*(center+vec4(position.xy*size,0.,0.));}`,
      fragmentShader: shaderPalette + `uniform float time;uniform float strength;uniform float rays;uniform float speed;uniform float additive;uniform float detail;uniform float soft;uniform vec3 c0;uniform vec3 c1;uniform vec3 c2;uniform vec3 smoke;varying vec2 vP;${noise}
      void main(){float r=length(vP);vec2 dir=vP/max(r,.001);
       float spikes=noise3(vec3(dir*5.,time*speed));spikes=mix(spikes,spikes*spikes*2.,rays);
       // Fine rays: many thin spokes layered over the broad ones when detail is asked for.
       if(detail>1.){float fineRays=pow(max(0.,noise3(vec3(dir*5.*detail*2.6,time*speed*.7+5.))),3.)*1.6;spikes=mix(spikes,max(spikes,fineRays),.7);}
       float lumps=.65*noise3(vec3(vP*3.2,time*speed*.5))+.35*noise3(vec3(vP*8.,time*speed*.8+3.));
       float reach=(.36+.46*spikes*rays+.22*lumps*(1.-rays))*(.9+.1*sin(time*speed*3.));
       float fire=1.-r/max(reach,.001);
       float edge=smoothstep(0.,.025,fire),mid=smoothstep(.28,.305,fire),core=smoothstep(.58,.605,fire);
       // Hot centre is a small fraction of the burst; the body keeps the middle colour.
       float hot=additive>.5?smoothstep(.78,.86,fire):core;
       vec3 color=mix(c2,c1,mid);color=mix(color,c0,hot);
       // Billowing outer puffs, only where a smoke colour is given.
       float cloud=.55*noise3(vec3(vP*2.4,time*.5+7.))+.45*noise3(vec3(vP*6.5,time*.7+2.));
       float puff=smoothstep(0.,.03,1.-r/(.50+.42*cloud))*step(.001,dot(smoke,vec3(1.)));
       color=mix(smoke*(.7+.5*smoothstep(.45,.5,cloud)),color,edge);
       // Additive bursts are light, not paint: only their hot centre is strong.
       float body=additive>.5?edge*.06+mid*.34+core*.3+hot*.3:edge*.92;
       if(soft>.5){
        // Billowing fire: three octaves of turbulence ragged the edge; white-yellow core, orange body, red rim, dark smoke.
        float turb=.5*noise3(vec3(vP*2.6,time*1.4))+.3*noise3(vec3(vP*6.,time*2.6+4.))+.2*noise3(vec3(vP*13.,time*4.+9.));
        float f=1.-r/(.72+.35*turb)+(turb-.5)*.45*(1.-r);f*=1.-smoothstep(.85,1.,r);
        vec3 fire=mix(vec3(.10,.05,.04),p_explosionRed*1.1,smoothstep(0.,.22,f));fire=mix(fire,p_explosionOrange*1.5,smoothstep(.20,.48,f));fire=mix(fire,p_explosionYellow*2.0,smoothstep(.45,.72,f));fire=mix(fire,vec3(1.,.96,.82)*2.3,smoothstep(.72,1.,f));
        gl_FragColor=vec4(fire,smoothstep(0.,.14,f)*strength);
       } else
       gl_FragColor=vec4(color,max(body,puff*.55)*strength*(1.-smoothstep(.9,1.,r)));}`,
    }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
  }
  update(time, position, size, strength) {
    this.mesh.visible = strength > .01; if (!this.mesh.visible) return;
    this.mesh.position.copy(position); this.uniforms.time.value = time; this.uniforms.strength.value = Math.min(1, strength); this.uniforms.size.value = size;
  }
}
