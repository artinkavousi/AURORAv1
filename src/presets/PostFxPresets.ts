import { conf } from '../conf.js';
import { pick, clonePreset } from './utils';

const POST_FX_KEYS = [
  'postFxEnabled',
  'fxBloomEnabled',
  'fxBloomStrength',
  'fxBloomRadius',
  'fxBloomThreshold',
  'fxBloomMix',
  'lensFxEnabled',
  'lensFocusMode',
  'lensFocusDistance',
  'lensFocusRange',
  'lensBokehAmount',
  'lensNearBoost',
  'lensFarBoost',
  'lensHighlightThreshold',
  'lensHighlightGain',
  'lensHighlightSoftness',
  'lensApertureBlades',
  'lensApertureRotation',
  'lensApertureCurvature',
  'lensAnamorphic',
  'lensMaxCoC',
  'lensBlendCurve',
  'lensBleed',
  'lensFocusSmoothing',
  'lensQuality',
  'fxVignetteEnabled',
  'fxVignetteAmount',
  'fxGrainEnabled',
  'fxGrainAmount',
  'fxChromaticEnabled',
  'fxChromaticAmount',
  'fxChromaticScale',
  'fxChromaticCenter',
  'fxSaturation',
  'fxContrast',
  'fxLift',
] as const;

export interface PostFxPreset {
  name: string;
  config: Record<string, unknown>;
}

export function listPostFxPresets(): PostFxPreset[] {
  const base = conf._builtinPresets?.() ?? {};
  return Object.entries(base).map(([name, preset]) => ({ name, config: pick(clonePreset(preset), POST_FX_KEYS) }));
}
