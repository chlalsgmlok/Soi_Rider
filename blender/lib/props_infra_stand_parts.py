"""prop_win_stand parts, polish pass: number-bib rider vests that read as vests (not cat faces) and a cheap but
recognisable Thai plastic stool. Builders return objects with WORLD-space mesh data, ready to join.

Vest-local frame: origin at the hem centre, +Z up, the number side faces -Y (u = +X is the viewer's right).
"""
import math
import bmesh
from mathutils import Vector
from .props_infra_kit import extrude, lathe, tube, bake, finish, _new_obj
from .props_infra_win import DIGITS, VEST_DEPTH, GAP, flat_rects

# Sleeveless vest seen from -Y: straight hem, armpits, gently scooped armholes, WIDE flat shoulder straps and a
# shallow neck dip (7.5 cm). The old narrow pointed straps + deep V read as cat ears from the diorama camera.
VEST_POLY = [(-0.25, 0.0), (0.25, 0.0), (0.26, 0.36), (0.205, 0.50), (0.20, 0.64), (0.085, 0.65), (0.0, 0.575),
             (-0.085, 0.65), (-0.20, 0.64), (-0.205, 0.50), (-0.26, 0.36)]
VEST_H = 0.65
STRAP_TOPS = ((-0.14, 0.645), (0.14, 0.645))
BIB = (-0.16, 0.06, 0.16, 0.44)          # big cream number bib covering most of the front panel
DIGIT_CELL, DIGIT_Z = 0.062, 0.25        # 3x5 pixel digit: 0.19 x 0.31 m, bold and centred on the bib


def digit_rects(digit, cell, cz):
    """World-size rects (x0, z0, x1, z1) of a pixel digit centred on x = 0, z = cz."""
    out = []
    for c0, r0, c1, r1 in DIGITS[digit]:
        out.append(((c0 - 1.5) * cell, cz + (2.5 - r1 - 1) * cell, (c1 - 0.5) * cell, cz + (2.5 - r0) * cell))
    return out


def vest(k, digit, M, vest_mat, patch_mat, ink_mat):
    """Orange vest + cream bib + bold ink digit, transformed by M. Returns [objects]."""
    front = -VEST_DEPTH / 2
    shell = extrude(f'vest{k}', VEST_POLY, VEST_DEPTH, material=vest_mat, back_cap=False)
    bib = flat_rects(f'bib{k}', [BIB], front - GAP, patch_mat)
    num = flat_rects(f'num{k}', digit_rects(digit, DIGIT_CELL, DIGIT_Z), front - 2 * GAP, ink_mat)
    return [bake(o, M) for o in (shell, bib, num)]


def hanger(k, M, hook, material):
    """Coat-hanger wire from both strap tops (vest-local, transformed by M) up to the world hook point."""
    left, right = (M @ Vector((u, 0.0, v)) for u, v in STRAP_TOPS)
    return tube(f'hanger{k}', [tuple(left), hook, tuple(right)], 0.012, segs=3, material=material, caps=False)


def thai_stool(name, loc, material, r_bot=0.178, r_top=0.140, z_top=0.39, leg_frac=0.52, z_arch=0.24, flare=0.16):
    """Classic Thai plastic stool, ~102 tris: rolled-rim round seat (14 segs) on a flared single-shell skirt with
    four flat-topped arched cut-outs, i.e. four wide splayed legs. The `Plastic` material is double-sided, so
    the inside of the skirt shows through the arches without a second wall. Legs keep wide flat feet (leg_frac of
    the period at the floor) and steep arch sides (`flare` of each gap), so they do not read as pointed spikes."""
    x, y, z = loc
    seat = lathe(f'{name}_seat', [(0.135, 0.388), (0.170, 0.410), (0.152, 0.440), (0.0, 0.447)], segs=14,
                 loc=(x, y, z), material=material, cap_bottom=False, cap_top=False, smooth=60)
    period = 2 * math.pi / 4
    lw, g = leg_frac * period, (1 - leg_frac) * period
    cols = []
    for s in range(4):
        a0 = s * period + math.pi / 4 - lw / 2          # legs on the diagonals
        cols += [(a0, 0.0), (a0 + lw, 0.0), (a0 + lw + g * flare, z_arch), (a0 + lw + g * (1 - flare), z_arch)]
    bm = bmesh.new()

    def ring_pt(a, zz):
        r = r_bot + (r_top - r_bot) * zz / z_top
        return bm.verts.new((x + r * math.cos(a), y + r * math.sin(a), z + zz))
    bottoms = [ring_pt(a, zz) for a, zz in cols]
    tops = [ring_pt(a, z_top) for a, _zz in cols]
    n = len(cols)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottoms[i], bottoms[j], tops[j], tops[i]))     # angle grows CCW -> outward normals
    skirt = _new_obj(f'{name}_skirt', bm, [material])
    return [seat, finish(skirt, smooth=50)]
