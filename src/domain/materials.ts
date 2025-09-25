import type * as THREE from 'three';
import type { FeatureModule, ModuleContext } from '../core/plugins';

interface MaterialLibrary {
  [key: string]: THREE.Material | THREE.Material[] | undefined;
}

class MaterialsFeature implements FeatureModule {
  id = 'materials';

  private materials: MaterialLibrary = {};

  async init(context: ModuleContext): Promise<void> {
    const background = context.registry.tryResolve<Record<string, unknown>>('stage.background');
    const renderers = context.registry.tryResolve<{ surface: unknown; points: unknown; glyphs: unknown }>('simulation.renderers');

    if (background) {
      const glass = background?.glass as { material?: THREE.Material } | undefined;
      const glassCube = background?.glassCube as { material?: THREE.Material } | undefined;
      const floor = background?.floor as { material?: THREE.Material } | undefined;
      if (glass?.material) this.materials['stage.glass'] = glass.material;
      if (glassCube?.material) this.materials['stage.glassCube'] = glassCube.material;
      if (floor?.material) this.materials['stage.floor'] = floor.material;
    }

    if (renderers) {
      const surfaceMat = (renderers.surface as { material?: THREE.Material } | undefined)?.material;
      const pointMat = (renderers.points as { material?: THREE.Material } | undefined)?.material;
      const glyphMat = (renderers.glyphs as { material?: THREE.Material } | undefined)?.material;
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

export function createMaterialsDomain(): FeatureModule {
  return new MaterialsFeature();
}
