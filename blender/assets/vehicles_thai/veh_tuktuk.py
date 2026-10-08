"""veh_tuktuk — HERO Bangkok tuk-tuk (mockup 03 blue tuk-tuk). 3.0 x 1.4 x 1.9 m, faces -Y, <= 3500 tris.

Nodes: veh_tuktuk(root) > body, wheel_F, wheel_RL, wheel_RR, mirror_L, mirror_R (origin = hinge),
       brake_lights (Light_Brake), head_lights (Light_Head).
Materials: Paint (blue body), Paint2 (yellow canopy valance + pinstripes), Canopy, Trim, Chrome, Seat, Glass,
           Tire, Light_Head, Light_Brake, Light_Tail, Plate, Plate_Green, Light_Deco.
"""
import os
import sys
import math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, sphere, empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.preview import render_preview
from lib import vehicles_thai_kit as K

ctx = start()

M = {
    'paint': mat('Paint', 'tuktuk_blue', roughness=0.32),
    'paint2': mat('Paint2', 'taxi_yellow', roughness=0.38),
    'canopy': mat('Canopy', 'canopy_black', roughness=0.62),
    'trim': mat('Trim', 'metal_dark', roughness=0.6),
    # moderate metalness: stays bright silver in renderers without an environment map (three.js sandbox / game)
    'chrome': mat('Chrome', 'chrome', roughness=0.28, metallic=0.5),
    'seat': mat('Seat', 'awning_red', roughness=0.55),
    'glass': mat('Glass', 'glass_light', roughness=0.15, alpha=0.4),
    'mirror': mat('Mirror_Glass', 'glass_light', roughness=0.12, metallic=0.3),
    'tire': mat('Tire', 'tire', roughness=0.85),
    'head': mat('Light_Head', 'light_head', roughness=0.2, emission=2.5),
    'brake': mat('Light_Brake', 'light_tail', roughness=0.25),
    'tail': mat('Light_Tail', 'light_tail', roughness=0.25, emission=0.6),
    'plate': mat('Plate', 'plate_yellow', roughness=0.45),
    'plate_g': mat('Plate_Green', 'sign_green', roughness=0.45),
    'deco': mat('Light_Deco', 'light_amber', roughness=0.25, emission=1.5),
}

AXLE_F = (0.0, -1.10, 0.26)
AXLE_R = 0.88
R_F, R_R = 0.26, 0.30
TRACK = 0.565


def arch_loft(name, cx, cy, cz, radius, width, thick, a0, a1, n, material):
    """Rounded fender: a soft rounded-rect section swept along an arc around an axle (YZ plane)."""
    sec = K.superellipse(width / 2, thick / 2, n=8, p_top=3.0, p_bot=3.0)
    secs = []
    for k in range(n):
        a = math.radians(a0 + (a1 - a0) * k / (n - 1))
        secs.append([(cx + u, cy + (radius + t) * math.cos(a), cz + (radius + t) * math.sin(a)) for u, t in sec])
    return K.loft(name, secs, mats=[material], smooth=70)


def wheels():
    out = {}
    wf = K.toy_wheel('wheel_F', R_F, 0.15, M['tire'], M['chrome'], side=0, segs=12, simple=True)
    wf.location = AXLE_F
    out['wheel_F'] = wf
    for name, side in (('wheel_RL', 1), ('wheel_RR', -1)):
        w = K.toy_wheel(name, R_R, 0.17, M['tire'], M['chrome'], side=side, segs=12, simple=True)
        w.location = (TRACK * side, AXLE_R, R_R)
        out[name] = w
    return out


