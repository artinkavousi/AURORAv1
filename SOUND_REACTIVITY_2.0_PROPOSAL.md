# Flow - Sound Reactivity 2.0 Proposal

## Snapshot
- Code touchpoints: `src/audio/audioEngine.js`, `src/audio/router.js`, `src/ui/audioPanel.js`, `src/app.js`, `src/conf.js`, post-FX hooks inside `src/postfx.js`.
- Current feature set: single FFT band split (bass/mid/treble), global attack/release smoothing, spectral flux-based beat gate, light tempo guess, limited routing matrix.
- Existing UX: dedicated glass-styled Audio panel with meters, manual per-route source/gain configuration, presets stored in `conf`.

## Pain Points & Constraints
- Coarse feature space: three energy bands cannot describe complex mixes (pads vs percussion vs vocals) or spatial cues.
- Single envelope curve yields sluggish response for transients or jitter on sustained tones; lacks per-feature gestures.
- Limited musical context: tempo inference is binary and drifts; there is no bar/phrase awareness or swing.
- Routing rigidity: one source per target, no layering, no side-chaining between features; difficult to craft nuanced behaviours.
- Panel ergonomics: parameters cluster in one column; diagnostics lack spectrum/phase insight; presets do not preview behaviour.
- Extensibility: no abstraction for future machine-learning embeddings, LFOs, or external MIDI sync.

## Design Pillars
1. Musical intelligence - derive expressive descriptors (rhythmic, tonal, transient, spatial) and stabilise them across loudness ranges.
2. Dynamic orchestration - allow layered mappings, modulation curves, and time conditioning (e.g., per-beat, per-bar, rising/falling gestures).
3. Explorable UX - upgrade the panel into an audio playground with visual feedback, routing macros, and quick calibration.
4. Performance & predictability - sub-1 ms CPU budget, guard rails to avoid physics explosions, deterministic behaviour on same input.
5. Future-ready - architecture ready for optional modules (beat-grid tracker, stem analysis, ML embeddings, MIDI clock).

## Architecture Overview
```
Input (mic/file) 
  -> Calibrator (AGC, weighting, gating)
      -> Multi-Resolution FFT (2048 + 512) & psychoacoustic filterbank
          -> Feature Extractors (energy, transients, tonal, motion)
              -> Temporal Models (envelopes, beat tracker, tempo/bar phase, swing)
                  -> Orchestrator (mod matrix, gesture engine, macro states)
                      -> Flow Integration (physics uniforms, post-FX, camera, shaders)
```

## Feature Stack 2.0
- Dual-resolution FFT: run 2048-bin window for tonal cues plus 512-bin high-refresh for transient detection; share Hann window.
- Psychoacoustic filterbank: 8 Bark-inspired bands (sub, bass, low-mid, mid, hi-mid, presence, brilliance, air). Store both linear and log-averaged magnitudes.
- Transient analysis: per-band flux plus broadband crest factor -> detect hits, swells, ghost notes. Maintain `transientStrength`, `transientMap[band]`.
- Tonal & harmonicity: spectral centroid, tilt, roughness (even/odd bin difference), harmonic energy ratio -> map pads vs noise.
- Dynamic loudness: hybrid LUFS-style integrated level with configurable target (for example -12 LUFS). Provide `loudness`, `loudnessTrend`.
- Tempo grid: resilient multi-lag autocorrelation plus comb filter; maintain BPM, confidence, phase01, barPhase01 (4 beat cycle) and swing estimate via off-beat timing.
- Macro states: classify incoming energy into `impact`, `lift`, `fall`, `sustain` using derivative of smoothed level plus bar context (finite-state machine).
- Spatial hooks (optional): if stereo input available, compute side/mono energy, correlation -> map to camera sway or lighting spread.

## Orchestrator & Mapping
- Replace single-route map with Modulation Matrix:
  - Sources: `sub..air`, `bassTransient`, `midTransient`, `trebleTransient`, `beat`, `beatPulse`, `barPhase`, `swing`, `centroid`, `tilt`, `roughness`, `loudness`, `macroImpact`, etc.
  - Processors: curve shapes (pow, exp, sigmoid, smoothstep), bias/scale, lag, damping, step sequencer (per bar), random jitter.
  - Targets: simulation parameters (jets, vortices, curl, orbit, wave, viscosity, rest density, emission rate), camera offsets, color palette, post-FX (bloom, chroma, grain, vignette, DOF bias), glyph modes.
  - Each route: `enable`, `sources[]` (weighted blend), `curve`, `response` (`continuous`, `pulse`, `decay`), `min/max`, temporal condition (for example only on downbeats).
- Introduce Macro Automations:
  - Impact macro: short burst on strong transient (maps to particle emission, bloom spike, camera shake).
  - Lift macro: rising energy ramp over bar (maps to orbit radius, hue shift).
  - Fall macro: release of energy (maps to viscosity increase, fade to cooler colors).
  - Sustain macro: stable pad (maps to subtle camera drift, volumetric fog density).
