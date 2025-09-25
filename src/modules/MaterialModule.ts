import type * as THREE from 'three';
import type { FeatureModule, ModuleContext } from '../core/ModuleRegistry';
import type StageBackground from './stage/StageBackground';
import type ParticleRenderer from '../mls-mpm/particleRenderer';
import type PointRenderer from '../mls-mpm/pointRenderer';
import type GlyphRenderer from '../mls-mpm/glyphRenderer';

interface MaterialLibrary {
  [key: string]: THREE.Material | THREE.Material[] | undefined;
}

export default class MaterialModule implements FeatureModule {
  id = 'materials';

  private materials: MaterialLibrary = {};

  async init(context: ModuleContext): Promise<void> {
    const background = context.registry.tryResolve<StageBackground>('stage.background');
    const renderers = context.registry.tryResolve<{ surface: ParticleRenderer; points: PointRenderer; glyphs: GlyphRenderer }>(
      'simulation.renderers',
    );

    if (background) {
      const stageBackground = background as unknown as {
        glass?: { material?: THREE.Material } | null;
        glassCube?: { material?: THREE.Material } | null;
        floor?: { material?: THREE.Material } | null;
      };
      if (stageBackground.glass?.material) this.materials['stage.glass'] = stageBackground.glass.material;
      if (stageBackground.glassCube?.material) this.materials['stage.glassCube'] = stageBackground.glassCube.material;
      if (stageBackground.floor?.material) this.materials['stage.floor'] = stageBackground.floor.material;
    }

    if (renderers) {
      const surfaceMat = (renderers.surface as unknown as { material?: THREE.Material }).material;
      const pointMat = (renderers.points as unknown as { material?: THREE.Material }).material;
      const glyphMat = (renderers.glyphs as unknown as { material?: THREE.Material }).material;
      if (surfaceMat) this.materials['fluid.surface'] = surfaceMat;
      if (pointMat) this.materials['fluid.points'] = pointMat;
      if (glyphMat) this.materials['fluid.glyphs'] = glyphMat;
    }

    context.registry.provide('materials', this.materials);
  }

  dispose(context: ModuleContext): void {
    this.materials = {};
    context.registry.revoke('materials');
  }
}
