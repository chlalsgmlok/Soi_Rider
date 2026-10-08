"""QA close-ups of the refitted veh_taxi lamps (review round 2): imports public/assets/models/veh_taxi.glb and renders
the front / rear corners from both sides and from low, framed on the head_lights / brake_lights nodes.

Run (after veh_taxi.py): node blender/run-blender.mjs blender/assets/asset-polish/_taxi_lamp_qa.py
Writes blender/previews/veh_taxi__qa_{front,rear}_{L,R,low}.png (Cycles, ~3-4 min).
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bpy
from lib.bootstrap import start
from lib.preview import render_preview

ctx = start()
bpy.ops.import_scene.gltf(filepath=os.path.join(ctx.models_dir, 'veh_taxi.glb'))
objs = {o.name: o for o in bpy.context.scene.objects}
head, brake = objs['head_lights'], objs['brake_lights']
bpy.context.view_layer.update()
for name, ob, view in (
    ('veh_taxi__qa_front_L', head, (1.0, -1.0, 0.55)),
    ('veh_taxi__qa_front_R', head, (-1.0, -1.0, 0.55)),
    ('veh_taxi__qa_rear_L', brake, (1.0, 1.0, 0.65)),
    ('veh_taxi__qa_rear_R', brake, (-1.0, 1.0, 0.65)),
    ('veh_taxi__qa_rear_low', brake, (0.35, 1.0, 0.25)),
    ('veh_taxi__qa_front_low', head, (-0.35, -1.0, 0.25)),
):
    render_preview(ctx, name, objs=[ob], view=view, res=(900, 600), samples=24)
print('[taxi_lamp_qa] OK')
