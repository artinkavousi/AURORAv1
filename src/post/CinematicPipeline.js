import * as THREE from "three";
import { PostProcessing } from 'three/webgpu';
import {
  float,
  Fn,
  mrt,
  output,
  pass,
  vec2,
  vec3,
  vec4,
  uv,
  texture,
  uniform,
  clamp,
  mix,
  convertToTexture,
  step,
  acos,
  sign,
  cos,
  abs,
  normalize
} from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import DepthOfFieldNode from "three/examples/jsm/tsl/display/DepthOfFieldNode.js";

const DEFAULT_SENSOR_ASPECT = 36 / 24;
const MM_TO_M = 0.001;

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computePhysicalLensState(focusDistance, settings) {
  const focalMM = clampNumber(settings.focalLength ?? 35, 4, 200);
  const fStop = clampNumber(settings.fStop ?? 1.8, 0.5, 32);
  const sensorWidth = clampNumber(settings.sensorWidth ?? 36, 4, 70);
  const sensorHeight = clampNumber(
    settings.sensorHeight ?? sensorWidth / (settings.sensorAspect ?? DEFAULT_SENSOR_ASPECT),
    4,
    70
  );
  const cocLimit = clampNumber(settings.cocLimit ?? 0.03, 0.005, 0.5);
  const bokehScale = clampNumber(settings.bokehScale ?? 1.0, 0.1, 4.0);

  const focalM = focalMM * MM_TO_M;
  const focusM = Math.max(focalM + 0.01, focusDistance);
  const cocM = cocLimit * MM_TO_M;
  const hyperfocalM = (focalM * focalM) / (fStop * cocM) + focalM;

  const nearM = (focusM * (hyperfocalM - focalM)) / Math.max(1e-5, hyperfocalM + (focusM - focalM));
  let farM = Number.POSITIVE_INFINITY;
  if (hyperfocalM > focusM) {
    farM = (focusM * (hyperfocalM - focalM)) / Math.max(1e-5, hyperfocalM - (focusM - focalM));
  }

  const focusRange = isFinite(farM)
    ? clampNumber((farM - nearM) * 0.5, 0.01, 5.0)
    : clampNumber((hyperfocalM - focusM) * 0.5, 0.01, 5.0);

  const crop = 36.0 / sensorWidth;
  const bokehStrength = clampNumber((focalMM / fStop) * crop * 0.02 * bokehScale, 0.05, 4.0);
  const nearBoost = clampNumber(0.8 + (focusM - nearM) / Math.max(focusM, 1e-3), 0.4, 3.5);
  const farBoost = isFinite(farM) ? clampNumber(0.8 + (farM - focusM) / Math.max(focusM, 1e-3), 0.4, 3.5) : 1.6;

  const cocEnvelope = clampNumber(focusRange * 0.9 + bokehStrength * 0.45, 0.2, 4.0);
  const blendCurve = clampNumber(1.2, 0.4, 4.0);
  const bleed = clampNumber(0.3, 0.0, 1.0);
  const highlightSoftness = clampNumber(0.15, 0.05, 0.35);

  return {
    focusDistance: focusM,
    focusRange,
    bokehStrength,
    nearBoost,
    farBoost,
    maxCoC: cocEnvelope,
    blendCurve,
    bleed,
    highlightSoftness
  };
}

class CinematicPipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.postProcessing = null;
    this.scenePass = null;
    this._stage = null;

    this._built = false;
    this._enabled = true;

    // Lens uniforms
    this._focusDist = uniform(1.0);
    this._focusRange = uniform(0.12);
    this._bokehAmount = uniform(1.0);
    this._nearBoost = uniform(1.0);
    this._farBoost = uniform(1.0);
    this._highlightThreshold = uniform(0.8);
    this._highlightGain = uniform(0.9);
    this._highlightSoftness = uniform(0.18);
    this._apertureBlades = uniform(9);
    this._apertureRotation = uniform(0.0);
    this._apertureCurvature = uniform(1.0);
    this._anamorphic = uniform(0.0);
    this._maxCoC = uniform(1.2);
    this._blendCurve = uniform(1.2);
    this._bleed = uniform(0.3);
    this._quality = uniform(1.0);
    this._lensEnabled = uniform(1.0);

    // FX uniforms
    this._bloomEnabled = uniform(1);
    this._bloomStrength = uniform(0.9);
    this._bloomRadius = uniform(0.65);
    this._bloomThreshold = uniform(0.0012);
    this._bloomMix = uniform(0.35);

    this._vignetteEnabled = uniform(0);
    this._vignetteAmount = uniform(0.2);

    this._gradeSaturation = uniform(1.0);
    this._gradeContrast = uniform(1.0);
    this._gradeLift = uniform(0.0);

    this._chromaticEnabled = uniform(0);
    this._chromaticAmount = uniform(0.0015);
    this._chromaticScale = uniform(1.1);
    this._chromaticCenter = uniform(new THREE.Vector2(0.5, 0.5));

    this._grainEnabled = uniform(0);
    this._grainAmount = uniform(0.08);

    // State
    this._focusMode = 'pointer';
    this._focusSmoothing = 0.2;
    this._viewMode = 'final';
  }

  async init(stage) {
    this._stage = stage;

    this.scenePass = pass(stage.scene, stage.camera);
    this.scenePass.setMRT(mrt({ output }));

    const sceneColor = this.scenePass.getTextureNode();
    this._sceneColorTex = convertToTexture(sceneColor);
    const viewZ = this.scenePass.getViewZNode('depth');
    const viewZAbs = abs(viewZ);

    // Lens DOF pipeline
    const st = uv();
    const lumW = vec3(0.2126, 0.7152, 0.0722);
    const colorSample = texture(sceneColor, st).rgb;
    const luminance = colorSample.dot(lumW);

    const hiUpper = clamp(this._highlightThreshold.add(this._highlightSoftness), float(0.0), float(1.0));
    const hiMask = clamp(luminance.sub(this._highlightThreshold).div(hiUpper.sub(this._highlightThreshold).max(float(1e-4))), float(0.0), float(1.0));
    const highlightGain = hiMask.mul(this._highlightGain).add(float(1.0));

    const farMask = clamp(step(this._focusDist, viewZAbs), float(0.0), float(1.0));
    const nearFarBoost = mix(this._nearBoost, this._farBoost, farMask);

    const dir = normalize(st.sub(vec2(0.5, 0.5)));
    const anamScale = this._anamorphic.mul(0.5).add(float(1.0));
    const scaledDir = normalize(vec2(dir.x.mul(anamScale), dir.y.div(anamScale)));
    const ang = acos(clamp(scaledDir.x, float(-1.0), float(1.0)))
      .mul(sign(scaledDir.y).max(float(0.0)).mul(float(2.0)).sub(float(1.0)))
      .add(this._apertureRotation);
    const polygon = clamp(abs(cos(ang.mul(this._apertureBlades))).pow(this._apertureCurvature), float(0.0), float(1.0));
    const apertureShape = polygon.mul(float(0.5)).add(float(0.75));

    const bokehScaleDynamic = this._bokehAmount
      .mul(nearFarBoost)
      .mul(highlightGain)
      .mul(apertureShape)
      .clamp(float(0.0), this._maxCoC.mul(float(2.0)));

    this._dofNode = new DepthOfFieldNode(
      sceneColor,
      viewZ,
      this._focusDist,
      this._focusRange,
      bokehScaleDynamic
    );
    const dofTex = this._dofNode.getTextureNode();
    // Strengthen DOF node parameters each frame from uniforms
    this._dofNode.focusDistanceNode = this._focusDist;
    this._dofNode.focusRangeNode = this._focusRange;
    this._dofNode.blurScaleNode = bokehScaleDynamic;

    const focusDelta = abs(viewZAbs.sub(this._focusDist));
    const rawCoC = clamp(
      focusDelta.div(this._focusRange.add(float(1e-4))),
      float(0.0),
      this._maxCoC
    );
    const normalizedCoC = rawCoC.div(this._maxCoC.add(float(1e-4)));
    const shapedCoC = clamp(normalizedCoC.pow(this._blendCurve), float(0.0), float(1.0));

    // Lens output: mix scene and DOF by lens enable and optional bleed
    this._sceneTexture = convertToTexture(sceneColor);
    const mixedLens = Fn(() => {
      const st = uv();
      const base = texture(this._sceneTexture, st).rgb.toVar();
      const dofRgb = texture(convertToTexture(dofTex), st).rgb;
      // Safety: if DOF output is near black, fall back to base
      const luma = dofRgb.dot(vec3(0.3333, 0.3333, 0.3333));
      const valid = step(float(0.0005), luma); // 0 when too dark
      const safeEnable = this._lensEnabled.mul(valid);
      // Use shaped CoC as blend weight so in-focus areas stay sharp
      const focusDelta = abs(viewZAbs.sub(this._focusDist));
      const rawCoC = clamp(
        focusDelta.div(this._focusRange.add(float(1e-4))),
        float(0.0),
        this._maxCoC
      );
      const normalizedCoC = rawCoC.div(this._maxCoC.add(float(1e-4)));
      const shaped = clamp(normalizedCoC.pow(this._blendCurve), float(0.0), float(1.0));
      const weight = clamp(safeEnable.mul(shaped), float(0.0), float(1.0));
      const lensMix = mix(base, dofRgb, weight).toVar();
      const withBleed = mix(lensMix, dofRgb, clamp(this._bleed, float(0.0), float(1.0)));
      return vec4(withBleed, float(1.0));
    })();
    this._lensTexture = convertToTexture(mixedLens);
    this._bloomNode = bloom(this._lensTexture);

    // Composite node with Vignette + Grade + Bloom mix
    const lensTex = this._lensTexture;
    const compositeNode = Fn(() => {
      const st = uv();
      let color = texture(lensTex, st).rgb.toVar();

      const bloomRGB = this._bloomNode.rgb.mul(this._bloomEnabled.mul(this._bloomMix));
      color.assign(color.add(bloomRGB));

      const offset = st.sub(vec2(0.5, 0.5));
      const vignette = clamp(
        float(1.0).sub(offset.length().pow(float(2.0)).mul(this._vignetteAmount)),
        float(0.0),
        float(1.0)
      );
      color.assign(mix(color, color.mul(vignette), this._vignetteEnabled));

      const luminance = color.dot(vec3(0.2126, 0.7152, 0.0722));
      const saturated = mix(vec3(luminance), color, this._gradeSaturation);
      const contrasted = saturated.sub(vec3(0.5)).mul(this._gradeContrast).add(vec3(0.5));
      const lifted = contrasted.add(this._gradeLift).clamp(float(0.0), float(1.0));

      return vec4(lifted, float(1.0));
    })();

    this._compositeTexture = convertToTexture(compositeNode);

    // Postprocessing
    this.postProcessing = new PostProcessing(this.renderer);
    this.postProcessing.outputColorTransform = false;
    this.postProcessing.outputNode = this._compositeTexture;

    this._built = true;
  }

  updateFromConfig(conf) {
    if (!conf) return;

    this._enabled = conf.postFxEnabled ?? this._enabled;

    // Lens mapping (logical)
    this._focusMode = conf.lensFocusMode ?? conf.focusMode ?? (conf.dofAutoFocus ? 'pointer' : 'manual');
    this._focusSmoothing = clampNumber(conf.lensFocusSmoothing ?? conf.focusSmooth ?? conf.focusSmoothing ?? 0.2, 0, 1);
    const manualFocus = Math.max(0.05, conf.lensFocusDistance ?? conf.focusDistance ?? conf.dofFocus ?? 1.0);
    if (this._focusMode !== 'pointer') this._focusDist.value = manualFocus;

    // Physical mapping
    if (conf.lensPhysicalEnabled) {
      const state = computePhysicalLensState(this._focusDist.value, {
        focalLength: conf.lensFocalLength,
        fStop: conf.lensFStop,
        sensorWidth: conf.lensSensorWidth,
        sensorHeight: conf.lensSensorHeight,
        sensorAspect: conf.lensSensorAspect,
        cocLimit: conf.lensCocLimit,
        bokehScale: conf.lensBokehScale
      });
      this._focusDist.value = state.focusDistance;
      this._focusRange.value = state.focusRange;
      this._bokehAmount.value = state.bokehStrength;
      this._nearBoost.value = state.nearBoost;
      this._farBoost.value = state.farBoost;
      this._maxCoC.value = state.maxCoC;
      this._blendCurve.value = state.blendCurve;
      this._bleed.value = state.bleed;
      this._highlightSoftness.value = state.highlightSoftness;
      if (conf.lensDriveFov) {
        const sw = clampNumber(conf.lensSensorWidth ?? 36, 4, 70);
        const sh = clampNumber(conf.lensSensorHeight ?? sw / (conf.lensSensorAspect ?? DEFAULT_SENSOR_ASPECT), 4, 70);
        const f = clampNumber(conf.lensFocalLength ?? 35, 4, 200);
        const horizontal = 2 * Math.atan(sw / (2 * f));
        const vertical = 2 * Math.atan(sh / (2 * f));
        conf.fov = THREE.MathUtils.radToDeg((horizontal + vertical) * 0.5);
      }
    } else {
      // Manual/legacy keys fallback
      this._focusRange.value = conf.lensFocusRange ?? conf.focusRange ?? conf.dofRange ?? this._focusRange.value;
      this._bokehAmount.value = conf.lensBokehAmount ?? conf.bokehStrength ?? conf.dofAmount ?? this._bokehAmount.value;
      this._nearBoost.value = conf.lensNearBoost ?? conf.focusNearBoost ?? conf.dofNearBoost ?? this._nearBoost.value;
      this._farBoost.value = conf.lensFarBoost ?? conf.focusFarBoost ?? conf.dofFarBoost ?? this._farBoost.value;
      this._highlightThreshold.value = conf.lensHighlightThreshold ?? conf.focusHighlightThreshold ?? conf.dofHighlightThreshold ?? this._highlightThreshold.value;
      this._highlightGain.value = conf.lensHighlightGain ?? conf.focusHighlightGain ?? conf.dofHighlightGain ?? this._highlightGain.value;
      this._highlightSoftness.value = conf.lensHighlightSoftness ?? conf.focusHighlightSoftness ?? conf.dofHighlightSoftness ?? this._highlightSoftness.value;
      this._apertureBlades.value = conf.lensApertureBlades ?? conf.bokehBlades ?? conf.apertureBlades ?? this._apertureBlades.value;
      this._apertureRotation.value = conf.lensApertureRotation ?? conf.bokehRotation ?? conf.apertureRotation ?? this._apertureRotation.value;
      this._apertureCurvature.value = conf.lensApertureCurvature ?? conf.bokehPetal ?? conf.aperturePetal ?? this._apertureCurvature.value;
      this._anamorphic.value = conf.lensAnamorphic ?? conf.bokehAnamorphic ?? conf.anamorphic ?? this._anamorphic.value;
      this._maxCoC.value = conf.lensMaxCoC ?? conf.dofMaxCoC ?? this._maxCoC.value;
      this._blendCurve.value = conf.lensBlendCurve ?? conf.dofBlendCurve ?? this._blendCurve.value;
      this._bleed.value = conf.lensBleed ?? conf.dofBleed ?? this._bleed.value;
      this._quality.value = conf.lensQuality ?? conf.dofQuality ?? this._quality.value;
    }

    // Toggle lens
    this._lensEnabled.value = (conf.lensFxEnabled ?? true) ? 1.0 : 0.0;

    // Auto-tune heuristics
    if (conf.lensAutoTune ?? true) {
      const fov = conf.fov ?? 60;
      const exposure = conf.exposure ?? 0.66;
      const fovScale = Math.max(0.6, Math.min(1.4, 60 / Math.max(20, fov)));
      const expScale = Math.max(0.8, Math.min(1.3, 0.9 + (exposure - 0.66)));
      this._focusRange.value = Math.max(0.06, Math.min(0.35, this._focusRange.value * fovScale));
      this._bokehAmount.value = Math.max(0.8, Math.min(1.8, this._bokehAmount.value * fovScale * expScale));
      this._maxCoC.value = Math.max(0.9, Math.min(1.8, this._maxCoC.value * fovScale));
      this._highlightGain.value = Math.max(0.5, Math.min(1.4, this._highlightGain.value * expScale));
    }

    // Bloom
    const bloomEnabled = (conf.fxBloomEnabled ?? conf.bloom ?? true);
    this._bloomEnabled.value = bloomEnabled ? 1 : 0;
    if (this._bloomNode) {
      this._bloomNode.strength.value = conf.fxBloomStrength ?? conf.bloomStrength ?? 0.9;
      this._bloomNode.radius.value = conf.fxBloomRadius ?? conf.bloomRadius ?? 0.65;
      this._bloomNode.threshold.value = conf.fxBloomThreshold ?? conf.bloomThreshold ?? 0.0012;
    }
    this._bloomMix.value = conf.fxBloomMix ?? 0.35;

    // Vignette & Grade
    this._vignetteEnabled.value = (conf.fxVignetteEnabled ?? conf.vignetteEnabled) ? 1 : 0;
    this._vignetteAmount.value = conf.fxVignetteAmount ?? conf.vignetteAmount ?? 0.2;
    this._gradeSaturation.value = conf.fxSaturation ?? conf.postSaturation ?? 1.0;
    this._gradeContrast.value = conf.fxContrast ?? conf.postContrast ?? 1.0;
    this._gradeLift.value = conf.fxLift ?? conf.postLift ?? 0.0;

    // Chromatic & Grain
    this._chromaticEnabled.value = (conf.fxChromaticEnabled ?? conf.chromaEnabled) ? 1 : 0;
    this._chromaticAmount.value = conf.fxChromaticAmount ?? conf.chromaAmount ?? 0.0015;
    this._chromaticScale.value = conf.fxChromaticScale ?? conf.chromaScale ?? 1.1;
    const chromaCenter = conf.fxChromaticCenter ?? conf.chromaCenter;
    if (chromaCenter) this._chromaticCenter.value.set(chromaCenter.x, chromaCenter.y);

    this._grainEnabled.value = (conf.fxGrainEnabled ?? conf.grainEnabled) ? 1 : 0;
    this._grainAmount.value = conf.fxGrainAmount ?? conf.grainAmount ?? 0.08;

    // View mode for debugging/inspection
    this._viewMode = conf.fxView || 'final';
  }

  pointerFocus(distance, smoothingOverride) {
    if (!this._built) return;
    if (this._focusMode !== 'pointer') return;
    const lerp = clampNumber(smoothingOverride ?? this._focusSmoothing ?? 0.2, 0, 1);
    const cur = this._focusDist.value;
    const target = Math.max(0.05, distance);
    this._focusDist.value = lerp > 0 ? cur * (1 - lerp) + target * lerp : target;
  }

  resize(width, height) {
    if (this._dofNode && this._dofNode.setSize) {
      const scale = clampNumber(this._quality.value ?? 1.0, 0.25, 1.0);
      this._dofNode.setSize(width * scale, height * scale);
    }
  }

  async renderAsync(enabledOverride) {
    if (!this._built) return;

    const usePost = typeof enabledOverride === 'boolean' ? enabledOverride : this._enabled;
    if (!usePost) {
      if (this._stage) await this.renderer.renderAsync(this._stage.scene, this._stage.camera);
      return;
    }

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.resize(size.width, size.height);

    let node;
    // View routing
    if (this._viewMode === 'scene') node = this._sceneTexture || this._sceneColorTex;
    else if (this._viewMode === 'lens') node = this._lensTexture;
    else node = this._compositeTexture;

    // Safety: if everything off, show scene
    if ((this._enabled ? 1 : 0) === 1 && this._lensEnabled.value < 0.5 && this._bloomEnabled.value < 0.5 && this._vignetteEnabled.value < 0.5) node = this._sceneTexture || this._sceneColorTex;

    // Chromatic aberration (final only)
    if (this._viewMode === 'final' && this._chromaticEnabled.value > 0.5) {
      const module = await import('three/examples/jsm/tsl/display/ChromaticAberrationNode.js');
      const chromaticAberration = module.chromaticAberration;
      node = chromaticAberration(
        node,
        this._chromaticAmount,
        this._chromaticCenter,
        this._chromaticScale
      );
    }

    // Film grain (final only)
    if (this._viewMode === 'final' && this._grainEnabled.value > 0.5) {
      const module = await import('three/examples/jsm/tsl/display/FilmNode.js');
      const film = module.film;
      node = film(node, this._grainAmount.mul(this._grainEnabled));
    }

    this.postProcessing.outputNode = node;
    await this.postProcessing.renderAsync();
  }
}

export default CinematicPipeline;


