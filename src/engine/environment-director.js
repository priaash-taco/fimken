import { PALETTE } from './palette.js';
import * as THREE from 'three';
import { CosmicWorld } from './cosmic-world.js';
import { rockGeometry } from './rock-geometry.js';
// The same banded diffuse the hero uses, so rocks and ground sit in the same drawing.
export const celBands = material => { const before = material.onBeforeCompile; material.onBeforeCompile = shader => { before?.call(material, shader);
  shader.uniforms.energyPos = ENERGY_LIGHT.position; shader.uniforms.energyColor = ENERGY_LIGHT.color; shader.uniforms.energyStrength = ENERGY_LIGHT.strength;
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 energyPos;uniform vec3 energyColor;uniform float energyStrength;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  float envL = max(.0001, dot(reflectedLight.directDiffuse, vec3(.2126,.7152,.0722)));
  float envBand = mix(.22, .58, smoothstep(.24,.30,envL)); envBand = mix(envBand, 1.0, smoothstep(.62,.70,envL));
  reflectedLight.directDiffuse *= mix(1.0, clamp(envBand/envL,.55,1.25), .8);
  reflectedLight.indirectDiffuse *= .85;
  // Energy rim: faces turned toward the hero's energy catch hard-banded coloured light.
  vec3 ePos = (viewMatrix * vec4(energyPos, 1.0)).xyz, eTo = ePos + vViewPosition; float eD = length(eTo);
  float eN = max(dot(normal, eTo / max(eD, .001)), 0.0) / (1.0 + eD * eD * .22);
  float eBand = smoothstep(.10, .15, eN) * .55 + smoothstep(.30, .36, eN) * .45;
  reflectedLight.directDiffuse += diffuseColor.rgb * energyColor * eBand * energyStrength;`); }; material.customProgramCacheKey = () => 'fimken-env-cel-v2'; };
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { ENERGY_LIGHT } from './energy-light.js';
import { ENVIRONMENT } from './assets.js';

export class EnvironmentDirector {
  constructor(scene, renderer) {
    this.scene = scene;this.cosmos=new CosmicWorld(scene);
    scene.background = new THREE.Color('#080914');
    // Distance flattens into blue-purple silhouettes.
    scene.fog = new THREE.FogExp2('#0d1232', .026);
    // Rocky ground: it fades out 21 m from the centre, so the mesh stops there too.
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(21, 96), new THREE.MeshStandardMaterial({ color: '#2a2019', roughness: .92, metalness: 0, envMapIntensity: .05, transparent: true, opacity:.72 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -.025;
    this.floor.receiveShadow = true;
    // Drawn before every effect: the ground is see-through at its rim, and without this it
    // painted over beams and flames that sit in front of it.
    this.floor.renderOrder = -8;
    scene.add(this.floor);
    // Rock spires around the arena, in the palette's rock and debris browns.
    const rockMaterial = new THREE.MeshStandardMaterial({ roughness: .95, flatShading: true, vertexColors: true }); celBands(rockMaterial);
    // Three different rock shapes share the ring so neighbours do not match.
    const shapes = [rockGeometry({ detail: 5, taper: .5, seed: 3, roughness: .5 }), rockGeometry({ detail: 5, taper: .35, seed: 11, roughness: .55 }), rockGeometry({ detail: 5, taper: .6, seed: 23, roughness: .46 })];
    this.spires = new THREE.InstancedMesh(shapes[0], rockMaterial, 66);
    const spire = new THREE.Object3D(), tint = new THREE.Color();
    for (let i = 0; i < this.spires.count; i++) {
      // Two in three are tall spires; the rest are low boulders scattered in front of them.
      const seed = (i * .618033) % 1, angle = i * 2.39996, low = i % 3 === 0, radius = low ? 9 + seed * 6 : 11.5 + seed * 9, width = low ? .7 + ((i * .37) % 1) * 1.3 : .9 + ((i * .37) % 1) * 1.9, height = low ? .35 + ((i * .71) % 1) * .6 : 1.6 + ((i * .71) % 1) * 4.2;
      // Keep the beam's path and the cameras in front of the hero clear of rock.
      let x = Math.sin(angle) * radius; const z = Math.cos(angle) * radius; if (z > 1 && Math.abs(x) < 9) x = Math.sign(x || 1) * (9 + Math.abs(x) * .8);
      spire.position.set(x, height * .35 - .2, z); spire.rotation.set((seed - .5) * .5, i * 1.9, (((i * .53) % 1) - .5) * .5); spire.scale.set(width, height, width * (.7 + seed * .5));
      spire.updateMatrix(); this.spires.setMatrixAt(i, spire.matrix); this.spires.setColorAt(i, tint.set(PALETTE.rockBrown).lerp(new THREE.Color(PALETTE.debrisBrown), (i * .29) % 1).lerp(new THREE.Color(PALETTE.softBlack), .25).multiplyScalar(1.1 + seed * .5).lerp(new THREE.Color(PALETTE.deepRoyalBlue), THREE.MathUtils.smoothstep(radius, 9, 20) * .55));
    }
    this.spires.receiveShadow = true; scene.add(this.spires);
    // Every third instance uses a different shape: split the ring over three meshes.
    this.spireVariants = shapes.slice(1).map((shape, n) => { const variant = new THREE.InstancedMesh(shape, rockMaterial, 66); const m = new THREE.Matrix4(), c = new THREE.Color();
      for (let i = 0; i < 66; i++) { this.spires.getMatrixAt(i, m); this.spires.getColorAt(i, c); variant.setMatrixAt(i, i % 3 === n + 1 ? m : new THREE.Matrix4().makeScale(0, 0, 0)); variant.setColorAt(i, c); if (i % 3 === n + 1) this.spires.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
      variant.receiveShadow = true; scene.add(variant); return variant; });
    this.spires.instanceMatrix.needsUpdate = true;
    // Rubble: hundreds of stones half-sunk in the ground, from pebbles near the hero to
    // slabs out by the spires. Deterministic placement, never on the hero's footprint.
    const pick = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    this.rubble = new THREE.InstancedMesh(rockGeometry({ detail: 2, roughness: .5, seed: 5 }), rockMaterial, 520);
    for (let i = 0; i < this.rubble.count; i++) {
      const angle = pick(i, 1) * Math.PI * 2, far = pick(i, 2), radius = 2.4 + far * far * 16, size = (.035 + Math.pow(pick(i, 3), 3) * .42) * (.5 + far);
      spire.position.set(Math.sin(angle) * radius, -size * .35, Math.cos(angle) * radius); spire.rotation.set(pick(i, 4) * 6.3, pick(i, 5) * 6.3, pick(i, 6) * 6.3); spire.scale.set(size * (1 + pick(i, 7)), size * .7, size * (1 + pick(i, 8)));
      spire.updateMatrix(); this.rubble.setMatrixAt(i, spire.matrix); this.rubble.setColorAt(i, tint.set(PALETTE.rockBrown).lerp(new THREE.Color(PALETTE.debrisBrown), pick(i, 9)).lerp(new THREE.Color(PALETTE.softBlack), .3).multiplyScalar(.9 + pick(i, 10) * .6));
    }
    this.rubble.receiveShadow = true; scene.add(this.rubble);
    celBands(this.floor.material);
    const floorCel = this.floor.material.onBeforeCompile;
    this.floor.material.onBeforeCompile = shader => {
      floorCel(shader);
      shader.vertexShader = 'varying vec3 groundPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', 'groundPosition = (modelMatrix * vec4(transformed, 1.)).xyz;\n#include <project_vertex>');
      shader.fragmentShader = 'varying vec3 groundPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', 'float crack = abs(sin(groundPosition.x * 2.3 + sin(groundPosition.z * 1.7) * 2.) * sin(groundPosition.z * 2.9 + sin(groundPosition.x * 1.3) * 2.));\nfloat grit = fract(sin(dot(floor(groundPosition.xz * 9.), vec2(127.1, 311.7))) * 43758.5);\nfloat mottle = sin(groundPosition.x * .7 + sin(groundPosition.z * .5) * 3.) * sin(groundPosition.z * .9 + 1.7) * .5 + .5;\ndiffuseColor.rgb *= (.62 + .38 * smoothstep(.02, .1, crack)) * (.8 + .4 * mottle) * (.85 + .3 * grit);\ndiffuseColor.a = 1. - smoothstep(10., 21., length(groundPosition.xz));\n#include <alphatest_fragment>');
    };
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.ready = new HDRLoader().loadAsync(ENVIRONMENT.hdr).then(texture => {
      this.environment = pmrem.fromEquirectangular(texture);
      scene.environment = this.environment.texture;
      scene.environmentIntensity = .2;
      texture.dispose(); pmrem.dispose();
    }).catch(error => { pmrem.dispose(); throw error; });
    // Abstract atmosphere is shader artwork; no placeholder rock meshes or terrain.
    this.haze = new THREE.Mesh(new THREE.PlaneGeometry(45, 26), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, energy: { value: 0 }, tint: { value: new THREE.Color(PALETTE.deepFriezaPurple) } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv;uniform float time;uniform float energy;uniform vec3 tint;
      void main(){vec2 p=vUv-.5;float h=exp(-pow((p.y+.25)*6.,2.));
      float a=sin(p.x*8.+p.y*4.+time*.07)*.5+.5;
      float plume=exp(-pow((p.x+.20+sin(p.y*5.+time*.06)*.03)*10.,2.))*smoothstep(-.5,.2,p.y);
      float fall=1.-smoothstep(.28,.63,length(p));
      gl_FragColor=vec4(mix(tint,vec3(.75,.50,.22),plume*.35),(h*(.05+a*.035)+plume*.07)*(1.+energy*.35)*fall);}`,
    }));
    this.haze.position.set(0, 6, -15); scene.add(this.haze);
    this.count = 720;
    const positions = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) positions.set([Math.sin(i * 12.989) * 16, .2 + (i * .073 % 11), -2 - (i * .193 % 18)], i * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: PALETTE.goldenHighlight, size: .018, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(this.dust);
  }
  setInspection(enabled) {
    this.inspection = enabled;this.cosmos.setInspection(enabled);
    this.haze.visible = this.dust.visible = this.floor.visible = this.spires.visible = this.rubble.visible = !enabled; for (const v of this.spireVariants) v.visible = !enabled;
    this.scene.fog.density = enabled ? 0 : .018;
    this.scene.background.set(enabled ? '#62656b' : (this.theme === 'eclipse' ? '#080b16' : '#080914'));
  }
  setTheme(name) {
    this.theme = name;
    this.haze.material.uniforms.tint.value.set(name === 'eclipse' ? PALETTE.deepRoyalBlue : PALETTE.deepFriezaPurple);
    this.scene.fog.color.set(name === 'eclipse' ? '#080b16' : '#080914');
    if (!this.inspection) this.scene.background.copy(this.scene.fog.color);
  }
  setQuality(count) { this.dust.geometry.setDrawRange(0, count); }
  // Scene state: dust lifts and drifts, the ground darkens, fog thickens after an impact.
  setMood(mood, effects, wind = { x: 0, z: 0 }) {
    this.windDrift ??= { x: 0, z: 0 }; this.windDrift.x = THREE.MathUtils.damp(this.windDrift.x, wind.x * 14, 1.5, 1 / 60); this.windDrift.z = THREE.MathUtils.damp(this.windDrift.z, wind.z * 14, 1.5, 1 / 60);
    const lift = mood.dustLift * effects, l = mood.levels;
    this.dust.material.opacity = .35 + lift * .4 + mood.intensity * .25; this.dust.material.size = .018 + lift * .02 + mood.intensity * .014;
    this.dust.material.color.set(PALETTE.goldenHighlight).lerp((this.energyTint ??= new THREE.Color()).copy(ENERGY_LIGHT.color.value).multiplyScalar(1.4 / Math.max(ENERGY_LIGHT.color.value.r, ENERGY_LIGHT.color.value.g, ENERGY_LIGHT.color.value.b, .001)), Math.min(1, mood.intensity * effects));
    this.dustLift = THREE.MathUtils.damp(this.dustLift || 0, lift * .9, 2, 1 / 60);
    // Dark brown at rest; under blue energy the ground goes cool blue-grey, like the reference.
    const blue = THREE.MathUtils.clamp(l.charge + l.release * .9, 0, 1) * effects;
    this.floor.material.color.set('#2a2019').lerp(this.coolGround ??= new THREE.Color('#1c2640'), blue).multiplyScalar(1 - (l.powerUp * .25 + l.charge * .15 + l.release * .1) * effects);
    this.cosmos.setMood(mood, effects);
    if (!this.inspection) this.scene.fog.density = .026 + l.impact * .01 * effects - l.release * .008 * effects;
  }
  update(time, power) {
    this.cosmos.update(time);
    this.haze.material.uniforms.time.value = time; this.haze.material.uniforms.energy.value = power;
    this.dust.position.y = Math.sin(time * .07) * .15 + (this.dustLift || 0);
    this.dust.position.x = this.windDrift?.x || 0; this.dust.position.z = this.windDrift?.z || 0;
    this.dust.rotation.y = time * .006;
  }
}
