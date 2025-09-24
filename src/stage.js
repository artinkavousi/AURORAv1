import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { conf } from "./conf";
import { Lights } from "./lights";
import hdri from "./assets/autumn_field_puresky_1k.hdr";

const loadHdr = async ( file ) => {
    const texture = await new Promise( resolve => {
        new HDRLoader().load( file, result => {
            result.mapping = THREE.EquirectangularReflectionMapping;
            resolve( result );
        } );
    } );
    return texture;
}

export class Stage {
    renderer = null;
    camera = null;
    scene = null;
    controls = null;
    lights = null;

    constructor( renderer ) {
        this.renderer = renderer;
    }

    async init( progressCallback ) {
        if ( progressCallback ) await progressCallback( 0.05 );

        this.camera = new THREE.PerspectiveCamera( conf.fov, window.innerWidth / window.innerHeight, 0.01, 10 );
        this.camera.position.set( 0, 0, 2.0 );
        this.camera.updateProjectionMatrix();

        this.scene = new THREE.Scene();

        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.target.set( 0, 0, 0 );
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.touches = { TWO: THREE.TOUCH.DOLLY_ROTATE };
        this.controls.minDistance = 0.6;
        this.controls.maxDistance = 6.0;
        this.controls.minPolarAngle = 0.1 * Math.PI;
        this.controls.maxPolarAngle = 0.9 * Math.PI;

        if ( progressCallback ) await progressCallback( 0.1 );

        const hdriTexture = await loadHdr( hdri );
        this.scene.background = hdriTexture;
        this.scene.environment = hdriTexture;

        this.applyEnvironmentParams();

        this.renderer.toneMappingExposure = conf.exposure;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.lights = new Lights();
        this.scene.add( this.lights.object );

        if ( progressCallback ) await progressCallback( 0.2 );
    }

    applyEnvironmentParams() {
        this.scene.backgroundRotation = new THREE.Euler( 0, conf.bgRotY, 0 );
        this.scene.environmentRotation = new THREE.Euler( 0, conf.envRotY, 0 );
        this.scene.environmentIntensity = conf.envIntensity;
    }

    resize( width, height ) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    update( delta, elapsed ) {
        // Live-sync camera and environment parameters from control panel
        if ( Math.abs( this.camera.fov - conf.fov ) > 0.001 ) {
            this.camera.fov = conf.fov;
            this.camera.updateProjectionMatrix();
        }

        this.applyEnvironmentParams();
        this.renderer.toneMappingExposure = conf.exposure;

        this.controls.update( delta );
        if ( this.lights && this.lights.update ) this.lights.update( elapsed );

        // Auto-fit domain to viewport when boundaries are disabled
        if (conf.autoWorldFit && !conf.boundariesEnabled) {
            // distance from camera to target
            const dist = this.camera.position.distanceTo(this.controls.target);
            const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * dist;
            const visH = halfH * 2.0;
            const visW = visH * this.camera.aspect;
            // Domain width/height in world units equals worldScale
            const margin = (conf.fitMargin || 0.98);
            const contain = Math.min(visW, visH) * margin;
            const cover = Math.max(visW, visH) * margin;
            const targetScale = conf.fitMode === 'cover' ? cover : contain;
            // Smooth to avoid pops when resizing
            conf.worldScale = conf.worldScale * 0.82 + targetScale * 0.18;
        }
    }
}

export default Stage;


