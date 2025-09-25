import type * as THREE from 'three';
import type { AuroraConfigState } from './config';

export type AuroraConfig = AuroraConfigState & Record<string, unknown>;

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
  requestBoundaryImport?: () => Promise<void> | void;
}

export interface SimulationContext {
  simulator: import('../mls-mpm/mlsMpmSimulator').default;
}

export interface PostPipelineContext {
  pipeline: import('../post/CinematicPipeline').default;
}

export interface AudioRuntimeContext {
  router: {
    apply?: (features: unknown, conf: Record<string, unknown>, elapsed: number, envBase: EnvironmentBase) => void;
    setMasterInfluence?: (value: number) => void;
    setIntensity?: (value: number) => void;
    setReactivity?: (value: number) => void;
  };
  engine?: {
    update: () => unknown;
    connectMic?: () => Promise<void>;
    connectFile?: (buffer: ArrayBuffer) => Promise<void>;
    setSmoothing?: (attack: number, release: number) => void;
    setFeatureSmoothing?: (map: Record<string, { attack: number; release: number }>) => void;
    setTransientSensitivity?: (value: number) => void;
    setTransientDecay?: (value: number) => void;
  };
  panel?: import('../ui/audioPanel').default;
}

export interface AuroraEvents extends Record<string, unknown> {
  'stage.ready': StageContext;
  'simulation.ready': SimulationContext;
  'postfx.ready': PostPipelineContext;
  'audio.environment-base': EnvironmentBase;
  'diagnostics.fps': { fps: number };
}
