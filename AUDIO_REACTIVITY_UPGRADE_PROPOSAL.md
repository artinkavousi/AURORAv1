# Flow — Sound Reactivity Upgrade Proposal

## Objective
- Evolve audio reactivity into a polished, musical, and robust system that drives believable motion and visuals in sync with music while offering a dedicated, glass‑styled Audio control panel.

## Current Snapshot
- `src/audio/audioEngine.js`: Web Audio engine with FFT, band energies (bass/mid/treble), spectral centroid, spectral flux, simple adaptive beat gate, attack/release smoothing.
- `src/conf.js`: Main Tweakpane contains an Audio folder (source, sensitivity, smoothing, band gains, beat boost). Audio features are plumbed into runtime fields (e.g., `_audioLevel`, `_audioBeat`).
- Visual mapping already supports `colorMode: 'audio'` and physics fields (jet/vortex/noise/apicBlend) that can be audio‑driven.

## Goals
- Musical features: reliable onset/beat detection, basic tempo phase, multi‑band dynamics, loudness normalization.
- Motion quality: smooth, expressive impulses; no jitter; dynamics scale across quiet/loud sources.
- Visual richness: color and post‑FX breathe with music without clipping or eye fatigue.
- UX: a dedicated Audio panel with clear routing/mapping controls, real‑time meters, and presets.

## Deep Design (End‑to‑End)

### 1) Audio Signal Chain
- Input: mic or file → `AnalyserNode` (FFT) plus optional `DynamicsCompressorNode` (light AGC) → feature extractor.
- Windowing: implicit Hann via FFT is adequate; keep `fftSize=2048` for balance; allow 1024/4096 for low/high latency.
- Normalization: slow AGC on overall level to keep response musical across tracks; silence gate for noise floors.
- Smoothing: attack/decay per feature (not shared) with clamped ranges to avoid laggy or twitchy behavior.

### 2) Features (per frame)
- Level: average magnitude (existing) with slow AGC.
- Bands: bass [20–150 Hz], mid [150–2 kHz], treble [2–8 kHz] (existing). Optionally add octave bands or Mel bands later.
- Spectral centroid: 0..1 tilt for color mapping (existing).
- Spectral flux (onset): keep, but improve thresholding using median‑based adaptive threshold and per‑band flux for more robust beats.
- Beat gate: 2‑stage detector → onset candidate from flux → refractory period (`hold`) and decay envelope for smoother impulses.
- Tempo phase (lightweight): autocorrelation (ACF) of a short flux history (≈2–6 s), pick BPM in [80–180], track best lag with exponential averaging. Expose `tempoBpm` and `tempoPhase01` (0..1 ramp).

### 3) Mapping Layer
- Physics:
  - Jet strength/radius ← bass energy and/or beat impulse.
  - Vortex strength ← mid energy; radius slowly modulated by tempo phase.
  - Noise/turbulence ← treble energy; clamp to prevent flicker.
  - `apicBlend` ← mid/bass macro energy to enhance rotational character when the mix is dense.
  - Viscosity/dissipation ← inverse of transient energy (more flow when quiet, thicker when loud) with small range.
  - Max velocity safety: scale impulses by `physMaxVelocity` headroom to avoid explosions.
  - Emitter rate (if enabled) ← beat impulses for punctuation.
- Visuals:
  - Color: hue/temperature ← centroid; saturation ← combined energy; value ← level.
  - Post‑FX: subtle modulation of vignette, bloom threshold/gain, chromatic aberration and grain. Clamp ranges to avoid eye fatigue.
  - Camera micro‑motion: small dolly/roll on beat with per‑band routing and global cap.

### 4) Control Surface (Dedicated Panel)
- Dedicated glass‑styled pane separate from main settings, matching current style (rounded, blurred, subtle border, shadow).
- Sections:
  - Input: enable, source `mic|file`, input gain, monitor meters, choose file button.
  - Features: FFT size (1024/2048/4096), smoothing per feature (level/bass/mid/treble/beat), hold, sensitivity, AGC on/off.
  - Routing: per‑band gains and toggles for targets (Jet, Vortex, Noise, APIC, Viscosity, Color, DOF, Bloom, Camera).
  - Mappings: curves (linear, pow, smoothstep), clamps, and mix amounts for each target.
  - Tempo: enable, BPM display, phase preview, confidence.
  - Diagnostics: tiny spectrum and level meters, beat indicator, flux and threshold overlay.
  - Presets: “Bass Jet”, “Dance Surface”, “Ambient Wash”, “Perc Glitch”.

## Implementation Plan

### A) Audio Engine Enhancements
- Per‑feature envelopes: store `attack/release` per feature.
- Median thresholding for flux: compute rolling median/mean of recent flux to set adaptive threshold; maintain refractory `hold`.
- Tempo estimation: rolling flux buffer (2–6 s) → autocorrelation; pick BPM with HWR weighting and simple comb filter peak pick.
- Slow AGC: level normalizer with target RMS and cap; expose `agcAmount`.
- Silence gate: if level < `gate` for N frames, fade out beats to 0.

Proposed additions to `src/audio/audioEngine.js`:
- `setFeatureSmoothing({ level, bass, mid, treble, beat })`.
- `setFluxThreshold({ method: 'avg|median', k: number })`.
- `enableTempo(true/false)`, expose `tempoBpm`, `tempoPhase01`, `tempoConf`.
- `setAgc(amount)`, `setGate(level, hold)`.

