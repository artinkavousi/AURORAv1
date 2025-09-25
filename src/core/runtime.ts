import * as THREE from 'three';
import type WebGPURenderer from 'three/src/renderers/webgpu/WebGPURenderer.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import Info from '../info';
import { createStageDomain } from '../domain/stage';
import { createPhysicsDomain } from '../domain/physics';
import { createMaterialsDomain } from '../domain/materials';
import { createPostFxDomain } from '../domain/postfx';
import { createAudioDomain } from '../domain/audio';
import { createCameraDomain } from '../domain/camera';
import { createAuroraState, type AuroraConfigStore } from './state';
import { EventHub } from './events';
import { Diagnostics } from './diagnostics';
import { ServiceRegistry, type FeatureModule, type ModuleContext } from './plugins';
import type {
  AuroraEvents,
  FrameContext,
  ResizeContext,
  SimulationContext,
  StageContext,
  AudioRuntimeContext,
} from './types';
import { toBoolean } from './value';
import { createAuroraConfig, type AuroraConfigState } from './config';

export class AssetPipeline {
  private readonly hdrCache = new Map<string, Promise<THREE.DataTexture>>();

  async loadHdrTexture(url: string): Promise<THREE.DataTexture> {
    if (!this.hdrCache.has(url)) {
      const promise = new Promise<THREE.DataTexture>((resolve, reject) => {
        new HDRLoader().load(
          url,
          (texture: THREE.DataTexture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            resolve(texture);
          },
          undefined,
          (error: unknown) => reject(error),
        );
      });
      this.hdrCache.set(url, promise);
    }
    return this.hdrCache.get(url) as Promise<THREE.DataTexture>;
  }

  async loadMeshFromFile(file: File, material: THREE.Material | THREE.Material[]): Promise<THREE.Mesh | null> {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'obj') {
      const text = await file.text();
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const obj = new OBJLoader().parse(text);
      const source = obj.children.find((child: THREE.Object3D): child is THREE.Mesh => {
        return (child as THREE.Mesh).isMesh === true;
      });
      if (!source) return null;
      const geometry = BufferGeometryUtils.mergeVertices(source.geometry) as THREE.BufferGeometry;
      return new THREE.Mesh(geometry, material);
    }

    if (ext === 'gltf' || ext === 'glb') {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      const arrayBuffer = await file.arrayBuffer();
      const gltf = await new Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>((resolve, reject) =>
        loader.parse(arrayBuffer, '', resolve, reject),
      );
      const mesh = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh | undefined;
      if (!mesh) return null;
      return new THREE.Mesh(mesh.geometry, material);
    }

    if (ext === 'ply') {
      const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
      const loader = new PLYLoader();
      const arrayBuffer = await file.arrayBuffer();
      const geometry = loader.parse(arrayBuffer);
      geometry.computeVertexNormals();
      const merged = BufferGeometryUtils.mergeVertices(geometry as unknown as THREE.BufferGeometry);
      return new THREE.Mesh(merged, material);
    }

    if (ext === 'stl') {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const loader = new STLLoader();
      const arrayBuffer = await file.arrayBuffer();
      const geometry = loader.parse(arrayBuffer);
      geometry.computeVertexNormals();
      const merged = BufferGeometryUtils.mergeVertices(geometry as unknown as THREE.BufferGeometry);
      return new THREE.Mesh(merged, material);
    }

    return null;
  }
}

export type ProgressCallback = (value: number, delay?: number) => Promise<void> | void;

export interface AuroraRuntimeOptions {
  modules?: FeatureModule[];
  initialConfig?: AuroraConfigState;
}

export class AuroraRuntime {
  private readonly configStore: AuroraConfigStore;
  private readonly events: EventHub<AuroraEvents>;
  private readonly assets: AssetPipeline;
  private readonly diagnostics: Diagnostics;
  private readonly modules: FeatureModule[];
  private readonly registry: ServiceRegistry;
  private readonly context: ModuleContext;
  private info: Info | null = null;
  private readonly teardown: Array<() => void> = [];
  private infoDirty = true;
  private infoLastUpdate = 0;
  private fpsSample = 0;

  constructor(private readonly renderer: WebGPURenderer, options: AuroraRuntimeOptions = {}) {
    const config = options.initialConfig ?? createAuroraConfig();
    this.configStore = createAuroraState(config);
    this.events = new EventHub<AuroraEvents>();
    this.assets = new AssetPipeline();
    this.diagnostics = new Diagnostics(this.events);
    this.modules =
      options.modules ?? [
        createStageDomain(),
        createPhysicsDomain(),
        createMaterialsDomain(),
        createPostFxDomain(),
        createAudioDomain(),
        createCameraDomain(),
      ];
    this.registry = new ServiceRegistry(this.modules);
    this.context = {
      renderer: this.renderer,
      config: this.configStore,
      events: this.events,
      assets: this.assets,
      registry: this.registry,
      diagnostics: this.diagnostics,
    };
  }

