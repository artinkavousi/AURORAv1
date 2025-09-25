# Session Context (2025-09-26)

## Core Runtime
- `src/core/runtime.ts`: hosts `AuroraRuntime`, `AssetPipeline`, and composes default domain modules via `create*Domain` helpers.
- `src/core/events.ts`, `src/core/plugins.ts`, `src/core/state.ts`, `src/core/value.ts`: shared primitives (event hub, feature module contracts, config store, value helpers).

## Domain Modules
- `src/domain/stage.ts`: consolidated stage scene, background, and lighting lifecycle.
- `src/domain/physics.ts`, `src/domain/materials.ts`, `src/domain/postfx.ts`, `src/domain/audio.ts`, `src/domain/camera.ts`: unified feature modules per domain with `createXDomain` factories.

## Examples
- `src/examples/runtime.ts`, `src/examples/stage.ts`, `src/examples/audio.ts`: minimal entry points for booting consolidated runtime and specific domains.
