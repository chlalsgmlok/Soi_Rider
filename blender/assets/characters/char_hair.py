"""Head accessories for char_body: hair_short, hair_long, hair_bun, hat_cap (Hair / Hat) and acc_mask (Mask).

Each asset's origin = the `head` joint (neck base, z=1.36 in body space) -> parent to `head` with zero offset.
Hair shells hug the head ellipsoid (lib/characters_rig.head_point) and tuck into the scalp at the hairline.
Run: node blender/run-blender.mjs blender/assets/characters/char_hair.py [--no-preview] [--only=hair_bun,acc_mask]
"""
import os
import sys
import math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from mathutils import Vector
from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import join
from lib import characters_rig as R
from lib.characters_geo import shell, ellipsoid, tube, band, tuft, solidify, at_zero
from lib.characters_attach import run_family

ctx = start()
HD, HP = R.head_dir, R.head_point


def keyed(keys):
    """Cosine-interpolated lat(|lon|) from [(abs_lon, lat), ...]."""
    def f(lon):
        x = abs(lon)
        for (x0, y0), (x1, y1) in zip(keys, keys[1:]):
            if x0 <= x <= x1:
                t = (x - x0) / (x1 - x0)
                t = (1 - math.cos(t * math.pi)) / 2
                return y0 + (y1 - y0) * t
        return keys[-1][1]
    return f


def hair_shell(name, line_keys, top_off, edge_off, m, segs=16, fracs=(0.2, 0.42, 0.64, 0.84, 1.0), tuck=5.0,
               bulge=None):
    hl = keyed(line_keys)
    lats = [(lambda f: (lambda lon: 90 - f * (90 - hl(lon))))(f) for f in fracs] + [lambda lon: hl(lon) - tuck]
    last = len(lats)

    def pf(lon, lat, ri):
        if ri == last:
            return HP(HD(lon, lat), -0.007)
        f = 0.0 if ri == 0 else fracs[ri - 1]
        off = top_off + (edge_off - top_off) * (f ** 1.4)
        if bulge:
            off += bulge(lon, lat)
        return HP(HD(lon, lat), off)
    return shell(name, lats, segs, [m], pf, pole_top=True)


def lock(name, a, b, width, thick, m, off_a=0.02, off_b=0.012):
    """Hair lock between head-surface points a=(lon, lat) and b=(lon, lat)."""
    pa, pb = HP(HD(*a), off_a), HP(HD(*b), off_b)
    return tuft(name, pa, pb, width, thick, m, HD(*a))


# ---------------------------------------------------------------- hair_short
def hair_short():
    m = mat('Hair', 'hair_black', roughness=0.45)
    parts = [hair_shell('hs', [(0, 30), (35, 27), (65, 17), (88, 13), (102, 4), (125, -26), (150, -38), (180, -42)],
                        0.034, 0.012, m)]
    # one swept fringe (to the model's right) built from wide, flat, overlapping locks
    for i, (a, b) in enumerate((((-24, 44), (-42, 21)), ((-2, 45), (-22, 20)), ((20, 43), (2, 21)), ((40, 36), (30, 22)))):
        parts.append(lock(f'fr{i}', a, b, 0.088, 0.020, m, 0.024, 0.005))
    parts.append(lock('cowlick', (165, 66), (180, 84), 0.04, 0.02, m, 0.02, 0.05))
    return at_zero(join(parts, 'hair_short'), R.HEAD)


# ---------------------------------------------------------------- hair_long
def hair_long():
    m = mat('Hair', 'hair_brown', roughness=0.45)
    line = [(0, 34), (40, 30), (62, 12), (80, -22), (110, -48), (150, -60), (180, -62)]
    parts = [hair_shell('hl', line, 0.036, 0.016, m)]
    from lib.characters_geo import loft
    mass = loft('mass', [(1.255, 0, 0, 0.090), (1.275, 0.105, 0.040, 0.090), (1.320, 0.150, 0.062, 0.084),
                         (1.400, 0.164, 0.082, 0.070), (1.480, 0.160, 0.092, 0.052), (1.540, 0, 0, 0.040)], 10, [m])
    parts.append(mass)
    for s in (1, -1):
        parts.append(lock(f'side{s}', (s * 58, 30), (s * 68, -52), 0.06, 0.034, m, 0.024, 0.026))
        parts.append(lock(f'bang{s}', (s * 4, 52), (s * 34, 20), 0.075, 0.03, m, 0.03, 0.012))
    return at_zero(join(parts, 'hair_long'), R.HEAD)


# ---------------------------------------------------------------- hair_bun (low bun: sits under helmet rims)
def hair_bun():
    m = mat('Hair', 'hair_black', roughness=0.4)
    tie = mat('Hair_Tie', 'pin_coral', roughness=0.5)
    parts = [hair_shell('hb', [(0, 33), (40, 29), (70, 14), (92, 4), (120, -30), (180, -50)], 0.018, 0.009, m)]
    bun_c = Vector((0.0, 0.140, 1.402))
    parts.append(ellipsoid('bun', bun_c, (0.060, 0.052, 0.054), m, segs=10, rings=6, rot=(math.radians(-40), 0, 0)))
    axis = (bun_c - Vector((0, 0.0, 1.50))).normalized()
    base = bun_c - axis * 0.034
    u = Vector((1, 0, 0))
    v = axis.cross(u).normalized()
    ring = [base + (u * math.cos(a) + v * math.sin(a)) * 0.040 for a in [2 * math.pi * k / 10 for k in range(10)]]
    parts.append(tube('tie', ring, 0.0105, tie, segs=5, closed=True))
    for s in (1, -1):
        parts.append(lock(f'part{s}', (s * 6, 46), (s * 40, 26), 0.07, 0.02, m, 0.016, 0.008))
    return at_zero(join(parts, 'hair_bun'), R.HEAD)


