# Aurora v1 Modular Pipeline & Architecture Redesign

## 1. Executive Summary
Aurora v1 currently relies on a tightly coupled collection of WebGPU/WebGL components orchestrated from `src/app.js`.  The codebase mixes scene setup, physics simulation, audio routing, UI control, and post-processing in large modules with implicit globals and ad-hoc configuration synchronization.  This proposal outlines a full refactor toward a TypeScript-first, ECMAScript module (ESM) architecture that is modular, hot-swappable, and optimized for both development velocity and runtime performance.  The redesigned system splits responsibilities into focused, standalone packages, introduces a consistent configuration pipeline, and adds robust tooling (build, lint, test) to keep the project healthy.

## 2. Current State Assessment
- **Monolithic orchestration** – `app.js` performs renderer creation, stage setup, simulation, audio, input, and post effects with limited abstraction boundaries.
- **Implicit configuration sync** – `conf.js` exports a mutable singleton that drives numerous subsystems via polling and timers (e.g., glass updates every 150ms).
- **Mixed module patterns** – CJS-style imports coexist with JSM utilities, preventing tree-shaking and complicating bundler configuration.
- **Sparse pipeline tooling** – No type checking, linting, or automated formatting.  Manual coordination is required to keep shader/script assets consistent.
- **Difficult composability** – Components such as the MLS-MPM simulators, post effects, and audio router cannot be reused outside the current runtime without extracting large dependent chains.

## 3. Refactor Goals
1. **Establish an explicit application shell** with dependency injection and lifecycle hooks so each domain module (stage, physics, audio, post FX, UI) can be loaded, swapped, or run independently.
2. **Adopt TypeScript everywhere** with strict type checking, leveraging Vite + ESBuild for fast HMR and production builds.
3. **Create a modular ESM package layout** that allows bundling of standalone features (e.g., physics-only demos, audio visualizer) with minimal configuration changes.
4. **Codify a unified configuration system** featuring schema validation, observable updates, and serialization for presets.
5. **Automate quality controls**: lint (ESLint + Prettier), typecheck, unit/regression tests, and GPU snapshot pipelines.
6. **Improve runtime flexibility** by isolating renderer layers, adding event-driven messaging, and supporting dynamic module loading for optional effects.

## 4. Proposed Top-Level Structure
```
src/
  core/
    AppHost.ts            # bootstraps renderer, lifecycle orchestration
    ModuleRegistry.ts     # registers feature modules + hot-swap hooks
    ConfigStore.ts        # schema + reactive store + persistence utilities
    EventHub.ts           # strongly typed event/messaging hub
    AssetPipeline.ts      # HDR/mesh/shader ingestion + cache
    Diagnostics.ts        # logging, profiling, frame metrics
  modules/
    StageModule.ts        # stage, lighting, camera, environment controls
    PhysicsModule.ts      # MLS-MPM solver, emitters, GPU renderers
    PostFxModule.ts       # post stack graph + built-in passes
    MaterialModule.ts     # shared shaders, material presets, texture cache
    AudioModule.ts        # audio engine, analyzers, routing surface
    UiModule.tsx          # config panels, HUD, bindings to ConfigStore
  presets/
    StagePresets.ts       # consolidated stage/env defaults
    PostFxPresets.ts      # lens/bloom/color packages
    SimulationPresets.ts  # physics/audio tuned bundles
  bootstrap/
    main.ts               # Vite entry + DOM mounting
    worker-entry.ts       # optional worker bootstrap for physics/audio

tests/
  unit/ ...
  integration/ ...

scripts/
  build.mjs
  check-types.mjs
  lint.mjs
  bundle-report.mjs

```

