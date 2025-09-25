import type WebGPURenderer from 'three/src/renderers/webgpu/WebGPURenderer.js';
import { createAuroraRuntime } from '../core/runtime';
import { createStageDomain } from '../domain/stage';

/**
 * Boots a runtime that only provisions the stage domain and logs when the
 * stage becomes available.
 */
export async function bootStageOnly(renderer: WebGPURenderer) {
  const runtime = createAuroraRuntime(renderer, { modules: [createStageDomain()] });
  runtime.eventHub.on('stage.ready', (stage) => {
    console.warn('Stage ready:', stage.camera.uuid);
  });
  await runtime.init();
  return runtime;
}
