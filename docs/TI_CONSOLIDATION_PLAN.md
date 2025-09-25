# Aurora TI Consolidation Plan

## Objective
Unify Aurora's runtime, domain modules, and shared utilities into high-cohesion modules with stable public APIs. The plan follows the consolidation heuristics to reduce duplication, remove circular dependencies, and clarify ownership boundaries for the "TI" technical initiative.

## Current Assessment
- **Core runtime** is fragmented across `AppHost`, `ModuleRegistry`, `ConfigStore`, and `Diagnostics`, making lifecycle control implicit.
- **Stage domain** spreads lifecycle logic across `StageModule`, `StageBackground`, and `StageLights`.
- **Audio domain** splits runtime (`AudioModule`), routing (`audio/router.ts`), and DSP (`audio/audioEngine.ts`) without a shared config contract.
- **Physics, Materials, Post FX, Camera** share similar FeatureModule shapes but reside in separate files without an owning domain boundary.
- **Utilities** like `valueAccess` and config helpers are accessed ad-hoc.

## Target Structure
```
src/
  core/
    events.ts       # Event hub + typed emit/on helpers
    plugins.ts      # Feature module contracts and registry
    state.ts        # Config store, batching, and schema wiring
    runtime.ts      # AuroraRuntime orchestrator (create/init/update/dispose)
    diagnostics.ts  # Frame stats + reporting tied to runtime events
    types.ts        # Shared runtime context + typed events
    config.ts       # Schema + defaults + patching utilities
  domain/
    stage.ts        # Scene/camera/environment lifecycle
    physics.ts      # Simulation domain lifecycle
    materials.ts    # Material authoring + parameter updates
    postfx.ts       # Post-processing pipeline + passes
    audio.ts        # Audio engine, router, UI, env coupling
    camera.ts       # Camera controls and interaction hooks
  core/value.ts     # Shared getters used across domains (>=3 consumers)
  examples/
    stage.ts        # Minimal usage of createStageDomain()
    audio.ts        # Minimal usage of createAudioDomain()
    runtime.ts      # Compose runtime with modules
```

## Consolidation Steps
1. **Core Runtime Merge**
   - Create `core/runtime.ts` that encapsulates renderer orchestration, module lifecycle, diagnostics, and config. Replace `AppHost`, `ModuleRegistry`, and `Diagnostics` exposures with a cohesive `AuroraRuntime` class exposing `create`, `init`, `update`, `resize`, `dispose`, `getConfig`, and `getEvents`.
   - Move `EventHub` to `core/events.ts` and expose typed `AuroraEvents` wiring.
   - Move config store creation into `core/state.ts`; rename `createConfigStore` to `createAuroraState` and export minimal API.

2. **Plugin/Module Boundary**
   - Collapse `ModuleRegistry` responsibilities into `core/plugins.ts` with explicit `FeatureModule` contract and registry operations (`provide`, `resolve`, `dispose`).
   - Update type imports across modules to use the new `core` entry points.

3. **Stage Domain Consolidation**
   - Merge `StageModule`, `StageBackground`, and `StageLights` into `domain/stage.ts`. Keep helper classes private and expose `createStageDomain()` returning a `FeatureModule`.
   - Localize HDR/textures loading logic and remove cross-module reach-through.

4. **Audio Domain Consolidation**
   - Merge `modules/AudioModule.ts` with `audio/audioEngine.ts` and `audio/router.ts` into `domain/audio.ts` with internal helpers for engine/router.
   - Ensure UI panel wiring remains but is scoped within the domain file.

5. **Remaining Domains**
   - Move `CameraModule.ts`, `MaterialModule.ts`, `PhysicsModule.ts`, and `PostFxModule.ts` into `domain/` equivalents. Inline small helpers if only used once.

6. **Shared Utilities**
   - Extract reused getters (`getNumber`, `toBoolean`, etc.) into `core/value.ts`. Update consumers to import from the new path.
   - Remove redundant exports after migration.

7. **Examples & Docs**
   - Add `examples/runtime.ts` demonstrating runtime composition.
   - Add per-domain usage examples demonstrating `createXDomain()` create/init/update/dispose cycle with mocks where needed.

8. **Cleanup & Validation**
   - Delete obsolete files/directories (`src/modules`, `src/audio` old splits, `core/AppHost.ts`, etc.).
   - Update imports and ensure `tsconfig` paths (if any) still resolve.
   - Run `npm run lint` and `npm run build` to verify integration.

## Success Criteria
- Reduced file count with each domain contained in a single module file.
- `AuroraRuntime` exposes minimal lifecycle API.
- No circular dependencies between core and domain modules.
- Examples compile and illustrate standalone + integrated usage.
- CI scripts (lint, build) succeed.