## 5. Module Responsibilities & Hot-Swap Strategy
- **App Host (`core/`)** – Lifecycle phases (`init`, `start`, `update`, `dispose`), dependency resolution, diagnostics, and renderer context live in a compact `AppHost.ts`.  The registry + host expose a tight `FeatureModule` interface with optional `reload(payload)` to keep hot-swap logic colocated with module metadata.
- **Stage Module (`modules/StageModule.ts`)** – Single dense module encapsulating stage graph, environment loaders, camera rigs, and lighting rigs.  Internal helper objects (e.g., `createStudioRig`, `setupHdrCache`) live in the same file, gated by small utility namespaces for locality.
- **Physics Module (`modules/PhysicsModule.ts`)** – Houses MLS-MPM solvers, emitter presets, and render paths in one orchestrator.  Sections are organized via inline `const sections = { solver: ..., renderer: ... }` patterns to keep logic together while preserving swap capability through exported factories.
- **PostFX Module (`modules/PostFxModule.ts`)** – Provides a compact frame-graph builder with embedded pass definitions (lens, bloom, chromatic, color grading, vignette) in a single file.  Additional passes register through declarative arrays rather than new files.
- **Material Module (`modules/MaterialModule.ts`)** – Consolidates shader chunks, GPU buffer templates, and material builders inside a curated map (`materialLibrary`) that other modules import.  Heavy shader strings live alongside builder functions for easier co-editing.
- **Audio Module (`modules/AudioModule.ts`)** – Manages Web Audio lifecycle, analyzer graphs, and routing within one dense module.  Analyzer configs are defined inline, enabling quick duplication or removal without touching separate files.
- **UI Module (`modules/UiModule.tsx`)** – Collocates panel definitions, control schemas, and HUD overlays in a single React/Lit-powered module.  Panels are described as declarative arrays that map to shared primitives, yielding modularity without extra files.
- **Config Store (`core/ConfigStore.ts`)** – Replaces the mutable `conf` singleton with a reactive store (Zustand, Vue signals, or custom) using typed schemas, persistence, and patch streaming in one cohesive surface.
- **Events & Messaging (`core/EventHub.ts`)** – Shared event bus for cross-domain signals (physics ready, audio beat, camera target changed) implemented as a compact typed emitter so consumption stays frictionless.

## 6. Tooling & Pipeline
### 6.1 TypeScript & Build
- Replace `src/**/*.js` with `.ts` / `.tsx`, ensuring compatibility with Vite + ESBuild (already configured for ESM).  Introduce a strict `tsconfig.json` targeting `ES2022` modules.
- Configure path aliases (e.g., `@core`, `@modules`) for clean imports and top-level tree shaking.
- Use Vite plugins for GLSL/WGSL imports and asset inlining.  Adopt the `vite-plugin-tsl-operator` already present, integrating it with typed shader modules.
- Provide separate build targets: `webgpu` (default), `fallback-webgl` (optional), and `headless` (for server-side pre-render).

### 6.2 Scripts & Automation
Add npm scripts and Node-based CLI utilities:
- `npm run dev` – start Vite with HMR (existing).
- `npm run build` – production build with bundle analyzer and type check.
- `npm run check` – run `tsc --noEmit`, ESLint, Prettier check, unit tests.
- `npm run lint` – ESLint with TypeScript parser, custom rules for shader usage.
- `npm run test` – Vitest + puppeteer-lite GPU smoke tests (headless).
- `npm run profile` – optional script launching Chrome trace for GPU passes.

### 6.3 Quality Gates
- ESLint config with domain-specific rules (forbid `any`, enforce module boundaries, detect accidental singleton usage).
- Prettier for formatting; configure `.editorconfig` to enforce spacing.
- Git hooks via Husky or simple npm scripts to run `check` before commit (optional for open-source).
- Set up GitHub Actions (or local `npm run ci`) executing lint, typecheck, build, and integration smoke (WebGL fallback) to maintain reliability.

### 6.4 Asset Pipeline
- Introduce `scripts/asset-manifest.mjs` to pre-compute HDR, mesh, and shader asset metadata for caching.
- Provide CLI for boundary import/export, enabling conversion to binary GPU-friendly formats (e.g., `.binmesh`).
- Add `tools/` folder for shader compilation tests and WGSL validation.

