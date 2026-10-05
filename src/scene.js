import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Character } from './characters.js';
import { Director } from './director.js';
import { CombatPhysics } from './physics.js';
import { ImpactParticles } from './particles.js';
import { SpaceWorld } from './world.js';
import { SaiyanAura } from './energy.js';

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.13, 'rgba(255,255,255,.7)');
  gradient.addColorStop(.4, 'rgba(255,255,255,.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
function segment(object, start, end, width) {
  object.position.copy(start).lerp(end, .5);
  object.scale.set(width, start.distanceTo(end), width);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
}

export class TrainingScene {
  constructor(canvas, audio) {
    this.audio = audio;
    this.canvas = canvas;
    this.time = 0;
    this.sensitivity = .65;
    this.effects = .65;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.paused = this.reducedMotion;
    this.autoCamera = !this.reducedMotion;
    this.view = 'training';
    this.environment = 'nebula';
    this.physicsEnabled = true;
    this.impactStrength = .65;
    this.shake = 0;
    this.director = new Director();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090514');
    this.scene.fog = new THREE.FogExp2('#10101e', .009);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMappingExposure = 1;
    this.camera = new THREE.PerspectiveCamera(36, 1, .1, 180);
    this.camera.position.set(0, 2.3, 19);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, .6, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 30;
    this.controls.minPolarAngle = .45;
    this.controls.maxPolarAngle = Math.PI * .78;
    this.controls.addEventListener('start', () => { this.autoCamera = false; this.oninteraction?.(); });
    this.scene.add(new THREE.HemisphereLight('#e2deff', '#4d3246', .65));
    const key = new THREE.DirectionalLight('#fff1d5', 2.0);
    key.position.set(-5, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -7;
    key.shadow.camera.right = key.shadow.camera.top = 7;
    key.shadow.bias = -.0004;
    key.shadow.normalBias = .015;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#b398ff', 1.1);
    rim.position.set(0, 3, -5);
    this.scene.add(rim);
    this.texture = glowTexture();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .55, .65, 2.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.world = new SpaceWorld(this.scene);
    this.physics = new CombatPhysics(true);
    this.particles = new ImpactParticles(this.scene);
    this.goku = new Character('goku');
    this.scene.add(this.goku.root);
    this.goku.root.rotation.y = -.18;
    this.aura = new SaiyanAura();
    this.beam = this.makeBeam('#71d5ff');
    this.scene.add(this.aura.root, this.beam.root);
    this.ready = this.goku.ready.then(() => {
      this.loaded = true;
      this.canvas.dataset.characters = 'goku';
    }).catch(error => {
      this.onerror?.('Character assets could not be loaded. Reload to try again.');
      console.error('Character loading failed:', error);
    });
    this.impact = this.sprite('#c6a2ff', 1, 1);
    this.impact.position.set(0, .7, .2);
    this.scene.add(this.impact);
    this.shockwaves = Array.from({ length: 3 }, (_, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .014, 6, 96), new THREE.MeshBasicMaterial({ color: '#ae8cff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.set(0, .7, .2);
      ring.rotation.set(.1 + i * .4, i * .4, 0);
      this.scene.add(ring);
      return ring;
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.contextLost = false;
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.contextLost = true;
      this.audio.stop();
      this.onerror?.('The 3D renderer lost its graphics connection. Reload to restore the scene.');
    });
    this.renderer.setAnimationLoop(now => this.frame(now));
  }

  practice(action) {
    this.director.practice(action);
    this.paused = false;
    this.oninteraction?.();
  }

  impactBurst(position, strength = 1) {
    if (this.paused || this.effects <= .01) return;
    this.particles.burst(position, '#d3b2ff', strength * this.effects);
    this.shake = Math.min(.24, this.shake + strength * .16 * this.impactStrength);
    this.canvas.dataset.impacts = String(Number(this.canvas.dataset.impacts || 0) + 1);
  }

  setEnvironment(name) {
    this.environment = name;
    this.world.setTheme(name);
  }

  setQuality(name) {
    const ratio = { low: 1, balanced: 1.5, high: 2 }[name] || 1.5;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, ratio));
    this.resize();
  }

  resetTraining() {
    this.physics.reset();
    this.director.reset();
    this.particles.clear();
    this.shake = 0;
    this.time = 0;
    this.lastRevision = null;
    this.goku.root.position.set(0, 0, 0);
    this.goku.root.rotation.set(0, -.18, 0);
    this.goku.pose('hover', 0, 0, 0);
    this.resetCamera();
  }

  sprite(color, x, y, opacity = 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.scale.set(x, y, 1);
    return sprite;
  }

  makeBeam(color) {
    const root = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.7), transparent: true, opacity: .88, blending: THREE.AdditiveBlending, depthWrite: false }));
    const shell = new THREE.Mesh(core.geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false }));
    const ball = this.sprite(color, 2, 2, .8);
    const bolts = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .85, blending: THREE.AdditiveBlending }));
    root.add(core, shell, ball, bolts);
    return { root, core, shell, ball, bolts };
  }

  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.resetCamera();
  }

  resetCamera() {
    const narrow = this.camera.aspect < .85;
    const portrait = this.view === 'portrait';
    const distance = portrait ? (narrow ? 13.5 : 8.8) : (narrow ? 23 : 14.5);
    this.camera.position.set(portrait ? 1.25 : 2.1, portrait ? 2.1 : 1.0, distance);
    this.controls.target.set(0, portrait ? 1.8 : .05, 0);
    this.controls.update();
  }

  frame(now) {
    const dt = Math.min(.05, (now - (this.last ?? now)) / 1000);
    this.last = now;
    if (document.hidden || this.contextLost) return;
    this.director.enabled = !this.paused && this.loaded;
    this.director.update(dt, this.audio.spectrum(), this.sensitivity, this.audio.mode !== 'idle');
    if (!this.paused) this.time += dt;
    const t = this.time;
    const state = this.director.state;
    const progress = this.director.progress;
    const energy = this.director.energy;
    const powerup = state === 'powerup';
    const charging = state === 'charge';
    const blasting = state === 'blast';
    const striking = state === 'punch' || state === 'kick';
    const power = powerup ? .2 + progress * .8 : charging || blasting ? .9 : .1 + energy * .4;
    const fighter = this.goku;
    const body = this.physics.bodies[0];
    if (!this.paused) {
      const travel = Math.sin(progress * Math.PI);
      body.target.x = state === 'move' ? -1.25 * travel : state === 'dodge' ? 1.1 * travel : 0;
      body.target.y = Math.sin(t * 1.2) * .08 + (powerup ? progress * .32 : state === 'move' ? travel * .3 : 0);
      body.target.z = state === 'move' ? -.6 * travel : 0;
      if (this.director.revision !== this.lastRevision) {
        this.lastRevision = this.director.revision;
        this.strikeEmitted = false;
        if (blasting) {
          // Recoil travels opposite the outgoing blast, with no imaginary opponent.
          body.impulse(-1.8, .25, -2);
          this.shake = .12 * this.impactStrength;
        }
      }
      this.physics.enabled = this.physicsEnabled;
      this.physics.update(dt);
      const position = this.physicsEnabled ? body.position : body.target;
      fighter.root.position.set(position.x, position.y, position.z);
      const angle = blasting || charging || striking ? .65 : state === 'move' ? -.5 : -.18;
      fighter.root.rotation.y = THREE.MathUtils.damp(fighter.root.rotation.y, angle, 5, dt);
      fighter.root.rotation.z = state === 'dodge' ? -.13 * travel : state === 'move' ? .1 * travel : 0;
      fighter.pose(state, t, power, dt, state === 'hover' ? null : progress);
      this.particles.update(dt);
      this.shake *= Math.exp(-dt * 8);
    }

    this.aura.update(t, power, this.effects, fighter.root.position);
    if (!this.paused) this.world.update(t, power, this.effects);

    const palm = fighter.palm(new THREE.Vector3());
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(fighter.root.quaternion);
    const focus = palm.clone().addScaledVector(direction, 11);
    const beam = this.beam;
    // Keep the exact effect pose visible when paused, so character study is useful.
    beam.root.visible = (blasting || charging) && this.effects > .01;
    beam.ball.position.copy(palm);
    beam.ball.scale.setScalar(charging ? .35 + progress * 1.05 : 1.5);
    beam.core.visible = beam.shell.visible = beam.bolts.visible = blasting;
    if (blasting) {
      const envelope = Math.min(1, progress * 8, (1 - progress) * 5);
      const end = palm.clone().lerp(focus, Math.min(1, progress * 7));
      const radius = (.16 + energy * .12) * this.effects * envelope;
      segment(beam.core, palm, end, radius);
      segment(beam.shell, palm, end, radius * 2.6);
      const array = beam.bolts.geometry.attributes.position;
      for (let j = 0; j < array.count; j++) {
        const p = palm.clone().lerp(end, j / (array.count - 1));
        const scatter = Math.sin(j / (array.count - 1) * Math.PI) * .14 * envelope;
        p.y += Math.sin(j * 8 + t * 14) * scatter;
        p.x += Math.cos(j * 13 + t * 18) * scatter;
        array.setXYZ(j, p.x, p.y, p.z);
      }
      array.needsUpdate = true;
      beam.ball.material.opacity = envelope * .8;
    } else beam.ball.material.opacity = .8;

    if (!this.paused && striking && progress > .45 && !this.strikeEmitted) {
      this.strikeEmitted = true;
      const origin = state === 'punch' ? palm : fighter.root.position.clone().add(new THREE.Vector3(.5, -.9, 1.3));
      this.impactBurst(origin, .28);
    }
    this.impact.visible = false;
    this.shockwaves.forEach((ring, i) => {
      const phase = (progress * 1.5 + i / 3) % 1;
      ring.position.copy(fighter.root.position);
      ring.position.y -= 3.35;
      ring.rotation.set(Math.PI / 2, 0, i * .2);
      ring.visible = powerup && this.effects > .01;
      ring.scale.setScalar(.7 + phase * 3.2);
      ring.material.opacity = (1 - phase) * progress * .25 * this.effects;
    });
    this.bloom.strength = .15 + this.effects * (.3 + power * .25);
    if (this.autoCamera && !this.paused) {
      this.camera.position.x = (this.view === 'portrait' ? 1.25 : 2.1) + Math.sin(t * .12) * .65;
      this.camera.position.y = (this.view === 'portrait' ? 2.1 : 1.0) + Math.sin(t * .17) * .18;
    }
    this.controls.update();
    const unshaken = this.camera.position.clone();
    if (!this.paused) {
      this.camera.position.x += Math.sin(t * 71) * this.shake;
      this.camera.position.y += Math.cos(t * 83) * this.shake * .6;
    }
    this.composer.render();
    this.camera.position.copy(unshaken);
    if (this.loaded) this.canvas.dataset.ready = 'true';
    this.canvas.dataset.phase = state;
    this.canvas.dataset.progress = progress.toFixed(3);
    this.canvas.dataset.beamVisible = String(beam.root.visible && blasting);
  }
}
