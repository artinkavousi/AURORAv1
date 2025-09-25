/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars */
// @ts-nocheck
import * as THREE from "three";
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, attribute, instanceIndex, mat3, normalize, vec3, varying, uniform, mrt, float } from "three/tsl";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { conf } from "../conf";
import { calcLookAtMatrix } from "./particleRenderer";

class GlyphRenderer {
    mlsMpmSim = null;
    object = null;
    bloom = false;
    uniforms = {};

    constructor(mlsMpmSim) {
        this.mlsMpmSim = mlsMpmSim;

        const base = BufferGeometryUtils.mergeVertices(new THREE.IcosahedronGeometry(0.5, 2));
        this.geometry = new THREE.InstancedBufferGeometry().copy(base);
        this.geometry.instanceCount = this.mlsMpmSim.numParticles;

        this.material = new MeshStandardNodeMaterial({
            metalness: 0.2,
            roughness: 0.25,
        });

        const vAo = varying(0, "vAoGlyph");
        const vThickness = varying(0, "vThicknessGlyph");
        this.uniforms.size = uniform(1);

        const particle = this.mlsMpmSim.particleBuffer.element(instanceIndex);
        this.uniforms.zScale = { value: 0.4 };
        this.material.positionNode = Fn(() => {
            const p = particle.get('position');
            const dir = normalize(particle.get('direction').xyz);
            const C = particle.get('C');
            // Anisotropy magnitude along direction using C
            const stretch = C.mul(vec3(dir)).length();
            const sMajor = stretch.mul(1.5).add(1.0); // 1..2.5 range approx
            const sMinor = stretch.mul(0.5).oneMinus().mul(0.6).add(0.7).clamp(0.5, 1.2);

            const look = calcLookAtMatrix(dir);
            const local = attribute('position').xyz;
            const scaled = vec3(local.x.mul(sMinor), local.y.mul(sMinor), local.z.mul(sMajor)).mul(this.uniforms.size);
            vAo.assign(p.z.div(64).mul(p.z.div(64)).oneMinus());
            vThickness.assign(stretch.clamp(0,1));
            return look.mul(scaled).add( p.sub(vec3(32,32,32)).mul( vec3(1,1,float(this.uniforms.zScale.value)) ) );
        })();
        this.material.aoNode = vAo;
        this.material.opacityNode = vThickness.remap(0,1,0.75,1.0).clamp(0.65,1.0);

        this.object = new THREE.Mesh(this.geometry, this.material);
        this.object.frustumCulled = false;
        const s = 1/64;
        this.object.position.set(0,0,0);
        this.object.scale.set(s,s,s);
        this.object.castShadow = true;
        this.object.receiveShadow = true;
    }

    update() {
        const { particles, bloom, actualSize, worldScale, zScale } = conf;
        this.uniforms.size.value = actualSize;
        this.geometry.instanceCount = particles;

        if (bloom !== this.bloom) {
            this.bloom = bloom;
            this.material.mrtNode = bloom ? mrt({ bloomIntensity: 1 }) : null;
        }

        const s = (1/64) * (worldScale || 1);
        this.object.position.set(0,0,0);
        this.object.scale.set(s,s,s);
        this.uniforms.zScale.value = zScale;
    }
}

export default GlyphRenderer;
