import { PALETTE, paletteColor, shaderPalette } from './palette.js';
import * as THREE from 'three';
import { EnergyMotion, beamSection, deformBeam } from './energy-motion.js';
import { beamEnvelope } from './beam-envelope.js';
import { EnergyShell } from './energy-shell.js';
import { StrikeEffects } from './strike-effects.js';
import { EnergyFlame } from './energy-flame.js';
import { EnergyBurst } from './energy-burst.js';
import { rockGeometry } from './rock-geometry.js';

const noise = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return .57*noise3(p)+.28*noise3(p*2.03)+.15*noise3(p*4.07);}`;
const up = new THREE.Vector3(0,1,0);
export class VFXDirector {
  constructor(scene) {
    this.motion=new EnergyMotion();this.strikes=new StrikeEffects(scene);this.flames=new EnergyShell(scene);this.blaze=new EnergyFlame(scene);
    this.muzzle=new EnergyBurst(scene,{colors:['spiritGlowWhite','kamehamehaBlue','deepBeamBlue'],rays:1,speed:6,additive:true,detail:3,intensity:.45});
    this.halo=new EnergyBurst(scene,{colors:['kamehamehaCyan','kamehamehaBlue','deepBeamBlue'],rays:1,speed:9,additive:true,detail:4});
    this.impact=new EnergyBurst(scene,{colors:['explosionYellow','explosionOrange','explosionRed'],rays:.6,speed:2.6,smoke:'smokeGray',intensity:1.25});
    // Impact dressing: flying embers, a blue shock ring and firelight on the rocks.
    const emberSeeds=new Float32Array(180);for(let i=0;i<180;i++)emberSeeds[i]=(i*.618033)%1;
    const emberGeometry=new THREE.BufferGeometry();emberGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(180*3),3));emberGeometry.setAttribute('seed',new THREE.BufferAttribute(emberSeeds,1));
    this.embers=new THREE.Points(emberGeometry,new THREE.ShaderMaterial({uniforms:{power:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'attribute float seed;varying float vSeed;void main(){vSeed=seed;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp((2.+seed*5.)*16./-mv.z,2.,16.);gl_Position=projectionMatrix*mv;}',
      fragmentShader:shaderPalette+'varying float vSeed;uniform float power;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(mix(p_explosionYellow*2.6,p_explosionRed*1.8,vSeed),(1.-smoothstep(.5,1.,d))*power);}'}));
    this.embers.frustumCulled=false;this.embers.visible=false;scene.add(this.embers);
    this.shockRing=new THREE.Mesh(new THREE.TorusGeometry(1,.018,6,96),new THREE.MeshBasicMaterial({color:paletteColor('kamehamehaCyan',2.4),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));this.shockRing.visible=false;scene.add(this.shockRing);
    this.firelight=new THREE.PointLight(PALETTE.explosionOrange,0,14,2);this.firelight.visible=false;scene.add(this.firelight);
    this.root = new THREE.Group(); scene.add(this.root);
    this.auraUniforms = { time: { value: 0 }, strength: { value: 0 } };
    this.anchorRoles = ['hips','chest','leftHand','rightHand','leftUpperArm','rightUpperArm','leftLowerLeg','rightLowerLeg'];
    this.anchors = this.anchorRoles.map(() => new THREE.Vector3());
    this.ribbonCount = 32; this.ribbonRows = 16;
    const vertices = this.ribbonCount * (this.ribbonRows+1) * 2;
    const positions = new Float32Array(vertices*3), uv = new Float32Array(vertices*2), ribbonSeeds = new Float32Array(vertices), indices=[];
    for (let ribbon=0;ribbon<this.ribbonCount;ribbon++) for (let row=0;row<=this.ribbonRows;row++) for(let side=0;side<2;side++) {
      const i=(ribbon*(this.ribbonRows+1)+row)*2+side;
      uv.set([side,row/this.ribbonRows],i*2);ribbonSeeds[i]=(ribbon*.618033)%1;
      if(row<this.ribbonRows && side===0) indices.push(i,i+1,i+2,i+1,i+3,i+2);
    }
    const ribbons = new THREE.BufferGeometry();
    ribbons.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    ribbons.setAttribute('uv',new THREE.BufferAttribute(uv,2));ribbons.setAttribute('seed',new THREE.BufferAttribute(ribbonSeeds,1));ribbons.setIndex(indices);
    this.aura = new THREE.Mesh(ribbons,new THREE.ShaderMaterial({
      uniforms:this.auraUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:'attribute float seed;varying vec2 vUv;varying float vSeed;void main(){vUv=uv;vSeed=seed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:shaderPalette+`uniform float time;uniform float strength;varying vec2 vUv;varying float vSeed;${noise}
      void main(){float n=fbm(vec3(vUv.x*4.+vSeed*23.,vUv.y*6.-time*2.7,vSeed*9.));
      float core=pow(max(0.,1.-abs(vUv.x*2.-1.)),2.8);
      float taper=smoothstep(0.,.10,vUv.y)*(1.-smoothstep(.25,1.,vUv.y));
      float strands=smoothstep(.28,.68,n)*core*taper;
      vec3 color=mix(p_kamehamehaBlue*2.2,p_superSaiyanGold*2.3,step(.22,vSeed));
      gl_FragColor=vec4(color,strands*strength*.55);}`,
    }));this.aura.frustumCulled=false;this.root.add(this.aura);
    this.envelope=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),new THREE.ShaderMaterial({
      uniforms:this.auraUniforms,transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending,
      vertexShader:`uniform float time;uniform float strength;varying vec3 vNormal;varying vec3 vView;varying vec3 vP;
      void main(){vec3 p=position;float wave=sin(p.y*14.-time*4.+p.x*9.)*.035+sin(p.y*27.-time*7.+p.z*11.)*.016;p.xz*=1.+wave*strength;
      vP=p;vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(p,1.);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:shaderPalette+`uniform float time;uniform float strength;varying vec3 vNormal;varying vec3 vView;varying vec3 vP;${noise}
      void main(){float rim=pow(clamp(1.-abs(dot(normalize(vNormal),normalize(vView))),0.,1.),2.3);float flame=fbm(vec3(vP.x*9.,vP.y*5.-time*2.,vP.z*9.));
      float fade=smoothstep(-1.,-.75,vP.y)*(1.-smoothstep(.7,1.,vP.y));
      vec3 color=mix(p_gokuOrange,p_brightAuraYellow*2.3,flame);
      gl_FragColor=vec4(color,rim*fade*smoothstep(.45,.72,flame)*strength*.12);}`,
    }));this.envelope.position.y=1.10;this.root.add(this.envelope);
    const sparkPositions = new Float32Array(560*3), seeds = new Float32Array(560);
    for(let i=0;i<560;i++) seeds[i]=(i*.618033)%1;
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));
    sparkGeometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
    this.sparks = new THREE.Points(sparkGeometry,new THREE.ShaderMaterial({
      uniforms:{power:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'attribute float seed;varying float vSeed;void main(){vSeed=seed;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp((1.+seed*2.)*9./-mv.z,1.,7.);gl_Position=projectionMatrix*mv;}',
      fragmentShader:shaderPalette+'varying float vSeed;uniform float power;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*5.)*(1.-smoothstep(.6,1.,d));gl_FragColor=vec4(mix(p_superSaiyanGold*1.8,p_goldenHighlight*2.7,vSeed),a*power);}',
    })); this.root.add(this.sparks);
    this.orbUniforms={time:{value:0},strength:{value:0}};
    this.ball=new THREE.Mesh(new THREE.SphereGeometry(.095,64,48),new THREE.ShaderMaterial({
      uniforms:this.orbUniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`uniform float time;varying vec3 n;varying vec3 v;varying vec3 p;
      void main(){p=position;vec3 q=position;float surge=sin(position.y*130.-time*13.+sin(position.x*110.+time*5.)*2.);
      q*=1.+surge*.035;n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(q,1.);v=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:shaderPalette+`uniform float time;uniform float strength;varying vec3 n;varying vec3 v;varying vec3 p;${noise}
      void main(){float facing=min(1.,abs(dot(normalize(n),normalize(v))));float edge=pow(clamp(1.-facing,0.,1.),1.3);
      float flow=fbm(p*48.+vec3(time*1.2,-time*4.,time*.7));
      float curl=sin(p.y*160.-time*12.+flow*9.+p.x*70.);
      float vein=pow(max(0.,1.-abs(curl)),12.);
      float core=pow(facing,9.)*(.72+flow*.28);
      vec3 color=mix(p_deepBeamBlue*1.6,p_kamehamehaBlue*1.6,smoothstep(.25,.7,flow));
      color=mix(color,mix(p_deepBeamBlue,p_friezaPurple,.35)*1.7,edge);color+=pow(core,2.5)*p_spiritGlowWhite*2.2+vein*p_kamehamehaCyan*1.2;
      gl_FragColor=vec4(color,strength*(.78+flow*.22));}`,
    })); scene.add(this.ball);
    this.corona=new THREE.Mesh(new THREE.SphereGeometry(.13,48,32),new THREE.ShaderMaterial({
      uniforms:this.orbUniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`uniform float time;varying vec3 n;varying vec3 v;varying vec3 p;void main(){p=position;vec3 q=position*(1.+.10*sin(position.y*145.-time*9.+position.x*95.));n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(q,1.);v=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:shaderPalette+`uniform float time;uniform float strength;varying vec3 n;varying vec3 v;varying vec3 p;${noise}
      void main(){float rim=pow(clamp(1.-abs(dot(normalize(n),normalize(v))),0.,1.),2.);float f=fbm(p*70.+vec3(time*3.,-time*5.,0.));
      gl_FragColor=vec4(p_kamehamehaBlue*2.4,rim*smoothstep(.32,.72,f)*strength*.6);}`,
    }));scene.add(this.corona);
    this.orbitArcs=[];
    for(let i=0;i<3;i++){
      const arc=new THREE.Mesh(new THREE.TorusGeometry(.155+i*.015,.002,6,96,Math.PI*1.55),new THREE.MeshBasicMaterial({color:paletteColor('kamehamehaCyan',2.2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
      scene.add(arc);this.orbitArcs.push(arc);
    }
    const beamMaterial=new THREE.ShaderMaterial({
      uniforms:{time:{value:0},strength:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:shaderPalette+`varying vec2 vUv;uniform float time;uniform float strength;${noise}
      void main(){float n=fbm(vec3(vUv.x*12.,vUv.y*15.-time*5.,time*.7));float streak=pow(max(0.,.5+.5*sin(vUv.x*45.+n*5.+vUv.y*4.)),5.);
      // Fine filaments racing along the beam, two frequencies, over the broad streaks.
      float fine=pow(max(0.,.5+.5*sin(vUv.x*220.+n*9.+vUv.y*30.-time*22.)),9.)+.6*pow(max(0.,.5+.5*sin(vUv.x*130.-n*6.+vUv.y*12.-time*15.)),7.);
      float ends=smoothstep(0.,.035,vUv.y)*(1.-smoothstep(.85,1.,vUv.y));
      vec3 color=mix(mix(p_friezaPurple,p_deepBeamBlue,.4)*1.6,p_deepBeamBlue*1.8,streak);color=mix(color,p_kamehamehaBlue*2.0,clamp(fine,0.,1.)*.6);
      gl_FragColor=vec4(color,ends*(.35+streak*.55+fine*.25)*strength);}`,
    });
    this.beam=new THREE.Mesh(new THREE.CylinderGeometry(.30,.18,1,48,32,true),beamMaterial);scene.add(this.beam);
    // A wider sheath of forked electricity crawling along the beam, in violet and cyan-white.
    this.sheath=new THREE.Mesh(new THREE.CylinderGeometry(.50,.26,1,48,1,true),new THREE.ShaderMaterial({uniforms:{time:{value:0},strength:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:shaderPalette+`varying vec2 vUv;uniform float time;uniform float strength;${noise}
      void main(){float tick=floor(time*13.),lane=floor(vUv.x*5.);
      float step_=vUv.y*46.,zig=(mix(hash(vec3(floor(step_),tick,lane)),hash(vec3(floor(step_)+1.,tick,lane)),fract(step_))-.5)*.34+(noise3(vec3(vUv.y*5.,tick,lane+9.))-.5)*.5;
      float d=abs(fract(vUv.x*5.+zig)-.5),on=step(.45,hash(vec3(lane,tick,2.)));
      float arc=smoothstep(.045,.008,d)*on*smoothstep(0.,.05,vUv.y)*(1.-smoothstep(.8,1.,vUv.y));
      vec3 color=mix(mix(p_villainVioletGlow,p_spiritGlowWhite,.35),mix(p_kamehamehaCyan,p_spiritGlowWhite,.5),step(.5,hash(vec3(lane,tick,6.))));
      gl_FragColor=vec4(color*2.6,arc*strength);}`}));this.sheath.visible=false;scene.add(this.sheath);
    // Where the beam lands: a ball of blue-white energy, fire climbing from the ground, flung rock.
    this.tip=new EnergyBurst(scene,{colors:['spiritGlowWhite','kamehamehaBlue','deepBeamBlue'],rays:.85,speed:7,additive:true,detail:3});
    this.pyre=new EnergyFlame(scene);
    this.shrapnel=new THREE.InstancedMesh(rockGeometry({detail:1,roughness:.55,seed:21}),new THREE.MeshStandardMaterial({color:PALETTE.rockBrown,roughness:.9,flatShading:true,vertexColors:true}),14);
    this.shrapnel.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.shrapnel.frustumCulled=false;this.shrapnel.visible=false;scene.add(this.shrapnel);this.ground=new THREE.Vector3();
    // The core is hottest along its centre line and falls to blue at its edge, with bright
    // streaks racing down its length, instead of one flat white tube.
    this.core=new THREE.Mesh(new THREE.CylinderGeometry(.14,.075,1,32,32,true),new THREE.ShaderMaterial({uniforms:{time:{value:0},opacity:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}',
      fragmentShader:shaderPalette+`uniform float time;uniform float opacity;varying vec3 vN;varying vec3 vV;varying vec2 vUv;${noise}
      void main(){float facing=clamp(abs(dot(normalize(vN),normalize(vV))),0.,1.);
      float streak=pow(max(0.,noise3(vec3(vUv.x*26.,vUv.y*7.-time*9.,time*.8))),3.);
      vec3 color=mix(mix(p_deepBeamBlue,p_deepRoyalBlue,.4)*1.5,p_kamehamehaBlue*1.5,smoothstep(.3,.7,facing));color=mix(color,p_spiritGlowWhite*2.2,smoothstep(.9,.99,facing)+streak*.25*smoothstep(.6,.95,facing));
      gl_FragColor=vec4(color,smoothstep(.02,.4,facing)*(.8+streak*.4)*opacity*smoothstep(0.,.03,vUv.y));}`}));scene.add(this.core);
    this.pressureRings=Array.from({length:5},()=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.25,.0045,6,64,Math.PI*1.7),new THREE.MeshBasicMaterial({color:paletteColor('kamehamehaCyan',2.3),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));ring.visible=false;scene.add(ring);return ring;
    });
    this.corona.visible=false;for(const a of this.orbitArcs)a.visible=false;
    this.ball.visible=this.beam.visible=this.core.visible=false;
    this.debris=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:PALETTE.debrisBrown,roughness:.95}),28);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.debris.frustumCulled=false;this.debris.castShadow=true;scene.add(this.debris);
    this.debrisTransform=new THREE.Object3D();this.impactPoint=new THREE.Vector3();this.liftUp=new THREE.Vector3();
    // Larger rocks torn from the ground and held aloft at high power.
    this.rocks=new THREE.InstancedMesh(rockGeometry({detail:1,roughness:.5,seed:9}),new THREE.MeshStandardMaterial({color:PALETTE.rockBrown,roughness:.9,flatShading:true,vertexColors:true}),12);
    this.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.rocks.frustumCulled=false;this.rocks.castShadow=true;this.rocks.visible=false;scene.add(this.rocks);
    this.spiral=new THREE.Points(this.sparks.geometry.clone(),this.sparks.material.clone());
    this.spiral.material.fragmentShader=shaderPalette+'varying float vSeed;uniform float power;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(p_kamehamehaCyan*2.5,exp(-d*d*5.)*(1.-smoothstep(.6,1.,d))*power);}';
    this.spiral.geometry.setDrawRange(0,240);scene.add(this.spiral);this.beamAge=0;
    // Charge inflow: sparks drawn from the surrounding air into the hands, accelerating as they arrive.
    const inflowSeeds=new Float32Array(220);for(let i=0;i<220;i++)inflowSeeds[i]=(i*.618033)%1;
    const inflowGeometry=new THREE.BufferGeometry();inflowGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(220*3),3));inflowGeometry.setAttribute('seed',new THREE.BufferAttribute(inflowSeeds,1));
    this.inflow=new THREE.Points(inflowGeometry,new THREE.ShaderMaterial({uniforms:{power:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'attribute float seed;varying float vSeed;void main(){vSeed=seed;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp((1.5+seed*3.)*14./-mv.z,1.,9.);gl_Position=projectionMatrix*mv;}',
      fragmentShader:shaderPalette+'varying float vSeed;uniform float power;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(mix(p_kamehamehaCyan,p_spiritGlowWhite,vSeed)*2.2,(1.-smoothstep(.4,1.,d))*power);}'}));
    this.inflow.frustumCulled=false;this.inflow.visible=false;scene.add(this.inflow);
    // Instances begin with identity matrices (full-size rocks at the origin).
    // Keep every effect hidden until update() has written its first valid frame.
    for(const object of [this.root,this.debris,this.spiral])object.visible=false;
    this.pulseAge=99;this.flashAge=99;this.lastRevision=-1;
  }
  reset(){this.flashAge=99;this.motion.reset();this.strikes.reset();this.beamAge=0;this.pulseAge=99;this.lastRevision=-1;}
  update(dt,time,actor,direction,music,effects,paused){
    this.strikes.update(dt,time,actor,direction,effects,paused);
    const desiredCharge=direction.signals ? direction.signals.charge : direction.state==='charge'?.25+direction.progress*.75:direction.state==='blast'?1:0;
    this.motion.update(dt,time,direction.power,desiredCharge,actor.root.position,paused);
    const power=THREE.MathUtils.clamp(this.motion.power.value,0,1);
    const blue=Math.max(THREE.MathUtils.clamp(this.motion.charge.value,0,1),direction.signals?.beam||0),goldFx=effects*(1-blue*.95);
    this.flames.update(time,power,goldFx,actor.root.position,this.motion.wind);
    if(!paused){if(direction.signals?.surge)this.flashAge=0;this.flashAge+=dt;}
    // Sound in the picture: beats flare the aura, bass swells it, highs brighten the sparks.
    const beat=music?.beatStrength||0,bass=music?.bass||0;
    this.blaze.update(time,power,goldFx,actor.root.position,this.motion.wind,Math.max(0,1-this.flashAge/.55)+beat*.35,1+bass*.12+beat*.08);
    this.root.position.copy(actor.root.position);
    this.envelope.scale.set(.48+power*.16,1.12+power*.08,.40+power*.12);
    for (let i=0;i<this.anchors.length;i++) actor.anchor(this.anchorRoles[i],this.anchors[i]).sub(actor.root.position);
    const ribbons=this.aura.geometry.attributes.position;
    for(let i=0;i<this.ribbonCount;i++) {
      const anchor=this.anchors[i%this.anchors.length],angle=i*2.39996;
      const seed=(i*.618033)%1,length=Math.min(2.28-anchor.y,(.38+seed*.74)*(1+power*.35));
      for(let j=0;j<=this.ribbonRows;j++) {
        const u=j/this.ribbonRows,phase=u*8.-time*(2.2+seed)+i*1.7;
        const radius=.09+seed*.09+u*(.08+power*.24);
        const bend=Math.sin(phase)*.045*u+Math.sin(phase*2.7)*.02*u;
        const x=anchor.x+Math.sin(angle)*radius+bend+this.motion.wind.x*u*u, y=anchor.y+u*length, z=anchor.z+Math.cos(angle)*radius+Math.cos(phase)*.035*u+this.motion.wind.z*u*u;
        const width=(.045+seed*.06)*Math.pow(1-u,.75);
        for(let side=0;side<2;side++) {const w=(side*2-1)*width; ribbons.setXYZ((i*(this.ribbonRows+1)+j)*2+side,x+Math.cos(angle)*w,y,z-Math.sin(angle)*w);}
      }
    }
    ribbons.needsUpdate=true;
    this.auraUniforms.time.value=time;
    this.auraUniforms.strength.value=Math.max(0,(power-.22)/.78)*goldFx;
    actor.heroFinish?.setGlow(Math.max(0,(power-.3)/.7)*goldFx*.9);
    this.root.visible=effects>.001;
    if(!paused && (direction.signals?.landing||direction.signals?.surge))this.pulseAge=0;
    if(!paused && direction.signals?.release){this.pulseAge=0;this.beamAge=0;}
    if(!paused && !direction.signals && this.lastRevision!==direction.revision){this.lastRevision=direction.revision;if(['blast','jump','punch','kick'].includes(direction.state))this.pulseAge=0;}
    if(!paused)this.pulseAge+=dt;
    const attr=this.sparks.geometry.attributes.position;
    for(let i=0;i<attr.count;i++){
      const life=(i*.179+time*(.2+power*.45))%1,angle=i*2.399+life*.6,radius=.12+life*.42;
      const origin=this.anchors[i%this.anchors.length];
      attr.setXYZ(i,origin.x+Math.sin(angle)*radius,origin.y+life*1.25,origin.z+Math.cos(angle)*radius);
    }
    attr.needsUpdate=true;this.sparks.material.uniforms.power.value=effects*(.1+power*.85)*(1+(music?.highs||0)*.6);
    this.debris.visible=power>.35 && effects>.01;
    for(let i=0;i<this.debris.count;i++) {
      const seed=(i*.618033)%1,angle=i*2.39996+time*.08,radius=.65+seed*.9;
      const d=this.debrisTransform;d.position.set(actor.root.position.x+Math.sin(angle)*radius,.04+Math.pow((seed+time*.13)%1,1.4)*power*.8,actor.root.position.z+Math.cos(angle)*radius);
      d.rotation.set(time*(.3+seed),i+time*.2,time*.1);d.scale.set(.009+seed*.012,.015+seed*.019,.012+seed*.013).multiplyScalar(effects);
      d.updateMatrix();this.debris.setMatrixAt(i,d.matrix);
    }
    this.debris.instanceMatrix.needsUpdate=true;
    const lift=Math.max(THREE.MathUtils.smoothstep(power,.5,.95),THREE.MathUtils.smoothstep(actor.root.position.y,.1,.34)*.85);this.rocks.visible=lift>.01 && effects>.01;
    for(let i=0;i<this.rocks.count;i++) {
      const seed=(i*.618033)%1,angle=i*2.39996+time*.05*(i%2?1:-1),radius=1.7+seed*1.7;
      const d=this.debrisTransform;d.position.set(actor.root.position.x+Math.sin(angle)*radius,(.25+seed*1.3+Math.sin(time*.9+i)*.08)*lift-.12*(1-lift),actor.root.position.z+Math.cos(angle)*radius);
      d.rotation.set(time*(.2+seed*.3)+i,i*1.3+time*.15,time*.12*seed);const clear=1-THREE.MathUtils.smoothstep(Math.cos(angle),.3,.6); // none in front of the hero, where the cameras are
      d.scale.set(.06+seed*.07,.045+seed*.055,.05+seed*.06).multiplyScalar(effects*lift*clear);
      d.updateMatrix();this.rocks.setMatrixAt(i,d.matrix);
    }
    this.rocks.instanceMatrix.needsUpdate=true;
    const palm=actor.palm(),forward=actor.energyDirection();
    const charge=THREE.MathUtils.clamp(this.motion.charge.value,0,1);
    const blast=direction.signals ? (direction.state==='blast'?direction.signals.beam:0) : direction.state==='blast'?1:0;
    if(direction.signals?.beamAge!=null)this.beamAge=direction.signals.beamAge;
    else if(!paused && blast>0)this.beamAge+=dt;
    this.ball.position.copy(palm);
    this.ball.visible=charge>.03&&effects>.01;
    const orbSize=.3+charge*1.6,squash=1+Math.sin(time*3.2)*.025*charge;
    this.ball.scale.set(orbSize*squash,orbSize/squash,orbSize);
    this.orbUniforms.time.value=time;this.orbUniforms.strength.value=effects*Math.min(1,charge*3);
    this.corona.position.copy(this.ball.position);this.corona.scale.copy(this.ball.scale);this.corona.visible=this.ball.visible;
    for(let i=0;i<this.orbitArcs.length;i++){
      const arc=this.orbitArcs[i];arc.visible=this.ball.visible;arc.position.copy(palm);arc.scale.setScalar(.5+charge*.7);
      arc.rotation.set(time*(.8+i*.2)+i*1.2,time*(1.1-i*.15)+i*.7,time*(i%2?2:-2));arc.material.opacity=effects*charge*(.60+.06*Math.sin(time*3+i));
    }
    this.beam.visible=this.core.visible=blast>.01&&effects>.01;
    const envelope=beamEnvelope(this.beamAge,blast);
    const length=envelope.length,radius=this.motion.beam(envelope.radius,dt,blast>.01,paused);
    if(blast>.01){this.ball.scale.multiplyScalar(envelope.orbScale);this.corona.scale.copy(this.ball.scale);}
    // A star of rays at the hands, and a fireball with smoke where the beam lands.
    const firing=blast*effects;
    const release=1-THREE.MathUtils.smoothstep(this.beamAge,.05,.55);
    this.muzzle.update(time,this.impactPoint.copy(palm).addScaledVector(forward,.5+release*.6),.8+radius*.45+release*1.9,firing*(1-release*.5));
    // The fireball sits above its landing point, so the ground does not slice it flat.
    this.impact.update(time,this.liftUp.copy(this.impactPoint.copy(palm).addScaledVector(forward,length)).addScaledVector(up,.9+radius*.5),(2.8+radius*1.5)*(1+.06*Math.sin(time*9)),firing*THREE.MathUtils.smoothstep(this.beamAge,.15,.45));
    const landed=firing*THREE.MathUtils.smoothstep(this.beamAge,.15,.45);
    this.embers.visible=this.shockRing.visible=this.firelight.visible=this.shrapnel.visible=landed>.01;
    this.tip.update(time,this.impactPoint,(1.5+radius*.9)*(1+.08*Math.sin(time*17)),landed);
    this.pyre.update(time,.45+.45*landed,landed>.01?effects:0,this.ground.set(this.impactPoint.x,.02,this.impactPoint.z));
    this.sheath.visible=this.beam.visible;this.sheath.material.uniforms.time.value=time;this.sheath.material.uniforms.strength.value=firing;
    this.sheath.position.copy(this.beam.position);this.sheath.quaternion.copy(this.beam.quaternion);this.sheath.scale.set(radius,length,radius);
    for(let i=0;i<this.shrapnel.count&&landed>.01;i++){
      const seed=(i*.618033)%1,life=(i*.271+time*(.7+seed*.5))%1,angle=i*2.39996,reach=life*(2.2+seed*3),d=this.debrisTransform;
      d.position.set(this.impactPoint.x+Math.sin(angle)*reach,Math.max(.05,this.impactPoint.y+(1.2+seed*1.8)*reach*.6-life*life*4.2),this.impactPoint.z+Math.cos(angle)*reach*.7);
      d.rotation.set(time*(2+seed*3),i+time*2.4,time*1.3);d.scale.setScalar((.07+seed*.14)*(1-life*.5)*landed);d.updateMatrix();this.shrapnel.setMatrixAt(i,d.matrix);
    }
    this.shrapnel.instanceMatrix.needsUpdate=true;
    if(landed>.01){
      const at=this.impactPoint,embers=this.embers.geometry.attributes.position;
      for(let i=0;i<embers.count;i++){const seed=(i*.618033)%1,life=(i*.179+time*(1.1+seed*.6))%1,angle=i*2.39996,up=.25+((i*.37)%1)*.9,reach=life*(1.6+seed*3.2);
        embers.setXYZ(i,at.x+Math.sin(angle)*reach,at.y+up*reach-life*life*2.2,at.z+Math.cos(angle)*reach*.7);}
      embers.needsUpdate=true;this.embers.material.uniforms.power.value=landed;
      const pulse=(time*1.7)%1;this.shockRing.position.copy(at);this.shockRing.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),forward);this.shockRing.scale.setScalar(.6+pulse*4.2);this.shockRing.material.opacity=landed*(1-pulse)*.8;
      this.firelight.position.copy(at).y+=.6;this.firelight.intensity=landed*(34+6*Math.sin(time*23));
    }
    for(const beam of [this.beam,this.core]){
      if(this.beam.visible)deformBeam(beam.geometry,time);
      beam.position.copy(this.ball.position).addScaledVector(forward,length/2);
      beam.scale.set(radius,length,radius);beam.quaternion.setFromUnitVectors(up,forward);
    }
    this.beam.material.uniforms.time.value=time;this.beam.material.uniforms.strength.value=effects*blast;
    this.core.material.uniforms.opacity.value=Math.min(1,effects*1.25)*blast;this.core.material.uniforms.time.value=time;
    for(let i=0;i<this.pressureRings.length;i++){
      const ring=this.pressureRings[i],u=(this.beamAge*1.8+i*.2)%1;
      ring.visible=this.beam.visible;const section=beamSection(u*.85,time);
      ring.position.set(section.x*radius,.12+u*length*.85,section.z*radius).applyQuaternion(this.beam.quaternion).add(palm);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),forward);ring.rotateZ(time*3+i*1.3);ring.scale.setScalar((.8+u*1.4)*radius*section.width);
      ring.material.opacity=effects*blast*Math.sin(Math.PI*u)*.75;
    }
    // Charge halo: a star of fine rays around the orb, growing with the charge.
    this.halo.update(time,palm,(.28+charge*.55)*(1+.05*Math.sin(time*11)),blast>.01?0:effects*THREE.MathUtils.smoothstep(charge,.1,.8)*.5);
    this.inflow.visible=charge>.12&&blast<.01&&effects>.01;
    if(this.inflow.visible){
      const a=this.inflow.geometry.attributes.position,c=actor.root.position;this.inflow.material.uniforms.power.value=effects*Math.min(1,charge*1.6)*.9;
      for(let i=0;i<a.count;i++){
        const seed=(i*.618033)%1,life=(i*.137+time*(.45+charge*.5)*(.8+seed*.4))%1,ease=life*life,angle=i*2.39996+seed*6,startR=1.2+seed*2.4,startY=.15+((i*.37)%1)*1.9;
        // Start somewhere in the air around the hero, spiral inward and arrive at the palm.
        const sx=c.x+Math.sin(angle)*startR-palm.x,sz=c.z+Math.cos(angle)*startR-palm.z,turn=life*2.6,cs=Math.cos(turn),sn=Math.sin(turn),k=1-ease;
        a.setXYZ(i,palm.x+(sx*cs-sz*sn)*k,palm.y+(c.y+startY-palm.y)*k,palm.z+(sx*sn+sz*cs)*k);
      }a.needsUpdate=true;
    }
    this.spiral.visible=charge>.04&&effects>.01;
    this.spiral.position.copy(palm);this.spiral.material.uniforms.power.value=effects*charge;
    const spiral=this.spiral.geometry.attributes.position;
    for(let i=0;i<spiral.count;i++){
      const life=(i*.618033+time*(.55+charge*.3))%1,angle=i*2.39996-time*5+life*10;
      const radius=(1-life)*(.30+charge*.08)+.05;
      spiral.setXYZ(i,Math.cos(angle)*radius,Math.sin(angle)*radius*.65,(1-life)*.5*Math.sin(i*1.7));
    }spiral.needsUpdate=true;
  }
  setQuality(count){this.sparks.geometry.setDrawRange(0,Math.min(560,count));}
}
