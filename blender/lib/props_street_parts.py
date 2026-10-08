"""props_street small part builders shared by the street-prop scripts (rounded blocks, tyres, rings).

rbox(): a box with ONE wide chamfer segment, re-smoothed at 60 deg. Joined through props_street_kit.finish()
(weighted normals, face-area mode) the big faces stay flat and the chamfer shades like a soft rounded edge,
the cheap way to get the chunky toy-block look (44 tris instead of ~108 for a 2-segment bevel).
"""
import math
import random

from .shapes import box
from .props_street_kit import lathe, smooth


def rbox(name, size, loc, material, bevel=0.03, rot=(0, 0, 0), smooth_angle=60):
    """Rounded toy block. size = full extents (x, y, z), loc = centre."""
    o = box(name, size, loc, material, bevel=bevel, segments=1, rot=rot)
    return smooth(o, smooth_angle)


def tyre(name, radius, width, loc, tire_m, hub_m, axis='y', segs=10, hub_frac=0.58, rim_mat=None, simple=False):
    """Chunky cartoon tyre with a domed hub cap, built as one lathe (exact tri control).

    axis: 'x' or 'y' = axle direction. rim_mat (optional) paints a thin coloured ring between hub and tyre.
    simple=True: 6-point profile (about half the triangles) for small wheels.
    """
    w = width / 2
    rh = radius * hub_frac
    mats = [hub_m, tire_m] + ([rim_mat] if rim_mat else [])
    rim = 2 if rim_mat else 0
    if simple:
        prof = [(0.0, -w * 1.05), (rh, -w * 0.95), (radius, -w * 0.6), (radius, w * 0.6), (rh, w * 0.95), (0.0, w * 1.05)]
        bands = [0, 1, 1, 1, 0]
    else:
        prof = [(0.0, -w * 1.05), (rh * 0.7, -w * 1.02), (rh, -w * 0.9), (radius * 0.93, -w * 0.95),
                (radius, -w * 0.55), (radius, w * 0.55), (radius * 0.93, w * 0.95), (rh, w * 0.9),
                (rh * 0.7, w * 1.02), (0.0, w * 1.05)]
        bands = [0, rim, 1, 1, 1, 1, 1, rim, 0]
    rot = (math.pi / 2, 0, 0) if axis == 'y' else (0, math.pi / 2, 0)
    return lathe(name, prof, mats, segs=segs, band_mat=bands, loc=loc, rot=rot, smooth_angle=55)


def ball(name, radius, loc, material, segs=7, scale=(1, 1, 1), squash_top=1.0, jitter=0.0, seed=0):
    """Smooth low-poly ball as a lathe (pole + 3 rings + pole = 6*segs tris): rounder than an icosphere.

    jitter > 0 pushes ring vertices in/out randomly (fraction of radius) for organic foliage / flower puffs.
    """
    prof = [(0.0, -radius), (radius * 0.72, -radius * 0.7), (radius, 0.0), (radius * 0.72, radius * 0.7 * squash_top),
            (0.0, radius * squash_top)]
    rng = random.Random(seed)
    wob = (lambda i, k: (radius * jitter * rng.uniform(-1, 1), radius * jitter * 0.5 * rng.uniform(-1, 1)))         if jitter > 0 else None
    o = lathe(name, prof, material, segs=segs, loc=loc, smooth_angle=89, wobble=wob, phase=rng.uniform(0, 1))
    o.scale = scale
    return o


def ring(name, r_in, r_out, depth, loc, material, rot=(0, 0, 0), segs=16):
    """Flat bezel ring (annulus with a rounded face) facing local +Z."""
    prof = [(r_in, 0.0), (r_in + (r_out - r_in) * 0.25, depth), (r_out - (r_out - r_in) * 0.25, depth), (r_out, 0.0)]
    return lathe(name, prof, material, segs=segs, loc=loc, rot=rot, smooth_angle=60)
