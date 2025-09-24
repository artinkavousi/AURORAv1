import {Pane} from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import mobile from "is-mobile";
import * as THREE from "three/webgpu";

class Conf {
    gui = null;
    maxParticles = 8192 * 16;
    particles = 8192 * 4;

    postFxEnabled = true;
    fxView = 'final';

    // Lens FX defaults
    lensFxEnabled = true;
    lensFocusMode = 'pointer';
    lensAutoTune = true;
    lensFocusDistance = 0.8;
    lensFocusRange = 0.12;
    lensBokehAmount = 1.1;
    lensNearBoost = 1.0;
    lensFarBoost = 1.0;
    lensHighlightThreshold = 0.78;
    lensHighlightGain = 0.9;
    lensHighlightSoftness = 0.18;
    lensApertureBlades = 9;
    lensApertureRotation = 0.0;
    lensApertureCurvature = 1.0;
    lensAnamorphic = 0.0;
    lensMaxCoC = 1.4;
    lensBlendCurve = 1.2;
    lensBleed = 0.32;
    lensFocusSmoothing = 0.2;
    lensQuality = 0.85;

    lensPhysicalEnabled = false;
    lensFocalLength = 35.0;
    lensFStop = 1.8;
    lensSensorWidth = 36.0;
    lensSensorHeight = 24.0;
    lensSensorAspect = 36 / 24;
    lensCocLimit = 0.03;
    lensBokehScale = 1.0;
    lensDriveFov = false;

    // Post FX defaults
    fxBloomEnabled = true;
    fxBloomStrength = 0.9;
    fxBloomRadius = 0.65;
    fxBloomThreshold = 0.0012;
    fxBloomMix = 0.4;

    // (legacy bloom fields removed; use fxBloom* keys)

    fxVignetteEnabled = true;
    fxVignetteAmount = 0.2;

    fxGrainEnabled = false;
    fxGrainAmount = 0.08;

    fxChromaticEnabled = false;
    fxChromaticAmount = 0.0015;
    fxChromaticScale = 1.0;
    fxChromaticCenter = { x: 0.5, y: 0.5 };

    fxSaturation = 1.0;
    fxContrast = 1.0;
    fxLift = 0.0;


    // World/domain scaling (visual mapping of 64^3 grid to world units)
    worldScale = 2.0; // scale up domain to fill more of the page by default
    autoWorldFit = true; // dynamically fit domain to viewport
    fitMode = 'cover'; // 'contain' | 'cover'
    fitMargin = 0.995; // fraction of viewport to occupy
    zScale = 0.22; // stronger Z compression default

    // Performance governor
    autoPerf = false;
    perfMinFps = 50;   // degrade below
    perfMaxFps = 58;   // upgrade above
    perfStep = 4096;   // particle step

    // Stage/Camera/Environment controls
    fov = 60;
    exposure = 1.0;
    envIntensity = 1.0;
    bgRotY = 2.15;
    envRotY = -2.15;

    // Glass boundary controls
    boundariesEnabled = false;
    glassIor = 1.5;
    glassThickness = 0.3;
    glassRoughness = 0.02;
    glassDispersion = 0.25;
    glassAttenuationDistance = 2.5;
    glassAttenuationColor = { r: 255, g: 255, b: 255 };
    __onBoundaryUpload = null;
    boundaryShape = 'dodeca'; // 'dodeca' | 'cube' | 'sphere'
    collisionShrink = 0.98;
    collisionRestitution = 0.6;
    collisionFriction = 0.2;

    run = true;
    noise = 1.0;
    speed = 1.6;
    stiffness = 3.;
    restDensity = 1.;
    density = 1.4;
    dynamicViscosity = 0.1;
    gravity = 2; // center gravity by default
    gravitySensorReading = new THREE.Vector3();
    accelerometerReading = new THREE.Vector3();
    actualSize = 1;
    size = 1;

    points = false;
    renderMode = 'surface'; // 'points' | 'glyphs' | 'surface'
    colorMode = 'fluid'; // 'fluid' | 'audio' | 'velocity'
    substeps = 2;
    apicBlend = 0.0;
    sdfSphere = false;
    sdfRadius = 12;
    sdfCenterZ = 20;
    // Stability
    physMaxVelocity = 2.5;
    cflSafety = 0.5;
    vorticityEnabled = false;
    vorticityEps = 0.15;
    xsphEnabled = true;
    xsphEps = 0.08;

    // Fields / Emitters
    jetEnabled = false;
    jetStrength = 0.6;
    jetRadius = 6.0;
    jetPos = { x: 32, y: 40, z: 20 };
    jetDir = { x: 0, y: -1, z: 0 };

    vortexEnabled = false;
    vortexStrength = 0.4;
    vortexRadius = 14.0;
    vortexCenter = { x: 32, y: 32 };

    // New volumetric fields
    curlEnabled = false;
    curlStrength = 0.6;
    curlScale = 0.02;      // spatial scale
    curlTime = 0.6;        // time evolution factor

    orbitEnabled = false;
    orbitStrength = 0.5;
    orbitRadius = 22.0;
    orbitAxis = 'z'; // 'x' | 'y' | 'z'

    waveEnabled = false;
    waveAmplitude = 0.35;
    waveScale = 0.12;     // spatial frequency
    waveSpeed = 1.2;
    waveAxis = 'y';       // 'x' | 'y' | 'z'

    // Audio
    audioEnabled = false;
    audioAttack = 0.5;
    audioRelease = 0.2;
    audioSensitivity = 1.0;
    audioBassGain = 1.0;
    audioMidGain = 1.0;
    audioTrebleGain = 1.0;
    audioBeatBoost = 1.0;
    audioSource = 'mic'; // 'mic' | 'file'
    audioMasterInfluence = 1.0;
    audioIntensity = 1.0;
    audioReactivity = 1.0;
    audioBandAttack = 0.55;
    audioBandRelease = 0.22;
    audioTransientSensitivity = 1.0;
    audioTransientDecay = 0.4;
    audioMacroImpactGain = 1.0;
    audioMacroLiftGain = 1.0;
    audioMacroFallGain = 1.0;
    audioMacroSustainGain = 1.0;
    __onAudioUpload = null;
    // Runtime audio features (read-only; set by app)
    _audioLevel = 0.0; _audioBeat = 0.0; _audioBass = 0.0; _audioMid = 0.0; _audioTreble = 0.0;
    _audioTempoPhase = 0.0; _audioTempoBpm = 0.0;
    _audioBeatPulse = 0.0;
    _audioBands = { sub: 0, bass: 0, lowMid: 0, mid: 0, hiMid: 0, presence: 0, brilliance: 0, air: 0 };
    _audioTransient = 0.0;
    _audioLoudness = 0.0;
    _audioLoudTrend = 0.0;
    _audioMacroState = 'idle';
    _audioMacroStrength = 0.0;
    _audioTempoBar = 0.0;
    _audioSwing = 0.5;

