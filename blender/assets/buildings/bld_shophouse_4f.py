"""bld_shophouse_4f — four-storey 1980s concrete shophouse (4.0 x 10, H 13.5): steel grille cage balcony on floor 2
carrying the shop sign, ribbon windows under concrete sun hoods with hanging AC units, a vertical neon blade sign
and a corrugated-roof extension on top.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bld_shophouse_4f.py
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.export import export_glb
from lib.buildings_kit import rbx, materials, Parts, bx, rooted, preview_framed
from lib.buildings_parts import window, ac_unit, water_tank, potted_plant, roof_shed, sign_board, laundry_line
from lib.buildings_shophouse import shell, signboard, side_dressing, G, F

NAME = 'bld_shophouse_4f'
ctx = start()
M = materials(wall='wall_powder', wall2='wall_lemon', trim='trim_white', awn_a='awning_blue', awn_b='trim_white')
neon = mat('Bld_Neon', 'neon_pink', roughness=0.4, emission=1.2)
P = Parts()
H, zr, _ = shell(P, M, floors=4, flavour=0, wall_sign=False)

# --- floor 2: steel grille cage balcony; the shop sign is mounted on its fascia
z = G
P.add(rbx('cage_slab', -1.78, 1.78, -0.7, 0.0, z - 0.02, z + 0.2, M['trim'], bevel=0.05, seg=2, open=('+y',)))
sign = sign_board(P, M, -1.84, 1.84, 3.22, 4.16, depth=0.12, material=M['wall2'], y=-0.66)
for x0, x1 in ((-1.78, -1.7), (1.7, 1.78)):
    P.add(rbx('cage_post', x0, x1, -0.7, -0.62, z + 0.2, z + 2.98, M['metal'], bevel=0, open=('-z',)))
    P.add(bx('cage_side', x0, x1, -0.62, 0.0, z + 2.9, z + 2.98, M['metal'], bevel=0))
P.add(bx('cage_top', -1.78, 1.78, -0.7, -0.62, z + 2.9, z + 2.98, M['metal'], bevel=0))
for zz in (z + 0.95, z + 1.9):
    P.add(rbx('cage_rail', -1.7, 1.7, -0.69, -0.65, zz - 0.02, zz + 0.02, M['metal'], bevel=0, open=('-x', '+x')))
for i in range(11):
    x = -1.56 + i * 0.312
    P.add(rbx('cage_bar', x - 0.013, x + 0.013, -0.68, -0.66, z + 0.2, z + 2.9, M['metal'], bevel=0, open=('-z', '+z')))
window(P, M, -1.5, 1.5, z + 0.5, z + 2.45, mull=3, transom=0, sill=False, curtain=-0.3)
potted_plant(P, M, -1.35, -0.36, z + 0.2, s=0.9)
potted_plant(P, M, -0.95, -0.4, z + 0.2, s=0.7, flowers=True)
P.add(rbx('cage_ac', 0.55, 1.33, -0.6, -0.3, z + 0.2, z + 0.75, M['ac'], bevel=0.05, open=('-z',)))

# --- floors 3 and 4: ribbon windows, concrete sun hoods, hanging AC units
for k, z in enumerate((G + F, G + 2 * F)):
    window(P, M, -1.55, 1.55, z + 0.85, z + 2.25, mull=3, transom=0, curtain=0.28 if k == 0 else -0.25)
    P.add(rbx('sunhood', -1.78, 1.38, -0.55, 0.0, z + 2.42, z + 2.56, M['wall2'], bevel=0.04, open=('+y',)))
    ac_unit(P, M, -0.95 if k == 0 else 0.6, z + 0.24, side=1 if k == 0 else -1)

# --- vertical neon blade sign on the right pilaster (floors 3-4)
P.add(rbx('blade_box', 1.58, 1.82, -0.95, -0.1, 7.6, 10.4, M['wall2'], bevel=0.05, seg=2, open=('+y',)))
for xx in (1.565, 1.835):
    P.add(bx('blade_face', xx - 0.012, xx + 0.012, -0.88, -0.17, 7.7, 10.3, neon, bevel=0))
for zz in (8.0, 10.0):
    P.add(rbx('blade_arm', 1.66, 1.74, -0.1, 0.0, zz, zz + 0.08, M['metal'], bevel=0, open=('+y', '-y')))

# --- roof: corrugated-roof extension, water tank, washing line
roof_shed(P, M, -1.75, 1.75, 6.2, 9.7, zr + 0.03, h=2.2)
water_tank(P, M, 1.1, 1.3, zr + 0.03, r=0.42, h=0.9)
laundry_line(P, M, -1.6, 0.3, 3.0, zr + 0.03, items=2)

# --- party-wall dressing (only visible above lower neighbours)
side_dressing(P, M, zr, ad_side=1, ad_mats=(mat('Bld_AdBlue', 'taxi_blue', roughness=0.6), mat('Bld_AdYellow', 'neon_yellow', roughness=0.6)))

body = P.body()
sb = signboard(sign, M)
root = rooted(NAME, body, [sb])
export_glb(ctx, NAME, [root], max_tris=3500)
preview_framed(ctx, NAME, (-2.2, -1.8, 0), (2.2, 2.5, H + 0.6), view=(0.6, -1.25, 0.65))
