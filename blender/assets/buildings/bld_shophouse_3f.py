"""bld_shophouse_3f — three-storey Sino-Portuguese style shophouse (4.0 x 10, H 10.5), the classic Bangkok row unit:
wall signboard over the half-open shutter, grilled windows + AC on floor 2, louvre-shuttered windows over an iron
balconette on floor 3, arched pediment.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bld_shophouse_3f.py
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.shapes import cyl
from lib.export import export_glb
from lib.buildings_kit import rbx, materials, Parts, bx, prism, rooted, preview_framed
from lib.buildings_parts import window, ac_unit, water_tank, potted_plant, roof_shed
from lib.buildings_shophouse import shell, signboard, side_dressing, G, F

NAME = 'bld_shophouse_3f'
ctx = start()
M = materials(wall='wall_cream', wall2='wall_salmon', trim='trim_white', awn_a='awning_red', awn_b='trim_white')
P = Parts()
H, zr, sign = shell(P, M, floors=3, flavour=1)

# --- floor 2: two grilled windows with eyebrow hoods, AC compressor between them
z = G
for x0, x1, c in ((-1.38, -0.5, 0.35), (0.5, 1.38, -0.3)):
    window(P, M, x0, x1, z + 0.55, z + 2.4, mull=1, transom=0.7, hood=M['wall2'], grille=4, curtain=c)
ac_unit(P, M, 0.0, z + 1.35, side=1)

# --- floor 3: iron balconette + two louvre-shuttered windows
z = G + F
P.add(rbx('balc3_slab', -1.76, 1.76, -0.52, 0.0, z - 0.02, z + 0.2, M['trim'], bevel=0.05, seg=2, open=('+y',)))
P.add(bx('balc3_rail', -1.76, 1.76, -0.52, -0.46, z + 0.95, z + 1.01, M['metal'], bevel=0))
for x0, x1 in ((-1.76, -1.7), (1.7, 1.76)):
    P.add(rbx('balc3_rail_s', x0, x1, -0.52, 0.0, z + 0.95, z + 1.01, M['metal'], bevel=0, open=('+y',)))
for i in range(13):
    x = -1.68 + i * 0.28
    P.add(rbx('balc3_bar', x - 0.014, x + 0.014, -0.5, -0.48, z + 0.2, z + 0.95, M['metal'], bevel=0, open=('-z', '+z')))
P.add(bx('balc3_mid', -1.76, 1.76, -0.51, -0.47, z + 0.5, z + 0.54, M['metal'], bevel=0))
for x0, x1, c in ((-1.22, -0.55, 0.0), (0.55, 1.22, 0.4)):
    window(P, M, x0, x1, z + 0.45, z + 2.3, mull=1, transom=0.72, sill=False, hood=M['wall2'], shutters=M['wood_l'],
           curtain=c)
potted_plant(P, M, -0.0, -0.28, z + 0.2, s=0.8, flowers=True)

# --- arched pediment with a round medallion (classic shophouse crown)
prof = [(x, H - 0.04 + zz) for x, zz in [(-1.05, 0.0)] + [(1.05 * math.cos(math.radians(a)), 0.62 * math.sin(math.radians(a)))
                                                       for a in range(150, 29, -30)] + [(1.05, 0.0)]]
P.add(prism('pediment', prof, -0.12, 0.18, 'Y', M['wall2'], bevel=0.03))
P.add(cyl('medallion', 0.22, 0.06, (0.0, -0.14, H + 0.22), M['trim'], rot=(math.pi / 2, 0, 0), verts=12, bevel=0))

# --- roof: stair hut with a corrugated sheet roof, tank, plant
roof_shed(P, M, -1.75, 0.3, 6.4, 8.6, zr + 0.03, h=2.0)
water_tank(P, M, 1.05, 8.6, zr + 0.03, r=0.45, h=0.95)
potted_plant(P, M, 1.2, 1.2, zr + 0.03, s=1.0)

# --- party-wall dressing (only visible above lower neighbours)
side_dressing(P, M, zr)

body = P.body()
sb = signboard(sign, M)
root = rooted(NAME, body, [sb])
export_glb(ctx, NAME, [root], max_tris=3500)
preview_framed(ctx, NAME, (-2.2, -1.8, 0), (2.2, 2.5, H + 0.6), view=(0.6, -1.25, 0.65))
