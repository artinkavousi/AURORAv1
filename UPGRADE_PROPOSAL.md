# Flow v1 — Upgrade Proposal (Physics, Audio Reactivity, Post FX, UI)

## Vision
- Deliver a fluid, lively, sound-reactive particle and material simulation using a robust MLS‑MPM/APIC core on WebGPU, with a clean, modular control surface and a unified, performant post‑FX pipeline.

## Current State (Summary)
- Rendering: Three.js WebGPU + TSL nodes; instanced mesh, glyph, and points renderers.
- Simulation: GPU compute (TSL) for MLS‑MPM‑style P2G/G2P with fixed‑point atomics; optional SDF collisions (sphere/dodeca), jet and vortex fields, pointer forces.
- UI: Tweakpane panel with good grouping and initial glassmorphism container.
- Post FX: BloomNode + DepthOfFieldNode (with fallback DOF).

## Gaps / Issues
- Physics/APIC:
  - P2G velocity contribution double‑counts `v` when blending with APIC term; APIC weighting should be additive, not `v + blended`.
  - No velocity cap or CFL‑like control → instability under strong fields.
  - No clamping on affine `C` or dissipation options → can cause explosions.
  - No XSPH or vorticity confinement; fluid can over‑diffuse or lose swirl.
- Audio Reactivity:
  - No audio engine, beat/onset/tempo tracking, or mapping to sim/visuals.
  - No smoothing/attack‑release envelopes to create musical motion.
- Post‑FX Pipeline:
  - Bloom + DOF only; no vignette, chromatic aberration, grain/noise, tone controls.
  - Not unified as configurable stack with performance fallbacks.
- UI/UX:
  - Single monolithic config object (good) but panels can be separated by concern.
  - Audio panel missing (source control, gains, smoothing, mappings).

## Goals
- Stabilize APIC/PIC and add guardrails (velocity clamp, substep governance).
- Add rich, smooth, musical reactivity with tempo/beat and spectral features.
- Unify post‑FX as a configurable stack with toggles and quality levels.
- Refine UI into clear panels with presets and quick “scene recipes”.

## Proposed Architecture & Changes

### 1) Physics Core (MLS‑MPM/APIC)
- P2G (APIC fix):
  - Use `gridVel += w * (v + apicBlend * (C * (xg - xp)))`.
  - Keep mass `+= w` as today; remove double add of `v`.
- G2P:
  - Keep `B = Σ w * v_g * (xg - xp)^T`; set `C = 4 * B` as implemented.
  - Add optional velocity clamp with uniform `maxVelocity` and simple normalization safeguard.
  - Add optional soft dissipation (blend velocity with neighbor average via XSPH‑like term) — follow‑up.
- Time Step / Stability:
  - Add `maxVelocity` cap uniform (UI slider) and `cflSafety` for dt cap; later integrate real CFL using max grid velocity reduction kernel.
- Collisions:
  - Keep SDF sphere/dodeca; add friction coefficient and restitution tunables later.
- Fields:
  - Keep jet/vortex fields; allow audio to modulate their strengths.

### 2) Audio Reactivity
- Audio Engine:
  - Web Audio pipeline with `AnalyserNode` (FFT) and features: RMS level, band energies (bass/mid/treble), spectral centroid, spectral flux for onsets/beat.
  - Smoothing (attack/decay envelopes) for stable parameter driving; tempo phase estimate for rhythmic pulsing.
- Mapping Layer:
  - Map features to: jet strength/radius, vortex strength, noise, apicBlend, viscosity, color saturation/hue, DOF parameters, and camera micro‑motion.
  - Provide gains and routing toggles in UI.
- Uniform Plumbing:
  - Add `audioBass`, `audioMid`, `audioTreble`, `audioLevel`, `audioBeat` uniforms to the sim; influence velocity impulses and color.

### 3) Post‑FX Pipeline
- Stack design:
  - Base: Color adjust (exposure already via renderer), Bloom, DOF (HQ/LQ), Vignette, Film Grain, Chromatic Aberration; toggles + quality settings.
  - Node‑based in TSL for WebGPU; graceful fallback to simpler math (LQ DOF already present).
- Defaults:
  - Keep Bloom + DOF; expose Vignette/Grain/CA in control panel.
- Reference examples:
  - three/examples WebGPU: BloomNode, DepthOfFieldNode (existing), misc. TSL examples; use custom nodes for vignette/grain/CA when needed.

### 4) UI Panels (Glassmorphism)
- Panels:
  - Rendering, Simulation, Physics, Fields, Audio, Post‑FX, Presets.
  - Audio panel with mic/file source, sensitivity, smoothing, per‑band gains, beat boost, and routing toggles.
- Presets:
  - Add audio‑reactive scene presets (e.g., “Bass Jet”, “Mid Vortex”, “Dance Surface”).

## Milestones & Deliverables
- M1: Physics stability pass
  - Fix APIC P2G blend; add velocity clamp; expose `maxVelocity` and `cflSafety`.
  - Acceptance: no blow‑ups at apicBlend ∈ [0,0.5], jets/vortex high for 30s; stable fps at default particle count.
- M2: Audio engine & mappings
  - Mic/file input; features + smoothing; uniform plumbing; basic mapping to jet/vortex/noise/color.
  - Acceptance: steady musical motion; parameters follow beat and band energy smoothly.
- M3: Post‑FX stack
  - Vignette, Grain, Chromatic Aberration toggles with quality controls; unified composition.
  - Acceptance: visual consistency; toggles on/off without artifacts; ~<1.5ms budget on mid‑tier GPU.
- M4: UI refinement
  - Panels reorganized; audio/post‑FX controls; presets saved/restored.
  - Acceptance: quick navigation; no overlaps; preset switching preserves mappings.

## Success Rubric
- Stability: No NaNs/explosions across presets; dt respected; consistent collisions.
- Reactivity: Beat‑aligned impulses; band‑driven motion feels natural; no jitter from aliasing.
- Visuals: Post‑FX stack interacts gracefully with scene; no over‑bloom/clipping; DOF blends naturally.
- Performance: 50–60 FPS desktop at 32–64k particles; mobile profile scales down automatically.

## Risks & Mitigations
- WebGPU feature variance → keep LQ fallbacks; avoid exotic extensions.
- Audio permissions (mic) → provide file upload alternative; clear UX prompts.
- APIC tuning → expose clamps and blend in UI; ship safe defaults.

## References
- APIC (Jiang et al.), MLS‑MPM papers for stable velocity transfer and affine update.
- Three.js WebGPU TSL examples: BloomNode, DepthOfFieldNode, postprocessing nodes.

