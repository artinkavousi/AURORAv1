import type { AuroraConfigStore } from './ConfigStore';
import type { FrameContext } from './types';
import type { EventHub } from './EventHub';
import type { AuroraEvents } from './types';

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

    const state = config.state;
    if (!state.autoPerf) {
      return;
    }

    const nowSeconds = typeof performance !== 'undefined' ? performance.now() / 1000 : frame.elapsed;
    if (nowSeconds - this.lastAdjust < 1.2) {
      return;
    }

    const minFps = state.perfMinFps ?? 50;
    const maxFps = state.perfMaxFps ?? 58;
    const step = state.perfStep ?? 4096;
    const minParticles = 4096;

    if (this.fps < minFps && state.particles > minParticles) {
      const next = Math.max(minParticles, state.particles - step);
      config.batch(() => {
        state.particles = next;
        state.updateParams?.();
        const gui = state.gui as unknown as { refresh?: () => void } | undefined;
        gui?.refresh?.();
      });
      this.lastAdjust = nowSeconds;
    } else if (this.fps > maxFps && state.particles + step <= (state.maxParticles ?? state.particles)) {
      const next = Math.min(state.maxParticles ?? Number.MAX_SAFE_INTEGER, state.particles + step);
      config.batch(() => {
        state.particles = next;
        state.updateParams?.();
        const gui = state.gui as unknown as { refresh?: () => void } | undefined;
        gui?.refresh?.();
      });
      this.lastAdjust = nowSeconds;
    }
  }
}
