"""bld_office — 80 m glass office tower (20 x 20): rounded-square glass shaft (`Window`, lit at night) with thin
spandrel bands every 4 m (`Wall`), white vertical fins (`Trim`), a setback upper shaft, and a crown: stepped
glowing ring (`Lamp_Glow`), open frame crown and a spire. Double-height lobby with a deep entrance canopy.
Origin = bottom-centre of the facade line, facade faces -Y.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bld_office.py
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import cyl, cone, sphere
from lib.export import export_glb
from lib.buildings_kit import materials, Parts, rbx, rooted, preview_framed
from lib.buildings_tower import rr_plan, shaft, band, plan_prism

NAME = 'bld_office'
CX, CY = 0.0, 10.0
H1, R1, Z1 = 9.6, 2.6, 60.0      # main shaft half size, corner radius, top
H2, R2, Z2 = 7.8, 2.2, 70.0      # setback shaft
ctx = start()
M = materials(wall='#E9EEF2', wall2='#4C7DB3', trim='trim_white', window='#4F86C6')
red = mat('Bld_AviationLamp', 'neon_red', roughness=0.4, emission=2.0)
P = Parts()

# --- lobby (z 0..8): recessed glass box behind chunky columns, canopy
P.add(shaft('lobby_glass', rr_plan(CX, CY, H1 - 0.8, H1 - 0.8, R1 - 0.6, 2), 0.0, 8.0, M['window'], caps=(False, False)))
for x in (-6.4, -2.1, 2.1, 6.4):
    P.add(rbx('lobby_col', x - 0.45, x + 0.45, CY - H1, CY - H1 + 0.9, 0.0, 8.2, M['wall'], bevel=0.12, open=('-z', '+z')))
P.add(plan_prism('canopy', rr_plan(0.0, 0.9, 5.2, 1.9, 1.2, 2), 5.4, 5.85, M['wall2'], bevel=0.1))
for x in (-2.4, 0.0, 2.4):
    P.add(rbx('canopy_lamp', x - 0.4, x + 0.4, -0.1, 0.5, 5.36, 5.4, M['lamp'], bevel=0, open=('+z',)))
P.add(rbx('lobby_step', -5.0, 5.0, -1.2, CY - H1 + 1.0, 0.0, 0.16, M['floor'], bevel=0.04, open=('-z',)))

# --- main shaft + spandrels + fins
P.add(shaft('shaft', rr_plan(CX, CY, H1, H1, R1, 2), 8.0, Z1, M['window'], caps=(False, False)))
z = 8.0
while z <= Z1 + 0.01:
    thick = 0.7 if z in (8.0, Z1) else 0.42
    P.add(band('spandrel', CX, CY, H1, H1, R1, z - thick / 2, z + thick / 2, M['wall'], out=0.22, ch=0.08, seg=1))
    z += 4.0
for k in (-1, 0, 1):
    u = k * 4.2
    for fx, fy, op in ((u, CY - H1, '+y'), (u, CY + H1, '-y'), (H1, CY + u, '-x'), (-H1, CY + u, '+x')):
        if op in ('+y', '-y'):
            y0, y1 = (fy - 0.42, fy + 0.05) if op == '+y' else (fy - 0.05, fy + 0.42)
            P.add(rbx('fin', fx - 0.11, fx + 0.11, y0, y1, 8.0, Z1, M['trim'], bevel=0, open=(op, '-z', '+z')))
        else:
            x0, x1 = (fx - 0.05, fx + 0.42) if op == '-x' else (fx - 0.42, fx + 0.05)
            P.add(rbx('fin', x0, x1, fy - 0.11, fy + 0.11, 8.0, Z1, M['trim'], bevel=0, open=(op, '-z', '+z')))

# --- setback shaft with its own bands, terrace deck between
P.add(plan_prism('terrace', rr_plan(CX, CY, H1 + 0.1, H1 + 0.1, R1, 2), Z1 + 0.3, Z1 + 0.45, M['roof']))
P.add(shaft('shaft2', rr_plan(CX, CY, H2, H2, R2, 2), Z1 + 0.3, Z2, M['window'], caps=(False, False)))
for z in (Z1 + 3.4, Z1 + 6.7, Z2):
    P.add(band('spandrel2', CX, CY, H2, H2, R2, z - 0.3, z + 0.3, M['wall'], out=0.22, ch=0.08, seg=1))

# --- crown: navy drum, glowing ring, open frame crown, spire
P.add(band('crown_drum', CX, CY, H2 - 1.0, H2 - 1.0, R2, Z2 + 0.2, Z2 + 2.4, M['wall2'], out=0.4, ch=0.15, seg=2))
P.add(plan_prism('crown_roof', rr_plan(CX, CY, H2 - 0.9, H2 - 0.9, R2, 2), Z2 + 0.2, Z2 + 2.3, M['roof']))
P.add(band('crown_glow', CX, CY, H2 - 1.0, H2 - 1.0, R2, Z2 + 2.4, Z2 + 2.85, M['lamp'], out=0.25, ch=0.08, seg=1))
for a in range(8):
    ang = math.radians(45 * a + 22.5)
    x, y = CX + 5.2 * math.cos(ang), CY + 5.2 * math.sin(ang)
    P.add(cyl('crown_rib', 0.3, 4.4, (x, y, Z2 + 5.0), M['trim'], verts=6, bevel=0))
P.add(cyl('crown_ring', 5.5, 0.6, (CX, CY, Z2 + 7.2), M['wall2'], verts=16, bevel=0.12))
P.add(cone('spire', 0.95, 0.06, 7.6, (CX, CY, Z2 + 2.3 + 3.8), M['chrome'], verts=8))
P.add(cyl('spire_collar', 1.15, 0.35, (CX, CY, Z2 + 2.55), M['wall2'], verts=8, bevel=0.06))
P.add(sphere('aviation', 0.2, (CX, CY, Z2 + 10.0), red, segments=6, rings=3))

body = P.body()
root = rooted(NAME, body)
export_glb(ctx, NAME, [root], max_tris=2500)
preview_framed(ctx, NAME, (-12, -3, 0), (12, 21, 80.5), view=(0.6, -1.25, 0.5), res=(540, 720))
