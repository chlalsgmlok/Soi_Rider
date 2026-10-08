"""bld_minimart — 24h convenience store (8 x 12, H 4.5): deep fascia canopy with wrap-around stripe band
(Paint / Paint2), signboard panel, see-through glass front showing bright aisles, sliding doors, ATM kiosk,
rooftop condensers. Facade line y=0 = fascia front; storefront glass recessed 1.2 m under the canopy.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bld_minimart.py
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import cyl
from lib.export import export_glb
from lib.buildings_kit import materials, Parts, bx, rbx, prism, mesh_obj, quad_uv, rooted, preview_framed
from lib.buildings_parts import sign_board, roof_hatch

NAME = 'bld_minimart'
HW, D, H = 4.0, 12.0, 4.5
YG = 1.2           # storefront glass line
ZC = 3.05          # canopy soffit
ctx = start()
M = materials(wall='wall_white', wall2='wall_white', trim='trim_white', paint='taxi_green', paint2='taxi_orange')
glass = mat('Bld_ShopGlass', 'glass_light', roughness=0.05, alpha=0.28)
atm = mat('Bld_ATM', 'sign_blue', roughness=0.4)
P = Parts()

# --- shell: back block (its front face = glowing fridge wall), side walls, roof slab, canopy fascia
P.add(bx('back_block', -HW, HW, 5.0, D, 0.0, H - 0.3, M['wall'], bevel=0.12, seg=2))
for a, b in ((-HW, -HW + 0.25), (HW - 0.25, HW)):
    P.add(rbx('side_wall', a, b, YG - 0.05, 5.05, 0.0, H - 0.3, M['wall'], bevel=0.06, open=('+y',)))
P.add(rbx('roof_slab', -HW, HW, 0.0, 5.05, ZC, H - 0.3, M['wall'], bevel=0.1, seg=2, open=('+y',)))
P.add(rbx('roof_deck', -HW + 0.2, HW - 0.2, 0.2, D - 0.2, H - 0.32, H - 0.27, M['roof'], bevel=0, open=('-z',)))
for a, b in ((-HW, -HW + 0.2), (HW - 0.2, HW)):
    P.add(rbx('parapet_s', a, b, 0.0, D, H - 0.45, H, M['wall2'], bevel=0.04, open=('-z',)))
for a, b in ((0.0, 0.2), (D - 0.2, D)):
    P.add(rbx('parapet_fb', -HW, HW, a, b, H - 0.45, H, M['wall2'], bevel=0.04, open=('-z',)))

# --- wrap-around stripe band (stripes are separate thin pieces so the runtime can recolour Paint / Paint2)
for z0, z1, m in ((ZC + 0.12, ZC + 0.4, M['paint']), (ZC + 0.48, ZC + 0.64, M['paint2']), (ZC + 0.72, ZC + 0.8, M['paint'])):
    P.add(rbx('stripe', -HW - 0.025, HW + 0.025, -0.025, 2.6, z0, z1, m, bevel=0.015, open=('+y',)))
sign = sign_board(P, M, -1.75, 1.75, ZC + 0.08, H - 0.12, depth=0.14, material=M['trim'], y=-0.02)
for x in (-1.6, 1.6):
    P.add(cyl('soffit_light', 0.16, 0.03, (x, 0.6, ZC - 0.01), M['lamp'], verts=8, bevel=0))
P.add(cyl('soffit_light', 0.16, 0.03, (0.0, 0.6, ZC - 0.01), M['lamp'], verts=8, bevel=0))

# --- front terrace + step
P.add(rbx('terrace', -HW, HW, 0.0, 5.0, 0.0, 0.15, M['floor'], bevel=0.03, open=('-z', '+y')))

# --- storefront: aluminium frame, sliding doors, see-through glass, promo posters
alu = M['steel']
P.add(rbx('sf_bottom', -HW + 0.25, HW - 0.25, YG - 0.04, YG + 0.08, 0.15, 0.35, alu, bevel=0.02, open=('-z',)))
P.add(rbx('sf_top', -HW + 0.25, HW - 0.25, YG - 0.04, YG + 0.08, ZC - 0.25, ZC, alu, bevel=0.02, open=('+z',)))
for x in (-2.55, -1.0, 1.0, 2.55):
    P.add(rbx('sf_mull', x - 0.05, x + 0.05, YG - 0.04, YG + 0.08, 0.35, ZC - 0.25, alu, bevel=0, open=('-z', '+z')))
for a, b in ((-1.0, 0.02), (-0.02, 1.0)):
    P.add(rbx('door_leaf_v', a, a + 0.06, YG - 0.12, YG - 0.06, 0.35, ZC - 0.25, alu, bevel=0, open=('-z', '+z')))
    P.add(rbx('door_leaf_v', b - 0.06, b, YG - 0.12, YG - 0.06, 0.35, ZC - 0.25, alu, bevel=0, open=('-z', '+z')))
    P.add(rbx('door_handle', (a + b) / 2 - 0.03 + (0.3 if a < 0 else -0.3), (a + b) / 2 + 0.03 + (0.3 if a < 0 else -0.3),
              YG - 0.16, YG - 0.12, 1.0, 1.6, M['chrome'], bevel=0, open=('+y',)))
P.add(mesh_obj('shop_glass', [(-HW + 0.25, YG, 0.35), (HW - 0.25, YG, 0.35), (HW - 0.25, YG, ZC - 0.25), (-HW + 0.25, YG, ZC - 0.25)],
               [(0, 1, 2, 3)], [glass]))
for x0, x1, z0, z1, m in ((-3.55, -2.75, 0.5, 1.5, M['paint2']), (-2.3, -1.25, 0.5, 1.25, M['goods1']),
                          (1.25, 2.3, 1.7, 2.6, M['paint']), (2.75, 3.55, 0.45, 0.95, M['awn_a'])):
    P.add(mesh_obj('poster', [(x0, YG - 0.01, z0), (x1, YG - 0.01, z0), (x1, YG - 0.01, z1), (x0, YG - 0.01, z1)], [(0, 1, 2, 3)], [m]))
P.add(mesh_obj('door_mat', [(-1.0, YG - 0.9, 0.152), (1.0, YG - 0.9, 0.152), (1.0, YG - 0.05, 0.152), (-1.0, YG - 0.05, 0.152)],
               [(0, 1, 2, 3)], [M['dark']]))

# --- interior: glowing fridge wall with door frames, aisles of goods, cashier counter
P.add(rbx('int_floor', -HW + 0.25, HW - 0.25, YG, 5.0, 0.0, 0.16, M['floor'], bevel=0, open=('-z', '+y', '-y')))
P.add(rbx('fridge', -HW + 0.3, HW - 0.3, 4.6, 5.0, 0.16, 2.55, M['interior'], bevel=0, open=('+y', '-z')))
for i in range(7):
    x = -HW + 0.3 + i * (2 * HW - 0.6) / 6
    P.add(rbx('fridge_frame', x - 0.04, x + 0.04, 4.54, 4.6, 0.16, 2.55, alu, bevel=0, open=('+y', '-z', '+z')))
P.add(rbx('fridge_head', -HW + 0.3, HW - 0.3, 4.5, 5.0, 2.55, 2.95, M['paint'], bevel=0.02, open=('+y',)))
goods = [M['goods1'], M['goods2'], M['awn_a'], M['paint2'], M['paint'], M['flower']]
for k, x in enumerate((-2.7, -1.6, 1.6)):
    P.add(rbx('gondola', x - 0.28, x + 0.28, 2.0, 4.0, 0.16, 1.45, M['trim'], bevel=0.03, open=('-z',)))
    for j, (y0, y1) in enumerate(((2.05, 2.95), (3.05, 3.95))):
        for s, (gx0, gx1) in enumerate(((x - 0.33, x - 0.28), (x + 0.28, x + 0.33))):
            P.add(rbx('goods', gx0, gx1, y0, y1, 0.3, 1.35, goods[(k * 2 + j + s) % len(goods)], bevel=0, open=('-z',)))
P.add(rbx('counter', 0.55, 2.9, 1.5, 2.05, 0.16, 1.05, M['paint2'], bevel=0.04, open=('-z',)))
P.add(rbx('counter_top', 0.5, 2.95, 1.45, 2.1, 1.05, 1.1, M['trim'], bevel=0.02))
P.add(rbx('register', 1.0, 1.4, 1.65, 1.95, 1.1, 1.35, M['dark'], bevel=0.02, open=('-z',)))

# --- ATM kiosk under the canopy (right end)
P.add(rbx('atm', 2.95, 3.7, 0.35, 1.1, 0.15, 2.15, atm, bevel=0.06, seg=2, open=('-z',)))
P.add(rbx('atm_screen', 3.05, 3.6, 0.31, 0.36, 1.35, 1.8, M['dark'], bevel=0, open=('+y',)))
P.add(rbx('atm_shelf', 3.05, 3.6, 0.15, 0.36, 1.05, 1.12, M['trim'], bevel=0.02, open=('+y',)))
P.add(rbx('atm_cap', 2.9, 3.75, 0.3, 1.15, 2.15, 2.3, M['paint2'], bevel=0.03, open=('-z',)))

# --- roof: condensers with fans facing up, vent stack, hatch
for x, y in ((-2.4, 9.9), (-0.6, 9.9)):
    P.add(rbx('condenser', x - 0.7, x + 0.7, y - 0.55, y + 0.55, H - 0.27, H + 0.55, M['ac'], bevel=0.06, open=('-z',)))
    P.add(cyl('cond_fan', 0.42, 0.04, (x, y, H + 0.56), M['dark'], verts=10, bevel=0))
    P.add(rbx('cond_foot', x - 0.75, x + 0.75, y - 0.6, y + 0.6, H - 0.29, H - 0.17, M['metal'], bevel=0, open=('-z',)))
# conduit runs from the condensers to the front, along the roof
for x in (-2.4, -0.6):
    P.add(rbx('conduit', x - 0.07, x + 0.07, 1.0, 9.35, H - 0.27, H - 0.13, M['steel'], bevel=0, open=('-z',)))
P.add(rbx('conduit_x', -2.47, -0.53, 1.0, 1.14, H - 0.27, H - 0.13, M['steel'], bevel=0, open=('-z',)))
# solar array: tilted blue panels on steel legs (modern Bangkok stores) - reads well from the high camera
solar = mat('Bld_Solar', 'tuktuk_blue', roughness=0.25, metallic=0.2)
for y in (3.4, 6.0):
    for i in range(4):
        x = -3.0 + i * 1.72 + (0.0 if y < 5 else 0.0)
        if y > 5 and i == 0:
            continue
        zc = H - 0.27 + 0.42
        rise = 0.9 * math.sin(0.22)
        P.add(prism('pv', [(y - 0.88, zc - rise), (y + 0.88, zc + rise), (y + 0.88, zc + rise + 0.07), (y - 0.88, zc - rise + 0.07)],
                    x - 0.8, x + 0.8, 'X', solar, bevel=0.015))
        P.add(rbx('pv_leg', x - 0.04, x + 0.04, y + 0.7, y + 0.78, H - 0.27, zc + rise * 0.8, M['metal'], bevel=0, open=('-z', '+z')))
        P.add(rbx('pv_leg', x - 0.04, x + 0.04, y - 0.78, y - 0.7, H - 0.27, zc - rise * 0.8, M['metal'], bevel=0, open=('-z', '+z')))
P.add(cyl('vent', 0.12, 1.2, (-3.2, 11.0, H + 0.3), M['steel'], verts=8, bevel=0))
roof_hatch(P, M, 2.6, 10.4, H - 0.27)
# side walls: grey plinth band, downpipes, service door with a little hood
for s in (-1, 1):
    P.add(rbx('plinth', s * HW - 0.04, s * HW + 0.04, 1.2, D - 0.05, 0.0, 0.5, M['metal'], bevel=0.02, open=('-z',)))
    for y in (5.4, 11.6):
        P.add(cyl('downpipe', 0.07, H - 0.3, (s * (HW + 0.08), y, (H - 0.3) / 2), M['steel'], verts=6, bevel=0))
P.add(rbx('side_door', HW - 0.02, HW + 0.06, 8.6, 9.6, 0.0, 2.2, M['steel'], bevel=0.01, open=('-x',)))
P.add(rbx('side_door_hood', HW, HW + 0.6, 8.4, 9.8, 2.3, 2.4, M['paint'], bevel=0.02, open=('-x',)))

body = P.body()
x0, x1, z0, z1, y = sign
sb = quad_uv('signboard', x0, x1, z0, z1, y, M['sign'])
root = rooted(NAME, body, [sb])
export_glb(ctx, NAME, [root], max_tris=3500)
preview_framed(ctx, NAME, (-4.3, -0.5, 0), (4.3, 5.0, 5.0), view=(0.6, -1.25, 0.7))
