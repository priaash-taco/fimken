const clamp = value => Math.max(0, Math.min(1, value));
const follow = (value, target, dt, speed) => value + (target - value) * (1 - Math.exp(-dt * speed));

export class AudioAnalyzer {
  constructor() { this.previous = new Float32Array(512); }
  analyse(bins, sampleRate = 44100, sensitivity = .65) {
    const hz = sampleRate / (bins.length * 2);
    const band = (low, high) => {
      const start = Math.max(1, Math.floor(low / hz)), end = Math.min(bins.length, Math.ceil(high / hz));
      let sum = 0;
      for (let i = start; i < end; i++) sum += (bins[i] / 255) ** 2;
      return Math.sqrt(sum / Math.max(1, end - start));
    };
    let flux = 0;
    for (let i = 1; i < Math.min(256, bins.length); i++) {
      const value = bins[i] / 255;
      flux += Math.max(0, value - (this.previous[i] || 0));
      this.previous[i] = value;
    }
    const gain = .55 + sensitivity * 1.35;
    const bass = clamp(band(35, 200) * gain), mids = clamp(band(200, 2200) * gain), highs = clamp(band(2200, 10000) * gain);
    return { bass, mids, highs, energy: clamp(bass * .45 + mids * .4 + highs * .15), flux: flux / 255 };
  }
}

export class MusicState {
  constructor() { this.reset(); }
  reset() {
    Object.assign(this, { time: 0, energy: 0, rolling: 0, longTerm: 0, bass: 0, mids: 0, highs: 0,
      fluxAverage: 0, beat: false, beatStrength: 0, beatCount: 0, bpm: null, confidence: 0,
      lastBeat: -10, lastDrop: -10, bassAverage: 0, lastBassHit: -10, bassHit: false, lastCrescendo: -10, crescendo: false, sustained: false, sustainedFor: 0, section: 'quiet', sectionAge: 0, change: 0, drop: false, intervals: [] });
  }
  update(dt, sample, active) {
    this.time += dt;
    const before = this.rolling;
    for (const key of ['bass', 'mids', 'highs', 'energy']) this[key] = follow(this[key], active ? sample[key] : 0, dt, 9);
    this.rolling = follow(this.rolling, this.energy, dt, .65);
    this.longTerm = follow(this.longTerm, this.energy, dt, .13);
    this.change = this.rolling - this.longTerm;
    this.beat = active && this.time > .35 && sample.flux > Math.max(.018, this.fluxAverage * 1.8) && this.energy > .07 && this.time - this.lastBeat > .28;
    this.fluxAverage = follow(this.fluxAverage, sample.flux, dt, 2.5);
    this.beatStrength *= Math.exp(-dt * 8);
    this.drop = false;
    // Bass hit: a bass transient well above its running average. Crescendo: energy climbing
    // over several seconds. Sustained: a held tone (mids up, little flux).
    this.bassHit = active && sample.bass > this.bassAverage * 1.5 + .14 && this.time - this.lastBassHit > .45 && this.time > .5;
    if (this.bassHit) this.lastBassHit = this.time;
    this.bassAverage = follow(this.bassAverage, sample.bass, dt, 2.5);
    this.crescendo = active && this.change > .14 && this.rolling > .28 && this.time - this.lastCrescendo > 8;
    if (this.crescendo) this.lastCrescendo = this.time;
    const held = active && this.mids > .28 && this.fluxAverage < .012 && this.energy > .15;
    this.sustainedFor = held ? (this.sustainedFor || 0) + dt : 0;
    this.sustained = this.sustainedFor > 1.2;
    if (this.beat) {
      const interval = this.time - this.lastBeat;
      if (interval > .3 && interval < 1.05) {
        this.intervals.push(interval);
        if (this.intervals.length > 12) this.intervals.shift();
        const sorted = [...this.intervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const deviation = this.intervals.reduce((sum, n) => sum + Math.abs(n - median), 0) / this.intervals.length;
        this.confidence = clamp(1 - deviation / .12) * Math.min(1, this.intervals.length / 6);
        this.bpm = this.confidence > .5 ? Math.round(60 / median) : null;
      }
      this.beatStrength = clamp(sample.flux * 10 + this.energy * .4);
      this.lastBeat = this.time;
      this.beatCount++;
      this.drop = this.energy > .4 && this.energy - before > .12 && this.time - this.lastDrop > 7;
      if (this.drop) this.lastDrop = this.time;
    }
    // Discard tempo when beats stop; silence cannot keep advancing invented bars.
    if (this.time - this.lastBeat > 2.5) { this.bpm = null; this.confidence = 0; this.intervals.length = 0; }
    const next = this.energy < .08 ? 'quiet' : this.change < -.09 ? 'breakdown' : this.change > .08 ? 'build' : this.rolling > .38 ? 'peak' : 'flow';
    this.sectionAge += dt;
    if (next !== this.section && (this.sectionAge > 2 || this.drop)) { this.section = next; this.sectionAge = 0; }
    return this;
  }
}
