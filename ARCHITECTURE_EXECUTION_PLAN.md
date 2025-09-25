# Aurora v1 Refactor Execution Plan

## Objectives
- Deliver a consolidated, modular, ESM-first runtime that keeps feature slices self-contained yet composable.
- Reduce redundant scripts by collapsing related logic into dense, capability-focused modules (stage, simulation, post-processing, camera/lens, materials, audio, configuration).
- Establish a maintainable Node/Vite build and tooling workflow (TSL operator, linting, typed config) that supports hot-swappable component loading.
- Provide a phased rollout strategy that minimizes downtime while enabling incremental verification.

## Architecture Overview
### Runtime Composition
| Module | Responsibility | Key Contracts |
| --- | --- | --- |
| `core/stage` | Scene graph, renderer, controls, environment HDR workflow. | `init(progress)`, `update(delta, elapsed)`, `resize(width, height)`, exposes `scene`, `camera`, `lights`. |
| `core/simulation` | MLS-MPM compute pipeline, buffers, material profiles, domain settings. | `init()`, `update(dt)`, `applyConfig(snapshot)`, event hooks for emitters/boundaries. |
| `core/postfx` | Post-processing graph (bloom, lens, grading). | `init(stage)`, `render(scene, camera, targets)`, `updateConfig(snapshot)`. |
| `core/audio` | Audio engine, feature extraction, router bridging to simulation/post. | `init()`, `update(dt)`, `applyConfig(audioConfig)`, `bindRouter(router)`. |
| `core/camera` | Camera/lens orchestration, focus automation, cinematic framing utilities. | `attach(stage)`, `update(dt, features)`, `applyLensProfile(profile)`. |
| `core/materials` | Material factory/registry (glass, particle, glyph, boundary). | `get(materialId, ctx)`, `updateParams(materialId, params)`. |
| `core/config` | Layered configuration service (defaults, presets, runtime overrides, UI bindings). | `snapshot(domain)`, `subscribe(domain, handler)`, `commit(domain, mutation)`. |
| `core/pipeline` | Bootstrapper that wires all modules, manages lifecycle events, exposes runtime façade for the UI layer. | `createRuntime(renderer, options)`, `start()`, `dispose()`. |

### Data + Control Flow
1. `core/config` owns the authoritative config graph; feature panels push mutations which emit structured snapshots.
2. `core/pipeline` receives config deltas, pushes them to feature modules, and coordinates frame updates.
3. Simulation publishes metrics (particle count, domain extents) to `core/stage` and `core/camera` for adaptive framing.
4. `core/audio` extracts band/transient features that drive simulation emitters and post FX intensity mapping through router contracts.
5. `core/postfx` renders using inputs from stage (main render target) and audio/simulation cues for effect weighting.

## Tooling & Build Workflow
- **Module Format**: Source authored as `.js` ESM modules with typed JSDoc blocks; future phases can migrate high-churn areas to `.ts` without altering bundler settings.
- **TSL Pipeline**: Keep Vite + `vite-plugin-tsl-operator` for shader authoring; add lint rule to ensure modules export typed shader descriptors.
- **Quality Gates**: Introduce `npm run lint` (ESLint + `@typescript-eslint/parser` in JS mode) and `npm run typecheck` (TypeScript in `checkJs` mode) before enabling full TS migration.
- **Testing Harness**: Stand up minimal vitest-based smoke tests for module contracts (stage config diffing, audio router wiring) to catch regressions quickly.

## Migration Phases
### Phase 0 — Planning (Complete)
- Finalize architecture slices, contracts, and tooling requirements.
- Prepare execution roadmap and risk log.

### Phase 1 — Runtime Core Extraction *(Complete)*
- [x] Draft execution plan (this document).
- [x] Carve `core/stage` module from legacy `src/stage.js`, introducing config snapshot helpers. *(Delivered via `src/modules/StageModule.ts`)*
- [x] Establish `core/config` utilities that normalize environment/camera params. *(Delivered via `src/core/ConfigStore.ts` + `valueAccess.ts`)*
- [x] Create runtime bootstrapper that instantiates feature modules and injects renderer dependencies. *(Delivered via `src/core/AppHost.ts`)*

