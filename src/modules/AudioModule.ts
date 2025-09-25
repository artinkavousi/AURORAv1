import type { FeatureModule, ModuleContext } from '../core/ModuleRegistry';
import type { FrameContext, EnvironmentBase, AudioRuntimeContext } from '../core/types';
import { getNumber } from '../core/valueAccess';
import AudioEngine from '../audio/audioEngine';
import AudioRouter from '../audio/router';
import AudioPanel from '../ui/audioPanel';

const AUDIO_BANDS = ['sub', 'bass', 'lowMid', 'mid', 'hiMid', 'presence', 'brilliance', 'air'] as const;

type AudioBand = (typeof AUDIO_BANDS)[number];
type AudioFeatures = ReturnType<AudioEngine['update']>;
type RouterApply = (
  features: AudioFeatures,
  conf: Record<string, unknown>,
  elapsed: number,
  envBase: EnvironmentBase,
) => void;

function clamp(value: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, value));
}

export default class AudioModule implements FeatureModule {
  id = 'audio';

  private engine: AudioEngine | null = null;
  private router: AudioRouter | null = null;
  private panel: AudioPanel | null = null;
  private envBase: EnvironmentBase = { bg: 0, env: 0 };
  private configSignature: string | null = null;
  private started = false;
  private unsubscribeEnv: (() => void) | null = null;
  private routerRestore: (() => void) | null = null;
  private audioUploadRestore: (() => void) | null = null;

  async init(context: ModuleContext): Promise<void> {
    const state = context.config.state;
    this.engine = new AudioEngine();
    this.router = new AudioRouter();
    this.panel = new AudioPanel(this.engine, state, this.router);

    const rawState = state as unknown as Record<string, unknown>;
    const previousRouter = rawState.__router as AudioRouter | null | undefined;
    if (typeof state.registerRouter === 'function') {
      state.registerRouter(this.router);
      this.routerRestore = () => {
        rawState.__router = previousRouter ?? null;
      };
    }
    this.panel.init('bottom-left');
    this.applyAudioConfig(state, true);

    this.registerAudioUpload(context);

    this.unsubscribeEnv = context.events.on('audio.environment-base', (base) => {
      this.envBase = base;
    });

    context.registry.provide('audio', { router: this.router, engine: this.engine, panel: this.panel } satisfies AudioRuntimeContext);
  }

  async update(frame: FrameContext, context: ModuleContext): Promise<void> {
    if (!this.engine || !this.router) return;
    const state = context.config.state;
    if (!state.audioEnabled) {
      this.resetOutputs(state);
      return;
    }

    await this.ensureStarted(state);
    this.applyAudioConfig(state);

    const features = this.engine.update();
    const sensitivity = getNumber(state, 'audioSensitivity', 1);
    const beatBoost = getNumber(state, 'audioBeatBoost', 1);
    const bassGain = getNumber(state, 'audioBassGain', 1);
    const midGain = getNumber(state, 'audioMidGain', 1);
    const trebleGain = getNumber(state, 'audioTrebleGain', 1);
    state._audioLevel = clamp((features.level ?? 0) * sensitivity);
    state._audioBeat = clamp((features.beat ?? 0) * beatBoost);
    state._audioBass = clamp((features.bass ?? 0) * bassGain * sensitivity);
    state._audioMid = clamp((features.mid ?? 0) * midGain * sensitivity);
    state._audioTreble = clamp((features.treble ?? 0) * trebleGain * sensitivity);
    state._audioTempoPhase = features.tempoPhase01 ?? 0;
    state._audioTempoBpm = features.tempoBpm ?? 0;

    if (this.router?.apply) {
      const apply = this.router.apply as unknown as RouterApply;
      apply?.(features, state, frame.elapsed, this.envBase);
    }
  }

