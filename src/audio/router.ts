/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// AudioOrchestrator: flexible modulation matrix for mapping audio features into Flow configuration

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const DEFAULT_MATRIX = () => ({
  masterInfluence: 1.0,
  targets: {
    jetStrength: {
      enable: true,
      basePath: 'jetStrength',
      baseWeight: 0.75,
      clamp: [0, 4.0],
      applyMaster: true,
      routes: [
        { id: 'bassEnergy', source: 'band:bass', gain: 1.1, curve: 1.25, mode: 'continuous' },
        { id: 'impactPulse', source: 'macro:impact', gain: 0.65, mode: 'pulse', decay: 0.35 },
      ],
    },
    vortexStrength: {
      enable: true,
      basePath: 'vortexStrength',
      baseWeight: 0.78,
      clamp: [0, 4.0],
      applyMaster: true,
      routes: [
        { id: 'midEnergy', source: 'band:mid', gain: 1.0, curve: 1.1, mode: 'continuous' },
        { id: 'liftMacro', source: 'macro:lift', gain: 0.55, mode: 'continuous', curve: 1.0 },
      ],
    },
    curlStrength: {
      enable: true,
      basePath: 'curlStrength',
      baseWeight: 0.8,
      clamp: [0, 3.0],
      applyMaster: true,
      routes: [
        { id: 'trebleEnergy', source: 'band:presence', gain: 1.2, curve: 1.2, mode: 'continuous' },
        { id: 'transientHigh', source: 'transient:presence', gain: 0.8, mode: 'pulse', decay: 0.25 },
      ],
    },
    orbitStrength: {
      enable: true,
      basePath: 'orbitStrength',
      baseWeight: 0.82,
      clamp: [0, 3.0],
      applyMaster: true,
      routes: [
        { id: 'midFlow', source: 'band:lowMid', gain: 0.9, curve: 1.1, mode: 'continuous' },
        { id: 'barLift', source: 'barRise', gain: 0.45, mode: 'continuous' },
      ],
    },
    waveAmplitude: {
      enable: true,
      basePath: 'waveAmplitude',
      baseWeight: 0.7,
      clamp: [0, 2.0],
      applyMaster: true,
      routes: [
        { id: 'beatPulse', source: 'beatPulse', gain: 1.0, curve: 1.0, mode: 'continuous' },
        { id: 'macroLift', source: 'macro:lift', gain: 0.6, mode: 'continuous', curve: 1.0 },
      ],
    },
    dynamicViscosity: {
      enable: true,
      basePath: 'dynamicViscosity',
      baseWeight: 1.0,
      clamp: [0.02, 0.6],
      applyMaster: false,
      routes: [
        { id: 'quietBoost', source: 'loudnessInverse', gain: 0.08, mode: 'continuous', curve: 1.0 },
        { id: 'fallMacro', source: 'macro:fall', gain: 0.1, mode: 'continuous' },
      ],
    },
    noise: {
      enable: true,
      basePath: 'noise',
      baseWeight: 0.85,
      clamp: [0, 2.0],
      applyMaster: true,
      routes: [
        { id: 'treble', source: 'band:brilliance', gain: 0.6, curve: 1.2, mode: 'continuous' },
        { id: 'transient', source: 'transient', gain: 0.5, mode: 'pulse', decay: 0.22 },
      ],
    },
    colorSaturation: {
      enable: true,
      basePath: 'colorSaturation',
      baseWeight: 0.6,
      clamp: [0, 2.0],
      applyMaster: false,
      routes: [
        { id: 'level', source: 'level', gain: 0.5, curve: 1.1, mode: 'continuous' },
        { id: 'loudTrend', source: 'loudnessTrendPositive', gain: 0.35, mode: 'continuous' },
      ],
    },
    bloomStrength: {
      enable: true,
      basePath: 'bloomStrength',
      baseWeight: 0.8,
      clamp: [0.2, 2.5],
      applyMaster: false,
      routes: [
        { id: 'impact', source: 'macro:impact', gain: 0.4, mode: 'pulse', decay: 0.28 },
        { id: 'beat', source: 'beatPulse', gain: 0.25, mode: 'continuous' },
      ],
    },
    dofBias: {
      enable: true,
      baseValue: 0,
      clamp: [-0.2, 0.2],
      applyMaster: false,
      routes: [
        { id: 'barPhase', source: 'barSine', gain: 0.08, mode: 'continuous' },
        { id: 'macroSustain', source: 'macro:sustain', gain: 0.04, mode: 'continuous' },
      ],
    },
    envSway: {
      enable: true,
      baseValue: 0,
      clamp: [-0.25, 0.25],
      applyMaster: false,
      routes: [
        { id: 'levelSway', source: 'level', gain: 0.05, mode: 'continuous', curve: 1.2 },
        { id: 'swing', source: 'swing', gain: 0.12, mode: 'continuous' },
      ],
    },
  },
});

