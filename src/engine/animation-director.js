import * as THREE from 'three';

const LOOPS = new Set(['idle', 'walk', 'run', 'float', 'charge', 'hero']);
export class AnimationDirector {
  constructor(model, clips, mapping) {
    this.mixer = new THREE.AnimationMixer(model);
    this.mapping = mapping;
    this.actions = new Map(clips.map(clip => [clip.name, this.mixer.clipAction(clip)]));
    this.active = null;
    this.state = '';
    this.play('idle', .01);
    this.mixer.update(0);
  }
  play(state, fade = .45) {
    const action = this.actions.get(this.mapping[state]) || this.actions.get(this.mapping.idle);
    if (!action || (this.state === state && action === this.active)) return;
    this.state = state;
    if (action === this.active) return;
    // Fade every previous action out; stale layers cannot accumulate on interruptions.
    // A completed clampWhenFinished action is paused but still contributes weight.
    // It must fade out too, or power poses leak into subsequent walking/flight clips.
    for (const other of this.actions.values()) if (other !== action && other.enabled) other.fadeOut(fade);
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    action.setLoop(LOOPS.has(state) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.fadeIn(fade).play();
    this.active = action;
  }
  update(dt, music) {
    // Small tempo changes retain believable animation timing.
    if (this.active) this.active.timeScale = .92 + (music?.energy || 0) * .16;
    this.mixer.update(dt);
  }
  dispose(model) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(model); }
}
