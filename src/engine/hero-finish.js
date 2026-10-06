import { PALETTE } from './palette.js';
import * as THREE from 'three';
// Keep authored 4K albedo/normal maps. Band direct diffuse lighting gently, retaining
// shadow maps and point-light response; a skinned inverted hull draws the silhouette.
export class HeroFinish {
  constructor(model){
    this.enabled={value:0};this.width={value:.0022};this.outlines=[];this.glow={value:0};this.glowHulls=[];
    // Hair sway: the asset has no hair bones, so hair-only vertices (spikes, back of the head) are
    // offset in the vertex shader by a spring that lags the head's motion. Face vertices never move.
    this.sway={value:new THREE.Vector3()};this.model=model;this.headPrev=new THREE.Vector3();this.swayState={x:new THREE.Vector3(),v:new THREE.Vector3()};this.swayStarted=false;
    const meshes=[];model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
    const addSway=shader=>{shader.uniforms.hairSway=this.sway;shader.vertexShader='uniform vec3 hairSway;\nattribute float sway;\n'+shader.vertexShader.replace('#include <skinning_vertex>','#include <skinning_vertex>\n transformed += hairSway * sway;');};
    for(const mesh of meshes){
      const geometry=mesh.geometry;
      if(!geometry.attributes.sway){
        const pos=geometry.attributes.position,si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight,head=mesh.skeleton.bones.findIndex(b=>b.name===THREE.PropertyBinding.sanitizeNodeName('head'));
        const weights=new Float32Array(pos.count),smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
        for(let i=0;i<pos.count;i++){
          let headWeight=0;for(let k=0;k<4;k++)if(si.getComponent(i,k)===head)headWeight+=sw.getComponent(i,k);
          const y=pos.getY(i),z=pos.getZ(i);
          if(headWeight<.6||y<1.78||(z>.04&&y<2.04)){weights[i]=0;continue;}
          // Spikes grow looser toward their tips; the back of the head moves a little.
          weights[i]=Math.max(smooth(1.94,2.28,y),smooth(1.85,2.0,y)*smooth(.02,-.08,z)*.55);
        }
        geometry.setAttribute('sway',new THREE.BufferAttribute(weights,1));
      }
    }
    for(const mesh of meshes){
      for(const material of [mesh.material].flat()){
        const before=material.onBeforeCompile;
        material.onBeforeCompile=shader=>{
          before.call(material,shader);shader.uniforms.heroCel=this.enabled;addSway(shader);
          shader.fragmentShader='uniform float heroCel;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
          float heroL = max(.0001, dot(reflectedLight.directDiffuse, vec3(.2126,.7152,.0722)));
          float heroBand = mix(.26, .60, smoothstep(.27,.32,heroL));
          heroBand = mix(heroBand, 1.0, smoothstep(.67,.74,heroL));
          reflectedLight.directDiffuse *= mix(1.0, mix(1.0,clamp(heroBand/heroL,.6,1.22),.7),heroCel);`);
        };
        material.customProgramCacheKey=()=> 'fimken-hero-cel-v3';material.needsUpdate=true;
      }
      const ink=new THREE.MeshStandardMaterial({color:PALETTE.animeBlack,emissive:'#08060d',side:THREE.BackSide,roughness:1});
      ink.onBeforeCompile=shader=>{shader.uniforms.inkWidth=this.width;addSway(shader);shader.vertexShader='uniform float inkWidth;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','transformed += normalize(objectNormal) * inkWidth;\n#include <project_vertex>');};
      const outline=new THREE.SkinnedMesh(mesh.geometry,ink);outline.name='Hero silhouette ink';
      outline.position.copy(mesh.position);outline.quaternion.copy(mesh.quaternion);outline.scale.copy(mesh.scale);
      outline.bind(mesh.skeleton,mesh.bindMatrix);outline.frustumCulled=false;outline.visible=false;
      mesh.parent.add(outline);this.outlines.push(outline);
      // Energy glow hugging the silhouette: the same hull pushed out further, additive, strongest at grazing angles.
      const aura=new THREE.ShaderMaterial({uniforms:{glow:this.glow,hairSway:this.sway},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.FrontSide,
        vertexShader:`#include <common>
        #include <skinning_pars_vertex>
        varying float vRim;
        uniform vec3 hairSway;attribute float sway;
        void main(){
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        transformed += hairSway * sway;
        transformed+=normalize(objectNormal)*.012;
        vec4 mv=modelViewMatrix*vec4(transformed,1.);vec3 n=normalize(normalMatrix*objectNormal);vRim=1.-abs(dot(n,normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}`,
        fragmentShader:`uniform float glow;varying float vRim;void main(){float rim=pow(clamp(vRim,0.,1.),2.2);gl_FragColor=vec4(mix(vec3(1.,.72,.25),vec3(1.,.95,.75),rim)*2.4*rim,rim*glow);}`});
      const hull=new THREE.SkinnedMesh(mesh.geometry,aura);hull.name='Hero energy glow';
      hull.position.copy(mesh.position);hull.quaternion.copy(mesh.quaternion);hull.scale.copy(mesh.scale);
      hull.bind(mesh.skeleton,mesh.bindMatrix);hull.frustumCulled=false;hull.visible=false;mesh.parent.add(hull);this.glowHulls.push(hull);
    }
  }
  // Called each frame with the head's world position: a loose spring follows the head's velocity.
  updateSway(dt,headWorld,lift=0){
    if(!(dt>0)){return;}
    if(!this.swayStarted){this.headPrev.copy(headWorld);this.swayStarted=true;}
    const velocity=headWorld.clone().sub(this.headPrev).divideScalar(dt).clampLength(0,7);this.headPrev.copy(headWorld);
    // Strands trail the motion, lift with the aura, and droop slightly under gravity.
    const target=velocity.multiplyScalar(-.032);target.y+=lift*.045-.01;
    const s=this.swayState,w=11,z=.34,steps=Math.max(1,Math.ceil(dt*240)),h=Math.min(dt,.1)/steps;
    for(let i=0;i<steps;i++){const accel=target.clone().sub(s.x).multiplyScalar(w*w).addScaledVector(s.v,-2*z*w);s.v.addScaledVector(accel,h);s.x.addScaledVector(s.v,h);}
    s.x.clampLength(0,.09);
    // World offset to the mesh's own space (the model is uniformly scaled and turned with the root).
    const q=this.model.getWorldQuaternion(new THREE.Quaternion()).invert(),scale=this.model.getWorldScale(new THREE.Vector3()).x||1;
    this.sway.value.copy(s.x).applyQuaternion(q).divideScalar(scale);
  }
  apply(enabled){this.enabled.value=enabled?1:0;for(const o of this.outlines)o.visible=enabled&&this.width.value>0;this.cinematic=enabled;this.setGlow(this.glow.value);}
  setGlow(strength){this.glow.value=strength;for(const h of this.glowHulls)h.visible=Boolean(this.cinematic)&&strength>.01;}
  setWidth(width){this.width.value=width;this.apply(Boolean(this.enabled.value));}
}