export class AudioRouter {
  constructor() {
    this.enabled = true;
    this.master = 1.0;
    this.intensity = 1.0;
    this.reactivity = 1.0;
    this.maxInfluence = 1.0;

    const def = DEFAULT_MATRIX();
    this._matrix = def.targets;
    this.masterInfluence = def.masterInfluence;

    this._legacyRoutes = {};
    this._routeState = {};
    this._lastTime = null;
  }

  setEnabled(v) { this.enabled = !!v; }
  setMaster(v) { this.master = clamp(v ?? 1.0, 0, 2.5); }
  setIntensity(v) { this.intensity = clamp(v ?? 1.0, 0.2, 2.0); }
  setReactivity(v) { this.reactivity = clamp(v ?? 1.0, 0.5, 2.5); }
  setMasterInfluence(v) { this.masterInfluence = clamp(v ?? 1.0, 0, 2.0); }

  setMatrix(matrix) {
    if (!matrix) return;
    Object.entries(matrix).forEach(([key, entry]) => {
      if (!this._matrix[key]) this._matrix[key] = { enable: true, routes: [] };
      this._matrix[key] = deepClone(entry);
    });
  }

  getMatrix() {
    return deepClone(this._matrix);
  }

  setRoutes(routes) {
    if (!routes) return;
    this._legacyRoutes = deepClone(routes);
    Object.entries(routes).forEach(([key, cfg]) => {
      const target = this._matrix[key];
      if (!target) return;
      if (cfg.enable !== undefined) target.enable = !!cfg.enable;
      const primary = target.routes?.[0];
      if (primary) {
        if (cfg.source) primary.source = cfg.source;
        if (cfg.gain !== undefined) primary.gain = cfg.gain;
        if (cfg.curve !== undefined) primary.curve = cfg.curve;
      }
      if (cfg.beatBoost !== undefined) {
        const pulse = target.routes?.find((r) => r.id?.includes('impact') || r.mode === 'pulse');
        if (pulse) pulse.gain = cfg.beatBoost;
      }
    });
  }

  getRoutes() {
    const out = {};
    Object.entries(this._matrix).forEach(([key, entry]) => {
      const primary = entry.routes?.[0];
      out[key] = {
        enable: entry.enable,
        source: primary?.source ?? 'level',
        gain: primary?.gain ?? 1,
        curve: primary?.curve ?? 1,
        beatBoost: entry.routes?.find((r) => r.mode === 'pulse')?.gain ?? 0,
      };
    });
    return deepClone(out);
  }

