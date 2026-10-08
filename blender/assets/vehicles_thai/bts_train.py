"""bts_train — one BTS skytrain car (lead car: driver's nose at -Y, gangway at +Y). 22 x 3.0 x 3.8 m.

Origin = footprint centre at the running surface (z=0) so it sits directly on the bts_deck top. No wheels (bogie
frames only). Budget <= 3500 tris. Nodes: bts_train(root) > body, head_lights (Light_Head), route_board (destination
display quad above the windscreen, Sign_Face, UV 0..1 with u = viewer's right, v = up).
Chain a train by placing cars every 22 m along Y; rotate the last car 180 deg about Z so it shows its nose too.
Materials: Paint (white body), Paint2 (green stripe + doors), Livery_Blue (lower band), Trim, Glass, Roof_Unit,
Light_Head, Light_Tail, Sign_Face.
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.preview import render_preview
from lib import vehicles_thai_kit as K

ctx = start()

M = {
    'paint': mat('Paint', 'car_white', roughness=0.35),
    'paint2': mat('Paint2', 'taxi_green', roughness=0.38),
    'blue': mat('Livery_Blue', 'sign_blue', roughness=0.38),
    'trim': mat('Trim', 'metal_dark', roughness=0.6),
    'glass': mat('Glass', 'glass', roughness=0.12),
    'roof': mat('Roof_Unit', 'van_white', roughness=0.45),
    'skin': mat('Roof_Skin', 'car_silver', roughness=0.5),
    'head': mat('Light_Head', 'light_head', roughness=0.2, emission=2.5),
    'tail': mat('Light_Tail', 'light_tail', roughness=0.25, emission=0.6),
    'sign': mat('Sign_Face', 'cream', roughness=0.5),
}

HL, HW = 10.86, 1.47        # shell half length / half width: anticlimbers, gangway, panes and gutters
                            # stand proud of it, so the whole car fits the 22.0 x 3.0 m contract exactly
ZB, ZR = 0.45, 3.55         # body bottom / roof crown
BLUE0, BLUE1, GRN0, GRN1 = ZB, 0.92, 0.98, 1.10
LEAN = 0.13                 # nose face leans back 10 cm per metre of height
DOORS = (-7.8, -2.6, 2.6, 7.8)


# ---------------------------------------------------------------- shell
def section(y, sx=1.0, lean=0.0):
    poly = [(-HW, ZB), (HW, ZB), (HW, BLUE1), (HW, GRN0), (HW, GRN1), (HW, 2.95), (1.15, ZR), (-1.15, ZR),
            (-HW, 2.95), (-HW, GRN1), (-HW, GRN0), (-HW, BLUE1)]
    radii = [0.12, 0.12, 0, 0, 0, 0.30, 0.55, 0.55, 0.30, 0, 0, 0]
    return [(x * sx, y + (z - ZB) * lean, z) for x, z in K.fillet(poly, radii, n=3)]


def livery(c):
    if c.z > 3.12:
        return 3
    if c.z < BLUE1:
        return 2
    if GRN0 < c.z < GRN1:
        return 1
    return 0


def shell():
    secs = [section(-HL, 0.85, LEAN), section(-HL + 0.08, 0.94, LEAN), section(-HL + 0.26, 0.985, LEAN * 0.5),
            section(-HL + 0.60), section(HL - 0.45), section(HL - 0.18, 0.98), section(HL - 0.06, 0.94),
            section(HL, 0.90)]
    return K.loft('shell', secs, mats=[M['paint'], M['paint2'], M['blue'], M['skin']], smooth=40, mat_fn=livery, cap_mats=(0, 0),
                  bevel=0.10, segments=2, angle=50)


# ---------------------------------------------------------------- sides
def side_dressing():
    parts = []
    for sx in (-1, 1):
        x = sx * (HW + 0.004)
        nrm = (sx, 0, 0)
        # continuous dark window band, panes set into it (two per long bay, one in each end bay)
        parts.append(K.rpanel('window_band', 20.3, 1.06, 0.004, 0.02, (sx * (HW + 0.002), 0.0, 2.06), normal=nrm,
                              mats=[M['trim']], n=1))
        bays = [(-9.35, 1.30, 1), (-5.2, 3.30, 2), (0.0, 3.30, 2), (5.2, 3.30, 2), (9.32, 1.30, 1)]
        for yc, w, n in bays:
            pw = (w - 0.12 * (n - 1)) / n
            for i in range(n):
                y = yc - w / 2 + pw / 2 + i * (pw + 0.12)
                parts.append(K.rpanel('window', pw, 0.92, 0.03, 0.16, (x, y, 2.06), normal=nrm, mats=[M['glass']], n=2))
        # doors: dark frame, two green leaves with tall windows
        for yd in DOORS:
            parts.append(K.rpanel('door_frame', 1.50, 2.02, 0.016, 0.04, (sx * (HW + 0.002), yd, 1.95), normal=nrm,
                                  mats=[M['trim']], n=1))
            for dy in (-0.355, 0.355):
                parts.append(K.rpanel('door_leaf', 0.68, 1.92, 0.03, 0.03, (x, yd + dy, 1.95), normal=nrm,
                                      mats=[M['paint2']], n=1))
                parts.append(K.rpanel('door_glass', 0.40, 0.84, 0.04, 0.08, (sx * (HW + 0.008), yd + dy, 2.18), normal=nrm,
                                      mats=[M['glass']], n=2))
    return parts


# ---------------------------------------------------------------- ends
def nose_y(z, offset=0.0):
    return -HL + (z - ZB) * LEAN - offset


def front():
    nrm = (0, -1, LEAN)
    parts = [
        K.rpanel('mask', 2.30, 1.30, 0.02, 0.22, (0, nose_y(2.30, 0.006), 2.30), normal=nrm, mats=[M['trim']], n=3),
        K.rpanel('windscreen', 2.10, 0.98, 0.03, 0.16, (0, nose_y(2.22, 0.016), 2.22), normal=nrm, mats=[M['glass']], n=3),
        K.rpanel('board_frame', 1.36, 0.30, 0.03, 0.06, (0, nose_y(3.12, 0.01), 3.12), normal=nrm, mats=[M['trim']], n=2),
        K.rpanel('nose_blue', 2.28, 0.36, 0.02, 0.10, (0, nose_y(0.75, 0.005), 0.75), normal=nrm, mats=[M['blue']], n=2),
        K.rpanel('nose_green', 2.30, 0.11, 0.02, 0.05, (0, nose_y(1.04, 0.005), 1.04), normal=nrm, mats=[M['paint2']], n=2),
        K.rpanel('anticlimber', 2.10, 0.24, 0.16, 0.08, (0, nose_y(0.40, 0.03), 0.40), normal=nrm, mats=[M['trim']], n=2,
                 bevel=0.03, segments=1),
        K.tube('wiper', [(0.15, nose_y(1.80, 0.04), 1.80), (0.75, nose_y(2.35, 0.04), 2.35)], 0.018, sides=4,
               mats=[M['trim']]),
    ]
    head = []
    for sx in (-1, 1):
        bz, lens = K.ring_lamp('headlamp', 0.13, (sx * 0.78, nose_y(1.38, -0.01), 1.38), nrm, M['head'], M['trim'], segs=12,
                               d=0.09)
        parts.append(bz)
        head.append(lens)
        parts.append(K.lathe('marker', [(0.0, 0.05), (0.06, 0.04), (0.07, 0.0)], segs=8, mats=[M['tail']],
                             loc=(sx * 1.06, nose_y(1.38, -0.01), 1.38), normal=nrm, caps=False))
    return parts, head


def rear():
    nrm = (0, 1, 0)
    return [
        K.rpanel('gangway', 1.40, 2.30, 0.16, 0.14, (0, HL + 0.02, 2.02), normal=nrm, mats=[M['trim']], n=2,
                 bevel=0.03, segments=1),
        K.rpanel('end_door', 0.80, 1.90, 0.03, 0.06, (0, HL + 0.115, 1.95), normal=nrm, mats=[M['paint2']], n=1),
        K.rpanel('end_glass', 0.46, 0.80, 0.04, 0.08, (0, HL + 0.12, 2.25), normal=nrm, mats=[M['glass']], n=2),
        K.rpanel('anticlimber_r', 2.00, 0.22, 0.14, 0.07, (0, HL + 0.04, 0.40), normal=nrm, mats=[M['trim']], n=2),
    ]


# ---------------------------------------------------------------- roof + underframe
def roof():
    parts = []
    for y in (-5.6, 5.6):
        parts.append(K.rpanel('ac_unit', 2.00, 3.40, 0.30, 0.32, (0, y, ZR + 0.03), normal=(0, 0, 1), mats=[M['roof']], n=3,
                              bevel=0.06, segments=2, smooth=50))
        for dy in (-0.8, 0.8):
            parts.append(K.rpanel('ac_grille', 1.30, 0.90, 0.03, 0.14, (0, y + dy, ZR + 0.19), normal=(0, 0, 1),
                                  mats=[M['trim']], n=2))
    for sx in (-1, 1):
        parts.append(K.tube('gutter', [(sx * (HW - 0.03), -HL + 0.9, 2.99), (sx * (HW - 0.03), HL - 0.5, 2.99)], 0.03, sides=4,
                            mats=[M['paint']], caps=True))
    return parts


def underframe():
    parts = [box('skirt', (2.50, 2 * HL - 1.2, 0.30), (0, 0.2, ZB - 0.12), M['trim'], bevel=0.0)]
    for y in (-7.4, 7.4):
        parts.append(box('bogie', (2.60, 2.60, 0.34), (0, y, 0.17), M['trim'], bevel=0.05, segments=1))
        for sx in (-1, 1):
            for dy in (-0.75, 0.75):
                parts.append(K.lathe('axlebox', [(0.0, 0.07), (0.16, 0.06), (0.2, 0.0)], segs=10, mats=[M['trim']],
                                     loc=(sx * 1.30, y + dy, 0.26), normal=(sx, 0, 0), caps=False))
    return parts


root = empty('bts_train')
fr, head = front()
groups = {'shell': [shell()], 'sides': side_dressing(), 'front': fr, 'rear': rear(), 'roof': roof(),
          'under': underframe(), 'head': head}
board = K.quad('route_board', 1.24, 0.20, (0, nose_y(3.12, 0.03), 3.12), normal=(0, -1, LEAN), mats=[M['sign']])
K.report(groups)
body = join([o for k in ('shell', 'sides', 'front', 'rear', 'roof', 'under') for o in groups[k]], 'body')
set_origin(body, (0, 0, 0))
hl = join(head, 'head_lights')
lo, hi = K.bounds([body, hl, board])
print(f'[bounds] size = {hi.x - lo.x:.2f} x {hi.y - lo.y:.2f} x {hi.z - lo.z:.2f}  y {lo.y:.2f}..{hi.y:.2f}')
for o in (body, hl, board):
    set_parent(o, root)

export_glb(ctx, 'bts_train', [root], max_tris=3500)
render_preview(ctx, 'bts_train', view=(1.0, -1.1, 0.75))
render_preview(ctx, 'bts_train_rear', view=(-1.0, 0.9, 0.8))
print('[bts_train] OK')
