import {
  type BufferGeometry, type Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, type Material, type Matrix4,
} from 'three';

function upload(at: InstancedBufferAttribute, count: number): void {
  at.clearUpdateRanges();
  at.addUpdateRange(0, count * at.itemSize);
  at.needsUpdate = count > 0;
}

/**
 * Per-instance tints (A..D) and light levels shared by every part of one rig, so slot i means the same agent in the
 * body, mirrors, glass … meshes. Unused slots stay white / dark.
 */
export class TintSet {
  readonly a: InstancedBufferAttribute;
  readonly b: InstancedBufferAttribute;
  readonly c: InstancedBufferAttribute;
  readonly d: InstancedBufferAttribute;
  readonly lights: InstancedBufferAttribute;
  private used = 0;

  constructor(readonly capacity: number) {
    const tint = (): InstancedBufferAttribute => {
      const at = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
      at.setUsage(DynamicDrawUsage);
      return at;
    };
    this.a = tint();
    this.b = tint();
    this.c = tint();
    this.d = tint();
    this.lights = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.lights.setUsage(DynamicDrawUsage);
  }

  attach(g: BufferGeometry): void {
    g.setAttribute('iTintA', this.a);
    g.setAttribute('iTintB', this.b);
    g.setAttribute('iTintC', this.c);
    g.setAttribute('iTintD', this.d);
    g.setAttribute('iLights', this.lights);
  }

  tint(i: number, slot: 0 | 1 | 2 | 3, c: Color): void {
    const at = slot === 0 ? this.a : slot === 1 ? this.b : slot === 2 ? this.c : this.d;
    at.setXYZ(i, c.r, c.g, c.b);
  }

  light(i: number, brake: number, left: number, right: number, night: number): void {
    this.lights.setXYZW(i, brake, left, right, night);
  }

  /** upload the first `count` slots this frame */
  commit(count: number): void {
    this.used = count;
    upload(this.a, count);
    upload(this.b, count);
    upload(this.c, count);
    upload(this.d, count);
    upload(this.lights, count);
  }

  get count(): number {
    return this.used;
  }
}

/** One instanced mesh of an NPC rig part; slots are refilled every frame (`begin` → `set` … → `commit`). */
export class InstancedPart {
  readonly mesh: InstancedMesh;
  private n = 0;
  private warned = false;

  constructor(geometry: BufferGeometry, material: Material, readonly capacity: number, tints: TintSet | null, name: string, castShadow: boolean) {
    tints?.attach(geometry);
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.name = name;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = true;
    this.mesh.count = 0;
  }

  begin(): void {
    this.n = 0;
  }

  /** append an instance; returns its slot or -1 when full */
  push(m: Matrix4): number {
    if (this.n >= this.capacity) {
      if (!this.warned) console.warn(`[traffic-view] ${this.mesh.name} is full (${this.capacity})`);
      this.warned = true;
      return -1;
    }
    this.mesh.setMatrixAt(this.n, m);
    return this.n++;
  }

  /** write slot i directly (parts that mirror another part's slot order) */
  setAt(i: number, m: Matrix4): void {
    if (i < this.capacity) this.mesh.setMatrixAt(i, m);
  }

  commit(count = this.n): void {
    const c = Math.min(count, this.capacity);
    this.mesh.count = c;
    this.mesh.visible = c > 0;
    const im = this.mesh.instanceMatrix;
    im.clearUpdateRanges();
    im.addUpdateRange(0, c * 16);
    im.needsUpdate = c > 0;
  }

  get size(): number {
    return this.n;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
