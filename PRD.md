## Flow — Three.js r180 Upgrade and Advanced Physics Roadmap

### Purpose
Upgrade the project to Three.js r180 (WebGPU + TSL) and evolve the existing MLS‑MPM slice into a richer, production‑grade GPU physics system with advanced visuals and controls.

### Phase 0 — r180 Upgrade (migration-first)
- Update `three` to `^0.180.0`.
- Keep `three/webgpu` and `three/tsl` entrypoints.
- Fix minor issues:
  - Use `await renderer.init()` (remove double await).
  - Remove stray `result.colo` typo in HDR loader.
- Verify:
  - PostProcessing and Bloom TSL example import path.
  - `renderer.computeAsync`/`renderAsync` remain.
  - Scene environment/background rotation/intensity fields.

Acceptance: App builds and runs with WebGPU, particles simulate, bloom works.

### Phase 1 — Physics core upgrades (MLS‑MPM+)
- Multi‑material & plasticity (per‑particle parameters; viscoplastic clamping).
- APIC/FLIP blending for vorticity preservation and lower dissipation.
- Surface tension/cohesion for liquids.
- Rigid/SDF collisions with friction and restitution.
- Stable time stepping (CFL‑based substeps, adaptive dt clamp).

Acceptance: Stable under interaction, parameters live-tweakable.
 ### Phase 2 — Visual upgrades

- option to change the  the default particle boundary container and particle boundries(cube) with a dodecahedron mesh using a PBR glass material, supporting IOR and dispersion via TSL nodes.
- Add capability to upload a custom 3D model file to serve as the particle container boundary, replacing the default dodecahedron at runtime.
container shape(3d model or dodeca or cube) always should sync with the particle boundries so particle always be inside the shape

- Anisotropic glyphs from particle `C` matrix.
- TSL shading for transmission/thickness, fresnel, velocity ramps.
- Post FX: keep bloom; add TAA/motion blur/DOF controls.

#### New: Dedicated Environment/Stage/Camera/Lighting Module

- Create a specialized, separate file dedicated to all environment, lighting, camera, scene, and stage parameters and logic.
- This file should encapsulate:
  - Environment map and lighting setup (HDRI, sky, ambient, directional, etc.)
  - Camera configuration and controls (projection, FOV, position, target, DOF, etc.)
  - Scene and stage parameters (background, fog, exposure, tonemapping, etc.)
  - All related TSL node and WebGPU-specific environment/shading logic.
  - Centralized controls for all environment and camera parameters, integrated with the main control panel (Tweakpane/Leva).
- Ensure this module is fully production-grade, modular, and easily extensible for future visual/lighting/camera upgrades.

Acceptance: 
- User can toggle between points, glyphs, and surface.
- User can upload a 3D model to replace the simulation boundary container.
- Dodecahedron glass boundary with IOR/dispersion is default.
- Maintain target FPS at particle budget.
- All environment, lighting, camera, and stage parameters are managed in a dedicated, specialized file/module, with full control panel integration.

### Phase 3 — Performance and memory
- Buffer formats: refine atomics scaling; SoA partitioning.
- Kernel tuning: safe fusion, dispatch sizing.
- LOD/culling for point and surface modes.
- Surface reconstruction (compute marching cubes over grid density; optional screen‑space surface).

Acceptance: Reduced frame time at equal fidelity; higher particle budgets.

### Phase 4 — Controls and authoring
-improve twekpane structure and section and build a glassmorphism style
- Tweakpane sections for materials, integration, forces, rendering.
- Emitters/fields: jets, vortices, volume inflow/outflow.
- Presets/snapshots as JSON.

Acceptance: Presets load instantly; live tweaks without stutter.

### Risks
- TSL internal layout access used by `StructuredArray#setAtomic` may change; provide adapter if needed.
- Example TSL node import paths can shift between releases.

### Quick Migration Checklist
- `package.json`: `three` → `^0.180.0`.
- `index.js`: `await renderer.init()`.
- `src/app.js`: fix HDR loader typo; keep mapping.
- Verify Bloom import; validate post‑processing chain.
- Smoke run; profile.