- Provide `masterInfluence` (0..2) and per-target safe clamps referencing simulation safety thresholds (`physMaxVelocity`, `cflSafety`).

## Panel & UX Evolution
- Tabbed layout (Input, Features, Matrix, Gestures, Diagnostics, Presets).
- Input tab: enable, source, input gain, calibration wizard (auto-set sensitivity after analysing four seconds), monitor, file drop zone.
- Features tab: per-band gain/offset, envelope attack/release, transient sensitivity, tempo enable, swing amount, macro thresholds.
- Matrix tab: interactive grid (sources vs targets) with quick assign buttons, drag handles for weight/curve. Provide Learn mode to capture current settings.
- Gestures tab: configure macros (Impact/Lift/Fall/Sustain), beat skip ratios (for example every second beat), step sequencer for custom LFO.
- Diagnostics tab: real-time spectrum plot, band meters, flux vs threshold graph, BPM readout with confidence, macro state badges.
- Presets tab: curated banks (Bass Arena, Perc Sculpture, Vocal Bloom, Ambient Drift) plus user save/load. Show preview thumbnails (static JSON snapshot referencing recorded metrics).
- Panel sits in bottom-right by default; collapsible to pill when idle. Provide hotkey (A) to toggle and small audio indicator in HUD.

## Integration Touchpoints
- `audioEngine.js`: implement new feature stack, calibrator, dual-resolution FFT, macro state machine; expose typed arrays and metadata.
- `audio/router.js`: rewrite as `AudioOrchestrator` with modulation matrix, macro triggers, guard rails, preset loader.
- `audio/presets.js` (new): store default matrices, macros, smoothing templates.
- `ui/audioPanel.js`: rebuild UI with tabs, matrix control, calibration wizard, diagnostics canvases.
- `conf.js`: extend config with new audio fields, preset references, saved user matrices, runtime mirrors (`_audioBands`, `_audioTransient`, `_audioMacro`).
- `app.js`: adapt update loop to consume new features (array of bands), pass into orchestrator, sync macros and environment states.
- `postfx.js` plus `lens/LensPipeline`: add hooks for audio-driven DOF bias, bloom spikes, chroma jitter with safe clamps.

## Milestones & Deliverables
1. M1 - Engine Foundation (Day 0-1)
   - Dual FFT pipeline, filterbank, per-feature envelopes, loudness/AGC, transient extraction, swing-aware tempo tracker.
   - Deliver: updated `audioEngine.js`, validation harness logging features, unit tests for band integration (offline sample buffer).
2. M2 - Orchestrator Matrix (Day 1-2)
   - Mod matrix data model, curve processors, macro state machine, JSON preset schema, router integration in `app.js`.
   - Deliver: `audio/router.js`, default matrix presets, simulation safety clamps.
3. M3 - Panel 2.0 (Day 2-3)
   - Tabbed Tweakpane UI, diagnostics canvases, calibration wizard, preset management.
   - Deliver: `ui/audioPanel.js` overhaul, assets for icons if needed.
4. M4 - Visual & Post-FX Hooks (Day 3-4)
   - Map audio macros to DOF bias, bloom spikes, color palette, camera micro-motion.
   - Deliver: updates in `conf.js`, `postfx.js`, `lens` modules, optional shader uniforms.
5. M5 - Polish & QA (Day 4)
   - Performance profiling, fallback defaults, documentation update, smoke tests on mic and file input across genres.

## Success Rubric
- Responsiveness: transients reflected within less than one frame; sustained pads produce stable visuals (variance below five percent).
- Musical accuracy: BPM estimates within plus or minus two BPM for steady 4/4 tracks; swing detection within plus or minus five percent; macro classification above 85 percent accuracy on labelled validation clips.
- Visual coherence: default preset maintains bounded simulation (no NaNs) under loud inputs (down to -8 LUFS); camera and bloom modulation stay within comfort thresholds.
- Performance: audio processing under 0.8 ms per frame on desktop CPU (Apple M1 or Ryzen 5) at 60 FPS; panel interactions under 5 ms event cost.
- UX adoption: calibration completes in under six seconds; preset switch fully reconfigures matrix; matrix export/import works round-trip.

## Risks & Mitigations
- Processing overhead: dual FFT plus feature stack may exceed budget -> optimise with shared buffers, early-out on mute, WebAssembly fallback option.
- Tempo ambiguity: complex polyrhythms confuse tracker -> surface confidence, allow manual BPM override in panel.
- UI complexity: matrix could overwhelm users -> provide guided Blueprint presets and inline help tooltips.
- Physics overload: macros may push uniforms beyond safe ranges -> clamp via orchestrator, expose safety monitor in diagnostics.
- Browser compatibility: OffscreenCanvas or AudioWorklet features vary -> detect support and degrade gracefully (single FFT, simplified panel).

## Next Steps
1. Build lightweight offline test harness for audio feature validation (load reference stems, log metrics, compare against oracle).
2. Implement M1 (engine foundation), ensure backwards-compatible API for existing routes during transition.
3. Iterate on mod matrix plus panel concurrently with design snapshots, keeping preset JSON serialisation stable.
