"""SOI RIDER character landmarks (Blender world space, Z-up, metres, facing -Y, model LEFT = +X).

Single source of truth for the segmented rig in char_body and every attachment (hair, helmets,
outfits) so that parenting an attachment to `head` / `torso` with ZERO offset fits exactly.
"""
import math
from mathutils import Vector

HEIGHT = 1.68

# joints (node origins)
HIPS = Vector((0.0, 0.0, 0.92))          # root, pelvis centre
TORSO = Vector((0.0, 0.0, 1.00))         # waist
HEAD = Vector((0.0, 0.0, 1.36))          # neck base -> head / hair / helmet attach pivot
SHOULDER_X, SHOULDER_Z = 0.180, 1.290
HIP_X, HIP_Z = 0.095, 0.855
KNEE_Z, ANKLE_Z = 0.470, 0.085
UPPER_ARM, FOREARM = 0.26, 0.24
A_POSE = math.radians(15.0)              # arms out from vertical

# head ellipsoid (skin surface)
HEAD_C = Vector((0.0, -0.005, 1.535))
HEAD_R = Vector((0.140, 0.143, 0.150))   # x (half width), y (half depth), z (half height)
CHIN_TAPER = 0.12                        # lower face narrows by this fraction at the chin


def arm_dir(side):
    """Unit vector shoulder->hand in the neutral A-pose. side=+1 for _L (+X), -1 for _R."""
    return Vector((side * math.sin(A_POSE), 0.0, -math.cos(A_POSE)))


def shoulder(side):
    return Vector((side * SHOULDER_X, 0.0, SHOULDER_Z))


def elbow(side):
    return shoulder(side) + arm_dir(side) * UPPER_ARM


def wrist(side):
    return elbow(side) + arm_dir(side) * FOREARM


def hip_joint(side):
    return Vector((side * HIP_X, 0.0, HIP_Z))


def knee(side):
    return Vector((side * HIP_X, 0.0, KNEE_Z))


def ankle(side):
    return Vector((side * HIP_X, 0.0, ANKLE_Z))


def head_dir(lon_deg, lat_deg):
    """Unit direction on the head sphere. lon 0 = face front (-Y), +lon towards model LEFT (+X).
    lat +90 = crown, -90 = under the chin."""
    lo, la = math.radians(lon_deg), math.radians(lat_deg)
    return Vector((math.cos(la) * math.sin(lo), -math.cos(la) * math.cos(lo), math.sin(la)))


def head_point(u, off=0.0, center=None, radii=None):
    """Point on the (chin-tapered) head ellipsoid along unit dir `u`, pushed out by `off` metres."""
    c = center if center is not None else HEAD_C
    r = radii if radii is not None else HEAD_R
    taper = 1.0
    if u.z < 0:
        taper = 1.0 - CHIN_TAPER * (u.z * u.z)
    return Vector((c.x + (r.x * taper + off) * u.x,
                   c.y + (r.y + off) * u.y,
                   c.z + (r.z + off) * u.z))


# torso profile: (z, rx, ry, cy) rings of the shirt torso; outfits offset from it
TORSO_RINGS = [
    (0.935, 0.150, 0.104, 0.000),
    (0.962, 0.177, 0.131, 0.000),   # shirt hem lip (overhangs the pants)
    (0.992, 0.166, 0.123, 0.000),
    (1.070, 0.156, 0.120, -0.004),
    (1.160, 0.163, 0.127, -0.008),
    (1.240, 0.172, 0.128, -0.008),
    (1.292, 0.172, 0.121, -0.004),
    (1.336, 0.150, 0.106, 0.000),
    (1.365, 0.104, 0.080, 0.004),
    (1.382, 0.062, 0.056, 0.006),
]


def torso_at(z):
    """Interpolated (rx, ry, cy) of the shirt torso at height z (clamped to the profile)."""
    rings = TORSO_RINGS
    if z <= rings[0][0]:
        return rings[0][1:]
    for a, b in zip(rings, rings[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            return tuple(a[i] + (b[i] - a[i]) * t for i in (1, 2, 3))
    return rings[-1][1:]
