export class AudioEngine {
  constructor() {
    this.mode = 'idle';
    this.bins = new Uint8Array(512);
    this.request = 0;
  }

  async init() {
    if (!this.context) {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      // Analyse only: never send captured sound back to the speakers.
    }
    await this.context.resume();
  }

  async connect(mode) {
    this.stop();
    const request = this.request;
    let stream;
    try {
      if (mode === 'mic') {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access needs a supported browser on HTTPS or localhost.');
        stream = await navigator.mediaDevices.getUserMedia({ audio: {
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        }, video: false });
      } else {
        if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('PC audio is unavailable here. Open Fimken in desktop Chrome or Edge, or use your microphone.');
        // Open the picker before another await, preserving click activation.
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' }, audio: { suppressLocalAudioPlayback: false },
          selfBrowserSurface: 'exclude', systemAudio: 'include',
        });
      }
      if (request !== this.request) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      if (!stream.getAudioTracks().length) throw new Error('No audio was shared. Choose Entire screen and enable system audio. If your browser offers no system audio, share a tab with audio or use the microphone.');
      await this.init();
      if (request !== this.request) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      this.source = this.context.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      this.mode = mode;
      // Retain video for the browser sharing lifecycle; no video is processed.
      stream.getTracks().forEach(track => track.addEventListener('ended', () => {
        if (this.stream === stream) this.stop();
      }));
      if (stream.getAudioTracks().every(track => track.readyState === 'ended')) this.stop();
      this.onchange?.();
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (request !== this.request) return;
      this.stop();
      throw error;
    }
  }

  demo() {
    this.stop();
    this.mode = 'demo';
    this.onchange?.();
  }

  async file(file) {
    if (!file || file.size > 100 * 1024 * 1024) throw new Error('Choose an audio file smaller than 100 MB.');
    this.stop();
    const request = this.request;
    try {
      await this.init();
      const buffer = await this.context.decodeAudioData(await file.arrayBuffer());
      if (request !== this.request) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      this.source = source;
      this.mode = 'file';
      this.fileName = file.name;
      source.onended = () => { if (this.source === source) this.stop(); };
      source.start();
      this.playbackStartedAt = this.context.currentTime;
      this.onchange?.();
    } catch (error) {
      if (request !== this.request) return;
      this.stop();
      throw new Error('That file could not be played. Try MP3, WAV or another audio format supported by your browser.');
    }
  }

  stop() {
    this.request++;
    const source = this.source;
    this.source = null;
    source?.disconnect();
    if (source?.stop) { try { source.stop(); } catch { /* Already ended. */ } }
    this.analyser?.disconnect?.();
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.mode = 'idle';
    this.fileName = null;
    this.playbackStartedAt = null;
    this.bins.fill(0);
    this.onchange?.();
  }

  spectrum() {
    if (this.mode === 'demo') {
      const t = performance.now() / 1000;
      const beat = Math.exp(-(t % 0.625) * 9);
      for (let i = 0; i < this.bins.length; i++) {
        this.bins[i] = (35 + 135 * beat + 50 * Math.sin(i * 0.14 + t * 2) ** 2) * Math.exp(-i / 140);
      }
    } else if (this.mode !== 'idle') this.analyser.getByteFrequencyData(this.bins);
    else this.bins.fill(0);
    return this.bins;
  }
}
