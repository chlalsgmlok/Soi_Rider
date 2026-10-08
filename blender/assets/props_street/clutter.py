"""Street clutter: prop_crates, prop_ice_box, prop_ac_unit, prop_bin, prop_cone (group props_street).

Origin = ground at the footprint centre; fronts face -Y. `Plastic` is the runtime-recolourable body colour
(crates / ice box / bin / cone); every other material is a fixed accent colour.

Rebuild: node blender/run-blender.mjs blender/assets/props_street/clutter.py [--no-preview] [--only prop_cone]
"""
import math
import os
import sys
import bpy
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.shapes import box, cyl, join, set_origin
from lib.props_street_kit import M, lathe, tube, finish, run_assets, blob, taper
from lib.props_street_parts import rbox, tyre, ring, ball

ctx = start()


def trim_m():
    return M('Trim', 'metal_dark', roughness=0.6)


# ------------------------------------------------------------------------------------------- crates
def crate(tag, shell_m, hole_m, W=0.50, D=0.36, H=0.28):
    """One bottle crate (joined): rounded shell, rolled rim, dark side windows + hand grips, dark open top."""
    p = [rbox(tag + 'shell', (W, D, H - 0.03), (0, 0, (H - 0.03) / 2), shell_m, bevel=0.03),
         rbox(tag + 'rim', (W + 0.024, D + 0.024, 0.045), (0, 0, H - 0.0225), shell_m, bevel=0.016),
         box(tag + 'inner', (W - 0.07, D - 0.07, 0.012), (0, 0, H - 0.002), hole_m, bevel=0)]
    for sy in (-1, 1):
        for sx in (-1, 1):
            p.append(box(tag + 'win', (0.17, 0.012, 0.10), (sx * 0.115, sy * (D / 2 + 0.001), 0.125), hole_m, bevel=0))
    for sx in (-1, 1):
        p.append(box(tag + 'grip', (0.012, 0.15, 0.045), (sx * (W / 2 + 0.001), 0, H - 0.075), hole_m, bevel=0))
    # join() keeps the shell's origin (its centre, z=0.125): reset to the crate's ground centre before placing
    return set_origin(join(p, tag + 'crate'), (0, 0, 0))


def build_crates():
    """Three soda crates: two stacked (Plastic, top one full of bottles) + a yellow one of green coconuts."""
    plastic = M('Plastic', 'awning_blue', roughness=0.4)
    yellow = M('Crate_Yellow', 'taxi_yellow', roughness=0.4)
    hole = M('Crate_Hole', '#1E2A3A', roughness=0.8)
    bottle = M('Bottle', 'sign_green', roughness=0.15)
    cap = M('Bottle_Cap', 'awning_red', roughness=0.35)
    coco = M('Coconut', '#A9C23F', roughness=0.5)
    H = 0.28
    a = crate('A', plastic, hole)
    a.location = (-0.27, 0.02, 0.0)
    b = crate('B', plastic, hole)
    b.location, b.rotation_euler = (-0.25, -0.01, H), (0, 0, 0.09)
    c = crate('C', yellow, hole)
    c.location, c.rotation_euler = (0.29, -0.03, 0.0), (0, 0, -0.14)
    parts = [a, b, c]
    neck = [(0.021, 0.0), (0.021, 0.065), (0.0, 0.068)]
    for ix in range(4):
        for iy in range(3):
            x, y = -0.165 + ix * 0.11, -0.10 + iy * 0.10
            bo = lathe('bottle', neck, [bottle, cap], segs=5, band_mat=[0, 1], smooth_angle=50)
            bo.location = (x, y, H - 0.02)
            bo.parent = b
            parts.append(bo)
    for i, (x, y, s) in enumerate(((-0.11, -0.07, 1.0), (0.11, -0.06, 0.95), (-0.10, 0.08, 0.92), (0.11, 0.08, 1.0))):
        cn = ball('coco', 0.105 * s, (x, y, H + 0.02), coco, segs=7, scale=(1, 1, 0.9))
        cn.parent = c
        parts.append(cn)
    bpy.context.view_layer.update()
    for o in parts:
        if o.parent is not None:
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    return finish(parts, 'prop_crates')


