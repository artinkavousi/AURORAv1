import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

const SOURCE_OPTIONS = [
  { text: 'level', value: 'level' },
  { text: 'beat', value: 'beat' },
  { text: 'beat pulse', value: 'beatPulse' },
  { text: 'flux', value: 'flux' },
  { text: 'flux bass', value: 'fluxBass' },
  { text: 'flux mid', value: 'fluxMid' },
  { text: 'flux treble', value: 'fluxTreble' },
  { text: 'loudness', value: 'loudness' },
  { text: 'loud trend', value: 'loudnessTrendPositive' },
  { text: 'loud inverse', value: 'loudnessInverse' },
  { text: 'macro impact', value: 'macro:impact' },
  { text: 'macro lift', value: 'macro:lift' },
  { text: 'macro fall', value: 'macro:fall' },
  { text: 'macro sustain', value: 'macro:sustain' },
  { text: 'macro strength', value: 'macroStrength' },
  { text: 'transient', value: 'transient' },
  { text: 'tempo phase', value: 'tempoPhase' },
  { text: 'bar phase', value: 'barPhase' },
  { text: 'bar sine', value: 'barSine' },
  { text: 'bar rise', value: 'barRise' },
  { text: 'swing', value: 'swing' },
  { text: 'band:sub', value: 'band:sub' },
  { text: 'band:bass', value: 'band:bass' },
  { text: 'band:lowMid', value: 'band:lowMid' },
  { text: 'band:mid', value: 'band:mid' },
  { text: 'band:hiMid', value: 'band:hiMid' },
  { text: 'band:presence', value: 'band:presence' },
  { text: 'band:brilliance', value: 'band:brilliance' },
  { text: 'band:air', value: 'band:air' },
  { text: 'transient:mid', value: 'transient:mid' },
  { text: 'transient:presence', value: 'transient:presence' },
];

const MODE_OPTIONS = [
  { text: 'continuous', value: 'continuous' },
  { text: 'pulse', value: 'pulse' },
];

const TRACKED_BANDS = ['sub', 'bass', 'lowMid', 'mid', 'hiMid', 'presence', 'brilliance', 'air'];

export default class AudioPanel {
  constructor(engine, conf, router) {
    this.engine = engine;
    this.conf = conf;
    this.router = router;
    this.gui = null;
    this._matrixPage = null;
    this._matrixModel = null;
    this._matrixHandles = [];
    this.container = null;
    this._header = null;
    this._dragging = false;
    this._dragStart = { x: 0, y: 0 };
    this._dragOrigin = { x: 0, y: 0 };
    this._onHeaderDown = null;
    this._onHeaderMove = null;
    this._onHeaderUp = null;
  }

