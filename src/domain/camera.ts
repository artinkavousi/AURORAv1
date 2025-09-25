import * as THREE from 'three';
import type { FeatureModule, ModuleContext } from '../core/plugins';
import type { FrameContext, ResizeContext, StageContext, SimulationContext, PostPipelineContext } from '../core/types';
import { getNumber, toBoolean, toNumber, toStringOption } from '../core/value';

const SIM_DOMAIN_OFFSET = new THREE.Vector3(32, 32, 32);

function projectPointer(event: PointerEvent, target: THREE.Vector2) {
  target.x = (event.clientX / window.innerWidth) * 2 - 1;
  target.y = -(event.clientY / window.innerHeight) * 2 + 1;
  return target;
}

function intersectStagePlane(raycaster: THREE.Raycaster, camera: THREE.Camera) {
  const centerWorld = new THREE.Vector3(0, 0, 0);
  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, centerWorld);
  const intersect = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, intersect)) return null;
  return { intersect, planeNormal: normal, planeOrigin: centerWorld };
}

class CameraFeature implements FeatureModule {
  id = 'camera';

  private stage: StageContext | null = null;
  private simulation: SimulationContext | null = null;
  private post: PostPipelineContext | null = null;
  private config: ModuleContext['config'] | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private camDollyOffset = new THREE.Vector3();
  private baseRoll: number | undefined;
  private onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private onCenterFocus = () => this.centerFocus();

  async init(context: ModuleContext): Promise<void> {
    this.stage = context.registry.resolve<StageContext>('stage');
    this.simulation = context.registry.tryResolve<SimulationContext>('simulation') ?? null;
    this.post = context.registry.tryResolve<PostPipelineContext>('postfx') ?? null;
    this.config = context.config;

    const element = context.renderer.domElement;
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerdown', this.onPointerDown);

    const state = context.config.state;
    state.__onLensCenterFocus = this.onCenterFocus;
  }

  resize(size: ResizeContext): void {
    void size;
  }

  async update(frame: FrameContext, context: ModuleContext): Promise<void> {
    void frame;
    const camera = this.stage?.camera;
    if (!camera) return;
    const state = context.config.state;

    const reactiveEnabled = toBoolean(state.camReactiveEnabled, false);
    if (reactiveEnabled) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const scale = getNumber(state, 'camDollyMax', 0) * getNumber(state, '_camDolly', 0);
      const newOffset = dir.multiplyScalar(scale);
      if (this.camDollyOffset.lengthSq() > 0) {
        camera.position.sub(this.camDollyOffset);
      }
      camera.position.add(newOffset);
      this.camDollyOffset.copy(newOffset);
      const baseRoll = this.ensureBaseRoll(camera);
      camera.rotation.z = baseRoll + getNumber(state, 'camRollMax', 0) * getNumber(state, '_camRoll', 0);
    } else {
      if (this.camDollyOffset.lengthSq() > 0) {
        camera.position.sub(this.camDollyOffset);
        this.camDollyOffset.set(0, 0, 0);
      }
      camera.rotation.z = this.ensureBaseRoll(camera);
    }
  }

  dispose(context: ModuleContext): void {
    const element = context.renderer.domElement;
    element.removeEventListener('pointermove', this.onPointerMove);
    element.removeEventListener('pointerdown', this.onPointerDown);
    const state = context.config.state;
    if (state.__onLensCenterFocus === this.onCenterFocus) {
      state.__onLensCenterFocus = null;
    }
  }

  private centerFocus(): void {
    const camera = this.stage?.camera;
    if (!camera || !this.post?.pipeline) return;

    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(0, 0, 0));
    const intersect = new THREE.Vector3();
    const ray = new THREE.Ray(camera.position.clone(), normal.clone());
    if (!ray.intersectPlane(plane, intersect)) return;

    const camSpace = intersect.clone().applyMatrix4(camera.matrixWorldInverse);
    const viewDist = Math.abs(camSpace.z);
    this.post.pipeline.pointerFocus(viewDist, 0.0);
  }

  private handlePointerDown(event: PointerEvent): void {
    const camera = this.stage?.camera;
    const state = this.config?.state;
    if (!camera || !this.post?.pipeline || !state) return;

    projectPointer(event, this.pointer);
    this.raycaster.setFromCamera(this.pointer, camera);
    const hit = intersectStagePlane(this.raycaster, camera);
    if (!hit) return;

    const camSpace = hit.intersect.clone().applyMatrix4(camera.matrixWorldInverse);
    const viewDist = Math.abs(camSpace.z);
    const smoothing = toNumber(state.lensFocusSmoothing ?? state.focusSmooth ?? state.focusSmoothing, 0.2);
    const focusEnabled =
      toBoolean(state.lensFxEnabled ?? state.cameraFxEnabled ?? state.dofEnabled, true) &&
      toBoolean(state.postFxEnabled, true);
    if (focusEnabled) {
      this.post.pipeline.pointerFocus(viewDist, smoothing);
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    const camera = this.stage?.camera;
    const state = this.config?.state;
    if (!camera || !state) return;

    projectPointer(event, this.pointer);
    this.raycaster.setFromCamera(this.pointer, camera);
    const hit = intersectStagePlane(this.raycaster, camera);
    if (!hit) return;

    if (this.simulation?.simulator?.setMouseRay) {
      const s = (1 / 64) * getNumber(state, 'worldScale', 1);
      const zScale = getNumber(state, 'zScale', 0.4);
      const worldToSim = (v: THREE.Vector3) => {
        const out = v.clone().divideScalar(s);
        out.z /= zScale;
        out.add(SIM_DOMAIN_OFFSET);
        return out;
      };
      const originSim = worldToSim(this.raycaster.ray.origin);
      const posSim = worldToSim(hit.intersect);
      const dirSim = this.raycaster.ray.direction.clone();
      dirSim.divideScalar(s);
      dirSim.z /= zScale;
      dirSim.normalize();
      this.simulation.simulator.setMouseRay(originSim, dirSim, posSim);
    }

    const fallbackMode = toBoolean(state.dofAutoFocus, false) ? 'pointer' : 'manual';
    const focusMode = toStringOption(state.focusMode ?? state.lensFocusMode, fallbackMode);
    const cameraFxActive =
      toBoolean(state.lensFxEnabled ?? state.cameraFxEnabled ?? state.dofEnabled, true) &&
      focusMode === 'pointer' &&
      toBoolean(state.postFxEnabled, true) &&
      this.post?.pipeline;
    if (cameraFxActive && this.post?.pipeline) {
      const camSpace = hit.intersect.clone().applyMatrix4(camera.matrixWorldInverse);
      const viewDist = Math.abs(camSpace.z);
      const smoothing = toNumber(state.lensFocusSmoothing ?? state.focusSmooth ?? state.focusSmoothing, 0.2);
      this.post.pipeline.pointerFocus(viewDist, smoothing);
    }
  }

  private ensureBaseRoll(camera: THREE.PerspectiveCamera): number {
    if (this.baseRoll === undefined) {
      this.baseRoll = camera.rotation.z || 0;
    }
    return this.baseRoll ?? 0;
  }
}

export function createCameraDomain(): FeatureModule {
  return new CameraFeature();
}
