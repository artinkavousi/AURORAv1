import type * as THREE from 'three';
import type { FeatureModule, ModuleContext } from '../core/plugins';
import type { FrameContext, StageContext, SimulationContext } from '../core/types';
import MlsMpmSimulator from '../mls-mpm/mlsMpmSimulator';
import ParticleRenderer from '../mls-mpm/particleRenderer';
import PointRenderer from '../mls-mpm/pointRenderer';
import GlyphRenderer from '../mls-mpm/glyphRenderer';

interface SimulationServices extends SimulationContext {
  surface: ParticleRenderer;
  points: PointRenderer;
  glyphs: GlyphRenderer;
}

class PhysicsFeature implements FeatureModule {
  id = 'physics';

  private services: SimulationServices | null = null;

  async init(context: ModuleContext): Promise<void> {
    const stage = context.registry.resolve<StageContext>('stage');
    const simulator = new MlsMpmSimulator(context.renderer);
    await simulator.init();

    const surface = new ParticleRenderer(simulator);
    const points = new PointRenderer(simulator);
    const glyphs = new GlyphRenderer(simulator);

    const surfaceObject = surface.object as THREE.Object3D | null;
    const pointsObject = points.object as THREE.Object3D | null;
    const glyphsObject = glyphs.object as THREE.Object3D | null;

    if (surfaceObject) stage.scene.add(surfaceObject);
    if (pointsObject) stage.scene.add(pointsObject);
    if (glyphsObject) stage.scene.add(glyphsObject);

    this.services = { simulator, surface, points, glyphs };
    context.registry.provide('simulation', { simulator });
    context.registry.provide('simulation.renderers', this.services);
    context.events.emit('simulation.ready', { simulator });
  }

  async update(frame: FrameContext, context: ModuleContext): Promise<void> {
    if (!this.services) return;
    const { simulator, surface, points, glyphs } = this.services;
    const surfaceObject = surface.object as THREE.Object3D | null;
    const pointsObject = points.object as THREE.Object3D | null;
    const glyphsObject = glyphs.object as THREE.Object3D | null;
    const simulation = context.config.state.simulation;
    const mode = simulation.render.mode;
    if (surfaceObject) surfaceObject.visible = mode === 'surface';
    if (pointsObject) pointsObject.visible = mode === 'points';
    if (glyphsObject) glyphsObject.visible = mode === 'glyphs';

    await simulator.update(frame.delta, frame.elapsed);
    surface.update?.();
    points.update?.();
    glyphs.update?.();
  }

  dispose(context: ModuleContext): void {
    if (!this.services) {
      return;
    }
    const stage = context.registry.tryResolve<StageContext>('stage');
    if (stage) {
      const { surface, points, glyphs } = this.services;
      [surface.object, points.object, glyphs.object].forEach((object) => {
        const mesh = object as THREE.Object3D | null;
        if (mesh && stage.scene.children.includes(mesh)) {
          stage.scene.remove(mesh);
        }
      });
    }
    context.registry.revoke('simulation.renderers');
    context.registry.revoke('simulation');
    this.services = null;
  }
}

export function createPhysicsDomain(): FeatureModule {
  return new PhysicsFeature();
}