  init(position = 'bottom-right') {
    const container = document.createElement('div');
    this.container = container;
    container.style.position = 'absolute';
    if (position.includes('bottom')) container.style.bottom = '16px'; else container.style.top = '16px';
    if (position.includes('right')) container.style.right = '16px'; else container.style.left = '16px';
    container.style.maxWidth = '420px';
    container.style.padding = '10px';
    container.style.borderRadius = '12px';
    container.style.background = 'rgba(20,24,28,0.32)';
    container.style.backdropFilter = 'blur(12px) saturate(150%)';
    container.style.WebkitBackdropFilter = 'blur(12px) saturate(150%)';
    container.style.border = '1px solid rgba(255,255,255,0.12)';
    container.style.boxShadow = '0 12px 32px rgba(0,0,0,0.35)';
    container.style.pointerEvents = 'auto';
    container.style.zIndex = 30;
    document.body.appendChild(container);

    // Narrow draggable header
    const header = document.createElement('div');
    this._header = header;
    header.textContent = 'audio';
    header.style.position = 'absolute';
    header.style.top = '-10px';
    header.style.left = '12px';
    header.style.padding = '2px 8px';
    header.style.fontSize = '10px';
    header.style.letterSpacing = '0.06em';
    header.style.color = '#d0d6dc';
    header.style.background = 'rgba(20,24,28,0.75)';
    header.style.border = '1px solid rgba(255,255,255,0.12)';
    header.style.borderRadius = '6px';
    header.style.cursor = 'move';
    header.style.userSelect = 'none';
    container.appendChild(header);

    this._onHeaderMove = (e) => {
      if (!this._dragging || !this.container) return;
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      this.container.style.left = Math.max(0, Math.min(window.innerWidth - 40, this._dragOrigin.x + dx)) + 'px';
      this.container.style.top = Math.max(0, Math.min(window.innerHeight - 40, this._dragOrigin.y + dy)) + 'px';
      this.container.style.right = '';
      this.container.style.position = 'absolute';
    };
    this._onHeaderUp = () => {
      this._dragging = false;
      document.removeEventListener('mousemove', this._onHeaderMove);
      document.removeEventListener('mouseup', this._onHeaderUp);
    };
    this._onHeaderDown = (e) => {
      this._dragging = true;
      this._dragStart.x = e.clientX;
      this._dragStart.y = e.clientY;
      const rect = container.getBoundingClientRect();
      this._dragOrigin.x = rect.left;
      this._dragOrigin.y = rect.top;
      document.addEventListener('mousemove', this._onHeaderMove);
      document.addEventListener('mouseup', this._onHeaderUp);
    };
    header.addEventListener('mousedown', this._onHeaderDown);

    const gui = new Pane({ container });
    gui.registerPlugin(EssentialsPlugin);

    const tabs = gui.addTab({
      pages: [
        { title: 'input', expanded: true },
        { title: 'features', expanded: false },
        { title: 'matrix', expanded: false },
        { title: 'diagnostics', expanded: false },
      ],
    });

    this._buildInputTab(tabs.pages[0]);
    this._buildFeaturesTab(tabs.pages[1]);
    this._buildMatrixTab(tabs.pages[2]);
    this._buildDiagnosticsTab(tabs.pages[3]);

    this.gui = gui;
    this._matrixPage = tabs.pages[2];

    this._applyBandSmoothing();
    this.router?.setMasterInfluence?.(this.conf.audioMasterInfluence ?? 1.0);
    this.router?.setIntensity?.(this.conf.audioIntensity ?? 1.0);
    this.router?.setReactivity?.(this.conf.audioReactivity ?? 1.0);

    try { this.applyStyle('Groove'); } catch (_) { /* noop */ }
  }

  dispose() {
    if (this._header && this._onHeaderDown) {
      this._header.removeEventListener('mousedown', this._onHeaderDown);
    }
    document.removeEventListener('mousemove', this._onHeaderMove);
    document.removeEventListener('mouseup', this._onHeaderUp);
    this.gui?.dispose?.();
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.gui = null;
    this.container = null;
    this._header = null;
    this._onHeaderDown = this._onHeaderMove = this._onHeaderUp = null;
    this._dragging = false;
  }

