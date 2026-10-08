"""bike_cub - 'Wavey 110' step-through underbone (Wave-like): leg shield, front wire basket,
handlebar cowl with headlight + speedo, chain case, chrome rack. Starter bike (taxi pink).

Contract: docs/ASSET_SPEC.md (Bikes). L 1.85, bars 0.66, mirror span 0.76, seat 0.76, wheelbase 1.24.
Run: node blender/run-blender.mjs blender/assets/bikes/bike_cub.py [--no-preview]
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib import bikes_kit as K
from lib import bikes_parts as P
from lib.export import export_glb

V = K.V
ctx = start()
M = P.bike_mats('taxi_pink', 'cream')

# ------------------------------------------------------------------ key dimensions
R, RI, TW = 0.30, 0.19, 0.125
AF, AR = V((0, -0.62, R)), V((0, 0.62, R))
RAKE = 25.0
TAN = math.tan(math.radians(RAKE))
D = V((0, math.sin(math.radians(RAKE)), math.cos(math.radians(RAKE))))   # steering axis, up-back


def ax(z):
    """y of the steering axis at height z (axis passes 3.5 cm behind the front axle)."""
    return -0.585 + (z - R) * TAN


PIVOT = V((0, ax(0.86), 0.86))
EYE = V((0, 0.06, 1.42))
MIR_R = 0.07
MIR_C = 0.38 - MIR_R          # mirror head centre |x| (outer edge = span/2 = 0.38)
frame, steer = [], []


def rows_loft(name, rows, material, n=16, p=2.5, pb=None, fan=(0.02, 0.02), paint=None):
    """Loft along Y from rows (y, hw, z_bottom, z_top)."""
    rings = [K.sring((0, y, (zb + zt) / 2), hw, (zt - zb) / 2, n=n, p=p, pb=pb, plane='XZ')
             for (y, hw, zb, zt) in rows]
    return K.loft(name, rings, material, fan=fan, paint=paint)


# ------------------------------------------------------------------ FRAME
# front cover / leg shield: horizontal rings that follow the rake behind the front wheel;
# rear-facing faces are the cream inner shield
shield_rows = [  # z, cy, hw, front depth, back depth
    (0.31, -0.17, 0.10, 0.04, 0.04),
    (0.38, -0.215, 0.19, 0.07, 0.06),
    (0.55, -0.30, 0.225, 0.10, 0.065),
    (0.74, -0.37, 0.205, 0.12, 0.058),
    (0.86, -0.355, 0.15, 0.10, 0.045),
    (0.93, -0.33, 0.085, 0.06, 0.035),
]
shield = K.loft('shield', [K.sring((0, cy, z), hw, db, df, n=12, p=2.6, plane='XY')
                           for (z, cy, hw, df, db) in shield_rows], M['paint'], fan=(0.012, 0.012))
K.paint_faces(shield, M['paint2'], lambda c, n: n.y > 0.55 and c.z < 0.88)
frame.append(shield)

# underbone floor tunnel
frame.append(rows_loft('tunnel', [(-0.25, 0.06, 0.30, 0.40), (0.0, 0.10, 0.31, 0.52)], M['paint'], n=10, fan=None))

# rear body with a Paint2 waist stripe (face column just below mid-height on both sides)
NB = 14
frame.append(rows_loft('body', [
    (-0.07, 0.075, 0.43, 0.56),
    (0.02, 0.13, 0.38, 0.645),
    (0.2, 0.168, 0.41, 0.69),
    (0.45, 0.168, 0.5, 0.708),
    (0.66, 0.145, 0.605, 0.72),
    (0.83, 0.105, 0.65, 0.735),
    (0.905, 0.06, 0.672, 0.732),
], M['paint'], n=NB, p=2.6, pb=2.2, fan=(0.015, 0.012),
    paint=[(M['paint2'], lambda s, i: 1 <= s <= 4 and i in (NB - 1, NB // 2))]))

# seat (domed top, flat bottom) + pillion strap
frame.append(rows_loft('seat', [
    (-0.075, 0.065, 0.64, 0.71),
    (-0.03, 0.122, 0.64, 0.754),
    (0.2, 0.15, 0.655, 0.77),
    (0.55, 0.146, 0.675, 0.78),
    (0.672, 0.075, 0.69, 0.764),
], M['seat'], n=12, p=2.1, pb=5.0, fan=(0.012, 0.012)))
frame.append(K.loft('strap', [K.sring((0, y, 0.725), 0.155, 0.054, 0.06, n=8, p=2.1, pb=5, plane='XZ')
                              for y in (0.40, 0.425)], M['trim'], smooth=50))

# rear mudguard + tail light + plate + indicators
frame.append(K.fender('mudguard', AR, R + 0.038, -62, -22, 3, 0.072, 0.012, M['trim'], n=6))
frame.append(P.lamp('taillight', (0, 0.9, 0.703), 0.12, 0.046, 0.03, M, face=1, lens='brake', bezel_mat='trim',
                    bezel=0.01, n=8))
frame.append(K.block('tailglow', (0.07, 0.006, 0.013), (0, 0.927, 0.703), M['tail']))
frame.append(K.block('plate_bracket', (0.05, 0.11, 0.03), (0, 0.86, 0.60), M['trim'], rot=(math.radians(-35), 0, 0)))
frame.append(P.plate('plate', (0, 0.905, 0.55), 0.17, 0.10, M))
for s in (1, -1):
    frame.append(P.indicator(f'ind_r{s}', (s * 0.125, 0.865, 0.69), 0.022, M, axis=(0, 1, 0)))

# engine: crankcase, forward horizontal cylinder with fins
frame.append(K.block('crank', (0.22, 0.30, 0.20), (0, 0.04, 0.29), M['engine'], bevel=0.05, segs=1))
cyl_rot = (math.radians(-8), 0, 0)
frame.append(K.block('cyl', (0.13, 0.2, 0.12), (0, -0.185, 0.335), M['metal'], rot=cyl_rot))
for k, y in enumerate((-0.15, -0.205)):
    frame.append(K.block(f'fin{k}', (0.175, 0.014, 0.165), (0, y, 0.333 - (y + 0.17) * 0.14), M['metal'], rot=cyl_rot))
frame.append(K.lathe('cover_l', [(0, 0.028), (0.06, 0.028), (0.085, 0), (0, 0)], M['metal'], seg=8,
                     axis=(1, 0, 0), center=(0.105, 0.07, 0.29)))

# exhaust (right, -X): header, muffler, heat guard
frame.append(K.tube('header', [(-0.02, -0.27, 0.29), (-0.11, -0.2, 0.17), (-0.175, 0.2, 0.235)],
                    0.019, M['chrome'], sides=5, fillet=0.09, steps=1))
m0, m1 = V((-0.175, 0.17, 0.228)), V((-0.19, 0.66, 0.33))
muf = K.tube('muffler', [m0, m0.lerp(m1, 0.1), m1], lambda t: 0.034 if t < 0.05 else 0.056, M['chrome'], sides=8)
K.paint_faces(muf, M['trim'], lambda c, n: (c - m1).dot((m1 - m0).normalized()) > -0.004)
frame.append(muf)
frame.append(K.slab('heatguard', K.rrect(0.30, 0.07, 0.03, 1, 0.43, 0.29), -0.24, -0.229, M['trim'], axis='X'))
K.rot_about(frame[-1], (0, 0.43, 0.29), (math.radians(-12), 0, 0))

# swingarm: chain case (left), arm (right), rear shocks
case = K.arc(0.66, 0.30, 0.058, -90, 90, 2) + K.arc(0.03, 0.315, 0.075, 90, 270, 2)
frame.append(K.slab('chaincase', case, 0.062, 0.10, M['trim'], axis='X', bevel=0.01, segs=1))
frame.append(K.tube('arm_r', [(-0.08, 0.06, 0.31), (-0.08, 0.64, 0.30)], 0.02, M['trim'], sides=4))
for s in (1, -1):
    frame.append(P.shock(f'shock{s}', (s * 0.112, 0.585, 0.33), (s * 0.13, 0.47, 0.635), M, r=0.024))

# pegs (rider + pillion), kickstand
for s in (1, -1):
    frame.append(P.peg(f'peg{s}', (s * 0.205, -0.03, 0.27), 0.11, 0.022, M, s))
    frame.append(P.peg(f'ppeg{s}', (s * 0.17, 0.38, 0.33), 0.07, 0.016, M, s))

# chrome rear rack (doubles as grab rail) -> gear_mount on top
RACK_Z = 0.80
frame.append(P.rack('rack', 0.635, 0.905, RACK_Z, 0.25, M, legs=[((0.12, 0.66, RACK_Z), (0.13, 0.62, 0.69)),
                                                                 ((-0.12, 0.66, RACK_Z), (-0.13, 0.62, 0.69))], bars=0))

# front wire basket (frame-mounted above the front fender)
BX, BY0, BY1, BZ0, BZ1 = 0.15, -0.835, -0.565, 0.685, 0.865
# dark mesh tray (outer wall, rim, inner wall, floor) + chrome rim and wires outside
BYC = (BY0 + BY1) / 2
tray = [K.sring((0, BYC, BZ0), BX - 0.012, (BY1 - BY0) / 2 - 0.012, n=8, p=6, plane='XY', phase=math.pi / 8),
        K.sring((0, BYC, BZ1 - 0.008), BX, (BY1 - BY0) / 2, n=8, p=6, plane='XY', phase=math.pi / 8),
        K.sring((0, BYC, BZ1 - 0.008), BX - 0.008, (BY1 - BY0) / 2 - 0.008, n=8, p=6, plane='XY', phase=math.pi / 8),
        K.sring((0, BYC, BZ0 + 0.012), BX - 0.02, (BY1 - BY0) / 2 - 0.02, n=8, p=6, plane='XY', phase=math.pi / 8)]
bparts = [K.loft('bk_tray', tray, M['trim'], smooth=30)]
bparts.append(K.tube('bk_rim', [(0, BY0, BZ1), (BX, BY0, BZ1), (BX, BY1, BZ1), (-BX, BY1, BZ1), (-BX, BY0, BZ1),
                                (0, BY0, BZ1)], 0.008, M['chrome'], sides=4, fillet=0.03, steps=1, twist=math.pi / 4))
for x in (-0.05, 0.05):
    bparts.append(K.tube('bk_vf', [(x, BY0 - 0.004, BZ0 + 0.01), (x, BY0 - 0.004, BZ1)], 0.0045, M['chrome'], sides=4))
bparts.append(K.tube('bk_mount', [(0, BY1, 0.80), (0, -0.47, 0.80)], 0.012, M['trim'], sides=4))
frame.append(K.join(bparts, 'basket'))

# ------------------------------------------------------------------ STEER (world coords, re-framed later)
for s in (1, -1):
    base = AF + V((s * 0.085, 0, 0))
    steer.append(K.tube(f'slider{s}', [base - D * 0.03, base + D * 0.27], 0.029, M['metal'], sides=6))
    steer.append(K.tube(f'stanchion{s}', [base + D * 0.27, base + D * 0.58], 0.021, M['chrome'], sides=6))
steer.append(K.fender('fender', AF, R + 0.035, -48, 64, 4, 0.072, 0.014, M['paint'], n=8, phase=math.pi / 8,
                      paint=[(M['paint2'], lambda s, i: i == 1)]))

# handlebar cowl: pod lofted along X (front deeper than back), Paint top / Trim belly
CY, CZ = -0.30, 0.965
cowl = K.loft('cowl', [K.sring((x, CY, CZ), (0.12 * k, 0.088 * k), 0.075 * k, 0.058 * k, n=12, p=2.6, pb=2.2,
                                plane='YZ')
                       for x, k in ((-0.207, 0.55), (-0.17, 0.93), (0.0, 1.0), (0.17, 0.93), (0.207, 0.55))],
              M['paint'], fan=(0.006, 0.006))
K.paint_faces(cowl, M['trim'], lambda c, n: n.z < -0.35)
steer.append(cowl)
steer.append(P.lamp('headlamp', (0, -0.414, 0.955), 0.15, 0.062, 0.03, M, face=-1, lens='head', bezel_mat='chrome',
                    bezel=0.011, n=10))
for s in (1, -1):
    steer.append(P.indicator(f'ind_f{s}', (s * 0.172, -0.375, 0.952), 0.022, M, axis=(0, -1, 0)))

# bars, grips, switchgear, front brake lever
GY, GZ = -0.206, 0.988
for s in (1, -1):
    steer.append(K.tube(f'bar{s}', [(s * 0.17, -0.25, 0.972), (s * 0.222, -0.212, 0.984)], 0.0125, M['chrome'],
                        sides=5))
    steer.append(P.grip(f'grip{s}', (s * 0.218, GY - 0.002, GZ - 0.001), (s * 0.318, GY + 0.004, GZ + 0.002), 0.021,
                        M, seg=6))
    steer.append(P.switch_pod(f'sw{s}', (s * 0.197, -0.222, 0.987), M, s, button='button' if s < 0 else 'amber'))
steer.append(P.lever('lever_r', [(-0.205, -0.25, 0.99), (-0.245, -0.272, 0.987), (-0.33, -0.256, 0.976)], M))

# dash (instrument on the cowl's top-back) and mirrors
DASH_C = V((0, -0.262, 1.036))
housing, dash_q = P.dash('dash', DASH_C, 0.15, 0.075, 38, M, bezel=0.012, hood=True)
steer.append(housing)
mirrors = {}
for s, nm in ((1, 'mirror_L'), (-1, 'mirror_R')):
    base = V((s * 0.152, -0.338, 1.022))
    mirrors[nm] = (P.mirror(nm, base, (s * MIR_C, -0.50, 1.12), MIR_R, M, s,
                            stem_via=[(s * 0.17, -0.37, 1.075)], eye=EYE), base)

# wheels
wf = P.wheel('wheel_F', AF, R, RI, TW, M)
wr = P.wheel('wheel_R', AR, R, RI, TW, M)

K.report(frame + steer + [wf, wr] + [m for m, _ in mirrors.values()] + [dash_q], 'cub ')

root = P.assemble('bike_cub', frame, steer, wf, AF, wr, AR, mirrors['mirror_L'][0], mirrors['mirror_L'][1],
                  mirrors['mirror_R'][0], mirrors['mirror_R'][1], dash_q, DASH_C, PIVOT, RAKE, {
                      'seat_rider': (0, 0.10, 0.865),
                      'seat_pillion': (0, 0.47, 0.878),
                      'foot_L': (0.205, -0.03, 0.292),
                      'foot_R': (-0.205, -0.03, 0.292),
                      'grip_L': (0.268, GY, GZ),
                      'grip_R': (-0.268, GY, GZ),
                      'gear_mount': (0, 0.77, RACK_Z + 0.011),
                      'headlight': (0, -0.445, 0.955),
                  }, extras={'wheel_radius': R, 'wheelbase': 1.24})

export_glb(ctx, 'bike_cub', [root], max_tris=3000)
P.qa(ctx, 'bike_cub', (0, 0.30, 1.45))
print('[bike_cub] OK')
