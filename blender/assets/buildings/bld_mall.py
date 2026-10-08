"""bld_mall — Siam-style podium mall (32 x 30, H 18): glowing glass ground floor behind a chunky colonnade, two
ribbon-glass upper floors between fat rounded bands (`Wall` / `Wall2` / `Trim`), a big framed LED billboard (`screen`
node: flat quad, Sign_Face, UV 0..1, 10 x 5.5 m centred x=+6, z=12.5 — viewer's right), a rounded entrance canopy with
downlights, a neon logo roundel on the crown, glass skylight dome + AC plant on the roof, plaza planters.
Origin = bottom-centre of the facade line, facade faces -Y.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bld_mall.py
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import cyl, sphere, torus
from lib.export import export_glb
from lib.buildings_kit import materials, Parts, rbx, mesh_obj, quad_uv, rooted, preview_framed
from lib.buildings_tower import rr_plan, shaft, band, plan_prism

NAME = 'bld_mall'
HX, HY, CY = 16.0, 15.0, 15.0
Z1, Z2, Z3, H = 5.6, 10.9, 16.2, 18.0
ctx = start()
M = materials(wall='wall_cream', wall2='wall_white', trim='trim_white', window='#5E9BD0')
accent = mat('Bld_Accent', 'pin_coral', roughness=0.5)
neon = mat('Bld_Neon', 'neon_pink', roughness=0.4, emission=1.4)
P = Parts()

# --- masses: recessed glass ground floor, upper podium block, floor bands, crown
P.add(shaft('gf_glass', rr_plan(0.0, CY + 0.6, HX - 0.9, HY - 0.6, 2.0, 2), 0.0, Z1, M['window'], caps=(False, False)))
P.add(plan_prism('podium', rr_plan(0.0, CY, HX - 0.35, HY - 0.35, 2.6, 2), Z1, Z3, M['wall'], bevel=0.0))
P.add(band('band1', 0.0, CY, HX - 0.35, HY - 0.35, 2.6, Z1 - 0.15, Z1 + 0.75, M['wall2'], out=0.35, ch=0.14, seg=2))
P.add(band('band2', 0.0, CY, HX - 0.35, HY - 0.35, 2.6, Z2 - 0.3, Z2 + 0.3, M['wall2'], out=0.3, ch=0.12, seg=2))
P.add(band('crown', 0.0, CY, HX - 0.35, HY - 0.35, 2.6, Z3 - 0.1, H, M['wall2'], out=0.35, ch=0.2, seg=2))
P.add(plan_prism('roof', rr_plan(0.0, CY, HX - 0.4, HY - 0.4, 2.6, 2), Z3 + 0.5, Z3 + 0.7, M['roof']))

# --- ribbon glass on the front and both sides (quads just proud of the podium), mullion fins on the front
yf = CY - HY + 0.33
for z0, z1 in ((Z1 + 0.85, Z2 - 0.4), (Z2 + 0.4, Z3 - 0.25)):
    P.add(mesh_obj('ribbon_f', [(-HX + 2.4, yf, z0), (HX - 2.4, yf, z0), (HX - 2.4, yf, z1), (-HX + 2.4, yf, z1)], [(0, 1, 2, 3)],
                   [M['window']]))
    for s in (-1, 1):
        x = s * (HX - 0.33)
        v = [(x, 2.6, z0), (x, 2 * HY - 2.6, z0), (x, 2 * HY - 2.6, z1), (x, 2.6, z1)]
        P.add(mesh_obj('ribbon_s', v if s > 0 else v[::-1], [(0, 1, 2, 3)], [M['window']]))
# cream piers break the ribbons into bays (front + both sides)
for k in range(9):
    x = -13.6 + k * 3.4
    P.add(rbx('pier', x - 0.38, x + 0.38, yf - 0.3, yf + 0.02, Z1 + 0.7, Z3 - 0.1, M['wall'], bevel=0, open=('+y', '-z', '+z')))
for s in (-1, 1):
    for k in range(8):
        y = 3.4 + k * 3.3
        a, b = sorted((s * (HX - 0.35), s * (HX - 0.03)))
        P.add(rbx('pier_s', a, b, y - 0.38, y + 0.38, Z1 + 0.7, Z3 - 0.1, M['wall'], bevel=0,
                  open=(('-x',) if s > 0 else ('+x',)) + ('-z', '+z')))

# --- LED billboard (runtime canvas target `screen`) in a chunky dark frame, viewer's right
P.add(rbx('screen_frame', 0.55, 11.45, yf - 0.55, yf + 0.02, 9.35, 15.65, M['dark'], bevel=0.18, seg=2, open=('+y',)))
for x in (2.5, 9.5):
    P.add(rbx('screen_arm', x - 0.12, x + 0.12, yf - 0.5, yf + 0.02, 15.6, 16.3, M['metal'], bevel=0, open=('+y',)))
screen = quad_uv('screen', 1.0, 11.0, 9.75, 15.25, yf - 0.57, M['sign'])

# --- neon logo roundel on the crown (viewer's left) + colonnade + entrance canopy
P.add(cyl('logo_back', 1.55, 0.3, (-8.5, yf - 0.5, 14.3), M['wall2'], rot=(math.pi / 2, 0, 0), verts=16, bevel=0.08))
P.add(torus('logo_ring', 1.05, 0.2, (-8.5, yf - 0.7, 14.3), neon, rot=(math.pi / 2, 0, 0), major_seg=14, minor_seg=5))
P.add(sphere('logo_dot', 0.45, (-8.5, yf - 0.68, 14.3), M['goods1'], scale=(1, 0.5, 1), segments=10, rings=5))
for x in (-13.6, -9.6, -2.4, 2.4, 6.4, 10.4, 13.6):
    P.add(cyl('column', 0.42, Z1 - 0.15, (x, 0.65, (Z1 - 0.15) / 2), M['trim'], verts=10, bevel=0))
P.add(plan_prism('canopy', rr_plan(-6.0, -0.9, 4.2, 2.0, 1.6, 2), Z1 - 0.95, Z1 - 0.4, M['trim'], bevel=0.12))
for x in (-8.3, -6.0, -3.7):
    P.add(rbx('canopy_lamp', x - 0.45, x + 0.45, -1.6, -0.9, Z1 - 0.99, Z1 - 0.94, M['lamp'], bevel=0, open=('+z',)))
P.add(rbx('portal', -9.0, -3.0, 1.15, 1.45, 0.0, Z1 - 0.95, M['wall2'], bevel=0.1, open=('+y', '-z')))
P.add(rbx('doors', -8.4, -3.6, 1.3, 1.5, 0.0, 3.6, M['interior'], bevel=0, open=('+y', '-z')))
for x in (-6.0,):
    P.add(rbx('door_split', x - 0.06, x + 0.06, 1.2, 1.3, 0.0, 3.6, M['steel'], bevel=0, open=('+y', '-z')))
P.add(rbx('plaza', -HX, HX, -2.6, 1.2, 0.0, 0.12, M['floor'], bevel=0.04, open=('-z',)))
for x in (-12.5, 1.5, 12.0):
    P.add(rbx('planter', x - 1.3, x + 1.3, -2.3, -1.1, 0.0, 0.6, M['wall2'], bevel=0.08, open=('-z',)))
    P.add(sphere('shrub', 0.75, (x - 0.5, -1.7, 0.95), M['leaf'], scale=(1.1, 0.8, 0.8), segments=8, rings=4))
    P.add(sphere('bloom', 0.5, (x + 0.6, -1.75, 0.88), M['flower'], scale=(1.1, 0.8, 0.8), segments=8, rings=4))

# --- roof: skylight dome over the atrium, AC plant, vents
P.add(sphere('dome', 4.0, (-5.0, CY + 1.0, Z3 + 0.6), M['glass'], scale=(1, 1, 0.42), segments=14, rings=7))
P.add(torus('dome_ring', 4.0, 0.18, (-5.0, CY + 1.0, Z3 + 0.75), M['trim'], major_seg=16, minor_seg=4))
for x, y in ((6.0, 21.0), (9.5, 21.0), (6.0, 25.5), (9.5, 25.5)):
    P.add(rbx('ac_plant', x - 1.3, x + 1.3, y - 1.6, y + 1.6, Z3 + 0.7, Z3 + 1.7, M['ac'], bevel=0.08, open=('-z',)))
    P.add(cyl('ac_fan', 0.8, 0.05, (x, y, Z3 + 1.72), M['dark'], verts=10, bevel=0))
P.add(rbx('lift_house', 4.0, 9.0, 8.0, 12.0, Z3 + 0.7, Z3 + 1.75, M['wall2'], bevel=0.1, open=('-z',)))
# cinema box at the back-left with a coral stripe, roof garden lawns with puffy trees
P.add(plan_prism('cinema', rr_plan(-7.0, 25.0, 6.5, 3.6, 1.2, 1), Z3 + 0.7, H - 0.05, M['wall2'], bevel=0.12))
P.add(band('cinema_stripe', -7.0, 25.0, 6.5, 3.6, 1.2, H - 0.75, H - 0.4, accent, out=0.06, ch=0.02, seg=1))
for cx, cy, hx, hy in ((6.0, 4.6, 7.0, 2.2), (-11.0, 9.0, 2.6, 4.2)):
    P.add(plan_prism('lawn', rr_plan(cx, cy, hx, hy, 0.9, 1), Z3 + 0.7, Z3 + 0.95, M['leaf'], bevel=0.06))
for x, y, r in ((1.5, 4.6, 0.85), (6.0, 4.4, 1.0), (10.5, 4.7, 0.8), (-11.0, 7.0, 0.9), (-11.2, 11.0, 0.75)):
    P.add(sphere('tree', r, (x, y, Z3 + 0.95 + r * 0.75), M['leaf'], scale=(1, 1, 0.85), segments=8, rings=4))
# hanging sale banners in front of the left glass ribbon
for x, m in ((-14.0, M['goods1']), (-11.0, accent)):
    P.add(rbx('banner', x - 0.55, x + 0.55, yf - 0.42, yf - 0.32, Z1 + 1.0, Z3 - 0.6, m, bevel=0.03))
    P.add(rbx('banner_rod', x - 0.7, x + 0.7, yf - 0.45, yf - 0.29, Z3 - 0.62, Z3 - 0.5, M['metal'], bevel=0))

body = P.body()
root = rooted(NAME, body, [screen])
export_glb(ctx, NAME, [root], max_tris=3500)
preview_framed(ctx, NAME, (-16.5, -3, 0), (16.5, 30, 18), view=(0.55, -1.2, 0.7))
