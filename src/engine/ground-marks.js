import { shaderPalette } from './palette.js';
import * as THREE from 'three';
// What a hit leaves on the ground: a ring of dust thrown outward, and radial cracks that
// glow hot and cool over a few seconds. One of each is reused for the latest impact.
const noise = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
export class GroundMarks {
  constructor(scene){
    this.uniforms={age:{value:99},strength:{value:0}};
    // Cracks: dark fissures radiating from the centre with an ember glow that fades.
    this.cracks=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthWrite:false,
      vertexShader:'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:shaderPalette+`uniform float age;uniform float strength;varying vec2 vP;${noise}
      void main(){float r=length(vP),a=atan(vP.y,vP.x);
       // Spokes with jagged offsets, thinning outward; a few concentric breaks.
       // Seven jagged fissures, thinning outward, with a couple of short cross-breaks.
       float spoke=abs(fract(a*1.11+noise3(vec3(r*5.,a*1.5,1.))*.7+noise3(vec3(r*14.,a*4.,5.))*.25)-.5),ring=abs(fract(r*3.1+noise3(vec3(a*3.,r*5.,2.))*.6)-.5);
       float crack=max(smoothstep(.05*(1.-r*.7),.0,spoke),smoothstep(.025,.0,ring)*step(.3,r)*noise3(vec3(a*4.,r*3.,9.)))*(1.-smoothstep(.5,.92,r))*step(.001,r);
       float reach=smoothstep(0.,.25,age);crack*=step(r,reach);
       float glow=exp(-max(age,0.)*1.7);
       vec3 color=mix(vec3(.015,.01,.008),mix(p_explosionRed,p_explosionOrange,.5)*1.1,glow);
       gl_FragColor=vec4(color,crack*strength*(.8-smoothstep(4.,8.,age)*.8));}`}));
    this.cracks.rotation.x=-Math.PI/2;this.cracks.renderOrder=-7;this.cracks.visible=false;scene.add(this.cracks);
    // Dust ring: points thrown outward and up, settling as they fade.
    const count=160,seeds=new Float32Array(count);for(let i=0;i<count;i++)seeds[i]=(i*.618033)%1;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
    this.dust=new THREE.Points(geometry,new THREE.ShaderMaterial({uniforms:{opacity:{value:0}},transparent:true,depthWrite:false,
      vertexShader:'attribute float seed;varying float vSeed;void main(){vSeed=seed;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp((3.+seed*6.)*18./-mv.z,2.,22.);gl_Position=projectionMatrix*mv;}',
      fragmentShader:shaderPalette+'varying float vSeed;uniform float opacity;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(mix(p_smokeGray,p_rockBrown,vSeed)*1.1,(1.-smoothstep(.4,1.,d))*opacity*.55);}'}));
    this.dust.frustumCulled=false;this.dust.visible=false;scene.add(this.dust);
  }
  update(mood,effects){
    const age=mood.impactAge,strength=mood.impactStrength*effects,live=age>=0&&age<9&&strength>.01;
    this.cracks.visible=live;this.dust.visible=live&&age<1.6;
    if(!live)return;
    this.cracks.position.set(mood.impactPoint.x,.02,mood.impactPoint.z);this.cracks.scale.setScalar(.7+strength*.9);
    this.uniforms.age.value=age;this.uniforms.strength.value=strength;
    const a=this.dust.geometry.attributes.position,t=Math.min(1.6,age);
    for(let i=0;i<a.count;i++){const seed=(i*.618033)%1,angle=i*2.39996,reach=(.4+seed*1.3)*(1-Math.exp(-t*3.2))*(1+strength),up=Math.max(0,(.6+seed*.8)*t-1.6*t*t);
      a.setXYZ(i,mood.impactPoint.x+Math.sin(angle)*reach,.05+up,mood.impactPoint.z+Math.cos(angle)*reach);}
    a.needsUpdate=true;this.dust.material.uniforms.opacity.value=strength*(1-t/1.6);
  }
}
