import * as THREE from 'three';
import type WebGPURenderer from 'three/src/renderers/webgpu/WebGPURenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, texture, uv, positionWorld, vec3, float } from 'three/tsl';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import hdri from '../assets/autumn_field_puresky_1k.hdr';
import boxObj from '../assets/boxSlightlySmooth.obj';
import normalMapFile from '../assets/concrete_0016_normal_opengl_1k.png';
import aoMapFile from '../assets/concrete_0016_ao_1k.jpg';
import colorMapFile from '../assets/concrete_0016_color_1k.jpg';
import roughnessMapFile from '../assets/concrete_0016_roughness_1k.jpg';
import type { FeatureModule, ModuleContext } from '../core/plugins';
import type { FrameContext, ResizeContext, StageContext } from '../core/types';
import type { AuroraConfigState } from '../core/config';

const FOV_EPSILON = 0.001;

interface StageSnapshot {
  camera: AuroraConfigState['stage']['camera'];
  renderer: AuroraConfigState['stage']['renderer'];
  environment: AuroraConfigState['stage']['environment'];
  world: AuroraConfigState['stage']['world'];
  glass: AuroraConfigState['stage']['glass'];
}

function snapshotStageConfig(config: AuroraConfigState): StageSnapshot {
  return {
    camera: config.stage.camera,
    renderer: config.stage.renderer,
    environment: config.stage.environment,
    world: config.stage.world,
    glass: config.stage.glass,
  };
}

function applyCameraParams(camera: THREE.PerspectiveCamera, config: StageSnapshot['camera']) {
  let dirty = false;
  if (Math.abs(camera.fov - config.fov) > FOV_EPSILON) {
    camera.fov = config.fov;
    dirty = true;
  }
  if (Math.abs(camera.near - config.near) > 1e-5) {
    camera.near = config.near;
    dirty = true;
  }
  if (Math.abs(camera.far - config.far) > 1e-5) {
    camera.far = config.far;
    dirty = true;
  }
  if (dirty) {
    camera.updateProjectionMatrix();
  }
}

function applyRenderer(renderer: WebGPURenderer, config: StageSnapshot['renderer']) {
  renderer.toneMappingExposure = config.exposure;
  const toneLookup: Record<'aces' | 'filmic' | 'linear', THREE.ToneMapping> = {
    aces: THREE.ACESFilmicToneMapping,
    filmic: THREE.ReinhardToneMapping,
    linear: THREE.LinearToneMapping,
  };
  const toneMapping = (config.toneMapping ?? 'aces') as keyof typeof toneLookup;
  const desiredTone = toneLookup[toneMapping] ?? THREE.ACESFilmicToneMapping;
  if (renderer.toneMapping !== desiredTone) {
    renderer.toneMapping = desiredTone;
  }
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = config.shadows.enabled;
    const pcss = (Reflect.get(THREE, 'PCSSShadowMap') as THREE.ShadowMapType | undefined) ?? THREE.PCFSoftShadowMap;
    const shadowLookup = {
      pcfsoft: THREE.PCFSoftShadowMap,
      pcss,
      basic: THREE.BasicShadowMap,
    } as const;
    const shadowType = (config.shadows.type ?? 'pcfsoft') as keyof typeof shadowLookup;
    renderer.shadowMap.type = shadowLookup[shadowType] ?? THREE.PCFSoftShadowMap;
  }
}

function applyEnvironment(scene: THREE.Scene, config: StageSnapshot['environment']) {
  scene.environmentIntensity = config.intensity;
  scene.backgroundRotation = new THREE.Euler(0, config.backgroundRotationY, 0);
  scene.environmentRotation = new THREE.Euler(0, config.environmentRotationY, 0);
}

