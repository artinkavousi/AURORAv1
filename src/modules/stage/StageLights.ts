import * as THREE from 'three';

export default class StageLights {
  object: THREE.Object3D;
  private spot: THREE.SpotLight;
  private target: THREE.Object3D;

  constructor() {
    this.object = new THREE.Object3D();
    this.spot = new THREE.SpotLight(0xffffff, 5, 15, Math.PI * 0.18, 1, 0);
    this.target = new THREE.Object3D();

    this.spot.position.set(0, 1.2, -0.8);
    this.target.position.set(0, 0.7, 0);

    this.spot.target = this.target;
    this.object.add(this.spot);
    this.object.add(this.target);

    this.spot.castShadow = true;
    this.spot.shadow.mapSize.width = 1024;
    this.spot.shadow.mapSize.height = 1024;
    this.spot.shadow.bias = -0.005;
    this.spot.shadow.camera.near = 0.5;
    this.spot.shadow.camera.far = 5;
  }

  update(): void {
    // No-op hook for future dynamic lighting cues
  }
}
