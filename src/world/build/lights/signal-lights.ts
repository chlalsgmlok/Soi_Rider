import { Color, Group, InstancedMesh, type Matrix4, MeshBasicMaterial } from 'three';
import type { CityData, SignalView } from '../../../core/types';
import type { LampColor } from '../templates/template-types';
import type { TemplateLibrary } from '../templates/template-library';
import { approachAxis, countdownSeconds, type SignalAspect, type SignalAxis, signalAspect } from './signal-phase';

const ON: Record<LampColor, Color> = {
  red: new Color('#ff1e12').multiplyScalar(2.4),
  amber: new Color('#ff9a0a').multiplyScalar(2.2),
  green: new Color('#18ff6e').multiplyScalar(2.1),
};
const OFF: Record<LampColor, Color> = {
  red: new Color('#3a0f0c'),
  amber: new Color('#3a2a0c'),
  green: new Color('#0c2a16'),
};
const COLORS: readonly LampColor[] = ['red', 'amber', 'green'];

/** what one signal head shows this frame */
export interface HeadState {
  aspect: SignalAspect | 'dark';
  seconds: number;
}

interface Head {
  node: number;
  axis: SignalAxis;
  lit: LampColor | null;
}

/**
 * Signal lenses of every mast-arm traffic light as three InstancedMeshes (red / amber / green), lit per approach from
 * the live SignalView (src/traffic). A null signal shows the Thai night mode: blinking amber.
 */
export class SignalLights {
  readonly group = new Group();
  readonly heads: Head[] = [];
  readonly states: HeadState[] = [];
  readonly matrices: Matrix4[] = [];
  private readonly meshes: Partial<Record<LampColor, InstancedMesh>> = {};
  private readonly material = new MeshBasicMaterial({ color: 0xffffff });

  constructor(data: CityData, matrices: readonly Matrix4[], templates: TemplateLibrary) {
    this.group.name = 'city_signals';
    data.placements.forEach((p, i) => {
      if (p.asset !== 'prop_traffic_light') return;
      const e = data.edges[Number(p.meta?.edge ?? -1)];
      this.heads.push({ node: Number(p.meta?.node ?? -1), axis: approachAxis(e ? e.dir : { x: 0, z: 1 }), lit: null });
      this.states.push({ aspect: 'dark', seconds: 0 });
      this.matrices.push(matrices[i]);
    });
    if (this.heads.length === 0) return;
    const t = templates.get('prop_traffic_light');
    for (const c of COLORS) {
      const g = t.lamps[c];
      if (!g) continue;
      const im = new InstancedMesh(g, this.material, this.heads.length);
      im.name = `signal_${c}`;
      this.matrices.forEach((m, k) => {
        im.setMatrixAt(k, m);
        im.setColorAt(k, OFF[c]);
      });
      im.computeBoundingSphere();
      this.meshes[c] = im;
      this.group.add(im);
    }
  }

  update(time: number, signal: (node: number) => SignalView | null): void {
    this.heads.forEach((h, k) => {
      const view = signal(h.node);
      const st = this.states[k];
      if (view) {
        st.aspect = signalAspect(view.phase, h.axis);
        st.seconds = countdownSeconds(view.phase, h.axis, view.remaining);
      } else {
        st.aspect = time % 1 < 0.5 ? 'amber' : 'dark';
        st.seconds = -1;
      }
      const lit: LampColor | null = st.aspect === 'dark' ? null : st.aspect;
      if (lit === h.lit) return;
      if (h.lit) this.paint(h.lit, k, OFF[h.lit]);
      if (lit) this.paint(lit, k, ON[lit]);
      h.lit = lit;
    });
  }

  dispose(): void {
    for (const m of Object.values(this.meshes)) m?.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }

  private paint(c: LampColor, k: number, color: Color): void {
    const im = this.meshes[c];
    if (!im?.instanceColor) return;
    im.setColorAt(k, color);
    im.instanceColor.needsUpdate = true;
  }
}
