/**
 * 2D simulation geometry on the ground plane.
 * World: three.js Y-up, metres. The simulation works in the XZ plane: Vec2.x = world x, Vec2.z = world z.
 * Heading θ (radians): forward = (sin θ, cos θ); Object3D.rotation.y = θ. θ = 0 faces +Z.
 * right(θ) = (−cos θ, sin θ), left(θ) = (cos θ, −sin θ). Steering +1 = RIGHT turn = θ decreases.
 * Helpers live in src/core/math2d.ts — always use them instead of re-deriving.
 */
export interface Vec2 {
  x: number;
  z: number;
}

/** Oriented box. hw = half width (along right axis), hl = half length (along forward axis), angle = heading θ. */
export interface OBB {
  cx: number;
  cz: number;
  hw: number;
  hl: number;
  angle: number;
}

export interface Circle {
  cx: number;
  cz: number;
  r: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Bounds2 {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}