  toJSON() {
    return {
      enabled: this.enabled,
      master: this.master,
      intensity: this.intensity,
      reactivity: this.reactivity,
      masterInfluence: this.masterInfluence,
      matrix: this.getMatrix(),
      routes: this.getRoutes(),
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (typeof data.enabled === 'boolean') this.enabled = data.enabled;
    if (typeof data.master === 'number') this.master = data.master;
    if (typeof data.intensity === 'number') this.intensity = data.intensity;
    if (typeof data.reactivity === 'number') this.reactivity = data.reactivity;
    if (typeof data.masterInfluence === 'number') this.masterInfluence = data.masterInfluence;
    if (data.matrix) this.setMatrix(data.matrix);
    else if (data.routes) this.setRoutes(data.routes);
  }

  _resolveSource(features, source, dt, conf) {
    if (!source) return 0;
    switch (source) {
      case 'level': return clamp(features.level ?? 0, 0, 1);
      case 'beat': return clamp(features.beat ?? 0, 0, 1);
      case 'beatPulse': return clamp(features.beatPulse ?? features.beat ?? 0, 0, 1);
      case 'flux': return clamp(features.flux ?? 0, 0, 5);
      case 'fluxBass': return clamp(features.fluxBass ?? 0, 0, 4);
      case 'fluxMid': return clamp(features.fluxMid ?? 0, 0, 4);
      case 'fluxTreble': return clamp(features.fluxTreble ?? 0, 0, 4);
      case 'loudness': return clamp(features.loudness ?? 0, 0, 1);
      case 'loudnessTrend': return clamp((features.loudnessTrend ?? 0) * 0.5 + 0.5, 0, 1);
      case 'loudnessTrendPositive': return clamp(Math.max(0, features.loudnessTrend ?? 0), 0, 1);
      case 'loudnessInverse': return clamp(1 - (features.loudness ?? 0), 0, 1);
      case 'tempoPhase':
      case 'tempoPhase01': return clamp(features.tempoPhase01 ?? 0, 0, 1);
      case 'barPhase':
      case 'barPhase01': return clamp(features.barPhase01 ?? 0, 0, 1);
      case 'barSine': {
        const phase = clamp(features.barPhase01 ?? 0, 0, 1);
        return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
      }
      case 'barRise': {
        const phase = clamp(features.barPhase01 ?? 0, 0, 1);
        return phase;
      }
      case 'swing': return clamp((features.swing ?? 0) * 0.5 + 0.5, 0, 1);
      case 'transient': return clamp(features.transient ?? 0, 0, 1);
      case 'macroStrength': return clamp(features.macroStrength ?? 0, 0, 1);
      default: break;
    }

    if (source.startsWith('macro:')) {
      const key = source.slice(6);
      const base = features.macroWeights?.[key] ?? (features.macroState === key ? (features.macroStrength ?? 0) : 0);
      const gainKey = `audioMacro${key.charAt(0).toUpperCase()}${key.slice(1)}Gain`;
      const gain = conf && typeof conf[gainKey] === 'number' ? conf[gainKey] : 1.0;
      return clamp(base * gain, 0, 2);
    }
    if (source.startsWith('band:')) {
      const key = source.slice(5);
      return clamp(features.bands?.[key] ?? 0, 0, 1);
    }
    if (source.startsWith('transient:')) {
      const key = source.slice(10);
      return clamp(features.transientBands?.[key] ?? 0, 0, 1);
    }

    return 0;
  }

  _shape(value, route) {
    let v = clamp(value, 0, 1);
    if (route.shaper === 'smooth') {
      v = v * v * (3 - 2 * v);
    } else if (route.shaper === 'sigmoid') {
      const k = route.k ?? 4;
      v = 1 / (1 + Math.exp(-k * (v - 0.5)));
    } else {
      const curve = clamp(route.curve ?? 1, 0.1, 3.5);
      v = Math.pow(v, curve * (route.reactivityScale ?? 1));
    }
    if (route.offset) v += route.offset;
    if (route.scale) v *= route.scale;
    if (route.minSource !== undefined || route.maxSource !== undefined) {
      v = clamp(v, route.minSource ?? v, route.maxSource ?? v);
    }
    return v;
  }

  apply(features, conf, elapsed = 0, envBase = null) {
    if (!this.enabled || !features || !conf) return;
    const now = elapsed;
    const dt = this._lastTime != null ? Math.max(0.001, now - this._lastTime) : 1 / 60;
    this._lastTime = now;

    const masterGain = this.master * this.intensity * this.masterInfluence;

    Object.entries(this._matrix).forEach(([targetKey, entry]) => {
      if (!entry?.enable) return;

      const base = entry.basePath ? (conf[entry.basePath] ?? 0) : (entry.baseValue ?? 0);
      const baseWeight = entry.baseWeight ?? 0;
      let value = base * baseWeight;

      if (!this._routeState[targetKey]) this._routeState[targetKey] = {};
      const state = this._routeState[targetKey];

      (entry.routes || []).forEach((route, idx) => {
        const key = route.id ?? `r${idx}`;
        const raw = this._resolveSource(features, route.source, dt, conf);
        const shaped = this._shape(raw, route);
        const gain = route.gain ?? 1;

        if (route.mode === 'pulse') {
          const decay = Math.max(0.05, route.decay ?? 0.3);
          const prev = state[key] ?? 0;
          const decayed = prev * Math.exp(-dt / decay);
          const next = Math.max(decayed, shaped);
          state[key] = next;
          value += next * gain;
        } else {
          if (route.smoothing) {
            const smooth = Math.max(0.01, route.smoothing);
            const prev = state[key] ?? 0;
            const next = prev + (shaped - prev) * clamp(smooth, 0, 1);
            state[key] = next;
            value += next * gain;
          } else {
            value += shaped * gain;
          }
        }
      });

      if (entry.applyMaster !== false) value *= masterGain;
      value *= this.reactivity;

      const [cLo, cHi] = entry.clamp ?? [-Infinity, Infinity];
      value = clamp(value, cLo, cHi);

      switch (targetKey) {
        case 'envSway': {
          if (envBase) {
            const sway = clamp(value, -0.4, 0.4);
            conf.bgRotY = envBase.bg + sway;
            conf.envRotY = envBase.env - sway * 0.85;
          }
          break;
        }
        case 'dofBias': {
          conf._audioDofBias = value;
          break;
        }
        default: {
          if (entry.basePath && entry.basePath in conf) {
            conf[entry.basePath] = value;
          }
          break;
        }
      }
    });
  }
}

export default AudioRouter;




