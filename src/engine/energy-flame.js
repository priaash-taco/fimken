import { shaderPalette } from './palette.js';
import * as THREE from 'three';
// The aura is not one shell. It is four independently moving fields of warped noise drawn on
// invisible camera-facing carriers, plus a ground glow:
//   body    tight yellow-white glow hugging the figure
//   field   medium golden flame mass
//   wisps   large, thin, translucent ridged-noise tongues that rise and break apart
//   licks   flame at the figure's sides drawn in front of him, never over his face
// Each field is domain-warped by scrolling noise, thresholded softly, and dissolves toward its
// edge instead of ending, so the outline never settles and no mesh boundary is visible.
const LAYERS = [
  // size: width x height (m) at power 1; behind: metres behind the figure (negative = in front)
  { name: 'body', size: [1.1, 2.1], behind: .18, scale: 1.15, speed: 1.5, warp: .22, width: .7, alpha: .75, wisps: 0, lobes: 1.3, hollow: 0, seed: .13 },
  { name: 'field', size: [1.8, 2.9], behind: .38, scale: .95, speed: 1.15, warp: .34, width: .75, alpha: .5, wisps: .25, lobes: 1, hollow: 0, seed: .41 },
  { name: 'wisps', size: [2.8, 4.0], behind: .55, scale: .62, speed: .8, warp: .5, width: .85, alpha: .34, wisps: 1, lobes: .6, hollow: 0, seed: .77 },
  { name: 'licks', size: [2.2, 2.7], behind: -.32, scale: .85, speed: 1.3, warp: .4, width: .8, alpha: .2, wisps: .5, lobes: .7, hollow: 1, seed: .59 },
];
const vertexShader = `uniform vec2 size;uniform float behind;varying vec2 vUv;
  void main(){vUv=uv;vec3 center=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
  vec3 toCamera=normalize(vec3(cameraPosition.x-center.x,0.,cameraPosition.z-center.z)+vec3(0.,0.,1e-5));
  vec3 right=vec3(toCamera.z,0.,-toCamera.x);
  vec3 world=center-toCamera*behind+right*position.x*size.x+vec3(0.,1.,0.)*(position.y+.5)*size.y;
  gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`;
const fragmentShader = shaderPalette + `uniform sampler2D noiseTex;uniform float time,strength,wind,flash,seed,scale,speed,warp,width,alpha,wisps,lobes,hollow;varying vec2 vUv;
  void main(){
   vec2 q=vec2(vUv.x*2.-1.,vUv.y);float rise=time*speed;
   // Two nested warps: a slow large one bends the whole mass, a faster small one tears the edges.
   vec2 w1=texture2D(noiseTex,q*vec2(.5,.32)*scale+vec2(seed,-rise*.30)).rg-.5;
   vec2 p=q+w1*warp*(.35+q.y);
   vec2 w2=texture2D(noiseTex,p*vec2(1.1,.7)*scale+vec2(seed*2.3,-rise*.75)).gb-.5;
   p+=w2*warp*.55*(.25+q.y);
   p.x+=wind*q.y*q.y;
   float mass=texture2D(noiseTex,p*vec2(.85,.52)*scale+vec2(seed*1.7,-rise*.85)).r;
   float detail=texture2D(noiseTex,p*vec2(2.2,1.35)*scale+vec2(-seed,-rise*1.55)).b;
   float grain=texture2D(noiseTex,p*vec2(4.5,2.8)*scale+vec2(seed*4.,-rise*2.4)).a;
   // Wide at the feet, narrowing as it climbs; the outline comes from noise, not from a curve.
   float halfW=width*(1.-.5*smoothstep(0.,1.,q.y));
   float across=abs(p.x)/max(halfW,.05);
   float body=(1.-across*across)*(1.-smoothstep(.1,1.,q.y+(mass-.5)*.55));
   // Wisps: thin ridged-noise tongues that exist only where the ridges line up.
   float tongue=smoothstep(.55,.9,detail)*(1.-smoothstep(.2,1.,q.y))*(1.-across*.6);
   float density=body*(.5+.95*mass)+(detail-.5)*.3*body+tongue*wisps*.9+(grain-.5)*.12*body-.1;
   // Dissolve: the threshold climbs toward the outer part of the field, so edges break up instead of ending.
   float edge=smoothstep(.2,1.,across)+smoothstep(.55,1.,q.y);
   float a=smoothstep(.2+edge*.28,.7+edge*.14,density)*alpha;
   // Front licks live at the sides only; the middle (his body and face) stays clear.
   a*=mix(1.,smoothstep(.28,.78,abs(q.x)),hollow);
   a*=smoothstep(0.,.16,vUv.y+(mass-.5)*.1);
   float heat=smoothstep(.15,1.05,density+lobes*.12*smoothstep(.62,.95,mass*body*1.5));
   vec3 color=mix(p_deepGiOrange*1.1,p_gokuOrange*1.5,smoothstep(0.,.4,heat));
   color=mix(color,p_superSaiyanGold*2.1,smoothstep(.3,.72,heat));
   color=mix(color,mix(p_brightAuraYellow,p_auraGlowCream,.55)*2.5,smoothstep(.65,1.,heat));
   color+=flash*.35*p_explosionYellow*a;
   gl_FragColor=vec4(color,clamp(a,0.,1.)*strength);}`;