function computeWorldFit(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls | null,
  world: StageSnapshot['world'],
) {
  if (!world.autoFit || world.boundariesEnabled || !camera || !controls) return null;
  const distance = camera.position.distanceTo(controls.target);
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
  const visibleHeight = halfHeight * 2;
  const visibleWidth = visibleHeight * camera.aspect;
  const contain = Math.min(visibleWidth, visibleHeight) * world.margin;
  const cover = Math.max(visibleWidth, visibleHeight) * world.margin;
  const target = world.mode === 'cover' ? cover : contain;
  return world.scale * 0.82 + target * 0.18;
}

function toColorTuple(color: AuroraConfigState['stage']['glass']['attenuationColor']) {
  return { r: color[0], g: color[1], b: color[2] };
}

class StageBackground {
  object: THREE.Object3D | null = null;
  glass: THREE.Mesh<THREE.BufferGeometry, MeshPhysicalNodeMaterial> | null = null;
  glassCube: THREE.Mesh<THREE.BufferGeometry, MeshPhysicalNodeMaterial> | null = null;
  floor: THREE.Mesh<THREE.BufferGeometry, MeshStandardNodeMaterial> | null = null;

  async init(): Promise<void> {
    const glassMat = new MeshPhysicalNodeMaterial({
      roughness: 0.02,
      transmission: 1.0,
      thickness: 0.3,
      metalness: 0.0,
      ior: 1.5,
    });

    const dispersionColor = Fn(() => {
      const d = float(0.25);
      return vec3(float(1.0), float(1.0).sub(d.mul(0.35)), float(1.0).sub(d.mul(0.7)));
    })();

    glassMat.colorNode = dispersionColor;

    const radius = 0.72;
    const dShell = new THREE.DodecahedronGeometry(radius, 0);
    this.glass = new THREE.Mesh(dShell, glassMat);
    this.glass.castShadow = true;
    this.glass.receiveShadow = true;
    this.glass.position.set(0, 0.4, 0.22);

    const cShell = new THREE.BoxGeometry(radius * 1.15, radius * 1.15, radius * 1.15);
    this.glassCube = new THREE.Mesh(cShell, glassMat);
    this.glassCube.castShadow = true;
    this.glassCube.receiveShadow = true;
    this.glassCube.position.copy(this.glass.position);
    this.glassCube.visible = false;

    const objectRaw = new OBJLoader().parse(boxObj);
    const sourceMesh = objectRaw.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const geometry = BufferGeometryUtils.mergeVertices(sourceMesh.geometry) as THREE.BufferGeometry;
    const uvArray = geometry.attributes.uv?.array;
    if (uvArray instanceof Float32Array) {
      for (let i = 0; i < uvArray.length; i += 1) {
        uvArray[i] *= 10;
      }
    }

    const [normalMap, aoMap, map, roughnessMap] = await Promise.all([
      this.loadTexture(normalMapFile),
      this.loadTexture(aoMapFile),
      this.loadTexture(colorMapFile),
      this.loadTexture(roughnessMapFile),
    ]);

    const floorMat = new MeshStandardNodeMaterial({
      roughness: 0.9,
      metalness: 0.0,
      normalScale: new THREE.Vector2(1.0, 1.0),
      normalMap,
      aoMap,
      map,
      roughnessMap,
    });

    floorMat.aoNode = Fn(() => texture(aoMap, uv()).mul(positionWorld.z.div(0.4).mul(0.95).oneMinus()))();
    floorMat.colorNode = Fn(() => texture(map, uv()).mul(positionWorld.z.div(0.4).mul(0.5).oneMinus().mul(0.7)))();

    this.floor = new THREE.Mesh(geometry, floorMat);
    this.floor.rotation.set(0, Math.PI, 0);
    this.floor.position.set(0, -0.05, 0.22);
    this.floor.castShadow = true;
    this.floor.receiveShadow = true;

    this.object = new THREE.Object3D();
    this.object.add(this.floor);
    this.object.add(this.glass);
    this.object.add(this.glassCube);
  }

