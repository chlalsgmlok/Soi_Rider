/**
 * Turns road speed + throttle into engine rpm the way the rider hears it: a geared box that upshifts with an
 * ignition-cut dip and blips on downshifts (cub / sport), or a CVT that holds rpm while speed climbs (scooter).
 * Pure and deterministic — unit tested.
 */
export interface DriveOutput {
  /** 0 = idle, 1 = redline */
  rpm01: number;
  /** 0-based gear (always 0 for a CVT) */
  gear: number;
  /** 0..1 ignition cut (shift dip, rev limiter) */
  cut: number;
  /** +1 upshift / −1 downshift happened this update */
  shifted: -1 | 0 | 1;
}

export interface DrivetrainSpec {
  gears: number[] | null;
  slip: number;
  shiftCut: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Drivetrain {
  rpm01 = 0;
  gear = 0;
  private cutLeft = 0;
  private blipLeft = 0;
  private limiterPhase = 0;

  constructor(private readonly spec: DrivetrainSpec) {}

  reset(): void {
    this.rpm01 = 0;
    this.gear = 0;
    this.cutLeft = 0;
    this.blipLeft = 0;
  }

  update(speed01: number, throttle: number, dt: number): DriveOutput {
    const s = Math.max(0, Math.min(1.25, Number.isFinite(speed01) ? speed01 : 0));
    const th = clamp01(Number.isFinite(throttle) ? throttle : 0);
    const step = Math.max(0, Math.min(0.1, dt));
    const gears = this.spec.gears;
    let shifted: -1 | 0 | 1 = 0;
    let target: number;
    let riseRate = 7;

    if (!gears) {
      // CVT: the variator holds the engine near its power band, the belt ratio does the rest
      const ratioRpm = s * 0.93;
      if (th > 0.03) target = Math.max(0.2 + 0.46 * th, ratioRpm);
      else target = s > 0.12 ? s * 0.55 : 0;
      riseRate = 4.5;
      this.gear = 0;
    } else {
      const inGear = (g: number): number => s / gears[g];
      const upAt = 0.52 + 0.4 * th;
      if (this.gear < gears.length - 1 && inGear(this.gear) > upAt && this.cutLeft <= 0) {
        this.gear++;
        this.cutLeft = this.spec.shiftCut;
        shifted = 1;
      } else if (this.gear > 0 && inGear(this.gear) < 0.27) {
        this.gear--;
        this.blipLeft = 0.13;
        shifted = -1;
      }
      target = inGear(this.gear);
      if (this.gear === 0) target = Math.max(target, th * this.spec.slip);
      if (th < 0.03 && s < 0.06) target = 0;
      if (this.blipLeft > 0) target = Math.max(target, inGear(this.gear) + 0.14);
    }

    // revs fall fast while the clutch is in for a shift, lazily when just rolling off
    const rate = target > this.rpm01 ? riseRate : this.cutLeft > 0 ? 16 : 3.2;
    this.rpm01 += (target - this.rpm01) * (1 - Math.exp(-rate * step));
    this.cutLeft = Math.max(0, this.cutLeft - step);
    this.blipLeft = Math.max(0, this.blipLeft - step);

    let cut = this.cutLeft > 0 ? 1 : 0;
    // rev limiter stutter when pinned against redline
    if (this.rpm01 > 0.985 && th > 0.5) {
      this.limiterPhase = (this.limiterPhase + step * 16) % 1;
      if (this.limiterPhase < 0.4) cut = Math.max(cut, 0.8);
      this.rpm01 = Math.min(this.rpm01, 1.0);
    }
    this.rpm01 = Math.min(1.04, Math.max(0, this.rpm01));
    return { rpm01: Math.min(1, this.rpm01), gear: this.gear, cut, shifted };
  }
}
