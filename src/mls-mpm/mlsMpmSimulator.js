import * as THREE from "three/webgpu";
import {
    array,
    Fn,
    If,
    instancedArray,
    instanceIndex,
    Return,
    uniform,
    int,
    float,
    Loop,
    vec3,
    vec4,
    atomicAdd,
    uint,
    max,
    pow,
    mat3,
    clamp,
    time,
    cross, mix, mx_hsvtorgb, select, ivec3
} from "three/tsl";
import {triNoise3Dvec} from "../common/noise";
import {conf} from "../conf";
import {StructuredArray} from "./structuredArray.js";
import {hsvtorgb} from "../common/hsv.js";

class mlsMpmSimulator {
    renderer = null;
    numParticles = 0;
    gridSize = new THREE.Vector3(0,0,0);
    gridCellSize = new THREE.Vector3(0,0,0);
    uniforms = {};
    kernels = {};
    fixedPointMultiplier = 1e7;
    mousePos = new THREE.Vector3();
    mousePosArray = [];

    constructor(renderer) {
        this.renderer = renderer;
    }
    async init() {
        const {maxParticles} = conf;
        this.gridSize.set(64,64,64);

        const particleStruct =  {
            position: { type: 'vec3' },
            density: { type: 'float' },
            velocity: { type: 'vec3' },
            mass: { type: 'float' },
            C: { type: 'mat3' },
            direction: { type: 'vec3' },
            color: { type: 'vec3' },
        };
        this.particleBuffer = new StructuredArray(particleStruct, maxParticles, "particleData");

        const vec = new THREE.Vector3();
        for (let i = 0; i < maxParticles; i++) {
            let dist = 2;
            while (dist > 1) {
                vec.set(Math.random(),Math.random(),Math.random()).multiplyScalar(2.0).subScalar(1.0);
                dist = vec.length();
                vec.multiplyScalar(0.8).addScalar(1.0).divideScalar(2.0).multiply(this.gridSize);
            }
            const mass = 1.0 - Math.random() * 0.002;
            this.particleBuffer.set(i, "position", vec);
            this.particleBuffer.set(i, "mass", mass);
        }

        const cellCount = this.gridSize.x * this.gridSize.y * this.gridSize.z;
        const cellStruct ={
            x: { type: 'int', atomic: true },
            y: { type: 'int', atomic: true },
            z: { type: 'int', atomic: true },
            mass: { type: 'int', atomic: true },
        };
        this.cellBuffer = new StructuredArray(cellStruct, cellCount, "cellData");
        this.cellBufferF = instancedArray(cellCount, 'vec4').setName('cellDataF');

        this.uniforms.gravityType = uniform(0, "uint");
        this.uniforms.gravity = uniform(new THREE.Vector3());
        this.uniforms.stiffness = uniform(0);
        this.uniforms.restDensity = uniform(0);
        this.uniforms.dynamicViscosity = uniform(0);
        this.uniforms.noise = uniform(0);
        this.uniforms.apicBlend = uniform(0);
        // Stability guard
        this.uniforms.maxVelocity = uniform(2.5);

        this.uniforms.gridSize = uniform(this.gridSize, "ivec3");
        this.uniforms.gridCellSize = uniform(this.gridCellSize);
        this.uniforms.dt = uniform(0.1);
        this.uniforms.numParticles = uniform(0, "uint");

        this.uniforms.mouseRayDirection = uniform(new THREE.Vector3());
        this.uniforms.mouseRayOrigin = uniform(new THREE.Vector3());
        this.uniforms.mouseForce = uniform(new THREE.Vector3());
        this.uniforms.zScale = uniform(0.4);
        this.uniforms.sdfSphere = uniform(0, 'uint');
        this.uniforms.sdfCenter = uniform(new THREE.Vector3());
        this.uniforms.sdfRadius = uniform(0.0);
        // Color mode
        this.uniforms.colorMode = uniform(0, 'uint');
        // Collision material
        this.uniforms.collisionRestitution = uniform(0.6);
        this.uniforms.collisionFriction = uniform(0.2);

        // Field uniforms (jets, vortex)
        this.uniforms.jetEnabled = uniform(0, 'uint');
        this.uniforms.jetStrength = uniform(0.0);
        this.uniforms.jetRadius = uniform(0.0);
        this.uniforms.jetPos = uniform(new THREE.Vector3());
        this.uniforms.jetDir = uniform(new THREE.Vector3());

        this.uniforms.vortexEnabled = uniform(0, 'uint');
        this.uniforms.vortexStrength = uniform(0.0);
        this.uniforms.vortexRadius = uniform(0.0);
        this.uniforms.vortexCenter = uniform(new THREE.Vector2());

        // New volumetric field uniforms
        this.uniforms.curlEnabled = uniform(0, 'uint');
        this.uniforms.curlStrength = uniform(0.0);
        this.uniforms.curlScale = uniform(0.02);
        this.uniforms.curlTime = uniform(0.6);

        this.uniforms.orbitEnabled = uniform(0, 'uint');
        this.uniforms.orbitStrength = uniform(0.0);
        this.uniforms.orbitRadius = uniform(0.0);
        this.uniforms.orbitAxis = uniform(new THREE.Vector3(0,0,1));

        this.uniforms.waveEnabled = uniform(0, 'uint');
        this.uniforms.waveAmplitude = uniform(0.0);
        this.uniforms.waveScale = uniform(0.12);
        this.uniforms.waveSpeed = uniform(1.2);
        this.uniforms.waveAxis = uniform(1, 'uint'); // 0 x, 1 y, 2 z

        // Audio-reactive uniforms (0..1 normalized)
        this.uniforms.audioLevel = uniform(0.0);
        this.uniforms.audioBeat = uniform(0.0);
        this.uniforms.audioBass = uniform(0.0);
        this.uniforms.audioMid = uniform(0.0);
        this.uniforms.audioTreble = uniform(0.0);
        this.uniforms.audioTempoPhase = uniform(0.0);
        this.uniforms.audioTempoBpm = uniform(0.0);

        // Optional fluid shaping
        this.uniforms.vorticityEnabled = uniform(0, 'uint');
        this.uniforms.vorticityEps = uniform(0.15);
        this.uniforms.xsphEnabled = uniform(0, 'uint');
        this.uniforms.xsphEps = uniform(0.08);

        this.kernels.clearGrid = Fn(() => {
            this.cellBuffer.setAtomic("x", false);
            this.cellBuffer.setAtomic("y", false);
            this.cellBuffer.setAtomic("z", false);
            this.cellBuffer.setAtomic("mass", false);

            If(instanceIndex.greaterThanEqual(uint(cellCount)), () => {
                Return();
            });

            this.cellBuffer.element(instanceIndex).get('x').assign(0);
            this.cellBuffer.element(instanceIndex).get('y').assign(0);
            this.cellBuffer.element(instanceIndex).get('z').assign(0);
            this.cellBuffer.element(instanceIndex).get('mass').assign(0);
            this.cellBufferF.element(instanceIndex).assign(0);
        })().compute(cellCount);

        const encodeFixedPoint = (f32) => {
            return int(f32.mul(this.fixedPointMultiplier));
        }
        const decodeFixedPoint = (i32) => {
            return float(i32).div(this.fixedPointMultiplier);
        }

        const getCellPtr = (ipos) => {
            const gridSize = this.uniforms.gridSize;
            const cellPtr = int(ipos.x).mul(gridSize.y).mul(gridSize.z).add(int(ipos.y).mul(gridSize.z)).add(int(ipos.z)).toConst();
            return cellPtr;
        };
        const getCell = (ipos) => {
            return this.cellBuffer.element(getCellPtr(ipos));
        };

        this.kernels.p2g1 = Fn(() => {
            this.cellBuffer.setAtomic("x", true);
            this.cellBuffer.setAtomic("y", true);
            this.cellBuffer.setAtomic("z", true);
            this.cellBuffer.setAtomic("mass", true);

            If(instanceIndex.greaterThanEqual(uint(this.uniforms.numParticles)), () => {
                Return();
            });
            const particlePosition = this.particleBuffer.element(instanceIndex).get('position').xyz.toConst("particlePosition");
            const particleVelocity = this.particleBuffer.element(instanceIndex).get('velocity').xyz.toConst("particleVelocity");

            const cellIndex =  ivec3(particlePosition).sub(1).toConst("cellIndex");
            const cellDiff = particlePosition.fract().sub(0.5).toConst("cellDiff");
            const w0 = float(0.5).mul(float(0.5).sub(cellDiff)).mul(float(0.5).sub(cellDiff));
            const w1 = float(0.75).sub(cellDiff.mul(cellDiff));
            const w2 = float(0.5).mul(float(0.5).add(cellDiff)).mul(float(0.5).add(cellDiff));
            const weights = array([w0,w1,w2]).toConst("weights");

            const C = this.particleBuffer.element(instanceIndex).get('C').toConst();
            Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({gx}) => {
                Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({gy}) => {
                    Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({gz}) => {
                        const weight = weights.element(gx).x.mul(weights.element(gy).y).mul(weights.element(gz).z);
                        const cellX = cellIndex.add(ivec3(gx,gy,gz)).toConst();
                        const cellDist = vec3(cellX).add(0.5).sub(particlePosition).toConst("cellDist");
                        const apicTerm = C.mul(cellDist);
                        // APIC blend: v + apicBlend * (C * (xg - xp))
                        const v_apic = particleVelocity.add( apicTerm.mul(this.uniforms.apicBlend) ).toConst("v_apic");
                        const massContrib = weight; // particle mass assumed 1
                        const velContrib = massContrib.mul(v_apic).toConst("velContrib");
                        const cell = getCell(cellX);
                        atomicAdd(cell.get('x'), encodeFixedPoint(velContrib.x));
                        atomicAdd(cell.get('y'), encodeFixedPoint(velContrib.y));
                        atomicAdd(cell.get('z'), encodeFixedPoint(velContrib.z));
                        atomicAdd(cell.get('mass'), encodeFixedPoint(massContrib));
                    });
                });
            });
        })().compute(1);


        this.kernels.p2g2 = Fn(() => {
            this.cellBuffer.setAtomic("x", true);
            this.cellBuffer.setAtomic("y", true);
            this.cellBuffer.setAtomic("z", true);
            this.cellBuffer.setAtomic("mass", false);

            If(instanceIndex.greaterThanEqual(uint(this.uniforms.numParticles)), () => {
                Return();
            });
            const particlePosition = this.particleBuffer.element(instanceIndex).get('position').xyz.toConst("particlePosition");

            const cellIndex =  ivec3(particlePosition).sub(1).toConst("cellIndex");
            const cellDiff = particlePosition.fract().sub(0.5).toConst("cellDiff");
            const w0 = float(0.5).mul(float(0.5).sub(cellDiff)).mul(float(0.5).sub(cellDiff));
            const w1 = float(0.75).sub(cellDiff.mul(cellDiff));
            const w2 = float(0.5).mul(float(0.5).add(cellDiff)).mul(float(0.5).add(cellDiff));
            const weights = array([w0,w1,w2]).toConst("weights");

            const density = float(0).toVar("density");
            Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({gx}) => {
                Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({gy}) => {
                    Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({gz}) => {
                        const weight = weights.element(gx).x.mul(weights.element(gy).y).mul(weights.element(gz).z);
                        const cellX = cellIndex.add(ivec3(gx,gy,gz)).toConst();
                        const cell = getCell(cellX);
                        density.addAssign(decodeFixedPoint(cell.get('mass')).mul(weight));
                    });
                });
            });
            const densityStore = this.particleBuffer.element(instanceIndex).get('density');
            densityStore.assign(mix(densityStore, density, 0.05));

            const volume = float(1).div(density);
            const pressure = max(0.0, pow(density.div(this.uniforms.restDensity), 5.0).sub(1).mul(this.uniforms.stiffness)).toConst('pressure');
            const stress = mat3(pressure.negate(), 0, 0, 0, pressure.negate(), 0, 0, 0, pressure.negate()).toVar('stress');
            const dudv = this.particleBuffer.element(instanceIndex).get('C').toConst('C');

            const strain = dudv.add(dudv.transpose());
            stress.addAssign(strain.mul(this.uniforms.dynamicViscosity));
            const eq16Term0 = volume.mul(-4).mul(stress).mul(this.uniforms.dt);

            Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({gx}) => {
                Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({gy}) => {
                    Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({gz}) => {
                        const weight = weights.element(gx).x.mul(weights.element(gy).y).mul(weights.element(gz).z);
                        const cellX = cellIndex.add(ivec3(gx,gy,gz)).toConst();
                        const cellDist = vec3(cellX).add(0.5).sub(particlePosition).toConst("cellDist");
                        const cell= getCell(cellX);

                        const momentum = eq16Term0.mul(weight).mul(cellDist).toConst("momentum");
                        atomicAdd(cell.get('x'), encodeFixedPoint(momentum.x));
                        atomicAdd(cell.get('y'), encodeFixedPoint(momentum.y));
                        atomicAdd(cell.get('z'), encodeFixedPoint(momentum.z));
                    });
                });
            });
        })().compute(1);


        this.kernels.updateGrid = Fn(() => {
            this.cellBuffer.setAtomic("x", false);
            this.cellBuffer.setAtomic("y", false);
            this.cellBuffer.setAtomic("z", false);
            this.cellBuffer.setAtomic("mass", false);

            If(instanceIndex.greaterThanEqual(uint(cellCount)), () => {
                Return();
            });
            const cell = this.cellBuffer.element(instanceIndex).toConst("cell");

            const mass = decodeFixedPoint(cell.get('mass')).toConst();
            If(mass.lessThanEqual(0), () => { Return(); });

            const vx = decodeFixedPoint(cell.get('x')).div(mass).toVar();
            const vy = decodeFixedPoint(cell.get('y')).div(mass).toVar();
            const vz = decodeFixedPoint(cell.get('z')).div(mass).toVar();

            const x = int(instanceIndex).div(this.uniforms.gridSize.z).div(this.uniforms.gridSize.y);
            const y = int(instanceIndex).div(this.uniforms.gridSize.z).mod(this.uniforms.gridSize.y);
            const z = int(instanceIndex).mod(this.uniforms.gridSize.z);


            If(x.lessThan(int(2)).or(x.greaterThan(this.uniforms.gridSize.x.sub(int(2)))), () => {
                vx.assign(0);
            });
            If(y.lessThan(int(2)).or(y.greaterThan(this.uniforms.gridSize.y.sub(int(2)))), () => {
                vy.assign(0);
            });
            If(z.lessThan(int(2)).or(z.greaterThan(this.uniforms.gridSize.z.sub(int(2)))), () => {
                vz.assign(0);
            });

            this.cellBufferF.element(instanceIndex).assign(vec4(vx,vy,vz,mass));
        })().compute(cellCount);

        this.kernels.g2p = Fn(() => {
            If(instanceIndex.greaterThanEqual(uint(this.uniforms.numParticles)), () => {
                Return();
            });
            const particleMass = this.particleBuffer.element(instanceIndex).get('mass').toConst("particleMass");
            const particleDensity = this.particleBuffer.element(instanceIndex).get('density').toConst("particleDensity");
            const particlePosition = this.particleBuffer.element(instanceIndex).get('position').xyz.toVar("particlePosition");
            const particleVelocity = vec3(0).toVar();
            If(this.uniforms.gravityType.equal(uint(2)), () => {
                const pn = particlePosition.div(vec3(this.uniforms.gridSize.sub(1))).sub(0.5).normalize().toConst();
                particleVelocity.subAssign(pn.mul(0.3).mul(this.uniforms.dt));
            }).Else(() => {
                particleVelocity.addAssign(this.uniforms.gravity.mul(this.uniforms.dt));
            });


            const noise = triNoise3Dvec(particlePosition.mul(0.015), time, 0.11).sub(0.285).normalize().mul(0.28).toVar();
            particleVelocity.subAssign(noise.mul(this.uniforms.noise).mul(this.uniforms.dt));

            // Curl noise turbulence (divergence-free like)
            If( this.uniforms.curlEnabled.equal( uint(1) ), () => {
                const p0 = particlePosition.mul( this.uniforms.curlScale ).toConst();
                const eps = float(0.75).toConst();
                const dx = vec3(eps,0,0).toConst();
                const dy = vec3(0,eps,0).toConst();
                const dz = vec3(0,0,eps).toConst();
                const F_y1 = triNoise3Dvec( p0.add( dy ), time, this.uniforms.curlTime ).toConst();
                const F_y0 = triNoise3Dvec( p0.sub( dy ), time, this.uniforms.curlTime ).toConst();
                const F_z1 = triNoise3Dvec( p0.add( dz ), time, this.uniforms.curlTime ).toConst();
                const F_z0 = triNoise3Dvec( p0.sub( dz ), time, this.uniforms.curlTime ).toConst();
                const F_x1 = triNoise3Dvec( p0.add( dx ), time, this.uniforms.curlTime ).toConst();
                const F_x0 = triNoise3Dvec( p0.sub( dx ), time, this.uniforms.curlTime ).toConst();
                const half = float(0.5).toConst();
                const dFz_dy = F_y1.z.sub( F_y0.z ).mul( half.div(eps) );
                const dFy_dz = F_z1.y.sub( F_z0.y ).mul( half.div(eps) );
                const dFx_dz = F_z1.x.sub( F_z0.x ).mul( half.div(eps) );
                const dFz_dx = F_x1.z.sub( F_x0.z ).mul( half.div(eps) );
                const dFy_dx = F_x1.y.sub( F_x0.y ).mul( half.div(eps) );
                const dFx_dy = F_y1.x.sub( F_y0.x ).mul( half.div(eps) );
                const curl = vec3( dFz_dy.sub( dFy_dz ), dFx_dz.sub( dFz_dx ), dFy_dx.sub( dFx_dy ) );
                const amp = this.uniforms.curlStrength.mul( this.uniforms.audioLevel.mul(0.5).add(0.5) );
                particleVelocity.addAssign( curl.mul( amp ).mul( this.uniforms.dt ) );
            });

            // Jet field: directional impulse within radius
            If( this.uniforms.jetEnabled.equal( uint(1) ), () => {
                const jp = this.uniforms.jetPos;
                const jd = this.uniforms.jetDir.normalize();
                const jr = this.uniforms.jetRadius;
                const d = particlePosition.sub( jp );
                const w = float(1.0).sub( d.length().div( jr.add(0.0001) ) ).max(0.0).pow(2.0);
                particleVelocity.addAssign( jd.mul( this.uniforms.jetStrength ).mul( w ).mul( this.uniforms.dt ) );
            });

            // Vortex field: tangential swirl around center in XY plane
            If( this.uniforms.vortexEnabled.equal( uint(1) ), () => {
                const c = vec3(this.uniforms.vortexCenter.x, this.uniforms.vortexCenter.y, particlePosition.z);
                const d = particlePosition.sub( c );
                const r = d.xy.length();
                const tangent = vec3( -d.y, d.x, 0 ).normalize();
                const w = float(1.0).sub( r.div( this.uniforms.vortexRadius.add(0.0001) ) ).max(0.0).pow(2.0);
                particleVelocity.addAssign( tangent.mul( this.uniforms.vortexStrength ).mul( w ).mul( this.uniforms.dt ) );
            });

            // Audio-reactive impulses (soft):
            // - Bass: radial pulse from center
            // - Mid: gentle swirl
            // - Treble: vertical jitter
            const center = vec3(this.uniforms.gridSize).sub(1).mul(0.5).toConst();
            const toCenter = particlePosition.sub(center).toConst();
            const dirOut = toCenter.normalize().toConst();
            const tangentA = vec3(-toCenter.y, toCenter.x, 0.0).normalize().toConst();
            const bassKick = dirOut.mul(this.uniforms.audioBass.mul(0.45)).mul(this.uniforms.dt);
            const midSwirl = tangentA.mul(this.uniforms.audioMid.mul(0.35)).mul(this.uniforms.dt);
            const trebJit = vec3(0,0,1).mul(this.uniforms.audioTreble.mul(0.25)).mul(this.uniforms.dt);
            particleVelocity.addAssign(bassKick.add(midSwirl).add(trebJit));

            // Orbit swirl around axis with radial falloff
            If( this.uniforms.orbitEnabled.equal( uint(1) ), () => {
                const center = vec3(this.uniforms.gridSize).sub(1).mul(0.5).toConst();
                const r = particlePosition.sub( center );
                const axis = this.uniforms.orbitAxis.normalize();
                const tang = axis.cross( r ).normalize();
                const phase = this.uniforms.audioTempoPhase.mul(6.28318530718).sin().mul(0.2).add(1.0); // 1 ± 0.2
                const w = float(1.0).sub( r.length().div( this.uniforms.orbitRadius.mul(phase).add(0.0001) ) ).max(0.0).pow(2.0);
                const gain = this.uniforms.orbitStrength.mul( w ).mul( this.uniforms.audioMid.mul(0.5).add(0.5) );
                particleVelocity.addAssign( tang.mul( gain ).mul( this.uniforms.dt ) );
            });

            // Standing wave along axis
            If( this.uniforms.waveEnabled.equal( uint(1) ), () => {
                const axisId = this.uniforms.waveAxis;
                const a = vec3(1,0,0).toVar();
                If( axisId.equal(uint(1)), () => { a.assign(vec3(0,1,0)); })
                .ElseIf( axisId.equal(uint(2)), () => { a.assign(vec3(0,0,1)); });
                const ortho = select( a.cross( vec3(0,1,0) ).length().greaterThan(0.01), a.cross(vec3(0,1,0)), a.cross(vec3(1,0,0)) ).normalize();
                const posAxis = a.x.mul(particlePosition.x).add( a.y.mul(particlePosition.y) ).add( a.z.mul(particlePosition.z) );
                const tempoScale = this.uniforms.audioTempoBpm.mul(0.0167).clamp(0.5, 3.0); // ~ bpm/60 in [0.5..3]
                const phase = posAxis.mul( this.uniforms.waveScale ).add( time.mul( this.uniforms.waveSpeed.mul(tempoScale) ) );
                const s = phase.sin();
                const amp = this.uniforms.waveAmplitude.mul( this.uniforms.audioBeat.mul(0.5).add(0.5) );
                particleVelocity.addAssign( ortho.mul( s.mul( amp ).mul( this.uniforms.dt ) ) );
            });

            const cellIndex =  ivec3(particlePosition).sub(1).toConst("cellIndex");
            const cellDiff = particlePosition.fract().sub(0.5).toConst("cellDiff");

            const w0 = float(0.5).mul(float(0.5).sub(cellDiff)).mul(float(0.5).sub(cellDiff));
            const w1 = float(0.75).sub(cellDiff.mul(cellDiff));
            const w2 = float(0.5).mul(float(0.5).add(cellDiff)).mul(float(0.5).add(cellDiff));
            const weights = array([w0,w1,w2]).toConst("weights");

            const B = mat3(0).toVar("B");
            Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({gx}) => {
                Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({gy}) => {
                    Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({gz}) => {
                        const weight = weights.element(gx).x.mul(weights.element(gy).y).mul(weights.element(gz).z);
                        const cellX = cellIndex.add(ivec3(gx,gy,gz)).toConst();
                        const cellDist = vec3(cellX).add(0.5).sub(particlePosition).toConst("cellDist");
                        const cellPtr = getCellPtr(cellX);

                        const weightedVelocity = this.cellBufferF.element(cellPtr).xyz.mul(weight).toConst("weightedVelocity");
                        const term = mat3(
                            weightedVelocity.mul(cellDist.x),
                            weightedVelocity.mul(cellDist.y),
                            weightedVelocity.mul(cellDist.z)
                        );
                        B.addAssign(term);
                        particleVelocity.addAssign(weightedVelocity);
                    });
                });
            });

            // Vorticity (approx curl of grid velocity at center cell)
            If( this.uniforms.vorticityEnabled.equal( uint(1) ), () => {
                const ci = ivec3(particlePosition).toConst();
                const vxp = this.cellBufferF.element( getCellPtr( ci.add( ivec3(1,0,0) ) ) ).xyz;
                const vxm = this.cellBufferF.element( getCellPtr( ci.add( ivec3(-1,0,0) ) ) ).xyz;
                const vyp = this.cellBufferF.element( getCellPtr( ci.add( ivec3(0,1,0) ) ) ).xyz;
                const vym = this.cellBufferF.element( getCellPtr( ci.add( ivec3(0,-1,0) ) ) ).xyz;
                const vzp = this.cellBufferF.element( getCellPtr( ci.add( ivec3(0,0,1) ) ) ).xyz;
                const vzm = this.cellBufferF.element( getCellPtr( ci.add( ivec3(0,0,-1) ) ) ).xyz;
                const half = float(0.5).toConst();
                const dvz_dy = vzp.z; // placeholder init
                // Compute curl components via central differences
                const c0 = (vyp.z.sub(vym.z)).mul(half).sub( (vzp.y.sub(vzm.y)).mul(half) );
                const c1 = (vzp.x.sub(vzm.x)).mul(half).sub( (vxp.z.sub(vxm.z)).mul(half) );
                const c2 = (vxp.y.sub(vxm.y)).mul(half).sub( (vyp.x.sub(vym.x)).mul(half) );
                const curl = vec3(c0, c1, c2);
                particleVelocity.addAssign( curl.mul( this.uniforms.vorticityEps ).mul( this.uniforms.dt ) );
            });

            // XSPH-like velocity smoothing on grid neighborhood
            If( this.uniforms.xsphEnabled.equal( uint(1) ), () => {
                const ci2 = ivec3(particlePosition).toConst();
                const vxp2 = this.cellBufferF.element( getCellPtr( ci2.add( ivec3(1,0,0) ) ) ).xyz;
                const vxm2 = this.cellBufferF.element( getCellPtr( ci2.add( ivec3(-1,0,0) ) ) ).xyz;
                const vyp2 = this.cellBufferF.element( getCellPtr( ci2.add( ivec3(0,1,0) ) ) ).xyz;
                const vym2 = this.cellBufferF.element( getCellPtr( ci2.add( ivec3(0,-1,0) ) ) ).xyz;
                const vzp2 = this.cellBufferF.element( getCellPtr( ci2.add( ivec3(0,0,1) ) ) ).xyz;
                const vzm2 = this.cellBufferF.element( getCellPtr( ci2.add( ivec3(0,0,-1) ) ) ).xyz;
                const avg = vxp2.add(vxm2).add(vyp2).add(vym2).add(vzp2).add(vzm2).mul( float(1.0/6.0) );
                const dv = avg.sub( particleVelocity );
                particleVelocity.addAssign( dv.mul( this.uniforms.xsphEps ).mul( this.uniforms.dt ) );
            });

            const dist = cross(this.uniforms.mouseRayDirection, particlePosition.mul(vec3(1,1,this.uniforms.zScale)).sub(this.uniforms.mouseRayOrigin)).length()
            const force = dist.mul(0.1).oneMinus().max(0.0).pow(2);
            particleVelocity.addAssign(this.uniforms.mouseForce.mul(1).mul(force));
            particleVelocity.mulAssign(particleMass); // to ensure difference between particles

            this.particleBuffer.element(instanceIndex).get('C').assign(B.mul(4));
            particlePosition.addAssign(particleVelocity.mul(this.uniforms.dt));
        // Keep positions inside grid: wrap when disabled-wrap, clamp for others (bounce handled earlier)
        If( this.uniforms.sdfSphere.equal( uint(3) ), () => {
            const lo = vec3(2).toConst('lo');
            const hi = vec3(this.uniforms.gridSize).sub(2).toConst('hi');
            const size = hi.sub(lo).toConst('size');
            const pWrapped = particlePosition.sub(lo).div(size).fract().mul(size).add(lo);
            particlePosition.assign(pWrapped);
        }).Else(() => {
            particlePosition.assign(clamp(particlePosition, vec3(2), this.uniforms.gridSize.sub(2)));
        });

            // Box wall collisions (disabled when SDF is active)
            If( this.uniforms.sdfSphere.equal( uint(0) ), () => {
                const xN = particlePosition.add(particleVelocity.mul(this.uniforms.dt).mul(2.0)).toConst("xN");
                const wallMin = vec3(3).toConst("wallMin");
                const wallMax = vec3(this.uniforms.gridSize).sub(3).toConst("wallMax");
                const rest = this.uniforms.collisionRestitution;
                const fric = this.uniforms.collisionFriction;

                const reflectAxis = (n) => {
                    const vn = particleVelocity.dot( n );
                    If( vn.lessThan( 0.0 ), () => {
                        const v_n = n.mul( vn );
                        const v_t = particleVelocity.sub( v_n );
                        const vt_d = v_t.mul( float(1.0).sub(fric) );
                        const vr = v_n.mul( rest );
                        particleVelocity.assign( vt_d.sub( vr ) );
                    });
                };

                If(xN.x.lessThan(wallMin.x), () => { reflectAxis( vec3(1,0,0) ); });
                If(xN.x.greaterThan(wallMax.x), () => { reflectAxis( vec3(-1,0,0) ); });
                If(xN.y.lessThan(wallMin.y), () => { reflectAxis( vec3(0,1,0) ); });
                If(xN.y.greaterThan(wallMax.y), () => { reflectAxis( vec3(0,-1,0) ); });
                If(xN.z.lessThan(wallMin.z), () => { reflectAxis( vec3(0,0,1) ); });
                If(xN.z.greaterThan(wallMax.z), () => { reflectAxis( vec3(0,0,-1) ); });
            });

            // SDF sphere collision
            If( this.uniforms.sdfSphere.equal( uint(1) ), () => {
                const p = particlePosition.toVar();
                const c = this.uniforms.sdfCenter;
                const r = this.uniforms.sdfRadius;
                const dir = p.sub( c );
                const d = dir.length();
                const pen = r.sub( d );
                If( pen.greaterThan( 0.0 ), () => {
                    const n = dir.div( d.max(0.0001) );
                    particlePosition.addAssign( n.mul( pen ) );
                    const vn = particleVelocity.dot( n );
                    const v_n = n.mul( vn );
                    const v_t = particleVelocity.sub( v_n );
                    const vt_d = v_t.mul( float(1.0).sub(this.uniforms.collisionFriction) );
                    const vr = v_n.mul( this.uniforms.collisionRestitution );
                    If( vn.lessThan( 0.0 ), () => {
                        particleVelocity.assign( vt_d.sub( vr ) );
                    });
                });
            })
            // Dodecahedron collision using 12 plane normals (icosahedron vertices)
            .ElseIf( this.uniforms.sdfSphere.equal( uint(2) ), () => {
                const A = float(0.5257311121191336);
                const B = float(0.85065080835204);
                const normals = array([
                    vec3(0, A, B), vec3(0, -A, B), vec3(0, A, -B), vec3(0, -A, -B),
                    vec3(A, B, 0), vec3(-A, B, 0), vec3(A, -B, 0), vec3(-A, -B, 0),
                    vec3(B, 0, A), vec3(-B, 0, A), vec3(B, 0, -A), vec3(-B, 0, -A)
                ]).toConst();

                const c = this.uniforms.sdfCenter;
                const r = this.uniforms.sdfRadius;
                const q = particlePosition.sub( c ).toVar();
                const maxD = float(-1e9).toVar("maxD");
                const nMax = vec3(0).toVar("nMax");

                Loop({ start: 0, end: 12, type: 'int', name: 'i', condition: '<' }, ({ i }) => {
                    const n = normals.element(i).xyz.toConst();
                    const d = q.dot( n ).sub( r );
                    If( d.greaterThan( maxD ), () => { maxD.assign( d ); nMax.assign( n ); });
                });

                If( maxD.greaterThan( 0.0 ), () => {
                    particlePosition.subAssign( nMax.mul( maxD ) );
                    const vn = particleVelocity.dot( nMax );
                    const v_n = nMax.mul( vn );
                    const v_t = particleVelocity.sub( v_n );
                    const vt_d = v_t.mul( float(1.0).sub(this.uniforms.collisionFriction) );
                    const vr = v_n.mul( this.uniforms.collisionRestitution );
                    If( vn.lessThan( 0.0 ), () => {
                        particleVelocity.assign( vt_d.sub( vr ) );
                    });
                });
            });

            // Velocity clamp (stability guard)
            const vmax = this.uniforms.maxVelocity;
            const vlen = particleVelocity.length();
            If( vlen.greaterThan( vmax ), () => {
                particleVelocity.assign( particleVelocity.div( vlen.add(1e-6) ).mul( vmax ) );
            });

            this.particleBuffer.element(instanceIndex).get('position').assign(particlePosition)
            this.particleBuffer.element(instanceIndex).get('velocity').assign(particleVelocity)

            const direction = this.particleBuffer.element(instanceIndex).get('direction');
            direction.assign(mix(direction,particleVelocity, 0.1));

            const satBoost = this.uniforms.audioLevel.mul(0.35);
            const briBoost = this.uniforms.audioBeat.mul(0.35).add(force.mul(0.3));
            const hueFluid = particleDensity.div(this.uniforms.restDensity).mul(0.25).add(time.mul(0.05));
            const satFluid = particleVelocity.length().mul(0.5).clamp(0,1).mul(0.3).add(0.7).add(satBoost).clamp(0,1);
            const valFluid = briBoost.add(0.6).clamp(0,1);
            const colFluid = hsvtorgb(vec3(hueFluid, satFluid, valFluid));

            // Audio color: hue from bass→treble mix, sat from level, val from beat
            const hueAudio = this.uniforms.audioBass.mul(0.08).add(this.uniforms.audioMid.mul(0.33)).add(this.uniforms.audioTreble.mul(0.66)).clamp(0,1);
            const colAudio = hsvtorgb( vec3( hueAudio.add(time.mul(0.03)).fract(), this.uniforms.audioLevel.clamp(0.2,1.0), this.uniforms.audioBeat.mul(0.5).add(0.5).clamp(0,1) ) );

            // Velocity color: blue→red by speed
            const speed = particleVelocity.length().clamp(0,1);
            const colVel = vec3(speed, speed.mul(0.5), speed.oneMinus());

            // Select by colorMode: 0 fluid, 1 audio, 2 velocity
            let finalColor = colFluid.toVar();
            If( this.uniforms.colorMode.equal( uint(1) ), () => { finalColor.assign( colAudio ); })
            .ElseIf( this.uniforms.colorMode.equal( uint(2) ), () => { finalColor.assign( colVel ); });

            this.particleBuffer.element(instanceIndex).get('color').assign(finalColor);
        })().compute(1);
    }

    // Receive mouse ray already transformed to simulation-projected space
    // (grid coordinates with z implicitly scaled in world mapping).
    setMouseRay(originProjected, directionWorld, posProjected) {
        this.uniforms.mouseRayDirection.value.copy(directionWorld.normalize());
        this.uniforms.mouseRayOrigin.value.copy(originProjected);
        this.mousePos.copy(posProjected);
    }

    async update(interval, elapsed) {
        const { particles, run, noise, dynamicViscosity, stiffness, restDensity, speed, gravity, gravitySensorReading, accelerometerReading, substeps, apicBlend, sdfSphere, sdfRadius, sdfCenterZ, boundaryShape, boundariesEnabled,
            jetEnabled, jetStrength, jetRadius, jetPos, jetDir,
            vortexEnabled, vortexStrength, vortexRadius, vortexCenter,
            curlEnabled, curlStrength, curlScale, curlTime,
            orbitEnabled, orbitStrength, orbitRadius, orbitAxis,
            waveEnabled, waveAmplitude, waveScale, waveSpeed, waveAxis
        } = conf;

        this.uniforms.noise.value = noise;
        this.uniforms.stiffness.value = stiffness;
        this.uniforms.gravityType.value = gravity;
        if (gravity === 0) {
            this.uniforms.gravity.value.set(0,0,0.2);
        } else if (gravity === 1) {
            this.uniforms.gravity.value.set(0,-0.2,0);
        } else if (gravity === 3) {
            this.uniforms.gravity.value.copy(gravitySensorReading).add(accelerometerReading);
        }
        this.uniforms.dynamicViscosity.value = dynamicViscosity;
        this.uniforms.restDensity.value = restDensity;
        this.uniforms.apicBlend.value = apicBlend;
        this.uniforms.maxVelocity.value = conf.physMaxVelocity || 2.5;
        this.uniforms.zScale.value = conf.zScale || 0.4;
        // Fields
        this.uniforms.jetEnabled.value = jetEnabled ? 1 : 0;
        this.uniforms.jetStrength.value = jetStrength;
        this.uniforms.jetRadius.value = jetRadius;
        this.uniforms.jetPos.value.set(jetPos.x, jetPos.y, jetPos.z);
        this.uniforms.jetDir.value.set(jetDir.x, jetDir.y, jetDir.z);

        this.uniforms.vortexEnabled.value = vortexEnabled ? 1 : 0;
        this.uniforms.vortexStrength.value = vortexStrength;
        this.uniforms.vortexRadius.value = vortexRadius;
        this.uniforms.vortexCenter.value.set(vortexCenter.x, vortexCenter.y);
        // Curl noise
        this.uniforms.curlEnabled.value = curlEnabled ? 1 : 0;
        this.uniforms.curlStrength.value = curlStrength;
        this.uniforms.curlScale.value = curlScale;
        this.uniforms.curlTime.value = curlTime;
        // Orbit
        this.uniforms.orbitEnabled.value = orbitEnabled ? 1 : 0;
        this.uniforms.orbitStrength.value = orbitStrength;
        this.uniforms.orbitRadius.value = orbitRadius;
        const ax = (orbitAxis === 'x') ? new THREE.Vector3(1,0,0) : (orbitAxis === 'y') ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
        this.uniforms.orbitAxis.value.copy(ax);
        // Wave
        this.uniforms.waveEnabled.value = waveEnabled ? 1 : 0;
        this.uniforms.waveAmplitude.value = waveAmplitude;
        this.uniforms.waveScale.value = waveScale;
        this.uniforms.waveSpeed.value = waveSpeed;
        const wavAxisId = (waveAxis === 'x') ? 0 : (waveAxis === 'y') ? 1 : 2;
        this.uniforms.waveAxis.value = wavAxisId >>> 0;
        // Collision material
        this.uniforms.collisionRestitution.value = conf.collisionRestitution || 0.6;
        this.uniforms.collisionFriction.value = conf.collisionFriction || 0.2;
        // Audio uniforms
        this.uniforms.audioLevel.value = conf._audioLevel || 0.0;
        this.uniforms.audioBeat.value = conf._audioBeat || 0.0;
        this.uniforms.audioBass.value = conf._audioBass || 0.0;
        this.uniforms.audioMid.value = conf._audioMid || 0.0;
        this.uniforms.audioTreble.value = conf._audioTreble || 0.0;
        this.uniforms.audioTempoPhase.value = conf._audioTempoPhase || 0.0;
        this.uniforms.audioTempoBpm.value = conf._audioTempoBpm || 0.0;
        // Color mode uniform
        const cm = (conf.colorMode === 'audio') ? 1 : (conf.colorMode === 'velocity') ? 2 : 0;
        this.uniforms.colorMode.value = cm >>> 0;
        // Shaping
        this.uniforms.vorticityEnabled.value = conf.vorticityEnabled ? 1 : 0;
        this.uniforms.vorticityEps.value = conf.vorticityEps;
        this.uniforms.xsphEnabled.value = conf.xsphEnabled ? 1 : 0;
        this.uniforms.xsphEps.value = conf.xsphEps;
        let sdfMode = 0;
        if (!boundariesEnabled) {
            sdfMode = 3; // disabled
        } else if (boundaryShape === 'dodeca') {
            sdfMode = 2; // plane-based dodecahedron
        } else if (sdfSphere) {
            sdfMode = 1; // sphere
        }
        this.uniforms.sdfSphere.value = sdfMode >>> 0;
        this.uniforms.sdfRadius.value = sdfRadius;
        this.uniforms.sdfCenter.value.set( this.uniforms.gridSize.value.x * 0.5, this.uniforms.gridSize.value.y * 0.5, sdfCenterZ );

        if (particles !== this.numParticles) {
            this.numParticles = particles;
            this.uniforms.numParticles.value = particles;
            if (this.kernels.p2g1.setCount) this.kernels.p2g1.setCount(particles); else this.kernels.p2g1.count = particles;
            if (this.kernels.p2g2.setCount) this.kernels.p2g2.setCount(particles); else this.kernels.p2g2.count = particles;
            if (this.kernels.g2p.setCount) this.kernels.g2p.setCount(particles); else this.kernels.g2p.count = particles;
        }

        interval = Math.min(interval, 1/60);
        const steps = Math.max(1, Math.floor(substeps || 1));
        let dt = (interval * 6 * speed) / steps;
        // Apply simple dt clamp via maxVelocity and cflSafety
        const cflSafety = conf.cflSafety || 0.5;
        const vmax = this.uniforms.maxVelocity.value || 2.5;
        const dtMax = Math.max(0.001, cflSafety / Math.max(0.001, vmax));
        dt = Math.min(dt, dtMax);
        this.uniforms.dt.value = dt;

        this.mousePosArray.push(this.mousePos.clone())
        if (this.mousePosArray.length > 3) { this.mousePosArray.shift(); }
        if (this.mousePosArray.length > 1) {
            this.uniforms.mouseForce.value.copy(this.mousePosArray[this.mousePosArray.length - 1]).sub(this.mousePosArray[0]).divideScalar(this.mousePosArray.length);
        }


        if (run) {
            for (let i = 0; i < steps; i++) {
                const kernels = [this.kernels.clearGrid, this.kernels.p2g1, this.kernels.p2g2, this.kernels.updateGrid, this.kernels.g2p];
                await this.renderer.computeAsync(kernels);
            }
        }
    }
}

export default mlsMpmSimulator;


