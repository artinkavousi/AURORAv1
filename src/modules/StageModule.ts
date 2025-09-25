import * as THREE from 'three/webgpu';
import type { WebGPURenderer } from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import BackgroundGeometry from '../backgroundGeometry.js';
import { Lights } from '../lights.js';
import hdri from '../assets/autumn_field_puresky_1k.hdr';
import type { FeatureModule, ModuleContext } from '../core/ModuleRegistry';
import type { FrameContext, ResizeContext, StageContext } from '../core/types';

type StageBackground = BackgroundGeometry & {
  object: THREE.Object3D | null;
  glass: THREE.Mesh | null;
  glassCube: THREE.Mesh | null;
  floor: THREE.Mesh | null;
};

const DEFAULT_MARGIN = 0.98;
const FOV_EPSILON = 0.001;

function snapshotConfig(conf: Record<string, unknown>) {
  return {
    camera: {
      fov: conf.fov as number | undefined,
      near: conf.cameraNear as number | undefined,
      far: conf.cameraFar as number | undefined,
    },
    renderer: {
      exposure: conf.exposure as number | undefined,
      shadowEnabled: true,
      shadowType: (conf.shadowMapType as number | undefined) ?? null,
    },
    environment: {
      intensity: conf.envIntensity as number | undefined,
      backgroundRotationY: conf.bgRotY as number | undefined,
      environmentRotationY: conf.envRotY as number | undefined,
    },
    worldFit: {
      auto: Boolean(conf.autoWorldFit),
      mode: (conf.fitMode as string | undefined) ?? 'cover',
      margin: (conf.fitMargin as number | undefined) ?? DEFAULT_MARGIN,
      scale: (conf.worldScale as number | undefined) ?? 1,
      boundariesEnabled: Boolean(conf.boundariesEnabled),
    },
  };
}

function applyCameraParams(camera: THREE.PerspectiveCamera, config: ReturnType<typeof snapshotConfig>['camera']) {
  if (!config) return;
  let dirty = false;
  if (typeof config.fov === 'number' && Math.abs(camera.fov - config.fov) > FOV_EPSILON) {
    camera.fov = config.fov;
    dirty = true;
  }
  if (typeof config.near === 'number' && Math.abs(camera.near - config.near) > 1e-5) {
    camera.near = config.near;
    dirty = true;
  }
  if (typeof config.far === 'number' && Math.abs(camera.far - config.far) > 1e-5) {
    camera.far = config.far;
    dirty = true;
  }
  if (dirty) {
    camera.updateProjectionMatrix();
  }
}

function applyRenderer(renderer: WebGPURenderer, config: ReturnType<typeof snapshotConfig>['renderer']) {
  if (!config) return;
  if (typeof config.exposure === 'number') {
    renderer.toneMappingExposure = config.exposure;
  }
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = config.shadowEnabled !== false;
    const type = typeof config.shadowType === 'number' ? config.shadowType : THREE.PCFSoftShadowMap;
    renderer.shadowMap.type = type as THREE.ShadowMapType;
  }
}

function applyEnvironment(scene: THREE.Scene, config: ReturnType<typeof snapshotConfig>['environment']) {
  if (!config) return;
  scene.environmentIntensity = config.intensity ?? 1;
  scene.backgroundRotation = new THREE.Euler(0, config.backgroundRotationY ?? 0, 0);
  scene.environmentRotation = new THREE.Euler(0, config.environmentRotationY ?? 0, 0);
}

function computeWorldFit(camera: THREE.PerspectiveCamera, controls: OrbitControls | undefined, fit: ReturnType<typeof snapshotConfig>['worldFit']) {
  if (!fit?.auto || fit.boundariesEnabled || !camera || !controls) return null;
  const distance = camera.position.distanceTo(controls.target);
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
  const visibleHeight = halfHeight * 2;
  const visibleWidth = visibleHeight * camera.aspect;
  const margin = typeof fit.margin === 'number' ? fit.margin : DEFAULT_MARGIN;
  const contain = Math.min(visibleWidth, visibleHeight) * margin;
  const cover = Math.max(visibleWidth, visibleHeight) * margin;
  const target = fit.mode === 'cover' ? cover : contain;
  const current = typeof fit.scale === 'number' ? fit.scale : 1;
  return current * 0.82 + target * 0.18;
}

export default class StageModule implements FeatureModule {
  id = 'stage';

  private camera: THREE.PerspectiveCamera | null = null;
  private scene: THREE.Scene | null = null;
  private controls: OrbitControls | null = null;
  private background: StageBackground | null = null;
  private lights: Lights | null = null;
  private environmentTexture: THREE.DataTexture | null = null;
  private glassSignature: string | null = null;
  private boundarySignature: string | null = null;
  private boundaryUploadRestore: (() => void) | null = null;