# ---------------------------------------------------------------- hat_cap (cap + short hair below it)
def hat_cap():
    hair = mat('Hair', 'hair_black', roughness=0.45)
    hat = mat('Hat', 'cloth_red', roughness=0.7)
    logo = mat('Hat_Logo', 'cream', roughness=0.6)
    parts = [hair_shell('hs', [(0, 28), (35, 25), (65, 16), (88, 12), (102, 4), (125, -26), (150, -38), (180, -42)],
                        0.016, 0.012, hair)]
    rim = keyed([(0, 21), (60, 16), (95, 8), (140, -2), (180, -6)])
    fr = (0.25, 0.5, 0.75, 1.0)
    lats = [(lambda f: (lambda lon: 90 - f * (90 - rim(lon))))(f) for f in fr] + [lambda lon: rim(lon) - 3]

    def pf(lon, lat, ri):
        off = 0.004 if ri == len(lats) else 0.030 - 0.010 * (fr[ri - 1] if ri else 0)
        return HP(HD(lon, lat), off)
    parts.append(shell('crown', lats, 16, [hat], pf, pole_top=True))
    for lon in (0, 60, 120, 180, -120, -60):
        pts = [HP(HD(lon, la), 0.031 - 0.010 * (90 - la) / max(90 - rim(lon), 1)) for la in
               (88, 70, 52, 34, rim(lon) + 2)]
        parts.append(tube(f'seam{lon}', pts, 0.0026, hat, segs=4))
    parts.append(ellipsoid('button', HP(HD(0, 90), 0.030), (0.014, 0.014, 0.008), hat, segs=8, rings=3))
    lons = [-78 + 156 * i / 10 for i in range(11)]
    pts, nrm, wid = [], [], []
    for lon in lons:
        t = lon / 78
        w = 0.125 * max(math.cos(math.radians(lon) * 1.12), 0.04) ** 0.75
        radial = Vector((math.sin(math.radians(lon)), -math.cos(math.radians(lon)), 0))
        p = HP(HD(lon, rim(lon)), 0.022) + radial * (w * 0.5 - 0.006)
        p.z -= 0.022 * t * t
        pts.append(p)
        nrm.append((Vector((0, 0, 1)) + radial * 0.22).normalized())
        wid.append(w)
    parts.append(band('brim', pts, nrm, wid, 0.012, hat, smooth_angle=50))
    lons = (-16, -8, 0, 8, 16)
    lp = [HP(HD(lon, 52), 0.0295) for lon in lons]
    parts.append(band('logo', lp, [HD(lon, 52) for lon in lons], [0.03, 0.046, 0.05, 0.046, 0.03], 0.004, logo,
                      smooth_angle=40))
    return at_zero(join(parts, 'hat_cap'), R.HEAD)


# ---------------------------------------------------------------- acc_mask (surgical mask + ear loops)
def acc_mask():
    m = mat('Mask', 'glass_light', roughness=0.85)
    top = keyed([(0, -1), (40, -6), (72, -14)])
    bot = keyed([(0, -60), (40, -56), (72, -48)])
    fr = [0.0, 0.17, 0.34, 0.5, 0.67, 0.84, 1.0]
    lats = [(lambda f: (lambda lon: top(lon) + (bot(lon) - top(lon)) * f))(f) for f in fr]

    def pf(lon, lat, ri):
        lon_c = max(-72.0, min(72.0, lon))
        bump = math.exp(-((lon_c / 32) ** 2 + ((lat + 18) / 24) ** 2))
        pleat = 0.0035 if ri in (2, 4) else 0.0
        return HP(HD(lon_c, lat), 0.010 + 0.016 * bump + pleat)
    segs = 25
    keep = lambda ri, k: (k < 5 or k >= segs - 5)  # noqa: E731  faces spanning lon -72..72
    face = shell('mask', lats, segs, [m], pf, pole_top=False, keep=keep)
    solidify(face, 0.004, offset=-1)
    parts = [face]
    for s in (1, -1):
        a = HP(HD(s * 72, top(72)), 0.012)
        b = HP(HD(s * 72, bot(72)), 0.012)
        mids = [HP(HD(s * lo, la), off) for lo, la, off in
                ((84, 6, 0.012), (92, 15, 0.03), (103, -2, 0.016), (95, -22, 0.014), (82, -34, 0.012))]
        parts.append(tube(f'loop{s}', [a] + mids + [b], 0.0026, m, segs=4))
    return at_zero(join(parts, 'acc_mask'), R.HEAD)


run_family(ctx, {'hair_short': hair_short, 'hair_long': hair_long, 'hair_bun': hair_bun, 'hat_cap': hat_cap,
                 'acc_mask': acc_mask}, socket='head')
print('[char_hair] OK')
