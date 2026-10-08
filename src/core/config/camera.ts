/** Camera framing presets (docs/GAME_DESIGN.md §12). Distances in metres, fov in degrees. */
export const CAMERA = {
  diorama: {
    back: 13.5,
    up: 10.5,
    fov: 36,
    lookAhead: 9,
    speedPullBack: 3,
    yawLag: 0.35,
    tiltShift: 1.0,
  },
  squeeze: {
    back: 3.4,
    up: 2.3,
    fov: 52,
    lookAhead: 8,
    blendIn: 0.6,
    hold: 1.2,
    blendOut: 1.0,
    gapThreshold: 0.45,
    maxSpeedKmh: 22,
    tiltShift: 0.25,
  },
  pov: {
    eyeUp: 1.45,
    eyeBack: 0.35,
    fov: 72,
    rollFactor: 0.6,
    bob: 0.012,
    tiltShift: 0,
  },
  near: 0.1,
  far: 900,
} as const;
