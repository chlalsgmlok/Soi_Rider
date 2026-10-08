"""Group preview for props_infra: imports the exported GLBs into a little street-corner line-up and renders
blender/previews/props_infra_group.png (no GLB is written). Run after the asset scripts:
    node blender/run-blender.mjs blender/assets/props_infra/_group_preview.py
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bpy
from lib.bootstrap import start
from lib.preview import render_preview

ctx = start()

# (asset, x, y, yaw) in Blender coordinates; every model faces -Y (toward the camera side)
LAYOUT = [
    ('prop_power_pole', -12.4, 2.6, 0.0),
    ('prop_street_lamp', -8.4, 2.2, 0.0),
    ('prop_win_stand', -4.6, 0.6, 0.0),
    ('prop_spirit_house', -1.9, 0.9, 0.0),
    ('prop_bus_stop', 2.0, 0.7, 0.0),
    ('prop_soi_sign', 5.5, 0.2, 0.0),
    ('prop_hydrant', 4.4, -1.0, 0.0),
    ('prop_traffic_light', 6.9, 0.9, 0.0),
    ('prop_barrier', 9.6, -1.6, 0.0),
    ('prop_barrier', 11.2, -1.6, 0.0),
]


def import_glb(name, x, y, yaw):
    path = os.path.join(ctx.models_dir, name + '.glb')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.parent is None:
            o.location = (x, y, 0.0)
            o.rotation_mode = 'XYZ'
            o.rotation_euler = (0.0, 0.0, yaw)
    return new


meshes = []
for name, x, y, yaw in LAYOUT:
    meshes += [o for o in import_glb(name, x, y, yaw) if o.type == 'MESH']
bpy.context.view_layer.update()
print(f'[group] imported {len(LAYOUT)} models, {len(meshes)} meshes')
render_preview(ctx, 'props_infra_group', objs=meshes, view=(0.3, -1.0, 0.62), res=(1280, 720), samples=48)
print('[done] props_infra_group')