  setGlassParams(params: {
    ior?: number;
    thickness?: number;
    roughness?: number;
    dispersion?: number;
    attenuationDistance?: number;
    attenuationColor?: { r: number; g: number; b: number };
  }): void {
    const mat = this.glass?.material as MeshPhysicalNodeMaterial & {
      dispersion?: number;
      attenuationColor?: THREE.Color;
      attenuationDistance?: number;
    } | null;
    if (!mat) return;

    if (typeof params.ior === 'number') mat.ior = params.ior;
    if (typeof params.thickness === 'number') mat.thickness = params.thickness;
    if (typeof params.roughness === 'number') mat.roughness = params.roughness;
    mat.transmission = 1.0;
    if (typeof params.dispersion === 'number' && 'dispersion' in mat) {
      mat.dispersion = params.dispersion;
    }
    if (typeof params.attenuationDistance === 'number') {
      mat.attenuationDistance = params.attenuationDistance;
    }
    if (params.attenuationColor) {
      mat.attenuationColor = new THREE.Color(
        params.attenuationColor.r / 255,
        params.attenuationColor.g / 255,
        params.attenuationColor.b / 255,
      );
    }
  }

  setShape(shape: 'dodeca' | 'cube' | 'sphere'): void {
    const isDodeca = shape === 'dodeca';
    if (this.glass) this.glass.visible = isDodeca;
    if (this.glassCube) this.glassCube.visible = !isDodeca;
    if (this.floor) this.floor.visible = !isDodeca;
  }

  private async loadTexture(file: string): Promise<THREE.Texture> {
    const loader = new THREE.TextureLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        file,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          resolve(texture);
        },
        undefined,
        (error) => reject(error),
      );
    });
  }
}

class StageLights {
  object: THREE.Object3D;
  private spot: THREE.SpotLight;
  private target: THREE.Object3D;

  constructor() {
    this.object = new THREE.Object3D();
    this.spot = new THREE.SpotLight(0xffffff, 5, 15, Math.PI * 0.18, 1, 0);
    this.target = new THREE.Object3D();

    this.spot.position.set(0, 1.2, -0.8);
    this.target.position.set(0, 0.7, 0);

    this.spot.target = this.target;
    this.object.add(this.spot);
    this.object.add(this.target);

    this.spot.castShadow = true;
    this.spot.shadow.mapSize.width = 1024;
    this.spot.shadow.mapSize.height = 1024;
    this.spot.shadow.bias = -0.005;
    this.spot.shadow.camera.near = 0.5;
    this.spot.shadow.camera.far = 5;
  }

  update(): void {
    // Hook reserved for future dynamic cues
  }
}

class StageFeature implements FeatureModule {
  id = 'stage';

  private camera: THREE.PerspectiveCamera | null = null;
  private scene: THREE.Scene | null = null;
  private controls: OrbitControls | null = null;
  private background: StageBackground | null = null;
  private lights: StageLights | null = null;
  private environmentTexture: THREE.DataTexture | null = null;
  private glassSignature: string | null = null;
  private boundarySignature: string | null = null;

