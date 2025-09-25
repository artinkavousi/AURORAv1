import type WebGPURenderer from 'three/src/renderers/webgpu/WebGPURenderer.js';
import type { ConfigStore } from './ConfigStore';
import type { AuroraConfig, AuroraEvents, FrameContext, ResizeContext } from './types';
import type { EventHub } from './EventHub';
import type { AssetPipeline } from './AssetPipeline';
import type { Diagnostics } from './Diagnostics';

export interface ModuleContext {
  renderer: WebGPURenderer;
  config: ConfigStore<AuroraConfig>;
  events: EventHub<AuroraEvents>;
  assets: AssetPipeline;
  registry: ModuleRegistry;
  diagnostics: Diagnostics;
}

export interface FeatureModule {
  id: string;
  init(context: ModuleContext, progress?: (value: number) => void): Promise<void> | void;
  update?(frame: FrameContext, context: ModuleContext): Promise<void> | void;
  resize?(size: ResizeContext, context: ModuleContext): void;
  dispose?(context: ModuleContext): void;
}

export class ModuleRegistry {
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
