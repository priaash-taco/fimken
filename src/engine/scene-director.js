export const SHOWCASE = Object.freeze([
  { start: 0, end: 4, action: 'idle', shot: 'hero', power: .08 },
  { start: 4, end: 8, action: 'powerup', shot: 'push', power: .8 },
  { start: 8, end: 9.4, action: 'blast', shot: 'impact', power: 1 },
  { start: 9.4, end: 12, action: 'gesture', shot: 'orbit', power: .35 },
  { start: 12, end: 14, action: 'punch', shot: 'side', power: .45 },
  { start: 14, end: 15, action: 'jump', shot: 'rise', power: .8 },
  { start: 15, end: 18.5, action: 'float', shot: 'wide', power: .55 },
  { start: 18.5, end: 20, action: 'land', shot: 'settle', power: .15 },
]);

export class SceneDirector {
  constructor() { this.mode = 'balanced'; this.reset(); }
  reset() {
    this.time = 0; this.elapsed = 0; this.state = 'idle'; this.shot = 'hero';
    this.power = .08; this.progress = 0; this.revision = (this.revision || 0) + 1;
    this.manual = null; this.previousIndex = -1; this.cutAge = 0; this.lastPhrase = -1;
    this.manualIndex = 0; this.lastMode = null;
  }
  practice(action) {
    this.manual = action === 'blast' ? [
      { action: 'powerup', shot: 'push', duration: 3, power: .8 },
      { action: 'charge', shot: 'close', duration: 2, power: .9 },
      { action: 'blast', shot: 'impact', duration: 1.4, power: 1 },
      { action: 'recover', shot: 'hero', duration: 2, power: .2 },
    ] : action === 'martial' ? [
      { action: 'anticipation', shot: 'side', duration: 1.3, power: .15 },
      { action: 'punch', shot: 'side', duration: 1.3, power: .4 },
      { action: 'kick', shot: 'impact', duration: 1.4, power: .45 },
      { action: 'recover', shot: 'hero', duration: 1.8, power: .15 },
    ] : [{ action: 'powerup', shot: 'push', duration: 4, power: .85 }, { action: 'recover', shot: 'hero', duration: 2, power: .1 }];
    this.manualIndex = 0; this.elapsed = 0;
    this.enter(this.manual[0]);
  }
  enter(entry) {
    this.state = entry.action; this.shot = entry.shot; this.power = entry.power;
    this.elapsed = 0; this.cutAge = 0; this.revision++;
  }
  update(dt, music, showcase = true) {
    this.time += dt; this.elapsed += dt; this.cutAge += dt;
    if (this.manual) {
      const entry = this.manual[this.manualIndex];
      this.progress = Math.min(1, this.elapsed / entry.duration);
      if (this.elapsed >= entry.duration) {
        this.manualIndex++;
        if (this.manualIndex < this.manual.length) this.enter(this.manual[this.manualIndex]);
        else { this.manual = null; this.previousIndex = -1; this.time = 0; this.enter({ action: 'idle', shot: 'hero', power: .08 }); }
      }
      return;
    }
    if (showcase !== this.lastMode) { this.previousIndex = -1; this.lastPhrase = -1; this.elapsed = 0; this.lastMode = showcase; }
    if (showcase) {
      const t = this.time % 20;
      const index = SHOWCASE.findIndex(entry => t >= entry.start && t < entry.end);
      let entry = SHOWCASE[Math.max(0, index)];
      if (this.mode === 'melee' && ['powerup', 'blast'].includes(entry.action)) entry = { ...entry, action: entry.action === 'blast' ? 'punch' : 'anticipation', power: .2 };
      if (this.mode === 'energy' && ['punch', 'gesture'].includes(entry.action)) entry = { ...entry, action: 'charge', power: .6 };
      if (index !== this.previousIndex) { this.enter(entry); this.previousIndex = index; }
      this.progress = (t - entry.start) / (entry.end - entry.start);
      this.power = entry.power * (entry.action === 'powerup' ? .2 + this.progress * .8 : 1);
    } else {
      // Four-bar phrases when the beat tracker is confident, otherwise held 8-second sections.
      const phrase = music.bpm ? Math.floor(music.beatCount / 16) : Math.floor(this.time / 8);
      const due = this.elapsed > 8 || (phrase !== this.lastPhrase && this.cutAge > 4);
      if ((music.drop && this.cutAge > 2) || due || this.lastPhrase === -1) {
        const direction = music.drop ? { action: 'blast', shot: 'impact', power: 1 }
          : music.section === 'build' ? { action: 'powerup', shot: 'push', power: .8 }
          : music.section === 'peak' ? { action: this.mode === 'melee' ? 'punch' : 'charge', shot: 'orbit', power: .7 }
          : music.section === 'breakdown' ? { action: 'float', shot: 'wide', power: .15 }
          : { action: 'idle', shot: phrase % 2 ? 'close' : 'hero', power: .08 };
        this.enter(direction); this.lastPhrase = phrase;
      }
      // One-shot actions resolve; a sustained section never freezes on a punch forever.
      if (this.elapsed > 1.4 && ['blast', 'punch'].includes(this.state)) this.enter({ action: 'recover', shot: 'hero', power: .25 });
      if (this.elapsed > 2.2 && this.state === 'recover') this.enter({ action: 'idle', shot: 'hero', power: .12 });
      this.progress = Math.min(1, this.elapsed / 4);
    }
  }
}