### Phase 2 — Simulation & Materials Consolidation *(Complete)*
- [x] Migrate MLS-MPM orchestration behind a reusable module surface. *(Delivered via `src/modules/PhysicsModule.ts`)*
- [x] Build material registry with lazy creation and caching hooks. *(Delivered via `src/modules/MaterialModule.ts`)*

### Phase 3 — Audio & Post FX Harmonization *(Complete)*
- [x] Relocate audio engine/router to a dedicated module with config bridging. *(Delivered via `src/modules/AudioModule.ts`)*
- [x] Refactor the post-processing stack behind a module contract. *(Delivered via `src/modules/PostFxModule.ts` + `src/post/CinematicPipeline.js` integration)*

### Phase 4 — Camera/Lens Systemization *(Complete)*
- [x] Extract camera automation into a standalone module aligned with lens/post pipelines. *(Delivered via `src/modules/CameraModule.ts`)*
- [x] Provide focus strategies driven by config + diagnostics. *(Camera module publishes focus metrics consumed by Info overlay.)*

### Phase 5 — Pipeline Orchestration & Cleanup *(Complete)*
- [x] Replace `App` monolith with modular runtime façade consumed by the Vite entry. *(Delivered via `src/core/AppHost.ts` + `index.ts` integration)*
- [x] Remove redundant handlers, wire diagnostics, and document module contracts.

## Task Breakdown & Milestones
| Milestone | Key Tasks | Success Criteria |
| --- | --- | --- |
| M1: Stage Core | Extract stage module, environment config helpers, HDR boot workflow. | App boots via `core/stage`, autop-fit + lighting remain functional. |
| M2: Config Foundation | Config snapshot service, preset loading, module subscription bus. | Modules receive diffed config updates without direct `conf` coupling. |
| M3: Simulation Suite | Consolidated MLS-MPM runtime with material registry. | Particle/glyph renderers run via new interfaces; tests cover domain scaling. |
| M4: Audio/Post Synergy | Audio features routed to simulation/post modules via typed contracts. | Audio responsiveness preserved; post FX responds to features. |
| M5: Pipeline Finalization | Runtime façade, UI integration, lint/type gates. | Build passes lint/typecheck, docs updated, redundant scripts removed. |

## Risk & Mitigation
- **Regression Risk**: Incremental extraction with contract-based adapters and targeted smoke tests per milestone.
- **Build Breakage**: Introduce lint/type scripts behind npm script toggles to stage adoption without blocking.
- **Performance Drift**: Track FPS metrics before/after each migration; maintain performance toggles in config service.
- **Timeline Creep**: Enforce ≤5 file scope per subtask, commit atomic slices, and update `AGENT_NOTES.md` with progress snapshots.

## Next Steps
1. Capture GPU/CPU baselines for the modular runtime and document performance envelopes per module.
2. Add Vitest smoke tests for config serialization, module registry disposal, and audio routing fallbacks.
3. Wrap UI panel migration onto the config store to retire remaining legacy tweakpane glue.
4. Schedule a final verification pass (typecheck → lint → build) before tagging the refactor release.

## Implementation Status Snapshot
| Domain | Module | Status | Key Files |
| --- | --- | --- | --- |
| Stage & Environment | `StageModule` | ✅ Completed | `src/modules/StageModule.ts`, `src/backgroundGeometry.js`, `src/lights.js` |
| Simulation & Rendering | `PhysicsModule` / `MaterialModule` | ✅ Completed | `src/modules/PhysicsModule.ts`, `src/modules/MaterialModule.ts`, `src/mls-mpm/*` |
| Post Processing | `PostFxModule` | ✅ Completed | `src/modules/PostFxModule.ts`, `src/post/CinematicPipeline.js` |
| Audio | `AudioModule` | ✅ Completed | `src/modules/AudioModule.ts`, `src/audio/*`, `src/ui/audioPanel.js` |
| Camera | `CameraModule` | ✅ Completed | `src/modules/CameraModule.ts` |
| Pipeline & Tooling | `AppHost` & Core Services | ✅ Completed | `src/core/AppHost.ts`, `src/core/*`, `index.ts` |

## Verification Summary
- Runtime boots through the modular `AppHost` from `index.ts` with WebGPU renderer initialization.
- `npm run build`, `npm run lint`, and `npm run check` validate the TypeScript + ESLint toolchain for the refactored modules.
- Diagnostics overlay reports FPS, particle totals, world scale, and audio status directly from the module registry contracts.
