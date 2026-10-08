"""veh_pickup — Thai double-cab pickup (Hilux/D-Max-like): tall stance, black over-fenders, open bed with
black liner, sport bar, running boards, chrome mirrors and grille bar.

Paint = body, Paint2 = cab roof + pillars (runtime: same colour or black).
Run: node blender/run-blender.mjs blender/assets/vehicles_cars/veh_pickup.py [--no-preview]
Facing -Y, model LEFT = +X. Contract: docs/ASSET_SPEC.md (vehicles).
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bmesh
from lib.bootstrap import start
from lib.shapes import tri_count
from lib.vehicles_cars_mesh import fillet, arch_points, finish, join_objs, quad
from lib.vehicles_cars_body import tub, greenhouse, Surface
from lib.vehicles_cars_parts import wheel, stick, plate, seam, side_seam, top_seam, mirror, patch, face_cast
from lib.vehicles_cars_rig import car_mats, assemble, previews
from lib.vehicles_cars_pickup import carve_bed, arch_flare, sport_bar

ctx = start()
NAME = 'veh_pickup'
M = car_mats('car_white', 'car_white', plate='plate_white')

HW, R, TW, AR, SILL = 0.92, 0.40, 0.30, 0.47, 0.42
YF, YR, NOSE, TAIL = -1.55, 1.52, -2.62, 2.62
BELT, BED_Z, CAB_Y = 1.11, 1.15, 0.94

profile = [(NOSE + 0.15, SILL, 0.06)]
profile += arch_points(YF, R, AR, SILL)
profile += arch_points(YR, R, AR, SILL)
profile += [(TAIL - 0.07, SILL, 0.05), (TAIL, SILL + 0.08, 0.05), (TAIL, BED_Z, 0.05), (CAB_Y, BED_Z, 0.0),
            (-1.20, BELT, 0.0), (-1.90, 1.085, 0.5), (NOSE + 0.14, 1.02, 0.22), (NOSE - 0.01, 0.76, 0.15),
            (NOSE, SILL + 0.08, 0.06)]
tub_bm = tub(M, fillet(profile, 30), HW, bevel=0.11, segs=3, small=0.03, big_z=R + AR + 0.02, plan_reach=0.6,
             plan_inset=0.13, split_z=None, upper='paint', arches=[(YF, R, AR), (YR, R, AR)], sill_z=SILL,
             plan_cuts=(0.35, 1.0), tumble=(0.70, 0.97))
carve_bed(tub_bm, M, CAB_Y + 0.08, TAIL - 0.01, depth=0.22, wall=0.06)

gh_bm = greenhouse(M, fillet([(-1.22, 1.08, 0.0), (-0.50, 1.77, 0.25), (0.84, 1.80, 0.18), (CAB_Y, 1.08, 0.0)], 25),
                   0.86, top_scale=0.84, z_base=1.08, z_glass=1.16, bevel=0.11, segs=3, inset=0.035, depth=0.014,
                   ring='trim', pillars=[(-0.18, 0.12, 'trim')])
surf = Surface([tub_bm, gh_bm])
tub_ob = M.obj('body', tub_bm)
gh_ob = M.obj('greenhouse', gh_bm)

d = bmesh.new()
FR, RR = face_cast(surf, 'front'), face_cast(surf, 'rear')
# ---------------------------------------------------------------- front: big grille, chrome bar, swept lamps, skid plate
stick(d, M, surf.front(0, 0.84), (0.86, 0.07, 0.24), 'trim', radius=0.06, out=0.012, front=(0.92, 1.0))
stick(d, M, surf.front(0, 0.90), (0.84, 0.04, 0.05), 'chrome', segs=0, out=0.03)
stick(d, M, surf.front(0, 0.90), (0.12, 0.03, 0.09), 'chrome', segs=0, out=0.042, front=(0.8, 0.8))
stick(d, M, surf.front(0, 0.79), (0.80, 0.04, 0.03), 'chrome', segs=0, out=0.026)
for s in (1, -1):
    patch(d, M, FR, (s * 0.46, s * 0.86), (0.81, 0.97), 'trim', lift=0.010, nu=5)
patch(d, M, FR, (-0.88, 0.88), (0.44, 0.60), 'trim', lift=0.014, nu=6, nv=1)
stick(d, M, surf.front(0, 0.45), (0.74, 0.10, 0.07), 'chrome', radius=0.02, segs=1, out=0.05)
plate(d, M, surf.front(0, 0.66), out=0.03)
for x in (0.30, -0.34):
    stick(d, M, surf.top(x, -1.15), (0.52, 0.02, 0.03), 'trim', segs=0, out=0.02)
top_seam(d, M, surf, [(-0.62, -2.40), (-0.64, -1.85), (-0.64, -1.30), (0.0, -1.29), (0.64, -1.30), (0.64, -1.85),
                      (0.62, -2.40)], step=0.12)
# ---------------------------------------------------------------- sides
for s in (1, -1):
    SF = face_cast(surf, 'side', s)
    side_seam(d, M, surf, -1.16, 0.80, BELT - 0.02, s, n=3)
    side_seam(d, M, surf, -0.18, 0.47, BELT - 0.02, s)
    side_seam(d, M, surf, 0.90, 0.47, BELT - 0.02, s)
    side_seam(d, M, surf, 0.98, 0.47, BED_Z - 0.03, s)
    for y in (-0.50, 0.52):
        stick(d, M, surf.side(y, 0.98, s), (0.15, 0.03, 0.045), 'chrome', segs=0, out=0.022)
    seam(d, M, surf, [((s * 5, y, 1.175), (-s, 0, 0)) for y in (-1.0, -0.4, 0.2, 0.80)], half_w=0.01, lift=0.006,
         mat='chrome')
    for ya in (YF, YR):
        arch_flare(d, M, surf, ya, R, AR, s, SILL, width=0.10, lift=0.035, n=7)
    # running board between the flares
    stick(d, M, surf.side(-0.015, 0.50, s), (1.80, 0.16, 0.05), 'trim', segs=0, out=0.11)
    patch(d, M, SF, (-2.42, -2.30), (0.83, 0.89), 'amber', lift=0.01, nu=1, nv=1)
# ---------------------------------------------------------------- bed: sport bar, tailgate, tail lamps, step bumper
sport_bar(d, M, CAB_Y + 0.24, BED_Z - 0.02, 1.62, 0.72, mat='trim', brace=0.55)
for s in (1, -1):
    seam(d, M, surf, [((s * 0.77, 9.0, z), (0, -1, 0)) for z in (0.56, 0.8, 1.09)])
    patch(d, M, RR, (s * 0.78, s * 0.875), (0.79, 1.05), 'tail', lift=0.014, nu=2, nv=2)
    patch(d, M, RR, (s * 0.78, s * 0.885), (0.69, 0.79), 'amber', lift=0.014, nu=2, nv=1)
seam(d, M, surf, [((x, 9.0, 0.56), (0, -1, 0)) for x in (-0.77, 0.0, 0.77)])
stick(d, M, surf.rear(0, 1.03), (0.20, 0.03, 0.05), 'trim', segs=0, out=0.014)
plate(d, M, surf.rear(0, 0.74), out=0.014)
stick(d, M, surf.rear(0, 0.46), (1.70, 0.14, 0.10), 'chrome', radius=0.03, segs=1, out=0.07)
for s in (1, -1):
    hh = surf.rear(s * 0.62, 0.46)
    quad(d, hh[0] + (hh[1] * 0.066), hh[1], 0.14, 0.04, M['tail'], lift=0.008)
det_ob = M.obj('details', d)
print(f'[stats] tub={tri_count([tub_ob])} greenhouse={tri_count([gh_ob])} details={tri_count([det_ob])}')

# ---------------------------------------------------------------- light nodes, mirrors, wheels
hl, bl = bmesh.new(), bmesh.new()
for s in (1, -1):
    patch(hl, M, FR, (s * 0.49, s * 0.84), (0.83, 0.95), 'head', lift=0.022, nu=5)
    patch(hl, M, FR, (s * 0.65, s * 0.77), (0.51, 0.57), 'head', lift=0.024, nu=1, nv=1)
    patch(bl, M, RR, (s * 0.79, s * 0.865), (0.88, 1.03), 'brake', lift=0.024, nu=2, nv=1)
stick(bl, M, surf.rear(0, 1.74), (0.36, 0.03, 0.045), 'brake', segs=0, out=0.012)
head = M.obj('head_lights', hl, origin=(0, NOSE + 0.05, 0.89))
brake = M.obj('brake_lights', bl, origin=(0, TAIL - 0.05, 0.95))

mirrors = []
for s, nm in ((1, 'mirror_L'), (-1, 'mirror_R')):
    hinge = surf.side(-1.06, 1.18, s)[0]
    mirrors.append(mirror(M, nm, s, hinge, s * 1.13, (-1.08, 1.24), (0.27, 0.13, 0.20), housing='chrome',
                          glass='trim'))
WX = HW - TW / 2 + 0.03
wheels = [wheel(M, nm, (s * WX, y, R), R, TW, s, hub='chrome')
          for nm, s, y in (('wheel_FL', 1, YF), ('wheel_FR', -1, YF), ('wheel_RL', 1, YR), ('wheel_RR', -1, YR))]

body = join_objs([tub_ob, gh_ob, det_ob], 'body')
for o in [body, head, brake] + mirrors + wheels:
    finish(o)
assemble(ctx, NAME, body, wheels, mirrors + [head, brake], max_tris=int(os.environ.get('MAXTRIS', '3500')))
previews(ctx, NAME, variants=[('black', {'Paint': 'car_black', 'Paint2': 'car_black'})])
print('[veh_pickup] OK')