  get config(): AuroraConfigStore {
    return this.configStore;
  }

  get eventHub(): EventHub<AuroraEvents> {
    return this.events;
  }

  async init(progress?: ProgressCallback): Promise<void> {
    this.info = new Info();
    this.teardown.push(
      this.configStore.subscribe(() => {
        this.infoDirty = true;
      }),
    );
    this.teardown.push(
      this.events.on('diagnostics.fps', ({ fps }) => {
        this.fpsSample = fps;
        this.infoDirty = true;
      }),
    );

    this.refreshInfo(0, true);

    const total = this.modules.length;
    for (let i = 0; i < total; i += 1) {
      const module = this.modules[i];
      const moduleProgress = progress
        ? async (value: number) => {
            const normalized = (i + value) / total;
            await Promise.resolve(progress(normalized));
          }
        : undefined;
      await module.init(this.context, moduleProgress);
      if (progress) {
        await Promise.resolve(progress((i + 1) / total));
      }
    }
  }

  resize(width: number, height: number): void {
    const size: ResizeContext = { width, height };
    for (const module of this.modules) {
      module.resize?.(size, this.context);
    }
  }

  async update(delta: number, elapsed: number): Promise<void> {
    const frame: FrameContext = { delta, elapsed };
    for (const module of this.modules) {
      await module.update?.(frame, this.context);
    }

    this.diagnostics.update(frame, this.configStore);
    this.refreshInfo(frame.elapsed);
  }

  dispose(): void {
    while (this.teardown.length > 0) {
      const dispose = this.teardown.pop();
      try {
        dispose?.();
      } catch (error) {
        console.error(error);
      }
    }
    for (const module of this.modules) {
      module.dispose?.(this.context);
    }
    this.info?.dispose?.();
    this.info = null;
  }

  private refreshInfo(elapsed: number, force = false): void {
    if (!this.info) return;
    if (!force && !this.infoDirty) {
      return;
    }
    if (!force && elapsed - this.infoLastUpdate < 0.5) {
      return;
    }

    const state = this.configStore.state;
    const simulation = this.registry.tryResolve<SimulationContext>('simulation');
    const stage = this.registry.tryResolve<StageContext>('stage');
    const audioContext = this.registry.tryResolve<AudioRuntimeContext>('audio');

    const targetParticles = typeof state.particles === 'number' ? Math.round(state.particles) : null;
    const activeParticles = simulation?.simulator?.numParticles;
    let particleLine = 'Particles: —';
    if (typeof activeParticles === 'number' && targetParticles !== null) {
      particleLine = `Particles: ${activeParticles.toLocaleString()} / ${targetParticles.toLocaleString()}`;
    } else if (typeof activeParticles === 'number') {
      particleLine = `Particles: ${activeParticles.toLocaleString()}`;
    } else if (targetParticles !== null) {
      particleLine = `Particles: ${targetParticles.toLocaleString()}`;
    }

    const postEnabled = toBoolean(state.postFxEnabled, true);
    const fxView = typeof state.fxView === 'string' && state.fxView.length > 0 ? state.fxView : 'final';
    const postLine = postEnabled ? `Post FX: On (${fxView})` : 'Post FX: Off';

    const audioEnabled = toBoolean(state.audioEnabled, true);
    const levelPercent = typeof state._audioLevel === 'number' ? Math.round(state._audioLevel * 100) : null;
    const audioSource = typeof state.audioSource === 'string' ? state.audioSource : null;
    const audioLineParts = [audioEnabled ? 'Audio: On' : 'Audio: Off'];
    if (audioEnabled && levelPercent !== null) {
      audioLineParts.push(`level ${levelPercent}%`);
    }
    if (audioEnabled && audioSource) {
      audioLineParts.push(`source ${audioSource}`);
    }
    if (audioEnabled && audioContext?.router) {
      const routerName = audioContext.router.constructor?.name ?? 'router';
      audioLineParts.push(routerName);
    }
    const audioLine = audioLineParts.join(' · ');

    const worldScale = typeof state.worldScale === 'number' ? state.worldScale.toFixed(2) : null;
    const camera = stage?.camera ?? null;
    const controls = stage?.controls ?? null;
    const focusDistance = camera && controls ? camera.position.distanceTo(controls.target) : null;

    const lines = [
      '<strong>Aurora Runtime</strong>',
      `FPS: ${this.fpsSample.toFixed(1)}`,
      particleLine,
      postLine,
      audioLine,
    ];
    if (worldScale) {
      lines.push(`World Scale: ${worldScale}`);
    }
    if (focusDistance !== null && Number.isFinite(focusDistance)) {
      lines.push(`Camera Dist: ${focusDistance.toFixed(2)}`);
    }

    this.info.setText(lines.join('<br />'));
    this.infoLastUpdate = elapsed;
    this.infoDirty = false;
  }
}

export function createAuroraRuntime(renderer: WebGPURenderer, options?: AuroraRuntimeOptions): AuroraRuntime {
  return new AuroraRuntime(renderer, options);
}
