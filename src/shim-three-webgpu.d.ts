declare module 'three/examples/jsm/controls/OrbitControls.js' {
  import type * as THREE from 'three';
  export class OrbitControls extends THREE.EventDispatcher {
    constructor(object: THREE.Camera, domElement?: HTMLElement);
    object: THREE.Camera;
    domElement: HTMLElement;
    enableDamping: boolean;
    enablePan: boolean;
    touches: Record<string, unknown>;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    target: THREE.Vector3;
    update(delta?: number): void;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/loaders/HDRLoader.js' {
  import type * as THREE from 'three';
  export class HDRLoader {
    load(
      url: string,
      onLoad: (texture: THREE.DataTexture) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: unknown) => void,
    ): void;
  }
}

declare module 'three/examples/jsm/utils/BufferGeometryUtils.js' {
  import type * as THREE from 'three';
  export function mergeVertices<T extends THREE.BufferGeometry>(geometry: T, tolerance?: number): T;
}

declare module 'three/examples/jsm/loaders/OBJLoader.js' {
  import type * as THREE from 'three';
  export class OBJLoader {
    parse(data: string): THREE.Group;
  }
}

declare module 'three/examples/jsm/loaders/GLTFLoader.js' {
  import type * as THREE from 'three';
  export interface GLTF {
    scene: THREE.Group;
  }
  export class GLTFLoader {
    parse(data: ArrayBuffer, path: string, onLoad: (gltf: GLTF) => void, onError?: (error: unknown) => void): void;
  }
}

declare module 'three/examples/jsm/loaders/PLYLoader.js' {
  import type * as THREE from 'three';
  export class PLYLoader {
    parse(data: ArrayBuffer): THREE.BufferGeometry;
  }
}

declare module 'three/examples/jsm/loaders/STLLoader.js' {
  import type * as THREE from 'three';
  export class STLLoader {
    parse(data: ArrayBuffer): THREE.BufferGeometry;
  }
}

declare module 'three/src/renderers/webgpu/WebGPURenderer.js' {
  import { WebGLRenderer, WebGLRendererParameters } from 'three';
  export interface WebGPURendererParameters extends WebGLRendererParameters {
    forceWebGL?: boolean;
  }
  export default class WebGPURenderer extends WebGLRenderer {
    constructor(parameters?: WebGPURendererParameters);
    backend: { isWebGPUBackend?: boolean };
    init(): Promise<void>;
  }
}
