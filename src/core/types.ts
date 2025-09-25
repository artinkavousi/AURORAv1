import type * as THREE from 'three/webgpu';
import type { conf as legacyConf } from '../conf.js';

export type AuroraConfig = (typeof legacyConf) & Record<string, unknown>;

export type EnvironmentBase = {
  bg: number;
  env: number;
};

export interface FrameContext {
  delta: number;
  elapsed: number;
}

export interface ResizeContext {
  width: number;
  height: number;
}

export interface StageContext {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  controls?: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
}

export interface SimulationContext {
  simulator: import('../mls-mpm/mlsMpmSimulator.js').default;
}

export interface PostPipelineContext {
  pipeline: import('../post/CinematicPipeline.js').default;
}

export interface AudioRuntimeContext {
  router: import('../audio/router.js').default;
  engine?: import('../audio/audioEngine.js').default;
  panel?: import('../ui/audioPanel.js').default;
}

export interface AuroraEvents extends Record<string, unknown> {
  'stage.ready': StageContext;
  'simulation.ready': SimulationContext;
  'postfx.ready': PostPipelineContext;
  'audio.environment-base': EnvironmentBase;
  'diagnostics.fps': { fps: number };
}
