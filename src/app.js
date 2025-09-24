import * as THREE from "three/webgpu";
import { conf } from "./conf";
import { Info } from "./info";
import MlsMpmSimulator from "./mls-mpm/mlsMpmSimulator";
import ParticleRenderer from "./mls-mpm/particleRenderer";
import GlyphRenderer from "./mls-mpm/glyphRenderer";
import BackgroundGeometry from "./backgroundGeometry";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import PointRenderer from "./mls-mpm/pointRenderer.js";
import Stage from "./stage";
import AudioEngine from "./audio/audioEngine";
import AudioRouter from "./audio/router";
import AudioPanel from "./ui/audioPanel";
import CinematicPipeline from "./post/CinematicPipeline.js";

function clamp(x, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, x)); }

const AUDIO_BANDS = ['sub','bass','lowMid','mid','hiMid','presence','brilliance','air'];

class App {
  constructor(renderer) {
    this.renderer = renderer;
    this.stage = null;
    this.audio = null;
    this.router = null;
    this.audioPanel = null;
    this.postFX = null;
    this.raycaster = new THREE.Raycaster();
    this._envBase = { bg: 0, env: 0 };
    this._camDollyOffsetVec = new THREE.Vector3();
    this._camBaseRoll = undefined;
    this._audioConfigSignature = null;
    this._audioStarted = false;
    this._prevCamPos = null;
    this._perf = { t: 0, frames: 0, fps: 60, lastAdjust: 0 };
    this._q = null;
  }

  _applyAudioConfig(force = false) {
    if (!this.audio || !this.router) return;
    const signature = [
      conf.audioAttack, conf.audioRelease, conf.audioBandAttack, conf.audioBandRelease,
      conf.audioTransientSensitivity, conf.audioTransientDecay,
      conf.audioMasterInfluence, conf.audioIntensity, conf.audioReactivity,
    ].map((v) => String(v ?? 'null')).join('|');
    if (!force && signature === this._audioConfigSignature) return;
    this._audioConfigSignature = signature;
    this.audio.setSmoothing(conf.audioAttack ?? 0.5, conf.audioRelease ?? 0.2);
    const bandMap = {};
    const bandAttack = conf.audioBandAttack ?? 0.55;
    const bandRelease = conf.audioBandRelease ?? 0.22;
    AUDIO_BANDS.forEach((band) => {
      bandMap[band] = { attack: bandAttack, release: bandRelease };
      bandMap[`transient:${band}`] = {
        attack: Math.min(0.95, bandAttack + 0.2),
        release: Math.min(0.95, bandRelease + 0.15),
      };
    });
    this.audio.setFeatureSmoothing(bandMap);
    this.audio.setTransientSensitivity(conf.audioTransientSensitivity ?? 1.0);
    this.audio.setTransientDecay(conf.audioTransientDecay ?? 0.4);
    this.router.setMasterInfluence?.(conf.audioMasterInfluence ?? 1.0);
    this.router.setIntensity?.(conf.audioIntensity ?? 1.0);
    this.router.setReactivity?.(conf.audioReactivity ?? 1.0);
  }

