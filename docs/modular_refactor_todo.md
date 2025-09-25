# Aurora v1 Modular Pipeline Implementation Plan (Rev. 2)

## Current State Snapshot
- The runtime boots through `AppHost` and composes feature modules (`Stage`, `Physics`, `Material`, `PostFx`, `Audio`, `Camera`) via the registry/event bus introduced during the redesign.
- Legacy JavaScript helpers (stage geometry/lights, MLS-MPM renderers, audio engine/router/panel, tweakpane info/conf) have been moved into colocated TypeScript modules so each feature owns its implementation and can participate in strict builds.
- Post-processing is routed through the modular cinematic pipeline and now returns stage overrides instead of mutating globals, but physics/material subsystems still subscribe to the legacy `conf` snapshot for the majority of uniforms.
- The Zod-backed config store exists with schemas for stage, simulation, post, and audio, yet the bulk of runtime writes remain flat keys (`conf`). Presets and tweakpane panels still target those legacy keys directly.
- UI remains tweakpane-driven; there is no modular UI layer or React/Lit host as proposed in the redesign. Upload hooks, router editing, and diagnostics still live inside imperative tweakpane pages.

## Gap Analysis vs. Redesign Goals
1. **Config Convergence** – Structured config snapshots should be the single source of truth. Simulation/material/post modules must consume adapters emitted from the store rather than pulling directly from `conf`.
2. **Module Encapsulation** – Each feature module needs typed contracts for the services it exposes (materials, simulation, audio routing) and lifecycle hooks (pause/resume, hot reload) to enable runtime composition.
3. **UI Modernization** – Replace tweakpane panels with a UI module that binds to the config store, exposes preset switching, and surfaces diagnostics/telemetry in a declarative framework.
4. **Preset & Asset Pipeline** – Presets must be regenerated against the Zod schema with validation, and asset loading should move behind async adapters instead of inline loader wiring.
5. **Quality Gates** – Establish automated smoke tests for module wiring/config serialization and ensure lint/type/test/build run in CI.

## Phase Plan
### Phase 1 – Config + Adapter Alignment
- Draft adapters for simulation/material/audio akin to the `post` adapter so modules only receive structured snapshots.
- Introduce a migration layer that mirrors legacy flat keys to the new schema during rollout; remove when parity verified.
- Delete `conf` once all modules and presets read/write structured config.

### Phase 2 – Module API Hardening
- Extend `ModuleRegistry` to expose typed handles (e.g., `simulation.renderers`, `audio.services`) with lifecycle guards.
- Split renderer/material provisioning into explicit factories instead of registry mutations inside modules.
- Add teardown semantics for audio/post to support hot swaps and pause/resume.

### Phase 3 – UI Module Delivery
- Stand up `UiModule` (React/Lit) that renders configuration panels, preset browser, diagnostics, and upload hooks.
- Route tweakpane-specific code paths through the new module and retire tweakpane dependencies.
- Document UI contracts alongside module APIs for third-party integration.

### Phase 4 – Preset & Asset Workflow
- Rebuild presets against structured config; add validation to ensure stored presets conform to schema.
- Provide asset manifest/loader utilities so stage/background/audio resources are declared, not inlined.
- Automate preset generation and asset checks in npm scripts.

### Phase 5 – Quality & Tooling
- Add Vitest smoke tests covering config adapters, module registry wiring, and audio routing fallbacks.
- Introduce `npm run verify` umbrella (lint + type + test + build) and wire into CI.
- Document verification checklist in `docs/` and update CONTRIBUTING if present.

## Immediate Work Queue
1. **Simulation adapter spike** – Map `config.simulation` → MLS-MPM uniforms/material channels, gate behind feature flag until parity confirmed.
2. **Preset migration** – Convert existing JSON presets to structured schema via script, add validation command.
3. **UI module scaffold** – Create `UiModule` shell that reads the config store and replaces tweakpane entry for audio diagnostics first.
4. **Module notes** – Update developer docs to describe service contracts and how to consume them from external features.

Maintaining this phased plan while iteratively validating with `npm run check`/`npm run lint` keeps the modernization incremental yet cohesive.
