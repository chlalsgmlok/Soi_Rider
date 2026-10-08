/** re-route once the rider is farther than this from the route (m) */
export const OFF_ROUTE_M = 12;
/** … or has ridden against the route direction for this long (s) */
export const WRONG_WAY_SEC = 2;
/** never re-route more often than this (s) */
export const REROUTE_GAP = 1.5;
/** "against the route": moving faster than this (m/s) … */
export const WRONG_WAY_SPEED = 1.5;
/** … with the heading more than ~120° off the route tangent (cosine) */
export const WRONG_WAY_DOT = -0.5;

/** Decides when the navigator recomputes the route (docs/GAME_DESIGN.md §9 "경로 이탈 시 자동"). Pure, no allocation. */
export class RerouteWatch {
  private wrongFor = 0;
  private sinceLast = Infinity;

  /** seconds the rider has been riding against the route */
  get wrongWaySec(): number {
    return this.wrongFor;
  }

  /** true when the route should be recomputed now */
  update(dt: number, offRoute: number, wrongWay: boolean): boolean {
    this.sinceLast += dt;
    this.wrongFor = wrongWay ? this.wrongFor + dt : 0;
    const want = offRoute > OFF_ROUTE_M || this.wrongFor >= WRONG_WAY_SEC;
    if (!want || this.sinceLast < REROUTE_GAP) return false;
    this.sinceLast = 0;
    this.wrongFor = 0;
    return true;
  }

  reset(): void {
    this.wrongFor = 0;
    this.sinceLast = Infinity;
  }
}
