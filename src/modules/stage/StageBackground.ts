import * as THREE from 'three';
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, texture, uv, positionWorld, vec3, float } from 'three/tsl';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import boxObj from '../../assets/boxSlightlySmooth.obj';
import normalMapFile from '../../assets/concrete_0016_normal_opengl_1k.png';
import aoMapFile from '../../assets/concrete_0016_ao_1k.jpg';
import colorMapFile from '../../assets/concrete_0016_color_1k.jpg';
import roughnessMapFile from '../../assets/concrete_0016_roughness_1k.jpg';

type GlassMaterial = MeshPhysicalNodeMaterial & {
  dispersion?: number;
  attenuationColor?: THREE.Color;
  attenuationDistance?: number;
};

type TextureFile = string;

async function loadTexture(file: TextureFile): Promise<THREE.Texture> {
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

export interface GlassParams {
  ior?: number;
  thickness?: number;
  roughness?: number;
  dispersion?: number;
  attenuationDistance?: number;
  attenuationColor?: { r: number; g: number; b: number };
}

export default class StageBackground {
  object: THREE.Object3D | null = null;
  glass: THREE.Mesh<THREE.BufferGeometry, GlassMaterial> | null = null;
  glassCube: THREE.Mesh<THREE.BufferGeometry, GlassMaterial> | null = null;
  floor: THREE.Mesh<THREE.BufferGeometry, MeshStandardNodeMaterial> | null = null;

  async init(): Promise<void> {
    const glassMat = new MeshPhysicalNodeMaterial({
      roughness: 0.02,
      transmission: 1.0,
      thickness: 0.3,
      metalness: 0.0,
      ior: 1.5,
    }) as GlassMaterial;

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
      loadTexture(normalMapFile),
      loadTexture(aoMapFile),
      loadTexture(colorMapFile),
      loadTexture(roughnessMapFile),
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

  setGlassParams(params: GlassParams): void {
    const mat = this.glass?.material;
    if (!mat) return;

    if (typeof params.ior === 'number') mat.ior = params.ior;
    if (typeof params.thickness === 'number') mat.thickness = params.thickness;
    if (typeof params.roughness === 'number') mat.roughness = params.roughness;
    mat.transmission = 1.0;
    if (typeof params.dispersion === 'number' && 'dispersion' in mat) {
      (mat as GlassMaterial).dispersion = params.dispersion;
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
}
