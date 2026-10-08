"""bts_pillar — BTS skytrain T-pillar for the road median: rounded column + tapered hammerhead crossbeam
(7.9 m wide, under the rounded soffit of the 9 m twin-track deck), crossbeam top = 9.5 m = deck seat. Red/white median planter at the
foot (2.44 m wide across the road), yellow/black hazard collar, drain pipe. Origin = pillar base centre.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bts_pillar.py
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.export import export_glb
from lib.buildings_kit import Parts, rbx, rod, rooted, preview_framed
from lib.buildings_bts import bts_materials, column, hammerhead, median_planter, Z_DECK
from lib.buildings_bts_deck import BEARING_X

NAME = 'bts_pillar'
ctx = start()
B = bts_materials()
P = Parts()
column(P, B, 0.0, 0.0, 0.0, Z_DECK - 1.5)
hammerhead(P, B, 0.0, 0.0, 3.95, Z_DECK, depth=2.0, hy=1.0, neck=1.05)
median_planter(P, B, 0.0, 0.0, hx=1.1, hy=1.9)
# bearings visible under the deck seat edges + drain pipe running down the column
for x in BEARING_X:
    P.add(rbx('bearing', x - 0.3, x + 0.3, -0.45, 0.45, Z_DECK - 0.06, Z_DECK, B['ink'], bevel=0, open=('-z', '+z')))
P.add(rod('drain', (0.62, 0.95, Z_DECK - 0.3), (0.62, 0.95, 0.3), 0.07, B['slab'], verts=6))
body = P.body()
root = rooted(NAME, body)
export_glb(ctx, NAME, [root], max_tris=3500)
preview_framed(ctx, NAME, (-5, -2, 0), (5, 2, 9.6), view=(0.7, -1.2, 0.55))
