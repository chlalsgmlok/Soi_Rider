import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { newPose } from '../camera/camera-pose';
import { EventShot } from '../camera/event-shot';
import { BIKES, RIDE } from '../core/config/bikes';
import { EventBus } from '../core/events';
import { BikePhysics, type RideInput } from './bike-physics';
import { FALL_LEAN, fallSide } from './fall-motion';
import { FLAT_ENV } from './ride-env';
import { FallAnimator } from './rig/fall-animator';
import { fakeBodyJoints } from './rig/testing/fake-body';

const DT = 1 / 60;
const input = (steer: number): RideInput => ({ throttle: 0, brake: 0, steer, tuck: false });

describe('fallSide — one rule for physics, rider tumble and crash cam', () => {
  it('a leaning bike falls to its lean; a nearly upright one toward its bars; dead straight → right', () => {
    expect(fallSide({ lean: 0.3, steer: -0.2 })).toBe(1);
    expect(fallSide({ lean: -0.3, steer: 0.2 })).toBe(-1);
    expect(fallSide({ lean: 0.02, steer: -0.1 })).toBe(-1);
    expect(fallSide({ lean: -0.02, steer: 0.1 })).toBe(1);
    expect(fallSide({ lean: -2.8e-10, steer: 0 })).toBe(1);
  });

  it('a straight rear-end after a right turn: bike, rider and crash cam all go to the same side', () => {
    const bus = new EventBus();
    const b = new BikePhysics(BIKES.cub, bus);
    // a right turn, then straighten up and ride on (speed held)
    for (let i = 0; i < 2 / DT; i++) {
      b.state.speed = 8;
      b.step(DT, input(0.5), FLAT_ENV);
    }
    for (let i = 0; i < 3 / DT; i++) {
      b.state.speed = 8;
      b.step(DT, input(0), FLAT_ENV);
    }
    const s = b.state;
    // the residual measured in the sandbox: a hair of LEFT lean while the bars are straight
    s.lean = -2.8e-10;
    s.steer = 0;
    const side = fallSide(s);
    expect(side).toBe(1);
    expect(Math.sign(s.lean)).not.toBe(side); // what used to split the rig (sign of lean) from the physics

    // the sandbox / app start the crash cam on the fall event, the rig begins the tumble on the next frame
    const shot = new EventShot();
    bus.on('player:fall', () => shot.start('fall', s, null, 2.3));
    b.fall('body');
    const j = fakeBodyJoints();
    const rider = new FallAnimator(new Group(), j);
    rider.begin(s, new Vector3(0, 0.9, -0.14), 8);
    expect(Math.sign(s.lean)).toBe(side);
    expect(rider.fallSide).toBe(side);

    // the crash cam swings out to the bike's right: right of heading θ is (−cos θ, sin θ)
    const cam = shot.update(0.6, s, 0, newPose());
    const lateral = -(cam.pos.x - s.pos.x) * Math.cos(s.heading) + (cam.pos.z - s.pos.z) * Math.sin(s.heading);
    expect(lateral * side).toBeGreaterThan(2);

    // the bike never swings back through upright while down, and lies on the fall side
    let maxLean = 0;
    for (let i = 0; i < (RIDE.fallDuration + 0.1) / DT && s.fallen; i++) {
      b.step(DT, input(0), FLAT_ENV);
      rider.update(DT, s);
      if (s.fallen) expect(fallSide(s)).toBe(side);
      maxLean = Math.max(maxLean, s.lean * side);
      // the rider is thrown to the bike's HIGH side (+X = the bike's left for a bike down on its right)
      if (s.fallen && RIDE.fallDuration - s.fallTimer > 0.5 && RIDE.fallDuration - s.fallTimer < 1.4) {
        expect(Math.sign(j.hips.position.x)).toBe(side);
      }
    }
    expect(maxLean).toBeGreaterThan(FALL_LEAN * 0.95);
    expect(s.fallen).toBe(false);
  });
});
