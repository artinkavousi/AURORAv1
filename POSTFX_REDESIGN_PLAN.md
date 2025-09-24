## PostFX Redesign — Lens DOF, Bokeh, and Unified FX (TSL/WebGPU)

### Vision
- Deliver physically-inspired, production-grade DOF/bokeh with wide focus latitude and aesthetic control.
- Establish a clean, conflict-free TSL node pipeline that composes lens effects and other post FX deterministically.
- Provide a focused control panel exposing only high-impact, musically meaningful parameters.

### Rubric (Acceptance Criteria)
- Quality: Smooth bokeh with controllable shape (blades, rotation, curvature), stable wide CoC range, highlight handling.
- Determinism: Single pipeline owner; no overlapping/duplicate passes; strict ordering: Lens → Bloom → Vignette/Grade → Optional CA/Grain → AA.
- Performance: Resolution scaling for DOF; async node composition; no redundant full-screen passes.
- UX: One “Lens Focus & Bokeh (TSL)” panel and one “Post FX” panel; parameters are grouped, minimal, and responsive.
- Integration: Works with existing `Stage`, renderers, and config. Legacy keys mapped for preset compatibility.

### Architecture
- `src/post/CameraLensFX.js`: Encapsulates lens focus, bokeh, and CoC shaping as TSL nodes built around `DepthOfFieldNode`.
  - Inputs: scene color, viewZ/depth.
  - Controls: focus distance/range, bokeh amount, near/far boost, highlight gating, aperture shape, anamorphic, blend curve, bleed, quality.
  - Output: composed color with DOF blend and CoC mask.
- `src/post/PostFXPipeline.js`: Orchestrates scene pass and node composition.
  - Scene MRT simplified to color+depth (viewZ). Lens output converted to texture.
  - Bloom (soft-knee) applied to composed color; Vignette and Grade integrated in the composite node; optional CA and Film.
  - Single `THREE.PostProcessing` with `outputNode` set to the final composed node; `renderAsync()` is the only render path.

### Pipeline Order
1. Scene pass (color, viewZ)
2. Lens DOF/Bokeh compose (CameraLensFX)
3. Bloom (soft-knee prefilter)
4. Vignette → Color Grade (sat, contrast, lift)
5. Optional Chromatic Aberration → Film Grain
6. Final AA (SMAA optional)

### Parameters (final exposed)
- Lens Focus & Bokeh
  - focusMode: pointer | manual
  - focusDistance, focusRange, focusSmoothing
  - bokehAmount, nearBoost, farBoost
  - highlightThreshold, highlightGain, highlightSoftness
  - apertureBlades, apertureRotation, apertureCurvature, anamorphic
  - maxCoC, blendCurve, bleed, quality (internal scale)
  - Physical block (optional): focalLength, fStop, sensorWidth/Height/Aspect, cocLimit, bokehScale, driveFov
- Post FX
  - Bloom: enabled, strength, radius, threshold, mix
  - Vignette: enabled, amount
  - Grade: saturation, contrast, lift
  - Chromatic Aberration: enabled, amount, scale, center
  - Film Grain: enabled, amount
  - AA: off | smaa (optional)

### UI Structure
- Panel 1: “lens focus & bokeh (TSL)” mapping to `lens*` keys.
- Panel 2: “post fx” with subfolders Bloom, Vignette, Grading, Chromatic, Grain, AA.
- Legacy controls hidden; presets still load (legacy keys are mapped in code).

### Migration Plan
1. Remove legacy `src/postfx.js` and references. (Done)
2. Integrate `PostFXPipeline` in `app.js`. (Done)
3. Map legacy `dof*`, `bokeh*`, and `bloom` keys to new `lens*` and `fx*` in `updateFromConfig`. (Done)
4. Update `conf.js` panel bindings to `lens*` and `fxBloom*`. Hide duplicates. (Done)
5. Keep presets backward-compatible; plan a future pass to migrate presets to new keys.

### Risks & Mitigations
- Preset drift: Legacy presets use `dof*`/`bloom`. Mitigated by mapping layer.
- Performance on low-end: DOF `quality` scales internal resolution; consider auto downscale under load.
- Ordering bugs: All composition occurs in one deterministic path; AA applied at the end.

### Next Enhancements (Optional)
- Add pointer-depth sampling for focus (raycast depth buffer) to refine pointer mode.
- Add camera motion-aware exposure and adaptive bloom mix.
- Offer physical lens presets (35mm f/1.4, 85mm f/2.0, etc.).