  _buildInputTab(page) {
    const eng = page.addFolder({ title: 'engine', expanded: true });
    eng.addBinding(this.conf, 'audioEnabled', { label: 'enable' });
    eng.addBlade({
      view: 'list',
      label: 'source',
      options: [
        { text: 'mic', value: 'mic' },
        { text: 'file', value: 'file' },
      ],
      value: this.conf.audioSource,
    }).on('change', (ev) => { this.conf.audioSource = ev.value; });
    eng.addBinding(this.conf, 'audioSensitivity', { label: 'sensitivity', min: 0.2, max: 3.0, step: 0.05 });
    eng.addBinding(this.conf, 'audioMasterInfluence', { label: 'influence', min: 0.0, max: 2.0, step: 0.05 }).on('change', () => this.router?.setMasterInfluence?.(this.conf.audioMasterInfluence));
    eng.addBinding(this.conf, 'audioIntensity', { label: 'intensity', min: 0.2, max: 2.0, step: 0.05 }).on('change', () => this.router?.setIntensity?.(this.conf.audioIntensity));
    eng.addBinding(this.conf, 'audioReactivity', { label: 'reactivity', min: 0.5, max: 2.5, step: 0.05 }).on('change', () => this.router?.setReactivity?.(this.conf.audioReactivity));
    eng.addBinding(this.conf, 'audioAttack', { label: 'level attack', min: 0.05, max: 0.99, step: 0.01 }).on('change', () => this._applyBandSmoothing());
    eng.addBinding(this.conf, 'audioRelease', { label: 'level release', min: 0.05, max: 0.99, step: 0.01 }).on('change', () => this._applyBandSmoothing());
    eng.addBinding(this.conf, 'audioBassGain', { min: 0.0, max: 3.0, step: 0.05, label: 'bass gain' });
    eng.addBinding(this.conf, 'audioMidGain', { min: 0.0, max: 3.0, step: 0.05, label: 'mid gain' });
    eng.addBinding(this.conf, 'audioTrebleGain', { min: 0.0, max: 3.0, step: 0.05, label: 'treble gain' });
    eng.addBinding(this.conf, 'audioBeatBoost', { min: 0.0, max: 3.0, step: 0.05, label: 'beat boost' });

    const fileBtn = eng.addButton({ title: 'upload audio' });
    fileBtn.on('click', () => this._openFileDialog());

    const proc = page.addFolder({ title: 'processing', expanded: false });
    this._fft = { size: 2048 };
    proc.addBinding(this._fft, 'size', {
      view: 'list',
      label: 'fft',
      options: [
        { text: '1024', value: 1024 },
        { text: '2048', value: 2048 },
        { text: '4096', value: 4096 },
      ],
      value: 2048,
    }).on('change', (ev) => { try { this.engine.setFftSize(ev.value); } catch (_) {} });
    this._thr = { method: 'median', k: 1.8 };
    proc.addBinding(this._thr, 'method', { view: 'list', label: 'threshold', options: [
      { text: 'median', value: 'median' },
      { text: 'avg', value: 'avg' },
    ], value: 'median' }).on('change', () => this.engine.setFluxThreshold(this._thr));
    proc.addBinding(this._thr, 'k', { min: 1.0, max: 3.0, step: 0.05, label: 'thr k' }).on('change', () => this.engine.setFluxThreshold(this._thr));

    this._agc = { amount: 0.0, gate: 0.003, hold: 0.2, inputGain: 1.0 };
    proc.addBinding(this._agc, 'amount', { min: 0.0, max: 1.0, step: 0.01, label: 'agc' }).on('change', () => this.engine.setAgc(this._agc.amount));
    proc.addBinding(this._agc, 'gate', { min: 0.0, max: 0.02, step: 0.0005, label: 'gate' }).on('change', () => this.engine.setGate(this._agc.gate, this._agc.hold));
    proc.addBinding(this._agc, 'hold', { min: 0.05, max: 0.6, step: 0.01, label: 'hold' }).on('change', () => this.engine.setGate(this._agc.gate, this._agc.hold));
    proc.addBinding(this._agc, 'inputGain', { min: 0.1, max: 3.0, step: 0.05, label: 'input' }).on('change', () => this.engine.setInputGain(this._agc.inputGain));

    this._tempo = { enable: false };
    proc.addBinding(this._tempo, 'enable', { label: 'tempo' }).on('change', () => this.engine.enableTempo(this._tempo.enable));

    const monitor = page.addFolder({ title: 'monitor', expanded: false });
    this._mon = { enable: false, level: 0.0 };
    monitor.addBinding(this._mon, 'enable', { label: 'monitor' }).on('change', () => this.engine.setMonitorEnabled(this._mon.enable));
    monitor.addBinding(this._mon, 'level', { min: 0.0, max: 1.0, step: 0.01, label: 'level' }).on('change', () => this.engine.setMonitorLevel(this._mon.level));
  }

  _buildFeaturesTab(page) {
    const smooth = page.addFolder({ title: 'smoothing', expanded: true });
    smooth.addBinding(this.conf, 'audioBandAttack', { label: 'band attack', min: 0.1, max: 0.9, step: 0.02 }).on('change', () => this._applyBandSmoothing());
    smooth.addBinding(this.conf, 'audioBandRelease', { label: 'band release', min: 0.1, max: 0.9, step: 0.02 }).on('change', () => this._applyBandSmoothing());
    smooth.addBinding(this.conf, 'audioTransientSensitivity', { label: 'transient sens', min: 0.2, max: 4.0, step: 0.05 }).on('change', () => this.engine.setTransientSensitivity(this.conf.audioTransientSensitivity));
    smooth.addBinding(this.conf, 'audioTransientDecay', { label: 'transient decay', min: 0.1, max: 1.0, step: 0.05 }).on('change', () => this.engine.setTransientDecay(this.conf.audioTransientDecay));

    const macros = page.addFolder({ title: 'macros', expanded: false });
    macros.addBinding(this.conf, 'audioMacroImpactGain', { label: 'impact', min: 0.0, max: 2.0, step: 0.05 });
    macros.addBinding(this.conf, 'audioMacroLiftGain', { label: 'lift', min: 0.0, max: 2.0, step: 0.05 });
    macros.addBinding(this.conf, 'audioMacroFallGain', { label: 'fall', min: 0.0, max: 2.0, step: 0.05 });
    macros.addBinding(this.conf, 'audioMacroSustainGain', { label: 'sustain', min: 0.0, max: 2.0, step: 0.05 });
  }

