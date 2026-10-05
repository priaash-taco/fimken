// Developer performance readout: frame pacing, script time, draw calls, triangles and,
// where the browser exposes timer queries, GPU time. Hidden unless toggled (P or ?perf=1).
// Counters cover every pass of a frame: shadow map, scene, and post-processing.
const SAMPLES = 120;
export class PerformanceMonitor {
  constructor(renderer, canvas) {
    this.renderer = renderer; this.canvas = canvas; this.gl = renderer.getContext();
    renderer.info.autoReset = false;
    this.timer = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.intervals = new Float32Array(SAMPLES); this.count = 0; this.index = 0;
    this.stats = { fps: 0, frameMs: 0, p95Ms: 0, worstMs: 0, scriptMs: 0, gpuMs: null, calls: 0, triangles: 0, points: 0, lines: 0 };
    this.visible = false; this.gpuTiming = true; this.refreshAge = 0;
    this.element = document.createElement('pre'); this.element.className = 'performance-overlay'; this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Performance readout');
    canvas.parentElement?.append(this.element);
  }
  setVisible(visible) { this.visible = Boolean(visible); this.element.hidden = !this.visible; }
  toggle() { this.setVisible(!this.visible); return this.visible; }
  begin() {
    this.renderer.info.reset(); this.started = performance.now();
    // One query at a time; a result arrives a few frames later without stalling the pipeline.
    // It also tells the renderer how much headroom the GPU has at the current resolution.
    if (this.timer && this.gpuTiming && !this.pending) {
      this.active = this.gl.createQuery(); this.gl.beginQuery(this.timer.TIME_ELAPSED_EXT, this.active);
    }
  }
  end(wallDt) {
    const gl = this.gl, s = this.stats, info = this.renderer.info.render;
    if (this.active) { gl.endQuery(this.timer.TIME_ELAPSED_EXT); this.pending = this.active; this.active = null; }
    else if (this.pending && gl.getQueryParameter(this.pending, gl.QUERY_RESULT_AVAILABLE)) {
      const disjoint = gl.getParameter(this.timer.GPU_DISJOINT_EXT), ms = gl.getQueryParameter(this.pending, gl.QUERY_RESULT) / 1e6;
      if (!disjoint) s.gpuMs = s.gpuMs == null ? ms : s.gpuMs + (ms - s.gpuMs) * .2;
      gl.deleteQuery(this.pending); this.pending = null;
    }
    const script = performance.now() - this.started;
    s.scriptMs += (script - s.scriptMs) * .1;
    s.calls = info.calls; s.triangles = info.triangles; s.points = info.points; s.lines = info.lines;
    if (wallDt > 0 && wallDt < 1) { this.intervals[this.index] = wallDt * 1000; this.index = (this.index + 1) % SAMPLES; this.count = Math.min(SAMPLES, this.count + 1); }
    this.refreshAge += wallDt;
    if (this.visible && this.refreshAge > .25) { this.refreshAge = 0; this.element.textContent = this.describe(); }
  }
  // Pacing over the last 120 frames (about two seconds at 60 fps).
  snapshot() {
    const s = this.stats, sorted = Array.from(this.intervals.subarray(0, this.count)).sort((a, b) => a - b);
    if (sorted.length) {
      s.frameMs = sorted.reduce((sum, v) => sum + v, 0) / sorted.length; s.fps = 1000 / s.frameMs;
      s.p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))]; s.worstMs = sorted.at(-1);
    }
    return { ...s, resolution: this.canvas.dataset.resolution, renderScale: this.canvas.dataset.renderScale };
  }
  describe() {
    const s = this.snapshot(), n = (v, d = 1) => v.toFixed(d);
    return [`${n(s.fps, 0)} fps   ${n(s.frameMs)} ms`, `95th ${n(s.p95Ms)} ms   worst ${n(s.worstMs)} ms`,
      `script ${n(s.scriptMs)} ms   GPU ${s.gpuMs == null ? 'n/a' : n(s.gpuMs) + ' ms'}`,
      `${s.calls} draws   ${(s.triangles / 1000).toFixed(0)}k triangles`, `${s.resolution} × ${s.renderScale}`].join('\n');
  }
}
