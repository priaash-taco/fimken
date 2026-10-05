import { PALETTE } from './palette.js';
import * as THREE from 'three';
// Keep authored 4K albedo/normal maps. Band direct diffuse lighting gently, retaining
// shadow maps and point-light response; a skinned inverted hull draws the silhouette.
export class HeroFinish {
  constructor(model){
    this.enabled={value:0};this.width={value:.0022};this.outlines=[];this.glow={value:0};this.glowHulls=[];
    const meshes=[];model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
    for(const mesh of meshes){
      for(const material of [mesh.material].flat()){
        const before=material.onBeforeCompile;
        material.onBeforeCompile=shader=>{
          before.call(material,shader);shader.uniforms.heroCel=this.enabled;
          shader.fragmentShader='uniform float heroCel;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
          float heroL = max(.0001, dot(reflectedLight.directDiffuse, vec3(.2126,.7152,.0722)));
          float heroBand = mix(.26, .60, smoothstep(.27,.32,heroL));
          heroBand = mix(heroBand, 1.0, smoothstep(.67,.74,heroL));
          reflectedLight.directDiffuse *= mix(1.0, mix(1.0,clamp(heroBand/heroL,.6,1.22),.7),heroCel);`);
        };
        material.customProgramCacheKey=()=> 'fimken-hero-cel-v2';material.needsUpdate=true;
      }
      const ink=new THREE.MeshStandardMaterial({color:PALETTE.animeBlack,emissive:'#08060d',side:THREE.BackSide,roughness:1});
      ink.onBeforeCompile=shader=>{shader.uniforms.inkWidth=this.width;shader.vertexShader='uniform float inkWidth;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','transformed += normalize(objectNormal) * inkWidth;\n#include <project_vertex>');};
      const outline=new THREE.SkinnedMesh(mesh.geometry,ink);outline.name='Hero silhouette ink';
      outline.position.copy(mesh.position);outline.quaternion.copy(mesh.quaternion);outline.scale.copy(mesh.scale);
      outline.bind(mesh.skeleton,mesh.bindMatrix);outline.frustumCulled=false;outline.visible=false;
      mesh.parent.add(outline);this.outlines.push(outline);
      // Energy glow hugging the silhouette: the same hull pushed out further, additive, strongest at grazing angles.
      const aura=new THREE.ShaderMaterial({uniforms:{glow:this.glow},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.FrontSide,
        vertexShader:`#include <common>
        #include <skinning_pars_vertex>
        varying float vRim;
        void main(){
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        transformed+=normalize(objectNormal)*.012;
        vec4 mv=modelViewMatrix*vec4(transformed,1.);vec3 n=normalize(normalMatrix*objectNormal);vRim=1.-abs(dot(n,normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}`,
        fragmentShader:`uniform float glow;varying float vRim;void main(){float rim=pow(clamp(vRim,0.,1.),2.2);gl_FragColor=vec4(mix(vec3(1.,.72,.25),vec3(1.,.95,.75),rim)*2.4*rim,rim*glow);}`});
      const hull=new THREE.SkinnedMesh(mesh.geometry,aura);hull.name='Hero energy glow';
      hull.position.copy(mesh.position);hull.quaternion.copy(mesh.quaternion);hull.scale.copy(mesh.scale);
      hull.bind(mesh.skeleton,mesh.bindMatrix);hull.frustumCulled=false;hull.visible=false;mesh.parent.add(hull);this.glowHulls.push(hull);
    }
  }
  apply(enabled){this.enabled.value=enabled?1:0;for(const o of this.outlines)o.visible=enabled&&this.width.value>0;this.cinematic=enabled;this.setGlow(this.glow.value);}
  setGlow(strength){this.glow.value=strength;for(const h of this.glowHulls)h.visible=Boolean(this.cinematic)&&strength>.01;}
  setWidth(width){this.width.value=width;this.apply(Boolean(this.enabled.value));}
}
