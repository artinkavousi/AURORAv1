import { conf } from '../conf';
import { pick, clonePreset } from './utils';

const SIM_KEYS = [
  'run',
  'noise',
  'speed',
  'stiffness',
  'restDensity',
  'density',
  'dynamicViscosity',
  'gravity',
  'worldScale',
  'renderMode',
  'substeps',
  'apicBlend',
  'physMaxVelocity',
  'cflSafety',
  'vorticityEnabled',
  'vorticityEps',
  'xsphEnabled',
  'xsphEps',
  'sdfSphere',
  'sdfRadius',
  'sdfCenterZ',
  'jetEnabled',
  'jetStrength',
  'jetRadius',
  'jetPos',
  'jetDir',
  'vortexEnabled',
  'vortexStrength',
  'vortexRadius',
  'vortexCenter',
  'curlEnabled',
  'curlStrength',
  'curlScale',
  'curlTime',
  'orbitEnabled',
  'orbitStrength',
  'orbitRadius',
  'orbitAxis',
  'waveEnabled',
  'waveAmplitude',
  'waveScale',
  'waveSpeed',
  'waveAxis',
  'audioEnabled',
  'audioSource',
  'audioSensitivity',
  'audioBassGain',
  'audioMidGain',
  'audioTrebleGain',
  'audioBeatBoost',
] as const;

export interface SimulationPreset {
  name: string;
  config: Record<string, unknown>;
}

export function listSimulationPresets(): SimulationPreset[] {
  const base = conf._builtinPresets?.() ?? {};
  return Object.entries(base).map(([name, preset]) => ({ name, config: pick(clonePreset(preset), SIM_KEYS) }));
}
