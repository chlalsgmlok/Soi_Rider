"""gear_topbox - hard top case for the rear rack: puffy rounded shell, black base + lid seam,
domed lid with two rubber ribs, red rear reflector strip, chrome lock barrel.

Contract: docs/ASSET_SPEC.md (Bikes / Gear). Origin = mount point at the bottom centre, front -Y,
materials Gear_Paint (runtime recolour) + Trim. Budget <= 800 tris.
Run: node blender/run-blender.mjs blender/assets/bikes/gear_topbox.py [--no-preview]
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
M = G.gear_mats('van_white')

# shell: one stacked loft; bands 0 (rubber base) and 3-5 (lid seam) are Trim
shell = G.stack('shell', [
    (0.0, 0.17, 0.148),
    (0.035, 0.196, 0.172),
    (0.065, 0.202, 0.178),
    (0.158, 0.202, 0.178),
    (0.162, 0.209, 0.185),
    (0.186, 0.209, 0.185),
    (0.19, 0.2, 0.176),
    (0.252, 0.195, 0.171),
    (0.29, 0.172, 0.148),
    (0.307, 0.125, 0.1),
], M['paint'], n=20, p=3.4, fan=(0.0, 0.008), paint=[(M['trim'], lambda s: s == 0 or 3 <= s <= 5)])

# lid ribs, rear reflector, lock barrel
parts = [shell]
for x in (-0.068, 0.068):
    parts.append(K.block(f'rib{x}', (0.026, 0.19, 0.016), (x, 0.0, 0.306), M['trim'], bevel=0.005, segs=1))
parts.append(K.slab('reflector', K.rrect(0.2, 0.036, 0.014, 1, 0.0, 0.108), 0.165, 0.189, M['tail'], axis='Y'))
parts.append(K.lathe('lock', [(0, 0.0), (0.024, 0.0), (0.021, 0.012), (0, 0.015)], M['chrome'], seg=8,
                     axis=(0, 1, 0), center=(0, 0.181, 0.174)))
K.report(parts, 'topbox ')

root, _ = G.assemble('gear_topbox', 'box', parts)
export_glb(ctx, 'gear_topbox', [root], max_tris=800)
render_preview(ctx, 'gear_topbox', view=(-0.9, 1.3, 0.9))
print('[gear_topbox] OK')