def chassis():
    parts = [
        box('undertray', (0.86, 1.95, 0.12), (0, 0.48, 0.33), M['trim'], bevel=0.0),
        K.prism('floor_pan', K.fillet([(-0.40, -0.86), (0.40, -0.86), (0.60, -0.32), (0.60, -0.10), (-0.60, -0.10), (-0.60, -0.32)],
                                      [0.08, 0.08, 0.12, 0.0, 0.0, 0.12], n=2),
                0.12, axis='Z', center=0.43, mats=[M['paint']]),
        K.tube('axle_r', [(-0.55, AXLE_R, R_R), (0.55, AXLE_R, R_R)], 0.045, sides=5, mats=[M['trim']], caps=False),
        arch_loft('mudguard_f', 0, AXLE_F[1], AXLE_F[2], 0.31, 0.19, 0.045, 12, 168, 5, M['paint']),
    ]
    for sx in (-1, 1):
        parts.append(K.tube('fork', [(sx * 0.095, AXLE_F[1], AXLE_F[2]), (sx * 0.095, AXLE_F[1] + 0.09, 0.62)],
                            0.028, sides=6, mats=[M['chrome']], caps=False))
        parts.append(arch_loft('fender', sx * TRACK, AXLE_R, R_R, 0.355, 0.24, 0.055, -4, 184, 6, M['paint']))
    for sx in (-1, 1):
        parts.append(K.rpanel('mudflap', 0.22, 0.14, 0.02, 0.03, (sx * TRACK, AXLE_R + 0.345, 0.21), normal=(0, 1, 0),
                              mats=[M['trim']], n=1))
    parts.append(K.tube('exhaust', [(-0.30, 1.10, 0.29), (-0.31, 1.50, 0.31)], 0.035, sides=6, mats=[M['chrome']]))
    return parts


def cowl():
    """Rounded nose over the front wheel (lofted sections) + chrome details."""
    secs = []
    for y, w, z0, z1 in ((-1.555, 0.30, 0.71, 0.90), (-1.53, 0.54, 0.65, 0.96), (-1.46, 0.70, 0.60, 1.00),
                         (-1.25, 0.82, 0.58, 1.035), (-0.82, 0.86, 0.57, 1.02),
                         (-0.76, 0.80, 0.60, 0.98)):
        pts = K.superellipse(w / 2, (z1 - z0) / 2, n=14, p_top=2.8, p_bot=3.4, cy=(z0 + z1) / 2)
        secs.append([(x, y, z) for x, z in pts])
    parts = [K.loft('cowl', secs, mats=[M['paint']], smooth=60)]
    parts.append(K.tube('crest', [(0, -1.555, 0.86), (0, -1.50, 0.97), (0, -1.38, 1.03), (0, -1.10, 1.06)], 0.02, sides=5,
                        mats=[M['chrome']], caps=False))
    smile = [(0.40 * math.sin(math.radians(a)), -1.33 - 0.22 * math.cos(math.radians(a)), 0.62) for a in range(-80, 81, 40)]
    parts.append(K.tube('bumper_f', smile, 0.03, sides=6, mats=[M['chrome']]))
    parts.append(K.rpanel('emblem', 0.11, 0.075, 0.025, 0.035, (0, -1.562, 0.845), normal=(0, -1, 0.35), mats=[M['chrome']],
                          n=2))
    parts.append(K.rpanel('plate_f', 0.24, 0.10, 0.02, 0.02, (0, -1.535, 0.725), normal=(0, -1, -0.15), mats=[M['plate']], n=2))
    parts.append(K.rpanel('dash', 0.78, 0.14, 0.06, 0.05, (0, -0.80, 1.02), normal=(0, 1, 0.6), mats=[M['trim']], n=2))
    parts.append(K.tube('handlebar', [(-0.34, -0.74, 1.08), (-0.22, -0.80, 1.04), (0.22, -0.80, 1.04), (0.34, -0.74, 1.08)],
                        0.018, sides=5, mats=[M['chrome']], caps=False))
    parts.append(K.tube('column', [(0, -0.80, 1.04), (0, -0.92, 0.80)], 0.025, sides=5, mats=[M['chrome']], caps=False))
    for sx in (-1, 1):
        parts.append(K.tube('grip', [(sx * 0.30, -0.76, 1.07), (sx * 0.40, -0.71, 1.10)], 0.027, sides=6, mats=[M['trim']]))
    return parts


def windscreen():
    normal = (0, -1, 0.30)
    centre = (0, -0.85, 1.30)
    glass = K.rpanel('windscreen', 0.80, 0.50, 0.02, 0.07, centre, normal=normal, mats=[M['glass']], n=2)
    # chrome frame = rounded ring band in the glass plane
    B = K.basis(normal)
    ring = K.ring_band('ws_frame', K.rrect(0.88, 0.58, 0.10, n=2), K.rrect(0.79, 0.49, 0.07, n=2), -0.02, 0.02,
                       mats=[M['chrome']])
    ring.data.transform(K.Matrix.Translation(K.Vector(centre)) @ B)
    frame = ring
    wiper = K.tube('wiper', [(-0.05, -0.93, 1.10), (0.22, -0.88, 1.30)], 0.01, sides=4, mats=[M['trim']], caps=False)
    return [glass, frame, wiper]