# ------------------------------------------------------------------------------------------- ice box
def build_ice_box():
    """Chunky vendor cooler: Plastic body, cream lid with raised panel, latch, side grips, label, steel scoop."""
    body_m = M('Plastic', 'awning_blue', roughness=0.4)
    lid_m = M('Accent_Cream', 'cream', roughness=0.45)
    red = M('Accent_Red', 'awning_red', roughness=0.4)
    steel = M('Steel', '#C3CCD6', roughness=0.28)
    trim = trim_m()
    W, D = 0.74, 0.46
    p = [rbox('foot', (W - 0.08, D - 0.08, 0.05), (0, 0, 0.025), trim, bevel=0.02),
         rbox('body', (W, D, 0.39), (0, 0, 0.035 + 0.195), body_m, bevel=0.065),
         rbox('lid', (W + 0.03, D + 0.03, 0.075), (0, 0, 0.4475), lid_m, bevel=0.032),
         rbox('lid_top', (W - 0.17, D - 0.15, 0.04), (0, 0.01, 0.49), lid_m, bevel=0.018),
         rbox('latch', (0.11, 0.03, 0.085), (0, -D / 2 - 0.006, 0.39), trim, bevel=0.012),
         rbox('label', (0.32, 0.014, 0.14), (-0.06, -D / 2 - 0.001, 0.22), lid_m, bevel=0.006),
         box('label_band', (0.28, 0.01, 0.036), (-0.06, -D / 2 - 0.008, 0.235), red, bevel=0),
         box('label_dot', (0.05, 0.01, 0.022), (-0.06, -D / 2 - 0.008, 0.185), body_m, bevel=0),
         cyl('drain', 0.026, 0.045, (0.27, -D / 2 - 0.006, 0.085), trim, rot=(math.pi / 2, 0, 0), verts=8, bevel=0)]
    for sx in (-1, 1):
        p.append(rbox('grip', (0.04, 0.22, 0.05), (sx * (W / 2 + 0.008), 0, 0.33), trim, bevel=0.014))
    # steel ice scoop lying on the lid (bowl + handle)
    p.append(cyl('scoop', 0.05, 0.12, (0.16, -0.02, 0.555), steel, rot=(0, math.pi / 2, 0.35), verts=8, bevel=0))
    p.append(tube('scoop_handle', [(0.10, -0.04, 0.545), (-0.03, -0.085, 0.53)], 0.014, red, segs=5))
    return finish(p, 'prop_ice_box')


