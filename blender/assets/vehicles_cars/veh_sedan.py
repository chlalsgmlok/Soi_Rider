"""veh_sedan — private compact sedan (Vios/City-like): smooth fastback cabin, swept headlamps, wide grille.

Paint = body, Paint2 = roof + pillars (runtime sets it to the body colour or black).
Run: node blender/run-blender.mjs blender/assets/vehicles_cars/veh_sedan.py [--no-preview]
Facing -Y, model LEFT = +X. Contract: docs/ASSET_SPEC.md (vehicles). Shared sedan shell: lib/vehicles_cars_sedan.py.
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bmesh
from lib.bootstrap import start
from lib.shapes import tri_count
from lib.vehicles_cars_mesh import finish, join_objs
from lib.vehicles_cars_parts import stick, patch, face_cast
from lib.vehicles_cars_rig import car_mats, assemble, previews
from lib import vehicles_cars_sedan as sedan

ctx = start()
NAME = 'veh_sedan'
M = car_mats('car_silver', 'car_silver', plate='plate_white')

S = sedan.Spec(
    hw=0.875, r=0.35, tw=0.26, wheel_x=0.745, yf=-1.36, yr=1.30, ar=0.42, sill=0.29,
    nose=-2.22, tail=2.22, belt=0.90, belt_rear=0.95, split=None, tub_upper='paint', segs=3,
    deck_z=0.90, deck_y=1.70, cowl_y=-0.95, hood_mid=(-1.50, 0.88), hood_z=0.80,
    tub_bevel=0.14, fillet_step=30, plan_reach=0.85, plan_inset=0.24, tumble=(0.48, 0.95),
    gh_profile=[(-1.10, 0.875, 0.0), (-0.36, 1.38, 0.32), (0.26, 1.44, 0.8), (1.00, 1.36, 0.5), (1.84, 0.875, 0.0)],
    gh_half=0.79, gh_top=0.78, gh_zbase=0.875, gh_zglass=0.94, gh_bevel=0.13, ring='trim',
    pillars=[(0.06, 0.12, 'trim'), (1.00, 0.20, 'paint2')], belt_ys=(-0.80, -0.2, 0.4, 0.95, 1.40),
    door_front_y=-0.89, door_mid_y=0.06, door_rear_y=0.90, handle_ys=(-0.48, 0.56), handle_z=0.76, strip=None,
    mirror=(-0.84, 0.95), mirror_tip=1.01, mirror_size=(0.28, 0.13, 0.18),
    hood_seam=(0.58, -2.08, -1.20), boot_seam=(0.60, 1.86, 2.16), wiper_y=-1.02,
    grille='trapezoid', grille_z=0.615, grille_w=0.70, intake_w=1.06, head=(0.36, 0.80, 0.645, 0.755),
    head_surround='trim', tail_lamp=(0.34, 0.79, 0.67, 0.81), third_brake_z=1.22,
)

tub_bm, gh_bm, surf = sedan.shell(M, S)
tub_ob = M.obj('body', tub_bm)
gh_ob = M.obj('greenhouse', gh_bm)

d = bmesh.new()
sedan.side_details(d, M, surf, S)
sedan.top_details(d, M, surf, S)
sedan.front_details(d, M, surf, S)
sedan.rear_details(d, M, surf, S)
# black side skirts between the arches (lower, toy-chunky stance) + roof aerial
for s in (1, -1):
    patch(d, M, face_cast(surf, 'side', s), (-0.86, 0.84), (0.31, 0.38), 'trim', lift=0.008, nu=3, nv=1)
stick(d, M, surf.top(0.0, 1.12), (0.05, 0.12, 0.05), 'trim', segs=0, out=0.045, front=(0.6, 0.4))
det_ob = M.obj('details', d)
print(f'[stats] tub={tri_count([tub_ob])} greenhouse={tri_count([gh_ob])} details={tri_count([det_ob])}')

head, brake = sedan.lights(M, surf, S)
mirrors = sedan.mirrors(M, surf, S, housing='paint')
wheels = sedan.wheels(M, S)
body = join_objs([tub_ob, gh_ob, det_ob], 'body')
for o in [body, head, brake] + mirrors + wheels:
    finish(o)
assemble(ctx, NAME, body, wheels, mirrors + [head, brake], max_tris=int(os.environ.get('MAXTRIS', '3500')))
previews(ctx, NAME, variants=[('navy', {'Paint': 'car_navy', 'Paint2': 'car_black'})])
print('[veh_sedan] OK')
