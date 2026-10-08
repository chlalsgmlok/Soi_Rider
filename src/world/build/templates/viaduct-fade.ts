import { type BatchedMesh, Vector4 } from 'three';
import { damp } from '../../../core/math2d';
import type { Placement } from '../../../core/types';

/** half length / sight radius of each viaduct piece (m) */
const PIECES: Readonly<Record<string, { half: number; near: number; far: number }>> = {
  bts_deck: { half: 20, near: 5.5, far: 11 },
  bts_station: { half: 31, near: 10.5, far: 17 },
};
/** the deck soffit: a camera below it never looks through the viaduct from above */
const MIN_EYE = 9;
/** only the close chase (diorama) camera cuts the viaduct away — wide establishing shots keep it whole */
const MAX_REACH = 24;
const MAX_FADE = 0.82;

interface Piece {
  id: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  near: number;
  far: number;
  fade: number;
  params: Vector4;
}

function segDist(px: number, pz: number, P: Piece): number {
  const dx = P.bx - P.ax;
  const dz = P.bz - P.az;
  const t = Math.max(0, Math.min(1, ((px - P.ax) * dx + (pz - P.az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - P.ax - dx * t, pz - P.az - dz * t);
}

/**
 * Diorama cut-away: BTS deck / station pieces between the high camera and the street dissolve (ordered dither in
 * the uber shader; shadows stay) so the rider is never lost under the skytrain.
 */
export class ViaductFade {
  private readonly pieces: Piece[] = [];

  constructor(private readonly mesh: BatchedMesh, placements: readonly Placement[], instanceOf: Int32Array) {
    placements.forEach((p, i) => {
      const spec = PIECES[p.asset];
      const id = instanceOf[i];
      if (!spec || id < 0) return;
      const fx = Math.sin(p.heading) * spec.half;
      const fz = Math.cos(p.heading) * spec.half;
      const seed = ((p.variant >>> 0) % 997) / 997;
      this.pieces.push({ id, ax: p.pos.x - fx, az: p.pos.z - fz, bx: p.pos.x + fx, bz: p.pos.z + fz, near: spec.near, far: spec.far, fade: 0, params: new Vector4(0, 0, 0, seed) });
    });
  }

  update(dt: number, cam: { x: number; y: number; z: number }, focus?: { x: number; z: number }): void {
    const k = damp(7, dt);
    const close = !focus || Math.hypot(cam.x - focus.x, cam.z - focus.z) < MAX_REACH;
    for (const P of this.pieces) {
      let target = 0;
      if (cam.y > MIN_EYE && close) {
        let d = segDist(cam.x, cam.z, P);
        if (focus) {
          for (let t = 0.25; t <= 1; t += 0.25) d = Math.min(d, segDist(cam.x + (focus.x - cam.x) * t, cam.z + (focus.z - cam.z) * t, P));
        }
        target = MAX_FADE * Math.max(0, Math.min(1, (P.far - d) / (P.far - P.near)));
      }
      let next = P.fade + (target - P.fade) * k;
      if (target === 0 && next < 0.01) next = 0;
      if (next === P.fade || (Math.abs(next - P.fade) < 0.004 && next !== 0)) continue;
      P.fade = next;
      P.params.x = P.fade > 0 ? 100 + 100 * P.fade : 0;
      this.mesh.setColorAt(P.id, P.params);
    }
  }
}
