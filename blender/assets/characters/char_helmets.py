"""Helmets for char_body: helmet_open (open face + peak), helmet_full (full face, smoke Visor),
helmet_half (bowl + goggles), helmet_cat (round + cat ears). Materials Helmet_Paint / Helmet_Trim / Visor.

Origin = `head` joint (neck base) -> parent to `head` with zero offset. Shells enclose every hair asset
(hair shells reach HEAD_R + 0.045 at most; helmet liners start at HEAD_R + 0.04..0.06).
Run: node blender/run-blender.mjs blender/assets/characters/char_helmets.py [--no-preview] [--only=helmet_cat]
"""
import os
import sys
import math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bmesh
from mathutils import Vector, Matrix
from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import join, cyl
from lib import characters_rig as R
from lib.characters_geo import shell, ellipsoid, tube, band, tuft, solidify, at_zero, frame_matrix, transform
from lib.characters_attach import run_family

ctx = start()
HD, HP = R.head_dir, R.head_point


def mats(paint):
    return (mat('Helmet_Paint', paint, roughness=0.32),
            mat('Helmet_Trim', 'ink', roughness=0.55),
            mat('Visor', 'visor_smoke', roughness=0.06, metallic=0.35))


def ell(c, r, lon, lat, off=0.0):
    u = HD(lon, lat)
    return Vector((c.x + (r.x + off) * u.x, c.y + (r.y + off) * u.y, c.z + (r.z + off) * u.z))


def project(p, c, r):
    d = Vector(((p.x - c.x) / r.x, (p.y - c.y) / r.y, (p.z - c.z) / r.z)).normalized()
    return Vector((c.x + r.x * d.x, c.y + r.y * d.y, c.z + r.z * d.z))