# ------------------------------------------------------------------------------------------- AC unit
def build_ac_unit():
    """Outdoor AC condenser on wall brackets: big round fan grille, valve cover, side vents, insulated pipes.

    Back (+Y) goes against the wall; fan on the viewer's left (model right, -X); pipes leave from the +X side
    and climb the wall toward the indoor unit.
    """
    body_m = M('AC_Body', 'van_white', roughness=0.45)
    grille = M('Grille', 'steel', roughness=0.4, metallic=0.2)
    pipe_m = M('Pipe', 'cream', roughness=0.6)
    badge = M('Badge', 'sign_blue', roughness=0.35)
    trim = trim_m()
    W, D, H, z0 = 0.80, 0.30, 0.54, 0.06
    zc = z0 + H / 2
    fy = -D / 2
    p = [rbox('body', (W, D, H), (0, 0, zc), body_m, bevel=0.04),
         rbox('cap', (W + 0.025, D + 0.025, 0.03), (0, 0, z0 + H + 0.008), body_m, bevel=0.012)]
    for sx in (-1, 1):
        p.append(rbox('arm', (0.045, D + 0.05, 0.045), (sx * 0.27, 0.02, 0.0225), trim, bevel=0.01))
        p.append(rbox('plate', (0.06, 0.025, 0.30), (sx * 0.27, D / 2 + 0.035, 0.15), trim, bevel=0.008))
    # fan: dark well, bezel ring, blades, hub, grille bars
    fx = -0.11
    p.append(cyl('well', 0.205, 0.02, (fx, fy - 0.002, zc), trim, rot=(math.pi / 2, 0, 0), verts=16, bevel=0))
    p.append(ring('bezel', 0.195, 0.24, 0.016, (fx, fy - 0.004, zc), grille, rot=(math.pi / 2, 0, 0), segs=16))
    for i in range(3):
        p.append(box('blade', (0.07, 0.008, 0.17), (fx, fy - 0.014, zc), grille, bevel=0,
                     rot=(0, i * 2 * math.pi / 3 + 0.3, 0)))
    p.append(cyl('hub', 0.045, 0.03, (fx, fy - 0.02, zc), grille, rot=(math.pi / 2, 0, 0), verts=8, bevel=0))
    for dz in (-0.12, 0.0, 0.12):
        half = math.sqrt(max(0.0, 0.2 ** 2 - dz ** 2))
        p.append(box('bar', (2 * half, 0.01, 0.012), (fx, fy - 0.026, zc + dz), grille, bevel=0))
    p.append(box('bar_v', (0.012, 0.01, 0.40), (fx, fy - 0.027, zc), grille, bevel=0))
    # valve cover + badge on the right of the face
    p.append(rbox('cover', (0.20, 0.03, 0.30), (0.27, fy - 0.004, zc - 0.07), body_m, bevel=0.012))
    p.append(rbox('badge', (0.12, 0.012, 0.04), (0.27, fy - 0.006, z0 + H - 0.07), badge, bevel=0.005))
    # side vents on the +X flank
    for i in range(4):
        p.append(box('vent', (0.012, D - 0.1, 0.022), (W / 2 + 0.003, 0.0, z0 + 0.17 + i * 0.075), trim, bevel=0))
    # insulated pipes + drain hose
    x1 = W / 2 + 0.07
    for dx, r in ((0.0, 0.026), (0.065, 0.02)):
        p.append(tube('pipe', [(W / 2 - 0.05, 0.03 + dx * 0.4, z0 + 0.08), (x1 + dx * 0.4, 0.03 + dx * 0.4, z0 + 0.08),
                               (x1 + dx * 0.4 + 0.02, 0.10, z0 + 0.20), (x1 + dx * 0.4 + 0.02, 0.12, 0.86),
                               (x1 + dx * 0.4 + 0.02, 0.17, 0.93), (x1 + dx * 0.4 + 0.02, 0.21, 0.93)],
                      r, pipe_m, segs=6, cap_start=False))
    p.append(tube('drain', [(W / 2 - 0.12, 0.0, z0 + 0.01), (W / 2 - 0.1, -0.02, z0 - 0.03),
                            (W / 2 - 0.04, -0.06, 0.012)], 0.012, trim, segs=4))
    return finish(p, 'prop_ac_unit')