  async init(context: ModuleContext, progress?: (value: number) => void): Promise<void> {
    const { renderer, config, assets, registry, events } = context;
    const state = config.state;
    const stageConfig = state.stage;
    progress?.(0.05);

    this.camera = new THREE.PerspectiveCamera(
      stageConfig.camera.fov,
      window.innerWidth / window.innerHeight,
      stageConfig.camera.near,
      stageConfig.camera.far,
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

    this.background = new StageBackground();
    await this.background.init();
    if (this.background.object) {
      this.scene.add(this.background.object);
    }
    registry.provide('stage.background', this.background);
    if (this.environmentTexture) {
      registry.provide('stage.environmentTexture', this.environmentTexture);
    }

    this.lights = new StageLights();
    this.scene.add(this.lights.object);

    this.applySnapshot(context, snapshotStageConfig(state));

    const stageContext: StageContext = {
      camera: this.camera,
      scene: this.scene,
      controls: this.controls ?? undefined,
      requestBoundaryImport: () => this.openBoundaryImport(context),
    };
    registry.provide('stage', stageContext);
    events.emit('stage.ready', stageContext);
    events.emit('audio.environment-base', {
      bg: stageConfig.environment.backgroundRotationY,
      env: stageConfig.environment.environmentRotationY,
    });

    progress?.(0.2);
  }

  async update(frame: FrameContext, context: ModuleContext): Promise<void> {
    if (!this.camera || !this.scene) return;
    const { config, events } = context;
    const state = config.state;
    const snapshot = snapshotStageConfig(state);
    this.applySnapshot(context, snapshot);

    this.controls?.update(frame.delta);
    this.lights?.update?.();

    const newScale = computeWorldFit(this.camera, this.controls, snapshot.world);
    if (typeof newScale === 'number' && Number.isFinite(newScale)) {
      const stageState = config.state.stage;
      config.patch({
        stage: {
          ...stageState,
          world: { ...stageState.world, scale: newScale },
        },
      } as Partial<AuroraConfigState>);
    }

    events.emit('audio.environment-base', {
      bg: snapshot.environment.backgroundRotationY,
      env: snapshot.environment.environmentRotationY,
    });
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
  }

  private applySnapshot(context: ModuleContext, snapshot: StageSnapshot): void {
    if (!this.camera || !this.scene) return;
    applyCameraParams(this.camera, snapshot.camera);
    applyEnvironment(this.scene, snapshot.environment);
    applyRenderer(context.renderer, snapshot.renderer);
    this.applyGlass(snapshot.glass);
    this.applyBoundary(snapshot);
  }

  private applyGlass(glassConfig: StageSnapshot['glass']): void {
    if (!this.background?.glass) return;
    const params = {
      ior: glassConfig.ior,
      thickness: glassConfig.thickness,
      roughness: glassConfig.roughness,
      dispersion: glassConfig.dispersion,
      attenuationDistance: glassConfig.attenuationDistance,
      attenuationColor: toColorTuple(glassConfig.attenuationColor),
    };
    const signature = JSON.stringify(params);
    if (signature === this.glassSignature) return;
    this.glassSignature = signature;
    this.background.setGlassParams(params);
  }

  private applyBoundary(snapshot: StageSnapshot): void {
    if (!this.background) return;
    const stageObject = this.background.object as THREE.Object3D | null;
    if (!stageObject) return;
    const params = {
      visible: snapshot.world.boundariesEnabled,
      shape: snapshot.glass.shape,
    };
    const signature = JSON.stringify(params);
    if (signature === this.boundarySignature) return;
    this.boundarySignature = signature;
    stageObject.visible = params.visible;
    this.background.setShape(params.shape);
  }

  private async openBoundaryImport(context: ModuleContext): Promise<void> {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.obj,.glb,.gltf,.fbx,.ply,.stl';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await this.loadBoundaryFromFile(file, context);
    };
    input.click();
  }

  private async loadBoundaryFromFile(file: File, context: ModuleContext): Promise<void> {
    if (!this.background?.glass || !this.background.object) return;
    try {
      const glass = this.background.glass as THREE.Mesh | null;
      const stageObject = this.background.object as THREE.Object3D | null;
      if (!glass || !stageObject) return;
      const mesh = await context.assets.loadMeshFromFile(file, glass.material);
      if (!mesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (glass.parent) {
        glass.parent.remove(glass);
      }
      this.background.glass = mesh as unknown as StageBackground['glass'];
      stageObject.add(mesh);
      this.glassSignature = null;
      this.boundarySignature = null;
      const stageState = context.config.state.stage;
      context.config.patch({
        stage: {
          ...stageState,
          glass: { ...stageState.glass, shape: 'sphere' },
          world: { ...stageState.world, boundariesEnabled: true },
        },
      } as Partial<AuroraConfigState>);
      this.applySnapshot(context, snapshotStageConfig(context.config.state));
    } catch (error) {
      console.error(error);
    }
  }
}

export function createStageDomain(): FeatureModule {
  return new StageFeature();
}
