"""bld_shophouse_2f — two-storey Thai shophouse (4.0 x 10, H 7.5): chicken-rice shop front, flowery balcony.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bld_shophouse_2f.py
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.shapes import cyl, sphere
from lib.export import export_glb
from lib.preview import render_preview
from lib.buildings_kit import rbx, materials, Parts, bx, rooted, preview_framed
from lib.buildings_parts import window, ac_unit, water_tank, potted_plant, sign_board, laundry_line, roof_hatch
from lib.buildings_shophouse import shell, signboard, G

NAME = 'bld_shophouse_2f'
ctx = start()
M = materials(wall='wall_mint', wall2='wall_cream', trim='trim_white', awn_a='awning_green', awn_b='trim_white')
P = Parts()
H, zr, _ = shell(P, M, floors=2, flavour=0, wall_sign=False)

# --- first floor: deep balcony with a chunky balustrade, folding glass doors, plants and bougainvillea.
# The shop sign hangs on the balcony fascia (a wall sign would be hidden under the slab from the diorama camera).
z = G
P.add(rbx('balc_slab', -1.78, 1.78, -0.85, 0.0, z - 0.02, z + 0.22, M['trim'], bevel=0.06, seg=2, open=('+y',)))
sign = sign_board(P, M, -1.84, 1.84, 3.22, 4.18, depth=0.12, material=M['wall2'], y=-0.8)
for x in (-1.5, 1.5):
    P.add(rbx('fascia_hanger', x - 0.04, x + 0.04, -0.8, 0.0, 3.6, 3.68, M['metal'], bevel=0, open=('+y', '-y')))
P.add(rbx('balc_rail', -1.78, 1.78, -0.85, -0.69, z + 1.0, z + 1.1, M['wall2'], bevel=0.04, open=('-x', '+x')))
for x0, x1 in ((-1.78, -1.62), (1.62, 1.78)):
    P.add(rbx('balc_rail_s', x0, x1, -0.69, 0.0, z + 1.0, z + 1.1, M['wall2'], bevel=0.03, open=('+y',)))
    P.add(rbx('balc_post', x0, x1, -0.85, -0.69, z + 0.22, z + 1.0, M['wall2'], bevel=0, open=('-z', '+z')))
for i in range(8):
    x = -1.38 + i * 0.394
    P.add(cyl('baluster', 0.045, 0.78, (x, -0.77, z + 0.61), M['trim'], verts=6, bevel=0))
window(P, M, -1.45, 0.72, z + 0.45, z + 2.55, mull=2, transom=0.8, sill=False, hood=M['wall2'], curtain=0.3)
potted_plant(P, M, -1.35, -0.45, z + 0.22, s=1.2, flowers=True)
potted_plant(P, M, 1.0, -0.42, z + 0.22, s=0.9)
for x, s in ((-1.15, 1.0), (-0.45, 0.75)):
    P.add(sphere('bougain', 0.26 * s, (x, -0.86, z + 1.1), M['flower'], scale=(1.4, 0.9, 0.8), segments=8, rings=4))
    P.add(sphere('bougain_leaf', 0.2 * s, (x + 0.25 * s, -0.84, z + 1.02), M['leaf'], scale=(1.3, 0.9, 0.8), segments=8, rings=4))
ac_unit(P, M, 1.28, z + 1.55, side=-1)

# --- parapet pediment with a little plaque
P.add(rbx('pediment', -0.9, 0.9, -0.14, 0.2, H - 0.02, H + 0.36, M['wall2'], bevel=0.05, open=('-z',)))
P.add(rbx('pediment_cap', -1.0, 1.0, -0.19, 0.25, H + 0.36, H + 0.44, M['trim'], bevel=0.03, open=('-z',)))
P.add(rbx('plaque', -0.45, 0.45, -0.18, -0.12, H + 0.05, H + 0.3, M['trim'], bevel=0, open=('+y',)))

# --- roof: water tank, hatch, washing line, a pot
water_tank(P, M, 0.9, 8.4, zr + 0.03)
roof_hatch(P, M, -1.0, 8.6, zr + 0.03)
laundry_line(P, M, -1.6, 1.6, 4.2, zr + 0.03, items=4)
potted_plant(P, M, -1.3, 1.0, zr + 0.03, s=1.1)

body = P.body()
sb = signboard(sign, M)
root = rooted(NAME, body, [sb])
export_glb(ctx, NAME, [root], max_tris=3500)
preview_framed(ctx, NAME, (-2.2, -1.8, 0), (2.2, 2.5, H + 0.5), view=(0.6, -1.25, 0.65))
