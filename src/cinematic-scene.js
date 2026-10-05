import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CombatPhysics } from './physics.js';
import { characterTextures, inspectRendering } from './engine/render-diagnostics.js';
import { CHARACTER } from './engine/assets.js';
import { CharacterController } from './engine/character-controller.js';
import { AudioAnalyzer, MusicState } from './engine/music-state.js';
import { FreestyleDirector } from './engine/freestyle-director.js';
import { SceneDirector } from './engine/scene-director.js';
import { CinematicDirector } from './engine/cinematic-director.js';
import { EnvironmentDirector } from './engine/environment-director.js';
import { LightingDirector } from './engine/lighting-director.js';
import { VFXDirector } from './engine/vfx-director.js';
import { CinematicRenderer, QUALITY } from './engine/renderer.js';
import { PerformanceMonitor } from './engine/performance-monitor.js';

export class TrainingScene {
  constructor(canvas, audio) {
    Object.assign(this, { canvas, audio, time: 0, sensitivity: .65, effects: .65, impactStrength: .65,
      playbackSpeed:1, physicsEnabled: true, view: 'training', environment: 'nebula', shake: 0, loaded: false });
    this.isShowcase=CHARACTER.id==='meshy-hero';
    this.inspection = new URLSearchParams(location.search).get('inspection') === '1' || (!this.isShowcase && CHARACTER.defaultReview);
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.paused = this.reducedMotion || Boolean(!this.isShowcase && CHARACTER.defaultReview); this.autoCamera = !this.paused;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, .05, 150);
    this.pipeline = new CinematicRenderer(canvas, this.scene, this.camera);
    this.renderer = this.pipeline.renderer;
    this.performance = new PerformanceMonitor(this.renderer, canvas);
    if (new URLSearchParams(location.search).get('perf') === '1') this.performance.setVisible(true);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.enablePan = false;
    this.controls.minDistance = 1.5; this.controls.maxDistance = 16;
    this.controls.minPolarAngle = .15; this.controls.maxPolarAngle = Math.PI * .54;
    this.controls.addEventListener('start', () => { this.autoCamera = false; this.oninteraction?.(); });
    this.analyzer = new AudioAnalyzer(); this.music = new MusicState();
    this.director = this.isShowcase ? new FreestyleDirector() : new SceneDirector(); this.physics = new CombatPhysics(true);
    this.cinematography = new CinematicDirector(this.camera, this.controls);
    this.world = new EnvironmentDirector(this.scene, this.renderer);
    this.lighting = new LightingDirector(this.scene);
    this.actor = new CharacterController(CHARACTER);
    this.actor.gazeTarget = this.camera;
    this.scene.add(this.actor.root);
    this.vfx = new VFXDirector(this.scene);
    this.ready = Promise.all([this.actor.ready, this.world.ready]).then(() => {
      this.loaded = true;
      this.hasCharacter = Boolean(CHARACTER.url);
      this.canvas.dataset.assetStatus = CHARACTER.status;
      if(this.isShowcase){this.actor.setFinish('cinematic');this.actor.showcasePose=this.director.pose;this.actor.update(0,0,'idle',this.music);}
      this.setInspection(this.inspection);
      if (this.actor.rigControls) this.hipRest = this.actor.anchor('hips').y - this.actor.root.position.y;
      this.canvas.dataset.characters = CHARACTER.id;
      this.canvas.dataset.clips = String(this.actor.clipCount);
      this.setQuality(this.pipeline.quality);
      this.resetCamera();
      // Build every effect shader now, against the buffer they will draw into, so the first
      // beam or impact does not stall the frame while its shaders compile.
      this.renderer.setRenderTarget(this.pipeline.composer.readBuffer); this.renderer.compile(this.scene, this.camera); this.renderer.setRenderTarget(null);
    }).catch(error => {
      this.onerror?.(`The cinematic assets could not load: ${error.message}`);
      console.error('Cinematic scene loading failed:', error);
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas); this.resize();
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.contextLost = true; this.audio.stop();
      this.onerror?.('The graphics connection was lost. Reload to restore the scene.');
    });
    this.renderer.setAnimationLoop(now => this.frame(now));
  }
  setInspection(enabled) {
    this.inspection = Boolean(enabled);
    this.canvas.dataset.inspection = String(this.inspection);
    this.world.setInspection(this.inspection);
    this.lighting.setInspection(this.inspection);
    this.actor.setInspection(this.inspection);
    this.pipeline.inspection = this.inspection;
    document.querySelector('.vignette')?.classList.toggle('inspection-hidden', this.inspection);
  }
  compareRendering(mode) {
    if(!this.loaded)return;
    if(mode==='exit'){
      if(!this.comparisonSaved)return;
      this.applyComparisonBaseline();
      const saved=this.comparisonSaved;
      this.paused=saved.paused;this.autoCamera=saved.autoCamera;this.controls.enableDamping=saved.damping;
      this.pipeline.comparing=false;this.comparisonMode=null;this.comparisonSaved=null;
      this.canvas.dataset.comparison='live';this.oninteraction?.();return;
    }
    if(!this.comparisonSaved){
      this.comparisonSaved={inspection:this.inspection,finish:this.actor.finish,paused:this.paused,autoCamera:this.autoCamera,
        damping:this.controls.enableDamping,environment:this.scene.environment,quality:this.pipeline.quality,adaptive:this.pipeline.adaptive,
        anisotropy:new Map([...characterTextures(this.actor.model).keys()].map(t=>[t,t.anisotropy]))};
      this.paused=true;this.autoCamera=false;this.controls.enableDamping=false;this.controls.update();this.pipeline.comparing=true;
    }
    this.applyComparisonBaseline();
    this.comparisonMode=mode==='sharp'?'sharp':'cinematic';
    if(this.comparisonMode==='sharp'){
      this.setInspection(true);this.actor.setFinish('authored');this.scene.environment=null;
      const max=this.renderer.capabilities.getMaxAnisotropy();
      for(const t of characterTextures(this.actor.model).keys()){t.anisotropy=max;t.needsUpdate=true;}
      this.pipeline.setSharpDebug(true);
    }
    this.canvas.dataset.comparison=this.comparisonMode;this.oninteraction?.();
  }
  applyComparisonBaseline(){
    const s=this.comparisonSaved;
    this.pipeline.quality=s.quality;this.pipeline.adaptive=s.adaptive;this.pipeline.setSharpDebug(false);
    this.scene.environment=s.environment;this.actor.setFinish(s.finish);this.setInspection(s.inspection);
    for(const [t,anisotropy]of s.anisotropy){t.anisotropy=anisotropy;t.needsUpdate=true;}
  }
  renderDiagnostics(){return inspectRendering(this);}
  reviewAction(time,id='sequence'){
    if(!this.loaded||!this.isShowcase)return;
    if(this.comparisonSaved)this.compareRendering('exit');
    // Reviewing a named move shows its authored pose, not a blend from the last one.
    if(this.director.moveId!==id||this.director.auto){this.director.practice(id);if(id!=='sequence')this.director.from=null;}
    this.director.seek(time);this.time=time;this.paused=true;this.vfx.reset();
    this.actor.showcasePose=this.director.pose;this.actor.update(0,this.time,'idle',this.music);
    this.oninteraction?.();
  }
  practice(action) { if(this.comparisonSaved)this.compareRendering('exit');this.director.practice(action); this.paused = false; this.oninteraction?.(); }
  setEnvironment(name) { this.environment = name; this.world.setTheme(name); }
  setQuality(name) {
    this.pipeline.setQuality(name);
    const q = QUALITY[this.pipeline.quality];
    this.lighting.setQuality(q.shadow); this.world.setQuality(q.particles);
    this.vfx.setQuality(q.particles); this.actor.setQuality(Math.min(q.anisotropy,this.renderer.capabilities.getMaxAnisotropy()));
  }
  resetTraining() {
    this.physics.reset(); this.director.reset(); this.vfx.reset(); this.music.reset();
    this.time = 0; this.shake = 0; this.lastRevision = -1;
    this.actor.root.position.set(0, 0, 0); this.actor.root.rotation.set(0, CHARACTER.facing, 0);
    if(this.isShowcase)this.actor.showcasePose=this.director.pose;
    this.actor.update(0,0,'idle',this.music);this.resetCamera();
  }
  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.pipeline.resize(); this.resetCamera();
  }
  // Cameras follow the body, not the feet: during a somersault the feet swing two metres.
  followPoint() {
    const point = this.actor.root.position.clone();
    if (this.actor.rigControls && this.hipRest) point.y = this.actor.anchor('hips').y - this.hipRest;
    return point;
  }
  resetCamera() {
    if(this.inspection && CHARACTER.defaultReview) {
      this.camera.fov=this.view==='portrait'?28:32;
      const distance=this.view==='portrait'?2.6:4.9;
      const aim=this.view==='portrait'?1.62:1.0;
      this.camera.position.set(0,aim,distance*(this.camera.aspect<.85?1.4:1));
      this.controls.target.set(0,aim,0);this.camera.updateProjectionMatrix();this.controls.update();return;
    }
    this.cinematography.update(0, this.director, this.followPoint(), this.view, true); this.controls.update(); }
  frame(now) {
    const wallDt = (now - (this.last ?? now)) / 1000; this.last = now;
    if (document.hidden || this.contextLost || this.suspended) return;
    this.performance.begin();
    // Authored poses follow wall time even below 20 fps; physics keeps its small step.
    const dt = Math.min(this.isShowcase ? .25 : .05, wallDt)*this.playbackSpeed;
    const active = this.audio.mode !== 'idle';
    this.music.update(Math.min(.05,wallDt), this.analyzer.analyse(this.audio.spectrum(), this.audio.context?.sampleRate || 44100, this.sensitivity), active);
    const animate = !this.paused && this.loaded && this.hasCharacter;
    const effects = this.inspection || !this.hasCharacter ? 0 : this.effects;
    const showcase = !active || this.audio.mode === 'demo' || this.audio.fileName === 'Fimken — First Light.wav';
    if (animate) {
      this.time += dt;
      if (!this.isShowcase && this.audio.fileName === 'Fimken — First Light.wav' && this.audio.playbackStartedAt != null) {
        // The soundtrack is the clock, including after background tabs or a visual pause.
        this.director.time = Math.max(0, this.audio.context.currentTime - this.audio.playbackStartedAt - dt);
      }
      this.director.update(dt, this.music, showcase);
      const { state, progress } = this.director;
      const body = this.physics.bodies[0];
      const lift = this.isShowcase ? 0 : state === 'jump' ? progress * .4 : state === 'float' ? .4 + Math.sin(progress * Math.PI) * 1.55 : state === 'land' ? (1 - progress) * .2 : 0;
      body.target.x = state === 'gesture' ? Math.sin(progress * Math.PI) * .18 : 0;
      body.target.y = lift; body.target.z = 0;
      if (this.lastRevision !== this.director.revision) {
        this.lastRevision = this.director.revision;
        if (!this.isShowcase && (state === 'blast' || state === 'punch' || state === 'kick')) {
          if (this.physicsEnabled) body.impulse(0, .08, -.5);
          this.shake = .018 * this.impactStrength;
          this.canvas.dataset.impacts = String(Number(this.canvas.dataset.impacts || 0) + 1);
        }
      }
      this.physics.enabled = this.physicsEnabled; this.physics.update(Math.min(.05, dt));
      const p = this.physicsEnabled ? body.position : body.target;
      this.actor.root.position.set(p.x, Math.max(0, p.y), p.z);
      const turn = state === 'gesture' ? Math.sin(progress * Math.PI) * .4 : state === 'punch' ? -.25 : 0;
      this.actor.root.rotation.y = THREE.MathUtils.damp(this.actor.root.rotation.y, turn + CHARACTER.facing, 4, dt);
      this.actor.showcasePose=this.isShowcase ? this.director.pose : null;
      this.actor.update(dt, this.time, this.isShowcase?'idle':state, this.music);
      const contact=this.director.signals?.impact||this.director.signals?.landing;
      if(contact){this.shake=.012*contact.strength*this.impactStrength;this.canvas.dataset.contacts=String(Number(this.canvas.dataset.contacts||0)+1);}
      if(this.director.signals?.surge){this.shake=.014*this.impactStrength;}
      // Beats land as a small camera punch while the hero is powered up.
      if(this.music.beat && effects>0 && this.director.power>.4)this.shake=Math.max(this.shake,.004*this.music.beatStrength*this.impactStrength);
      if(this.director.signals?.release){this.shake=.025*this.impactStrength;this.canvas.dataset.impacts=String(Number(this.canvas.dataset.impacts||0)+1);}
      this.world.update(this.time, this.director.power);
      this.shake *= Math.exp(-dt * 10);
      if (this.autoCamera) this.cinematography.update(dt, this.director, this.followPoint(), this.view);
    }
    this.lighting.update(this.actor.root.position, this.director.power, effects, this.actor, this.director.signals);
    if (this.loaded) this.vfx.update(animate ? dt : 0, this.time, this.actor, this.director, this.music, effects, !animate);
    this.controls.update();
    const position = this.camera.position.clone();
    if(this.reducedMotion)this.shake=0;
    if(animate && this.isShowcase && !this.reducedMotion && effects>0 && this.director.state==='powerup')this.shake=Math.max(this.shake,.0016*this.director.power*this.impactStrength);
    if (animate && !this.inspection) { this.camera.position.x += Math.sin(this.time * 67) * this.shake; this.camera.position.y += Math.sin(this.time * 81) * this.shake * .5; }
    this.actor.anchor('chest',this.pipeline.heatWorld);
    // Root speed drives the speed lines; smoothed so they fade in and out.
    const root = this.actor.root.position, travelled = this.lastRoot ? root.distanceTo(this.lastRoot) : 0; (this.lastRoot ||= root.clone()).copy(root);
    const pace = animate && wallDt > 0 && !this.reducedMotion ? THREE.MathUtils.clamp((travelled / Math.max(dt, 1e-3) - .9) / 1.5, 0, 1) * effects : 0;
    this.pipeline.speed = THREE.MathUtils.damp(this.pipeline.speed || 0, pace, pace > (this.pipeline.speed || 0) ? 30 : 6, Math.min(.05, wallDt));
    this.pipeline.cold = THREE.MathUtils.damp(this.pipeline.cold || 0, (this.director.signals?.beam || 0) * .75 * effects + (this.director.signals?.charge || 0) * .35 * effects, 4, Math.min(.05, wallDt));
    this.pipeline.gpuMs = this.performance.stats.gpuMs;
    this.pipeline.render(wallDt, this.director.power, effects, this.time);
    this.camera.position.copy(position);
    this.performance.end(wallDt);
    if (this.loaded) this.canvas.dataset.ready = 'true';
    this.canvas.dataset.moveTime=String(this.director.time.toFixed(3));
    this.canvas.dataset.beamRadius=this.vfx.beam.visible?this.vfx.beam.scale.x.toFixed(3):'0';
    this.canvas.dataset.beamLength=this.vfx.beam.visible?this.vfx.beam.scale.y.toFixed(3):'0';
    this.canvas.dataset.move=this.director.moveId||'';
    this.canvas.dataset.stage=this.director.stage||'';
    this.canvas.dataset.auto=String(Boolean(this.director.auto));
    this.canvas.dataset.rootPosition=this.actor.root.position.toArray().map(v=>v.toFixed(3)).join(',');
    this.canvas.dataset.charge=String(this.director.signals?.charge||0);
    this.canvas.dataset.phase = this.director.state;
    this.canvas.dataset.shot = this.director.shot;
    this.canvas.dataset.progress = this.director.progress.toFixed(3);
    this.canvas.dataset.beamVisible = String(this.vfx.beam.visible);
    this.canvas.dataset.section = this.music.section;
    this.canvas.dataset.finish = this.actor.finish || 'authored';
  }
}