    // Post FX extras
    postFxEnabled = true;
    vignetteEnabled = false;
    vignetteAmount = 0.25;
    grainEnabled = false;
    grainAmount = 0.08;
    chromaEnabled = false;
    chromaAmount = 0.0025;
    // Motion blur (temporal screen direction approx)
    motionBlurEnabled = false;
    motionBlurAmount = 0.35;
    // Color grade controls
    postSaturation = 1.0;
    postContrast = 1.0;
    postLift = 0.0;
    // Anti-aliasing
    aaMode = 'off'; // 'off' | 'fxaa' | 'smaa' | 'traa'
    aaAmount = 1.0;
    // GTAO
    gtaoEnabled = false;
    gtaoRadius = 0.25;
    gtaoThickness = 1.0;
    gtaoDistanceExponent = 1.0;
    gtaoScale = 1.0;
    gtaoSamples = 16;
    gtaoResolutionScale = 1.0;
    // SSGI
    ssgiEnabled = false;
    ssgiSlices = 2;
    ssgiSteps = 8;
    ssgiIntensity = 0.6;
    ssgiResolutionScale = 1.0;
    ssgiDenoise = true;
    // SSR
    ssrEnabled = false;
    ssrOpacity = 0.2;
    ssrMaxDistance = 1.0;
    ssrThickness = 0.1;
    ssrResolutionScale = 0.75;
    ssrMetalness = 0.8;

    constructor(info) {
        if (mobile()) {
            this.maxParticles = 8192 * 8;
            this.particles = 4096;
        }
        this.updateParams();

    }

    updateParams() {
        const level = Math.max(this.particles / 8192,1);
        const size = 1.6/Math.pow(level, 1/3);
        this.actualSize = size * this.size;
        this.restDensity = 0.25 * level * this.density;
    }

    // Map any legacy DOF/Bokeh/PostFX keys into the new unified lens/fx keys
    _syncLegacyToLens() {
        // Lens enable and mode
        if (this.cameraFxEnabled !== undefined && this.lensFxEnabled === undefined) this.lensFxEnabled = this.cameraFxEnabled;
        if (this.focusMode && this.lensFocusMode === undefined) this.lensFocusMode = this.focusMode;
        if (this.dofAutoFocus && this.lensFocusMode === undefined) this.lensFocusMode = this.dofAutoFocus ? 'pointer' : 'manual';

        // Focus distance/range/smoothing
        if (this.focusDistance !== undefined && this.lensFocusDistance === undefined) this.lensFocusDistance = this.focusDistance;
        if (this.dofFocus !== undefined && this.lensFocusDistance === undefined) this.lensFocusDistance = this.dofFocus;
        if (this.focusRange !== undefined && this.lensFocusRange === undefined) this.lensFocusRange = this.focusRange;
        if (this.dofRange !== undefined && this.lensFocusRange === undefined) this.lensFocusRange = this.dofRange;
        if (this.focusSmoothing !== undefined && this.lensFocusSmoothing === undefined) this.lensFocusSmoothing = this.focusSmoothing;
        if (this.focusSmooth !== undefined && this.lensFocusSmoothing === undefined) this.lensFocusSmoothing = this.focusSmooth;

        // Bokeh strength and boosts
        if (this.bokehStrength !== undefined && this.lensBokehAmount === undefined) this.lensBokehAmount = this.bokehStrength;
        if (this.dofAmount !== undefined && this.lensBokehAmount === undefined) this.lensBokehAmount = this.dofAmount;
        if (this.focusNearBoost !== undefined && this.lensNearBoost === undefined) this.lensNearBoost = this.focusNearBoost;
        if (this.dofNearBoost !== undefined && this.lensNearBoost === undefined) this.lensNearBoost = this.dofNearBoost;
        if (this.focusFarBoost !== undefined && this.lensFarBoost === undefined) this.lensFarBoost = this.focusFarBoost;
        if (this.dofFarBoost !== undefined && this.lensFarBoost === undefined) this.lensFarBoost = this.dofFarBoost;

        // Highlights
        if (this.focusHighlightThreshold !== undefined && this.lensHighlightThreshold === undefined) this.lensHighlightThreshold = this.focusHighlightThreshold;
        if (this.dofHighlightThreshold !== undefined && this.lensHighlightThreshold === undefined) this.lensHighlightThreshold = this.dofHighlightThreshold;
        if (this.focusHighlightGain !== undefined && this.lensHighlightGain === undefined) this.lensHighlightGain = this.focusHighlightGain;
        if (this.dofHighlightGain !== undefined && this.lensHighlightGain === undefined) this.lensHighlightGain = this.dofHighlightGain;
        if (this.focusHighlightSoftness !== undefined && this.lensHighlightSoftness === undefined) this.lensHighlightSoftness = this.focusHighlightSoftness;
        if (this.dofHighlightSoftness !== undefined && this.lensHighlightSoftness === undefined) this.lensHighlightSoftness = this.dofHighlightSoftness;

        // CoC / blend / bleed
        if (this.dofMaxCoC !== undefined && this.lensMaxCoC === undefined) this.lensMaxCoC = this.dofMaxCoC;
        if (this.dofBlendCurve !== undefined && this.lensBlendCurve === undefined) this.lensBlendCurve = this.dofBlendCurve;
        if (this.dofBleed !== undefined && this.lensBleed === undefined) this.lensBleed = this.dofBleed;

        // Aperture shape / anamorphic
        if (this.bokehBlades !== undefined && this.lensApertureBlades === undefined) this.lensApertureBlades = this.bokehBlades;
        if (this.apertureBlades !== undefined && this.lensApertureBlades === undefined) this.lensApertureBlades = this.apertureBlades;
        if (this.bokehRotation !== undefined && this.lensApertureRotation === undefined) this.lensApertureRotation = this.bokehRotation;
        if (this.apertureRotation !== undefined && this.lensApertureRotation === undefined) this.lensApertureRotation = this.apertureRotation;
        if (this.bokehPetal !== undefined && this.lensApertureCurvature === undefined) this.lensApertureCurvature = this.bokehPetal;
        if (this.aperturePetal !== undefined && this.lensApertureCurvature === undefined) this.lensApertureCurvature = this.aperturePetal;
        if (this.bokehAnamorphic !== undefined && this.lensAnamorphic === undefined) this.lensAnamorphic = this.bokehAnamorphic;
        if (this.anamorphic !== undefined && this.lensAnamorphic === undefined) this.lensAnamorphic = this.anamorphic;

        // Physical lens
        if (this.sensorWidth !== undefined && this.lensSensorWidth === undefined) this.lensSensorWidth = this.sensorWidth;
        if (this.sensorHeight !== undefined && this.lensSensorHeight === undefined) this.lensSensorHeight = this.sensorHeight;
        if (this.sensorAspect !== undefined && this.lensSensorAspect === undefined) this.lensSensorAspect = this.sensorAspect;
        if (this.focalLength !== undefined && this.lensFocalLength === undefined) this.lensFocalLength = this.focalLength;
        if (this.fStop !== undefined && this.lensFStop === undefined) this.lensFStop = this.fStop;
        if (this.cocLimit !== undefined && this.lensCocLimit === undefined) this.lensCocLimit = this.cocLimit;
        if (this.lensBokehScale === undefined && this.lensBokehScaleLegacy !== undefined) this.lensBokehScale = this.lensBokehScaleLegacy;
        if (this.lensDriveFov === undefined && this.driveFov !== undefined) this.lensDriveFov = this.driveFov;

        // Post FX legacy
        if (this.bloom !== undefined) this.fxBloomEnabled = this.bloom;
        if (this.bloomStrength !== undefined) this.fxBloomStrength = this.bloomStrength;
        if (this.bloomRadius !== undefined) this.fxBloomRadius = this.bloomRadius;
        if (this.bloomThreshold !== undefined) this.fxBloomThreshold = this.bloomThreshold;

        if (this.grainEnabled !== undefined) this.fxGrainEnabled = this.grainEnabled;
        if (this.grainAmount !== undefined) this.fxGrainAmount = this.grainAmount;

        if (this.chromaEnabled !== undefined) this.fxChromaticEnabled = this.chromaEnabled;
        if (this.chromaAmount !== undefined) this.fxChromaticAmount = this.chromaAmount;
        if (this.chromaCenter !== undefined) this.fxChromaticCenter = this.chromaCenter;
        if (this.chromaScale !== undefined) this.fxChromaticScale = this.chromaScale;
    }

