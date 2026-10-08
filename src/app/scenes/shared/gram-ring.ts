import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { PALETTE } from '../../../core/config/palette';

/** seconds between radar pings */
const PING_EVERY = 2.6;
const PING_TIME = 1.5;

function ringMaterial(opacity: number, boost: number): MeshBasicMaterial {
  const m = new MeshBasicMaterial({
    color: PALETTE.gramCyan, transparent: true, opacity, side: DoubleSide, toneMapped: false, depthWrite: false,
    blending: AdditiveBlending,
  });
  m.color.multiplyScalar(boost);
  return m;
}

/**
 * The gram app's cyan ring on the road around the rider (mockup 03) with a slow breathing glow and a soft radar
 * ping expanding outward — "online, waiting for a call". Place `root` at the bike's ground point.
 */
export class GramRing {
  readonly root = new Group();
  private readonly ring: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly ping: Mesh<RingGeometry, MeshBasicMaterial>;
  private t = 0;

  constructor(radius = 0.92) {
    this.root.name = 'gram_ring';
    const g = new RingGeometry(radius - 0.13, radius, 64);
    g.rotateX(-Math.PI / 2);
    this.ring = new Mesh(g, ringMaterial(0.85, 1.7));
    const pg = new RingGeometry(radius - 0.05, radius, 64);
    pg.rotateX(-Math.PI / 2);
    this.ping = new Mesh(pg, ringMaterial(0, 1.4));
    for (const m of [this.ring, this.ping]) {
      m.renderOrder = 3;
      m.position.y = 0.03;
      this.root.add(m);
    }
  }

  update(dt: number, still = false): void {
    this.t += dt;
    this.ring.material.opacity = 0.72 + 0.16 * Math.sin(this.t * 2.2);
    const u = still ? 1 : (this.t % PING_EVERY) / PING_TIME;
    const live = u < 1;
    this.ping.visible = live;
    if (!live) return;
    this.ping.scale.setScalar(1 + u * 0.85);
    this.ping.material.opacity = 0.55 * (1 - u) * (1 - u);
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const m of [this.ring, this.ping]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
