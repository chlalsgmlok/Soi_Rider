"""prop_win_stand parts: motorcycle-taxi rider vests with modelled numbers, and a Thai plastic stool.

Builders return objects whose mesh data is in world coordinates (see props_infra_kit), ready to join.
Vest-local frame: origin at the hem centre, +Z up, the number side faces -Y (u = +X is the viewer's right).
"""
import math
import bmesh
from mathutils import Matrix, Vector
from .props_infra_kit import extrude, lathe, tube, bake, drop_faces, _new_obj

VEST_DEPTH = 0.04
GAP = 0.005          # stand-off between stacked flat layers (vest -> patch -> digit), avoids z-fighting

# sleeveless rider vest, counter-clockwise from the bottom-left as seen from -Y: straight hem, armpit,
# scooped armhole, narrow shoulder strap, deep V-neck. Front cap + walls only: the open back is never seen
# from the street and the materials are double-sided.
VEST_POLY = [(-0.25, 0.0), (0.25, 0.0), (0.26, 0.33), (0.19, 0.45), (0.165, 0.66), (0.085, 0.66), (0.0, 0.42),
             (-0.085, 0.66), (-0.165, 0.66), (-0.19, 0.45), (-0.26, 0.33)]
VEST_H = 0.66
STRAP_TOPS = ((-0.125, VEST_H), (0.125, VEST_H))

# chunky 3x5 pixel digits: rects (col0, row0, col1, row1) inclusive, row 0 = top
DIGITS = {
    1: [(1, 0, 1, 3), (0, 1, 0, 1), (0, 4, 2, 4)],
    2: [(0, 0, 2, 0), (2, 1, 2, 1), (0, 2, 2, 2), (0, 3, 0, 3), (0, 4, 2, 4)],
    3: [(0, 0, 1, 0), (1, 2, 1, 2), (0, 4, 1, 4), (2, 0, 2, 4)],
    4: [(0, 0, 0, 1), (0, 2, 1, 2), (2, 0, 2, 4)],
    7: [(0, 0, 2, 0), (2, 1, 2, 4)],
}


def flat_rects(name, rects, y, material):
    """Quads in the XZ plane at depth y, facing -Y. rects: [(x0, z0, x1, z1)]."""
    bm = bmesh.new()
    for x0, z0, x1, z1 in rects:
        vs = [bm.verts.new(p) for p in ((x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1))]
        bm.faces.new(vs)
    return _new_obj(name, bm, [material])


def digit_rects(digit, cell, cz):
    """World-size rects of a pixel digit centred on x = 0, z = cz."""
    out = []
    for c0, r0, c1, r1 in DIGITS[digit]:
        out.append(((c0 - 1.5) * cell, cz + (2.5 - r1 - 1) * cell, (c1 - 0.5) * cell, cz + (2.5 - r0) * cell))
    return out


def vest(k, digit, M, vest_mat, patch_mat, ink_mat):
    """Orange vest + cream number bib + raised-looking ink digit, transformed by M. Returns [objects]."""
    front = -VEST_DEPTH / 2
    shell = extrude(f'vest{k}', VEST_POLY, VEST_DEPTH, material=vest_mat, back_cap=False)
    bib = flat_rects(f'bib{k}', [(-0.12, 0.07, 0.12, 0.37)], front - GAP, patch_mat)
    num = flat_rects(f'num{k}', digit_rects(digit, 0.046, 0.22), front - 2 * GAP, ink_mat)
    return [bake(o, M) for o in (shell, bib, num)]


def hanger(k, M, hook, material):
    """Coat-hanger wire from both strap tops (vest-local, transformed by M) up to the world hook point."""
    left, right = (M @ Vector((u, 0.0, v)) for u, v in STRAP_TOPS)
    return tube(f'hanger{k}', [tuple(left), hook, tuple(right)], 0.012, segs=3, material=material, caps=False)


def thai_stool(name, loc, material, splay_deg=9.0):
    """Rolled-rim seat disc on four splayed, flared panel legs (reads like mockup 03 / prop_stool)."""
    x, y, z = loc
    seat = lathe(f'{name}_seat', [(0.12, 0.385), (0.168, 0.405), (0.155, 0.44), (0.0, 0.448)], segs=8,
                 loc=(x, y, z), phase=math.pi / 8, material=material, cap_bottom=True, smooth=60)
    parts = [seat]
    leg = [(-0.065, -0.39), (0.065, -0.39), (0.045, 0.0), (-0.045, 0.0)]   # top at the pivot, flares downward
    tilt = Matrix.Rotation(-math.radians(splay_deg), 4, 'X')
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        M = Matrix.Translation((x, y, z)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((0, -0.125, 0.39)) @ tilt
        panel = extrude(f'{name}_leg{i}', leg, 0.024, material=material, smooth=30, back_cap=False)
        drop_faces(panel, lambda c, n: abs(n.z) > 0.9)    # buried top edge + floor edge
        parts.append(bake(panel, M))
    return parts
