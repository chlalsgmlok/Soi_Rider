"""Street-food furniture: prop_stool, prop_table, prop_umbrella (group props_street).

Rebuild: node blender/run-blender.mjs blender/assets/props_street/furniture.py [--no-preview] [--only prop_stool]
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.shapes import box, cyl
from lib.props_street_kit import M, lathe, tube, finish, run_assets, mesh_obj
from lib.props_street_puffy import puffy_canopy, soft_normals

ctx = start()


# ------------------------------------------------------------------------------------------- stool
def arched_skirt(name, material, r_bot, r_top, z_top, legs=4, leg_frac=0.40, z_side=0.10, z_apex=0.25,
                 t=0.016):
    """Flared frustum shell with `legs` arched cut-outs (the Thai plastic stool body), with real thickness."""
    period = 2 * math.pi / legs
    lw = leg_frac * period
    g = period - lw
    zq = z_side + (z_apex - z_side) * 0.9
    cols = []  # (angle, kind, arch_z): kind 'L' leg column (reaches the ground), 'G' gap column
    for s in range(legs):
        a0 = s * period
        cols += [(a0, 'L', z_side), (a0 + lw * 0.5, 'L', z_side), (a0 + lw, 'L', z_side),
                 (a0 + lw + g * 0.25, 'G', zq), (a0 + lw + g * 0.5, 'G', z_apex), (a0 + lw + g * 0.75, 'G', zq)]
    n = len(cols)

    def rz(z, inner):
        return r_bot + (r_top - r_bot) * z / z_top - (t if inner else 0.0)

    verts, faces = [], []
    vid = {}

    def v(i, z, inner):
        key = (i, round(z, 5), inner)
        if key not in vid:
            a = cols[i][0]
            r = rz(z, inner)
            vid[key] = len(verts)
            verts.append((r * math.cos(a), r * math.sin(a), z))
        return vid[key]

    for i in range(n):
        j = (i + 1) % n
        (ai, ki, zi), (aj, kj, zj) = cols[i], cols[j]
        rows = [(0.0, 0.0), (z_side, z_side), (z_top, z_top)] if ki == 'L' and kj == 'L' and (i % 6) < 2 else None
        for inner in (False, True):
            if rows:
                quads = [((rows[0][0], rows[0][1]), (rows[1][0], rows[1][1])), ((rows[1][0], rows[1][1]), (rows[2][0], rows[2][1]))]
                for (lo_i, lo_j), (hi_i, hi_j) in quads:
                    q = (v(i, lo_i, inner), v(j, lo_j, inner), v(j, hi_j, inner), v(i, hi_i, inner))
                    faces.append(tuple(reversed(q)) if inner else q)
            else:
                q = (v(i, zi, inner), v(j, zj, inner), v(j, z_top, inner), v(i, z_top, inner))
                faces.append(tuple(reversed(q)) if inner else q)
        if not rows:
            # underside of the arch (thickness strip), facing down into the opening
            faces.append((v(i, zi, False), v(i, zi, True), v(j, zj, True), v(j, zj, False)))
        if ki == 'L' and kj == 'G':
            # leg end side wall, facing +angle
            faces.append((v(i, 0.0, False), v(i, 0.0, True), v(i, z_side, True), v(i, z_side, False)))
        if ki == 'G' and kj == 'L':
            faces.append((v(j, 0.0, False), v(j, z_side, False), v(j, z_side, True), v(j, 0.0, True)))
    for s in range(legs):
        # foot soles (cheap, keeps the legs solid when seen from a low camera)
        for i in (6 * s, 6 * s + 1):
            j = i + 1
            faces.append((v(i, 0.0, False), v(i, 0.0, True), v(j, 0.0, True), v(j, 0.0, False)))
    return mesh_obj(name, verts, faces, [material], smooth_angle=50)


def build_stool():
    """Thai plastic stool: squat flared body with 4 arched cut-outs (= 4 wide legs) under a rolled-rim seat."""
    plastic = M('Plastic', 'awning_red', roughness=0.38)
    parts = []
    seat = [(0.140, 0.392), (0.162, 0.398), (0.170, 0.412), (0.167, 0.428), (0.152, 0.438),
            (0.105, 0.441), (0.045, 0.435), (0.0, 0.433)]
    parts.append(lathe('seat', seat, plastic, segs=16, cap_bottom=True, smooth_angle=55))
    parts.append(arched_skirt('skirt', plastic, r_bot=0.182, r_top=0.146, z_top=0.396, leg_frac=0.36,
                              z_side=0.09, z_apex=0.27))
    return finish(parts, 'prop_stool')


# ------------------------------------------------------------------------------------------- table
def build_table():
    """Stainless folding table with a condiment caddy (chili / sugar / fish-sauce jars + tissue box)."""
    steel = M('Steel', '#C3CCD6', roughness=0.28)
    trim = M('Trim', 'metal_dark', roughness=0.6)
    red = M('Accent_Red', 'awning_red', roughness=0.4)
    cream = M('Accent_Cream', 'cream', roughness=0.5)
    green = M('Accent_Green', 'banana', roughness=0.4)
    parts = []
    parts.append(box('top', (0.90, 0.62, 0.045), (0, 0, 0.7275), steel, bevel=0.02, segments=2))
    parts.append(box('apron', (0.80, 0.52, 0.07), (0, 0, 0.675), steel, bevel=0.012, segments=1))
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 0.37, sy * 0.23
            parts.append(cyl('leg', 0.022, 0.64, (x, y, 0.35), steel, verts=6, bevel=0))
            parts.append(cyl('foot', 0.03, 0.04, (x, y, 0.02), trim, verts=6, bevel=0))
    for sy in (-1, 1):
        parts.append(cyl('bar', 0.013, 0.74, (0, sy * 0.23, 0.14), steel, rot=(0, math.pi / 2, 0), verts=6, bevel=0))
    # condiment caddy, off-centre like a real table
    cx, cy, z0 = 0.16, 0.08, 0.75
    parts.append(box('tray', (0.25, 0.10, 0.018), (cx, cy, z0 + 0.009), steel, bevel=0.005, segments=1))
    jar = [(0.022, 0.0), (0.028, 0.012), (0.028, 0.066), (0.020, 0.078), (0.021, 0.090), (0.0, 0.092)]
    for i, m in enumerate((red, cream, green)):
        x = cx - 0.065 + i * 0.065
        parts.append(lathe('jar%d' % i, jar, [m, steel], segs=7, band_mat=[0, 0, 0, 1, 1],
                           loc=(x, cy, z0 + 0.018), smooth_angle=50))
    parts.append(box('tissue', (0.15, 0.08, 0.065), (-0.20, -0.10, z0 + 0.0325), red, bevel=0.012, segments=1))
    parts.append(box('tissue_top', (0.11, 0.05, 0.012), (-0.20, -0.10, z0 + 0.066), cream, bevel=0))
    return finish(parts, 'prop_table')


# ------------------------------------------------------------------------------------------- umbrella


def build_umbrella():
    """Big red/cream market umbrella on a concrete-filled tyre base (the Bangkok classic)."""
    canvas = M('Canvas', 'awning_red', double=True, roughness=0.7)
    stripe = M('Canvas_Stripe', 'cream', double=True, roughness=0.7)
    pole_m = M('Accent_Cream', 'cream', roughness=0.5)
    steel = M('Steel', '#C3CCD6', roughness=0.28)
    tire = M('Tire', 'tire', roughness=0.85)
    conc = M('Concrete', 'concrete', roughness=0.9)
    parts = []
    # pillowy toy canopy: 5 radial rings (was 2), every panel inflated along the dome normal, scalloped rim
    can, val, tips = puffy_canopy('canopy', 1.36, 2.70, 2.02, [canvas, stripe], panels=8, sub=4, valance=0.13,
                                  puff=0.13, scallop=0.055, ring_fracs=(0.2, 0.38, 0.55, 0.7, 0.85), dome=2.4)
    parts += [can, val]
    parts.append(lathe('finial', [(0.0, 2.68), (0.045, 2.715), (0.04, 2.77), (0.0, 2.80)], pole_m, segs=8))
    for i, t in enumerate(tips):
        parts.append(tube('rib%d' % i, [(0.0, 0.0, 2.42), (t[0] * 0.5, t[1] * 0.5, 2.36), t], 0.010, steel,
                          segs=3, cap_start=False, cap_end=False))
    parts.append(cyl('pole', 0.03, 2.56, (0, 0, 1.33), pole_m, verts=8, bevel=0))
    parts.append(cyl('runner', 0.046, 0.09, (0, 0, 2.22), steel, verts=8, bevel=0))
    base = [(0.205, 0.005), (0.29, 0.0), (0.335, 0.05), (0.33, 0.085), (0.29, 0.13), (0.205, 0.125),
            (0.195, 0.112), (0.06, 0.122), (0.0, 0.125)]
    parts.append(lathe('base', base, [tire, conc], segs=12, band_mat=[0, 0, 0, 0, 0, 1, 1, 1], smooth_angle=55))
    return soft_normals(finish(parts, 'prop_umbrella'), lambda co: co.z > 1.86)   # smooth fabric shading


run_assets(ctx, [
    ('prop_stool', build_stool, 900),
    ('prop_table', build_table, 900),
    ('prop_umbrella', build_umbrella, 900),
])
print('[furniture] OK')