const groundFragment = shaderPalette + `uniform sampler2D noiseTex;uniform float time,strength,flash;varying vec2 vP;
  void main(){float r=length(vP);float n=texture2D(noiseTex,vec2(atan(vP.y,vP.x)*.16+time*.05,r*.7-time*.12)).g;
   float glow=pow(max(0.,1.-r),2.)*(.7+.5*n);
   gl_FragColor=vec4(mix(p_armorGold,p_superSaiyanGold,glow)*1.6+p_explosionYellow*flash,glow*(strength*.55+flash*.4));}`;
export class EnergyFlame {
  constructor(scene, noise) {
    this.layers = LAYERS.map((layer, i) => {
      const uniforms = { noiseTex: { value: noise }, time: { value: 0 }, strength: { value: 0 }, wind: { value: 0 }, flash: { value: 0 }, size: { value: new THREE.Vector2(layer.size[0], layer.size[1]) },
        behind: { value: layer.behind }, seed: { value: layer.seed }, scale: { value: layer.scale }, speed: { value: layer.speed }, warp: { value: layer.warp }, width: { value: layer.width },
        alpha: { value: layer.alpha }, wisps: { value: layer.wisps }, lobes: { value: layer.lobes }, hollow: { value: layer.hollow } };
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader, fragmentShader }));
      mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = -4 + i; scene.add(mesh);
      return { mesh, uniforms, base: layer };
    });
    // Light thrown on the ground under the hero.
    this.groundUniforms = { noiseTex: { value: noise }, time: { value: 0 }, strength: { value: 0 }, flash: { value: 0 } };
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShaderMaterial({ uniforms: this.groundUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: groundFragment }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.visible = false; scene.add(this.ground);
    this.mesh = this.layers[0].mesh; // existing code asks whether the aura is showing
  }
  update(time, power, effects, position, wind = { x: 0, z: 0 }, flash = 0, pulse = 1) {
    const strength = THREE.MathUtils.smoothstep(power, .42, .85) * effects, visible = strength > .01;
    for (const { mesh } of this.layers) mesh.visible = visible; this.ground.visible = visible;
    if (!visible) return;
    const grow = (.78 + power * .34) * pulse;
    for (const { mesh, uniforms, base } of this.layers) {
      mesh.position.copy(position);
      uniforms.time.value = time; uniforms.strength.value = strength; uniforms.wind.value = wind.x * 2; uniforms.flash.value = flash * effects;
      uniforms.size.value.set(base.size[0] * grow, base.size[1] * grow);
    }
    this.ground.position.set(position.x, .012, position.z); this.ground.scale.setScalar(1.5 + power * 1.3);
    this.groundUniforms.time.value = time; this.groundUniforms.strength.value = strength; this.groundUniforms.flash.value = flash * effects;
  }
}
