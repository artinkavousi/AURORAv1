import { z } from 'zod';

export const stageCameraSchema = z.object({
  fov: z.number().min(20).max(120).default(60),
  near: z.number().min(0.01).default(0.1),
  far: z.number().min(10).default(1000),
});

export const stageRendererSchema = z.object({
  exposure: z.number().min(0).default(1.0),
  toneMapping: z.enum(['aces', 'filmic', 'linear']).default('aces'),
  shadows: z
    .object({
      enabled: z.boolean().default(true),
      type: z.enum(['pcfsoft', 'pcss', 'basic']).default('pcfsoft'),
    })
    .default({ enabled: true, type: 'pcfsoft' }),
});

export const stageEnvironmentSchema = z.object({
  intensity: z.number().min(0).default(1.0),
  backgroundRotationY: z.number().default(0),
  environmentRotationY: z.number().default(0),
});

export const stageWorldSchema = z.object({
  autoFit: z.boolean().default(true),
  mode: z.enum(['cover', 'contain']).default('cover'),
  margin: z.number().min(0).max(1).default(0.98),
  scale: z.number().positive().default(1),
  zScale: z.number().default(0.22),
  boundariesEnabled: z.boolean().default(false),
});

export const stageGlassSchema = z.object({
  ior: z.number().min(1).max(3).default(1.5),
  thickness: z.number().min(0).default(0.3),
  roughness: z.number().min(0).max(1).default(0.02),
  dispersion: z.number().min(0).max(1).default(0.25),
  attenuationDistance: z.number().min(0).default(2.5),
  attenuationColor: z.tuple([z.number().min(0).max(255), z.number().min(0).max(255), z.number().min(0).max(255)]).default([
    255,
    255,
    255,
  ]),
  shape: z.enum(['dodeca', 'cube', 'sphere']).default('dodeca'),
});

export const simulationSolverSchema = z.object({
  substeps: z.number().int().min(1).max(8).default(2),
  apicBlend: z.number().min(0).max(1).default(0),
  stiffness: z.number().min(0).default(3),
  restDensity: z.number().min(0).default(1),
  density: z.number().min(0).default(1.4),
  viscosity: z.number().min(0).default(0.1),
  speed: z.number().min(0).default(1.6),
  noise: z.number().min(0).max(4).default(1),
});

export const simulationLimitsSchema = z.object({
  maxVelocity: z.number().min(0).default(2.5),
  cflSafety: z.number().min(0).max(1).default(0.5),
});

export const simulationDomainSchema = z.object({
  maxParticles: z.number().int().min(1).default(8192 * 16),
  targetParticles: z.number().int().min(1).default(8192 * 4),
  worldScale: z.number().positive().default(2.0),
  sdf: z
    .object({
      enabled: z.boolean().default(false),
      radius: z.number().min(0).default(12),
      centerZ: z.number().default(20),
    })
    .default({ enabled: false, radius: 12, centerZ: 20 }),
});

export const simulationRenderSchema = z.object({
  mode: z.enum(['surface', 'points', 'glyphs']).default('surface'),
  colorMode: z.enum(['fluid', 'audio', 'velocity']).default('fluid'),
});

export const simulationForcesSchema = z.object({
  gravity: z.number().default(2),
  vorticity: z.object({ enabled: z.boolean().default(false), epsilon: z.number().min(0).default(0.15) }),
  xsph: z.object({ enabled: z.boolean().default(true), epsilon: z.number().min(0).default(0.08) }),
  jet: z
    .object({
      enabled: z.boolean().default(false),
      strength: z.number().default(0.6),
      radius: z.number().default(6),
      position: z.tuple([z.number(), z.number(), z.number()]).default([32, 40, 20]),
      direction: z.tuple([z.number(), z.number(), z.number()]).default([0, -1, 0]),
    })
    .default({ enabled: false, strength: 0.6, radius: 6, position: [32, 40, 20], direction: [0, -1, 0] }),
  vortex: z
    .object({
      enabled: z.boolean().default(false),
      strength: z.number().default(0.4),
      radius: z.number().default(14),
      center: z.tuple([z.number(), z.number()]).default([32, 32]),
    })
    .default({ enabled: false, strength: 0.4, radius: 14, center: [32, 32] }),
  curl: z
    .object({
      enabled: z.boolean().default(false),
      strength: z.number().default(0.6),
      scale: z.number().default(0.02),
      time: z.number().default(0.6),
    })
    .default({ enabled: false, strength: 0.6, scale: 0.02, time: 0.6 }),
  orbit: z
    .object({
      enabled: z.boolean().default(false),
      strength: z.number().default(0.5),
      radius: z.number().default(22),
      axis: z.enum(['x', 'y', 'z']).default('z'),
    })
    .default({ enabled: false, strength: 0.5, radius: 22, axis: 'z' }),
  wave: z
    .object({
      enabled: z.boolean().default(false),
      amplitude: z.number().default(0.35),
      scale: z.number().default(0.12),
      speed: z.number().default(1.2),
      axis: z.enum(['x', 'y', 'z']).default('y'),
    })
    .default({ enabled: false, amplitude: 0.35, scale: 0.12, speed: 1.2, axis: 'y' }),
});

