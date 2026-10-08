"""bld_temple — wat ordination hall (ubosot), 18 x 30, H 14: two-step cream plinth with naga-guarded front stairs,
white walls (`Wall`) with red-lacquer door and windows under gold pointed crowns, verandah columns with gold capitals,
three-tier red roof with green borders, telescoping front porch gable, gold naa-ban gable faces, bargeboards with
bai-raka teeth, chofa finials and hang-hong tails, sema boundary stones, frangipani shrubs.
Origin = bottom-centre of the facade line (stairs start at y=0), facade faces -Y.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bld_temple.py
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import cyl, sphere
from lib.export import export_glb
from lib.buildings_kit import Parts, rbx, prism, frame_ring, rooted, preview_framed
from lib.buildings_temple import gable_tier, slope_slab, eave_border, naa_ban, bargeboard, hang_hong

NAME = 'bld_temple'
ZP = 1.2
ctx = start()
M = {
    'wall': mat('Wall', 'temple_white', roughness=0.75),
    'wall2': mat('Wall2', '#E8DCC4', roughness=0.8),
    'trim': mat('Trim', 'trim_white', roughness=0.6),
    'red': mat('Bld_RoofRed', 'temple_red', roughness=0.5),
    'green': mat('Bld_RoofGreen', '#2E9E5B', roughness=0.5),
    'gold': mat('Bld_Gold', 'temple_gold', roughness=0.3, metallic=0.55),
    'red2': mat('Bld_TempleDoor', '#A8322A', roughness=0.45),
    'leaf': mat('Leaf', 'leaf', roughness=0.7),
    'flower': mat('Flower', 'bougainvillea', roughness=0.6),
}
P = Parts()

# ---------------------------------------------------------------- plinth, stairs, naga balustrades
P.add(rbx('step1', -9.0, 9.0, 1.0, 30.0, 0.0, 0.55, M['wall2'], bevel=0.1, open=('-z',)))
P.add(rbx('step2', -8.5, 8.5, 1.5, 29.5, 0.55, ZP, M['wall2'], bevel=0.1, open=('-z',)))
P.add(rbx('plinth_lip', -8.62, 8.62, 1.38, 29.62, ZP - 0.12, ZP + 0.04, M['trim'], bevel=0.05, open=('-z',)))
for i in range(4):
    P.add(rbx('stair', -2.5, 2.5, i * 0.36, 1.6, 0.0, (i + 1) * 0.3, M['wall2'], bevel=0.04, open=('-z', '+y')))
for s in (-1, 1):
    x0, x1 = s * 2.55, s * 2.95
    a, b = sorted((x0, x1))
    P.add(prism('naga_wall', [(1.9, 0.0), (1.9, 1.8), (0.35, 0.95), (0.35, 0.0)], a, b, 'X', M['wall'], bevel=0.04))
    P.add(prism('naga_body', [(1.95, 1.75), (1.95, 2.0), (0.3, 1.18), (0.3, 0.92)], a - s * 0.03, b + s * 0.03, 'X', M['green'],
                bevel=0.03))
    xc = s * 2.75
    P.add(rbx('naga_neck', xc - 0.3, xc + 0.3, -0.05, 0.6, 0.0, 1.45, M['green'], bevel=0.2, seg=2, open=('-z',)))
    P.add(rbx('naga_belly', xc - 0.31, xc + 0.31, -0.08, 0.1, 0.25, 1.3, M['gold'], bevel=0.06, open=('+y',)))
    P.add(prism('naga_hood', [(xc - 0.75, 1.2), (xc + 0.75, 1.2), (xc + 0.7, 1.75), (xc + 0.35, 2.15), (xc, 2.45),
                              (xc - 0.35, 2.15), (xc - 0.7, 1.75)], 0.32, 0.48, 'Y', M['gold'], bevel=0.04))
    P.add(sphere('naga_head', 0.4, (xc, 0.05, 1.68), M['green'], scale=(0.9, 1.3, 0.8), segments=10, rings=5))
    for e in (-1, 1):
        P.add(sphere('naga_eye', 0.08, (xc + e * 0.2, -0.3, 1.82), M['gold'], segments=6, rings=3))

# ---------------------------------------------------------------- hall walls, door, windows, columns
P.add(rbx('hall', -5.6, 5.6, 4.6, 28.8, ZP, 7.75, M['wall'], bevel=0.1, open=('-z',)))
P.add(rbx('hall_base', -5.72, 5.72, 4.48, 28.92, ZP, ZP + 0.45, M['wall2'], bevel=0.05, open=('-z',)))
P.add(rbx('door', -0.9, 0.9, 4.48, 4.62, ZP, 4.0, M['red2'], bevel=0.02, open=('+y', '-z')))
P.add(rbx('door_split', -0.03, 0.03, 4.44, 4.5, ZP, 4.0, M['gold'], bevel=0, open=('+y', '-z')))
P.add(frame_ring('door_frame', -1.18, 1.18, ZP, 4.28, 4.42, 4.6, 0.26, M['gold'], bevel=0.03))
P.add(prism('door_crown', [(-1.35, 4.28), (1.35, 4.28), (1.0, 4.9), (0.4, 5.45), (0.0, 6.2), (-0.4, 5.45), (-1.0, 4.9)],
            4.44, 4.6, 'Y', M['gold']))
for s in (-1, 1):
    for y in (8.0, 12.0, 16.0, 20.0, 24.0):
        a, b = sorted((s * 5.6, s * 5.66))
        P.add(rbx('win_gold', a, b, y - 0.72, y + 0.72, 2.75, 5.1, M['gold'], bevel=0, open=(('-x',) if s > 0 else ('+x',))))
        a, b = sorted((s * 5.6, s * 5.72))
        P.add(rbx('win_shutter', a, b, y - 0.52, y + 0.52, 2.95, 4.9, M['red2'], bevel=0, open=(('-x',) if s > 0 else ('+x',))))
        a, b = sorted((s * 5.6, s * 5.7))
        P.add(prism('win_crown', [(y - 0.85, 5.1), (y + 0.85, 5.1), (y, 6.15)], a, b, 'X', M['gold']))
for s in (-1, 1):
    for y in (6.0, 10.0, 14.0, 18.0, 22.0, 26.0):
        x = s * 7.3
        P.add(rbx('col', x - 0.22, x + 0.22, y - 0.22, y + 0.22, ZP, 6.35, M['wall'], bevel=0.05, open=('-z', '+z')))
        P.add(rbx('col_cap', x - 0.32, x + 0.32, y - 0.32, y + 0.32, 6.2, 6.55, M['gold'], bevel=0, open=('+z',)))
for x in (-4.4, -1.9, 1.9, 4.4):
    P.add(rbx('porch_col', x - 0.25, x + 0.25, 1.75, 2.25, ZP, 7.4, M['wall'], bevel=0.05, open=('-z', '+z')))
    P.add(rbx('porch_cap', x - 0.36, x + 0.36, 1.64, 2.36, 7.1, 7.45, M['gold'], bevel=0, open=('+z',)))
P.add(rbx('porch_beam', -4.85, 4.85, 1.7, 2.3, 7.4, 8.0, M['wall'], bevel=0.06))
P.add(rbx('porch_beam_gold', -4.85, 4.85, 1.64, 1.7, 7.55, 7.85, M['gold'], bevel=0, open=('+y',)))

# ---------------------------------------------------------------- roof tiers (main) + telescoping porch roof
tiers = [  # name, y0, y1, xa, za, xb, zb, t
    ('roof_m', 4.4, 29.1, 4.0, 9.45, 6.7, 7.35, 0.26),
    ('roof_l', 4.7, 28.8, 6.45, 7.55, 8.3, 6.15, 0.24),
    ('porch_m', 1.5, 4.6, 3.05, 8.7, 5.05, 7.25, 0.24),
]
gable_tier(P, 'roof_u', 4.1, 29.4, 4.3, 9.25, 12.4, 0.28, M['red'])
eave_border(P, 4.1, 29.4, 0.0, 12.4, 4.3, 9.25, 0.6, M['green'])
gable_tier(P, 'porch_u', 1.3, 4.8, 3.3, 8.55, 11.2, 0.26, M['red'])
eave_border(P, 1.3, 4.8, 0.0, 11.2, 3.3, 8.55, 0.5, M['green'])
for name, y0, y1, xa, za, xb, zb, t in tiers:
    slope_slab(P, name, y0, y1, xa, za, xb, zb, t, M['red'])
    eave_border(P, y0, y1, xa, za, xb, zb, 0.55, M['green'])
    for ye in (y0, y1 - 0.14):   # gold verge on both ends of the lower tiers
        slope_slab(P, 'verge', ye, ye + 0.14, xa, za + 0.12, xb - 0.05, zb + 0.12, t + 0.2, M['gold'])
    if name != 'roof_l':
        for s in (-1, 1):
            hang_hong(P, M, s * (xb + 0.02), zb - 0.05, y0 + 0.07, s)
P.add(cyl('ridge', 0.17, 25.3, (0.0, 16.75, 12.36), M['red'], rot=(math.pi / 2, 0, 0), verts=8, bevel=0))
P.add(cyl('ridge_p', 0.15, 3.5, (0.0, 3.05, 11.16), M['red'], rot=(math.pi / 2, 0, 0), verts=8, bevel=0))

# ---------------------------------------------------------------- gable faces + bargeboards with chofa
naa_ban(P, M, 1.6, 3.05, 7.95, 8.45, 10.8, facing=-1)
naa_ban(P, M, 4.4, 4.05, 8.4, 9.12, 12.0, facing=-1)
naa_ban(P, M, 29.1, 4.05, 8.25, 9.12, 12.0, facing=1)
bargeboard(P, M, 1.3, 3.3, 8.55, 11.2, facing=-1, teeth=4, chofa_h=1.45)
bargeboard(P, M, 4.1, 4.3, 9.25, 12.4, facing=-1, teeth=5, chofa_h=1.5)
bargeboard(P, M, 29.4, 4.3, 9.25, 12.4, facing=1, teeth=5, chofa_h=1.5)

# ---------------------------------------------------------------- sema stones + frangipani shrubs
for x, y in ((-8.55, 1.35), (8.55, 1.35), (-8.55, 29.6), (8.55, 29.6)):
    P.add(rbx('sema_base', x - 0.28, x + 0.28, y - 0.28, y + 0.28, 0.55, 0.85, M['red2'], bevel=0.04, open=('-z',)))
    P.add(prism('sema', [(x - 0.2, 0.85), (x + 0.2, 0.85), (x + 0.2, 1.2), (x, 1.5), (x - 0.2, 1.2)], y - 0.06, y + 0.06, 'Y',
                M['wall']))
for x in (-6.2, 6.2):
    P.add(sphere('shrub', 0.75, (x, 0.35, 0.65), M['leaf'], scale=(1.2, 0.85, 0.85), segments=8, rings=4))
    for dx, dz in ((-0.35, 1.18), (0.4, 1.1)):
        P.add(sphere('bloom', 0.26, (x + dx, 0.1, dz), M['flower'], scale=(1.1, 1.0, 0.7), segments=6, rings=3))

body = P.body()
root = rooted(NAME, body)
export_glb(ctx, NAME, [root], max_tris=3500)
preview_framed(ctx, NAME, (-9.5, -0.5, 0), (9.5, 30, 14), view=(0.7, -1.15, 0.75))
