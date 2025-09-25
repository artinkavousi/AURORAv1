import type { AuroraConfigState } from './index';

export interface PostFxConfigSnapshot {
  enabled: boolean;
  view: AuroraConfigState['post']['view'];
  tone: AuroraConfigState['post']['tone'];
  bloom: AuroraConfigState['post']['bloom'];
  lens: AuroraConfigState['post']['lens'];
  vignette: AuroraConfigState['post']['vignette'];
  chromatic: {
    enabled: boolean;
    amount: number;
    scale: number;
    center: { x: number; y: number };
  };
  grain: AuroraConfigState['post']['grain'];
  stage: {
    exposure: number;
    fov: number;
  };
}

function cloneLens(lens: AuroraConfigState['post']['lens']): AuroraConfigState['post']['lens'] {
  return {
    ...lens,
    physical: { ...lens.physical },
  };
}

export function createPostFxSnapshot(config: AuroraConfigState): PostFxConfigSnapshot {
  const { post, stage } = config;
  return {
    enabled: post.enabled,
    view: post.view,
    tone: { ...post.tone },
    bloom: { ...post.bloom },
    lens: cloneLens(post.lens),
    vignette: { ...post.vignette },
    chromatic: {
      enabled: post.chromatic.enabled,
      amount: post.chromatic.amount,
      scale: post.chromatic.scale,
      center: { x: post.chromatic.center[0], y: post.chromatic.center[1] },
    },
    grain: { ...post.grain },
    stage: {
      exposure: stage.renderer.exposure,
      fov: stage.camera.fov,
    },
  };
}
