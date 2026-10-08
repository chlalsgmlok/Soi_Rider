import { DoubleSide, MeshStandardMaterial } from 'three';
import { toonify } from '../../engine/env/toonify';
import { GroundMaterial } from './ground/ground-material';
import { CityMaterial } from './templates/city-material';

/** The handful of materials the whole city view draws with (each = one shader program, shared by every chunk). */
export class CityMaterials {
  readonly city = new CityMaterial();
  readonly ground = new GroundMaterial();
  readonly glass: MeshStandardMaterial;

  constructor() {
    this.glass = toonify(new MeshStandardMaterial({
      name: 'City_Glass', vertexColors: true, transparent: true, opacity: 0.38, roughness: 0.06, metalness: 0.1,
      depthWrite: false, side: DoubleSide,
    }));
  }

  dispose(): void {
    this.city.dispose();
    this.ground.dispose();
    this.glass.dispose();
  }
}