  dispose(context: ModuleContext): void {
    this.unsubscribeEnv?.();
    this.routerRestore?.();
    this.audioUploadRestore?.();
    const ctxWrapper = this.engine as { ctx?: { close?: () => Promise<void>; state?: string } } | null;
    const audioCtx = ctxWrapper?.ctx;
    if (audioCtx && typeof audioCtx.close === 'function' && audioCtx.state !== 'closed') {
      void audioCtx.close().catch(() => undefined);
    }
    this.panel?.dispose?.();
    context.registry.revoke('audio');
    this.panel = null;
    this.router = null;
    this.engine = null;
    this.started = false;
    this.configSignature = null;
    this.envBase = { bg: 0, env: 0 };
    this.unsubscribeEnv = null;
    this.routerRestore = null;
    this.audioUploadRestore = null;
  }

  private async ensureStarted(state: Record<string, unknown>): Promise<void> {
    if (this.started || !this.engine) return;
    if (state.audioSource === 'mic') {
      await this.engine.connectMic();
    }
    this.started = true;
  }

  private applyAudioConfig(state: Record<string, unknown>, force = false): void {
    if (!this.engine || !this.router) return;
    const signature = [
      state.audioAttack,
      state.audioRelease,
      state.audioBandAttack,
      state.audioBandRelease,
      state.audioTransientSensitivity,
      state.audioTransientDecay,
      state.audioMasterInfluence,
      state.audioIntensity,
      state.audioReactivity,
    ]
      .map((value) => String(value ?? 'null'))
      .join('|');

    if (!force && signature === this.configSignature) return;
    this.configSignature = signature;

    const attack = getNumber(state, 'audioAttack', 0.5);
    const release = getNumber(state, 'audioRelease', 0.2);
    this.engine.setSmoothing(attack, release);
    const bandAttack = getNumber(state, 'audioBandAttack', 0.55);
    const bandRelease = getNumber(state, 'audioBandRelease', 0.22);
    const smoothing: Record<string, { attack: number; release: number }> = {};
    AUDIO_BANDS.forEach((band: AudioBand) => {
      smoothing[band] = { attack: bandAttack, release: bandRelease };
      smoothing[`transient:${band}`] = {
        attack: Math.min(0.95, bandAttack + 0.2),
        release: Math.min(0.95, bandRelease + 0.15),
      };
    });
    this.engine.setFeatureSmoothing(smoothing);
    this.engine.setTransientSensitivity(getNumber(state, 'audioTransientSensitivity', 1));
    this.engine.setTransientDecay(getNumber(state, 'audioTransientDecay', 0.4));

    const setMaster = this.router?.setMasterInfluence as ((value: number) => void) | undefined;
    const setIntensity = this.router?.setIntensity as ((value: number) => void) | undefined;
    const setReactivity = this.router?.setReactivity as ((value: number) => void) | undefined;
    setMaster?.(getNumber(state, 'audioMasterInfluence', 1));
    setIntensity?.(getNumber(state, 'audioIntensity', 1));
    setReactivity?.(getNumber(state, 'audioReactivity', 1));
  }

  private resetOutputs(state: Record<string, unknown>): void {
    state._audioLevel = 0;
    state._audioBeat = 0;
    state._audioBass = 0;
    state._audioMid = 0;
    state._audioTreble = 0;
    state._audioTempoPhase = 0;
    state._audioTempoBpm = 0;
    state.bgRotY = this.envBase.bg;
    state.envRotY = this.envBase.env;
  }

  private registerAudioUpload(context: ModuleContext): void {
    const state = context.config.state as unknown as Record<string, unknown> & {
      registerAudioUpload?: (handler: (buffer: ArrayBuffer, file?: File) => void) => void;
      __onAudioUpload?: (buffer: ArrayBuffer, file?: File) => void;
    };
    if (typeof state.registerAudioUpload !== 'function' || !this.engine) {
      return;
    }

    const previous = state.__onAudioUpload;
    const handler = async (buffer: ArrayBuffer, file?: File) => {
      if (!this.engine) return;
      try {
        await this.engine.connectFile(buffer);
        this.started = true;
        this.configSignature = null;
        context.config.batch(() => {
          state.audioSource = 'file';
          state.audioEnabled = true;
          if (file?.name) {
            (state as Record<string, unknown>)._audioFileName = file.name;
          }
        });
        this.applyAudioConfig(state, true);
      } catch (error) {
        console.error(error);
      }
    };

    state.registerAudioUpload(handler);
    this.audioUploadRestore = () => {
      state.__onAudioUpload = previous;
    };
  }
}
