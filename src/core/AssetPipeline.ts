import * as THREE from 'three/webgpu';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type MeshMaterial = THREE.Material | THREE.Material[];

export class AssetPipeline {
  private readonly hdrCache = new Map<string, Promise<THREE.DataTexture>>();

  loadHdrTexture(url: string): Promise<THREE.DataTexture> {
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

  async loadMeshFromFile(file: File, material: MeshMaterial): Promise<THREE.Mesh | null> {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'obj') {
      const text = await file.text();
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const obj = new OBJLoader().parse(text);
      const source = obj.children.find((child: THREE.Object3D): child is THREE.Mesh => {
        return (child as THREE.Mesh).isMesh === true;
      });
      if (!source) return null;
      const geometry = BufferGeometryUtils.mergeVertices(source.geometry);
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
