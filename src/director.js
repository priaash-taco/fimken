// Solo practice continues in silence; musical energy changes pace and intensity.
export const DURATIONS = Object.freeze({ hover: 2.4, move: 2.2, punch: 1.25, kick: 1.5, dodge: 1.2, powerup: 3.4, charge: 2.6, blast: 2.4, recover: 2.2 });
const ROUTINES = {
  balanced: ['hover', 'move', 'punch', 'kick', 'dodge', 'powerup', 'charge', 'blast', 'recover'],
  melee: ['hover', 'move', 'punch', 'kick', 'dodge', 'punch', 'recover'],
  energy: ['hover', 'powerup', 'charge', 'blast', 'recover'],
};

export class Director {
  constructor() {
    this.energy = this.average = this.cooldown = this.beats = this.attack = this.previousRaw = 0;
    this.enabled = true;
    this.mode = 'balanced';
    this.reset();
  }

  reset() {
    this.state = 'hover';
    this.elapsed = 0;
    this.index = 0;
    this.sequence = null;
    this.sequenceIndex = 0;
    this.currentMode = this.mode;
    this.revision = (this.revision || 0) + 1;
  }

  practice(action) {
    const sequences = {
      martial: ['move', 'punch', 'kick', 'dodge', 'recover'],
      powerup: ['powerup', 'recover'],
      blast: ['powerup', 'charge', 'blast', 'recover'],
    };
    if (!sequences[action]) return;
    this.sequence = sequences[action];
    this.sequenceIndex = 0;
    this.currentMode = this.mode;
    this.transition(this.sequence[0]);
  }

  transition(state) {
    this.state = state;
    this.elapsed = 0;
    this.revision++;
  }

  get progress() { return Math.min(1, this.elapsed / DURATIONS[this.state]); }

  update(dt, bins, sensitivity, active) {
    let bass = 0, high = 0;
    for (let i = 1; i < 32; i++) bass += bins[i] / (31 * 255);
    for (let i = 32; i < 180; i++) high += bins[i] / (148 * 255);
    const raw = active ? Math.min(1, (bass * .8 + high * .2) * (.4 + sensitivity * 2.1)) : 0;
    this.energy += (raw - this.energy) * (1 - Math.exp(-dt * 10));
    this.average += (raw - this.average) * (1 - Math.exp(-dt * 1.4));
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.attack *= Math.exp(-dt * 5);
    const rising = raw - this.previousRaw > .018;
    const beat = active && rising && raw > .1 && raw > this.average * 1.22 + .035 && this.cooldown === 0;
    this.previousRaw = raw;
    if (beat) { this.beats++; this.cooldown = .28; this.attack = 1; }
    if (!this.enabled) return this.state;
    if (this.currentMode !== this.mode) this.reset();
    this.elapsed += dt * (1 + this.energy * .35);
    if (this.elapsed >= DURATIONS[this.state]) {
      if (this.sequence) {
        this.sequenceIndex++;
        if (this.sequenceIndex < this.sequence.length) this.transition(this.sequence[this.sequenceIndex]);
        else { this.sequence = null; this.index = 0; this.transition('hover'); }
      } else {
        const routine = ROUTINES[this.mode] || ROUTINES.balanced;
        this.index = (this.index + 1) % routine.length;
        this.transition(routine[this.index]);
      }
    }
    return this.state;
  }
}