    setupGravitySensor() {
        if (this.gravitySensor) { return; }
        this.gravitySensor = new GravitySensor({ frequency: 60 });
        this.gravitySensor.addEventListener("reading", (e) => {
            this.gravitySensorReading.copy(this.gravitySensor).divideScalar(50);
            this.gravitySensorReading.setY(this.gravitySensorReading.y * -1);
        });
        this.gravitySensor.start();
    }

    init() {
        // Normalize any legacy keys to the unified lens keys before building UI
        this._syncLegacyToLens?.();
        const createPanel = (placement = {}) => {
            const el = document.createElement('div');
            el.style.position = 'absolute';
            el.style.top = placement.top ?? '16px';
            if (placement.right) el.style.right = placement.right;
            else el.style.left = placement.left ?? '16px';
            el.style.maxWidth = placement.maxWidth ?? '360px';
            el.style.padding = '8px';
            el.style.borderRadius = '12px';
            el.style.background = 'rgba(20, 24, 28, 0.28)';
            el.style.backdropFilter = 'blur(10px) saturate(140%)';
            el.style.WebkitBackdropFilter = 'blur(10px) saturate(140%)';
            el.style.border = '1px solid rgba(255,255,255,0.12)';
            el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
            el.style.pointerEvents = 'auto';
            el.style.zIndex = placement.zIndex ?? 20;
            document.body.appendChild(el);

            // Narrow draggable header tab
            const header = document.createElement('div');
            header.textContent = placement.headerTitle || '';
            header.style.position = 'absolute';
            header.style.top = '-10px';
            header.style.left = '12px';
            header.style.padding = '2px 8px';
            header.style.fontSize = '10px';
            header.style.letterSpacing = '0.06em';
            header.style.color = '#d0d6dc';
            header.style.background = 'rgba(20,24,28,0.75)';
            header.style.border = '1px solid rgba(255,255,255,0.12)';
            header.style.borderRadius = '6px';
            header.style.cursor = 'move';
            header.style.userSelect = 'none';
            el.appendChild(header);

            let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
            const onDown = (e) => {
                dragging = true; sx = e.clientX; sy = e.clientY;
                const rect = el.getBoundingClientRect();
                if (el.style.right) { el.style.left = (window.innerWidth - rect.right) + 'px'; el.style.right = ''; }
                ox = parseFloat(el.style.left || rect.left || 0);
                oy = parseFloat(el.style.top || rect.top || 0);
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            };
            const onMove = (e) => {
                if (!dragging) return;
                const dx = e.clientX - sx; const dy = e.clientY - sy;
                el.style.left = Math.max(0, Math.min(window.innerWidth - 40, ox + dx)) + 'px';
                el.style.top = Math.max(0, Math.min(window.innerHeight - 40, oy + dy)) + 'px';
            };
            const onUp = () => {
                dragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            header.addEventListener('mousedown', onDown);
            return el;
        };

        const container = createPanel({ top: '16px', right: '16px', maxWidth: '360px', zIndex: 26, headerTitle: 'settings' });
		// Make panel draggable
		const makeDraggable = (el) => {
			let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
			const onDown = (e) => {
				dragging = true; sx = e.clientX; sy = e.clientY;
				const rect = el.getBoundingClientRect();
				// If right anchored, convert to left for dragging
				if (el.style.right) {
					el.style.left = (window.innerWidth - rect.right) + 'px';
					el.style.right = '';
				}
				ox = parseFloat(el.style.left || rect.left || 0);
				oy = parseFloat(el.style.top || rect.top || 0);
				document.addEventListener('mousemove', onMove);
				document.addEventListener('mouseup', onUp);
			};
			const onMove = (e) => {
				if (!dragging) return;
				const dx = e.clientX - sx; const dy = e.clientY - sy;
				el.style.left = Math.max(0, Math.min(window.innerWidth - 40, ox + dx)) + 'px';
				el.style.top = Math.max(0, Math.min(window.innerHeight - 40, oy + dy)) + 'px';
			};
			const onUp = () => {
				dragging = false;
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', onUp);
			};
			// Use container itself as drag surface
			el.style.cursor = 'move';
			el.addEventListener('mousedown', onDown);
		};
		makeDraggable(container);

        const gui = new Pane({ container });
        gui.registerPlugin(EssentialsPlugin);

        const fxContainer = createPanel({ top: '16px', left: '16px', maxWidth: '340px', zIndex: 25, headerTitle: 'postfx' });
        const fxGui = new Pane({ container: fxContainer });
        fxGui.registerPlugin(EssentialsPlugin);
        this.fxGui = fxGui;

        // Unified Cinematic Pipeline Panel
        const cine = fxGui.addFolder({ title: 'cinematic pipeline', expanded: true });
        cine.addBinding(this, 'postFxEnabled', { label: 'enable' });
        this.fxView = this.fxView || 'final';
        cine.addBlade({ view: 'list', label: 'view', options: [
            { text: 'final', value: 'final' },
            { text: 'after lens', value: 'lens' },
            { text: 'scene', value: 'scene' },
        ], value: this.fxView }).on('change', (ev) => { this.fxView = ev.value; });

        const cam = cine.addFolder({ title: 'camera', expanded: false });
        cam.addBinding(this, 'fov', { min: 20, max: 100, step: 1, label: 'field of view' });

        const env = cine.addFolder({ title: 'environment', expanded: false });
        env.addBinding(this, 'envIntensity', { min: 0.0, max: 5.0, step: 0.05, label: 'env intensity' });
        env.addBinding(this, 'exposure', { min: 0.0, max: 2.0, step: 0.01, label: 'exposure' });
        env.addBinding(this, 'bgRotY', { label: 'bg rot Y', min: -Math.PI, max: Math.PI, step: 0.01 });
        env.addBinding(this, 'envRotY', { label: 'env rot Y', min: -Math.PI, max: Math.PI, step: 0.01 });

        const lens = cine.addFolder({ title: 'lens focus & bokeh', expanded: true });
        lens.addBinding(this, 'lensFxEnabled', { label: 'enable' });
        lens.addBinding(this, 'lensAutoTune', { label: 'auto tune' });
        lens.addBlade({ view: 'list', label: 'mode', options: [
                { text: 'pointer', value: 'pointer' },
                { text: 'manual', value: 'manual' },
        ], value: this.lensFocusMode }).on('change', (ev) => { this.lensFocusMode = ev.value; });
        lens.addBinding(this, 'lensFocusDistance', { min: 0.05, max: 5.0, step: 0.01, label: 'distance' });
        lens.addBinding(this, 'lensFocusRange', { min: 0.01, max: 2.0, step: 0.01, label: 'range' });
        lens.addBinding(this, 'lensFocusSmoothing', { min: 0.0, max: 0.9, step: 0.01, label: 'smoothing' });
        lens.addBinding(this, 'lensBokehAmount', { min: 0.2, max: 3.5, step: 0.01, label: 'bokeh' });
        lens.addBinding(this, 'lensNearBoost', { min: 0.5, max: 3.0, step: 0.01, label: 'near boost' });
        lens.addBinding(this, 'lensFarBoost', { min: 0.5, max: 3.0, step: 0.01, label: 'far boost' });
        lens.addBinding(this, 'lensHighlightThreshold', { min: 0.0, max: 1.0, step: 0.01, label: 'hilite thresh' });
        lens.addBinding(this, 'lensHighlightGain', { min: 0.0, max: 2.5, step: 0.01, label: 'hilite gain' });
        lens.addBinding(this, 'lensHighlightSoftness', { min: 0.02, max: 0.5, step: 0.01, label: 'hilite soft' });
        lens.addBinding(this, 'lensMaxCoC', { min: 0.2, max: 3.5, step: 0.01, label: 'max coc' });
        lens.addBinding(this, 'lensBlendCurve', { min: 0.5, max: 3.0, step: 0.01, label: 'blend curve' });
        lens.addBinding(this, 'lensBleed', { min: 0.0, max: 1.0, step: 0.01, label: 'bleed' });
        const shape = lens.addFolder({ title: 'aperture', expanded: false });
        shape.addBinding(this, 'lensApertureBlades', { min: 3, max: 12, step: 1, label: 'blades' });
        shape.addBinding(this, 'lensApertureRotation', { min: -Math.PI, max: Math.PI, step: 0.01, label: 'rotation' });
        shape.addBinding(this, 'lensApertureCurvature', { min: 0.2, max: 2.5, step: 0.01, label: 'curvature' });
        shape.addBinding(this, 'lensAnamorphic', { min: -1.0, max: 1.0, step: 0.01, label: 'anamorphic' });
        const phys = lens.addFolder({ title: 'physical', expanded: false });
        phys.addBinding(this, 'lensPhysicalEnabled', { label: 'enable' });
        phys.addBinding(this, 'lensFocalLength', { min: 4, max: 200, step: 1, label: 'focal (mm)' });
        phys.addBinding(this, 'lensFStop', { min: 0.5, max: 22, step: 0.1, label: 'f-stop' });
        phys.addBinding(this, 'lensSensorWidth', { min: 4, max: 70, step: 1, label: 'sensor W' });
        phys.addBinding(this, 'lensSensorHeight', { min: 3, max: 70, step: 1, label: 'sensor H' });
        phys.addBinding(this, 'lensSensorAspect', { min: 0.2, max: 4.0, step: 0.01, label: 'aspect' });
        phys.addBinding(this, 'lensCocLimit', { min: 0.005, max: 0.5, step: 0.001, label: 'coc limit' });
        phys.addBinding(this, 'lensBokehScale', { min: 0.1, max: 4.0, step: 0.01, label: 'bokeh scale' });
        phys.addBinding(this, 'lensDriveFov', { label: 'drive FOV' });
        lens.addBlade({ view: 'button', label: 'focus', title: 'Focus Center' }).on('click', () => { if (this.__onLensCenterFocus) this.__onLensCenterFocus(); });

        const bloom = cine.addFolder({ title: 'bloom', expanded: true });
        bloom.addBinding(this, 'fxBloomEnabled', { label: 'enable' });
        bloom.addBinding(this, 'fxBloomStrength', { min: 0, max: 2, step: 0.01, label: 'strength' });
        bloom.addBinding(this, 'fxBloomRadius', { min: 0, max: 1.2, step: 0.01, label: 'radius' });
        bloom.addBinding(this, 'fxBloomThreshold', { min: 0, max: 1, step: 0.001, label: 'threshold' });

        const vig = cine.addFolder({ title: 'vignette', expanded: true });
        vig.addBinding(this, 'vignetteEnabled', { label: 'enable' });
        vig.addBinding(this, 'vignetteAmount', { min: 0.0, max: 1.0, step: 0.01, label: 'amount' });

        const grade = cine.addFolder({ title: 'grade', expanded: true });
        grade.addBinding(this, 'postSaturation', { min: 0.0, max: 2.0, step: 0.01, label: 'saturation' });
        grade.addBinding(this, 'postContrast', { min: 0.5, max: 2.0, step: 0.01, label: 'contrast' });
        grade.addBinding(this, 'postLift', { min: -0.3, max: 0.3, step: 0.005, label: 'lift' });

        const chrom = cine.addFolder({ title: 'chromatic', expanded: true });
        chrom.addBinding(this, 'fxChromaticEnabled', { label: 'enable' });
        chrom.addBinding(this, 'fxChromaticAmount', { min: 0.0, max: 0.01, step: 0.0001, label: 'amount' });
        this.fxChromaticCenter = this.fxChromaticCenter || { x: 0.5, y: 0.5 };
        this.fxChromaticScale = this.fxChromaticScale || 1.0;
        chrom.addBinding(this, 'fxChromaticCenter', { x: { min: 0.0, max: 1.0, step: 0.001 }, y: { min: 0.0, max: 1.0, step: 0.001 } });
        chrom.addBinding(this, 'fxChromaticScale', { min: 0.2, max: 3.0, step: 0.01, label: 'scale' });

        const grain = cine.addFolder({ title: 'grain', expanded: true });
        grain.addBinding(this, 'fxGrainEnabled', { label: 'enable' });
        grain.addBinding(this, 'fxGrainAmount', { min: 0.0, max: 0.5, step: 0.01, label: 'amount' });
        // Removed legacy duplicate panels: old lens/camera/environment and secondary post-fx tree

        const stats = gui.addFolder({
            title: "stats",
            expanded: false,
        });
        this.fpsGraph = stats.addBlade({
            view: 'fpsgraph',
            label: 'fps',
            rows: 2,
        });

        const settings = gui.addFolder({
            title: "settings",
            expanded: false,
        });
        settings.addBinding(this, "particles", { min: 4096, max: this.maxParticles, step: 4096 }).on('change', () => { this.updateParams(); });
        settings.addBinding(this, "size", { min: 0.5, max: 2, step: 0.1 }).on('change', () => { this.updateParams(); });
        const rendering = settings.addFolder({
            title: "rendering",
            expanded: false,
        });
        rendering.addBlade({
            view: 'list',
            label: 'mode',
            options: [
                { text: 'surface', value: 'surface' },
                { text: 'glyphs', value: 'glyphs' },
                { text: 'points', value: 'points' },
            ],
            value: this.renderMode,
        }).on('change', (ev) => { this.renderMode = ev.value; });
        rendering.addBlade({
            view: 'list',
            label: 'color',
            options: [
                { text: 'fluid', value: 'fluid' },
                { text: 'audio', value: 'audio' },
                { text: 'velocity', value: 'velocity' },
            ],
            value: this.colorMode,
        }).on('change', (ev) => { this.colorMode = ev.value; });
        // Bloom controls moved to Post FX panel
        rendering.addBinding(this, "points");
        rendering.addBinding(this, "worldScale", { min: 0.5, max: 3.0, step: 0.01, label: 'world scale' });
        rendering.addBinding(this, "autoWorldFit", { label: 'auto fit world' });
        rendering.addBlade({
            view: 'list',
            label: 'fit',
            options: [
                { text: 'contain', value: 'contain' },
                { text: 'cover', value: 'cover' },
            ],
            value: this.fitMode,
        }).on('change', (ev) => { this.fitMode = ev.value; });
        rendering.addBinding(this, "zScale", { min: 0.05, max: 2.0, step: 0.01, label: 'z compress' });
        rendering.addBinding(this, "fitMargin", { min: 0.90, max: 1.0, step: 0.005, label: 'fit margin' });

        // World border behavior when boundaries are disabled
        rendering.addBlade({
            view: 'list',
            label: 'world border',
            options: [
                { text: 'bounce', value: 'bounce' },
                { text: 'wrap', value: 'wrap' },
            ],
            value: this.borderMode || 'bounce',
        }).on('change', (ev) => { this.borderMode = ev.value; });


        const perf = settings.addFolder({ title: 'performance', expanded: false });
        perf.addBinding(this, 'autoPerf', { label: 'auto adjust' });
        perf.addBinding(this, 'perfMinFps', { min: 20, max: 80, step: 1, label: 'min fps' });
        perf.addBinding(this, 'perfMaxFps', { min: 30, max: 120, step: 1, label: 'max fps' });
        perf.addBinding(this, 'perfStep', { min: 1024, max: 16384, step: 1024, label: 'step' });

        const boundary = settings.addFolder({
            title: "boundary",
            expanded: false,
        });
        boundary.addBinding(this, 'boundariesEnabled', { label: 'enable' });
        boundary.addBlade({
            view: 'list',
            label: 'shape',
            options: [
                { text: 'dodecahedron', value: 'dodeca' },
                { text: 'cube', value: 'cube' },
                { text: 'sphere', value: 'sphere' },
            ],
            value: this.boundaryShape,
        }).on('change', (ev) => { this.boundaryShape = ev.value; });
        boundary.addBinding(this, "glassIor", { min: 1.0, max: 2.6, step: 0.01 });
        boundary.addBinding(this, "glassThickness", { min: 0.0, max: 2.0, step: 0.01 });
        boundary.addBinding(this, "glassRoughness", { min: 0.0, max: 0.5, step: 0.005 });
        boundary.addBinding(this, "glassDispersion", { min: 0.0, max: 1.0, step: 0.01 });
        boundary.addBinding(this, "glassAttenuationDistance", { min: 0.1, max: 10.0, step: 0.1 });
        boundary.addBinding(this, "glassAttenuationColor", { view: 'color' });
        boundary.addBinding(this, "collisionShrink", { min: 0.90, max: 1.00, step: 0.001, label: 'collision shrink' });
        boundary.addBinding(this, "collisionRestitution", { min: 0.0, max: 1.5, step: 0.01, label: 'restitution' });
        boundary.addBinding(this, "collisionFriction", { min: 0.0, max: 1.0, step: 0.01, label: 'friction' });
        boundary.addBlade({ view: 'button', label: 'upload', title: 'Choose Model' }).on('click', () => {
            if (this.__onBoundaryUpload) this.__onBoundaryUpload();
        });

        const simulation = settings.addFolder({
            title: "simulation",
            expanded: false,
        });
        simulation.addBinding(this, "run");
        simulation.addBinding(this, "noise", { min: 0, max: 2, step: 0.01 });
        simulation.addBinding(this, "speed", { min: 0.1, max: 2, step: 0.1 });
        simulation.addBinding(this, "substeps", { min: 1, max: 8, step: 1 });
        simulation.addBinding(this, "apicBlend", { min: 0, max: 1, step: 0.05 });
        simulation.addBinding(this, "physMaxVelocity", { min: 0.5, max: 6.0, step: 0.1, label: 'max velocity' });
        simulation.addBinding(this, "cflSafety", { min: 0.05, max: 1.0, step: 0.01, label: 'dt safety' });
        simulation.addBinding(this, "vorticityEnabled", { label: 'vorticity' });
        simulation.addBinding(this, "vorticityEps", { min: 0.0, max: 0.8, step: 0.01, label: 'vort strength' });
        simulation.addBinding(this, "xsphEnabled", { label: 'xsph smooth' });
        simulation.addBinding(this, "xsphEps", { min: 0.0, max: 0.5, step: 0.01, label: 'xsph strength' });
        simulation.addBinding(this, "sdfSphere", { label: 'sphere collision' });
        simulation.addBinding(this, "sdfCenterZ", { min: 4, max: 60, step: 1 });
        simulation.addBinding(this, "sdfRadius", { min: 4, max: 30, step: 1 });
        simulation.addBlade({
            view: 'list',
            label: 'gravity',
            options: [
                {text: 'back', value: 0},
                {text: 'down', value: 1},
                {text: 'center', value: 2},
                {text: 'device gravity', value: 3},
            ],
            value: 0,
        }).on('change', (ev) => {
            if (ev.value === 3) {
                this.setupGravitySensor();
            }
            this.gravity = ev.value;
        });
        simulation.addBinding(this, "density", { min: 0.4, max: 2, step: 0.1 }).on('change', () => { this.updateParams(); });;
        simulation.addBinding(this, "stiffness", { min: 0.5, max: 10, step: 0.1 });
        simulation.addBinding(this, "dynamicViscosity", { min: 0.01, max: 0.5, step: 0.01 });

        const fields = settings.addFolder({ title: 'fields', expanded: false });
        const jet = fields.addFolder({ title: 'jet', expanded: false });
        jet.addBinding(this, 'jetEnabled', { label: 'enable' });
        jet.addBinding(this, 'jetStrength', { min: 0.0, max: 3.0, step: 0.01 });
        jet.addBinding(this, 'jetRadius', { min: 1.0, max: 32.0, step: 0.1 });
        jet.addBinding(this, 'jetPos', { x: { min: 0, max: 64, step: 1 }, y: { min: 0, max: 64, step: 1 }, z: { min: 0, max: 64, step: 1 } });
        jet.addBinding(this, 'jetDir', { x: { min: -1, max: 1, step: 0.01 }, y: { min: -1, max: 1, step: 0.01 }, z: { min: -1, max: 1, step: 0.01 } });

        const vortex = fields.addFolder({ title: 'vortex', expanded: false });
        vortex.addBinding(this, 'vortexEnabled', { label: 'enable' });
        vortex.addBinding(this, 'vortexStrength', { min: 0.0, max: 3.0, step: 0.01 });
        vortex.addBinding(this, 'vortexRadius', { min: 1.0, max: 64.0, step: 0.1 });
        vortex.addBinding(this, 'vortexCenter', { x: { min: 0, max: 64, step: 1 }, y: { min: 0, max: 64, step: 1 } });

        const turb = fields.addFolder({ title: 'curl turbulence', expanded: false });
        turb.addBinding(this, 'curlEnabled', { label: 'enable' });
        turb.addBinding(this, 'curlStrength', { min: 0.0, max: 3.0, step: 0.01, label: 'strength' });
        turb.addBinding(this, 'curlScale', { min: 0.002, max: 0.08, step: 0.001, label: 'scale' });
        turb.addBinding(this, 'curlTime', { min: 0.05, max: 3.0, step: 0.01, label: 'time' });

        const orbit = fields.addFolder({ title: 'orbit', expanded: false });
        orbit.addBinding(this, 'orbitEnabled', { label: 'enable' });
        orbit.addBinding(this, 'orbitStrength', { min: 0.0, max: 3.0, step: 0.01, label: 'strength' });
        orbit.addBinding(this, 'orbitRadius', { min: 4.0, max: 64.0, step: 0.1, label: 'radius' });
        orbit.addBlade({
            view: 'list',
            label: 'axis',
            options: [
                { text: 'x', value: 'x' },
                { text: 'y', value: 'y' },
                { text: 'z', value: 'z' },
            ],
            value: this.orbitAxis,
        }).on('change', (ev) => { this.orbitAxis = ev.value; });

        const wave = fields.addFolder({ title: 'wave', expanded: false });
        wave.addBinding(this, 'waveEnabled', { label: 'enable' });
        wave.addBinding(this, 'waveAmplitude', { min: 0.0, max: 2.0, step: 0.01, label: 'amplitude' });
        wave.addBinding(this, 'waveScale', { min: 0.02, max: 1.0, step: 0.01, label: 'scale' });
        wave.addBinding(this, 'waveSpeed', { min: 0.1, max: 4.0, step: 0.01, label: 'speed' });
        wave.addBlade({
            view: 'list',
            label: 'axis',
            options: [
                { text: 'x', value: 'x' },
                { text: 'y', value: 'y' },
                { text: 'z', value: 'z' },
            ],
            value: this.waveAxis,
        }).on('change', (ev) => { this.waveAxis = ev.value; });

        // Audio controls moved to dedicated AudioPanel (src/ui/audioPanel.js)

        // Post FX unified panel
        /*settings.addBinding(this, "roughness", { min: 0.0, max: 1, step: 0.01 });
        settings.addBinding(this, "metalness", { min: 0.0, max: 1, step: 0.01 });*/

        // Presets
        const presets = gui.addFolder({
            title: 'presets',
            expanded: false,
        });
        // Built-in presets
        this._builtinPresetName = 'Photo Mode';
        presets.addBlade({
            view: 'list',
            label: 'builtin',
            options: [
                { text: 'Photo Mode', value: 'Photo Mode' },
                { text: 'Glass Dodeca', value: 'Glass Dodeca' },
                { text: 'Glyph Motion', value: 'Glyph Motion' },
                { text: 'Points Storm', value: 'Points Storm' },
                { text: 'Sphere Tank', value: 'Sphere Tank' },
                { text: 'Vortex Jet', value: 'Vortex Jet' },
                { text: 'Bass Jet', value: 'Bass Jet' },
                { text: 'Dance Surface', value: 'Dance Surface' },
                { text: 'Audio Showcase', value: 'Audio Showcase' },
                { text: 'Nebula Curl', value: 'Nebula Curl' },
                { text: 'Orbit Dance', value: 'Orbit Dance' },
                { text: 'Beat Waves', value: 'Beat Waves' },
                { text: 'Bass Storm', value: 'Bass Storm' },
                { text: 'Perc Glitch', value: 'Perc Glitch' },
                { text: 'Ambient Wash', value: 'Ambient Wash' },
                { text: 'Chillwave Drift', value: 'Chillwave Drift' },
                { text: 'Trance Swirl', value: 'Trance Swirl' },
            ],
            value: this._builtinPresetName,
        }).on('change', (ev) => {
            this._builtinPresetName = ev.value;
            this.applyPreset(ev.value);
        });
        presets.addBlade({ view: 'button', label: 'startup', title: 'Save Current as Startup' }).on('click', () => {
            const data = this._exportPreset();
            try {
                localStorage.setItem('flow.startPreset', JSON.stringify(data));
            } catch {}
        });
        presets.addBlade({ view: 'button', label: 'save', title: 'Save Preset' }).on('click', () => {
            const data = this._exportPreset();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'flow-preset.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        presets.addBlade({ view: 'button', label: 'load', title: 'Load Preset' }).on('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async () => {
                const file = input.files && input.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    this._importPreset(data);
                } catch (e) {
                    console.error(e);
                }
            };
            input.click();
        });

        this.gui = gui;

        // Apply startup preset (localStorage overrides default)
        let start = null;
        try {
            const s = localStorage.getItem('flow.startPreset');
            if (s) start = JSON.parse(s);
        } catch {}
        if (start) {
            this._importPreset(start);
        } else {
            // Default to Audio Showcase for a compelling sound-reactive startup
            this.applyPreset('Audio Showcase');
        }
    }