def tub():
    """Passenger tub: swoopy side panels with wheel arches, rear panel, pinstripes, rear dressing."""
    parts = []
    arch = [(AXLE_R + 0.36 * math.cos(math.radians(a)), R_R + 0.36 * math.sin(math.radians(a)))
            for a in (158, 120, 85, 50, 22)]
    outline = [(-0.30, 0.40)] + arch + [(1.47, 0.40), (1.47, 1.00), (1.18, 1.03), (0.72, 0.88), (0.25, 0.80), (-0.30, 0.78)]
    radii = [0.0] + [0] * len(arch) + [0.0, 0.14, 0.28, 0.32, 0.22, 0.0]
    side = K.fillet(outline, radii, n=2)
    for sx in (-1, 1):
        parts.append(K.prism('side_panel', side, 0.08, axis='X', center=sx * 0.625, mats=[M['paint']], bevel=0.025, segments=1,
                              angle=50))
    rear = K.rrect(1.33, 0.70, 0.13, n=3, cx=0, cy=0.69)
    parts.append(K.prism('rear_panel', rear, 0.10, axis='Y', center=1.43, mats=[M['paint']], bevel=0.03, segments=1))
    top = [(1.47, 0.985), (1.18, 1.015), (0.72, 0.865), (0.25, 0.785), (-0.30, 0.765)]
    for sx in (-1, 1):
        pts = [(sx * 0.668, y, z - 0.075) for y, z in top]
        parts.append(K.tube('pinstripe', pts, 0.016, sides=4, mats=[M['paint2']], caps=False))
    parts.append(K.tube('bumper_r', [(-0.62, 1.40, 0.40), (-0.58, 1.53, 0.40), (0.58, 1.53, 0.40), (0.62, 1.40, 0.40)],
                        0.028, sides=5, mats=[M['chrome']], caps=False))
    parts.append(K.rpanel('plate_r', 0.36, 0.17, 0.02, 0.025, (0, 1.485, 0.66), normal=(0, 1, 0), mats=[M['plate']], n=2))
    parts.append(K.rpanel('plate_th', 0.32, 0.07, 0.02, 0.02, (0, 1.485, 0.49), normal=(0, 1, 0), mats=[M['plate_g']], n=2))
    for sx in (-1, 1):
        # chrome kick plate on the boarding step
        parts.append(K.rpanel('kick_plate', 0.66, 0.15, 0.02, 0.04, (sx * 0.668, 0.08, 0.50), normal=(sx, 0, 0),
                              mats=[M['chrome']], n=2))
    return parts


def seats():
    return [
        box('drv_base', (0.38, 0.32, 0.24), (0, -0.40, 0.55), M['trim'], bevel=0.0),
        K.rpanel('drv_cushion', 0.56, 0.40, 0.12, 0.10, (0, -0.42, 0.72), normal=(0, 0, 1), mats=[M['seat']], n=2,
                 bevel=0.045, segments=1, smooth=50),
        K.rpanel('drv_back', 0.58, 0.30, 0.12, 0.11, (0, -0.21, 0.92), normal=(0, -1, 0.25), mats=[M['seat']], n=2),
        box('bench_base', (0.88, 0.52, 0.20), (0, 0.88, 0.56), M['trim'], bevel=0.0),
        K.rpanel('bench_cushion', 1.18, 0.58, 0.14, 0.10, (0, 0.86, 0.70), normal=(0, 0, 1), mats=[M['seat']], n=2,
                 bevel=0.05, segments=1, smooth=50),
        K.rpanel('bench_back', 1.18, 0.48, 0.12, 0.12, (0, 1.24, 1.02), normal=(0, -1, 0.18), mats=[M['seat']], n=1,
                 bevel=0.045, segments=1, smooth=50),
        K.tube('bench_pipe', [(-0.56, 1.20, 1.20), (0.56, 1.20, 1.20)], 0.018, sides=4, mats=[M['paint2']], caps=False),
    ]


