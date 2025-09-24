// Advanced Web Audio engine with multi-band feature extraction and adaptive smoothing

function clamp(x, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

const BAND_DEFS = [
  { name: 'sub', lo: 20, hi: 60 },
  { name: 'bass', lo: 60, hi: 160 },
  { name: 'lowMid', lo: 160, hi: 320 },
  { name: 'mid', lo: 320, hi: 800 },
  { name: 'hiMid', lo: 800, hi: 2000 },
  { name: 'presence', lo: 2000, hi: 4000 },
  { name: 'brilliance', lo: 4000, hi: 8000 },
  { name: 'air', lo: 8000, hi: 16000 },
];

const DEFAULT_ENV = { attack: 0.5, release: 0.2 };

const LOG_DB_MIN = -90;
const LOG_DB_MAX = 6;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyserWide = null;
    this.analyserFast = null;
    this.source = null;
    this.sourceKind = null; // 'mic' | 'file'

    this.freqWide = null;
    this.freqFast = null;
    this.timeWide = null;
    this.timeFast = null;
    this._magWide = null;
    this._magFast = null;
    this._prevMagWide = null;
    this._prevMagFast = null;

    this.monitorGain = null;
    this.monitorEnabled = false;
    this.monitorLevel = 0.0;
    this.inputGain = 1.0;

    this._lastUpdate = 0;
    this._beatState = { thr: 0.0, avg: 0.0, last: 0, hold: 0.12 };
    this._fluxWindow = new Float32Array(96);
    this._fluxIdx = 0;
    this._fluxCount = 0;
    this._thrMethod = 'median';
    this._thrK = 1.8;

    this._agcAmount = 0.0;
    this._agcLevel = 0.2;
    this._gateLevel = 0.003;
    this._gateHold = 0.2;
    this._gateTimer = 0;

    this._tempoEnabled = false;
    this._tempoBpm = 0;
    this._tempoPhase01 = 0;
    this._tempoConf = 0;
    this._barPhase01 = 0;
    this._swing = 0;
    this._lastBeatAt = 0;
    this._beatParity = 0;
    this._beatEvenInterval = 0;
    this._beatOddInterval = 0;
    this._fluxHist = new Float32Array(384);
    this._fluxHistIdx = 0;
    this._fluxHistCount = 0;

    this._envCfgMap = {
      level: { ...DEFAULT_ENV },
      beat: { attack: 0.7, release: 0.25 },
      bass: { ...DEFAULT_ENV },
      mid: { ...DEFAULT_ENV },
      treble: { ...DEFAULT_ENV },
    };
    BAND_DEFS.forEach((band) => {
      this._envCfgMap[band.name] = { attack: 0.55, release: 0.22 };
      this._envCfgMap[`transient:${band.name}`] = { attack: 0.8, release: 0.35 };
    });

    this._env = {};
    this._bandPrev = {};

    this._transientCfg = { sensitivity: 1.0, decay: 0.4 };

    this._loudness = -40;
    this._loudnessSlow = -45;

    this._macro = { state: 'idle', strength: 0, last: 'idle' };

    this._filterBank = null;

    this._features = {
      level: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      centroid: 0,
      flux: 0,
      beat: 0,
      beatPulse: 0,
      tempoBpm: 0,
      tempoPhase01: 0,
      tempoConf: 0,
      barPhase01: 0,
      swing: 0,
      fluxBass: 0,
      fluxMid: 0,
      fluxTreble: 0,
      bands: {},
      bandArray: new Float32Array(BAND_DEFS.length),
      transient: 0,
      transientBands: {},
      loudness: 0,
      loudnessTrend: 0,
      macroState: 'idle',
      macroStrength: 0,
      macroWeights: { impact: 0, lift: 0, fall: 0, sustain: 0 },
    };
  }

  async ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!this.analyserWide) {
      this.analyserWide = this.ctx.createAnalyser();
      this.analyserWide.fftSize = 2048;
      this.analyserWide.smoothingTimeConstant = 0.6;
      this._allocateWideBuffers();
    }
    if (!this.analyserFast) {
      this.analyserFast = this.ctx.createAnalyser();
      this.analyserFast.fftSize = 512;
      this.analyserFast.smoothingTimeConstant = 0.3;
      this._allocateFastBuffers();
    }
    if (!this.monitorGain) {
      this.monitorGain = this.ctx.createGain();
      this.monitorGain.gain.value = this.monitorLevel;
    }
    if (!this._filterBank) {
      this._buildFilterBank();
    }
  }

  _allocateWideBuffers() {
    const a = this.analyserWide;
    if (!a) return;
    this.freqWide = new Float32Array(a.frequencyBinCount);
    this.timeWide = new Float32Array(a.fftSize);
    this._magWide = new Float32Array(a.frequencyBinCount);
    this._prevMagWide = new Float32Array(a.frequencyBinCount);
    this._filterBank = null; // rebuild with new fft size
    BAND_DEFS.forEach((band) => { this._bandPrev[band.name] = 0; });
  }

  _allocateFastBuffers() {
    const a = this.analyserFast;
    if (!a) return;
    this.freqFast = new Float32Array(a.frequencyBinCount);
    this.timeFast = new Float32Array(a.fftSize);
    this._magFast = new Float32Array(a.frequencyBinCount);
    this._prevMagFast = new Float32Array(a.frequencyBinCount);
  }

  _buildFilterBank() {
    if (!this.analyserWide || !this.ctx) return;
    const sampleRate = this.ctx.sampleRate || 48000;
    const hzPerBin = sampleRate / this.analyserWide.fftSize;
    const bank = BAND_DEFS.map((band) => {
      const lo = Math.max(0, Math.floor(band.lo / hzPerBin));
      const hi = Math.max(lo, Math.min(this.analyserWide.frequencyBinCount - 1, Math.ceil(band.hi / hzPerBin)));
      return { name: band.name, lo, hi, width: Math.max(1, hi - lo + 1) };
    });
    this._filterBank = bank;
  }

  async connectMic() {
    await this.ensureContext();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 2,
      },
      video: false,
    });
    const src = this.ctx.createMediaStreamSource(stream);
    this.sourceKind = 'mic';
    this._connectSource(src);
  }

  async connectFile(arrayBuffer) {
    await this.ensureContext();
    const buf = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.sourceKind = 'file';
    this._connectSource(src);
    src.start();
  }

  _connectSource(src) {
    if (!this.ctx) return;
    if (this.source) {
      try { this.source.disconnect(); } catch (_) { /* noop */ }
    }
    this.source = src;
    if (this.analyserWide) src.connect(this.analyserWide);
    if (this.analyserFast) src.connect(this.analyserFast);

    try { this.monitorGain?.disconnect(); } catch (_) { /* noop */ }
    if (this.sourceKind === 'file') {
      src.connect(this.ctx.destination);
    } else if (this.sourceKind === 'mic') {
      if (this.monitorEnabled && this.monitorGain) {
        this.monitorGain.gain.value = this.monitorLevel;
        src.connect(this.monitorGain);
        this.monitorGain.connect(this.ctx.destination);
      }
    }
  }

  setInputGain(v = 1.0) { this.inputGain = clamp(v, 0.05, 4.0); }
  setMonitorEnabled(v = false) { this.monitorEnabled = !!v; }
  setMonitorLevel(v = 0.0) { this.monitorLevel = clamp(v, 0.0, 1.0); if (this.monitorGain) this.monitorGain.gain.value = this.monitorLevel; }

  setSmoothing(attack = 0.5, release = 0.2) {
    this._envCfgMap.level = { attack: clamp(attack, 0.01, 0.99), release: clamp(release, 0.01, 0.99) };
  }

  setFeatureSmoothing(map) {
    if (!map) return;
    Object.entries(map).forEach(([key, cfg]) => {
      if (!cfg) return;
      const entry = this._envCfgMap[key] || { ...DEFAULT_ENV };
      if (cfg.attack !== undefined) entry.attack = clamp(cfg.attack, 0.01, 0.99);
      if (cfg.release !== undefined) entry.release = clamp(cfg.release, 0.01, 0.99);
      this._envCfgMap[key] = entry;
    });
  }

  setTransientSensitivity(v = 1.0) { this._transientCfg.sensitivity = clamp(v, 0.2, 4.0); }
  setTransientDecay(v = 0.4) { this._transientCfg.decay = clamp(v, 0.05, 1.5); }

  setFluxThreshold({ method = 'median', k = 1.8 } = {}) {
    if (method === 'avg' || method === 'median') this._thrMethod = method;
    this._thrK = clamp(k, 0.5, 4.0);
  }

  setAgc(amount = 0.0) { this._agcAmount = clamp(amount, 0.0, 1.0); }
  setGate(level = 0.003, hold = 0.2) {
    this._gateLevel = Math.max(0, level);
    this._gateHold = Math.max(0.05, hold);
  }
  enableTempo(v = true) { this._tempoEnabled = !!v; }

  setFftSize(size = 2048) {
    if (!this.analyserWide) return;
    const allowed = [1024, 2048, 4096];
    const nearest = allowed.reduce((prev, cur) => Math.abs(cur - size) < Math.abs(prev - size) ? cur : prev, allowed[0]);
    this.analyserWide.fftSize = nearest;
    this.analyserWide.smoothingTimeConstant = nearest >= 4096 ? 0.7 : 0.6;
    this._allocateWideBuffers();
    if (this.analyserFast) {
      const fastSize = nearest >= 4096 ? 1024 : 512;
      this.analyserFast.fftSize = fastSize;
      this.analyserFast.smoothingTimeConstant = fastSize === 1024 ? 0.35 : 0.3;
      this._allocateFastBuffers();
    }
    this._buildFilterBank();
  }

  _applyEnvelope(key, value) {
    const cfg = this._envCfgMap[key] || DEFAULT_ENV;
    const cur = this._env[key] ?? 0;
    const target = value;
    const k = target > cur ? (cfg.attack ?? DEFAULT_ENV.attack) : (cfg.release ?? DEFAULT_ENV.release);
    const next = cur + (target - cur) * clamp(k, 0.0, 1.0);
    this._env[key] = next;
    return next;
  }

  update() {
    if (!this.analyserWide || !this.analyserFast) return this._features;

    const now = (performance.now() || 0) / 1000;
    const dt = this._lastUpdate ? Math.max(0.001, now - this._lastUpdate) : 1 / 60;
    this._lastUpdate = now;

    this.analyserWide.getFloatTimeDomainData(this.timeWide);
    this.analyserFast.getFloatTimeDomainData(this.timeFast);

    // RMS level
    let sum = 0;
    for (let i = 0; i < this.timeWide.length; i++) {
      const s = this.timeWide[i] * this.inputGain;
      sum += s * s;
    }
    let level = Math.sqrt(sum / this.timeWide.length);

    if (level < this._gateLevel) {
      this._gateTimer += dt;
      if (this._gateTimer > this._gateHold) level = 0;
    } else {
      this._gateTimer = 0;
    }

    // Adaptive gain control over slow window
    const agcAlpha = 1 - Math.exp(-dt * 2.0);
    this._agcLevel = (1 - agcAlpha) * this._agcLevel + agcAlpha * level;
    if (this._agcAmount > 0) {
      const target = 0.32;
      const gain = target / Math.max(1e-5, this._agcLevel);
      const mixGain = 1 + (gain - 1) * this._agcAmount;
      level = clamp(level * mixGain, 0, 2);
    }

    this.analyserWide.getFloatFrequencyData(this.freqWide);
    this.analyserFast.getFloatFrequencyData(this.freqFast);

    const magWide = this._magWide;
    const magFast = this._magFast;
    for (let i = 0; i < magWide.length; i++) {
      const lin = Math.pow(10, this.freqWide[i] / 20) * this.inputGain;
      magWide[i] = isFinite(lin) ? lin : 0;
    }
    for (let i = 0; i < magFast.length; i++) {
      const lin = Math.pow(10, this.freqFast[i] / 20) * this.inputGain;
      magFast[i] = isFinite(lin) ? lin : 0;
    }

    if (!this._filterBank) this._buildFilterBank();
    const bands = {};
    const bandArray = this._features.bandArray;
    let centroidNum = 0;
    let centroidDen = 0;

    const totalBins = magWide.length;
    const nyquist = (this.ctx?.sampleRate || 48000) * 0.5;
    for (let i = 0; i < totalBins; i++) {
      centroidNum += i * magWide[i];
      centroidDen += magWide[i];
    }
    const centroid = centroidDen > 0 ? (centroidNum / centroidDen) / totalBins : 0;

    const bandFluxAccum = {};
    const bandTransient = {};

    this._filterBank.forEach((entry, idx) => {
      let sumBand = 0;
      let fluxBand = 0;
      for (let i = entry.lo; i <= entry.hi; i++) {
        const val = magWide[i];
        sumBand += val;
        const diff = val - this._prevMagWide[i];
        if (diff > 0) fluxBand += diff;
        this._prevMagWide[i] = val;
      }
      const avgBand = sumBand / entry.width;
      const prev = this._bandPrev[entry.name] || 0;
      this._bandPrev[entry.name] = avgBand;
      const flux = fluxBand / Math.max(1, entry.width);
      bandFluxAccum[entry.name] = flux;
      const transientRaw = Math.max(0, avgBand - prev) * this._transientCfg.sensitivity;
      bandTransient[entry.name] = transientRaw;
      const envVal = this._applyEnvelope(entry.name, clamp(avgBand * 1.2, 0, 1));
      bands[entry.name] = envVal;
      bandArray[idx] = envVal;
      const transientEnv = this._applyEnvelope(`transient:${entry.name}`, clamp(transientRaw, 0, 1));
      this._features.transientBands[entry.name] = transientEnv;
    });

    // Aggregate bass/mid/treble using new band data
    const bass = bands.bass ?? 0;
    const mid = ( (bands.lowMid ?? 0) + (bands.mid ?? 0) + (bands.hiMid ?? 0) ) / 3;
    const treble = ( (bands.presence ?? 0) + (bands.brilliance ?? 0) + (bands.air ?? 0) ) / 3;

    // Flux totals
    let fluxTotal = 0;
    let fluxBass = 0;
    let fluxMid = 0;
    let fluxTreble = 0;
    Object.entries(bandFluxAccum).forEach(([name, val]) => {
      fluxTotal += val;
      if (name === 'sub' || name === 'bass') fluxBass += val;
      else if (name === 'lowMid' || name === 'mid' || name === 'hiMid') fluxMid += val;
      else fluxTreble += val;
    });

    // Beat detection using adaptive threshold
    this._fluxWindow[this._fluxIdx] = fluxTotal;
    this._fluxIdx = (this._fluxIdx + 1) % this._fluxWindow.length;
    this._fluxCount = Math.min(this._fluxWindow.length, this._fluxCount + 1);
    let thr = 0;
    if (this._thrMethod === 'median' && this._fluxCount > 12) {
      const tmp = Array.from(this._fluxWindow.slice(0, this._fluxCount));
      tmp.sort((a, b) => a - b);
      const m = tmp[Math.floor(tmp.length * 0.5)];
      thr = m * this._thrK;
    } else {
      const alpha = 1 - Math.exp(-dt * 4.0);
      this._beatState.avg = (1 - alpha) * this._beatState.avg + alpha * fluxTotal;
      thr = this._beatState.avg * this._thrK;
    }
    this._beatState.thr = thr;

    let beat = 0;
    if (fluxTotal > thr && this._gateTimer < this._gateHold) {
      if (now - this._beatState.last > this._beatState.hold) {
        beat = 1;
        const interval = now - this._beatState.last;
        if (this._beatState.last > 0 && interval < 1.5) {
          if (this._beatParity === 0) this._beatEvenInterval = interval; else this._beatOddInterval = interval;
          this._beatParity = (this._beatParity + 1) % 2;
          if (this._beatEvenInterval && this._beatOddInterval) {
            const avg = (this._beatEvenInterval + this._beatOddInterval) * 0.5;
            if (avg > 0) {
              const diff = this._beatOddInterval - this._beatEvenInterval;
              this._swing = clamp(diff / (avg * 2), -0.45, 0.45);
            }
          }
        }
        this._beatState.last = now;
        this._lastBeatAt = now;
      }
    }

    const beatEnv = this._applyEnvelope('beat', beat ? 1 : 0);
    const beatPulse = beat ? 1 : this._features.beatPulse * Math.exp(-dt / 0.25);

    // Macro classification
    const levelEnv = this._applyEnvelope('level', clamp(level * 1.6, 0, 1));
    const dLevel = (levelEnv - (this._prevLevelEnv ?? levelEnv)) / Math.max(dt, 0.001);
    this._prevLevelEnv = levelEnv;

    let macroCandidate = 'sustain';
    let macroStrength = clamp(levelEnv, 0, 1);
    if (beat) {
      macroCandidate = 'impact';
      macroStrength = 1;
    } else if (dLevel > 0.6) {
      macroCandidate = 'lift';
      macroStrength = clamp(dLevel * 0.6, 0, 1);
    } else if (dLevel < -0.5) {
      macroCandidate = 'fall';
      macroStrength = clamp(-dLevel * 0.6, 0, 1);
    }
    if (macroCandidate !== this._macro.state) {
      this._macro.state = macroCandidate;
      this._macro.last = macroCandidate;
    }
    this._macro.strength = this._macro.strength * (1 - Math.exp(-dt * 4)) + macroStrength * Math.exp(-dt * 4);

    const macroWeights = {
      impact: macroCandidate === 'impact' ? this._macro.strength : 0,
      lift: macroCandidate === 'lift' ? this._macro.strength : 0,
      fall: macroCandidate === 'fall' ? this._macro.strength : 0,
      sustain: macroCandidate === 'sustain' ? this._macro.strength : clamp(levelEnv, 0, 1),
    };

    // Loudness (LUFS-ish)
    const loudnessDb = 20 * Math.log10(Math.max(1e-6, level));
    const loudAlpha = 1 - Math.exp(-dt * 0.7);
    this._loudness = (1 - loudAlpha) * this._loudness + loudAlpha * loudnessDb;
    const loudSlowAlpha = 1 - Math.exp(-dt * 0.2);
    this._loudnessSlow = (1 - loudSlowAlpha) * this._loudnessSlow + loudSlowAlpha * this._loudness;
    const loudNorm = clamp((this._loudness + 60) / 50, 0, 1);
    const loudTrend = clamp((this._loudness - this._loudnessSlow) / 12, -1, 1);

    // Tempo estimation
    if (this._tempoEnabled) {
      this._fluxHist[this._fluxHistIdx] = fluxTotal;
      this._fluxHistIdx = (this._fluxHistIdx + 1) % this._fluxHist.length;
      this._fluxHistCount = Math.min(this._fluxHist.length, this._fluxHistCount + 1);
      if (this._fluxHistCount > 90) {
        const len = this._fluxHistCount;
        const buf = new Float32Array(len);
        for (let i = 0; i < len; i++) buf[i] = this._fluxHist[(this._fluxHistIdx + i) % this._fluxHist.length];
        let mean = 0;
        for (let i = 0; i < len; i++) mean += buf[i];
        mean /= len;
        for (let i = 0; i < len; i++) buf[i] -= mean;
        let bestLag = 0;
        let bestVal = -Infinity;
        const fps = 1 / dt;
        const bpmMin = 70;
        const bpmMax = 190;
        const lagMin = Math.max(1, Math.floor((fps * 60) / bpmMax));
        const lagMax = Math.max(lagMin + 1, Math.floor((fps * 60) / bpmMin));
        for (let lag = lagMin; lag <= lagMax; lag++) {
          let acc = 0;
          for (let i = 0; i < len - lag; i++) acc += buf[i] * buf[i + lag];
          const bpm = 60 * fps / lag;
          const weight = 1 - Math.min(1, Math.abs(bpm - 120) / 160);
          const val = acc * (0.6 + 0.4 * weight);
          if (val > bestVal) { bestVal = val; bestLag = lag; }
        }
        const bpm = clamp(60 * fps / Math.max(1, bestLag), bpmMin, bpmMax);
        if (bestLag > 0) {
          this._tempoBpm = this._tempoBpm ? (this._tempoBpm * 0.9 + bpm * 0.1) : bpm;
          this._tempoConf = clamp(bestVal / (len * 0.75 + 1e-6), 0, 1);
        }
        this._tempoPhase01 = (this._tempoPhase01 + dt * this._tempoBpm / 60) % 1;
        this._barPhase01 = (this._barPhase01 + dt * this._tempoBpm / 60 / 4) % 1;
      }
    } else {
      this._tempoBpm = 0;
      this._tempoPhase01 = 0;
      this._tempoConf = 0;
      this._barPhase01 = 0;
    }

    const transientAvg = Object.values(this._features.transientBands).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(this._features.transientBands).length);

    this._features.level = levelEnv;
    this._features.bass = this._applyEnvelope('bass', clamp(bass, 0, 1));
    this._features.mid = this._applyEnvelope('mid', clamp(mid, 0, 1));
    this._features.treble = this._applyEnvelope('treble', clamp(treble, 0, 1));
    this._features.centroid = clamp(centroid, 0, 1);
    this._features.flux = fluxTotal;
    this._features.beat = beatEnv;
    this._features.beatPulse = beatPulse;
    this._features.tempoBpm = this._tempoBpm;
    this._features.tempoPhase01 = this._tempoPhase01;
    this._features.tempoConf = this._tempoConf;
    this._features.barPhase01 = this._barPhase01;
    this._features.swing = this._swing;
    this._features.fluxBass = fluxBass;
    this._features.fluxMid = fluxMid;
    this._features.fluxTreble = fluxTreble;
    this._features.bands = bands;
    this._features.transient = clamp(transientAvg, 0, 1);
    this._features.loudness = loudNorm;
    this._features.loudnessTrend = loudTrend;
    this._features.macroState = macroCandidate;
    this._features.macroStrength = this._macro.strength;
    this._features.macroWeights = macroWeights;

    return this._features;
  }

  features() { return this._features; }
}

export default AudioEngine;





