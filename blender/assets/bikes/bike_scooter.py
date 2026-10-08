"""bike_scooter - 'Kitti 125' automatic scooter (Click-like), HERO: the rider's mint scooter from mockup 03.
Chunky front apron with V position lamps, flat floorboard, big two-tone rear body (mint over white),
handlebar cover with headlight + LCD, oval mirrors, CVT case, black rear carrier.

Contract: docs/ASSET_SPEC.md (Bikes). L 1.90, bars 0.70, mirror span 0.80, seat 0.78, wheelbase 1.28.
Run: node blender/run-blender.mjs blender/assets/bikes/bike_scooter.py [--no-preview] [--fast] [--only=rear,pov]
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
M = P.bike_mats('gram_cyan', 'trim_white', rim='metal_dark')

# ------------------------------------------------------------------ key dimensions
R, RI = 0.265, 0.165
AF, AR = V((0, -0.64, R)), V((0, 0.64, R))
RAKE = 26.0
TAN = math.tan(math.radians(RAKE))
D = V((0, math.sin(math.radians(RAKE)), math.cos(math.radians(RAKE))))


def ax(z):
    return -0.605 + (z - R) * TAN


PIVOT = V((0, ax(0.9), 0.9))
EYE = V((0, 0.1, 1.45))
MIR_R, MIR_OVAL = 0.066, 1.3
MIR_C = 0.40 - MIR_R * MIR_OVAL
frame, steer = [], []


def rows_loft(name, rows, material, n=16, p=2.5, pb=None, fan=(0.02, 0.02), paint=None):
    rings = [K.sring((0, y, (zb + zt) / 2), hw, (zt - zb) / 2, n=n, p=p, pb=pb, plane='XZ')
             for (y, hw, zb, zt) in rows]
    return K.loft(name, rings, material, fan=fan, paint=paint)


# ------------------------------------------------------------------ FRAME
# front apron: horizontal rings following the rake; rear-facing faces = white inner shield
apron_rows = [  # z, cy, hw, front depth, back depth
    (0.34, -0.20, 0.13, 0.05, 0.05),
    (0.43, -0.26, 0.205, 0.085, 0.065),
    (0.58, -0.355, 0.24, 0.15, 0.065),
    (0.75, -0.405, 0.225, 0.16, 0.06),
    (0.89, -0.385, 0.175, 0.125, 0.05),
    (0.96, -0.35, 0.10, 0.075, 0.04),
]
apron = K.loft('apron', [K.sring((0, cy, z), hw, db, df, n=14, p=2.7, plane='XY')
                         for (z, cy, hw, df, db) in apron_rows], M['paint'], fan=(0.012, 0.014))
K.paint_faces(apron, M['paint2'], lambda c, n: n.y > 0.5 and c.z < 0.92)
frame.append(apron)
# V position lamps + dark centre garnish with a chrome badge on the apron nose
for s in (1, -1):
    frame.append(K.block(f'vlamp{s}', (0.14, 0.032, 0.036), (s * 0.08, -0.53, 0.70), M['head'],
                         rot=(math.radians(-14), math.radians(s * 26), 0), bevel=0.012, segs=1))
frame.append(K.block('garnish', (0.064, 0.03, 0.17), (0, -0.552, 0.715), M['trim'], rot=(math.radians(-12), 0, 0),
                     bevel=0.012, segs=1))
frame.append(K.lathe('badge', [(0, 0.0), (0.024, 0.0), (0.02, 0.01), (0, 0.012)], M['chrome'], seg=6,
                     axis=(0, -1, 0.3), center=(0, -0.53, 0.83)))

# floorboard: white deck with black rubber mat
floor = rows_loft('floor', [(-0.31, 0.15, 0.2, 0.36), (0.06, 0.17, 0.2, 0.36)], M['paint2'], n=10, p=4, fan=None)
K.paint_faces(floor, M['trim'], lambda c, n: c.z < 0.25)
frame.append(floor)
frame.append(K.slab('mat', K.rrect(0.27, 0.34, 0.03, 1, 0.0, -0.12), 0.355, 0.366, M['trim'], axis='Z'))

# rear body: mint upper, white lower two-tone (face columns below the side apex)
NB = 14
frame.append(rows_loft('body', [
    (0.0, 0.14, 0.30, 0.58),
    (0.15, 0.19, 0.29, 0.665),
    (0.40, 0.205, 0.34, 0.705),
    (0.62, 0.19, 0.48, 0.725),
    (0.80, 0.158, 0.565, 0.74),
    (0.915, 0.105, 0.615, 0.748),
    (0.952, 0.055, 0.64, 0.735),
], M['paint'], n=NB, p=2.8, pb=2.2, fan=(0.012, 0.01),
    paint=[(M['paint2'], lambda s, i: s <= 4 and i in (8, 9, 10, 11, 12))]))

# seat (domed, slight step for the pillion) with a white piping band
frame.append(rows_loft('seat', [
    (-0.045, 0.085, 0.655, 0.725),
    (0.02, 0.142, 0.655, 0.765),
    (0.24, 0.172, 0.665, 0.778),
    (0.50, 0.166, 0.68, 0.79),
    (0.74, 0.14, 0.695, 0.792),
    (0.82, 0.08, 0.705, 0.776),
], M['seat'], n=12, p=2.1, pb=5.0, fan=(0.012, 0.012)))

# tail lamp + side indicators, plate on a black hugger
frame.append(P.lamp('taillight', (0, 0.94, 0.70), 0.17, 0.05, 0.028, M, face=1, lens='brake', bezel_mat='trim',
                    bezel=0.01, n=10))
frame.append(K.block('tailglow', (0.10, 0.006, 0.014), (0, 0.966, 0.70), M['tail']))
for s in (1, -1):
    frame.append(P.indicator(f'ind_r{s}', (s * 0.115, 0.915, 0.665), 0.02, M, axis=(0.3 * s, 1, 0)))
frame.append(K.fender('hugger', AR, R + 0.035, -68, -16, 3, 0.085, 0.012, M['trim'], n=6))
frame.append(K.block('plate_arm', (0.05, 0.08, 0.03), (0, 0.9, 0.56), M['trim'], rot=(math.radians(-50), 0, 0)))
frame.append(P.plate('plate', (0, 0.93, 0.53), 0.17, 0.10, M))

# drivetrain: engine block, CVT case (left), muffler + heat shield (right), arm, single shock
frame.append(K.block('engine', (0.2, 0.26, 0.17), (0, 0.13, 0.22), M['engine'], bevel=0.04, segs=1))
cvt = K.arc(0.64, R, 0.08, -90, 90, 2) + K.arc(0.06, 0.31, 0.12, 90, 270, 3)
frame.append(K.slab('cvt', cvt, 0.085, 0.155, M['engine'], axis='X', bevel=0.016, segs=1))
frame.append(K.lathe('cvt_cap', [(0, 0.012), (0.055, 0.012), (0.07, 0.0), (0, 0)], M['metal'], seg=8, axis=(1, 0, 0),
                     center=(0.155, 0.08, 0.31)))
frame.append(K.tube('header', [(-0.04, 0.0, 0.15), (-0.13, 0.22, 0.18), (-0.17, 0.38, 0.27)], 0.02, M['metal'],
                    sides=5, fillet=0.08, steps=1))
m0, m1 = V((-0.172, 0.35, 0.262)), V((-0.19, 0.84, 0.35))
muf = K.tube('muffler', [m0, m0.lerp(m1, 0.12), m1], lambda t: 0.04 if t < 0.05 else 0.062, M['trim'], sides=8)
frame.append(muf)
frame.append(K.slab('heatshield', K.rrect(0.34, 0.085, 0.035, 1, 0.58, 0.305), -0.254, -0.24, M['chrome'], axis='X'))
K.rot_about(frame[-1], (0, 0.58, 0.305), (math.radians(-10), 0, 0))
frame.append(K.tube('arm_r', [(-0.09, 0.22, 0.22), (-0.09, 0.66, 0.265)], 0.022, M['trim'], sides=4))
frame.append(P.shock('shock', (-0.112, 0.6, 0.33), (-0.135, 0.47, 0.63), M, r=0.026))
for s in (1, -1):
    frame.append(P.peg(f'ppeg{s}', (s * 0.2, 0.36, 0.36), 0.07, 0.016, M, s))

# black rear carrier / grab rail -> gear_mount
RACK_Z = 0.825
frame.append(P.rack('rack', 0.72, 0.945, RACK_Z, 0.27, M, material='trim', r=0.012,
                    legs=[((0.13, 0.74, RACK_Z), (0.15, 0.68, 0.71)), ((-0.13, 0.74, RACK_Z), (-0.15, 0.68, 0.71))],
                    bars=1))

# ------------------------------------------------------------------ STEER
for s in (1, -1):
    base = AF + V((s * 0.092, 0, 0))
    steer.append(K.tube(f'slider{s}', [base - D * 0.03, base + D * 0.26], 0.03, M['metal'], sides=6))
    steer.append(K.tube(f'stanchion{s}', [base + D * 0.26, base + D * 0.48], 0.022, M['chrome'], sides=6))
steer.append(K.fender('fender', AF, R + 0.032, -45, 62, 4, 0.08, 0.016, M['paint'], n=8, phase=math.pi / 8,
                      paint=[(M['paint2'], lambda s, i: i == 1)]))

# handlebar cover: wide sculpted pod, mint top / black belly, headlight in the nose
CY, CZ = -0.29, 0.995
cover = K.loft('cover', [K.sring((x, CY, CZ), (0.13 * k, 0.1 * k), 0.07 * k, 0.065 * k, n=14, p=2.8, pb=2.2,
                                  plane='YZ')
                         for x, k in ((-0.24, 0.55), (-0.2, 0.92), (0.0, 1.0), (0.2, 0.92), (0.24, 0.55))],
                M['paint'], fan=(0.008, 0.008))
K.paint_faces(cover, M['trim'], lambda c, n: n.z < -0.4 or (n.y > 0.6 and c.z < CZ))
steer.append(cover)
steer.append(P.lamp('headlamp', (0, -0.42, 0.985), 0.19, 0.056, 0.03, M, face=-1, lens='head', bezel_mat='trim',
                    bezel=0.012, n=12, p=3.6))
for s in (1, -1):
    steer.append(P.indicator(f'ind_f{s}', (s * 0.205, -0.37, 0.985), 0.022, M, axis=(0.35 * s, -1, 0)))

# bars, grips, switch pods, two brake levers
GY, GZ = -0.205, 1.02
for s in (1, -1):
    steer.append(K.tube(f'bar{s}', [(s * 0.22, -0.235, 1.005), (s * 0.262, -0.21, 1.016)], 0.0125, M['chrome'], sides=5))
    steer.append(P.grip(f'grip{s}', (s * 0.258, GY - 0.002, GZ - 0.001), (s * 0.348, GY + 0.004, GZ + 0.002), 0.022,
                        M, seg=6))
    steer.append(P.switch_pod(f'sw{s}', (s * 0.236, -0.222, 1.018), M, s, button='button' if s < 0 else 'amber'))
    steer.append(P.lever(f'lever{s}', [(s * 0.245, -0.25, 1.022), (s * 0.285, -0.272, 1.019),
                                       (s * 0.36, -0.256, 1.008)], M))

# LCD dash on the cover's top-back + oval mirrors on black stems
DASH_C = V((0, -0.245, 1.07))
housing, dash_q = P.dash('dash', DASH_C, 0.17, 0.085, 40, M, bezel=0.012, hood=True)
steer.append(housing)
mirrors = {}
for s, nm in ((1, 'mirror_L'), (-1, 'mirror_R')):
    base = V((s * 0.17, -0.325, 1.058))
    mirrors[nm] = (P.mirror(nm, base, (s * MIR_C, -0.55, 1.15), MIR_R, M, s, stem_mat=M['trim'],
                            stem_via=[(s * 0.19, -0.36, 1.10)], eye=EYE, oval=MIR_OVAL), base)

wf = P.wheel('wheel_F', AF, R, RI, 0.14, M)
wr = P.wheel('wheel_R', AR, R, RI, 0.155, M)

K.report(frame + steer + [wf, wr] + [m for m, _ in mirrors.values()] + [dash_q], 'scooter ')

root = P.assemble('bike_scooter', frame, steer, wf, AF, wr, AR, mirrors['mirror_L'][0], mirrors['mirror_L'][1],
                  mirrors['mirror_R'][0], mirrors['mirror_R'][1], dash_q, DASH_C, PIVOT, RAKE, {
                      'seat_rider': (0, 0.14, 0.875),
                      'seat_pillion': (0, 0.56, 0.888),
                      'foot_L': (0.11, -0.14, 0.366),
                      'foot_R': (-0.11, -0.14, 0.366),
                      'grip_L': (0.305, GY, GZ),
                      'grip_R': (-0.305, GY, GZ),
                      'gear_mount': (0, 0.835, RACK_Z + 0.012),
                      'headlight': (0, -0.45, 0.985),
                  }, extras={'wheel_radius': R, 'wheelbase': 1.28})

export_glb(ctx, 'bike_scooter', [root], max_tris=3000)
P.qa(ctx, 'bike_scooter', (0, 0.34, 1.47))
print('[bike_scooter] OK')
