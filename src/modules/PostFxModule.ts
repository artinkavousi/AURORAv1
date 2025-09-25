import type { FeatureModule, ModuleContext } from '../core/ModuleRegistry';
import type { FrameContext, ResizeContext, PostPipelineContext, StageContext } from '../core/types';
import CinematicPipeline from '../post/CinematicPipeline.js';

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
    this.pipeline.updateFromConfig?.(state);
    const enabled = state.postFxEnabled ?? true;
    await this.pipeline.renderAsync?.(enabled);
  }

  dispose(context: ModuleContext): void {
    const pipeline = this.pipeline as unknown as { postProcessing?: { dispose?: () => void } } | null;
    pipeline?.postProcessing?.dispose?.();
    this.pipeline = null;
    context.registry.revoke('postfx');
  }
}
