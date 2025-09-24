import * as THREE from "three/webgpu";
import {Fn, vec3, instanceIndex, float} from "three/tsl";
import {conf} from "../conf";

class PointRenderer {
    mlsMpmSim = null;
    object = null;

    constructor(mlsMpmSim) {
        this.mlsMpmSim = mlsMpmSim;

        this.geometry = new THREE.InstancedBufferGeometry();
        const positionBuffer = new THREE.BufferAttribute(new Float32Array(3), 3, false);
        const material = new THREE.PointsNodeMaterial();
        this.geometry.setAttribute('position', positionBuffer);
        this.object = new THREE.Points(this.geometry, material);
        this.uniforms = { zScale: { value: 0.4 } };
        material.positionNode = Fn(() => {
            const p = this.mlsMpmSim.particleBuffer.element(instanceIndex).get('position');
            return p.sub(vec3(32,32,32)).mul( vec3(1,1,float(this.uniforms.zScale.value)) );
        })();

        this.object.frustumCulled = false;

        const s = (1/64);
        this.object.position.set(0,0,0);
        this.object.scale.set(s,s,s);
        this.object.castShadow = true;
        this.object.receiveShadow = true;
    }

    update() {
        const { particles, worldScale, zScale } = conf;
        this.geometry.instanceCount = particles;
        const s = (1/64) * (worldScale || 1);
        this.object.position.set(0,0,0);
        this.object.scale.set(s,s,s);
        this.uniforms.zScale.value = zScale;
    }
}
export default PointRenderer;
