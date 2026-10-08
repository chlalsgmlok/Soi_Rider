"""QA only (exports nothing): assembles the exported BTS GLBs into a line - pillars every 40 m at the deck joints,
5 deck segments, the station over the last two - and renders an overview (blender/previews/bts_line_test.png) and a
street-level view under the viaduct (bts_line_street.png). Run after bts_pillar / bts_deck / bts_station.

Run: node blender/run-blender.mjs blender/assets/buildings/_bts_test.py
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bpy
from lib.bootstrap import start
from lib.buildings_kit import preview_framed

ctx = start()


def place(name, x=0.0, y=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ctx.models_dir, name + '.glb'))
    roots = [o for o in bpy.data.objects if o not in before and o.parent is None]
    for r in roots:
        r.location.x += x
        r.location.y += y


for y in (-60.0, -20.0, 20.0, 60.0, 100.0):
    place('bts_deck', 0.0, y)
for y in (-40.0, 0.0, 40.0):
    place('bts_pillar', 0.0, y)
place('bts_station', 0.0, 90.0)
bpy.context.view_layer.update()
preview_framed(ctx, 'bts_line_test', (-12, -40, 0), (12, 120, 17), view=(0.75, -0.8, 0.75), res=(1280, 640))
preview_framed(ctx, 'bts_line_street', (-6, 44, 0), (6, 64, 9), view=(0.45, -1.0, 0.12), res=(1280, 640))
print('[bts_test] OK')
