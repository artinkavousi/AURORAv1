import * as THREE from "three/webgpu";
import { Fn, texture, uv, positionWorld, vec3, float } from "three/tsl";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import boxObj from './assets/boxSlightlySmooth.obj';

import normalMapFile from './assets/concrete_0016_normal_opengl_1k.png';
import aoMapFile from './assets/concrete_0016_ao_1k.jpg';
import colorMapFile from './assets/concrete_0016_color_1k.jpg';
import roughnessMapFile from './assets/concrete_0016_roughness_1k.jpg';

const textureLoader = new THREE.TextureLoader();
const loadTexture = (file) => {
    return new Promise(resolve => {
        textureLoader.load(file, texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            resolve(texture);
        });
    });
}

class BackgroundGeometry {
    object = null;
    glass = null;
    glassCube = null;
    floor = null;

    constructor() {}

    async init() {
        // Shared glass material
        const glassMat = new THREE.MeshPhysicalNodeMaterial({
            roughness: 0.02,
            transmission: 1.0,
            thickness: 0.3,
            metalness: 0.0,
            ior: 1.5,
        });

        // Simple dispersion-tinted color for glass
        const dispersionColor = Fn(() => {
            const d = float(0.25);
            return vec3(1.0, 1.0 - d.mul(0.35), 1.0 - d.mul(0.7));
        })();

        glassMat.colorNode = dispersionColor;

        // Dodecahedron
        const radius = 0.72;
        const dShell = new THREE.DodecahedronGeometry(radius, 0);
        this.glass = new THREE.Mesh(dShell, glassMat);
        this.glass.castShadow = true;
        this.glass.receiveShadow = true;
        this.glass.position.set(0, 0.4, 0.22);

        // Cube
        const cShell = new THREE.BoxGeometry(radius * 1.15, radius * 1.15, radius * 1.15);
        this.glassCube = new THREE.Mesh(cShell, glassMat);
        this.glassCube.castShadow = true;
        this.glassCube.receiveShadow = true;
        this.glassCube.position.copy(this.glass.position);
        this.glassCube.visible = false;

        // Textured floor box for grounding
        const objectRaw = new OBJLoader().parse(boxObj);
        const geometry = BufferGeometryUtils.mergeVertices(objectRaw.children[0].geometry);
        const uvArray = geometry.attributes.uv.array;
        for (let i=0; i<uvArray.length; i++) {
            uvArray[i] *= 10;
        }

        const normalMap = await loadTexture(normalMapFile);
        const aoMap = await loadTexture(aoMapFile);
        const map = await loadTexture(colorMapFile);
        const roughnessMap = await loadTexture(roughnessMapFile);

        const floorMat = new THREE.MeshStandardNodeMaterial({
            roughness: 0.9,
            metalness:0.0,
            normalScale: new THREE.Vector3(1.0, 1.0),
            normalMap,
            aoMap,
            map,
            roughnessMap,
        });
        floorMat.aoNode = Fn(() => {
            return texture(aoMap, uv()).mul(positionWorld.z.div(0.4).mul(0.95).oneMinus());
        })();
        floorMat.colorNode = Fn(() => {
            return texture(map, uv()).mul(positionWorld.z.div(0.4).mul(0.5).oneMinus().mul(0.7));
        })();

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

    setGlassParams({ ior, thickness, roughness, dispersion, attenuationDistance, attenuationColor }) {
        if (!this.glass) return;
        const mat = /** @type {THREE.MeshPhysicalNodeMaterial} */ (this.glass.material);
        if (mat) {
            if (typeof ior === 'number') mat.ior = ior;
            if (typeof thickness === 'number') mat.thickness = thickness;
            if (typeof roughness === 'number') mat.roughness = roughness;
            mat.transmission = 1.0;
            if (typeof dispersion === 'number' && 'dispersion' in mat) mat.dispersion = dispersion;
            if (typeof attenuationDistance === 'number') mat.attenuationDistance = attenuationDistance;
            if (attenuationColor) {
                mat.attenuationColor = new THREE.Color(attenuationColor.r / 255, attenuationColor.g / 255, attenuationColor.b / 255);
            }
        }
    }

    setShape(shape) {
        const isDodeca = shape === 'dodeca';
        if (this.glass) this.glass.visible = isDodeca;
        if (this.glassCube) this.glassCube.visible = !isDodeca;
        if (this.floor) this.floor.visible = !isDodeca; // hide the old box when using dodecahedron
    }
}

export default BackgroundGeometry;


