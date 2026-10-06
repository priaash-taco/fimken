import { paletteColor, shaderPalette } from './palette.js';
import * as THREE from 'three';
const Z=new THREE.Vector3(0,0,1),UP=new THREE.Vector3(0,1,0);
export class StrikeEffects {
  constructor(scene){
    this.root=new THREE.Group();this.root.visible=false;scene.add(this.root);this.age=99;
    this.trails=['leftHand','rightHand','rightFoot'].map((role,i)=>{
      const geometry=new THREE.BufferGeometry(),indices=[],uv=new Float32Array(24*4);
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(24*6),3));
      for(let j=0;j<24;j++){uv.set([0,j/23,1,j/23],j*4);if(j<23)indices.push(j*2,j*2+1,j*2+2,j*2+1,j*2+3,j*2+2);}
      geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);
      const mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
        uniforms:{strength:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:shaderPalette+'varying vec2 vUv;uniform float strength;void main(){float edge=pow(max(0.,1.-abs(vUv.x*2.-1.)),1.5);gl_FragColor=vec4(p_kamehamehaBlue*2.0,edge*(1.-vUv.y)*strength*.48);}'
      }));mesh.frustumCulled=false;this.root.add(mesh);return {role,mesh,history:[],width:i===2?.07:.042};
    });
    this.pulse=new THREE.Mesh(new THREE.RingGeometry(.07,.092,48),new THREE.MeshBasicMaterial({color:paletteColor('explosionYellow',2.4),transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));this.root.add(this.pulse);
  }
  reset(){this.age=99;for(const t of this.trails)t.history=[];this.root.visible=false;}
  update(dt,time,actor,direction,effects,paused){
    this.root.visible=effects>.001;
    const hit=direction.signals?.impact;
    if(!paused && hit){this.age=0;actor.anchor(hit.limb,this.pulse.position);this.pulse.quaternion.setFromUnitVectors(Z,actor.energyDirection());}
    if(!paused)this.age+=dt;
    this.pulse.visible=this.age<.20;this.pulse.scale.setScalar(.7+this.age*7);this.pulse.material.opacity=Math.max(0,1-this.age/.2)*effects*.6;
    this.trails.forEach((trail,i)=>{
      const strength=(direction.signals?.trails?.[i]||0)*effects;
      if(!paused){
        if(strength<.01){trail.history=[];}else{
          const position=actor.anchor(trail.role);if(trail.history[0]?.position.distanceTo(position)>.9)trail.history=[];
          trail.history.unshift({position,time});trail.history=trail.history.filter(p=>time-p.time<.22).slice(0,24);
        }
      }
      trail.mesh.visible=trail.history.length>1 && strength>.01;trail.mesh.material.uniforms.strength.value=strength;
      const vertices=trail.mesh.geometry.attributes.position;
      for(let j=0;j<24 && trail.history.length;j++){
        const sample=trail.history[Math.min(j,trail.history.length-1)].position,next=trail.history[Math.min(j+1,trail.history.length-1)].position;
        const across=new THREE.Vector3().subVectors(next,sample).cross(UP);if(across.lengthSq()<1e-8)across.set(1,0,0);across.normalize().multiplyScalar(trail.width*(1-j/24));
        vertices.setXYZ(j*2,sample.x-across.x,sample.y-across.y,sample.z-across.z);vertices.setXYZ(j*2+1,sample.x+across.x,sample.y+across.y,sample.z+across.z);
      }vertices.needsUpdate=true;
    });
  }
}