  async init(progressCallback) {
    this.info = new Info();
    conf.init();

    this.stage = new Stage(this.renderer);
    await this.stage.init(progressCallback);
    this._envBase = { bg: conf.bgRotY, env: conf.envRotY };

    if (progressCallback) await progressCallback(0.5);

    // Simulation + renderers
    this.mlsMpmSim = new MlsMpmSimulator(this.renderer);
    await this.mlsMpmSim.init();
    this.particleRenderer = new ParticleRenderer(this.mlsMpmSim);
    this.stage.scene.add(this.particleRenderer.object);
    this.pointRenderer = new PointRenderer(this.mlsMpmSim);
    this.stage.scene.add(this.pointRenderer.object);
    this.glyphRenderer = new GlyphRenderer(this.mlsMpmSim);
    this.stage.scene.add(this.glyphRenderer.object);

    // Background & collision boundary
    const backgroundGeometry = new BackgroundGeometry();
    await backgroundGeometry.init();
    this.stage.scene.add(backgroundGeometry.object);
    this.boundary = backgroundGeometry;

    const updateGlass = () => {
      backgroundGeometry.setGlassParams({
        ior: conf.glassIor,
        thickness: conf.glassThickness,
        roughness: conf.glassRoughness,
        dispersion: conf.glassDispersion,
        attenuationDistance: conf.glassAttenuationDistance,
        attenuationColor: conf.glassAttenuationColor,
      });
    };
    updateGlass();
    this._glassSync = setInterval(updateGlass, 150);

    const updateShape = () => {
      if (this.boundary && this.boundary.object) this.boundary.object.visible = !!conf.boundariesEnabled;
      backgroundGeometry.setShape(conf.boundaryShape);
      // Simulator derives exact SDF from conf in its update()
    };
    updateShape();
    this._shapeSync = setInterval(updateShape, 200);

    // Upload boundary model hook
    conf.registerBoundaryUpload(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.obj,.glb,.gltf,.fbx,.ply,.stl';
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          let newMesh = null;
          if (ext === 'obj') {
            const text = await file.text();
            const OBJ = (await import('three/examples/jsm/loaders/OBJLoader.js')).OBJLoader;
            const obj = new OBJ().parse(text);
            const geo = BufferGeometryUtils.mergeVertices(obj.children[0].geometry);
            newMesh = new THREE.Mesh(geo, this.boundary.glass.material);
          } else if (ext === 'gltf' || ext === 'glb') {
            const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
            const loader = new GLTFLoader();
            const arrayBuffer = await file.arrayBuffer();
            const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
            const mesh = gltf.scene.getObjectByProperty('type', 'Mesh') || gltf.scene.children.find(c => c.isMesh);
            const geo = mesh.geometry;
            newMesh = new THREE.Mesh(geo, this.boundary.glass.material);
          } else if (ext === 'ply') {
            const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
            const loader = new PLYLoader();
            const arrayBuffer = await file.arrayBuffer();
            const geometry = loader.parse(arrayBuffer);
            geometry.computeVertexNormals();
            const geo = BufferGeometryUtils.mergeVertices(geometry);
            newMesh = new THREE.Mesh(geo, this.boundary.glass.material);
          } else if (ext === 'stl') {
            const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
            const loader = new STLLoader();
            const arrayBuffer = await file.arrayBuffer();
            const geometry = loader.parse(arrayBuffer);
            geometry.computeVertexNormals();
            const geo = BufferGeometryUtils.mergeVertices(geometry);
            newMesh = new THREE.Mesh(geo, this.boundary.glass.material);
          } else {
            alert('Unsupported file type');
            return;
          }
          if (newMesh) {
            if (this.boundary.glass.parent) this.boundary.glass.parent.remove(this.boundary.glass);
            newMesh.castShadow = true;
            newMesh.receiveShadow = true;
            this.boundary.glass = newMesh;
            this.boundary.object.add(newMesh);
            updateGlass();
            conf.boundaryShape = 'sphere';
            updateShape();
          }
        } catch (e) {
          console.error(e);
        }
      };
      input.click();
    });

    // Audio engine + router + dedicated panel
    this.audio = new AudioEngine();
    this.router = new AudioRouter();
    if (conf.registerRouter) conf.registerRouter(this.router);
    this.audioPanel = new AudioPanel(this.audio, conf, this.router);
    this.audioPanel.init('bottom-left');
    // Make audio panel draggable like postfx (panel implements its own container; add simple header drag)
    try {
      const el = this.audioPanel.gui?.element?.parentElement || null;
      if (el) {
        const header = el.querySelector('.tp-lblv_l');
        let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
        const onDown = (e) => { dragging = true; sx = e.clientX; sy = e.clientY; const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); };
        const onMove = (e) => { if (!dragging) return; const dx = e.clientX - sx, dy = e.clientY - sy; el.style.left = Math.max(0, Math.min(window.innerWidth - 40, ox + dx)) + 'px'; el.style.top = Math.max(0, Math.min(window.innerHeight - 40, oy + dy)) + 'px'; el.style.right = ''; el.style.position = 'absolute'; };
        const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        if (header) { header.style.cursor = 'move'; header.addEventListener('mousedown', onDown); }
      }
    } catch {}
    this._applyAudioConfig(true);

    // Post FX
    this.postFX = new CinematicPipeline(this.renderer);
    await this.postFX.init(this.stage);

    // Pointer interactions
    this.renderer.domElement.addEventListener("pointermove", (event) => this.onMouseMove(event));
    this.renderer.domElement.addEventListener("pointerdown", (event) => {
      const pointer = new THREE.Vector2();
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
      const camera = this.stage.camera;
      this.raycaster.setFromCamera(pointer, camera);
      const centerWorld = new THREE.Vector3(0, 0, 0);
      const normal = new THREE.Vector3();
      camera.getWorldDirection(normal);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, centerWorld);
      const intersect = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(plane, intersect);
      if (intersect && (conf.lensFxEnabled ?? conf.cameraFxEnabled ?? conf.dofEnabled ?? true) && this.postFX) {
        const camSpace = intersect.clone().applyMatrix4(camera.matrixWorldInverse);
        const viewDist = Math.abs(camSpace.z);
        this.postFX.pointerFocus(viewDist, conf.lensFocusSmoothing ?? conf.focusSmooth ?? conf.focusSmoothing ?? 0.2);
      }
    });

    // Register center focus action
    conf.__onLensCenterFocus = () => {
      const camera = this.stage.camera;
      const centerWorld = new THREE.Vector3(0, 0, 0);
      const normal = new THREE.Vector3();
      camera.getWorldDirection(normal);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, centerWorld);
      const intersect = new THREE.Vector3();
      const ray = new THREE.Ray(camera.position.clone(), normal.clone());
      ray.intersectPlane(plane, intersect);
      if (!intersect || !this.postFX) return;
      const camSpace = intersect.clone().applyMatrix4(camera.matrixWorldInverse);
      const viewDist = Math.abs(camSpace.z);
      this.postFX.pointerFocus(viewDist, 0.0);
    };

    if (progressCallback) await progressCallback(1.0, 100);
  }

  resize(width, height) {
    this.stage.resize(width, height);
    if (this.postFX) this.postFX.resize(width, height);
  }

  onMouseMove(event) {
    const pointer = new THREE.Vector2();
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    const camera = this.stage.camera;
    this.raycaster.setFromCamera(pointer, camera);

    const s = (1/64) * (conf.worldScale || 1);
    const zScale = conf.zScale || 0.4;
    const centerWorld = new THREE.Vector3(0, 0, 0);
    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, centerWorld);
    const intersect = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, intersect);
    if (!intersect) return;

    const worldToSimProjected = (v) => {
      const out = v.clone().divideScalar(s);
      out.z /= zScale;
      out.add(new THREE.Vector3(32,32,32));
      return out;
    };
    const originSim = worldToSimProjected(this.raycaster.ray.origin);
    const posSim = worldToSimProjected(intersect);
    const dirSim = this.raycaster.ray.direction.clone();
    dirSim.divideScalar(s); dirSim.z /= zScale; dirSim.normalize();
    this.mlsMpmSim.setMouseRay(originSim, dirSim, posSim);

    const focusMode = conf.focusMode ?? conf.lensFocusMode ?? (conf.dofAutoFocus ? 'pointer' : 'manual');
    const cameraFxActive = ((conf.lensFxEnabled ?? conf.cameraFxEnabled ?? conf.dofEnabled ?? true)) && focusMode === 'pointer' && (conf.postFxEnabled ?? true);
    if (cameraFxActive && this.postFX) {
      const camSpace = intersect.clone().applyMatrix4(camera.matrixWorldInverse);
      const viewDist = Math.abs(camSpace.z);
      this.postFX.pointerFocus(viewDist, conf.lensFocusSmoothing ?? conf.focusSmooth ?? conf.focusSmoothing ?? 0.2);
    }
  }

  async update(delta, elapsed) {
    conf.begin();

    // Toggle renderers based on mode
    const mode = conf.renderMode || 'surface';
    if (this.particleRenderer) this.particleRenderer.object.visible = (mode === 'surface');
    if (this.pointRenderer) this.pointRenderer.object.visible = (mode === 'points');
    if (this.glyphRenderer) this.glyphRenderer.object.visible = (mode === 'glyphs');

    this.stage.update(delta, elapsed);

    // Audio reactive camera micro-motion
    if (conf.camReactiveEnabled) {
      const camera = this.stage.camera;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const scale = (conf.camDollyMax || 0) * (conf._camDolly || 0);
      const newOffset = dir.multiplyScalar(scale);
      if (this._camDollyOffsetVec && this._camDollyOffsetVec.lengthSq() > 0) {
        camera.position.sub(this._camDollyOffsetVec);
      }
      camera.position.add(newOffset);
      this._camDollyOffsetVec.copy(newOffset);
      if (this._camBaseRoll === undefined) this._camBaseRoll = camera.rotation.z || 0;
      camera.rotation.z = this._camBaseRoll + (conf.camRollMax || 0) * (conf._camRoll || 0);
    } else {
      const camera = this.stage.camera;
      if (this._camDollyOffsetVec && this._camDollyOffsetVec.lengthSq() > 0) {
        camera.position.sub(this._camDollyOffsetVec);
        this._camDollyOffsetVec.set(0,0,0);
      }
      if (this._camBaseRoll === undefined) this._camBaseRoll = camera.rotation.z || 0;
      camera.rotation.z = this._camBaseRoll;
    }

    // Audio update and mapping
    if (conf.audioEnabled) {
      try {
        if (!this._audioStarted) {
          if (conf.audioSource === 'mic') await this.audio.connectMic();
          this._audioStarted = true;
        }
        this._applyAudioConfig();
        const f = this.audio.update(delta);
        const sens = conf.audioSensitivity;
        conf._audioLevel = clamp(f.level * sens, 0.0, 1.0);
        conf._audioBeat = clamp(f.beat * conf.audioBeatBoost, 0.0, 1.0);
        conf._audioBass = clamp(f.bass * conf.audioBassGain * sens, 0.0, 1.0);
        conf._audioMid = clamp(f.mid * conf.audioMidGain * sens, 0.0, 1.0);
        conf._audioTreble = clamp(f.treble * conf.audioTrebleGain * sens, 0.0, 1.0);
        conf._audioTempoPhase = f.tempoPhase01 || 0.0;
        conf._audioTempoBpm = f.tempoBpm || 0.0;

        this.router.apply(f, conf, elapsed, this._envBase);
      } catch (_) { /* ignore */ }
    } else {
      conf._audioLevel = conf._audioBeat = conf._audioBass = conf._audioMid = conf._audioTreble = 0;
      if (this._envBase) { conf.bgRotY = this._envBase.bg; conf.envRotY = this._envBase.env; }
    }

        await this.mlsMpmSim.update(delta, elapsed);

        // Update renderers (instance counts, scaling, per-frame nodes)
        if (this.particleRenderer) this.particleRenderer.update();
        if (this.pointRenderer) this.pointRenderer.update();
        if (this.glyphRenderer) this.glyphRenderer.update();

    if (this.postFX) this.postFX.updateFromConfig(conf);

    if (this.postFX) {
      await this.postFX.renderAsync();
    }

    conf.end();

    // Performance estimator
    this._perf.t += delta;
    this._perf.frames += 1;
    if (this._perf.t >= 0.5) {
      const fps = this._perf.frames / this._perf.t;
      this._perf.fps = this._perf.fps * 0.6 + fps * 0.4;
      this._perf.t = 0;
      this._perf.frames = 0;
    }
    if (conf.autoPerf) {
      const now = performance.now() / 1000;
      if (now - this._perf.lastAdjust > 1.2) {
        if (this._perf.fps < (conf.perfMinFps || 50) && conf.particles > 4096) {
          conf.particles = Math.max(4096, conf.particles - (conf.perfStep || 4096));
          conf.updateParams();
          if (conf.gui) conf.gui.refresh();
          this._perf.lastAdjust = now;
        } else if (this._perf.fps > (conf.perfMaxFps || 58) && conf.particles + (conf.perfStep || 4096) <= conf.maxParticles) {
          conf.particles = Math.min(conf.maxParticles, conf.particles + (conf.perfStep || 4096));
          conf.updateParams();
          if (conf.gui) conf.gui.refresh();
          this._perf.lastAdjust = now;
        }
      }
    }
  }
}
export default App;





