import { conf } from '../conf';
import { pick, clonePreset } from './utils';

const STAGE_KEYS = [
  'worldScale',
  'boundariesEnabled',
  'boundaryShape',
  'glassIor',
  'glassThickness',
  'glassRoughness',
  'glassDispersion',
  'glassAttenuationDistance',
  'glassAttenuationColor',
  'fov',
  'exposure',
  'envIntensity',
  'bgRotY',
  'envRotY',
  'renderMode',
  'particles',
  'size',
] as const;

export interface StagePreset {
  name: string;
  config: Record<string, unknown>;
}

export function listStagePresets(): StagePreset[] {
  const base = conf._builtinPresets?.() ?? {};
  return Object.entries(base).map(([name, preset]) => ({ name, config: pick(clonePreset(preset), STAGE_KEYS) }));
}
