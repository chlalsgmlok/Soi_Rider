"""QA only (exports nothing): tiles 6 shophouse modules edge-to-edge from the exported GLBs, recolours a few
instances by contract material name like the runtime would, and renders blender/previews/bld_row_test.png (+ bld_row_street.png, a low view along the shop fronts).

Run after the shophouse scripts: node blender/run-blender.mjs blender/assets/buildings/_row_test.py
Optional flag `--extra a,b` appends other GLBs (e.g. bld_minimart) to the row with a 0.0 m gap.
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bpy
from lib.bootstrap import start
from lib.palette import hex_to_linear, HEX
from lib.buildings_kit import preview_framed

ctx = start()
ROW = ['bld_shophouse_3f', 'bld_shophouse_2f', 'bld_shophouse_4f', 'bld_shophouse_3f', 'bld_shophouse_4f', 'bld_shophouse_2f']
RECOLOUR = {3: {'Wall': 'wall_mint', 'Wall2': 'wall_white', 'Awning_A': 'awning_blue'},
            4: {'Wall': 'wall_pink', 'Wall2': 'wall_cream', 'Awning_A': 'awning_red'},
            5: {'Wall': 'wall_lemon', 'Wall2': 'wall_salmon', 'Awning_A': 'taxi_orange'}}
extra = []
if '--extra' in ctx.flags:
    extra = ctx.flags[ctx.flags.index('--extra') + 1].split(',')


def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ctx.models_dir, name + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    return [o for o in new if o.parent is None][0], new


x = -2.0 * len(ROW) + 2.0
for i, name in enumerate(ROW):
    root, objs = load(name)
    root.location.x = x
    x += 4.0
    for o in objs:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            base = slot.material.name.split('.')[0]
            if base in RECOLOUR.get(i, {}):
                m = slot.material.copy()
                m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = hex_to_linear(HEX[RECOLOUR[i][base]])
                slot.material = m
for name in extra:
    root, objs = load(name)
    w = max((o.dimensions.x for o in objs if o.type == 'MESH'), default=4.0)
    root.location.x = x - 2.0 + w / 2
    x += w
half = 2.0 * len(ROW)
preview_framed(ctx, 'bld_row_test', (-half, -2.0, 0.0), (x - 2.0, 6.0, 14.5), view=(-0.42, -1.15, 0.95), res=(1280, 640))
# street-level look along the shop fronts (ground floors, bulbs, interiors under the awnings)
preview_framed(ctx, 'bld_row_street', (-half, -2.5, 0.0), (-half + 12.0, 1.0, 5.0), view=(0.55, -1.0, 0.16), res=(1280, 640))
print('[row_test] OK')