def scallops(x0, x1, z_top, n):
    pts = [(x0, z_top)]
    w = (x1 - x0) / n
    for i in range(n):
        a = x0 + i * w
        pts += [(a + w * 0.25, z_top - 0.07), (a + w * 0.5, z_top - 0.09), (a + w * 0.75, z_top - 0.07), (a + w, z_top - 0.015)]
    pts.append((x1, z_top))
    return pts


# 6 padded cushions across the roof (mockup 03 quilted canopy); the end seams are the canopy's front/rear edges
SEAMS = [-1.05 + 0.425 * i for i in range(7)]
RIM_TOP = 1.752                                   # faces below this on the rim = Paint2 trim stripe


def canopy_section(y, hw, zb, zt):
    """Pillowy roof section: flat underside, rounded rim band, soft crowned top (9 points)."""
    h = zt - zb
    right = [(0.94 * hw, zb), (hw, zb + 0.17 * h), (0.985 * hw, zb + 0.33 * h), (0.80 * hw, zt - 0.07 * h)]
    pts = right + [(0.0, zt)] + [(-x, z) for x, z in reversed(right)]
    return [(x, y, z) for x, z in pts]


def quilted_canopy():
    """Six pillow cushions: each seam is pinched in (3 cm) and down (6 cm) and creased (smooth angle 40), each
    cushion has a flat crown (two rows) so it reads as a soft pillow, not a ridge; rounded nose/tail; the rim
    band all around is the Paint2 trim stripe."""
    rows = [(-1.10, 0.56, 1.735, 1.79)]
    for i, y in enumerate(SEAMS):
        end = i in (0, len(SEAMS) - 1)
        rows.append((y, 0.655 if end else 0.660, 1.695 if end else 1.69, 1.845 if end else 1.840))
        if i < len(SEAMS) - 1:
            for f in (0.30, 0.70):
                rows.append((y + 0.425 * f, 0.692, 1.69, 1.902))     # flat-topped cushion crown
    rows.append((1.55, 0.56, 1.735, 1.79))
    obj = K.loft('canopy', [canopy_section(*r) for r in rows], mats=[M['canopy'], M['paint2']], smooth=40)
    for p in obj.data.polygons:
        p.material_index = 1 if (p.normal.z > -0.9 and p.center.z < RIM_TOP) else 0
    return obj


def canopy_and_frame():
    parts = [quilted_canopy()]
    # scalloped valance: one scallop under each cushion; top edges tucked inside the canopy rim
    side_v = scallops(SEAMS[0] + 0.03, SEAMS[-1] - 0.03, 1.722, 6)
    for sx in (-1, 1):
        parts.append(K.flat_poly('valance_s', side_v, axis='X', center=sx * 0.655, mats=[M['paint2']]))
    end_v = scallops(-0.50, 0.50, 1.728, 3)
    parts.append(K.flat_poly('valance_f', end_v, axis='Y', center=-1.07, mats=[M['paint2']]))
    parts.append(K.flat_poly('valance_r', end_v, axis='Y', center=1.52, mats=[M['paint2']]))
    ch = [M['chrome']]
    for sx in (-1, 1):
        # post tops run up behind the valance into the canopy underside (no tips poking out beside the rim)
        parts.append(K.tube('post_mid', [(sx * 0.64, -0.12, 0.80), (sx * 0.65, -0.14, 1.40), (sx * 0.635, -0.18, 1.74)], 0.024,
                            sides=5, mats=ch, caps=False))
        parts.append(K.tube('post_rear', [(sx * 0.64, 1.42, 1.00), (sx * 0.635, 1.43, 1.74)], 0.024, sides=5, mats=ch, caps=False))
        parts.append(K.tube('post_front', [(sx * 0.44, -0.80, 1.05), (sx * 0.52, -0.92, 1.72)], 0.022, sides=5, mats=ch, caps=False))
        parts.append(K.tube('rail_side', [(sx * 0.655, -0.12, 1.12), (sx * 0.68, 0.10, 1.13), (sx * 0.68, 1.20, 1.13),
                                          (sx * 0.655, 1.42, 1.12)], 0.02, sides=5, mats=ch, caps=False))
    for z in (1.12, 1.32):
        parts.append(K.tube('rail_rear', [(-0.66, 1.43, z), (0.66, 1.43, z)], 0.02, sides=5, mats=ch, caps=False))
    for x in (-0.22, 0.22):
        parts.append(K.tube('rail_v', [(x, 1.43, 1.02), (x, 1.43, 1.32)], 0.016, sides=5, mats=ch, caps=False))
    parts.append(K.tube('grab_bar', [(-0.64, -0.14, 1.28), (0.64, -0.14, 1.28)], 0.02, sides=5, mats=ch, caps=False))
    return parts


