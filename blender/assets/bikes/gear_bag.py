"""gear_bag - insulated food-delivery cube: puffy rounded box, black rubber base + zip seam, carry strap,
zip pulls, Gear_Logo flat quads (0..1 UVs, runtime CanvasTexture target) on the back and both sides.

Contract: docs/ASSET_SPEC.md (Bikes / Gear). Origin = mount point at the bottom centre, front -Y,
materials Gear_Paint (cyan default, runtime recolour) + Gear_Logo + Trim. Budget <= 800 tris.
Run: node blender/run-blender.mjs blender/assets/bikes/gear_bag.py [--no-preview]
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib import bikes_kit as K
from lib import bikes_gear as G
from lib.export import export_glb
from lib.preview import render_preview

ctx = start()
M = G.gear_mats('gram_cyan')

HX, HY = 0.222, 0.202          # half extents of the flat faces
# body: bands 0-1 rubber base, 4-6 zip seam (Trim); slight belly bulge on band 2-3
body = G.stack('body', [
    (0.0, 0.19, 0.17),
    (0.028, 0.215, 0.195),
    (0.05, HX, HY),
    (0.21, HX + 0.002, HY + 0.002),
    (0.352, HX, HY),
    (0.356, HX + 0.006, HY + 0.006),
    (0.374, HX + 0.006, HY + 0.006),
    (0.378, HX, HY),
    (0.41, HX - 0.016, HY - 0.016),
    (0.425, HX - 0.052, HY - 0.05),
], M['paint'], n=20, p=6.0, fan=(0.0, 0.007), paint=[(M['trim'], lambda s: s <= 1 or 4 <= s <= 6)])
parts = [body]

# carry strap over the lid + two zip pulls on the front seam
parts.append(K.tube('strap', [(-0.1, 0.0, 0.42), (-0.075, 0.0, 0.468), (0.075, 0.0, 0.468), (0.1, 0.0, 0.42)],
                    0.013, M['trim'], sides=4, fillet=0.03, steps=1, twist=0.785))
for x in (-0.05, 0.05):
    parts.append(K.block(f'pull{x}', (0.018, 0.012, 0.04), (x, -HY - 0.012, 0.35), M['metal']))

# logo quads: back (+Y) and both sides (+-X), 2.5 mm proud of the flat faces, u left->right as seen
Z0, Z1, O = 0.1, 0.3, 0.0045
parts.append(K.quad('logo_back', [(0.12, HY + O, Z0), (-0.12, HY + O, Z0), (-0.12, HY + O, Z1), (0.12, HY + O, Z1)],
                    M['logo']))
parts.append(K.quad('logo_L', [(HX + O, -0.11, Z0), (HX + O, 0.11, Z0), (HX + O, 0.11, Z1), (HX + O, -0.11, Z1)],
                    M['logo']))
parts.append(K.quad('logo_R', [(-HX - O, 0.11, Z0), (-HX - O, -0.11, Z0), (-HX - O, -0.11, Z1), (-HX - O, 0.11, Z1)],
                    M['logo']))
K.report(parts, 'bag ')

root, _ = G.assemble('gear_bag', 'bag', parts)
export_glb(ctx, 'gear_bag', [root], max_tris=800)
render_preview(ctx, 'gear_bag', view=(-0.9, 1.3, 0.9))
print('[gear_bag] OK')
