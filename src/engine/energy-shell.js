import { shaderPalette } from './palette.js';
import * as THREE from 'three';
// Layered flame silhouette: tapered geometric tongues, not a blurred bubble.
export class EnergyShell {
 constructor(scene){
  this.root=new THREE.Group();this.root.visible=false;scene.add(this.root);
  this.count=22;this.rows=12;const count=this.count*(this.rows+1)*2,uv=new Float32Array(count*2),seed=new Float32Array(count),indices=[];
  for(let i=0;i<this.count;i++)for(let j=0;j<=this.rows;j++)for(let side=0;side<2;side++){
   const n=(i*(this.rows+1)+j)*2+side;uv.set([side,j/this.rows],n*2);seed[n]=i*.618033%1;
   if(j<this.rows&&!side)indices.push(n,n+1,n+2,n+1,n+3,n+2);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('seed',new THREE.BufferAttribute(seed,1));geometry.setIndex(indices);
  this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},strength:{value:0}},
   vertexShader:'attribute float seed;varying vec2 vUv;varying float vSeed;varying float vFront;void main(){vUv=uv;vSeed=seed;vec4 world=modelMatrix*vec4(position,1.);vec3 radial=normalize(mat3(modelMatrix)*vec3(position.x,0.,position.z));vFront=dot(radial,normalize(cameraPosition-world.xyz));gl_Position=projectionMatrix*viewMatrix*world;}',
   fragmentShader:shaderPalette+`uniform float time;uniform float strength;varying vec2 vUv;varying float vSeed;varying float vFront;
   void main(){float x=abs(vUv.x*2.-1.);float flow=sin(vUv.y*23.-time*6.+vSeed*29.+sin(vUv.y*11.-time*3.)*2.);
   float edge=1.-smoothstep(.68,.98,x);float vein=pow(max(0.,1.-abs(x-.58-flow*.09)*9.),3.);
   float fade=smoothstep(0.,.09,vUv.y)*(1.-smoothstep(.78,1.,vUv.y));
   vec3 gold=mix(p_superSaiyanGold*1.5,p_brightAuraYellow*2.4,smoothstep(-.25,.8,flow));
   gold+=vein*p_auraGlowCream*1.3;float facing=1.-smoothstep(.0,.65,vFront)*.93;gl_FragColor=vec4(gold,fade*edge*strength*(.28+vein*.18)*facing);}`});
  this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.frustumCulled=false;this.root.add(this.mesh);
 }
 update(time,power,effects,position,wind={x:0,z:0}){
  const strength=Math.max(0,(power-.3)/.7)*effects;this.root.visible=strength>.01;this.root.position.copy(position);if(!this.root.visible)return;
  this.material.uniforms.time.value=time;this.material.uniforms.strength.value=strength;
  const a=this.mesh.geometry.attributes.position;
  for(let i=0;i<this.count;i++){
   const seed=i*.618033%1,baseAngle=i*2.39996;
   for(let j=0;j<=this.rows;j++){
    const u=j/this.rows,angle=baseAngle+Math.sin(time*1.4+u*3+seed*6)*.10*u,height=1.85+seed*.82+Math.sin(time*2.8+i)*.04;
    const rad=(.29+Math.sin(u*Math.PI)*(.20+power*.16)+u*.14);
    const sway=Math.sin(u*11-time*4+i)*.075*u+Math.sin(u*26-time*6+i)*.025*u;
    const width=(.14+seed*.10)*Math.pow(1-u,.75)*(.7+power*.6);
    for(let side=0;side<2;side++){const w=(side*2-1)*width;a.setXYZ((i*(this.rows+1)+j)*2+side,Math.sin(angle)*(rad+sway)+Math.cos(angle)*w+wind.x*u*u,u*height,Math.cos(angle)*(rad+sway)-Math.sin(angle)*w+wind.z*u*u);}
   }
  }a.needsUpdate=true;
 }
}
