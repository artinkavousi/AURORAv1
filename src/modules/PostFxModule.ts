import type { FeatureModule, ModuleContext } from '../core/ModuleRegistry';
import type { FrameContext, ResizeContext, PostPipelineContext, StageContext } from '../core/types';
import type { AuroraConfigState } from '../core/config';
import { createPostFxSnapshot } from '../core/config/postAdapter';
import CinematicPipeline from '../post/CinematicPipeline';

export default class PostFxModule implements FeatureModule {
  id = 'postfx';

  private pipeline: CinematicPipeline | null = null;

  async init(context: ModuleContext): Promise<void> {
    const stage = context.registry.resolve<StageContext>('stage');
    this.pipeline = new CinematicPipeline(context.renderer);
    await this.pipeline.init(stage);
    context.registry.provide('postfx', { pipeline: this.pipeline } satisfies PostPipelineContext);
    context.events.emit('postfx.ready', { pipeline: this.pipeline });
  }

  resize(size: ResizeContext): void {
    this.pipeline?.resize?.(size.width, size.height);
  }

  async update(frame: FrameContext, context: ModuleContext): Promise<void> {
    void frame;
    if (!this.pipeline) return;
    const state = context.config.state;
    const snapshot = createPostFxSnapshot(state);
    const stageOverrides = this.pipeline.updateFromConfig?.(snapshot) as { fov?: number } | null | undefined;
    const nextFov = stageOverrides?.fov;
    if (typeof nextFov === 'number' && Number.isFinite(nextFov)) {
      const stageState = state.stage;
      if (Math.abs(stageState.camera.fov - nextFov) > 1e-3) {
        context.config.patch({
          stage: {
            ...stageState,
            camera: { ...stageState.camera, fov: nextFov },
          },
        } as Partial<AuroraConfigState>);
      }
    }
    await this.pipeline.renderAsync?.(snapshot.enabled);
  }

  dispose(context: ModuleContext): void {
    const pipeline = this.pipeline as unknown as { postProcessing?: { dispose?: () => void } } | null;
    pipeline?.postProcessing?.dispose?.();
    this.pipeline = null;
    context.registry.revoke('postfx');
  }
}
