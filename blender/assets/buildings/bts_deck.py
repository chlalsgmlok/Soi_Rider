"""bts_deck — 40 m BTS twin-track viaduct segment along Y (w 9), chunky rounded box girder sitting on the pillar
crossbeam (z 9.5) with slab top 10.6, light parapets to 11.0, plinth slab track (rail top 10.88, tracks x = +-2.0),
cable troughs, green accent band on the wing faces (`Paint`, recolourable per line), drain spouts.
Origin = segment centre on the ground (geometry spans z 9.5..11.0, y -20..20). Ends are flat so segments tile.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bts_deck.py
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.export import export_glb
from lib.buildings_kit import Parts, rbx, rooted, preview_framed
from lib.buildings_bts import bts_materials, TRACK_X, Z_SLAB
from lib.buildings_bts_deck import girder, parapets, track, drains

NAME = 'bts_deck'
L = 40.0
ctx = start()
B = bts_materials()
P = Parts()
y0, y1 = -L / 2, L / 2
girder(P, B, y0, y1)
parapets(P, B, y0, y1)
for xc in (-TRACK_X, TRACK_X):
    track(P, B, y0, y1, xc)
drains(P, B, (-15.0, -5.0, 5.0, 15.0))
# expansion joint line across the slab at one end (every segment carries one -> joints read when tiled)
P.add(rbx('joint', -4.2, 4.2, y1 - 0.06, y1, Z_SLAB - 0.01, Z_SLAB + 0.012, B['ink'], bevel=0, open=('-z',), flat=('+y',)))
body = P.body()
root = rooted(NAME, body)
export_glb(ctx, NAME, [root], max_tris=3500)
preview_framed(ctx, NAME, (-5, -20, 0), (5, 20, 11), view=(0.9, -1.0, 0.6))
