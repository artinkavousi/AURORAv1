# Aurora v1 Modular Pipeline Implementation Plan

## Current State Snapshot
- The runtime boots through `AppHost` and a set of feature modules (`StageModule`, `PhysicsModule`, `MaterialModule`, `PostFxModule`, `AudioModule`, `CameraModule`), providing the orchestrator/event hub skeleton described in the redesign doc.【F:src/core/AppHost.ts†L1-L119】【F:src/modules/StageModule.ts†L1-L210】
- A `ConfigStore` backed by Zod schemas exists, but most subsystems still read/write flattened legacy keys (e.g. `postFxEnabled`, `audioEnabled`), so the structured state is effectively bypassed.【F:src/core/config/index.ts†L1-L210】【F:src/modules/PostFxModule.ts†L22-L28】【F:src/modules/AudioModule.ts†L62-L171】
- Simulation and rendering internals still consume the global `conf` singleton directly, so the new modular config is not driving uniforms or presets yet.【F:src/mls-mpm/mlsMpmSimulator.js†L1-L120】【F:src/presets/SimulationPresets.ts†L1-L39】
- Cinematic post-processing updates continue to depend on legacy config fields, preventing the new `post` schema from taking effect.【F:src/post/CinematicPipeline.js†L265-L366】
- No `UiModule` or modern UI layer is present; tweakpane panels operate on the legacy config object from imperative JavaScript.【F:src/ui/audioPanel.js†L1-L78】【F:src/modules/AudioModule.ts†L36-L90】
- Tooling stops at `tsc` + `eslint`; there is no automated testing, asset manifesting, or CI hooks called out in the redesign spec.【F:package.json†L1-L24】

## Gap Analysis vs. Redesign Doc
1. **Config unification** – Need to migrate all consumers from `conf`/flat keys to the hierarchical `ConfigStore`, expose derived state, and delete the singleton to avoid divergence.
2. **Module self-sufficiency** – Physics, post FX, and audio modules must internalize their setup/config mapping so they can be hot-swapped without implicit globals.
3. **UI modernization** – Build a `UiModule` (React or Lit) that binds to the config store/events instead of tweakpane scripting.
4. **Preset + asset pipeline** – Rebuild presets against the Zod schema and introduce asset preparation scripts per the redesign.
5. **Quality gates** – Add Vitest-based smoke tests, snapshot harnesses, and CI scripts to enforce lint/type/test/build.
6. **Bootstrap restructuring** – Introduce a `src/bootstrap/` entry layer to encapsulate renderer detection, leaving `index.ts` as a thin shell per the proposal.

## Proposed Workstreams & Milestones
1. **Config Migration Phase**
   - Create translation helpers that map structured `config.stage`, `config.simulation`, `config.post`, `config.audio` to the parameters expected by current modules.
   - Incrementally update `PostFxModule`, `CinematicPipeline`, `AudioModule`, MLS-MPM simulator, and presets to consume the structured snapshots; retire writes to ad-hoc keys.
   - Delete `conf.js` after the final consumer is refactored; adjust diagnostics to read from structured state.

2. **Module Hardening Phase**
   - Encapsulate material/shader configuration in `MaterialModule` with explicit APIs so physics/post modules request resources rather than touching globals.
   - Extend `ModuleRegistry` contracts for lifecycle hooks (pause/resume, hot reload) envisioned by the redesign.
   - Provide async teardown paths for audio/post to support dynamic swapping.

3. **UI & Interaction Phase**
   - Scaffold `src/modules/UiModule.tsx` using React (leveraging existing JSX support) with panels that read/write the config store and surface diagnostics.
   - Replace tweakpane bindings with React components; expose upload hooks and router controls via events/services.
   - Implement preset switching UI backed by the new presets API.

4. **Tooling & Pipeline Phase**
   - Add `scripts/` utilities for asset manifesting, bundle analysis, and preset generation.
   - Introduce Vitest with smoke tests covering config serialization, module registry wiring, and audio routing fallbacks.
   - Wire GitHub Actions (or npm `check` umbrella) to run lint, typecheck, tests, and build.

5. **Bootstrap & Deployment Phase**
   - Move renderer detection/startup into `src/bootstrap/main.ts` and expose worker entry stubs for future physics offloading.
   - Ensure `index.ts` only imports the bootstrap and handles DOM mounting, aligning with the modular entry expectations.
   - Document module contracts and lifecycle hooks in repo docs for onboarding.

## Immediate Next Steps
1. Implement a `PostConfigAdapter` that converts `config.post` into the structure required by `CinematicPipeline`, update `PostFxModule` to use it, and stop relying on `postFxEnabled`/legacy keys.
2. Mirror that approach for simulation by drafting a `SimulationConfigAdapter` feeding MLS-MPM uniforms, preparing for removal of `conf`.
3. Draft ADR-style documentation after each phase capturing decisions, risks, and follow-up actions.

These steps will align the live code with the redesign document while keeping the migration incremental and verifiable.