# ------------------------------------------------------------------------------------------- bin
def build_bin():
    """Bangkok wheelie bin: tapered Plastic body, yellow domed lid with front grip, back wheels + handle,
    cream recycling sticker."""
    body_m = M('Plastic', 'awning_green', roughness=0.42)
    lid_m = M('Bin_Lid', 'lane_yellow', roughness=0.4)
    cream = M('Accent_Cream', 'cream', roughness=0.5)
    tire = M('Tire', 'tire', roughness=0.85)
    trim = trim_m()
    zb, zt = 0.07, 0.88
    body = rbox('body', (0.47, 0.55, zt - zb), (0, 0, (zb + zt) / 2), body_m, bevel=0.055)
    taper(body, 1.17)
    p = [body,
         rbox('rim', (0.60, 0.69, 0.06), (0, 0, zt - 0.005), body_m, bevel=0.022),
         rbox('lid', (0.63, 0.73, 0.05), (0, -0.005, zt + 0.045), lid_m, bevel=0.022),
         rbox('dome', (0.50, 0.56, 0.04), (0, 0.01, zt + 0.08), lid_m, bevel=0.018),
         rbox('lid_grip', (0.24, 0.045, 0.035), (0, -0.37, zt + 0.035), lid_m, bevel=0.012),
         cyl('hinge', 0.026, 0.52, (0, 0.36, zt + 0.02), body_m, rot=(0, math.pi / 2, 0), verts=8, bevel=0),
         tube('handle', [(-0.22, 0.34, zt - 0.06), (-0.22, 0.42, zt - 0.03), (0.22, 0.42, zt - 0.03),
                         (0.22, 0.34, zt - 0.06)], 0.02, body_m, segs=5),
         cyl('axle', 0.02, 0.58, (0, 0.27, 0.1), trim, rot=(0, math.pi / 2, 0), verts=6, bevel=0),
         rbox('feet', (0.30, 0.07, 0.075), (0, -0.21, 0.0375), trim, bevel=0.015)]
    for sx in (-1, 1):
        p.append(tyre('wheel', 0.10, 0.065, (sx * 0.285, 0.27, 0.10), tire, trim, axis='x', segs=8, simple=True))
    # sticker follows the tapered front face
    t = (0.52 - zb) / (zt - zb)
    half_d = 0.275 * (1 + 0.17 * t)
    tilt = math.atan(0.275 * 0.17 / (zt - zb))
    p.append(rbox('sticker', (0.26, 0.012, 0.22), (0, -half_d - 0.004, 0.52), cream, bevel=0.006, rot=(tilt, 0, 0)))
    for i in range(3):
        a = i * 2 * math.pi / 3
        p.append(box('arrow', (0.11, 0.01, 0.024), (0.045 * math.sin(a), -half_d - 0.012, 0.515 + 0.045 * math.cos(a)),
                     body_m, bevel=0, rot=(0, a, 0)))
    return finish(p, 'prop_bin')


# ------------------------------------------------------------------------------------------- cone
def build_cone():
    """Chunky traffic cone: dark rounded base, fat orange Plastic cone with two raised reflective bands."""
    plastic = M('Plastic', 'taxi_orange', roughness=0.4)
    white = M('Stripe_White', 'curb_white', roughness=0.3)
    trim = trim_m()

    def r_at(z):
        return 0.150 - 0.114 * (z - 0.07) / 0.60

    prof = [(0.172, 0.045), (0.156, 0.07)]
    bands = [0, 0]
    for z0, z1 in ((0.25, 0.35), (0.45, 0.53)):
        prof += [(r_at(z0), z0), (r_at(z0) + 0.009, z0 + 0.006), (r_at(z1) + 0.009, z1 - 0.006), (r_at(z1), z1)]
        bands += [1, 1, 1, 0]
    prof += [(r_at(0.64), 0.64), (0.032, 0.69), (0.016, 0.708), (0.0, 0.712)]
    bands += [0, 0, 0]
    p = [lathe('body', prof, [plastic, white], segs=12, band_mat=bands, smooth_angle=50),
         rbox('base', (0.42, 0.42, 0.05), (0, 0, 0.025), trim, bevel=0.02)]
    return finish(p, 'prop_cone')


run_assets(ctx, [
    ('prop_crates', build_crates, 900),
    ('prop_ice_box', build_ice_box, 900),
    ('prop_ac_unit', build_ac_unit, 900),
    ('prop_bin', build_bin, 900),
    ('prop_cone', build_cone, 900),
], preview_views={'prop_ac_unit': {'view': (0.7, -1.4, 0.6)}})
print('[clutter] OK')