  _buildMatrixTab(page) {
    this._matrixModel = this.router?.getMatrix?.() ?? {};
    this._rebuildMatrixUI(page);
  }

  _rebuildMatrixUI(page) {
    this._matrixHandles.forEach((handle) => handle.dispose?.());
    this._matrixHandles = [];

    const matrix = this.router?.getMatrix?.() ?? {};
    this._matrixModel = matrix;

    Object.entries(matrix).forEach(([key, target]) => {
      const folder = page.addFolder({ title: key, expanded: false });
      this._matrixHandles.push(folder);

      folder.addBinding(target, 'enable', { label: 'enable' }).on('change', () => this._commitMatrix());
      if (target.baseWeight !== undefined) {
        folder.addBinding(target, 'baseWeight', { label: 'base mix', min: 0.0, max: 1.0, step: 0.01 }).on('change', () => this._commitMatrix());
      }
      if (target.applyMaster !== undefined) {
        folder.addBinding(target, 'applyMaster', { label: 'apply master' }).on('change', () => this._commitMatrix());
      }
      if (target.clamp) {
        const minMax = { min: target.clamp[0], max: target.clamp[1] };
        folder.addBinding(minMax, 'min', { label: 'min', min: -5, max: 5, step: 0.05 }).on('change', (ev) => {
          target.clamp[0] = ev.value;
          this._commitMatrix();
        });
        folder.addBinding(minMax, 'max', { label: 'max', min: -5, max: 5, step: 0.05 }).on('change', (ev) => {
          target.clamp[1] = ev.value;
          this._commitMatrix();
        });
      }

      (target.routes || []).forEach((route, idx) => {
        const routeFolder = folder.addFolder({ title: `route ${idx + 1}`, expanded: false });
        this._matrixHandles.push(routeFolder);

        routeFolder.addBlade({ view: 'list', label: 'mode', options: MODE_OPTIONS, value: route.mode ?? 'continuous' }).on('change', (ev) => {
          route.mode = ev.value;
          this._commitMatrix();
        });
        routeFolder.addBlade({ view: 'list', label: 'source', options: SOURCE_OPTIONS, value: route.source ?? 'level' }).on('change', (ev) => {
          route.source = ev.value;
          this._commitMatrix();
        });
        routeFolder.addBinding(route, 'gain', { label: 'gain', min: -2.0, max: 3.0, step: 0.05 }).on('change', () => this._commitMatrix());
        if (route.mode !== 'pulse') {
          if (route.curve === undefined) route.curve = 1.0;
          routeFolder.addBinding(route, 'curve', { label: 'curve', min: 0.3, max: 3.0, step: 0.05 }).on('change', () => this._commitMatrix());
        } else {
          if (route.decay === undefined) route.decay = 0.3;
          routeFolder.addBinding(route, 'decay', { label: 'decay', min: 0.1, max: 1.0, step: 0.05 }).on('change', () => this._commitMatrix());
        }
      });
    });
  }

  _buildDiagnosticsTab(page) {
    const meters = page.addFolder({ title: 'meters', expanded: false });
    meters.addBinding(this.conf, '_audioLevel', { label: 'level', readonly: true });
    meters.addBinding(this.conf, '_audioBeat', { label: 'beat', readonly: true });
    meters.addBinding(this.conf, '_audioLoudness', { label: 'loudness', readonly: true });
    meters.addBinding(this.conf, '_audioLoudTrend', { label: 'trend', readonly: true });
    meters.addBinding(this.conf, '_audioTempoBpm', { label: 'bpm', readonly: true });
    meters.addBinding(this.conf, '_audioTempoPhase', { label: 'phase', readonly: true });
    meters.addBinding(this.conf, '_audioMacroState', { label: 'macro', readonly: true });
    meters.addBinding(this.conf, '_audioMacroStrength', { label: 'macro amt', readonly: true });

    const bandsFolder = page.addFolder({ title: 'bands', expanded: false });
    TRACKED_BANDS.forEach((band) => {
      if (!this.conf._audioBands) this.conf._audioBands = {};
      if (this.conf._audioBands[band] === undefined) this.conf._audioBands[band] = 0;
      bandsFolder.addBinding(this.conf._audioBands, band, { readonly: true, label: band });
    });
  }