export const simulationPerformanceSchema = z.object({
  auto: z.boolean().default(false),
  minFps: z.number().default(50),
  maxFps: z.number().default(58),
  step: z.number().default(4096),
});

export const postToneMappingSchema = z.object({
  saturation: z.number().default(1.0),
  contrast: z.number().default(1.0),
  lift: z.number().default(0.0),
});

export const postBloomSchema = z.object({
  enabled: z.boolean().default(true),
  strength: z.number().default(0.9),
  radius: z.number().default(0.65),
  threshold: z.number().default(0.0012),
  mix: z.number().default(0.4),
});

export const postLensSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['pointer', 'manual']).default('pointer'),
  focusDistance: z.number().default(0.8),
  focusRange: z.number().default(0.12),
  focusSmoothing: z.number().min(0).max(1).default(0.2),
  bokehAmount: z.number().default(1.1),
  nearBoost: z.number().default(1),
  farBoost: z.number().default(1),
  highlightThreshold: z.number().default(0.78),
  highlightGain: z.number().default(0.9),
  highlightSoftness: z.number().default(0.18),
  apertureBlades: z.number().int().default(9),
  apertureRotation: z.number().default(0),
  apertureCurvature: z.number().default(1),
  anamorphic: z.number().default(0),
  maxCoc: z.number().default(1.4),
  blendCurve: z.number().default(1.2),
  bleed: z.number().default(0.32),
  quality: z.number().min(0.5).max(1.5).default(0.85),
  autoTune: z.boolean().default(true),
  physical: z
    .object({
      enabled: z.boolean().default(false),
      focalLength: z.number().default(35),
      fStop: z.number().default(1.8),
      sensorWidth: z.number().default(36),
      sensorHeight: z.number().default(24),
      sensorAspect: z.number().default(36 / 24),
      cocLimit: z.number().default(0.03),
      bokehScale: z.number().default(1),
      driveFov: z.boolean().default(false),
    })
    .default({
      enabled: false,
      focalLength: 35,
      fStop: 1.8,
      sensorWidth: 36,
      sensorHeight: 24,
      sensorAspect: 36 / 24,
      cocLimit: 0.03,
      bokehScale: 1,
      driveFov: false,
    }),
});

export const postVignetteSchema = z.object({
  enabled: z.boolean().default(true),
  amount: z.number().default(0.2),
});

export const postChromaticSchema = z.object({
  enabled: z.boolean().default(false),
  amount: z.number().default(0.0015),
  scale: z.number().default(1.0),
  center: z.tuple([z.number(), z.number()]).default([0.5, 0.5]),
});

export const postGrainSchema = z.object({
  enabled: z.boolean().default(false),
  amount: z.number().default(0.08),
});

export const audioSchema = z.object({
  enabled: z.boolean().default(false),
  source: z.enum(['mic', 'file']).default('mic'),
  sensitivity: z.number().default(1.0),
  master: z.number().default(1.0),
  reactivity: z.number().default(1.0),
  intensity: z.number().default(1.0),
  attack: z.number().default(0.5),
  release: z.number().default(0.2),
  bandAttack: z.number().default(0.55),
  bandRelease: z.number().default(0.22),
  beatBoost: z.number().default(1.0),
  bassGain: z.number().default(1.0),
  midGain: z.number().default(1.0),
  trebleGain: z.number().default(1.0),
  transientSensitivity: z.number().default(1.0),
  transientDecay: z.number().default(0.4),
});

export const runtimeSchema = z.object({
  postFxView: z.enum(['final', 'depth', 'coc', 'bloom']).default('final'),
});

export const auroraConfigSchema = z.object({
  stage: z
    .object({
      camera: stageCameraSchema,
      renderer: stageRendererSchema,
      environment: stageEnvironmentSchema,
      world: stageWorldSchema,
      glass: stageGlassSchema,
    })
    .default({
      camera: stageCameraSchema.parse({}),
      renderer: stageRendererSchema.parse({}),
      environment: stageEnvironmentSchema.parse({}),
      world: stageWorldSchema.parse({}),
      glass: stageGlassSchema.parse({}),
    }),
  simulation: z
    .object({
      domain: simulationDomainSchema,
      solver: simulationSolverSchema,
      limits: simulationLimitsSchema,
      render: simulationRenderSchema,
      forces: simulationForcesSchema,
      performance: simulationPerformanceSchema,
    })
    .default({
      domain: simulationDomainSchema.parse({}),
      solver: simulationSolverSchema.parse({}),
      limits: simulationLimitsSchema.parse({}),
      render: simulationRenderSchema.parse({}),
      forces: simulationForcesSchema.parse({}),
      performance: simulationPerformanceSchema.parse({}),
    }),
  post: z
    .object({
      enabled: z.boolean().default(true),
      view: runtimeSchema.shape.postFxView,
      tone: postToneMappingSchema,
      bloom: postBloomSchema,
      lens: postLensSchema,
      vignette: postVignetteSchema,
      chromatic: postChromaticSchema,
      grain: postGrainSchema,
    })
    .default({
      enabled: true,
      view: 'final',
      tone: postToneMappingSchema.parse({}),
      bloom: postBloomSchema.parse({}),
      lens: postLensSchema.parse({}),
      vignette: postVignetteSchema.parse({}),
      chromatic: postChromaticSchema.parse({}),
      grain: postGrainSchema.parse({}),
    }),
  audio: audioSchema.default(audioSchema.parse({})),
  runtime: runtimeSchema.default(runtimeSchema.parse({})),
});

