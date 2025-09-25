import type WebGPURenderer from 'three/src/renderers/webgpu/WebGPURenderer.js';
import type { AuroraConfigStore } from './state';
import type { AuroraEvents, FrameContext, ResizeContext } from './types';
import type { EventHub } from './events';
import type { AssetPipeline } from './runtime';
import type { Diagnostics } from './diagnostics';

export interface ModuleContext {
  renderer: WebGPURenderer;
  config: AuroraConfigStore;
  events: EventHub<AuroraEvents>;
  assets: AssetPipeline;
  registry: ServiceRegistry;
  diagnostics: Diagnostics;
}

export interface FeatureModule {
  id: string;
  init(context: ModuleContext, progress?: (value: number) => void): Promise<void> | void;
  update?(frame: FrameContext, context: ModuleContext): Promise<void> | void;
  resize?(size: ResizeContext, context: ModuleContext): void;
  dispose?(context: ModuleContext): void;
}

export class ServiceRegistry {
  private readonly services = new Map<string, unknown>();

  constructor(private readonly modules: FeatureModule[]) {}

  provide<TValue>(key: string, value: TValue): void {
    this.services.set(key, value);
  }

  revoke(key: string): void {
    this.services.delete(key);
  }

  resolve<TValue>(key: string): TValue {
    if (!this.services.has(key)) {
      throw new Error(`Service "${key}" has not been registered.`);
    }
    return this.services.get(key) as TValue;
  }

  tryResolve<TValue>(key: string): TValue | undefined {
    return this.services.get(key) as TValue | undefined;
  }

  listServices(): string[] {
    return Array.from(this.services.keys());
  }

  listModules(): FeatureModule[] {
    return [...this.modules];
  }
}
