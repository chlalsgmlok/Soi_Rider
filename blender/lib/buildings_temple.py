"""Thai temple (ubosot) roof vocabulary for bld_temple. Roofs run along Y; gables face -Y (front) / +Y (back).

gable_tier  : inverted-V roof slab (both slopes) between y0..y1, eaves at +-xe / ze, ridge zr
slope_slab  : one-sided lower tier (parallelogram) from (xa, za) down to (xb, zb), mirrored when both=True
eave_border : thin coloured strip lying on a slope along the eave edge (the green border of Thai roofs)
naa_ban     : gold gable face (pentagon) with a red inset and gold medallion
bargeboard  : gold chevron verge board with bai-raka teeth, chofa finial on the apex, hang-hong tails at the eaves
"""
import math
from lib.shapes import cyl
from lib.buildings_kit import prism


def gable_tier(P, name, y0, y1, xe, ze, zr, t, material):
    k = t / math.cos(math.atan2(zr - ze, xe))
    prof = [(-xe, ze), (-xe, ze - t), (0.0, zr - k), (xe, ze - t), (xe, ze), (0.0, zr)]
    P.add(prism(name, prof, y0, y1, 'Y', material, smooth=20))


def slope_slab(P, name, y0, y1, xa, za, xb, zb, t, material, both=True):
    for s in ((-1, 1) if both else (1,)):
        prof = [(s * xa, za), (s * xb, zb), (s * xb, zb - t), (s * xa, za - t)]
        P.add(prism(name, prof, y0, y1, 'Y', material, smooth=20))


def eave_border(P, y0, y1, xa, za, xb, zb, width, material, lift=0.04, t=0.07, both=True):
    """Strip on top of the slope from the eave edge (xb, zb) up the slope by `width` metres."""
    L = math.hypot(xa - xb, za - zb)
    f = width / L
    xm, zm = xb + (xa - xb) * f, zb + (za - zb) * f
    slope_slab(P, 'eave_border', y0, y1, xm, zm + lift + t, xb - 0.02 * (1 if xb > 0 else -1), zb + lift + t, t, material, both)


def naa_ban(P, M, y, xe, z_low, ze, zr, depth=0.18, facing=-1):
    """Gable face: gold pentagon (x +-xe, z_low..ze, apex zr) with an inset red pentagon and a medallion."""
    a, b = (y, y - facing * depth) if facing < 0 else (y - depth, y)
    P.add(prism('naa_ban', [(-xe, z_low), (xe, z_low), (xe, ze), (0.0, zr), (-xe, ze)], min(a, b), max(a, b), 'Y', M['gold']))
    i = 0.32
    zi_r = zr - i * 1.8
    inset = [(-xe + i, z_low + i), (xe - i, z_low + i), (xe - i, ze + 0.05), (0.0, zi_r), (-xe + i, ze + 0.05)]
    yy = y + facing * 0.02 if facing < 0 else y + 0.02
    P.add(prism('naa_ban_in', inset, min(yy, yy + facing * 0.05), max(yy, yy + facing * 0.05), 'Y', M['red2']))
    zc = (z_low + ze) / 2 + (zr - ze) * 0.25
    P.add(cyl('naa_disc', min(0.55, xe * 0.22), 0.1, (0.0, yy + facing * 0.06, zc), M['gold'], rot=(math.pi / 2, 0, 0),
              verts=8, bevel=0))


def _line_z(xe, ze, zr, x):
    return zr - (zr - ze) * abs(x) / xe


def bargeboard(P, M, y, xe, ze, zr, facing=-1, teeth=4, chofa_h=1.5, tails=True):
    """Gold verge board following the roof line at the gable end y, plus decorations."""
    h, up = 0.34, 0.14
    X = xe + 0.12
    zt_e, zt_r = _line_z(xe, ze, zr, X) + up, zr + up
    prof = [(-X, zt_e), (-X, zt_e - h), (0.0, zt_r - h), (X, zt_e - h), (X, zt_e), (0.0, zt_r)]
    y0, y1 = sorted((y, y - facing * 0.2))
    P.add(prism('barge', prof, y0, y1, 'Y', M['gold'], smooth=20))
    ym0, ym1 = sorted((y - facing * 0.06, y - facing * 0.14))
    for s in (-1, 1):
        for k in range(teeth):
            u0 = 0.18 + (X - 0.6) * k / teeth
            u1 = u0 + 0.34
            p0 = (s * (X - u0), zt_r - (zt_r - zt_e) * (X - u0) / X)
            p1 = (s * (X - u1), zt_r - (zt_r - zt_e) * (X - u1) / X)
            tip = (s * (X - u0 - 0.06), max(p0[1], p1[1]) + 0.36)
            P.add(prism('bai_raka', [p0, p1, tip], ym0, ym1, 'Y', M['gold']))
        if tails:
            hang_hong(P, M, s * X, zt_e - h * 0.5, (y0 + y1) / 2, s)
    chofa(P, M, 0.0, (y0 + y1) / 2, zt_r - 0.05, chofa_h, facing)


def chofa(P, M, x, y, z, hgt, facing=-1):
    """Gold bird-head finial: slender neck rising from the apex, curling forward (towards `facing` Y) into a beak."""
    f = facing
    pts = [(0.11, 0.0), (0.09, 0.55), (0.06, 0.9), (0.0, 1.0), (-0.16, 1.03), (-0.36, 0.94), (-0.2, 0.9),
           (-0.08, 0.82), (-0.06, 0.55), (-0.11, 0.0)]
    prof = [(y + f * -u * hgt, z + v * hgt) for u, v in pts]
    P.add(prism('chofa', prof, x - 0.09, x + 0.09, 'X', M['gold'], smooth=50))


def hang_hong(P, M, x, z, y, side):
    """Curled gold tail at the lower end of a bargeboard, flicking up and outwards."""
    pts = [(-0.05, -0.05), (0.2, -0.05), (0.5, 0.3), (0.42, 0.62), (0.3, 0.3), (-0.05, 0.12)]
    prof = [(x + side * u, z + v) for u, v in pts]
    P.add(prism('hang_hong', prof, y - 0.08, y + 0.08, 'Y', M['gold'], smooth=50))
