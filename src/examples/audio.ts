import type WebGPURenderer from 'three/src/renderers/webgpu/WebGPURenderer.js';
import { createAuroraRuntime } from '../core/runtime';
import { createAudioDomain } from '../domain/audio';
import { createStageDomain } from '../domain/stage';

/**
 * Demonstrates enabling the audio domain with the stage to receive environment
 * rotation updates via the registry.
 */
export async function bootAudioReactive(renderer: WebGPURenderer) {
  const runtime = createAuroraRuntime(renderer, {
    modules: [createStageDomain(), createAudioDomain()],
  });
  await runtime.init();
  const events = runtime.eventHub;
  events.on('audio.environment-base', ({ bg, env }) => {
    console.warn('Environment rotation baseline', bg, env);
  });
  return runtime;
}
