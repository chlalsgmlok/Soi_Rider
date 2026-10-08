"""veh_van — Bangkok commuter van (HiAce-like high-roof 'rot tu'): white one-box shell, dark window band,
sliding door on the kerb (LEFT, +X) side, big black door mirrors, vertical corner tail lamps, yellow public plate.

Run: node blender/run-blender.mjs blender/assets/vehicles_cars/veh_van.py [--no-preview]
Facing -Y, model LEFT = +X. Contract: docs/ASSET_SPEC.md (vehicles). Shell: lib/vehicles_cars_van.py.
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bmesh
from mathutils import Vector
from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import tri_count
from lib.vehicles_cars_mesh import finish, quad, join_objs
from lib.vehicles_cars_body import Surface
from lib.vehicles_cars_parts import wheel, stick, plate, seam, side_seam, top_seam, mirror, patch, face_cast
from lib.vehicles_cars_rig import car_mats, assemble, previews
from lib.vehicles_cars_sedan import Spec
from lib.vehicles_cars_van import van_shell, glaze

ctx = start()
NAME = 'veh_van'
M = car_mats('van_white', 'van_white', plate='plate_yellow', extra=[
    ('card', mat('Sign_Card', 'cream', roughness=0.6)),
])

V = Spec(
    hw=0.95, r=0.37, ar=0.44, sill=0.33, yf=-1.70, yr=1.28, nose=-2.67, tail=2.67,
    upper=[(2.67, 1.12, 0.0), (2.63, 2.25, 0.22), (-1.18, 2.26, 0.5), (-2.07, 1.18, 0.10), (-2.51, 1.02, 0.25),
           (-2.69, 0.70, 0.12)],
    roof_z=2.26, taper_z=1.12, top_scale=0.93, roof_bevel=0.22, mid_bevel=0.10,
    front_round=(0.55, 0.15), rear_round=(0.22, 0.04), split=1.12, win=(1.17, 1.88),
    pillars=[(-1.02, 0.12, 'trim'), (0.18, 0.10, 'trim'), (1.18, 0.10, 'trim'), (1.86, 0.10, 'trim')],
)
WX, TW = 0.82, 0.26

bm = van_shell(M, V)
glaze(bm, M, V)
surf = Surface([bm])
shell = M.obj('body', bm)

d = bmesh.new()
FR, RR = face_cast(surf, 'front'), face_cast(surf, 'rear')
# ---------------------------------------------------------------- front
for s in (1, -1):
    patch(d, M, FR, (s * 0.42, s * 0.89), (0.78, 1.00), 'trim', lift=0.010, nu=5)
    patch(d, M, FR, (s * 0.80, s * 0.92), (0.64, 0.74), 'amber', lift=0.012, nu=2, nv=1)
stick(d, M, surf.front(0, 0.89), (0.78, 0.06, 0.17), 'trim', radius=0.045, out=0.010)
for z in (0.85, 0.90, 0.95):
    stick(d, M, surf.front(0, z), (0.74, 0.03, 0.022), 'chrome', segs=0, out=0.022)
stick(d, M, surf.front(0, 0.90), (0.12, 0.03, 0.08), 'chrome', segs=0, out=0.034, front=(0.8, 0.8))
patch(d, M, FR, (-0.92, 0.92), (0.36, 0.56), 'trim', lift=0.014, nu=6, nv=1)
plate(d, M, surf.front(0, 0.64), out=0.02)
patch(d, M, FR, (-0.75, 0.75), (1.25, 1.93), 'glass', lift=0.006, wall=0.01, nu=1, nv=1)
for x in (0.30, -0.36):
    stick(d, M, surf.top(x, -2.04), (0.56, 0.02, 0.03), 'trim', segs=0, out=0.026)
# route card behind the windscreen (passenger side) — reads as a little white board from the diorama camera
stick(d, M, surf.front(0.44, 1.86), (0.42, 0.01, 0.12), 'card', segs=0, out=0.012)
h = surf.front(0.44, 1.86)
for dx in (-0.12, 0.0, 0.12):
    quad(d, h[0] + Vector((dx, 0, 0.012)), h[1], 0.09, 0.035, M['plate_text'], lift=0.014)
# ---------------------------------------------------------------- sides
for s in (1, -1):
    side_seam(d, M, surf, -2.01, 0.86, 1.10, s, n=3)
    side_seam(d, M, surf, -1.02, 0.36, 1.10, s)
    stick(d, M, surf.side(-1.20, 1.02, s), (0.15, 0.03, 0.045), 'chrome', segs=0, out=0.022)
    stick(d, M, surf.side(-0.21, 0.62, s), (2.08, 0.025, 0.07), 'trim', segs=0, out=0.014)
    stick(d, M, surf.side(2.18, 0.62, s), (0.78, 0.025, 0.07), 'trim', segs=0, out=0.014)
    patch(d, M, face_cast(surf, 'side', s), (-2.43, -2.33), (0.70, 0.76), 'amber', lift=0.01, nu=1, nv=1)
    if s == 1:
        # sliding door outline + rail behind it + handle (kerb side only)
        side_seam(d, M, surf, -0.95, 0.36, 1.10, s)
        side_seam(d, M, surf, 0.16, 0.36, 1.10, s)
        stick(d, M, surf.side(1.24, 1.105, s), (2.08, 0.03, 0.045), 'trim', segs=0, out=0.016)
        stick(d, M, surf.side(0.02, 1.00, s), (0.15, 0.03, 0.045), 'chrome', segs=0, out=0.022)
    else:
        stick(d, M, surf.side(1.62, 0.92, s), (0.16, 0.012, 0.13), 'trim', radius=0.03, out=0.004)
# ---------------------------------------------------------------- roof ribs (catch the light from the high camera)
for y in (-0.55, 0.25, 1.05, 1.85):
    stick(d, M, surf.top(0, y), (1.30, 0.07, 0.025), 'paint2', radius=0.012, segs=1, out=0.018, up=(0, 1, 0))
# ---------------------------------------------------------------- rear
seam(d, M, surf, [((x, 9.0, 2.03), (0, -1, 0)) for x in (-0.80, -0.4, 0.0, 0.4, 0.80)])
for s in (1, -1):
    seam(d, M, surf, [((s * 0.80, 9.0, z), (0, -1, 0)) for z in (0.58, 1.0, 1.5, 2.03)])
    patch(d, M, RR, (s * 0.79, s * 0.915), (0.99, 1.40), 'tail', lift=0.014, nu=2, nv=3)
    patch(d, M, RR, (s * 0.79, s * 0.925), (0.80, 0.99), 'amber', lift=0.014, nu=2, nv=1)
    hh = surf.rear(s * 0.70, 0.47)
    quad(d, hh[0], hh[1], 0.14, 0.04, M['tail'], lift=0.02)
patch(d, M, RR, (-0.93, 0.93), (0.36, 0.56), 'trim', lift=0.014, nu=6, nv=1)
plate(d, M, surf.rear(0, 0.80), out=0.014)
stick(d, M, surf.rear(0, 0.955), (0.52, 0.03, 0.05), 'chrome', segs=0, out=0.014)
stick(d, M, surf.rear(0.12, 1.25), (0.42, 0.02, 0.03), 'trim', segs=0, out=0.02)
stick(d, M, surf.rear(0.42, 1.72), (0.36, 0.01, 0.11), 'card', segs=0, out=0.012)
hr = surf.rear(0.42, 1.72)
for dx in (-0.10, 0.0, 0.10):
    quad(d, hr[0] + Vector((dx, 0, 0.01)), hr[1], 0.075, 0.03, M['plate_text'], lift=0.014)
det = M.obj('details', d)
print(f'[stats] shell={tri_count([shell])} details={tri_count([det])}')

# ---------------------------------------------------------------- light nodes
hl, bl = bmesh.new(), bmesh.new()
for s in (1, -1):
    patch(hl, M, FR, (s * 0.45, s * 0.87), (0.80, 0.98), 'head', lift=0.022, nu=5)
    patch(hl, M, FR, (s * 0.64, s * 0.76), (0.42, 0.49), 'head', lift=0.022, nu=1, nv=1)
    patch(bl, M, RR, (s * 0.80, s * 0.905), (1.10, 1.36), 'brake', lift=0.024, nu=2, nv=2)
stick(bl, M, surf.rear(0, 2.12), (0.44, 0.03, 0.05), 'brake', segs=0, out=0.014)
head = M.obj('head_lights', hl, origin=(0, V.nose + 0.05, 0.9))
brake = M.obj('brake_lights', bl, origin=(0, V.tail - 0.05, 1.2))

mirrors = []
for s, nm in ((1, 'mirror_L'), (-1, 'mirror_R')):
    hinge = surf.side(-1.94, 1.10, s)[0]  # sample below the window band so both sides match, then lift
    hinge.z = 1.22
    mirrors.append(mirror(M, nm, s, hinge, s * 1.24, (-1.96, 1.36), (0.20, 0.12, 0.30), housing='trim',
                          sail=(0.05, 0.16, 0.12)))
wheels = [wheel(M, nm, (s * WX, y, V.r), V.r, TW, s)
          for nm, s, y in (('wheel_FL', 1, V.yf), ('wheel_FR', -1, V.yf), ('wheel_RL', 1, V.yr), ('wheel_RR', -1, V.yr))]

body = join_objs([shell, det], 'body')
for o in [body, head, brake] + mirrors + wheels:
    finish(o)
assemble(ctx, NAME, body, wheels, mirrors + [head, brake], max_tris=int(os.environ.get('MAXTRIS', '3500')))
previews(ctx, NAME)
print('[veh_van] OK')
