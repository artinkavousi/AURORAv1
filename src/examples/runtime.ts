import type WebGPURenderer from 'three/src/renderers/webgpu/WebGPURenderer.js';
import { createAuroraRuntime, type AuroraRuntimeOptions } from '../core/runtime';
import { createStageDomain } from '../domain/stage';
import { createPostFxDomain } from '../domain/postfx';

/**
 * Minimal helper illustrating how to spin up the consolidated Aurora runtime.
 * Consumers can pass a subset of modules via the options bag or rely on the
 * built-in defaults that compose every domain.
 */
export async function bootAurora(renderer: WebGPURenderer, options: AuroraRuntimeOptions = {}) {
  const runtime = createAuroraRuntime(renderer, options);
  await runtime.init();
  return runtime;
}

/**
 * Example showing how to create a runtime with only the stage + post pipeline
 * for lightweight embedding scenarios.
 */
export async function bootStagePreview(renderer: WebGPURenderer) {
  const runtime = createAuroraRuntime(renderer, {
    modules: [
      createStageDomain(),
      createPostFxDomain(),
    ],
  });
  await runtime.init();
  return runtime;
}
