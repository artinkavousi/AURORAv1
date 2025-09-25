import type { WebGPURenderer } from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';
import { Info } from '../info.js';
import { conf } from '../conf.js';
import { createConfigStore, type AuroraConfigStore } from './ConfigStore';
import { EventHub } from './EventHub';
import { AssetPipeline } from './AssetPipeline';
import { Diagnostics } from './Diagnostics';
import { ModuleRegistry, type FeatureModule, type ModuleContext } from './ModuleRegistry';
import type {
  AuroraConfig,
  AuroraEvents,
  FrameContext,
  ResizeContext,
  SimulationContext,
  StageContext,
  AudioRuntimeContext,
} from './types';
import { toBoolean } from './valueAccess';
import StageModule from '../modules/StageModule';
import MaterialModule from '../modules/MaterialModule';
import PhysicsModule from '../modules/PhysicsModule';
import PostFxModule from '../modules/PostFxModule';
import AudioModule from '../modules/AudioModule';
import CameraModule from '../modules/CameraModule';

export type ProgressCallback = (value: number, delay?: number) => Promise<void> | void;

export class AppHost {
  private readonly configStore: AuroraConfigStore;
  private readonly events: EventHub<AuroraEvents>;
  private readonly assets: AssetPipeline;
  private readonly diagnostics: Diagnostics;
  private readonly modules: FeatureModule[];
  private readonly registry: ModuleRegistry;
  private readonly context: ModuleContext;
  private info: Info | null = null;
  private readonly teardown: Array<() => void> = [];
  private infoDirty = true;
  private infoLastUpdate = 0;
  private fpsSample = 0;

  constructor(private readonly renderer: WebGPURenderer, modules?: FeatureModule[]) {
    this.configStore = createConfigStore(conf as unknown as AuroraConfig);
    this.events = new EventHub<AuroraEvents>();
    this.assets = new AssetPipeline();
    this.diagnostics = new Diagnostics(this.events);
    this.modules = modules ?? [
      new StageModule(),
      new PhysicsModule(),
      new MaterialModule(),
      new PostFxModule(),
      new AudioModule(),
      new CameraModule(),
    ];
    this.registry = new ModuleRegistry(this.modules);
    this.context = {
      renderer: this.renderer,
      config: this.configStore,
      events: this.events,
      assets: this.assets,
      registry: this.registry,
      diagnostics: this.diagnostics,
    };
  }

  get config(): AuroraConfigStore {
    return this.configStore;
  }

  async init(progress?: ProgressCallback): Promise<void> {
    this.info = new Info();
    const config = this.configStore.state;
    config.init?.();

    this.teardown.push(
      this.configStore.subscribe(() => {
        this.infoDirty = true;
      }),
    );
    this.teardown.push(
      this.events.on('diagnostics.fps', ({ fps }) => {
        this.fpsSample = fps;
        this.infoDirty = true;
      }),
    );

    this.refreshInfo(0, true);

    const total = this.modules.length;
    for (let i = 0; i < total; i += 1) {
      const module = this.modules[i];
      const moduleProgress = progress
        ? async (value: number) => {
            const normalized = (i + value) / total;
            await Promise.resolve(progress(normalized));
          }
        : undefined;
      await module.init(this.context, moduleProgress);
      if (progress) {
        await Promise.resolve(progress((i + 1) / total));
      }
    }
  }

  resize(width: number, height: number): void {
    const size: ResizeContext = { width, height };
    for (const module of this.modules) {
      module.resize?.(size, this.context);
    }
  }

  async update(delta: number, elapsed: number): Promise<void> {
    const frame: FrameContext = { delta, elapsed };
    const config = this.configStore.state;
    config.begin?.();

    for (const module of this.modules) {
      await module.update?.(frame, this.context);
    }

    this.diagnostics.update(frame, this.configStore);
    this.refreshInfo(frame.elapsed);
    config.end?.();
  }

  dispose(): void {
    while (this.teardown.length > 0) {
      const dispose = this.teardown.pop();
      try {
        dispose?.();
      } catch (error) {
        console.error(error);
      }
    }
    for (const module of this.modules) {
      module.dispose?.(this.context);
    }
    this.info?.dispose?.();
    this.info = null;
  }

  private refreshInfo(elapsed: number, force = false): void {
    if (!this.info) return;
    if (!force && !this.infoDirty) {
      return;
    }
    if (!force && elapsed - this.infoLastUpdate < 0.5) {
      return;
    }

    const state = this.configStore.state;
    const simulation = this.registry.tryResolve<SimulationContext>('simulation');
    const stage = this.registry.tryResolve<StageContext>('stage');
    const audioContext = this.registry.tryResolve<AudioRuntimeContext>('audio');

    const targetParticles = typeof state.particles === 'number' ? Math.round(state.particles) : null;
    const activeParticles = simulation?.simulator?.numParticles;
    let particleLine = 'Particles: —';
    if (typeof activeParticles === 'number' && targetParticles !== null) {
      particleLine = `Particles: ${activeParticles.toLocaleString()} / ${targetParticles.toLocaleString()}`;
    } else if (typeof activeParticles === 'number') {
      particleLine = `Particles: ${activeParticles.toLocaleString()}`;
    } else if (targetParticles !== null) {
      particleLine = `Particles: ${targetParticles.toLocaleString()}`;
    }

    const postEnabled = toBoolean(state.postFxEnabled, true);
    const fxView = typeof state.fxView === 'string' && state.fxView.length > 0 ? state.fxView : 'final';
    const postLine = postEnabled ? `Post FX: On (${fxView})` : 'Post FX: Off';

    const audioEnabled = toBoolean(state.audioEnabled, true);
    const levelPercent = typeof state._audioLevel === 'number' ? Math.round(state._audioLevel * 100) : null;
    const audioSource = typeof state.audioSource === 'string' ? state.audioSource : null;
    const audioLineParts = [audioEnabled ? 'Audio: On' : 'Audio: Off'];
    if (audioEnabled && levelPercent !== null) {
      audioLineParts.push(`level ${levelPercent}%`);
    }
    if (audioEnabled && audioSource) {
      audioLineParts.push(`source ${audioSource}`);
    }
    if (audioEnabled && audioContext?.router) {
      const routerName = audioContext.router.constructor?.name ?? 'router';
      audioLineParts.push(routerName);
    }
    const audioLine = audioLineParts.join(' · ');

    const worldScale = typeof state.worldScale === 'number' ? state.worldScale.toFixed(2) : null;
    const camera = stage?.camera ?? null;
    const controls = stage?.controls ?? null;
    const focusDistance = camera && controls ? camera.position.distanceTo(controls.target) : null;

    const lines = [
      '<strong>Aurora Runtime</strong>',
      `FPS: ${this.fpsSample.toFixed(1)}`,
      particleLine,
      postLine,
      audioLine,
    ];
    if (worldScale) {
      lines.push(`World Scale: ${worldScale}`);
    }
    if (focusDistance !== null && Number.isFinite(focusDistance)) {
      lines.push(`Camera Dist: ${focusDistance.toFixed(2)}`);
    }

    this.info.setText(lines.join('<br />'));
    this.infoLastUpdate = elapsed;
    this.infoDirty = false;
  }
}