  async init(context: ModuleContext, progress?: (value: number) => void): Promise<void> {
    const { renderer, config, assets, registry, events } = context;
    const state = config.state;
    progress?.(0.05);

    this.camera = new THREE.PerspectiveCamera(
      (state.fov as number | undefined) ?? 60,
      window.innerWidth / window.innerHeight,
      (state.cameraNear as number | undefined) ?? 0.01,
      (state.cameraFar as number | undefined) ?? 10,
    );
    this.camera.position.set(0, 0, 2);
    this.camera.updateProjectionMatrix();

    this.scene = new THREE.Scene();

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.touches = { TWO: THREE.TOUCH.DOLLY_ROTATE } as unknown as OrbitControls['touches'];
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 6.0;
    this.controls.minPolarAngle = 0.1 * Math.PI;
    this.controls.maxPolarAngle = 0.9 * Math.PI;

    progress?.(0.1);

    this.environmentTexture = await assets.loadHdrTexture(hdri);
    this.scene.background = this.environmentTexture;
    this.scene.environment = this.environmentTexture;

    this.background = new BackgroundGeometry() as StageBackground;
    await this.background.init();
    if (this.background.object) {
      this.scene.add(this.background.object);
    }
    registry.provide('stage.background', this.background);
    if (this.environmentTexture) {
      registry.provide('stage.environmentTexture', this.environmentTexture);
    }

    this.lights = new Lights();
    this.scene.add(this.lights.object);

    this.applySnapshot(context);
    this.registerBoundaryUpload(context);

    const stageContext: StageContext = {
      camera: this.camera,
      scene: this.scene,
      controls: this.controls ?? undefined,
    };
    registry.provide('stage', stageContext);
    events.emit('stage.ready', stageContext);
    events.emit('audio.environment-base', { bg: state.bgRotY ?? 0, env: state.envRotY ?? 0 });

    progress?.(0.2);
  }

  async update(frame: FrameContext, context: ModuleContext): Promise<void> {
    if (!this.camera || !this.scene) return;
    const { config, events } = context;
    const state = config.state;
    const snapshot = snapshotConfig(state);
    this.applySnapshot(context, snapshot);

    this.controls?.update(frame.delta);
    this.lights?.update?.(frame.elapsed);

    const newScale = computeWorldFit(this.camera, this.controls ?? undefined, snapshot.worldFit);
    if (typeof newScale === 'number' && Number.isFinite(newScale)) {
      config.batch(() => {
        state.worldScale = newScale;
      });
    }

    events.emit('audio.environment-base', { bg: state.bgRotY ?? 0, env: state.envRotY ?? 0 });
  }

  resize(size: ResizeContext): void {
    if (!this.camera) return;
    this.camera.aspect = size.width / size.height;
    this.camera.updateProjectionMatrix();
  }

  dispose(context: ModuleContext): void {
    this.controls?.dispose();
    if (this.scene && this.background?.object && this.scene.children.includes(this.background.object)) {
      this.scene.remove(this.background.object);
    }
    if (this.environmentTexture) {
      this.environmentTexture.dispose();
    }
    this.boundaryUploadRestore?.();
    context.registry.revoke('stage.background');
    context.registry.revoke('stage.environmentTexture');
    context.registry.revoke('stage');
    this.camera = null;
    this.scene = null;
    this.controls = null;
    this.background = null;
    this.lights = null;
    this.environmentTexture = null;
    this.glassSignature = null;
    this.boundarySignature = null;
    this.boundaryUploadRestore = null;
  }

  private applySnapshot(context: ModuleContext, snapshot?: ReturnType<typeof snapshotConfig>): void {
    if (!this.camera || !this.scene) return;
    const { renderer, config } = context;
    const data = snapshot ?? snapshotConfig(config.state);
    applyCameraParams(this.camera, data.camera);
    applyEnvironment(this.scene, data.environment);
    applyRenderer(renderer, data.renderer);
    this.applyGlass(context);
    this.applyBoundary(config.state);
  }

  private applyGlass(context: ModuleContext): void {
    if (!this.background?.glass) return;
    const state = context.config.state;
    const params = {
      ior: state.glassIor,
      thickness: state.glassThickness,
      roughness: state.glassRoughness,
      dispersion: state.glassDispersion,
      attenuationDistance: state.glassAttenuationDistance,
      attenuationColor: state.glassAttenuationColor,
    };
    const signature = JSON.stringify(params);
    if (signature === this.glassSignature) return;
    this.glassSignature = signature;
    this.background.setGlassParams(params);
  }

  private applyBoundary(state: Record<string, unknown>): void {
    if (!this.background) return;
    const stageObject = this.background.object as THREE.Object3D | null;
    if (!stageObject) return;
    const params = {
      visible: Boolean(state.boundariesEnabled),
      shape: (state.boundaryShape as string | undefined) ?? 'dodeca',
    };
    const signature = JSON.stringify(params);
    if (signature === this.boundarySignature) return;
    this.boundarySignature = signature;
    stageObject.visible = params.visible;
    this.background.setShape(params.shape);
  }

  private registerBoundaryUpload(context: ModuleContext): void {
    const state = context.config.state;
    if (typeof state.registerBoundaryUpload !== 'function') return;
    if (typeof document === 'undefined') return;

    const rawState = state as unknown as Record<string, unknown>;
    const previous = rawState.__onBoundaryUpload as (() => void) | null | undefined;
    state.registerBoundaryUpload(async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.obj,.glb,.gltf,.fbx,.ply,.stl';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file || !this.background) return;
        try {
          if (!this.background?.glass || !this.background.object) return;
          const glass = this.background.glass as THREE.Mesh;
          const mesh = await context.assets.loadMeshFromFile(file, glass.material);
          if (!mesh) return;
          if (glass.parent) {
            glass.parent.remove(glass);
          }
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.background.glass = mesh as unknown as StageBackground['glass'];
          const stageObject = this.background.object as THREE.Object3D | null;
          stageObject?.add(mesh);
          this.glassSignature = null;
          this.boundarySignature = null;
          context.config.batch(() => {
            state.boundaryShape = 'sphere';
          });
          this.applySnapshot(context);
        } catch (error) {
          console.error(error);
        }
      };
      input.click();
    });
    this.boundaryUploadRestore = () => {
      rawState.__onBoundaryUpload = previous ?? null;
    };
  }
}