    registerBoundaryUpload(handler) {
        this.__onBoundaryUpload = handler;
    }

    registerAudioUpload(handler) {
        this.__onAudioUpload = handler;
    }

    registerRouter(router) {
        this.__router = router;
        // Apply any pending routing preset captured during early preset load
        if (this.__routerPreset) {
            try { this.__router.fromJSON(this.__routerPreset); } catch {}
            this.__routerPreset = null;
        }
    }

    update() {
    }

    begin() {
        this.fpsGraph.begin();
    }
    end() {
        this.fpsGraph.end();
    }

    _exportPreset() {
        // Whitelist of presettable fields
        const keys = [
            'particles','size','points','bloom','bloomStrength','bloomRadius','bloomThreshold',
            'worldScale','autoWorldFit','fitMode','fitMargin','zScale','borderMode','dofEnabled','dofHighQuality','dofFocus','dofRange','dofAmount','dofNearBoost','dofFarBoost','dofHighlightThreshold','dofHighlightGain','dofHighlightSoftness','dofMaxCoC','dofBlendCurve','dofBleed','colorMode',
            'fov','envIntensity','exposure','bgRotY','envRotY',
            'boundariesEnabled','boundaryShape','glassIor','glassThickness','glassRoughness','glassDispersion','glassAttenuationDistance','glassAttenuationColor','collisionShrink','collisionRestitution','collisionFriction',
            'run','noise','speed','substeps','apicBlend','physMaxVelocity','cflSafety','vorticityEnabled','vorticityEps','xsphEnabled','xsphEps','sdfSphere','sdfCenterZ','sdfRadius','gravity','density','stiffness','dynamicViscosity',
            'jetEnabled','jetStrength','jetRadius','jetPos','jetDir','vortexEnabled','vortexStrength','vortexRadius','vortexCenter',
            'curlEnabled','curlStrength','curlScale','curlTime',
            'orbitEnabled','orbitStrength','orbitRadius','orbitAxis',
            'waveEnabled','waveAmplitude','waveScale','waveSpeed','waveAxis',
            'audioEnabled','audioSource','audioSensitivity','audioAttack','audioRelease','audioBassGain','audioMidGain','audioTrebleGain','audioBeatBoost','audioMasterInfluence','audioIntensity','audioReactivity','audioBandAttack','audioBandRelease','audioTransientSensitivity','audioTransientDecay','audioMacroImpactGain','audioMacroLiftGain','audioMacroFallGain','audioMacroSustainGain',
            'vignetteEnabled','vignetteAmount','grainEnabled','grainAmount','chromaEnabled','chromaAmount','chromaCenter','chromaScale','motionBlurEnabled','motionBlurAmount','postSaturation','postContrast','postLift','aaMode','aaAmount','gtaoEnabled','gtaoRadius','gtaoThickness','gtaoDistanceExponent','gtaoScale','gtaoSamples','gtaoResolutionScale','ssgiEnabled','ssgiSlices','ssgiSteps','ssgiIntensity','ssgiResolutionScale','ssgiDenoise','ssrEnabled','ssrOpacity','ssrMaxDistance','ssrThickness','ssrResolutionScale','ssrMetalness','lensEnabled','sensorWidth','sensorHeight','sensorAspect','focalLength','fStop','lensDriveFov','focusSmooth','lensBokehScale','cocLimit','dofQuality','apertureBlades','apertureRotation','aperturePetal','anamorphic'
        ];
        const out = {};
        keys.forEach(k => { out[k] = this[k]; });
        // Include audio routing config if present
        try {
            const r = this.__router ? this.__router.toJSON() : (this.__routerPreset || null);
            if (r) out.audioRouting = r;
        } catch {}
        return out;
    }