def lights():
    head, body = [], []
    for sx in (-1, 1):
        bz, lens = K.ring_lamp('headlamp', 0.10, (sx * 0.19, -1.47, 0.83), (sx * 0.3, -1, 0.1), M['head'], M['chrome'], segs=12,
                        d=0.11)
        head.append(lens)
        body.append(bz)
        # decorative candy lamps on short chrome stalks on the cowl shoulders
        body.append(K.tube('deco_stalk', [(sx * 0.26, -1.31, 0.97), (sx * 0.29, -1.35, 1.09)], 0.013, sides=4,
                           mats=[M['chrome']], caps=False))
        body.append(K.lathe('deco', [(0.0, 0.085), (0.042, 0.072), (0.052, 0.035), (0.035, 0.0)], segs=6,
                            mats=[M['deco']], loc=(sx * 0.29, -1.35, 1.08), normal=(0, -0.25, 1), caps=False))
    brake = []
    for sx in (-1, 1):
        bz, lens = K.ring_lamp('brake', 0.085, (sx * 0.45, 1.47, 0.83), (0, 1, 0), M['brake'], M['chrome'], segs=8, d=0.08)
        brake.append(lens)
        body.append(bz)
        body.append(K.lathe('tail', [(0.0, 0.025), (0.035, 0.02), (0.04, 0.0)], segs=6, mats=[M['tail']], caps=False,
                            loc=(sx * 0.45, 1.48, 0.62), normal=(0, 1, 0)))
    return head, brake, body


def mirrors():
    out = {}
    for name, sx in (('mirror_L', 1), ('mirror_R', -1)):
        hinge = (sx * 0.50, -0.86, 1.30)
        stalk, head = K.mirror_pod(name, hinge, (sx * 0.72, -1.10, 1.30), (0.15, 0.12, 0.06), 0.013,
                                   M['trim'], M['mirror'], stalk_mat=M['chrome'], segs=6)
        obj = join([head, stalk], name)
        set_origin(obj, hinge)
        out[name] = obj
    return out


root = empty('veh_tuktuk')
w = wheels()
head, brake, deco = lights()
mr = mirrors()
groups = {'chassis': chassis(), 'cowl': cowl(), 'screen': windscreen(), 'tub': tub(), 'seats': seats(),
          'canopy': canopy_and_frame(), 'deco': deco, 'head': head, 'brake': brake, 'wheels': list(w.values()),
          'mirrors': list(mr.values())}
K.report(groups)
body = join([o for k in ('chassis', 'cowl', 'screen', 'tub', 'seats', 'canopy', 'deco') for o in groups[k]], 'body')
set_origin(body, (0, 0, 0))
hl = join(head, 'head_lights')
bl = join(brake, 'brake_lights')
K.fit_y([body, hl, bl] + list(w.values()) + list(mr.values()), 3.0, rigid=list(w.values()))
K.bake_location([body, hl, bl])
lo, hi = K.bounds([body, hl, bl] + list(w.values()))
print(f'[bounds] no-mirror size = {hi.x - lo.x:.2f} x {hi.y - lo.y:.2f} x {hi.z - lo.z:.2f}')
for o in [body, hl, bl] + list(w.values()) + list(mr.values()):
    set_parent(o, root)

export_glb(ctx, 'veh_tuktuk', [root], max_tris=3500)
render_preview(ctx, 'veh_tuktuk')
render_preview(ctx, 'veh_tuktuk_rear', view=(-0.9, 1.3, 0.75))
print('[veh_tuktuk] OK')
