import * as THREE from 'three';
import { shaderPalette } from './palette.js';
// Distant celestial bodies with baked surface maps and stable, local lighting.
export class CosmicWorld {
 constructor(scene){
  this.root=new THREE.Group();this.root.name='Cosmic space';scene.add(this.root);
  const loader=new THREE.TextureLoader(),base='/environment/cosmos/';
  const map=name=>{const t=loader.load(base+name);t.colorSpace=THREE.SRGBColorSpace;return t;};
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(65,64,32),new THREE.MeshBasicMaterial({map:map('nebula-stars.jpg'),side:THREE.BackSide,depthWrite:false,fog:false}));
  this.sky.rotation.y=1.8;this.sky.renderOrder=-10;this.root.add(this.sky);
  // Atmosphere over the starfield: sky blues at the horizon deepening to royal blue and purple
  // overhead, with banded clouds. It thins toward the zenith so the stars stay visible there.
  this.air={time:{value:0},contrast:{value:1},darken:{value:0}};
  this.atmosphere=new THREE.Mesh(new THREE.SphereGeometry(58,48,32),new THREE.ShaderMaterial({uniforms:this.air,side:THREE.BackSide,transparent:true,depthWrite:false,fog:false,
   vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:shaderPalette+`uniform float time;uniform float contrast;uniform float darken;varying vec3 vDir;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   float fbm(vec2 p){return .55*noise2(p)+.28*noise2(p*2.1)+.17*noise2(p*4.3);}
   void main(){vec3 d=normalize(vDir);float h=d.y;
    vec3 color=mix(p_dbzSkyBlue,p_deepSkyBlue,smoothstep(0.,.22,h));color=mix(color,p_deepRoyalBlue,smoothstep(.18,.5,h));color=mix(color,p_deepFriezaPurple*.7,smoothstep(.45,.95,h));
    float alpha=mix(.86,.30,smoothstep(.05,.75,h));
    vec2 uv=d.xz/(max(h,0.)+.22)*1.3+vec2(time*.004,0.);float cover=fbm(uv)+.22*noise2(uv*7.)+.08*noise2(uv*19.);
    float cloud=smoothstep(.62,.66,cover)*smoothstep(.01,.08,h)*(1.-smoothstep(.30,.55,h));
    // Three tones: shaded underside, body, sunlit rim where the cover is thickest.
    float body=smoothstep(.68,.73,cover),lit=smoothstep(.76,.82,cover+.06*noise2(uv*3.+vec2(0.,.4)));
    vec3 cloudColor=mix(mix(p_friezaPurple,p_deepSkyBlue,.45)*.85,mix(p_cloudWhite,p_dbzSkyBlue,.25)*1.05,body);cloudColor=mix(cloudColor,p_cloudWhite*1.2,lit);
    color=mix(color,cloudColor,cloud);
    color=(color-.12)*contrast+.12;color*=1.-darken;
    gl_FragColor=vec4(color*.46,max(alpha,cloud*.95));}`}));
  this.atmosphere.renderOrder=-9;this.root.add(this.atmosphere);
  const normalMap=loader.load(base+'lunar-normal.png');
  // LRO surface data, isolated from the character's purple/blue fill lights.
  const moonMaterial=new THREE.MeshStandardMaterial({map:map('lunar-color.png'),normalMap,normalScale:new THREE.Vector2(1,-1),roughness:1,metalness:0,envMapIntensity:0,fog:false});
  moonMaterial.onBeforeCompile=shader=>{
   shader.uniforms.lunarLight={value:new THREE.Vector3(13.2,1,-7).normalize()};
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 lunarLight;').replace('#include <opaque_fragment>',`
    vec3 lightView = (viewMatrix * vec4(lunarLight,0.0)).xyz;
    float diffuseMoon = max(dot(normal,lightView),0.0);
    outgoingLight = diffuseColor.rgb * (0.022 + diffuseMoon * 1.8);
    #include <opaque_fragment>
   `);
  };
  this.moon=new THREE.Mesh(new THREE.SphereGeometry(1.45,96,64),moonMaterial);
  this.moon.position.set(-11,15,-34);this.moon.rotation.set(.12,-Math.PI*.5,-.15);this.root.add(this.moon);
  this.sunDim={value:1};
  const solarMaterial=new THREE.ShaderMaterial({uniforms:{surface:{value:map('solar-photosphere.jpg')},dim:this.sunDim},vertexShader:`
   varying vec2 vUv; varying vec3 vNormal; varying vec3 vEye;
   void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vEye=-p.xyz;gl_Position=projectionMatrix*p;}
  `,fragmentShader:`
   uniform sampler2D surface; uniform float dim; varying vec2 vUv; varying vec3 vNormal; varying vec3 vEye;
   void main(){
    float mu=max(dot(normalize(vNormal),normalize(vEye)),0.0);
    float limb=0.32+0.68*pow(mu,0.48);
    vec3 color=texture2D(surface,vUv).rgb;
    gl_FragColor=vec4(color*limb*2.1*dim,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `});
  this.sun=new THREE.Mesh(new THREE.SphereGeometry(1.15,80,48),solarMaterial);
  this.sun.position.set(13,19,-40);this.root.add(this.sun);
  // A restrained, irregular corona: no full-screen pulse or animated exposure.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d'),pixels=c.createImageData(512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
   const dx=(x-255.5)/256,dy=(y-255.5)/256,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx),edge=.4;
   const stream=.045+.024*Math.pow(.5+.5*Math.sin(a*7+Math.sin(a*3)*1.6),3)+.013*Math.sin(a*19)**2;
   const alpha=r<edge?0:Math.exp(-(r-edge)/stream)*.64;
   const i=(y*512+x)*4;pixels.data.set([255,197,114,Math.round(alpha*255)],i);
  }
  c.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  this.corona=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));this.corona.position.copy(this.sun.position);this.corona.scale.set(6,6,1);this.root.add(this.corona);
  // A few nearer stars give camera travel subtle parallax, without twinkling.
  const p=new Float32Array(360*3);
  for(let i=0;i<360;i++){const angle=i*2.39996,lat=Math.sin(i*1.73)*.75,r=32+(i%7)*2;p.set([Math.cos(angle)*r,Math.sin(lat)*r*.6+5,Math.sin(angle)*r],i*3);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));
  this.stars=new THREE.Points(geo,new THREE.PointsMaterial({color:'#bac9ff',size:.025,transparent:true,opacity:.7,depthWrite:false,fog:false}));this.root.add(this.stars);
 }
 setInspection(enabled){this.root.visible=!enabled;}
 update(time){this.sun.rotation.y=time*.003;this.air.time.value=time;}
 setMood(mood,effects){const l=mood.levels;
  // Brighter and bigger in a power-up; dimmed and shrunk behind a charge or beam.
  const glow=1+(l.powerUp*.25-l.charge*.45-l.release*.6)*effects;this.sunDim.value=Math.max(.25,glow);
  this.corona.material.opacity=Math.max(.2,1+(l.powerUp*.3-l.charge*.5-l.release*.7)*effects);this.corona.scale.setScalar(6*(1+l.powerUp*.15*effects));
  this.moon.scale.setScalar(1+l.powerUp*.05*effects);}
}
