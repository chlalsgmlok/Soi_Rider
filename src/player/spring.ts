/**
 * Damped 2nd-order spring x'' = ω²(target − x) − 2ζω·x' (semi-implicit Euler, stable for ω·dt < 1).
 * Used for lean (weight), pitch (nose dive / squat) and suspension bounce.
 */
export class Spring {
  x = 0;
  v = 0;

  constructor(public omega: number, public zeta: number) {}

  step(target: number, dt: number, omega = this.omega, zeta = this.zeta): number {
    const a = omega * omega * (target - this.x) - 2 * zeta * omega * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }

  reset(x = 0, v = 0): void {
    this.x = x;
    this.v = v;
  }
}