### B) Mapping & Routing
- New module `src/audio/router.js` manages mapping from features → simulation/visual uniforms with per‑route gain/curve/clamp and enables.
- Example targets and default routes:
  - `bass → jetStrength`, `mid → vortexStrength`, `treble → noise`.
  - `flux/beat → impulse scale` for fields and emitter bursts.
  - `centroid → color hue`, `level → saturation`.
- Provide a single `applyAudioToSim(features, conf, uniforms)` entry used in the frame loop.

### C) Dedicated Audio Panel
- New file `src/ui/audioPanel.js`: creates its own DOM container (same glassmorphism), attaches a Tweakpane instance with sections above.
- Remove or collapse the Audio folder from the main panel to avoid duplication; main panel keeps a summary toggle.
- Add realtime mini‑meters (canvas blades) for level/spectrum and a beat LED.

### D) Integration Points
- `app.js`: instantiate `AudioEngine`, `AudioRouter`, `AudioPanel`; wire `onUpload` for file input. Update per frame (`engine.update(dt)` → `router.apply(...)`).
- `conf.js`: keep runtime mirror fields (`_audioLevel`, etc.) for display and presets. Expose new audio preset fields and routing preset save/load.

### E) Performance & Safety
- Reuse typed arrays; avoid allocations per frame.
- Keep FFT size selectable; default 2048. Maintain ~≤0.5 ms CPU at 60 FPS on desktop.
- Clamp all mappings with conservative defaults; add global audio influence master to disable quickly.
- Guard physics with `physMaxVelocity` and `cflSafety`—scale impulses rather than exceed caps.

## Pseudocode Sketches

### Spectral Flux + Median Threshold
```
flux = sum(max(mag[i] - prev[i], 0))
median = median(lastFluxWindow)
thr = median * k  // k ≈ 1.3–2.2
beatGate = flux > thr && (now - lastBeat) > hold
env.beat = attackRelease(beatGate ? 1 : 0)
```

### Tempo via Autocorrelation
```
acf = autocorr(lastFluxWindow)
bpmCandidates = peaksToBpm(acf, sr=frameRate)
best = select in [80..180] with harmonic weighting
tempoBpm = lerp(tempoBpm, best, 0.1)
tempoPhase01 = fract(tempoPhase01 + dt * tempoBpm / 60)
```

### Mapping Example
```
jetStrength = baseJet + gainBass * pow(bass, curve)
if (beat) jetStrength += beatBoost
vortexStrength = baseVortex + gainMid * mid
noise = baseNoise + gainTreble * smoothstep(lo, hi, treble)
apicBlend = baseApic + gainMix * clamp(level - quiet, 0, 1)
``` 

## Dedicated Audio Panel Layout
- Position: bottom‑right (or left) to avoid overlap with main panel.
- Style: same as main panel container (radius 12px, blur, border, shadow).
- Controls:
  - Input: `enable`, `source`, `inputGain`, `Choose File`.
  - Features: `fftSize`, `agcAmount`, `gateLevel`, `attack/release` per feature, `hold`, `thrK`.
  - Routing: toggles and gains per target, plus curves: `linear|pow1.5|pow2|smoothstep`.
  - Tempo: `enable`, BPM readout, confidence bar, phase lamp.
  - Diagnostics: Level bar, spectrum mini‑plot, flux vs threshold, beat lamp.
  - Presets: save/load; built‑ins: Bass Jet, Dance Surface, Ambient Wash, Perc Glitch.

## Milestones
- M1 — Engine stability and features (1–2 days)
  - Per‑feature smoothing, median thresholding, AGC/gate, selectable FFT size.
  - Acceptance: stable meters; no jitter; CPU ≤ 0.5 ms @ 60 FPS.
- M2 — Tempo + Routing (1–2 days)
  - ACF tempo with phase; router with per‑route gains/curves/clamps.
  - Acceptance: consistent phase; easy re‑routing; no physics blow‑ups with safe defaults.
- M3 — Dedicated Panel (1 day)
  - Separate pane + diagnostics; remove duplication in main panel.
  - Acceptance: visual parity with style; intuitive navigation; presets work.
- M4 — Visual polish (0.5–1 day)
  - Color mapping, subtle post‑FX modulation; camera micro‑motion caps.
  - Acceptance: pleasing, non‑fatiguing visuals across genres.

## Success Rubric
- Stability: no NaNs; physics remains bounded under loud inputs; beats never spam within `hold`.
- Musicality: impulses align with perceived beat; tempo stays within ±3 BPM on steady material; no aliasing flicker.
- Visual balance: post‑FX and color feel lively yet controlled; no over‑bloom or clipping.
- Performance: desktop 50–60 FPS with 32–64k particles; audio CPU overhead ≤ 1% on mid‑tier CPU.
- UX: dedicated panel is discoverable, coherent, and matches the existing glass style; presets are practical.

## Files to Add/Modify (Plan)
- `src/audio/audioEngine.js`: add per‑feature smoothing, median thresholding, AGC/gate, optional tempo estimation.
- `src/audio/router.js`: new; route features → sim/visuals with gains, curves, clamps, and toggles.
- `src/ui/audioPanel.js`: new; dedicated Audio control pane matching current style.
- `src/app.js`: integrate engine, router, and panel; feed features into uniforms and fields.
- `src/conf.js`: keep runtime mirrors; optionally collapse the existing Audio folder when the new panel is active.

## Notes
- Keep defaults conservative; ship a “Photo Mode + Audio” preset that feels good on most tracks.
- Provide quick kill‑switches: master audio enable, master influence, and per‑route toggles.

