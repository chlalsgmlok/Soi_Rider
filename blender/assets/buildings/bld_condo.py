"""bld_condo — 60 m residential background tower (16 x 16): rounded-square plan, glass core (`Window`, lit at night)
wrapped by chunky chamfered balcony bands every 3 m (`Wall`), powder-blue vertical piers (`Wall2`), a two-storey
lobby podium with a canopy, and a crown with lift house, rooftop water tank and a red aviation lamp.
Origin = bottom-centre of the facade line (front band face at y ~ 0.1), facade faces -Y.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bld_condo.py
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import cyl, sphere
from lib.export import export_glb
from lib.buildings_kit import materials, Parts, rbx, rooted, preview_framed, mesh_obj
from lib.buildings_tower import rr_plan, shaft, band, plan_prism
from lib.buildings_parts import water_tank

NAME = 'bld_condo'
CX, CY, HX, R = 0.0, 8.0, 7.35, 1.8
Z_POD, FLOOR, TOP = 6.0, 3.0, 57.0
ctx = start()
M = materials(wall='wall_white', wall2='wall_powder', trim='trim_white')
red = mat('Bld_AviationLamp', 'neon_red', roughness=0.4, emission=2.0)
P = Parts()

# --- white core with solid rounded corners; glass bays (`Window`) on the four faces between corners and piers
P.add(shaft('core', rr_plan(CX, CY, HX, HX, R, 2), Z_POD - 0.2, TOP + 0.2, M['wall'], caps=(False, False)))
e = HX + 0.025
for a, b in ((-HX + R + 0.35, -0.6), (0.6, HX - R - 0.35)):
    for verts in (
        [(a, CY - e, Z_POD), (b, CY - e, Z_POD), (b, CY - e, TOP), (a, CY - e, TOP)],
        [(b, CY + e, Z_POD), (a, CY + e, Z_POD), (a, CY + e, TOP), (b, CY + e, TOP)],
        [(e, CY + a, Z_POD), (e, CY + b, Z_POD), (e, CY + b, TOP), (e, CY + a, TOP)],
        [(-e, CY + b, Z_POD), (-e, CY + a, Z_POD), (-e, CY + a, TOP), (-e, CY + b, TOP)],
    ):
        P.add(mesh_obj('bay_glass', verts, [(0, 1, 2, 3)], [M['window']]))
z = Z_POD
k = 0
while z < TOP - 0.1:
    P.add(band('slab', CX, CY, HX, HX, R, z - 0.22, z + 0.22, M['wall'], out=0.55, ch=0.12, seg=1))
    z += FLOOR
    k += 1
# --- vertical piers on every face (break the stack into bays, read from far away)
for s in (-1, 1):
    P.add(rbx('pier_f', -0.55, 0.55, CY - HX - 0.62, CY - HX + 0.2, Z_POD, TOP + 0.6, M['wall2'], bevel=0.12, open=('+y',))
          if s < 0 else rbx('pier_b', -0.55, 0.55, CY + HX - 0.2, CY + HX + 0.62, Z_POD, TOP + 0.6, M['wall2'], bevel=0.12, open=('-y',)))
    a, b = sorted((s * (HX - 0.2), s * (HX + 0.62)))
    P.add(rbx('pier_s', a, b, CY - 0.55, CY + 0.55, Z_POD, TOP + 0.6, M['wall2'], bevel=0.12,
              open=(('-x',) if s > 0 else ('+x',))))

# --- lobby podium (two storeys) with glass front and a rounded entrance canopy
P.add(plan_prism('podium', rr_plan(CX, CY, 7.9, 7.9, 2.2, 2), 0.0, Z_POD - 0.2, M['wall2'], bevel=0.12))
P.add(rbx('lobby_glass', -5.2, 5.2, 0.0, 0.3, 0.3, 4.3, M['window'], bevel=0.0, open=('+y', '-z')))
for x in (-5.2, -2.6, 0.0, 2.6, 5.2):
    P.add(rbx('lobby_mull', x - 0.12, x + 0.12, -0.05, 0.3, 0.3, 4.3, M['trim'], bevel=0, open=('+y', '-z')))
P.add(plan_prism('canopy', rr_plan(0.0, -1.0, 3.6, 1.4, 1.2, 2), 4.35, 4.75, M['trim'], bevel=0.08))
for x in (-3.0, 3.0):
    P.add(cyl('canopy_post', 0.13, 4.35, (x, -2.0, 2.175), M['metal'], verts=8, bevel=0))
for x in (-1.6, 0.0, 1.6):
    P.add(rbx('canopy_lamp', x - 0.3, x + 0.3, -1.3, -0.7, 4.32, 4.36, M['lamp'], bevel=0, open=('+z',)))
P.add(rbx('lobby_step', -3.8, 3.8, -2.4, 0.0, 0.0, 0.14, M['floor'], bevel=0.04, open=('-z',)))
for x in (-6.3, 6.3):
    P.add(rbx('planter', x - 1.0, x + 1.0, -1.2, -0.1, 0.0, 0.55, M['wall'], bevel=0, open=('-z',)))
    P.add(sphere('shrub', 0.7, (x, -0.65, 0.85), M['leaf'], scale=(1.35, 0.75, 0.75), segments=8, rings=4))

# --- crown: parapet band, lift house, water tank, aviation mast
P.add(band('crown', CX, CY, HX, HX, R, TOP - 0.3, TOP + 1.6, M['wall2'], out=0.6, ch=0.15, seg=2))
P.add(plan_prism('roof', rr_plan(CX, CY, HX + 0.05, HX + 0.05, R, 2), TOP + 0.1, TOP + 0.3, M['roof']))
P.add(plan_prism('lift_house', rr_plan(-2.2, CY + 1.5, 2.4, 2.0, 0.6, 1), TOP + 0.3, TOP + 2.6, M['wall'], bevel=0.1))
water_tank(P, M, 3.2, CY + 1.5, TOP + 0.3, r=1.1, h=1.6)
P.add(cyl('mast', 0.06, 1.6, (-2.2, CY + 1.5, TOP + 3.4), M['metal'], verts=6, bevel=0))
P.add(sphere('aviation', 0.18, (-2.2, CY + 1.5, TOP + 4.25), red, segments=6, rings=3))

body = P.body()
root = rooted(NAME, body)
export_glb(ctx, NAME, [root], max_tris=2500)
preview_framed(ctx, NAME, (-10, -4, 0), (10, 18, 64), view=(0.6, -1.25, 0.5), res=(540, 720))
