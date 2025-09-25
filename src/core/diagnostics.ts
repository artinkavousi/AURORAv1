import type { AuroraConfigStore } from './state';
import type { FrameContext } from './types';
import type { EventHub } from './events';
import type { AuroraEvents } from './types';
import type { AuroraConfigState } from './config';

export class Diagnostics {
  private fps = 60;
  private frames = 0;
  private time = 0;
  private lastAdjust = 0;

  constructor(private readonly events: EventHub<AuroraEvents>) {}

  update(frame: FrameContext, config: AuroraConfigStore): void {
    this.time += frame.delta;
    this.frames += 1;
    let fpsChanged = false;
    if (this.time >= 0.5) {
      const sample = this.frames / this.time;
      this.fps = this.fps * 0.6 + sample * 0.4;
      this.frames = 0;
      this.time = 0;
      fpsChanged = true;
    }

    if (fpsChanged) {
      this.events.emit('diagnostics.fps', { fps: this.fps });
    }

    const simulation = config.state.simulation;
    const perf = simulation.performance;
    if (!perf.auto) {
      return;
    }

    const nowSeconds = typeof performance !== 'undefined' ? performance.now() / 1000 : frame.elapsed;
    if (nowSeconds - this.lastAdjust < 1.2) {
      return;
    }

    const minFps = perf.minFps;
    const maxFps = perf.maxFps;
    const step = perf.step;
    const minParticles = 4096;
    const domain = simulation.domain;
    const current = domain.targetParticles;
    const maxParticles = domain.maxParticles;

    if (this.fps < minFps && current > minParticles) {
      const next = Math.max(minParticles, current - step);
      this.applyParticleTarget(config, simulation, next);
      this.lastAdjust = nowSeconds;
    } else if (this.fps > maxFps && current + step <= maxParticles) {
      const next = Math.min(maxParticles, current + step);
      this.applyParticleTarget(config, simulation, next);
      this.lastAdjust = nowSeconds;
    }
  }

  private applyParticleTarget(
    store: AuroraConfigStore,
    simulation: AuroraConfigState['simulation'],
    value: number,
  ): void {
    store.patch({
      simulation: {
        ...simulation,
        domain: { ...simulation.domain, targetParticles: value },
      },
    } as Partial<AuroraConfigState>);
  }
}