    _importPreset(data) {
        if (!data || typeof data !== 'object') return;
        const apply = (k, v) => {
            if (v === undefined) return;
            if (k === 'glassAttenuationColor' && v && typeof v === 'object') {
                const r = Math.max(0, Math.min(255, v.r|0));
                const g = Math.max(0, Math.min(255, v.g|0));
                const b = Math.max(0, Math.min(255, v.b|0));
                this[k] = { r, g, b };
            } else {
                this[k] = v;
            }
        };
        Object.keys(data).forEach(k => apply(k, data[k]));
        // Apply router config if provided
        if (data.audioRouting) {
            if (this.__router && this.__router.fromJSON) {
                try { this.__router.fromJSON(data.audioRouting); } catch {}
            } else {
                // Store for later when router is registered
                this.__routerPreset = data.audioRouting;
            }
        }
        this.updateParams();
        if (this.gui) this.gui.refresh(); if (this.fxGui) this.fxGui.refresh();
    }

    applyPreset(name) {
        const p = this._builtinPresets()[name];
        if (!p) return;
        this._importPreset(p);
    }

    // Lens mapping moved into LensPipeline

    _builtinPresets() {
        // Carefully chosen combos for varied visuals
        return {
            'Photo Mode': {
                worldScale: 2.0,
                boundariesEnabled: false,
                renderMode: 'surface',
                bloom: true, bloomStrength: 1.2, bloomRadius: 1.0, bloomThreshold: 0.0005,
                dofEnabled: true, dofFocus: 1.1, dofRange: 0.25, dofAmount: 0.85,
                fov: 60, exposure: 0.66, envIntensity: 0.9,
                gravity: 2, speed: 1.6, density: 1.4, substeps: 2, apicBlend: 0.2,
                particles: 8192 * 4,
            },
            'Glass Dodeca': {
                boundariesEnabled: true, boundaryShape: 'dodeca',
                glassIor: 1.52, glassThickness: 0.38, glassRoughness: 0.04, glassDispersion: 0.28,
                bloom: true, bloomStrength: 0.9, bloomRadius: 0.9, bloomThreshold: 0.001,
                dofEnabled: true, dofFocus: 1.2, dofRange: 0.35, dofAmount: 0.7,
                worldScale: 1.3, renderMode: 'surface', gravity: 1, speed: 1.2, density: 1.0,
            },
            'Glyph Motion': {
                renderMode: 'glyphs', worldScale: 1.8,
                bloom: true, bloomStrength: 0.8, bloomRadius: 0.8, bloomThreshold: 0.002,
                dofEnabled: true, dofFocus: 1.0, dofRange: 0.2, dofAmount: 0.8,
                boundariesEnabled: false, gravity: 0, speed: 1.4, density: 1.1, apicBlend: 0.35,
            },
            'Points Storm': {
                renderMode: 'points', particles: 8192 * 8, size: 0.9,
                bloom: false, dofEnabled: false,
                worldScale: 2.2, boundariesEnabled: false, gravity: 3, speed: 1.5, density: 0.9,
            },
            'Sphere Tank': {
                boundariesEnabled: true, boundaryShape: 'sphere', sdfSphere: true, sdfRadius: 18, sdfCenterZ: 20,
                worldScale: 1.2, renderMode: 'surface',
                bloom: true, bloomStrength: 0.7, bloomRadius: 0.6, bloomThreshold: 0.002,
                dofEnabled: false, gravity: 1, speed: 1.0, density: 1.2,
            },
            'Vortex Jet': {
                boundariesEnabled: false, worldScale: 1.8,
                jetEnabled: true, jetStrength: 1.0, jetRadius: 10.0, jetPos: { x: 20, y: 54, z: 28 }, jetDir: { x: 0, y: -1, z: 0 },
                vortexEnabled: true, vortexStrength: 0.8, vortexRadius: 22.0, vortexCenter: { x: 32, y: 32 },
                bloom: true, bloomStrength: 1.1, bloomRadius: 0.9, bloomThreshold: 0.001,
                dofEnabled: true, dofFocus: 1.05, dofRange: 0.3, dofAmount: 0.75,
                gravity: 0, speed: 1.8, density: 1.1,
            },
            'Bass Jet': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.3,
                audioBassGain: 1.6, audioMidGain: 0.9, audioTrebleGain: 0.6, audioBeatBoost: 1.2,
                boundariesEnabled: false, worldScale: 1.7,
                jetEnabled: true, jetStrength: 0.9, jetRadius: 12.0, jetPos: { x: 32, y: 58, z: 28 }, jetDir: { x: 0, y: -1, z: 0 },
                vortexEnabled: false,
                apicBlend: 0.25, physMaxVelocity: 2.6, cflSafety: 0.5,
                bloom: true, bloomStrength: 1.0, bloomRadius: 0.9, bloomThreshold: 0.0015,
                dofEnabled: true, dofFocus: 1.0, dofRange: 0.22, dofAmount: 0.85,
                gravity: 0, speed: 1.7, density: 1.2,
            },
            'Dance Surface': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.1,
                audioBassGain: 1.2, audioMidGain: 1.4, audioTrebleGain: 1.0, audioBeatBoost: 1.1,
                boundariesEnabled: false, renderMode: 'surface', worldScale: 2.0,
                jetEnabled: false, vortexEnabled: true, vortexStrength: 0.9, vortexRadius: 20.0, vortexCenter: { x: 32, y: 32 },
                apicBlend: 0.35, physMaxVelocity: 2.8, cflSafety: 0.5,
                bloom: true, bloomStrength: 0.9, bloomRadius: 0.9, bloomThreshold: 0.002,
                dofEnabled: true, dofFocus: 1.0, dofRange: 0.25, dofAmount: 0.8,
                gravity: 0, speed: 1.8, density: 1.1,
            },
            'Audio Showcase': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.2,
                // Volumetric fields
                curlEnabled: true, curlStrength: 0.9, curlScale: 0.026, curlTime: 0.8,
                orbitEnabled: true, orbitAxis: 'z', orbitRadius: 22.0, orbitStrength: 0.8,
                waveEnabled: true, waveAxis: 'y', waveAmplitude: 0.45, waveScale: 0.12, waveSpeed: 1.2,
                // Classic fields
                jetEnabled: true, jetStrength: 0.8, jetRadius: 12.0, jetPos: { x: 32, y: 58, z: 28 }, jetDir: { x: 0, y: -1, z: 0 },
                vortexEnabled: true, vortexStrength: 0.7, vortexRadius: 20.0, vortexCenter: { x: 32, y: 32 },
                // Visuals
                renderMode: 'surface', worldScale: 2.0,
                bloom: true, bloomStrength: 1.0, bloomRadius: 0.9, bloomThreshold: 0.0013,
                dofEnabled: true, dofFocus: 1.05, dofRange: 0.24, dofAmount: 0.85,
                gravity: 0, speed: 1.7, density: 1.2,
            },
            'Nebula Curl': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.2,
                curlEnabled: true, curlStrength: 1.0, curlScale: 0.028, curlTime: 0.8,
                orbitEnabled: false,
                waveEnabled: false,
                renderMode: 'surface', worldScale: 1.9,
                vorticityEnabled: true, vorticityEps: 0.18, xsphEnabled: true, xsphEps: 0.06,
                bloom: true, bloomStrength: 1.0, bloomRadius: 0.9, bloomThreshold: 0.0015,
                dofEnabled: true, dofFocus: 1.1, dofRange: 0.22, dofAmount: 0.85,
                gravity: 0, speed: 1.6, density: 1.2,
            },
            'Orbit Dance': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.1,
                orbitEnabled: true, orbitAxis: 'z', orbitRadius: 24.0, orbitStrength: 0.9,
                curlEnabled: true, curlStrength: 0.6, curlScale: 0.02, curlTime: 0.7,
                waveEnabled: false,
                renderMode: 'glyphs', worldScale: 1.8,
                bloom: true, bloomStrength: 0.9, bloomRadius: 0.9, bloomThreshold: 0.001,
                dofEnabled: true, dofFocus: 1.0, dofRange: 0.25, dofAmount: 0.8,
                gravity: 0, speed: 1.7, density: 1.1,
            },
            'Beat Waves': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.2,
                waveEnabled: true, waveAxis: 'y', waveAmplitude: 0.5, waveScale: 0.14, waveSpeed: 1.2,
                orbitEnabled: true, orbitAxis: 'y', orbitRadius: 18.0, orbitStrength: 0.6,
                curlEnabled: false,
                renderMode: 'surface', worldScale: 2.0,
                bloom: true, bloomStrength: 0.95, bloomRadius: 0.9, bloomThreshold: 0.001,
                dofEnabled: true, dofFocus: 1.0, dofRange: 0.22, dofAmount: 0.8,
                gravity: 0, speed: 1.6, density: 1.2,
            },
            'Bass Storm': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.3,
                jetEnabled: true, jetStrength: 1.0, jetRadius: 14.0, jetPos: { x: 32, y: 56, z: 28 }, jetDir: { x: 0, y: -1, z: 0 },
                vortexEnabled: true, vortexStrength: 0.6, vortexRadius: 18.0, vortexCenter: { x: 32, y: 32 },
                curlEnabled: true, curlStrength: 0.7, curlScale: 0.024, curlTime: 0.8,
                waveEnabled: false,
                renderMode: 'surface', worldScale: 1.9,
                bloom: true, bloomStrength: 1.1, bloomRadius: 0.95, bloomThreshold: 0.001,
                dofEnabled: true, dofFocus: 1.05, dofRange: 0.2, dofAmount: 0.85,
                gravity: 0, speed: 1.8, density: 1.25,
            },
            'Perc Glitch': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.0,
                waveEnabled: true, waveAxis: 'x', waveAmplitude: 0.65, waveScale: 0.18, waveSpeed: 1.4,
                curlEnabled: true, curlStrength: 0.5, curlScale: 0.03, curlTime: 1.2,
                orbitEnabled: false,
                renderMode: 'glyphs', worldScale: 1.7,
                bloom: true, bloomStrength: 0.9, bloomRadius: 0.85, bloomThreshold: 0.0015,
                dofEnabled: false,
                gravity: 0, speed: 1.9, density: 1.1,
            },
            'Ambient Wash': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 0.9,
                curlEnabled: true, curlStrength: 0.5, curlScale: 0.022, curlTime: 0.6,
                orbitEnabled: true, orbitAxis: 'y', orbitRadius: 28.0, orbitStrength: 0.5,
                waveEnabled: true, waveAxis: 'z', waveAmplitude: 0.25, waveScale: 0.09, waveSpeed: 0.9,
                renderMode: 'surface', worldScale: 2.0,
                bloom: true, bloomStrength: 0.8, bloomRadius: 0.8, bloomThreshold: 0.002,
                dofEnabled: true, dofFocus: 1.2, dofRange: 0.3, dofAmount: 0.7,
                gravity: 0, speed: 1.4, density: 1.1,
            },
            'Chillwave Drift': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.0,
                orbitEnabled: true, orbitAxis: 'z', orbitRadius: 26.0, orbitStrength: 0.6,
                curlEnabled: true, curlStrength: 0.6, curlScale: 0.024, curlTime: 0.7,
                waveEnabled: true, waveAxis: 'y', waveAmplitude: 0.35, waveScale: 0.12, waveSpeed: 1.0,
                renderMode: 'surface', worldScale: 2.1,
                bloom: true, bloomStrength: 0.9, bloomRadius: 0.9, bloomThreshold: 0.001,
                dofEnabled: true, dofFocus: 1.1, dofRange: 0.28, dofAmount: 0.75,
                gravity: 0, speed: 1.6, density: 1.15,
            },
            'Trance Swirl': {
                audioEnabled: true, audioSource: 'mic', audioSensitivity: 1.15,
                vortexEnabled: true, vortexStrength: 1.0, vortexRadius: 22.0, vortexCenter: { x: 32, y: 32 },
                orbitEnabled: true, orbitAxis: 'z', orbitRadius: 24.0, orbitStrength: 0.8,
                curlEnabled: false,
                waveEnabled: true, waveAxis: 'y', waveAmplitude: 0.4, waveScale: 0.12, waveSpeed: 1.4,
                renderMode: 'surface', worldScale: 2.0,
                bloom: true, bloomStrength: 1.0, bloomRadius: 0.95, bloomThreshold: 0.0012,
                dofEnabled: true, dofFocus: 1.0, dofRange: 0.22, dofAmount: 0.8,
                gravity: 0, speed: 1.8, density: 1.2,
            },
        };
    }
}
export const conf = new Conf();