def smooth_rim(obj, c, r, iters=3, f=0.5, zmin=None):
    """Round the corners of shell openings: Laplacian-smooth boundary loops, re-project on the ellipsoid.
    Boundary verts below `zmin` are left alone (radial re-projection of chord midpoints drags a nape rim down
    by several degrees per pass)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for _ in range(iters):
        moves = {}
        for v in bm.verts:
            if not v.is_boundary or (zmin is not None and v.co.z < zmin):
                continue
            nbs = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nbs) == 2:
                moves[v] = project(v.co.lerp((nbs[0].co + nbs[1].co) / 2, f), c, r)
        for v, p in moves.items():
            v.co = p
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def helmet_shell(name, c, r, lats, segs, paint, trim, opening, thickness=0.024, deform=None, rim_zmin=None):
    """opening(ri, k_signed) -> True to cut the quad. k_signed in (-segs/2, segs/2]: 0 = front-left of centre."""
    def keep(ri, k):
        ks = k if k < segs / 2 else k - segs
        return not opening(ri, ks)

    def pf(lon, lat, ri):
        return ell(c, r, lon, lat)
    s = shell(name, lats, segs, [paint, trim], pf, pole_top=True, keep=keep)
    smooth_rim(s, c, r, zmin=rim_zmin)
    if deform:
        for v in s.data.vertices:
            v.co = deform(v.co.copy())
        s.data.update()
    solidify(s, thickness, offset=-1, mat_offset=1, rim_offset=1)
    return s


def strap(name, trim, side_lon=84, side_lat=-34, c=None, r=None):
    """Chin strap from helmet side (inside the shell) under the chin to the other side."""
    pts, nrm = [], []
    for lon, lat, off in ((side_lon, side_lat, 0.03), (78, -52, 0.010), (55, -72, 0.010), (0, -84, 0.011),
                          (-55, -72, 0.010), (-78, -52, 0.010), (-side_lon, side_lat, 0.03)):
        pts.append(HP(HD(lon, lat), off))
        nrm.append(HD(lon, lat))
    return band(name, pts, nrm, 0.017, 0.004, trim)


def peak(name, c, r, lat, span, depth, m, tilt=0.18, thick=0.014):
    lons = [-span + 2 * span * i / 8 for i in range(9)]
    pts, nrm, wid = [], [], []
    for lon in lons:
        w = depth * max(math.cos(math.radians(lon) * 90 / span), 0.06) ** 0.7
        radial = Vector((math.sin(math.radians(lon)), -math.cos(math.radians(lon)), 0))
        p = ell(c, r, lon, lat, -0.004) + radial * (w * 0.5 - 0.01)
        p.z -= 0.012 * (lon / span) ** 2
        pts.append(p)
        nrm.append((Vector((0, 0, 1)) + radial * tilt).normalized())
        wid.append(w)
    return band(name, pts, nrm, wid, thick, m, smooth_angle=50)


def meridian_band(name, c, r, lon, lat0, lat1, width, m, n=6, off=0.0, thick=0.004):
    lats = [lat0 + (lat1 - lat0) * i / (n - 1) for i in range(n)]
    pts = [ell(c, r, lon, la, off) for la in lats]
    return band(name, pts, [HD(lon, la) for la in lats], width, thick, m)


def disc(name, center, normal, radius, depth, m, verts=10, bevel=0.0):
    d = cyl(name, radius, depth, (0, 0, 0), m, verts=verts, bevel=bevel)
    transform(d, Matrix.Translation(center) @ frame_matrix(normal, (0, 0, 1) if abs(
        Vector(normal).z) < 0.9 else (0, 1, 0)).to_4x4())
    return d


# ---------------------------------------------------------------- helmet_open
C_OPEN, R_OPEN = Vector((0, 0.006, 1.556)), Vector((0.204, 0.210, 0.212))


def helmet_open():
    paint, trim, _ = mats('cream')
    lats = [74, 56, 38, 20, 4, -12, -26, lambda lon: -38 + 9 * (abs(lon) / 180) ** 2]
    segs = 16
    s = helmet_shell('shell', C_OPEN, R_OPEN, lats, segs, paint, trim,
                     opening=lambda ri, ks: ri >= 4 and -3 <= ks <= 2)
    parts = [s, peak('peak', C_OPEN, R_OPEN, 20, 62, 0.085, trim)]
    stripe = mat('Helmet_Stripe', 'cloth_red', roughness=0.4)  # fixed accent (mockup 03 player helmet)
    parts.append(meridian_band('stripe', C_OPEN, R_OPEN, 0, 30, 178, 0.05, stripe, n=9))
    for sgn in (1, -1):
        parts.append(meridian_band(f'vent{sgn}', C_OPEN, R_OPEN, sgn * 26, 44, 60, 0.018, trim, n=3, thick=0.005))
    parts.append(strap('strap', trim))
    return at_zero(join(parts, 'helmet_open'), R.HEAD)


# ---------------------------------------------------------------- helmet_full
C_FULL, R_FULL = Vector((0, 0.004, 1.548)), Vector((0.206, 0.214, 0.220))


def helmet_full():
    paint, trim, visor = mats('tuktuk_blue')
    # chin bar reaches lat -58 at the front; the nape rim rises to -22 at the back so hair_bun / hair_long hang
    # below the shell instead of poking through it (see char_assembly.py --fit)
    rim = lambda lon: -58 + 36 * abs(lon) / 180  # noqa: E731
    lats = [72, 50, 28, 8, -10, lambda lon: -10 + (rim(lon) + 10) * 0.36, lambda lon: -10 + (rim(lon) + 10) * 0.70,
            rim]
    segs = 16

    def chin(p):
        d = Vector(((p.x - C_FULL.x) / R_FULL.x, (p.y - C_FULL.y) / R_FULL.y, (p.z - C_FULL.z) / R_FULL.z)).normalized()
        lon, lat = math.degrees(math.atan2(d.x, -d.y)), math.degrees(math.asin(max(-1.0, min(1.0, d.z))))
        w = max(0.0, 1 - abs(lon) / 80) * max(0.0, min(1.0, (-lat - 12) / 25))
        return p + Vector((0, -0.032 * w, -0.008 * w))
    s = helmet_shell('shell', C_FULL, R_FULL, lats, segs, paint, trim,
                     opening=lambda ri, ks: ri in (3, 4) and -3 <= ks <= 2, deform=chin, rim_zmin=C_FULL.z - 0.06)
    parts = [s]
    rv = R_FULL + Vector((0.006, 0.006, 0.006))
    top = lambda lon: 32 - 6 * (abs(lon) / 80) ** 2  # noqa: E731
    bot = lambda lon: -15 + 4 * (abs(lon) / 80) ** 2  # noqa: E731
    lats_v = [top, lambda lon: (top(lon) + bot(lon)) / 2, bot]

    def vpf(lon, lat, _ri):
        return ell(C_FULL, rv, max(-78.0, min(78.0, lon)), lat)
    parts.append(shell('visor', lats_v, 26, [visor], vpf, pole_top=False,
                       keep=lambda ri, k: k < 6 or k >= 20, smooth_angle=None))
    for sgn in (1, -1):
        parts.append(disc(f'hinge{sgn}', ell(C_FULL, rv, sgn * 80, 4, 0.004), HD(sgn * 80, 4), 0.024, 0.012, trim, verts=8))
    for i, z in enumerate((-0.014, 0.0, 0.014)):
        p = ell(C_FULL, R_FULL, 0, -40) + Vector((0, -0.032, z))
        parts.append(band(f'vent{i}', [p + Vector((x, 0, 0)) for x in (-0.03, 0, 0.03)],
                          [Vector((0, -1, 0.15))] * 3, 0.007, 0.006, trim))
    sp = [ell(C_FULL, R_FULL, lon, 22, -0.006) for lon in (140, 160, 180, -160, -140)]
    parts.append(band('spoiler', sp, [HD(lon, 22) for lon in (140, 160, 180, -160, -140)], 0.04, 0.016, trim))
    stripe = mat('Helmet_Stripe', 'cream', roughness=0.4)  # fixed racing stripe, visor top -> spoiler
    parts.append(meridian_band('stripe', C_FULL, R_FULL, 0, 36, 156, 0.05, stripe, n=8))
    return at_zero(join(parts, 'helmet_full'), R.HEAD)


# ---------------------------------------------------------------- helmet_half
C_HALF, R_HALF = Vector((0, 0.006, 1.572)), Vector((0.202, 0.208, 0.196))


def helmet_half():
    paint, trim, visor = mats('taxi_green')
    chrome = mat('Goggle_Frame', 'chrome', roughness=0.2, metallic=0.85)
    lats = [70, 50, 32, 16, lambda lon: 4 - 12 * (abs(lon) / 180) ** 1.2]
    s = helmet_shell('bowl', C_HALF, R_HALF, lats, 16, paint, trim, opening=lambda ri, ks: False, thickness=0.022)
    parts = [s]
    ring = [ell(C_HALF, R_HALF, lon, 22 - 10 * (abs(lon) / 180), 0.0) for lon in range(-180, 180, 30)]
    parts.append(band('gstrap', ring, [HD(lon, 22) for lon in range(-180, 180, 30)], 0.034, 0.006, trim, closed=True))
    for sgn in (1, -1):
        n = HD(sgn * 24, 24)
        cpos = ell(C_HALF, R_HALF, sgn * 24, 24, 0.020)
        parts.append(disc(f'lens{sgn}', cpos, n, 0.036, 0.022, visor))
        fr = frame_matrix(n, (0, 0, 1))
        rim = [cpos + n * 0.010 + fr @ Vector((math.cos(a), math.sin(a), 0)) * 0.038
               for a in [2 * math.pi * k / 12 for k in range(12)]]
        parts.append(tube(f'gframe{sgn}', rim, 0.0075, chrome, segs=4, closed=True))
    parts.append(tube('bridge', [ell(C_HALF, R_HALF, lon, 25, 0.026) for lon in (-10, 0, 10)], 0.008, chrome, segs=4))
    parts.append(strap('strap', trim, side_lon=86, side_lat=-6))
    return at_zero(join(parts, 'helmet_half'), R.HEAD)


# ---------------------------------------------------------------- helmet_cat
C_CAT, R_CAT = Vector((0, 0.006, 1.560)), Vector((0.212, 0.214, 0.214))


def helmet_cat():
    paint, trim, _ = mats('taxi_pink')
    inner = mat('Cat_Ear_Inner', 'cream', roughness=0.6)
    lats = [74, 56, 38, 22, 6, -10, -24, lambda lon: -36 + 8 * (abs(lon) / 180) ** 2]
    s = helmet_shell('shell', C_CAT, R_CAT, lats, 16, paint, trim, opening=lambda ri, ks: ri >= 4 and -3 <= ks <= 2)
    parts = [s]
    for sgn in (1, -1):
        # flat triangular ears with soft round tips (thin along the face normal so they read as cat ears, not horns)
        lon = sgn * 42
        side = Vector((math.sin(math.radians(lon)), -math.cos(math.radians(lon)), 0))
        base = ell(C_CAT, R_CAT, lon, 50, -0.036)
        up = (Vector((0, 0, 1)) + Vector((sgn, 0, 0)) * 0.30).normalized()
        tip = base + up * 0.165
        parts.append(tuft(f'ear{sgn}', base, tip, 0.19, 0.046, paint, side, segs=8, profile=(1.0, 0.86, 0.62, 0.36)))
        parts.append(tuft(f'inner{sgn}', base + side * 0.019 + up * 0.04, tip + side * 0.008 - up * 0.03, 0.105,
                          0.014, inner, side, segs=6, profile=(1.0, 0.8, 0.55, 0.28)))
        for j, (lat, lift) in enumerate(((-6, 0.012), (-17, -0.004))):
            p0 = ell(C_CAT, R_CAT, sgn * 74, lat, -0.004)
            radial = Vector((math.sin(math.radians(sgn * 74)), -math.cos(math.radians(sgn * 74)), 0))
            fwd = Vector((0, -1, 0))
            pts = [p0, p0 + radial * 0.05 + fwd * 0.02 + Vector((0, 0, lift * 0.5)),
                   p0 + radial * 0.095 + fwd * 0.03 + Vector((0, 0, lift))]
            parts.append(tube(f'whisk{sgn}{j}', pts, [0.0055, 0.0045, 0.003], trim, segs=4))
    parts.append(strap('strap', trim))
    return at_zero(join(parts, 'helmet_cat'), R.HEAD)


run_family(ctx, {'helmet_open': helmet_open, 'helmet_full': helmet_full, 'helmet_half': helmet_half,
                 'helmet_cat': helmet_cat}, socket='head')
print('[char_helmets] OK')
