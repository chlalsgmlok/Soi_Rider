"""bike_sport - 'Naga 300' naked sport (CB-like), HERO for the POV camera (mockup 02):
big red tank with a white centre stripe + chrome filler cap, exposed engine + radiator, black tube frame,
tubular upright bar on round clamps, top yoke with fork caps + key, LCD on the headlight, round mirrors on
long stems, coral caliper on a front disc, gold rims, black tubular rack over the tail (gear_mount).

Contract: docs/ASSET_SPEC.md (Bikes). L 2.00, bars 0.78, mirror span 0.86, seat 0.82, wheelbase 1.38.
Run: node blender/run-blender.mjs blender/assets/bikes/bike_sport.py [--no-preview] [--fast] [--only=rear,pov]
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
M = P.bike_mats('taxi_red', 'trim_white', rim='temple_gold')

# ------------------------------------------------------------------ key dimensions
R, RI = 0.31, 0.215
AF, AR = V((0, -0.69, R)), V((0, 0.69, R))
RAKE = 25.0
TAN = math.tan(math.radians(RAKE))
D = V((0, math.sin(math.radians(RAKE)), math.cos(math.radians(RAKE))))


def ax(z):
    return -0.65 + (z - R) * TAN


PIVOT = V((0, ax(0.96), 0.96))
EYE = V((0, 0.12, 1.5))
MIR_R = 0.074
MIR_C = 0.43 - MIR_R
frame, steer = [], []


def rows_loft(name, rows, material, n=16, p=2.5, pb=None, fan=(0.02, 0.02), paint=None, phase=0.0):
    rings = [K.sring((0, y, (zb + zt) / 2), hw, (zt - zb) / 2, n=n, p=p, pb=pb, plane='XZ', phase=phase)
             for (y, hw, zb, zt) in rows]
    return K.loft(name, rings, material, fan=fan, paint=paint)


# ------------------------------------------------------------------ FRAME
# fuel tank: chunky, white centre stripe (n=12, phase -15 deg -> face column 3 is centred on the top)
frame.append(rows_loft('tank', [
    (-0.37, 0.10, 0.80, 0.955),
    (-0.30, 0.17, 0.76, 1.0),
    (-0.17, 0.2, 0.745, 1.03),
    (-0.03, 0.185, 0.745, 1.005),
    (0.07, 0.13, 0.765, 0.95),
    (0.115, 0.075, 0.785, 0.9),
], M['paint'], n=12, p=2.4, pb=3.0, fan=(0.015, 0.012), phase=-math.pi / 12,
    paint=[(M['paint2'], lambda s, i: i == 3)]))
frame.append(K.lathe('fuelcap', [(0.036, 0.0), (0.031, 0.015), (0, 0.02)], M['chrome'], seg=8, axis=(0, 0, 1),
                     center=(0, -0.21, 1.014)))
# radiator shrouds (Paint2 side scoops in front of the knees)
for s in (1, -1):
    frame.append(K.slab(f'shroud{s}', [(-0.36, 0.86), (-0.2, 0.8), (-0.14, 0.62), (-0.26, 0.6), (-0.38, 0.74)],
                        s * 0.155, s * 0.19, M['paint2'], axis='X', bevel=0.012, segs=1))

# two-level seat + tail
frame.append(rows_loft('seat', [
    (0.03, 0.09, 0.74, 0.80),
    (0.1, 0.15, 0.745, 0.822),
    (0.36, 0.145, 0.755, 0.828),
    (0.43, 0.115, 0.77, 0.835),
    (0.47, 0.105, 0.8, 0.868),
    (0.7, 0.085, 0.815, 0.872),
], M['seat'], n=8, p=2.1, pb=5.0, fan=(0.01, 0.01), phase=math.pi / 8))
frame.append(rows_loft('tail', [
    (0.3, 0.13, 0.68, 0.77),
    (0.55, 0.115, 0.72, 0.82),
    (0.8, 0.07, 0.785, 0.85),
    (0.875, 0.035, 0.815, 0.845),
], M['paint'], n=10, p=2.6, fan=(0.0, 0.008)))
frame.append(P.lamp('taillight', (0, 0.865, 0.83), 0.09, 0.028, 0.02, M, face=1, lens='brake', bezel_mat='trim',
                    bezel=0.008, n=8))
frame.append(K.block('tailglow', (0.06, 0.005, 0.01), (0, 0.885, 0.83), M['tail']))
# black tubular rack over the tail (gear_mount on top), legs clamp onto the tail sides
RACK_Z = 0.885
frame.append(P.rack('rack', 0.7, 0.925, RACK_Z, 0.22, M, material='trim', r=0.011, bars=0,
                    legs=[((0.105, 0.72, RACK_Z), (0.1, 0.69, 0.8)), ((-0.105, 0.72, RACK_Z), (-0.1, 0.69, 0.8))]))
# tail tidy: plate + indicators on stalks
frame.append(K.slab('tidy', [(0.78, 0.79), (0.93, 0.66), (0.93, 0.6), (0.89, 0.6), (0.76, 0.74)], -0.05, 0.05,
                    M['trim'], axis='X'))
frame.append(P.plate('plate', (0, 0.935, 0.61), 0.16, 0.095, M, tilt_deg=14))
for s in (1, -1):
    frame.append(P.indicator(f'ind_r{s}', (s * 0.11, 0.86, 0.71), 0.02, M, axis=(0, 1, 0), stalk=0.06, side=s))
frame.append(K.fender('hugger', AR, R + 0.03, -40, 10, 3, 0.095, 0.01, M['trim'], n=6))

# black tube frame (twin spars + subframe rails)
for s in (1, -1):
    frame.append(K.tube(f'spar{s}', [(s * 0.05, -0.36, 0.9), (s * 0.13, -0.12, 0.68), (s * 0.125, 0.18, 0.52),
                                     (s * 0.11, 0.34, 0.72), (s * 0.08, 0.74, 0.8)], 0.019, M['trim'], sides=4, cap=False,
                        fillet=0.08, steps=1, twist=math.pi / 4))

# exposed engine: crankcase, forward-inclined cylinder + head, radiator, clutch cover, belly box
frame.append(K.block('crank', (0.24, 0.34, 0.22), (0, 0.02, 0.37), M['engine'], bevel=0.05, segs=1))
crot = (math.radians(-28), 0, 0)
frame.append(K.block('cyl', (0.2, 0.15, 0.2), (0, -0.16, 0.57), M['metal'], rot=crot))
frame.append(K.block('cylhead', (0.21, 0.16, 0.09), (0, -0.235, 0.685), M['engine'], rot=crot, bevel=0.025, segs=1))
frame.append(K.block('radiator', (0.28, 0.045, 0.2), (0, -0.335, 0.6), M['trim'], rot=(math.radians(-20), 0, 0)))
frame.append(K.block('rad_grill', (0.24, 0.01, 0.16), (0, -0.362, 0.594), M['metal'], rot=(math.radians(-20), 0, 0)))
frame.append(K.lathe('clutch', [(0, 0.03), (0.07, 0.03), (0.095, 0.0), (0, 0)], M['metal'], seg=8, axis=(-1, 0, 0),
                     center=(-0.12, 0.0, 0.36)))
frame.append(K.block('belly', (0.15, 0.3, 0.07), (0, -0.04, 0.235), M['trim']))

# exhaust: header down the front of the engine into the belly box, short upswept muffler (right, -X)
frame.append(K.tube('header', [(0, -0.3, 0.56), (-0.035, -0.335, 0.3), (-0.11, 0.06, 0.24), (-0.155, 0.3, 0.285)],
                    0.024, M['metal'], sides=4, fillet=0.07, steps=1, twist=math.pi / 4))
m0, m1 = V((-0.15, 0.28, 0.27)), V((-0.175, 0.62, 0.42))
muf = K.tube('muffler', [m0, m0.lerp(m1, 0.15), m1], lambda t: 0.045 if t < 0.05 else 0.07, M['trim'], sides=8)
K.paint_faces(muf, M['chrome'], lambda c, n: (c - m1).dot((m1 - m0).normalized()) > -0.004)
frame.append(muf)

# swingarm plates, mono shock (coral spring), chain (left)
for s in (1, -1):
    frame.append(K.slab(f'swing{s}', [(0.16, 0.44), (0.7, 0.345), (0.7, 0.275), (0.16, 0.36)], s * 0.095, s * 0.125,
                        M['metal'], axis='X'))
frame.append(P.shock('shock', (0, 0.28, 0.39), (0, 0.13, 0.66), M, r=0.032))
frame.append(K.tube('chain_t', [(0.13, 0.04, 0.43), (0.13, 0.69, 0.41)], 0.008, M['engine'], sides=4, cap=False))
frame.append(K.tube('chain_b', [(0.13, 0.04, 0.33), (0.13, 0.69, 0.22)], 0.008, M['engine'], sides=4, cap=False))

# rider pegs (off the crankcase) + pillion pegs on tube hangers from the subframe
for s in (1, -1):
    frame.append(P.peg(f'peg{s}', (s * 0.18, 0.12, 0.37), 0.1, 0.02, M, s))
    frame.append(K.tube(f'hanger{s}', [(s * 0.1, 0.36, 0.71), (s * 0.135, 0.42, 0.45)], 0.011, M['trim'], sides=4,
                        cap=False))
    frame.append(P.peg(f'ppeg{s}', (s * 0.16, 0.42, 0.44), 0.07, 0.016, M, s))

# ------------------------------------------------------------------ STEER
for s in (1, -1):
    base = AF + V((s * 0.09, 0, 0))
    steer.append(K.tube(f'slider{s}', [base - D * 0.04, base + D * 0.34], 0.034, M['trim'], sides=6))
    steer.append(K.tube(f'stanchion{s}', [base + D * 0.34, base + D * 0.735], 0.026, M['chrome'], sides=6))
    steer.append(K.lathe(f'cap{s}', [(0, 0.0), (0.025, 0.0), (0.021, 0.016), (0, 0.018)], M['chrome'], seg=6,
                         axis=D, center=base + D * 0.735))
# yokes (plates perpendicular to the steering axis) + key
top_c = AF + D * 0.725 + V((0, 0.02, 0))
for nm, c, th in (('topyoke', top_c, 0.024), ('botyoke', AF + D * 0.53 + V((0, 0.02, 0)), 0.03)):
    y = K.slab(nm, K.rrect(0.25, 0.1, 0.045, 1), -th / 2, th / 2, M['metal'] if nm == 'topyoke' else M['trim'],
               axis='Z', smooth=30)
    y.data.transform(K.Matrix.Translation(c) @ K.Euler((-math.radians(RAKE), 0, 0)).to_matrix().to_4x4())
    steer.append(y)
steer.append(K.fender('fender', AF, R + 0.032, -30, 55, 3, 0.08, 0.012, M['paint'], n=8, phase=math.pi / 8,
                      paint=[(M['paint2'], lambda s, i: i == 1)]))
steer.append(K.block('caliper', (0.035, 0.09, 0.07), (0.083, -0.6, 0.45), M['button'], rot=(math.radians(30), 0, 0)))

# round headlight (chrome bezel) + indicators tucked against its sides
HL = V((0, -0.5, 0.92))
steer.append(P.lamp('headlamp', HL, 0.16, 0.16, 0.085, M, face=-1, lens='head', bezel_mat='chrome', bezel=0.014,
                    n=12, p=2.0, bulge=0.02))
for s in (1, -1):
    steer.append(P.indicator(f'ind_f{s}', (s * 0.118, -0.475, 0.9), 0.022, M, axis=(0, -1, 0)))

# upright tubular handlebar on round clamps, grips, switch pods, clutch + brake levers, brake reservoir
GY, GZ = -0.222, 1.066
bar = [(-0.39, -0.218, 1.066), (-0.17, -0.31, 1.024), (0.17, -0.31, 1.024), (0.39, -0.218, 1.066)]
steer.append(K.tube('bar', bar, 0.0155, M['chrome'], sides=6, fillet=0.09, steps=2))
for s in (1, -1):
    steer.append(K.lathe(f'clamp{s}', [(0, -0.022), (0.026, -0.02), (0.026, 0.02), (0, 0.022)], M['metal'], seg=6,
                         axis=(1, 0, 0), center=(s * 0.065, -0.31, 1.022)))
    steer.append(P.grip(f'grip{s}', (s * 0.288, GY - 0.006, GZ - 0.002), (s * 0.385, GY + 0.002, GZ + 0.001), 0.023,
                        M, seg=6))
    steer.append(P.switch_pod(f'sw{s}', (s * 0.262, -0.24, 1.064), M, s, button='button' if s < 0 else 'amber'))
    steer.append(P.lever(f'lever{s}', [(s * 0.265, -0.268, 1.066), (s * 0.31, -0.292, 1.062), (s * 0.4, -0.27, 1.05)],
                         M, material=M['trim']))
steer.append(K.block('reservoir', (0.045, 0.035, 0.03), (-0.2, -0.29, 1.07), M['trim']))
steer.append(K.block('res_win', (0.035, 0.004, 0.018), (-0.2, -0.271, 1.07), M['glass']))

# LCD dash on top of the headlight + round mirrors on long black stems
DASH_C = V((0, -0.415, 1.065))
housing, dash_q = P.dash('dash', DASH_C, 0.165, 0.088, 62, M, bezel=0.013, hood=True, depth=0.04)
steer.append(housing)
mirrors = {}
for s, nm in ((1, 'mirror_L'), (-1, 'mirror_R')):
    base = V((s * 0.235, -0.258, 1.064))
    mirrors[nm] = (P.mirror(nm, base, (s * MIR_C, -0.58, 1.18), MIR_R, M, s, stem_mat=M['trim'],
                            stem_via=[(s * 0.25, -0.3, 1.13)], eye=EYE, stem_r=0.009), base)

# wheels: front with brake disc on the left (spins with wheel_F), rear with sprocket on the left
wf = P.wheel('wheel_F', AF, R, RI, 0.14, M, dish=(False, True))
disc = K.lathe('disc', [(0, 0.056), (0.15, 0.056), (0.15, 0.062), (0, 0.062)], M['metal'], seg=10, axis=(1, 0, 0),
               center=AF)
wf = K.join([wf, disc], 'wheel_F')
wr = P.wheel('wheel_R', AR, R, RI, 0.175, M, dish=(False, True))
spr = K.lathe('sprocket', [(0, 0.09), (0.11, 0.09), (0.11, 0.097), (0, 0.097)], M['metal'], seg=6, axis=(1, 0, 0),
              center=AR)
wr = K.join([wr, spr], 'wheel_R')

K.report(frame + steer + [wf, wr] + [m for m, _ in mirrors.values()] + [dash_q], 'sport ')

root = P.assemble('bike_sport', frame, steer, wf, AF, wr, AR, mirrors['mirror_L'][0], mirrors['mirror_L'][1],
                  mirrors['mirror_R'][0], mirrors['mirror_R'][1], dash_q, DASH_C, PIVOT, RAKE, {
                      'seat_rider': (0, 0.2, 0.925),
                      'seat_pillion': (0, 0.58, 0.97),
                      'foot_L': (0.18, 0.12, 0.392),
                      'foot_R': (-0.18, 0.12, 0.392),
                      'grip_L': (0.335, GY, GZ),
                      'grip_R': (-0.335, GY, GZ),
                      'gear_mount': (0, 0.8125, RACK_Z + 0.011),
                      'headlight': (0, -0.56, 0.92),
                  }, extras={'wheel_radius': R, 'wheelbase': 1.38})

export_glb(ctx, 'bike_sport', [root], max_tris=3000)
P.qa(ctx, 'bike_sport', (0, 0.36, 1.52))
print('[bike_sport] OK')