export type StageConfig = z.infer<typeof stageCameraSchema> &
  z.infer<typeof stageRendererSchema> &
  z.infer<typeof stageEnvironmentSchema>;
export type AuroraConfigState = z.infer<typeof auroraConfigSchema>;

export type AuroraConfigPresetId = 'studio' | 'cinematic' | 'performance';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const studioPreset: DeepPartial<AuroraConfigState> = {
  stage: {
    renderer: { exposure: 1.05 },
    environment: { intensity: 1.15 },
    world: { scale: 2.4 },
  },
  simulation: {
    domain: { targetParticles: 8192 * 5 },
    solver: { speed: 1.8, stiffness: 3.2 },
    performance: { auto: true },
  },
  post: {
    enabled: true,
    bloom: { strength: 0.95, mix: 0.45 },
    lens: { focusRange: 0.16, bokehAmount: 1.2, autoTune: true },
  },
  audio: { enabled: true, sensitivity: 1.15, bassGain: 1.25, beatBoost: 1.1 },
};

const cinematicPreset: DeepPartial<AuroraConfigState> = {
  stage: {
    camera: { fov: 55 },
    renderer: { exposure: 1.2 },
    environment: { backgroundRotationY: 2.1, environmentRotationY: -2.1 },
  },
  simulation: {
    render: { mode: 'surface' },
    solver: { speed: 1.35, noise: 0.8 },
    forces: {
      curl: { enabled: true, strength: 0.7, scale: 0.03 },
      wave: { enabled: true, amplitude: 0.42, speed: 1.1 },
    },
  },
  post: {
    bloom: { strength: 1.1, radius: 0.7, mix: 0.5 },
    lens: {
      mode: 'pointer',
      focusSmoothing: 0.24,
      nearBoost: 1.2,
      farBoost: 1.1,
      physical: { enabled: true, focalLength: 50, fStop: 1.6, driveFov: true },
    },
    chromatic: { enabled: true, amount: 0.0022 },
    grain: { enabled: true, amount: 0.12 },
  },
  audio: { enabled: true, sensitivity: 1.05, trebleGain: 1.2 },
};

const performancePreset: DeepPartial<AuroraConfigState> = {
  stage: {
    renderer: { exposure: 0.95 },
    world: { autoFit: false, scale: 1.6 },
  },
  simulation: {
    domain: { targetParticles: 8192 * 2 },
    solver: { substeps: 1, speed: 1.1 },
    limits: { maxVelocity: 2.0 },
    render: { mode: 'points' },
    performance: { auto: false },
  },
  post: {
    enabled: false,
    bloom: { enabled: false },
    lens: { enabled: false },
    chromatic: { enabled: false },
    grain: { enabled: false },
  },
  audio: { enabled: false },
};

const PRESETS: Record<AuroraConfigPresetId, DeepPartial<AuroraConfigState>> = {
  studio: studioPreset,
  cinematic: cinematicPreset,
  performance: performancePreset,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch?: DeepPartial<T>): T {
  if (!patch) return base;
  const result: Record<string, unknown> = Array.isArray(base)
    ? ([...(base as unknown as unknown[])] as unknown as Record<string, unknown>)
    : { ...(base as Record<string, unknown>) };
  Object.entries(patch as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined) return;
    if (isPlainObject(value)) {
      const current = result[key];
      result[key] = deepMerge(isPlainObject(current) ? current : {}, value as DeepPartial<unknown> as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  });
  return result as T;
}

export function createAuroraConfig(
  preset: AuroraConfigPresetId = 'studio',
  overrides?: DeepPartial<AuroraConfigState>,
): AuroraConfigState {
  const defaults = auroraConfigSchema.parse({});
  const mergedPreset = deepMerge(defaults, PRESETS[preset]);
  const merged = deepMerge(mergedPreset, overrides);
  return auroraConfigSchema.parse(merged);
}

export function applyPreset(
  base: AuroraConfigState,
  preset: AuroraConfigPresetId,
  overrides?: DeepPartial<AuroraConfigState>,
): AuroraConfigState {
  const presetPatch = PRESETS[preset];
  const merged = deepMerge(deepMerge(base, presetPatch), overrides);
  return auroraConfigSchema.parse(merged);
}

export const presets = PRESETS;