## 7. Configuration & Preset System
- Implement `ConfigSchema` (Zod) describing defaults and value ranges.
- Create `ConfigStore` with subscription-based updates and derived selectors.  Modules register watchers (e.g., Stage module listens to `env.*`).
- Provide serialization helpers for sharing presets (JSON) and migrating from the legacy `conf` object.
- Add versioned migrations to handle schema evolution.

## 8. Migration Strategy
1. **Foundations**
   - Initialize TypeScript, ESLint, Prettier, testing scaffolding.
   - Wrap existing `app.js` in a temporary TS entry (`main.ts`) while gradually porting modules.
2. **Config Refactor**
   - Introduce new Config store and gradually move consumers from `conf` to `configStore`.  Keep adapters for legacy code until fully migrated.
3. **Module Extraction**
   - Stage: fold camera/light/env logic into a dense `StageModule.ts` with internal helper maps.
   - Physics: collocate solver, emitter, and renderer sections inside `PhysicsModule.ts`; expose swappable factories rather than new files.
   - Audio: integrate engine/router/analyzer graphs into `AudioModule.ts` while preserving plug-in points through configuration arrays.
   - PostFX: convert to pass-based structure defined inline within `PostFxModule.ts` using registration tables.
4. **UI Rewrite**
   - Rebuild control panels using the new config store and modular panel components.  Provide bridging layer to maintain existing Tweakpane look during transition.
5. **Cleanup & Optimization**
   - Remove legacy polling timers and global state.  Replace with event-driven updates.
   - Optimize resource lifecycles (dispose meshes, stop intervals on module unload).
6. **Testing & Verification**
   - Add Vitest unit tests for config and utility modules.
   - Implement GPU smoke tests (using Playwright or Puppeteer) capturing reference frames for regression.
7. **Documentation**
   - Update README with new architecture overview, module usage, and development scripts.
   - Provide module-specific docs for stage, physics, post FX, and audio.

## 9. Future Extensions Enabled by the Refactor
- **Feature bundles** – Build smaller distributions (e.g., physics sandbox, audio visualizer) by choosing modules via the registry.
- **Plugin ecosystem** – Third parties can contribute new post-processing passes or simulation emitters by implementing the module interface.
- **Cross-platform deployment** – Web components can be embedded into other sites with tree-shaken builds.
- **Server-side preview rendering** – Headless builds can render still frames for marketing assets or testing.
- **Live coding / script console** – With modular boundaries, a scripting console could dynamically load modules for generative behaviors.

## 10. Deliverables & Timeline (High-Level)
| Phase | Duration | Key Outputs |
| --- | --- | --- |
| 0. Prep | 1 week | TypeScript, lint/test scaffolding, baseline CI |
| 1. Config Core | 1 week | Config schema/store, migration adapters |
| 2. Stage & Rendering | 2 weeks | StageModule, materials library, camera rigs |
| 3. Physics | 2–3 weeks | MLS-MPM refactor, renderer separation, tests |
| 4. Audio & PostFX | 2 weeks | Modular audio/post modules, event hooks |
| 5. UI & Tooling | 1–2 weeks | New panels, asset pipeline, docs |
| 6. Polishing | 1 week | Performance tuning, bundle optimizations, release notes |

## 11. Risks & Mitigations
- **Learning curve** – TypeScript + modular architecture requires onboarding.  Mitigation: add developer docs, typed contracts, and code generators for module scaffolding.
- **Performance regressions** – Refactors risk GPU performance.  Mitigation: capture baseline GPU timings/screenshots before refactor and monitor via automated tests.
- **Scope creep** – Strict module boundaries and phased timeline help deliver incrementally; ensure each phase lands with full tests and documentation.

## 12. Success Criteria
- Clear directory structure with domain-focused modules.
- TypeScript typecheck and lint must pass on CI.
- Feature modules can be toggled on/off via config or entry manifest.
- Config changes propagate instantly through reactive store without polling timers.
- New modules can be added via scaffolding script and integrated without touching unrelated code.
- Production bundle size and runtime FPS meet or exceed current baselines.