  _commitMatrix() {
    if (!this.router || this._matrixRefreshLock) return;
    this._matrixRefreshLock = true;
    try {
      this.router.setMatrix(this._matrixModel);
      this._matrixModel = this.router.getMatrix();
      if (this._matrixPage) this._rebuildMatrixUI(this._matrixPage);
    } catch (_) {
      // ignore
    } finally {
      this._matrixRefreshLock = false;
    }
  }

  _applyBandSmoothing() {
    if (!this.engine) return;
    this.engine.setSmoothing(this.conf.audioAttack ?? 0.5, this.conf.audioRelease ?? 0.2);
    const bandAttack = this.conf.audioBandAttack ?? 0.55;
    const bandRelease = this.conf.audioBandRelease ?? 0.22;
    const bandMap = {};
    TRACKED_BANDS.forEach((band) => {
      bandMap[band] = { attack: bandAttack, release: bandRelease };
      bandMap[`transient:${band}`] = {
        attack: Math.min(0.95, bandAttack + 0.2),
        release: Math.min(0.95, bandRelease + 0.15),
      };
    });
    this.engine.setFeatureSmoothing(bandMap);
    this.engine.setTransientSensitivity(this.conf.audioTransientSensitivity ?? 1.0);
    this.engine.setTransientDecay(this.conf.audioTransientDecay ?? 0.4);
  }

  _openFileDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (ev) => {
      const file = ev.target?.files?.[0];
      if (!file) return;
      const arrayBuffer = await file.arrayBuffer();
      this.conf.__onAudioUpload?.(arrayBuffer, file);
    };
    input.click();
  }

  applyStyle(name) {
    if (!this.router?.setMatrix) return;
    const base = this.router.getMatrix();
    const styles = {
      Groove: {
        jetStrength: {
          routes: [
            { id: 'bassEnergy', source: 'band:bass', gain: 1.25, curve: 1.2, mode: 'continuous' },
            { id: 'impactPulse', source: 'macro:impact', gain: 0.7, mode: 'pulse', decay: 0.32 },
          ],
        },
        vortexStrength: {
          routes: [
            { id: 'midEnergy', source: 'band:mid', gain: 1.05, curve: 1.1, mode: 'continuous' },
            { id: 'liftMacro', source: 'macro:lift', gain: 0.6, mode: 'continuous' },
          ],
        },
        noise: {
          routes: [
            { id: 'treble', source: 'band:brilliance', gain: 0.7, curve: 1.3, mode: 'continuous' },
            { id: 'transient', source: 'transient', gain: 0.55, mode: 'pulse', decay: 0.24 },
          ],
        },
      },
      Sparkle: {
        jetStrength: {
          routes: [
            { id: 'bassEnergy', source: 'band:sub', gain: 1.1, curve: 1.4, mode: 'continuous' },
            { id: 'impactPulse', source: 'macro:impact', gain: 0.8, mode: 'pulse', decay: 0.28 },
          ],
        },
        curlStrength: {
          routes: [
            { id: 'trebleEnergy', source: 'band:air', gain: 1.4, curve: 1.3, mode: 'continuous' },
            { id: 'transientHigh', source: 'transient:presence', gain: 0.9, mode: 'pulse', decay: 0.2 },
          ],
        },
        bloomStrength: {
          routes: [
            { id: 'impact', source: 'macro:impact', gain: 0.5, mode: 'pulse', decay: 0.26 },
            { id: 'beat', source: 'beatPulse', gain: 0.32, mode: 'continuous' },
          ],
        },
      },
      Waves: {
        waveAmplitude: {
          routes: [
            { id: 'beatPulse', source: 'beatPulse', gain: 1.2, curve: 1.0, mode: 'continuous' },
            { id: 'macroLift', source: 'macro:lift', gain: 0.5, mode: 'continuous' },
          ],
        },
        orbitStrength: {
          routes: [
            { id: 'midFlow', source: 'band:lowMid', gain: 0.8, curve: 1.0, mode: 'continuous' },
            { id: 'barLift', source: 'barSine', gain: 0.4, mode: 'continuous' },
          ],
        },
      },
    };
    const style = styles[name];
    if (!style) return;
    Object.entries(style).forEach(([key, mods]) => {
      if (base[key]) Object.assign(base[key], mods);
    });
    this.router.setMatrix(base);
    this.router.setIntensity?.(this.conf.audioIntensity ?? 1.1);
    this.router.setReactivity?.(this.conf.audioReactivity ?? 1.1);
    if (this._matrixPage) this._rebuildMatrixUI(this._matrixPage);
  }
}

